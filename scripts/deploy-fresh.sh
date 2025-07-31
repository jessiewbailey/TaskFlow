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
REGISTRY="${REGISTRY:-docker.io/jessiewbailey}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo -e "${GREEN}=== TaskFlow Fresh Deployment Script ===${NC}"
echo -e "${YELLOW}This will perform a complete deployment from scratch${NC}"
echo -e "${YELLOW}WARNING: This will delete existing deployments and volumes!${NC}"
echo ""
echo "Using registry: $REGISTRY"
echo "Using image tag: $IMAGE_TAG"
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

# Wait a bit for cleanup
echo "Waiting for cleanup to complete..."
sleep 10

echo -e "${GREEN}Step 2: Create namespace${NC}"
kubectl create namespace $NAMESPACE

echo -e "${GREEN}Step 3: Verify required files${NC}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if init SQL is up to date
if [ -f "$PROJECT_ROOT/database/postgresql/init-complete.sql" ]; then
    echo "Copying PostgreSQL init script for Kustomize..."
    cp "$PROJECT_ROOT/database/postgresql/init-complete.sql" "$PROJECT_ROOT/k8s/base/01-init-complete.sql"
else
    echo -e "${RED}Error: init-complete.sql not found${NC}"
    exit 1
fi

echo -e "${GREEN}Step 4: Build and push Docker images${NC}"
echo "Building images with tag: $REGISTRY/taskflow-*:$IMAGE_TAG"

# Build images
cd "$PROJECT_ROOT"

# Only build and push if not using pre-built images
if [[ "$REGISTRY" != "docker.io/jessiewbailey" ]] || [[ "$IMAGE_TAG" != "latest" ]]; then
    docker build -t $REGISTRY/taskflow-api:$IMAGE_TAG backend/
    docker build -t $REGISTRY/taskflow-ai:$IMAGE_TAG ai-worker/
    docker build -t $REGISTRY/taskflow-web:$IMAGE_TAG frontend/
    
    # Build Ollama image if exists
    if [ -d "ollama" ]; then
        docker build -t $REGISTRY/taskflow-ollama:$IMAGE_TAG ollama/
    fi
    
    # Push images
    docker push $REGISTRY/taskflow-api:$IMAGE_TAG
    docker push $REGISTRY/taskflow-ai:$IMAGE_TAG
    docker push $REGISTRY/taskflow-web:$IMAGE_TAG
    
    if [ -d "ollama" ]; then
        docker push $REGISTRY/taskflow-ollama:$IMAGE_TAG
    fi
else
    echo "Using pre-built images from Docker Hub"
fi

echo -e "${GREEN}Step 5: Apply Kubernetes configurations${NC}"

# Create temporary kustomization file with correct image references
cd "$PROJECT_ROOT/k8s/base"
cat > kustomization-deploy.yaml << EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

# Include base configuration
resources:
$(cat kustomization.yaml | sed -n '/^resources:/,/^[^[:space:]#]/p' | sed '1d;$d')

# ConfigMap generators
configMapGenerator:
$(cat kustomization.yaml | sed -n '/^configMapGenerator:/,/^[^[:space:]]/p' | sed '1d;$d')

# Image transformations
images:
  - name: docker.io/jessiewbailey/taskflow-api
    newName: $REGISTRY/taskflow-api
    newTag: $IMAGE_TAG
  - name: docker.io/jessiewbailey/taskflow-ai
    newName: $REGISTRY/taskflow-ai
    newTag: $IMAGE_TAG
  - name: docker.io/jessiewbailey/taskflow-web
    newName: $REGISTRY/taskflow-web
    newTag: $IMAGE_TAG
  - name: docker.io/jessiewbailey/taskflow-ollama
    newName: $REGISTRY/taskflow-ollama
    newTag: $IMAGE_TAG

# Labels
labels:
$(cat kustomization.yaml | sed -n '/^labels:/,/^[^[:space:]]/p' | sed '1d;$d')

# Namespace
namespace: $NAMESPACE
EOF

# Apply the configuration by temporarily replacing the kustomization file
mv kustomization.yaml kustomization.original.yaml
mv kustomization-deploy.yaml kustomization.yaml

# Apply using kustomize
kubectl apply -k .

# Restore original kustomization file
mv kustomization.yaml kustomization-deploy.yaml
mv kustomization.original.yaml kustomization.yaml

# Clean up temporary file
rm -f kustomization-deploy.yaml

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

echo -e "${GREEN}Step 8: Wait for Ollama${NC}"
if kubectl get deployment ollama -n $NAMESPACE &> /dev/null; then
    wait_for_deployment "ollama" "$NAMESPACE"
    
    # Wait for model initialization
    if kubectl get job ollama-model-puller -n $NAMESPACE &> /dev/null; then
        echo "Waiting for Ollama models to be pulled..."
        wait_for_job "ollama-model-puller" "$NAMESPACE"
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

echo ""
echo "Checking services..."
kubectl get svc -n $NAMESPACE

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
echo "kubectl logs -n $NAMESPACE -l app=ollama"