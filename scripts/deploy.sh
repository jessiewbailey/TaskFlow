#!/bin/bash
# TaskFlow Kubernetes Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}TaskFlow Kubernetes Deployment${NC}"
echo "=============================="
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
    exit 1
fi

echo -e "${YELLOW}Current Kubernetes context:${NC}"
kubectl config current-context

echo ""
echo -e "${YELLOW}Images will be pulled from Docker Hub:${NC}"
echo "  - docker.io/jessiewbailey/taskflow-api:latest"
echo "  - docker.io/jessiewbailey/taskflow-ai:latest"
echo "  - docker.io/jessiewbailey/taskflow-web:latest"
echo "  - docker.io/jessiewbailey/taskflow-ollama:latest"

echo ""
read -p "Continue with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Clean up any existing deployment
echo ""
echo -e "${YELLOW}Cleaning up any existing deployment...${NC}"
kubectl delete namespace taskflow --ignore-not-found=true
# Wait for cleanup
echo "Waiting for cleanup to complete..."
kubectl wait --for=delete namespace/taskflow --timeout=60s || true

# Create namespace
echo ""
echo -e "${YELLOW}Creating namespace...${NC}"
kubectl create namespace taskflow

echo ""
echo -e "${YELLOW}Namespace created. All services including Ollama will be deployed to 'taskflow' namespace.${NC}"
echo ""

# Deploy TaskFlow
echo ""
echo -e "${YELLOW}Deploying TaskFlow from Docker Hub images...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Deploy using the correct path
kubectl apply -k "${PROJECT_ROOT}/k8s/base/"

echo ""
echo -e "${YELLOW}Waiting for pods to be ready...${NC}"

# Wait for PostgreSQL first
echo "Waiting for PostgreSQL..."
kubectl wait --for=condition=ready pod -l app=postgres -n taskflow --timeout=300s || {
    echo -e "${RED}PostgreSQL failed to start${NC}"
    kubectl describe pods -l app=postgres -n taskflow
    exit 1
}

# Wait for Qdrant
echo "Waiting for Qdrant..."
kubectl wait --for=condition=ready pod -l app=qdrant -n taskflow --timeout=300s || {
    echo -e "${RED}Qdrant failed to start${NC}"
    kubectl describe pods -l app=qdrant -n taskflow
    exit 1
}

# Wait for Ollama
echo "Waiting for Ollama..."
kubectl wait --for=condition=ready pod -l app=ollama -n taskflow --timeout=600s || {
    echo -e "${RED}Ollama failed to start${NC}"
    kubectl describe pods -l app=ollama -n taskflow
    exit 1
}

# Wait for API
echo "Waiting for API..."
kubectl wait --for=condition=ready pod -l app=taskflow-api -n taskflow --timeout=300s || {
    echo -e "${RED}API failed to start${NC}"
    kubectl describe pods -l app=taskflow-api -n taskflow
    exit 1
}

# Wait for Web
echo "Waiting for Web frontend..."
kubectl wait --for=condition=ready pod -l app=taskflow-web -n taskflow --timeout=300s || {
    echo -e "${RED}Web frontend failed to start${NC}"
    kubectl describe pods -l app=taskflow-web -n taskflow
    exit 1
}

# Wait for AI Worker
echo "Waiting for AI Worker..."
kubectl wait --for=condition=ready pod -l app=taskflow-ai -n taskflow --timeout=300s || {
    echo -e "${RED}AI Worker failed to start${NC}"
    kubectl describe pods -l app=taskflow-ai -n taskflow
    exit 1
}

echo ""
echo -e "${GREEN}✓ Deployment complete!${NC}"
echo ""
echo -e "${YELLOW}Deployment status:${NC}"
kubectl get pods -n taskflow

echo ""
echo -e "${YELLOW}Services:${NC}"
kubectl get svc -n taskflow

echo ""
echo -e "${GREEN}To access TaskFlow:${NC}"
echo "1. Run: kubectl port-forward -n taskflow service/taskflow-web 3000:3000"
echo "2. Open: http://localhost:3000"
echo ""
echo -e "${YELLOW}Model initialization:${NC}"
echo "Check model download progress: kubectl logs -f job/ollama-model-init -n taskflow"
echo ""
echo -e "${YELLOW}Images used:${NC}"
kubectl get pods -n taskflow -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}' | column -t