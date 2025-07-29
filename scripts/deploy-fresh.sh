#!/bin/bash

# TaskFlow Fresh Deployment Script
# This script performs a complete deployment from scratch with blank volumes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="taskflow"
LLM_NAMESPACE="llm"
REGISTRY="${REGISTRY:-localhost:5000}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo -e "${GREEN}=== TaskFlow Fresh Deployment Script ===${NC}"
echo -e "${YELLOW}This will perform a complete deployment from scratch${NC}"
echo -e "${YELLOW}WARNING: This will delete existing deployments and volumes!${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Function to check if namespace exists
namespace_exists() {
    kubectl get namespace "$1" &> /dev/null
}

# Function to wait for deployment
wait_for_deployment() {
    local deployment=$1
    local namespace=$2
    echo -e "${YELLOW}Waiting for $deployment to be ready...${NC}"
    kubectl rollout status deployment/$deployment -n $namespace --timeout=300s
}

# Function to wait for statefulset
wait_for_statefulset() {
    local statefulset=$1
    local namespace=$2
    echo -e "${YELLOW}Waiting for $statefulset to be ready...${NC}"
    kubectl rollout status statefulset/$statefulset -n $namespace --timeout=300s
}

# Function to wait for job completion
wait_for_job() {
    local job=$1
    local namespace=$2
    echo -e "${YELLOW}Waiting for job $job to complete...${NC}"
    kubectl wait --for=condition=complete job/$job -n $namespace --timeout=300s
}

echo -e "${GREEN}Step 1: Clean up existing deployments${NC}"
echo "Removing existing deployments and volumes..."

# Delete existing deployments
if namespace_exists "$NAMESPACE"; then
    echo "Deleting TaskFlow namespace..."
    kubectl delete namespace $NAMESPACE --wait=true || true
fi


if namespace_exists "$LLM_NAMESPACE"; then
    echo "Deleting LLM namespace..."
    kubectl delete namespace $LLM_NAMESPACE --wait=true || true
fi

# Wait a bit for cleanup
echo "Waiting for cleanup to complete..."
sleep 10

echo -e "${GREEN}Step 2: Create namespaces${NC}"
kubectl create namespace $NAMESPACE
kubectl create namespace $LLM_NAMESPACE

echo -e "${GREEN}Step 3: Verify required files${NC}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if init SQL is up to date
if [ -f "$PROJECT_ROOT/database/postgresql/init-complete.sql" ]; then
    echo "Regenerating PostgreSQL init ConfigMap..."
    cd "$PROJECT_ROOT"
    ./scripts/generate-postgres-init-configmap.sh
else
    echo -e "${RED}Error: init-complete.sql not found${NC}"
    exit 1
fi

echo -e "${GREEN}Step 4: Build and push Docker images${NC}"
echo "Building images with tag: $REGISTRY/taskflow-*:$IMAGE_TAG"

# Build images
cd "$PROJECT_ROOT"
docker build -t $REGISTRY/taskflow-api:$IMAGE_TAG backend/
docker build -t $REGISTRY/taskflow-ai:$IMAGE_TAG ai-worker/
docker build -t $REGISTRY/taskflow-web:$IMAGE_TAG frontend/

# Push images
docker push $REGISTRY/taskflow-api:$IMAGE_TAG
docker push $REGISTRY/taskflow-ai:$IMAGE_TAG
docker push $REGISTRY/taskflow-web:$IMAGE_TAG

echo -e "${GREEN}Step 5: Apply Kubernetes configurations${NC}"

# Check which overlay to use
if [ -n "$K8S_OVERLAY" ]; then
    OVERLAY_PATH="$PROJECT_ROOT/k8s/overlays/$K8S_OVERLAY"
    if [ -d "$OVERLAY_PATH" ]; then
        echo "Using overlay: $K8S_OVERLAY"
        kubectl apply -k "$OVERLAY_PATH"
    else
        echo -e "${RED}Error: Overlay $K8S_OVERLAY not found${NC}"
        exit 1
    fi
