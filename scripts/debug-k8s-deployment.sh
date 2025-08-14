#!/bin/bash
# TaskFlow Kubernetes Deployment Debugging Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}TaskFlow Kubernetes Deployment Debugging${NC}"
echo "=========================================="
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl not found. Please install kubectl first.${NC}"
    exit 1
fi

# Check if we're connected to a cluster
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Not connected to a Kubernetes cluster.${NC}"
    echo "Please ensure your kubectl is configured and you have access to a cluster."
    echo "For Docker Desktop: Enable Kubernetes in Docker Desktop settings"
    exit 1
fi

echo -e "${YELLOW}Current Kubernetes context:${NC}"
kubectl config current-context

echo ""
echo -e "${YELLOW}Checking existing TaskFlow deployment...${NC}"

# Check if TaskFlow namespace exists
if kubectl get namespace taskflow &> /dev/null; then
    echo -e "${YELLOW}TaskFlow namespace exists. Checking pod status...${NC}"
    kubectl get pods -n taskflow
    
    echo ""
    echo -e "${YELLOW}Checking services...${NC}"
    kubectl get svc -n taskflow
    
    echo ""
    echo -e "${YELLOW}Checking API pod logs...${NC}"
    API_POD=$(kubectl get pods -n taskflow -l app=taskflow-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$API_POD" ]; then
        echo "API Pod: $API_POD"
        kubectl logs $API_POD -n taskflow --tail=50
        
        echo ""
        echo -e "${YELLOW}Checking API pod description...${NC}"
        kubectl describe pod $API_POD -n taskflow
    else
        echo -e "${RED}No API pod found${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}Checking Redis pod...${NC}"
    REDIS_POD=$(kubectl get pods -n taskflow -l app=redis -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$REDIS_POD" ]; then
        echo "Redis Pod: $REDIS_POD"
        kubectl logs $REDIS_POD -n taskflow --tail=20
    else
        echo -e "${RED}No Redis pod found - this is likely the problem!${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}Checking PostgreSQL pod...${NC}"
    POSTGRES_POD=$(kubectl get pods -n taskflow -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$POSTGRES_POD" ]; then
        echo "PostgreSQL Pod: $POSTGRES_POD"
        kubectl logs $POSTGRES_POD -n taskflow --tail=20
    else
        echo -e "${RED}No PostgreSQL pod found${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}Testing API health endpoint...${NC}"
    if [ -n "$API_POD" ]; then
        kubectl exec -n taskflow $API_POD -- curl -f http://localhost:8000/healthz 2>/dev/null || echo -e "${RED}API health check failed${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}Testing Redis connectivity from API pod...${NC}"
    if [ -n "$API_POD" ]; then
        kubectl exec -n taskflow $API_POD -- ping -c 1 redis 2>/dev/null || echo -e "${RED}Cannot ping Redis from API pod${NC}"
    fi
    
else
    echo -e "${YELLOW}TaskFlow namespace does not exist. Need to deploy first.${NC}"
    echo "Run: ./scripts/deploy.sh"
fi

echo ""
echo -e "${GREEN}Debugging complete!${NC}"