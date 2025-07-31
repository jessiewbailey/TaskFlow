# TaskFlow Scripts Manifest

This directory contains all deployment, development, and operational scripts for TaskFlow. Below is a guide on when and how to use each script.

## 🚀 Deployment Scripts

### `deploy-fresh.sh`
**Purpose**: Complete deployment from scratch with fresh builds and blank volumes  
**When to use**: 
- Initial deployment to a new cluster
- Complete system reset (WARNING: deletes all data)
- When you need to rebuild all images from source

**What it does**:
1. Deletes existing TaskFlow namespaces and volumes
2. Creates fresh namespaces
3. Regenerates PostgreSQL init ConfigMap from latest schema
4. Builds all Docker images locally
5. Pushes images to your registry
6. Deploys all Kubernetes resources
7. Waits for services to be ready

**Usage**:
```bash
# Default: uses localhost:5000 registry
./scripts/deploy-fresh.sh

# Custom registry
REGISTRY=myregistry.com IMAGE_TAG=v1.0 ./scripts/deploy-fresh.sh

# With specific overlay
K8S_OVERLAY=production ./scripts/deploy-fresh.sh
```

### `deploy.sh`
**Purpose**: Quick deployment using pre-built images from Docker Hub  
**When to use**:
- Testing TaskFlow without building images
- Quick demo deployments
- When you want to use official pre-built images

**What it does**:
1. Cleans up any existing deployment
2. Deploys TaskFlow using images from Docker Hub
3. Uses hardcoded image references (jessiewbailey/taskflow-*)

**Usage**:
```bash
./scripts/deploy.sh
```

### `build-and-push.sh`
**Purpose**: Build and push Docker images to a registry  
**When to use**:
- After making code changes
- Before deploying to a cluster
- CI/CD pipeline integration

**What it does**:
1. Builds Docker images for all components (API, AI worker, Web)
2. Tags images with specified registry and tag
3. Pushes images to the registry

**Usage**:
```bash
# Default: localhost:5000 with 'latest' tag
./scripts/build-and-push.sh

# Custom registry and tag
./scripts/build-and-push.sh myregistry.com v1.2.3

# Just build without pushing
SKIP_PUSH=true ./scripts/build-and-push.sh
```

## 🛠️ Development Scripts

### `setup-dev.sh`
**Purpose**: Set up local development environment  
**When to use**:
- Setting up a new development machine
- After cloning the repository
- To reset development environment

**What it does**:
1. Checks for required tools (Docker, kubectl, etc.)
2. Creates necessary directories
3. Sets up configuration files
4. Initializes local development databases
5. Configures pre-commit hooks

**Usage**:
```bash
./scripts/setup-dev.sh
```

### `port-forward.sh`
**Purpose**: Forward all TaskFlow service ports to localhost  
**When to use**:
- Local development and testing
- Accessing services without ingress
- Debugging service connectivity

**What it does**:
1. Forwards multiple service ports simultaneously:
   - 3000 → TaskFlow Web UI
   - 8000 → TaskFlow API
   - 8001 → TaskFlow AI Service
   - 5432 → PostgreSQL Database
   - 6333 → Qdrant Vector Database
   - 11434 → Ollama (if using internal deployment)
2. Maintains all connections until interrupted

**Usage**:
```bash
./scripts/port-forward.sh
# Access services at localhost:PORT
# Press Ctrl+C to stop all port forwards
```

### `port-forward-web.sh`
**Purpose**: Forward only the web UI port  
**When to use**:
- When you only need to access the web interface
- Quick UI testing
- Demonstrating the application

**What it does**:
1. Forwards only port 3000 for the web UI
2. Simpler alternative when you don't need all services

**Usage**:
```bash
./scripts/port-forward-web.sh
# Access UI at http://localhost:3000
```

## 📊 Operational Scripts

### `verify-deployment.sh`
**Purpose**: Comprehensive deployment verification  
**When to use**:
- After deployment to verify everything is working
- Troubleshooting deployment issues
- Health checks

**What it does**:
1. Checks namespace existence
2. Verifies all deployments and statefulsets are ready
3. Validates services are created
4. Confirms ConfigMaps exist
5. Tests critical environment variables
6. Queries database for initialization
7. Checks Qdrant collections