else
    # Default to internal-ollama overlay with local registry
    echo "Using default overlay: internal-ollama with local-registry"
    cd "$PROJECT_ROOT/k8s/overlays/internal-ollama"
    
    # Create temporary kustomization that includes local-registry
    cat > kustomization-temp.yaml << EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base
  - deployment-config-patch.yaml
  - ollama-deployment.yaml
  - ollama-model-init.yaml

images:
  - name: registry2.omb.gov/library/bailey/taskflow-api
    newName: $REGISTRY/taskflow-api
    newTag: $IMAGE_TAG
  - name: registry2.omb.gov/library/bailey/taskflow-ai
    newName: $REGISTRY/taskflow-ai
    newTag: $IMAGE_TAG
  - name: registry2.omb.gov/library/bailey/taskflow-web
    newName: $REGISTRY/taskflow-web
    newTag: $IMAGE_TAG

patchesStrategicMerge:
  - deployment-config-patch.yaml
EOF

    kubectl apply -k .
    rm -f kustomization-temp.yaml
fi

echo -e "${GREEN}Step 6: Wait for core services${NC}"

# Wait for Qdrant
wait_for_deployment "qdrant" "$NAMESPACE"

# Wait for PostgreSQL
wait_for_statefulset "postgres" "$NAMESPACE"

# Wait for database initialization
echo "Waiting for database to be ready..."
sleep 15

# Database initialization happens automatically via PostgreSQL's docker-entrypoint-initdb.d
echo -e "${GREEN}Step 7: Database initialization${NC}"
echo "PostgreSQL will automatically initialize the database on first startup..."
sleep 10

echo -e "${GREEN}Step 8: Wait for Ollama (if internal)${NC}"
if kubectl get deployment ollama -n $LLM_NAMESPACE &> /dev/null; then
    wait_for_deployment "ollama" "$LLM_NAMESPACE"
    
    # Wait for model initialization
    if kubectl get job ollama-model-puller -n $LLM_NAMESPACE &> /dev/null; then
        echo "Waiting for Ollama models to be pulled..."
        wait_for_job "ollama-model-puller" "$LLM_NAMESPACE"
    fi
fi

echo -e "${GREEN}Step 9: Deploy application services${NC}"

# Wait for AI service
wait_for_deployment "taskflow-ai" "$NAMESPACE"

# Wait for API service
wait_for_deployment "taskflow-api" "$NAMESPACE"

# Wait for Web service
wait_for_deployment "taskflow-web" "$NAMESPACE"

echo -e "${GREEN}Step 10: Verify deployment${NC}"

echo "Checking pod status..."
kubectl get pods -n $NAMESPACE
kubectl get pods -n $LLM_NAMESPACE

echo ""
echo "Checking services..."
kubectl get svc -n $NAMESPACE
kubectl get svc -n $LLM_NAMESPACE

echo ""
echo "Checking ingress..."
kubectl get ingress -n $NAMESPACE

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "TaskFlow has been deployed successfully!"
echo ""
echo "To access the application:"
echo "1. Port-forward (for testing): kubectl port-forward -n $NAMESPACE svc/taskflow-web 3000:3000"
echo "2. Or access via your configured ingress URL"
echo ""
echo "Default credentials:"
echo "- Admin: admin@system.local"
echo "- Analyst: analyst@system.local"
echo ""
echo "To check logs:"
echo "kubectl logs -n $NAMESPACE -l app=taskflow-api"
echo "kubectl logs -n $NAMESPACE -l app=taskflow-ai"
echo "kubectl logs -n $NAMESPACE -l app=taskflow-web"
echo "kubectl logs -n $NAMESPACE -l app=qdrant"
echo "kubectl logs -n $LLM_NAMESPACE -l app=ollama"