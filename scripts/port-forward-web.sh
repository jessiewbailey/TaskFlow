#!/bin/bash

# Simple port forwarding for TaskFlow Web UI only

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

NAMESPACE="taskflow"

echo -e "${GREEN}=== TaskFlow Web UI Port Forwarding ===${NC}"
echo ""

# Check if the service exists
if ! kubectl get service taskflow-web -n $NAMESPACE &> /dev/null; then
    echo "Error: taskflow-web service not found in namespace $NAMESPACE"
    echo "Please ensure TaskFlow is deployed first."
    exit 1
fi

echo "Starting port forward for TaskFlow Web UI..."
echo ""
echo -e "Access the application at: ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

# Start port forwarding
kubectl port-forward -n $NAMESPACE svc/taskflow-web 3000:3000