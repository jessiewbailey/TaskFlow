#!/bin/bash
# Check and apply missing database migrations in Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}TaskFlow Kubernetes Database Migration Check${NC}"
echo "============================================="
echo ""

NAMESPACE="taskflow"

# Check if PostgreSQL pod exists
POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
if [ -z "$POSTGRES_POD" ]; then
    echo -e "${RED}Error: PostgreSQL pod not found in namespace $NAMESPACE${NC}"
    exit 1
fi

echo -e "${YELLOW}PostgreSQL Pod: $POSTGRES_POD${NC}"

echo ""
echo -e "${YELLOW}Checking current database schema...${NC}"

# Check if the new columns exist
echo "Checking for embedding_status column..."
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d taskflow -c "SELECT column_name FROM information_schema.columns WHERE table_name='processing_jobs' AND column_name='embedding_status';" || echo "Column check failed"

echo ""
echo "Checking for retry_count column..."
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d taskflow -c "SELECT column_name FROM information_schema.columns WHERE table_name='processing_jobs' AND column_name='retry_count';" || echo "Column check failed"

echo ""
echo "Checking job_type enum values..."
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d taskflow -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'job_type');" || echo "Enum check failed"

echo ""
echo -e "${YELLOW}Recent migration files that may need to be applied:${NC}"
echo "- add_embedding_status.sql"
echo "- add_retry_count_to_jobs.sql" 
echo "- update_job_type_enum.sql"

echo ""
echo -e "${YELLOW}To apply missing migrations, run:${NC}"
echo "kubectl cp database/migrations/ $NAMESPACE/$POSTGRES_POD:/tmp/migrations/"
echo "kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d taskflow -f /tmp/migrations/add_embedding_status.sql"
echo "kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d taskflow -f /tmp/migrations/add_retry_count_to_jobs.sql"
echo "kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d taskflow -f /tmp/migrations/update_job_type_enum.sql"