#!/bin/bash
set -e

# Fresh Deployment Script for TaskFlow
# Includes all recent fixes:
# - Backend: embedding_service_url configuration, job_service fixes
# - AI Worker: gpt-oss Harmony format support, improved reasoning
# - Frontend: workflow export/import with system_prompt

echo "=== TaskFlow Fresh Deployment ==="
echo "This script will build and deploy all components with recent fixes"
echo ""

# Configuration
REGISTRY=${DOCKER_REGISTRY:-"docker.io/jessiewbailey"}
NAMESPACE=${K8S_NAMESPACE:-"taskflow"}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TAG="v${TIMESTAMP}"

echo "Configuration:"
echo "  Registry: $REGISTRY"
echo "  Namespace: $NAMESPACE"
echo "  Tag: $TAG"
echo ""

# Function to check if command exists
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "Error: $1 is not installed"
        exit 1
    fi
}

# Check prerequisites
echo "Checking prerequisites..."
check_command docker
check_command kubectl
check_command npm

# Function to build and push Docker image
build_and_push() {
    local service=$1
    local context=$2
    local image_name="${REGISTRY}/taskflow-${service}:${TAG}"
    local latest_name="${REGISTRY}/taskflow-${service}:latest"
    
    echo ""
    echo "Building ${service}..."
    docker build -t ${image_name} -t ${latest_name} ${context}
    
    echo "Pushing ${service}..."
    docker push ${image_name}
    docker push ${latest_name}
    
    echo "✓ ${service} built and pushed successfully"
}

# Step 1: Build Frontend
echo ""
echo "=== Step 1: Building Frontend ==="
cd frontend
echo "Installing dependencies..."
npm install --silent
echo "Building production bundle..."
npm run build
cd ..
build_and_push "web" "frontend"

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "1", "content": "Create fresh deployment script with all recent changes", "status": "completed"}, {"id": "2", "content": "Include backend fixes (embedding_service_url, job_service)", "status": "in_progress"}, {"id": "3", "content": "Include AI worker fixes (gpt-oss harmony format)", "status": "pending"}, {"id": "4", "content": "Include frontend fixes (workflow export/import)", "status": "pending"}, {"id": "5", "content": "Verify deployment steps", "status": "pending"}]