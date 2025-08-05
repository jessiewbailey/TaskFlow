#!/usr/bin/env python3
"""
TaskFlow Database Migration Tool
Manages database schema migrations with tracking and rollback support
"""

import os
import sys
import hashlib
import argparse
import psycopg2
import time
from datetime import datetime
from pathlib import Path
from typing import List, Tuple, Optional
import re

class MigrationManager:
    def __init__(self, db_config: dict):
        self.db_config = db_config
        self.conn = None
        self.migrations_dir = Path(__file__).parent / "migrations"
        self.backend_migrations_dir = Path(__file__).parent.parent / "backend" / "migrations"
        
    def connect(self):
        """Establish database connection"""
        try:
            self.conn = psycopg2.connect(
                host=self.db_config.get('host', 'localhost'),
                port=self.db_config.get('port', 5432),
                database=self.db_config.get('database', 'taskflow_db'),
                user=self.db_config.get('user', 'postgres'),
                password=self.db_config.get('password', '')
            )
            self.conn.autocommit = False
            print(f"Connected to database: {self.db_config.get('database')}")
        except Exception as e:
            print(f"Error connecting to database: {e}")
            sys.exit(1)
            
    def disconnect(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            
    def init_migration_tracking(self):
        """Initialize migration tracking system"""
        init_sql = self.migrations_dir / "001_create_migration_tracking.sql"
        if init_sql.exists():
            with self.conn.cursor() as cursor:
                # Check if tracking table exists
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_name = 'schema_migrations'
                    )
                """)
                if not cursor.fetchone()[0]:
                    print("Initializing migration tracking system...")
                    with open(init_sql, 'r') as f:
                        cursor.execute(f.read())
                    self.conn.commit()
                    print("Migration tracking initialized.")
                    
    def get_migration_files(self) -> List[Tuple[str, Path]]:
        """Get all migration files sorted by version"""
        migrations = []
        
        # Collect from both directories
        for migrations_dir in [self.migrations_dir, self.backend_migrations_dir]:
            if migrations_dir.exists():
                for file in migrations_dir.glob("*.sql"):
                    # Skip the tracking system migration if already applied
                    if file.name == "001_create_migration_tracking.sql":
                        with self.conn.cursor() as cursor:
                            cursor.execute(
                                "SELECT 1 FROM schema_migrations WHERE version = %s",
                                ('001_create_migration_tracking',)
                            )
                            if cursor.fetchone():
                                continue
                    
                    # Extract version from filename (e.g., "001_" or date prefix)
                    match = re.match(r'^(\d+)[_-](.+)\.sql$', file.name)
                    if match:
                        version = f"{match.group(1)}_{match.group(2)}"
                    else:
                        version = file.stem
                    
                    migrations.append((version, file))
                    
        # Sort by version
        migrations.sort(key=lambda x: x[0])
        return migrations
        
    def calculate_checksum(self, filepath: Path) -> str:
        """Calculate SHA256 checksum of a file"""
        with open(filepath, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()
            
    def get_applied_migrations(self) -> set:
        """Get set of already applied migrations"""
        with self.conn.cursor() as cursor:
            cursor.execute("SELECT version FROM schema_migrations WHERE success = true")
            return {row[0] for row in cursor.fetchall()}
            
    def extract_rollback_sql(self, content: str) -> Optional[str]:
        """Extract rollback SQL from migration file comments"""
        # Look for rollback section in comments
        rollback_match = re.search(
            r'--\s*ROLLBACK:?\s*\n((?:--.*\n)*)',
            content,
            re.MULTILINE | re.IGNORECASE
        )
        if rollback_match:
            # Remove comment markers
            rollback_lines = rollback_match.group(1).split('\n')
            rollback_sql = '\n'.join(
                line[2:].strip() if line.startswith('--') else line
                for line in rollback_lines if line.strip()
            )
            return rollback_sql if rollback_sql.strip() else None
        return None
        
    def run_migration(self, version: str, filepath: Path) -> Tuple[bool, Optional[str]]:
        """Run a single migration"""
        print(f"\nRunning migration: {version}")
        print(f"  File: {filepath}")
        
        try:
            with open(filepath, 'r') as f:
                content = f.read()
                
            checksum = self.calculate_checksum(filepath)
            rollback_sql = self.extract_rollback_sql(content)
            
            # Extract description from first comment
            desc_match = re.search(r'^--\s*(.+?)$', content, re.MULTILINE)
            description = desc_match.group(1) if desc_match else version
            
            start_time = time.time()
            
            with self.conn.cursor() as cursor:
                cursor.execute(content)
                
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            # Record migration
            with self.conn.cursor() as cursor:
                cursor.execute("""
                    SELECT record_migration(%s, %s, %s, %s, %s, %s, %s)
                """, (
                    version,
                    description,
                    checksum,
                    execution_time_ms,
                    True,
                    None,
                    rollback_sql
                ))
                
            self.conn.commit()
            print(f"  ✓ Applied successfully in {execution_time_ms}ms")
            return True, None
            
        except Exception as e:
            self.conn.rollback()
            error_msg = str(e)
            print(f"  ✗ Failed: {error_msg}")
            
            # Record failed migration
            try:
                with self.conn.cursor() as cursor:
                    cursor.execute("""
                        SELECT record_migration(%s, %s, %s, %s, %s, %s, %s)
                    """, (
                        version,
                        filepath.name,
                        'error',
                        0,
                        False,
                        error_msg,
                        None
                    ))
                self.conn.commit()
            except:
                pass
                
            return False, error_msg
            
    def run_pending_migrations(self, target_version: Optional[str] = None):
        """Run all pending migrations up to target version"""
        self.init_migration_tracking()
        
        migrations = self.get_migration_files()
        applied = self.get_applied_migrations()
        
        pending = [
            (version, path) for version, path in migrations
            if version not in applied
        ]
        
        if not pending:
            print("No pending migrations.")
            return
            
        print(f"Found {len(pending)} pending migration(s):")
        for version, path in pending:
            print(f"  - {version}")
            
        if target_version:
            pending = [
                (v, p) for v, p in pending
                if v <= target_version
            ]
            
        print(f"\nApplying {len(pending)} migration(s)...")
        
        success_count = 0
        for version, filepath in pending:
            success, error = self.run_migration(version, filepath)
            if success:
                success_count += 1
            else:
                print(f"\nMigration failed. Stopping at {version}")
                break
                
        print(f"\nSummary: {success_count}/{len(pending)} migrations applied successfully.")
        
    def rollback_migration(self, version: str):
        """Rollback a specific migration"""
        with self.conn.cursor() as cursor:
            cursor.execute("""
                SELECT rollback_sql, success 
                FROM schema_migrations 
                WHERE version = %s
            """, (version,))
            
            result = cursor.fetchone()
            if not result:
                print(f"Migration {version} not found.")
                return
                
            rollback_sql, success = result
            
            if not success:
                print(f"Migration {version} was not successfully applied.")
                return
                
            if not rollback_sql:
                print(f"No rollback SQL defined for migration {version}")
                return
                
        print(f"Rolling back migration: {version}")
        try:
            with self.conn.cursor() as cursor:
                cursor.execute(rollback_sql)
                cursor.execute("""
                    UPDATE schema_migrations 
                    SET type = 'rollback', 
                        success = false,
                        applied_at = CURRENT_TIMESTAMP
                    WHERE version = %s
                """, (version,))
                
            self.conn.commit()
            print(f"✓ Rollback completed successfully")
            
        except Exception as e:
            self.conn.rollback()
            print(f"✗ Rollback failed: {e}")
            
    def status(self):
        """Show migration status"""
        with self.conn.cursor() as cursor:
            cursor.execute("""
                SELECT version, description, applied_at, applied_by, status
                FROM migration_status
                ORDER BY applied_at DESC
                LIMIT 20
            """)
            
            results = cursor.fetchall()
            
        if not results:
            print("No migrations have been applied.")
            return
            
        print("\nMigration Status (last 20):")
        print("-" * 100)
        print(f"{'Version':<40} {'Applied At':<20} {'By':<15} {'Status':<25}")
        print("-" * 100)
        
        for row in results:
            version, desc, applied_at, by, status = row
            applied_str = applied_at.strftime("%Y-%m-%d %H:%M:%S")
            print(f"{version:<40} {applied_str:<20} {by:<15} {status:<25}")

def main():
    parser = argparse.ArgumentParser(description='TaskFlow Database Migration Tool')
    parser.add_argument('command', choices=['migrate', 'rollback', 'status'],
                       help='Command to run')
    parser.add_argument('--version', help='Target version for migrate/rollback')
    parser.add_argument('--host', default='localhost', help='Database host')
    parser.add_argument('--port', default='5432', help='Database port')
    parser.add_argument('--database', default='taskflow_db', help='Database name')
    parser.add_argument('--user', default='postgres', help='Database user')
    parser.add_argument('--password', default='', help='Database password')
    
    args = parser.parse_args()
    
    db_config = {
        'host': args.host,
        'port': args.port,
        'database': args.database,
        'user': args.user,
        'password': args.password or os.environ.get('PGPASSWORD', '')
    }
    
    manager = MigrationManager(db_config)
    
    try:
        manager.connect()
        
        if args.command == 'migrate':
            manager.run_pending_migrations(args.version)
        elif args.command == 'rollback':
            if not args.version:
                print("Error: --version required for rollback")
                sys.exit(1)
            manager.rollback_migration(args.version)
        elif args.command == 'status':
            manager.status()
            
    finally:
        manager.disconnect()

if __name__ == '__main__':
    main()