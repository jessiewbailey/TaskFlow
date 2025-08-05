#!/bin/bash
# TaskFlow Database Migration Script
# 
# This script helps manage Alembic database migrations in Kubernetes
#
# Usage:
#   ./scripts/db-migrate.sh status           # Show current migration status
#   ./scripts/db-migrate.sh upgrade          # Run all pending migrations
#   ./scripts/db-migrate.sh downgrade -1     # Rollback one migration
#   ./scripts/db-migrate.sh history          # Show migration history
#   ./scripts/db-migrate.sh create "name"    # Create new migration
#   ./scripts/db-migrate.sh init-check       # Check if DB needs init

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE=${NAMESPACE:-taskflow}
DEPLOYMENT=${DEPLOYMENT:-taskflow-api}
CONTAINER=${CONTAINER:-api}

# Function to check if deployment exists
check_deployment() {
    if ! kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" &>/dev/null; then
        echo -e "${RED}Error: Deployment $DEPLOYMENT not found in namespace $NAMESPACE${NC}"
        exit 1
    fi
}

# Function to get a running pod
get_pod() {
    kubectl get pod -n "$NAMESPACE" -l app="$DEPLOYMENT" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null
}

# Function to execute command in pod
exec_in_pod() {
    local pod=$(get_pod)
    if [ -z "$pod" ]; then
        echo -e "${RED}Error: No running pod found for $DEPLOYMENT${NC}"
        exit 1
    fi
    kubectl exec -n "$NAMESPACE" "$pod" -c "$CONTAINER" -- "$@"
}

# Main script logic
ACTION=${1:-status}

case $ACTION in
    status)
        echo -e "${BLUE}Current migration status:${NC}"
        check_deployment
        exec_in_pod alembic current
        ;;
    
    upgrade)
        TARGET=${2:-head}
        echo -e "${BLUE}Running migrations to: $TARGET${NC}"
        check_deployment
        
        # Show what will be upgraded
        echo -e "${YELLOW}Pending migrations:${NC}"
        exec_in_pod alembic history -i
        
        # Confirm
        read -p "Continue with upgrade? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            exec_in_pod alembic upgrade "$TARGET"
            echo -e "${GREEN}✓ Migrations completed${NC}"
        else
            echo -e "${YELLOW}Upgrade cancelled${NC}"
        fi
        ;;
    
    downgrade)
        TARGET=${2:--1}
        echo -e "${YELLOW}⚠️  Rolling back migrations to: $TARGET${NC}"
        check_deployment
        
        # Show current state
        echo -e "${BLUE}Current state:${NC}"
        exec_in_pod alembic current
        
        # Confirm
        read -p "Are you sure you want to rollback? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            exec_in_pod alembic downgrade "$TARGET"
            echo -e "${GREEN}✓ Rollback completed${NC}"
        else
            echo -e "${YELLOW}Rollback cancelled${NC}"
        fi
        ;;
    
    history)
        echo -e "${BLUE}Migration history:${NC}"
        check_deployment
        exec_in_pod alembic history -v
        ;;
    
    create)
        NAME=${2}
        if [ -z "$NAME" ]; then
            echo -e "${RED}Error: Migration name required${NC}"
            echo "Usage: $0 create \"descriptive_migration_name\""
            exit 1
        fi
        
        echo -e "${BLUE}Creating new migration: $NAME${NC}"
        check_deployment
        
        # Create migration in pod
        exec_in_pod alembic revision -m "$NAME" --autogenerate
        
        echo -e "${YELLOW}Note: Migration created in pod. To retrieve it:${NC}"
        echo "kubectl cp $NAMESPACE/$(get_pod):/app/alembic/versions/<new_file>.py ./backend/alembic/versions/"
        ;;
    
    init-check)
        echo -e "${BLUE}Checking if database needs initialization...${NC}"
        check_deployment
        
        # Try to get current revision
        if exec_in_pod alembic current 2>/dev/null | grep -q "head"; then
            echo -e "${GREEN}✓ Database is up to date${NC}"
        else
            echo -e "${YELLOW}⚠️  Database needs migrations${NC}"
            echo "Run: $0 upgrade"
        fi
        ;;
    
    validate)
        echo -e "${BLUE}Validating migration files...${NC}"
        check_deployment
        
        # Check for migration conflicts
        exec_in_pod alembic check
        echo -e "${GREEN}✓ No conflicts found${NC}"
        ;;
    
    *)
        echo -e "${BLUE}TaskFlow Database Migration Tool${NC}"
        echo
        echo "Usage: $0 {command} [options]"
        echo
        echo "Commands:"
        echo "  status              Show current migration status"
        echo "  upgrade [target]    Run migrations (default: head)"
        echo "  downgrade [target]  Rollback migrations (default: -1)"
        echo "  history             Show migration history"
        echo "  create <name>       Create new migration"
        echo "  init-check          Check if DB needs initialization"
        echo "  validate            Validate migration files"
        echo
        echo "Environment Variables:"
        echo "  NAMESPACE           Kubernetes namespace (default: taskflow)"
        echo "  DEPLOYMENT          Deployment name (default: taskflow-api)"
        echo "  CONTAINER           Container name (default: api)"
        echo
        echo "Examples:"
        echo "  $0 status"
        echo "  $0 upgrade"
        echo "  $0 downgrade -1"
        echo "  $0 create \"add_user_preferences_table\""
        exit 1
        ;;
esac