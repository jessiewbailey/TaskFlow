#!/bin/bash
# Apply missing database migrations in Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}TaskFlow Kubernetes Database Migration Application${NC}"
echo "=================================================="
echo ""

NAMESPACE="taskflow"

# Check if PostgreSQL pod exists
POSTGRES_POD=$(kubectl get pods -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
if [ -z "$POSTGRES_POD" ]; then
    echo -e "${RED}Error: PostgreSQL pod not found in namespace $NAMESPACE${NC}"
    exit 1
fi

echo -e "${YELLOW}PostgreSQL Pod: $POSTGRES_POD${NC}"

# Copy migration files to the pod
echo ""
echo -e "${YELLOW}Copying migration files to PostgreSQL pod...${NC}"
kubectl cp database/migrations/ $NAMESPACE/$POSTGRES_POD:/tmp/migrations/

# Apply migrations that are likely missing in k8s
echo ""
echo -e "${YELLOW}Applying embedding_status migration...${NC}"
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d taskflow_db -f /tmp/migrations/add_embedding_status.sql || echo "Migration may already be applied"

echo ""
echo -e "${YELLOW}Applying retry_count migration...${NC}"  
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d taskflow_db -f /tmp/migrations/add_retry_count_to_jobs.sql || echo "Migration may already be applied"

echo ""
echo -e "${YELLOW}Applying job_type enum migration...${NC}"
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d taskflow_db -f /tmp/migrations/update_job_type_enum.sql || echo "Migration may already be applied"

echo ""
echo -e "${YELLOW}Verifying schema changes...${NC}"

echo "Checking for embedding_status column..."
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d taskflow_db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='processing_jobs' AND column_name='embedding_status';"

echo ""
echo "Checking for retry_count column..."
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d taskflow_db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='processing_jobs' AND column_name='retry_count';"

echo ""
echo "Checking job_type enum values..."
kubectl exec -n $NAMESPACE $POSTGRES_POD -- psql -U postgres -d taskflow_db -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'job_type') ORDER BY enumlabel;"

echo ""
echo -e "${GREEN}Database migration application complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Restart API deployment: kubectl rollout restart deployment/taskflow-api -n $NAMESPACE"
echo "2. Check API logs: kubectl logs -f deployment/taskflow-api -n $NAMESPACE"
echo "3. Test the application"