**Usage**:
```bash
./scripts/verify-deployment.sh
```

### `generate-postgres-init-configmap.sh`
**Purpose**: Generate Kubernetes ConfigMap from PostgreSQL initialization SQL  
**When to use**:
- After modifying database schema
- Before fresh deployments
- When updating database initialization

**What it does**:
1. Reads `database/postgresql/init-complete.sql`
2. Creates a ConfigMap with the SQL content
3. Outputs YAML that can be applied to Kubernetes

**Usage**:
```bash
# Generate and view
./scripts/generate-postgres-init-configmap.sh

# Generate and apply directly
./scripts/generate-postgres-init-configmap.sh | kubectl apply -f -

# Save to file
./scripts/generate-postgres-init-configmap.sh > k8s/base/postgres-init-configmap.yaml
```

## 📋 Script Dependencies

| Script | Requires | Dependencies |
|--------|----------|--------------|
| `deploy-fresh.sh` | kubectl, docker | Active k8s cluster, registry access |
| `deploy.sh` | kubectl | Active k8s cluster, internet access |
| `build-and-push.sh` | docker | Registry access (if pushing) |
| `setup-dev.sh` | Various | See script for full list |
| `port-forward.sh` | kubectl | Deployed TaskFlow services |
| `port-forward-web.sh` | kubectl | Deployed TaskFlow web service |
| `verify-deployment.sh` | kubectl | Deployed TaskFlow |
| `generate-postgres-init-configmap.sh` | None | `database/postgresql/init-complete.sql` |

## 🔄 Common Workflows

### Initial Deployment
```bash
# 1. Set up your environment
./scripts/setup-dev.sh

# 2. Deploy fresh
./scripts/deploy-fresh.sh

# 3. Verify deployment
./scripts/verify-deployment.sh

# 4. Access the application
./scripts/port-forward-web.sh
```

### Update After Code Changes
```bash
# 1. Build and push new images
./scripts/build-and-push.sh myregistry.com v1.1

# 2. Update deployments (using kubectl)
kubectl set image deployment/taskflow-api taskflow-api=myregistry.com/taskflow-api:v1.1 -n taskflow
kubectl set image deployment/taskflow-ai taskflow-ai=myregistry.com/taskflow-ai:v1.1 -n taskflow
kubectl set image deployment/taskflow-web taskflow-web=myregistry.com/taskflow-web:v1.1 -n taskflow

# 3. Verify
./scripts/verify-deployment.sh
```

### Quick Demo
```bash
# 1. Deploy from Docker Hub
./scripts/deploy.sh

# 2. Access the application
./scripts/port-forward-web.sh
```

### Development Workflow
```bash
# 1. Make code changes

# 2. Build and test locally
docker-compose up

# 3. Build and push when ready
./scripts/build-and-push.sh localhost:5000 dev

# 4. Deploy to dev cluster
K8S_OVERLAY=dev ./scripts/deploy-fresh.sh

# 5. Port forward for testing
./scripts/port-forward.sh
```

## ⚠️ Important Notes

1. **Data Loss Warning**: `deploy-fresh.sh` and `deploy.sh` will DELETE all existing data
2. **Registry Access**: Ensure you're logged into your Docker registry before pushing
3. **Kubernetes Context**: Always verify you're connected to the correct cluster
4. **Resource Requirements**: Ensure your cluster has sufficient resources
5. **Namespace Conflicts**: Scripts will delete and recreate the `taskflow` namespace

## 🐛 Troubleshooting

If a script fails:
1. Check the error message for specific issues
2. Verify prerequisites (kubectl, docker, cluster access)
3. Run `./scripts/verify-deployment.sh` for deployment issues
4. Check pod logs: `kubectl logs -n taskflow <pod-name>`
5. Review events: `kubectl get events -n taskflow --sort-by='.lastTimestamp'`

## 🔐 Security Considerations

- Never commit secrets or credentials
- Use proper RBAC in production
- Rotate credentials regularly
- Use private registries for production images
- Enable network policies in production clusters