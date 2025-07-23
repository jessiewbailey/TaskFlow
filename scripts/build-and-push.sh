#!/bin/bash
# TaskFlow Container Build and Push Script
# 
# Usage:
#   ./scripts/build-and-push.sh [REGISTRY]
#
# Examples:
#   ./scripts/build-and-push.sh                                    # Uses default (Docker Hub with your username)
#   ./scripts/build-and-push.sh docker.io/myusername              # Docker Hub
#   ./scripts/build-and-push.sh ghcr.io/myusername                # GitHub Container Registry
#   ./scripts/build-and-push.sh localhost:5000                     # Local registry
#   ./scripts/build-and-push.sh myregistry.azurecr.io             # Azure Container Registry
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get registry from argument or use default
if [ -z "$1" ]; then
    # Try to get Docker Hub username
    DOCKER_USERNAME=$(docker info 2>/dev/null | grep Username | awk '{print $2}')
    if [ -z "$DOCKER_USERNAME" ]; then
        echo -e "${YELLOW}Warning: Not logged in to Docker Hub${NC}"
        echo "Please provide a registry as argument or login to Docker Hub first:"
        echo "  docker login"
        echo "  ./scripts/build-and-push.sh"
        echo "Or specify a registry:"
        echo "  ./scripts/build-and-push.sh docker.io/yourusername"
        exit 1
    fi
    REGISTRY="docker.io/${DOCKER_USERNAME}"
else
    REGISTRY="$1"
fi

# Remove trailing slash if present
REGISTRY="${REGISTRY%/}"

echo -e "${GREEN}Using registry: ${REGISTRY}${NC}"

# Image tag (default to latest, can be overridden)
TAG="${TAG:-latest}"

# Image names
IMAGES=(
    "taskflow-api"
    "taskflow-ai"
    "taskflow-web"
)

# Build and push function
build_and_push() {
    local image_name=$1
    local context_dir=$2
    local full_image="${REGISTRY}/${image_name}:${TAG}"
    
    echo -e "\n${YELLOW}Building ${image_name}...${NC}"
    echo "Context: ${context_dir}"
    echo "Image: ${full_image}"
    
    # Build the image
    if docker build -t "${full_image}" "${context_dir}"; then
        echo -e "${GREEN}✓ Built ${image_name}${NC}"
        
        # Push the image
        echo -e "${YELLOW}Pushing ${image_name}...${NC}"
        if docker push "${full_image}"; then
            echo -e "${GREEN}✓ Pushed ${image_name}${NC}"
        else
            echo -e "${RED}✗ Failed to push ${image_name}${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Failed to build ${image_name}${NC}"
        return 1
    fi
}

# Check if we need to login
if [[ "$REGISTRY" == "docker.io"* ]]; then
    if ! docker info 2>/dev/null | grep -q "Username"; then
        echo -e "${YELLOW}Please login to Docker Hub first:${NC}"
        docker login
    fi
elif [[ "$REGISTRY" == "ghcr.io"* ]]; then
    echo -e "${YELLOW}For GitHub Container Registry, login with:${NC}"
    echo "  echo \$GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin"
elif [[ "$REGISTRY" == *".azurecr.io" ]]; then
    echo -e "${YELLOW}For Azure Container Registry, login with:${NC}"
    echo "  az acr login --name ${REGISTRY%.azurecr.io}"
elif [[ "$REGISTRY" == *".amazonaws.com"* ]]; then
    echo -e "${YELLOW}For AWS ECR, login with:${NC}"
    echo "  aws ecr get-login-password --region REGION | docker login --username AWS --password-stdin $REGISTRY"
fi

# Build and push images
echo -e "\n${GREEN}Starting build process...${NC}"

# API
build_and_push "taskflow-api" "../backend"

# AI Worker
build_and_push "taskflow-ai" "../ai-worker"

# Frontend
build_and_push "taskflow-web" "../frontend"

echo -e "\n${GREEN}All images built and pushed successfully!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Update your Kubernetes configuration to use these images:"
echo "   - Edit k8s/base/kustomization.yaml"
echo "   - Or use kubectl set image"
echo ""
echo "2. Example kustomization.yaml update:"
echo "   images:"
echo "     - name: taskflow/taskflow-api"
echo "       newName: ${REGISTRY}/taskflow-api"
echo "       newTag: ${TAG}"
echo "     - name: taskflow/taskflow-ai"
echo "       newName: ${REGISTRY}/taskflow-ai"
echo "       newTag: ${TAG}"
echo "     - name: taskflow/taskflow-web"
echo "       newName: ${REGISTRY}/taskflow-web"
echo "       newTag: ${TAG}"