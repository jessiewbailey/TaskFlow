#!/bin/bash

# TaskFlow Deployment Verification Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

NAMESPACE="taskflow"
LLM_NAMESPACE="llm"

echo -e "${GREEN}=== TaskFlow Deployment Verification ===${NC}"
echo ""

# Function to check deployment
check_deployment() {
    local name=$1
    local namespace=$2
    local expected_replicas=$3
    
    if kubectl get deployment $name -n $namespace &> /dev/null; then
        local ready=$(kubectl get deployment $name -n $namespace -o jsonpath='{.status.readyReplicas}')
        local desired=$(kubectl get deployment $name -n $namespace -o jsonpath='{.spec.replicas}')
        
        if [ "$ready" == "$desired" ] && [ "$ready" == "$expected_replicas" ]; then
            echo -e "${GREEN}✓${NC} $name: $ready/$desired replicas ready"
            return 0
        else
            echo -e "${RED}✗${NC} $name: $ready/$desired replicas ready (expected $expected_replicas)"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} $name: Not found"
        return 1
    fi
}

# Function to check statefulset
check_statefulset() {
    local name=$1
    local namespace=$2
    local expected_replicas=$3
    
    if kubectl get statefulset $name -n $namespace &> /dev/null; then
        local ready=$(kubectl get statefulset $name -n $namespace -o jsonpath='{.status.readyReplicas}')
        local desired=$(kubectl get statefulset $name -n $namespace -o jsonpath='{.spec.replicas}')
        
        if [ "$ready" == "$desired" ] && [ "$ready" == "$expected_replicas" ]; then
            echo -e "${GREEN}✓${NC} $name: $ready/$desired replicas ready"
            return 0
        else
            echo -e "${RED}✗${NC} $name: $ready/$desired replicas ready (expected $expected_replicas)"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} $name: Not found"
        return 1
    fi
}

# Function to check service
check_service() {
    local name=$1
    local namespace=$2
    
    if kubectl get service $name -n $namespace &> /dev/null; then
        echo -e "${GREEN}✓${NC} Service $name exists"
        return 0
    else
        echo -e "${RED}✗${NC} Service $name not found"
        return 1
    fi
}

# Function to check configmap
check_configmap() {
    local name=$1
    local namespace=$2
    
    if kubectl get configmap $name -n $namespace &> /dev/null; then
        echo -e "${GREEN}✓${NC} ConfigMap $name exists"
        return 0
    else
        echo -e "${RED}✗${NC} ConfigMap $name not found"
        return 1
    fi
}

# Function to check environment variable
check_env_var() {
    local deployment=$1
    local namespace=$2
    local container=$3
    local env_var=$4
    
    local value=$(kubectl get deployment $deployment -n $namespace -o jsonpath="{.spec.template.spec.containers[?(@.name=='$container')].env[?(@.name=='$env_var')].value}")
    
    if [ -n "$value" ]; then
        echo -e "${GREEN}✓${NC} $deployment/$container has $env_var = $value"
        return 0
    else
        echo -e "${RED}✗${NC} $deployment/$container missing $env_var"
        return 1
    fi
}

echo -e "${YELLOW}Checking Namespaces...${NC}"
kubectl get namespace $NAMESPACE &> /dev/null && echo -e "${GREEN}✓${NC} Namespace $NAMESPACE exists" || echo -e "${RED}✗${NC} Namespace $NAMESPACE not found"
kubectl get namespace $LLM_NAMESPACE &> /dev/null && echo -e "${GREEN}✓${NC} Namespace $LLM_NAMESPACE exists" || echo -e "${RED}✗${NC} Namespace $LLM_NAMESPACE not found"

echo ""
echo -e "${YELLOW}Checking Core Services...${NC}"
check_statefulset "postgres" "$NAMESPACE" "1"
check_deployment "qdrant" "$NAMESPACE" "1"
check_deployment "ollama" "$NAMESPACE" "1"

echo ""
echo -e "${YELLOW}Checking Application Deployments...${NC}"
check_deployment "taskflow-api" "$NAMESPACE" "1"
check_deployment "taskflow-ai" "$NAMESPACE" "1"
check_deployment "taskflow-web" "$NAMESPACE" "1"

echo ""
echo -e "${YELLOW}Checking Services...${NC}"
check_service "postgres" "$NAMESPACE"
check_service "qdrant" "$NAMESPACE"
check_service "ollama-service" "$NAMESPACE"
check_service "taskflow-api" "$NAMESPACE"
check_service "taskflow-ai" "$NAMESPACE"
check_service "taskflow-web" "$NAMESPACE"

echo ""
echo -e "${YELLOW}Checking ConfigMaps...${NC}"
check_configmap "postgres-init-scripts" "$NAMESPACE"
check_configmap "taskflow-config" "$NAMESPACE"
check_configmap "taskflow-deployment-config" "$NAMESPACE"

echo ""
echo -e "${YELLOW}Checking Critical Environment Variables...${NC}"
check_env_var "taskflow-api" "$NAMESPACE" "api" "DATABASE_URL"
check_env_var "taskflow-api" "$NAMESPACE" "api" "QDRANT_URL"
check_env_var "taskflow-api" "$NAMESPACE" "api" "AI_WORKER_URL"

echo ""
echo -e "${YELLOW}Checking Database Schema...${NC}"
# Check if system_settings table exists with UI settings
POD=$(kubectl get pod -n $NAMESPACE -l app=postgres -o jsonpath='{.items[0].metadata.name}')
if [ -n "$POD" ]; then
    echo "Checking system_settings table..."
    kubectl exec -n $NAMESPACE $POD -- psql -U taskflow_user -d taskflow_db -c "SELECT key, value FROM system_settings WHERE key LIKE 'ui_%' OR key = 'rag_search_enabled';" 2>/dev/null || echo -e "${RED}✗${NC} Could not query system_settings table"
else
    echo -e "${RED}✗${NC} PostgreSQL pod not found"
fi

echo ""
echo -e "${YELLOW}Checking Qdrant Collections...${NC}"
# Check if Qdrant has the tasks collection
QDRANT_POD=$(kubectl get pod -n $NAMESPACE -l app=qdrant -o jsonpath='{.items[0].metadata.name}')
if [ -n "$QDRANT_POD" ]; then
    echo "Checking Qdrant collections..."
    kubectl exec -n $NAMESPACE $QDRANT_POD -- curl -s http://localhost:6333/collections | grep -q "tasks" && echo -e "${GREEN}✓${NC} Qdrant 'tasks' collection exists" || echo -e "${YELLOW}!${NC} Qdrant 'tasks' collection not found (will be created on first use)"
else
    echo -e "${RED}✗${NC} Qdrant pod not found"
fi

echo ""
echo -e "${GREEN}=== Verification Complete ===${NC}"