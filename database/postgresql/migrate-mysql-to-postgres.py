#!/usr/bin/env python3
"""
MySQL to PostgreSQL Migration Script for TaskFlow

This script migrates data from MySQL to PostgreSQL while handling:
- Data type conversions
- Foreign key constraints
- JSON data migration
- Sequence updates
"""

import asyncio
import json
import sys
from datetime import datetime
from typing import Any, Dict, List

import aiomysql
import asyncpg
from asyncpg.connection import Connection as PGConnection
from aiomysql.connection import Connection as MySQLConnection


class TaskFlowMigrator:
    def __init__(self, mysql_config: Dict[str, Any], postgres_config: Dict[str, Any]):
        self.mysql_config = mysql_config
        self.postgres_config = postgres_config
        self.mysql_conn: MySQLConnection = None
        self.pg_conn: PGConnection = None

    async def connect(self):
        """Establish connections to both databases"""
        print("Connecting to MySQL...")
        self.mysql_conn = await aiomysql.connect(**self.mysql_config)
        
        print("Connecting to PostgreSQL...")
        self.pg_conn = await asyncpg.connect(**self.postgres_config)

    async def disconnect(self):
        """Close database connections"""
        if self.mysql_conn:
            self.mysql_conn.close()
        if self.pg_conn:
            await self.pg_conn.close()

    async def migrate_table(self, table_name: str, 
                          column_mapping: Dict[str, str] = None,
                          transform_func: callable = None):
        """Migrate data from MySQL table to PostgreSQL table"""
        print(f"\nMigrating table: {table_name}")
        
        # Fetch data from MySQL
        async with self.mysql_conn.cursor() as cursor:
            await cursor.execute(f"SELECT * FROM {table_name}")
            rows = await cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]
        
        if not rows:
            print(f"  No data to migrate in {table_name}")
            return 0
        
        # Prepare insert statement
        if column_mapping:
            pg_columns = [column_mapping.get(col, col) for col in columns]
        else:
            pg_columns = columns
        
        placeholders = [f"${i+1}" for i in range(len(pg_columns))]
        insert_sql = f"""
            INSERT INTO {table_name} ({', '.join(pg_columns)})
            VALUES ({', '.join(placeholders)})
            ON CONFLICT DO NOTHING
        """
        
        # Transform and insert data
        migrated_count = 0
        for row in rows:
            try:
                # Convert row to list and handle transformations
                row_data = list(row)
                
                # Apply custom transformation if provided
                if transform_func:
                    row_data = transform_func(dict(zip(columns, row_data)))
                    row_data = [row_data[col] for col in columns]
                
                # Handle JSON columns (convert dict to JSON string for PostgreSQL)
                for i, (col, val) in enumerate(zip(columns, row_data)):
                    if val and col in ['preferences', 'redactions_json', 'output_schema', 
                                     'model_parameters', 'fields', 'ai_value', 'ground_truth_value']:
                        if isinstance(val, str):
                            # Validate JSON
                            try:
                                json.loads(val)
                            except json.JSONDecodeError:
                                row_data[i] = '{}'
                        elif isinstance(val, dict):
                            row_data[i] = json.dumps(val)
                
                await self.pg_conn.execute(insert_sql, *row_data)
                migrated_count += 1
                
            except Exception as e:
                print(f"  Error migrating row: {e}")
                print(f"  Row data: {row}")
        
        print(f"  Migrated {migrated_count}/{len(rows)} rows")
        return migrated_count

    async def update_sequences(self):
        """Update PostgreSQL sequences to match the current max IDs"""
        print("\nUpdating sequences...")
        
        sequences = [
            ('users', 'id', 'users_id_seq'),
            ('workflows', 'id', 'workflows_id_seq'),
            ('requests', 'id', 'requests_id_seq'),
            ('ai_outputs', 'id', 'ai_outputs_id_seq'),
            ('workflow_blocks', 'id', 'workflow_blocks_id_seq'),
            ('workflow_block_inputs', 'id', 'workflow_block_inputs_id_seq'),
            ('workflow_dashboard_configs', 'id', 'workflow_dashboard_configs_id_seq'),
            ('custom_instructions', 'id', 'custom_instructions_id_seq'),
            ('ground_truth_data', 'id', 'ground_truth_data_id_seq'),
        ]
        
        for table, id_col, seq_name in sequences:
            try:
                max_id = await self.pg_conn.fetchval(
                    f"SELECT COALESCE(MAX({id_col}), 0) FROM {table}"
                )
                await self.pg_conn.execute(
                    f"SELECT setval('{seq_name}', {max_id + 1}, false)"
                )
                print(f"  Updated {seq_name} to {max_id + 1}")
            except Exception as e:
                print(f"  Error updating sequence {seq_name}: {e}")

    def transform_processing_jobs(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Transform processing_jobs data for PostgreSQL UUID type"""
        # Convert VARCHAR(36) UUID string to PostgreSQL UUID type
        if 'id' in row and row['id']:
            # The UUID is already in the correct string format
            pass
        return row

    async def migrate_all(self):
        """Migrate all tables in the correct order"""
        try:
            await self.connect()
            
            # Disable foreign key checks temporarily
            await self.pg_conn.execute("SET session_replication_role = 'replica'")
            
            # Migrate tables in dependency order
            tables = [
                ('users', None, None),
                ('workflows', None, None),
                ('requests', None, None),
                ('ai_outputs', None, None),
                ('processing_jobs', None, self.transform_processing_jobs),
                ('workflow_blocks', None, None),
                ('workflow_block_inputs', None, None),
                ('workflow_dashboard_configs', None, None),
                ('custom_instructions', None, None),
                ('ground_truth_data', None, None),
            ]
            
            total_migrated = 0
            for table_info in tables:
                if len(table_info) == 3:
                    table, mapping, transform = table_info
                else:
                    table, mapping = table_info
                    transform = None
                    
                count = await self.migrate_table(table, mapping, transform)
                total_migrated += count
            
            # Re-enable foreign key checks
            await self.pg_conn.execute("SET session_replication_role = 'origin'")
            
            # Update sequences
            await self.update_sequences()
            
            print(f"\n✅ Migration completed! Total rows migrated: {total_migrated}")
            
        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            raise
        finally:
            await self.disconnect()


async def main():
    # Configuration
    mysql_config = {
        'host': 'localhost',
        'port': 3306,
        'user': 'taskflow_user',
        'password': 'taskflow_password',
        'db': 'taskflow_db',
        'charset': 'utf8mb4'
    }
    
    postgres_config = {
        'host': 'localhost',
        'port': 5432,
        'user': 'taskflow_user',
        'password': 'taskflow_password',
        'database': 'taskflow_db'
    }
    
    # Override with environment variables if available
    import os
    if os.getenv('MYSQL_HOST'):
        mysql_config['host'] = os.getenv('MYSQL_HOST')
    if os.getenv('MYSQL_USER'):
        mysql_config['user'] = os.getenv('MYSQL_USER')
    if os.getenv('MYSQL_PASSWORD'):
        mysql_config['password'] = os.getenv('MYSQL_PASSWORD')
    if os.getenv('MYSQL_DATABASE'):
        mysql_config['db'] = os.getenv('MYSQL_DATABASE')
        
    if os.getenv('POSTGRES_HOST'):
        postgres_config['host'] = os.getenv('POSTGRES_HOST')
    if os.getenv('POSTGRES_USER'):
        postgres_config['user'] = os.getenv('POSTGRES_USER')
    if os.getenv('POSTGRES_PASSWORD'):
        postgres_config['password'] = os.getenv('POSTGRES_PASSWORD')
    if os.getenv('POSTGRES_DB'):
        postgres_config['database'] = os.getenv('POSTGRES_DB')
    
    print("TaskFlow MySQL to PostgreSQL Migration")
    print("=====================================")
    print(f"Source: MySQL @ {mysql_config['host']}:{mysql_config['port']}/{mysql_config['db']}")
    print(f"Target: PostgreSQL @ {postgres_config['host']}:{postgres_config['port']}/{postgres_config['database']}")
    
    response = input("\nProceed with migration? (yes/no): ")
    if response.lower() != 'yes':
        print("Migration cancelled.")
        return
    
    migrator = TaskFlowMigrator(mysql_config, postgres_config)
    await migrator.migrate_all()


if __name__ == "__main__":
    asyncio.run(main())