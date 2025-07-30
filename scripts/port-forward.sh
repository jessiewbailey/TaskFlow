#!/bin/bash

# TaskFlow Port Forwarding Script
# This script sets up port forwarding for all TaskFlow services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

NAMESPACE="taskflow"

echo -e "${GREEN}=== TaskFlow Port Forwarding ===${NC}"
echo ""
echo "This script will forward the following ports:"
echo "  - 3000 → TaskFlow Web UI"
echo "  - 8000 → TaskFlow API"
echo "  - 8001 → TaskFlow AI Service"
echo "  - 5432 → PostgreSQL Database"
echo "  - 6333 → Qdrant Vector Database"
echo "  - 11434 → Ollama (if using internal deployment)"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all port forwards${NC}"
echo ""

# Function to check if service exists
check_service() {
    local service=$1
    local namespace=$2
    kubectl get service $service -n $namespace &> /dev/null
}

# Create a cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping all port forwards...${NC}"
    jobs -p | xargs -r kill 2>/dev/null || true
    wait
    echo -e "${GREEN}Port forwarding stopped${NC}"
    exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM

# Start port forwarding for each service
echo -e "${GREEN}Starting port forwards...${NC}"

# Web UI
if check_service "taskflow-web" "$NAMESPACE"; then
    echo "Forwarding TaskFlow Web UI (3000)..."
    kubectl port-forward -n $NAMESPACE svc/taskflow-web 3000:3000 &
    PID_WEB=$!
else
    echo -e "${RED}✗${NC} TaskFlow Web service not found"
fi

# API
if check_service "taskflow-api" "$NAMESPACE"; then
    echo "Forwarding TaskFlow API (8000)..."
    kubectl port-forward -n $NAMESPACE svc/taskflow-api 8000:8000 &
    PID_API=$!
else
    echo -e "${RED}✗${NC} TaskFlow API service not found"
fi

# AI Service
if check_service "taskflow-ai" "$NAMESPACE"; then
    echo "Forwarding TaskFlow AI Service (8001)..."
    kubectl port-forward -n $NAMESPACE svc/taskflow-ai 8001:8001 &
    PID_AI=$!
else
    echo -e "${RED}✗${NC} TaskFlow AI service not found"
fi

# PostgreSQL
if check_service "postgres" "$NAMESPACE"; then
    echo "Forwarding PostgreSQL Database (5432)..."
    kubectl port-forward -n $NAMESPACE svc/postgres 5432:5432 &
    PID_POSTGRES=$!
else
    echo -e "${RED}✗${NC} PostgreSQL service not found"
fi

# Qdrant
if check_service "qdrant" "$NAMESPACE"; then
    echo "Forwarding Qdrant Vector Database (6333)..."
    kubectl port-forward -n $NAMESPACE svc/qdrant 6333:6333 &
    PID_QDRANT=$!
else
    echo -e "${RED}✗${NC} Qdrant service not found"
fi

# Ollama (if internal deployment)
if check_service "ollama-service" "$NAMESPACE"; then
    echo "Forwarding Ollama (11434)..."
    kubectl port-forward -n $NAMESPACE svc/ollama-service 11434:11434 &
    PID_OLLAMA=$!
else
    echo -e "${YELLOW}!${NC} Ollama service not found (might be using external Ollama)"
fi

# Give services a moment to start
sleep 2

echo ""
echo -e "${GREEN}=== Port Forwarding Active ===${NC}"
echo ""
echo "You can now access:"
echo "  • TaskFlow Web UI: ${GREEN}http://localhost:3000${NC}"
echo "  • TaskFlow API: ${GREEN}http://localhost:8000${NC}"
echo "  • API Docs: ${GREEN}http://localhost:8000/docs${NC}"
echo "  • Qdrant UI: ${GREEN}http://localhost:6333/dashboard${NC}"
echo ""
echo "Database connections:"
echo "  • PostgreSQL: ${GREEN}localhost:5432${NC}"
echo "    - Database: taskflow_db"
echo "    - Username: taskflow_user"
echo "    - Password: (check your secrets.yaml)"
echo ""
if check_service "ollama-service" "$NAMESPACE"; then
    echo "  • Ollama API: ${GREEN}http://localhost:11434${NC}"
    echo ""
fi
echo -e "${YELLOW}Press Ctrl+C to stop all port forwards${NC}"
echo ""

# Wait for all background processes
wait