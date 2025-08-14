#!/bin/bash
# Fix TaskFlow Kubernetes networking issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}TaskFlow Kubernetes Networking Fix${NC}"
echo "=================================="
echo ""

NAMESPACE="taskflow"

echo -e "${YELLOW}Step 1: Updating secrets with Redis URL...${NC}"
kubectl patch secret taskflow-env -n $NAMESPACE -p '{"stringData":{"REDIS_URL":"redis://redis:6379/0"}}' 2>/dev/null || echo "Secret patch failed - might not exist yet"

echo ""
echo -e "${YELLOW}Step 2: Restarting API deployment to pick up new Redis config...${NC}"
kubectl rollout restart deployment/taskflow-api -n $NAMESPACE 2>/dev/null || echo "API deployment restart failed - might not exist yet"

echo ""
echo -e "${YELLOW}Step 3: Checking if all pods are running...${NC}"
kubectl get pods -n $NAMESPACE

echo ""
echo -e "${YELLOW}Step 4: Waiting for API deployment to be ready...${NC}"
kubectl rollout status deployment/taskflow-api -n $NAMESPACE --timeout=300s || echo "API deployment not ready"

echo ""
echo -e "${YELLOW}Step 5: Testing Redis connectivity from API pod...${NC}"
API_POD=$(kubectl get pods -n $NAMESPACE -l app=taskflow-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
if [ -n "$API_POD" ]; then
    echo "Testing Redis connection from $API_POD..."
    kubectl exec -n $NAMESPACE $API_POD -- ping -c 1 redis 2>/dev/null && echo "Redis ping successful" || echo "Redis ping failed"
fi

echo ""
echo -e "${YELLOW}Step 6: Testing API health endpoint...${NC}"
if [ -n "$API_POD" ]; then
    kubectl exec -n $NAMESPACE $API_POD -- curl -f http://localhost:8000/healthz 2>/dev/null && echo "API health check successful" || echo "API health check failed"
fi

echo ""
echo -e "${YELLOW}Step 7: Creating port-forward for testing...${NC}"
echo "Run this command in another terminal to test:"
echo "kubectl port-forward -n $NAMESPACE service/taskflow-web 3000:3000"
echo ""
echo "Then access the application at: http://localhost:3000"

echo ""
echo -e "${GREEN}Fix complete! Check pod status and test the application.${NC}"