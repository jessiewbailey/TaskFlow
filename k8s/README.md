# TaskFlow Kubernetes Deployment Guide

This directory contains the complete Kubernetes deployment configuration for TaskFlow, a task processing and AI analysis system.

## 🏗️ Architecture Overview

TaskFlow consists of the following components:

- **Frontend (taskflow-web)**: React/TypeScript web interface
- **Backend API (taskflow-api)**: FastAPI backend with database integration  
- **AI Worker (taskflow-ai)**: Python service for AI processing
- **PostgreSQL Database**: Persistent data storage with JSONB support
- **Qdrant**: Vector database for semantic search and RAG
- **NGINX Ingress**: Load balancing and SSL termination

**Note**: Ollama is expected to be deployed separately in the `llm` namespace

## 📋 Prerequisites

1. **Kubernetes Cluster** (v1.20+)
2. **kubectl** configured to access your cluster
3. **kustomize** (or kubectl with kustomize support)
4. **Container Registry** access for your images
5. **Ingress Controller** (NGINX recommended)
6. **Storage Class** for persistent volumes

## 🚀 Quick Deployment

### 1. Create Namespaces
```bash
# Create the main TaskFlow namespace
kubectl create namespace taskflow

# Create the LLM namespace (if you're managing Ollama separately)
kubectl create namespace llm
```

### 2. Configure Secrets
```bash
# Copy the template
cp k8s/base/secrets-template.yaml k8s/base/secrets.yaml

# Edit with your values
vim k8s/base/secrets.yaml
```

**Important**: Update all `CHANGE_ME_` placeholders in the secrets file!

### 3. Deploy TaskFlow
```bash
# Deploy all resources
kubectl apply -k k8s/base/

# Watch deployment progress
kubectl get pods -n taskflow -w
```

**Note**: This deployment expects Ollama to be running in the `llm` namespace at `http://ollama-service.llm:11434`

### 4. Access the Application
```bash
# For local testing
kubectl port-forward -n taskflow service/taskflow-web 3000:3000

# Access at http://localhost:3000
```

## 🗑️ Complete Removal

To completely remove TaskFlow including all persistent data:

```bash
# Delete all resources
kubectl delete -k k8s/base/

# Delete persistent volume claims (WARNING: Deletes all data!)
kubectl delete pvc -n taskflow --all

# Delete the namespace
kubectl delete namespace taskflow
```

## 🔧 Service Discovery & Pod Communication

In Kubernetes, services provide stable network identities for pods. Here's how TaskFlow components reference each other:

### Service Names (DNS Resolution)
```yaml
# API references AI Worker
AI_WORKER_URL: "http://taskflow-ai:8001"

# AI Worker references API  
BACKEND_API_URL: "http://taskflow-api:8000"

# Both reference Ollama (in llm namespace)
OLLAMA_HOST: "http://ollama-service.llm:11434"

# API references Database
DATABASE_URL: "postgresql+asyncpg://user:pass@postgres:5432/taskflow_db"

# API references Qdrant
QDRANT_URL: "http://qdrant:6333"
```

### How It Works:
1. **Service Discovery**: Kubernetes DNS resolves service names to ClusterIP addresses
2. **Load Balancing**: Services automatically load balance between pod replicas
3. **Health Checks**: Only healthy pods receive traffic via readiness probes
4. **Network Policies**: Can be applied to control traffic between services

## 🚀 Deployment Steps

### 1. Build and Push Container Images

**⚠️ IMPORTANT**: You must build and push the custom TaskFlow images to your container registry before deployment!

#### Required Images to Build:

1. **taskflow-api** - Backend API service
2. **taskflow-web** - Frontend React application  
3. **taskflow-ai** - AI worker service

#### Build and Push Commands:

```bash
# Set your registry URL (examples: docker.io/yourusername, gcr.io/project-id, your-registry.com)
REGISTRY="your-registry-url"

# Build and push API image
cd ../backend
docker build -t ${REGISTRY}/taskflow-api:latest .
docker push ${REGISTRY}/taskflow-api:latest

# Build and push Frontend image
cd ../frontend
docker build -t ${REGISTRY}/taskflow-web:latest .
docker push ${REGISTRY}/taskflow-web:latest

# Build and push AI Worker image
cd ../ai-worker
docker build -t ${REGISTRY}/taskflow-ai:latest .
docker push ${REGISTRY}/taskflow-ai:latest
```

#### Update Kustomization for Your Registry:

After pushing images, update the image references in `base/kustomization.yaml`:

```yaml
# Container image management
images:
  - name: taskflow/taskflow-api
    newName: your-registry.com/taskflow-api
    newTag: latest
  - name: taskflow/taskflow-ai
    newName: your-registry.com/taskflow-ai
    newTag: latest  
  - name: taskflow/taskflow-web
    newName: your-registry.com/taskflow-web
    newTag: latest
```

Also update the `imagePullPolicy` in deployment files from `Never` to `IfNotPresent` for production use.

### 2. Prepare Your Environment

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Verify namespace
kubectl get namespace taskflow
```

### 2. Configure Secrets

**⚠️ IMPORTANT**: Update secrets before deployment!

For testing/development, use the provided test secrets:
```bash
# Apply test secrets (DO NOT use in production!)
kubectl apply -f secrets-test.yaml
```

For production:
```bash
# Copy template and update with real values
cp secrets-template.yaml secrets.yaml

# Edit secrets.yaml with your actual credentials
# NEVER commit secrets.yaml to version control!

# Apply secrets
kubectl apply -f secrets.yaml
```

**Required Secret Values:**
- `POSTGRES_USER`: PostgreSQL database user  
- `POSTGRES_PASSWORD`: Strong database password
- `POSTGRES_DB`: Database name (default: taskflow_db)
- `SECRET_KEY`: Application secret key (32+ characters)

### 3. Deploy Infrastructure (Database)

```bash
# Deploy PostgreSQL database
kubectl apply -f postgres-statefulset.yaml

# Wait for database to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n taskflow --timeout=300s

# Initialize database schema
kubectl apply -f postgres-init-job.yaml

# Wait for database initialization to complete
kubectl wait --for=condition=complete job/postgres-init -n taskflow --timeout=300s
```

**Note**: Ensure Ollama is deployed and running in the `llm` namespace before proceeding.

### 4. Deploy Application Services

**Note**: Ensure your container images are pushed to the registry and deployment files are updated (see Step 1).

```bash
# Deploy configuration
kubectl apply -f configmap.yaml

# Deploy application services
kubectl apply -f services.yaml

# Deploy backend API
kubectl apply -f api-deployment.yaml

# Deploy AI worker
kubectl apply -f ai-deployment.yaml

# Deploy frontend
kubectl apply -f web-deployment.yaml

# Wait for services to be ready
kubectl wait --for=condition=ready pod -l app=taskflow-api -n taskflow --timeout=300s
kubectl wait --for=condition=ready pod -l app=taskflow-ai -n taskflow --timeout=300s
kubectl wait --for=condition=ready pod -l app=taskflow-web -n taskflow --timeout=300s
```

### 5. Configure Ingress

First, install the NGINX Ingress Controller:
```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# Wait for ingress controller to be ready
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s
```

Then apply the ingress configuration:
```bash
# Apply ingress configuration
kubectl apply -f ingress.yaml

# Verify ingress
kubectl get ingress -n taskflow
```

For local testing, add this line to your `/etc/hosts` file (or `C:\Windows\System32\drivers\etc\hosts` on Windows):
```
127.0.0.1 taskflow.local
```

### 6. Deploy with Kustomize

#### Clean Deployment Process

**⚠️ Important**: Jobs in Kubernetes are immutable. If you need to update configuration, always clean up first.

```bash
# Clean up any existing deployment (if needed)
kubectl delete namespace taskflow

# Wait for cleanup to complete
kubectl wait --for=delete namespace/taskflow --timeout=60s
```

#### Deploy TaskFlow
```bash
# Deploy TaskFlow
kubectl apply -k base/

# Wait for core services to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n taskflow --timeout=300s
kubectl wait --for=condition=ready pod -l app=taskflow-api -n taskflow --timeout=300s
kubectl wait --for=condition=ready pod -l app=taskflow-web -n taskflow --timeout=300s

# Check deployment status
kubectl get pods -n taskflow
```

**Note**: The AI worker expects Ollama to be available at `http://ollama-service.llm:11434`. Ensure your Ollama deployment in the `llm` namespace is running and has the required models (e.g., `gemma3:27b`, `nomic-embed-text`).

#### Preview before deploying:
```bash
# See what will be deployed
kubectl kustomize base/ > preview.yaml
# Review the preview.yaml file, then apply
kubectl apply -f preview.yaml
```

#### Troubleshooting Failed Deployments

If you encounter issues with Jobs or immutable resources:

```bash
# Delete specific jobs that are stuck
kubectl delete job postgres-init -n taskflow

# Delete and recreate StatefulSets if needed
kubectl delete statefulset postgres -n taskflow
kubectl delete pvc postgres-storage-postgres-0 -n taskflow  # If you want to reset data

# Reapply the configuration
kubectl apply -k overlays/external-ollama/
```

#### Updating Existing Deployments

When you need to update configuration files:

```bash
# For Deployments/StatefulSets - these update automatically
kubectl apply -k overlays/external-ollama/

# For Jobs - these are immutable and need to be recreated
kubectl delete job postgres-init -n taskflow
kubectl apply -k overlays/external-ollama/

# For ConfigMaps/Secrets - restart deployments to pick up changes
kubectl rollout restart deployment taskflow-api -n taskflow
kubectl rollout restart deployment taskflow-ai -n taskflow
kubectl rollout restart deployment taskflow-web -n taskflow
```

#### Complete Reset (Nuclear Option)

If you want to completely reset the deployment:

```bash
# WARNING: This will delete all data including database
kubectl delete namespace taskflow

# Wait for complete cleanup
kubectl wait --for=delete namespace/taskflow --timeout=120s

# Redeploy from scratch
kubectl apply -k overlays/external-ollama/
```

## 🔍 Verification & Troubleshooting

### Check Pod Status
```bash
kubectl get pods -n taskflow
kubectl describe pod <pod-name> -n taskflow
kubectl logs <pod-name> -n taskflow
```

### Check Services
```bash
kubectl get services -n taskflow
kubectl get endpoints -n taskflow
```

### Check Ingress
```bash
kubectl get ingress -n taskflow
kubectl describe ingress taskflow-ingress -n taskflow
```

### Port Forward for Testing
```bash
# Access frontend directly
kubectl port-forward svc/taskflow-web 3000:3000 -n taskflow

# Access API directly  
kubectl port-forward svc/taskflow-api 8000:8000 -n taskflow

# Access database
kubectl port-forward svc/postgres 5432:5432 -n taskflow
```

### Common Issues & Solutions

**Pod Stuck in Pending:**
- Check resource requirements vs cluster capacity
- Verify persistent volume claims can be satisfied
- Check node selectors and taints

**Pod CrashLoopBackOff:**
- Check logs: `kubectl logs <pod> -n taskflow --previous`
- Verify secrets and configmaps are correctly mounted
- Check database connectivity

**Service Not Accessible:**
- Verify service selector matches pod labels
- Check endpoints: `kubectl get endpoints -n taskflow`
- Verify ingress configuration and annotations

**Logs View Shows "No logs available":**
- In Kubernetes, the logs service displays informational messages instead of Docker logs
- Use kubectl directly for log access: `kubectl logs -l app=ollama -n taskflow`
- For real-time logs: `kubectl logs -f -l app=ollama -n taskflow`
- This is expected behavior as Kubernetes pods don't have Docker API access

**Ollama Connection Issues:**
- Verify Ollama is running in the llm namespace: `kubectl get pods -n llm`
- Check if the service is accessible: `kubectl get svc ollama-service -n llm`
- Test connectivity from a pod: `kubectl run -it --rm test --image=busybox --restart=Never -n taskflow -- wget -O- http://ollama-service.llm:11434/api/tags`
- Ensure required models are loaded in Ollama: `kubectl exec deployment/ollama -n llm -- ollama list`

## 📊 Monitoring & Health Checks

### Health Check Endpoints
- **API**: `GET /healthz`
- **AI Worker**: `GET /healthz`  
- **Frontend**: `GET /health`

### Resource Monitoring
```bash
# Check resource usage
kubectl top pods -n taskflow
kubectl top nodes

# Check persistent volumes
kubectl get pv
kubectl get pvc -n taskflow
```

## 🔄 Updates & Scaling

### Rolling Updates
```bash
# Update container image
kubectl set image deployment/taskflow-api api=taskflow/taskflow-api:v1.1.0 -n taskflow

# Check rollout status
kubectl rollout status deployment/taskflow-api -n taskflow

# Rollback if needed
kubectl rollout undo deployment/taskflow-api -n taskflow
```

### Scaling
```bash
# Scale horizontally
kubectl scale deployment taskflow-api --replicas=3 -n taskflow
kubectl scale deployment taskflow-web --replicas=3 -n taskflow

# AI worker can also be scaled
kubectl scale deployment taskflow-ai --replicas=2 -n taskflow
```

## 🔐 Security Considerations

### Production Security Checklist:
- [ ] Use proper SSL certificates (not self-signed)
- [ ] Enable network policies to restrict inter-pod communication
- [ ] Use external secret management (AWS Secrets Manager, Vault, etc.)
- [ ] Regular security updates for base images
- [ ] Enable Pod Security Standards
- [ ] Configure RBAC for service accounts
- [ ] Regular backup of database and persistent volumes
- [ ] Monitor for security vulnerabilities

### Network Policies Example:
```yaml
# Only allow API to communicate with database
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-to-db-only
  namespace: taskflow
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: taskflow-api
```

## 🏷️ Resource Management

### Resource Requests & Limits

Current configuration:

| Component | CPU Request | Memory Request | CPU Limit | Memory Limit |
|-----------|-------------|----------------|-----------|--------------|
| API | 250m | 512Mi | 1000m | 1Gi |
| AI Worker | 500m | 1Gi | 1500m | 2Gi |
| Frontend | 100m | 128Mi | 200m | 256Mi |
| PostgreSQL | 500m | 1Gi | 1000m | 2Gi |
| Qdrant | 200m | 512Mi | 500m | 1Gi |

### Persistent Storage

| Component | Storage | Access Mode | Notes |
|-----------|---------|-------------|-------|
| PostgreSQL | 10Gi | ReadWriteOnce | Database data |
| Qdrant | 5Gi | ReadWriteOnce | Vector embeddings |

## 🌍 Environment-Specific Deployments

### Development Environment
```bash
# Use smaller resource requirements
kubectl patch deployment taskflow-api -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","resources":{"requests":{"memory":"256Mi","cpu":"100m"}}}]}}}}' -n taskflow
```

### Production Environment
```bash
# Use kustomize overlays for different environments
# Create overlays/production/kustomization.yaml with production-specific configs
kubectl apply -k overlays/production
```

## 📞 Support & Troubleshooting

### Common Commands
```bash
# Get everything in namespace
kubectl get all -n taskflow

# Debug pod startup issues
kubectl describe pod <pod-name> -n taskflow
kubectl logs <pod-name> -n taskflow --previous

# Check resource usage
kubectl top pods -n taskflow

# Execute into running pod
kubectl exec -it <pod-name> -n taskflow -- /bin/bash

# Check service endpoints
kubectl get endpoints -n taskflow
```

### Log Aggregation
Consider setting up centralized logging with:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Fluentd** or **Fluent Bit** for log collection
- **Grafana Loki** for log aggregation

---

## 📝 Notes

- Update `secrets-template.yaml` with actual production secrets
- Replace placeholder domains in `ingress.yaml`
- Adjust resource limits based on your cluster capacity
- Consider using Helm charts for more complex deployments
- Monitor persistent volume usage and set up automated backups
## 📚 Useful Commands Reference

### Viewing Resources
```bash
# List all TaskFlow resources
kubectl get all -n taskflow

# Get detailed information about pods
kubectl describe pod -n taskflow <pod-name>

# View resource YAML
kubectl get deployment -n taskflow taskflow-api -o yaml

# List persistent volumes
kubectl get pvc -n taskflow
```

### Logs Management
```bash
# View logs for a specific pod
kubectl logs -n taskflow <pod-name>

# View logs for a deployment (latest pod)
kubectl logs -n taskflow deployment/taskflow-api

# Follow logs in real-time
kubectl logs -n taskflow deployment/taskflow-api -f

# View previous pod logs (if crashed)
kubectl logs -n taskflow <pod-name> --previous

# View logs with timestamps
kubectl logs -n taskflow deployment/taskflow-api --timestamps

# View logs from all containers in a pod
kubectl logs -n taskflow <pod-name> --all-containers

# View logs from the last hour
kubectl logs -n taskflow deployment/taskflow-api --since=1h
```

### Debugging
```bash
# Execute shell in a running pod
kubectl exec -it -n taskflow deployment/taskflow-api -- /bin/sh

# Connect to PostgreSQL database
kubectl exec -it -n taskflow postgres-0 -- psql -U taskflow_user -d taskflow_db

# Check resource usage
kubectl top pods -n taskflow
kubectl top nodes

# Describe pod events
kubectl describe pod -n taskflow <pod-name>

# Check service endpoints
kubectl get endpoints -n taskflow

# Test internal DNS
kubectl run -it --rm debug --image=busybox --restart=Never -n taskflow -- nslookup taskflow-api
```

### Database Operations
```bash
# Connect to PostgreSQL
kubectl exec -it -n taskflow postgres-0 -- psql -U taskflow_user -d taskflow_db

# Backup database
kubectl exec -n taskflow postgres-0 -- pg_dump -U taskflow_user taskflow_db > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore database
kubectl cp backup.sql taskflow/postgres-0:/tmp/
kubectl exec -n taskflow postgres-0 -- psql -U taskflow_user taskflow_db < /tmp/backup.sql

# Check database size
kubectl exec -n taskflow postgres-0 -- psql -U taskflow_user -d taskflow_db -c "SELECT pg_database_size('taskflow_db')"

# List all tables
kubectl exec -n taskflow postgres-0 -- psql -U taskflow_user -d taskflow_db -c "\dt"
```

### Scaling Operations
```bash
# Scale deployment
kubectl scale deployment -n taskflow taskflow-api --replicas=3

# Enable autoscaling
kubectl autoscale deployment -n taskflow taskflow-api --min=2 --max=5 --cpu-percent=80

# Check autoscaler status
kubectl get hpa -n taskflow

# Disable autoscaling
kubectl delete hpa -n taskflow taskflow-api
```

### Update and Rollback
```bash
# Update image
kubectl set image deployment/taskflow-api -n taskflow taskflow-api=taskflow/taskflow-api:v2.0

# Check rollout status
kubectl rollout status deployment/taskflow-api -n taskflow

# View rollout history
kubectl rollout history deployment/taskflow-api -n taskflow

# Rollback to previous version
kubectl rollout undo deployment/taskflow-api -n taskflow

# Rollback to specific revision
kubectl rollout undo deployment/taskflow-api -n taskflow --to-revision=2

# Pause rollout
kubectl rollout pause deployment/taskflow-api -n taskflow

# Resume rollout
kubectl rollout resume deployment/taskflow-api -n taskflow
```

### Port Forwarding
```bash
# Access services locally
kubectl port-forward -n taskflow service/taskflow-web 3000:3000
kubectl port-forward -n taskflow service/taskflow-api 8000:8000
kubectl port-forward -n taskflow service/postgres 5432:5432
kubectl port-forward -n taskflow service/ollama 11434:11434

# Forward multiple ports
kubectl port-forward -n taskflow deployment/taskflow-api 8000:8000 9000:9000

# Access Ollama in llm namespace
kubectl port-forward -n llm service/ollama-service 11434:11434
```

### Troubleshooting Commands
```bash
# Check events
kubectl get events -n taskflow --sort-by='.lastTimestamp'

# Check pod status
kubectl get pods -n taskflow -o wide

# Check node resources
kubectl describe nodes

# Test service connectivity
kubectl run -it --rm test --image=busybox --restart=Never -n taskflow -- wget -O- http://taskflow-api:8000/healthz

# Check DNS resolution
kubectl run -it --rm dnstest --image=busybox --restart=Never -n taskflow -- nslookup taskflow-api.taskflow.svc.cluster.local

# Check persistent volume status
kubectl get pv
kubectl describe pvc -n taskflow

# Check secret values (base64 encoded)
kubectl get secret -n taskflow taskflow-env -o jsonpath='{.data}'
```

### Maintenance Operations
```bash
# Cordon node (prevent new pods)
kubectl cordon <node-name>

# Drain node (move pods)
kubectl drain <node-name> --ignore-daemonsets

# Uncordon node
kubectl uncordon <node-name>

# Delete evicted pods
kubectl get pods -n taskflow  < /dev/null |  grep Evicted | awk '{print $1}' | xargs kubectl delete pod -n taskflow

# Clean up completed jobs
kubectl delete jobs -n taskflow --field-selector status.successful=1

# Force delete stuck pod
kubectl delete pod -n taskflow <pod-name> --grace-period=0 --force
```

### ConfigMap and Secret Management
```bash
# View configmaps
kubectl get configmaps -n taskflow

# Edit configmap
kubectl edit configmap -n taskflow <configmap-name>

# Create secret from literal
kubectl create secret generic my-secret -n taskflow --from-literal=key=value

# Update secret
kubectl create secret generic taskflow-env -n taskflow --from-env-file=.env --dry-run=client -o yaml | kubectl apply -f -

# Decode secret value
kubectl get secret -n taskflow taskflow-env -o jsonpath='{.data.SECRET_KEY}' | base64 -d
```

## 🎨 UI Customization

TaskFlow allows you to customize all UI labels and terminology:

1. **Edit the source file**: `config/ui-labels/labels.yaml`
2. **Sync to Kubernetes**: Run `k8s/sync-ui-labels.sh`
3. **Apply changes**: `kubectl apply -k k8s/base/`
4. **Restart API**: `kubectl rollout restart deployment taskflow-api -n taskflow`

The UI labels are automatically generated into a ConfigMap using kustomize generators.

## 🔒 Security Best Practices

1. **Never commit secrets.yaml** - Use secrets-template.yaml as reference
2. **Use RBAC** - Limit access to namespace and resources
3. **Enable Network Policies** - Control pod-to-pod communication
4. **Regular Updates** - Keep images and dependencies updated
5. **Resource Limits** - Set appropriate resource requests and limits
6. **Pod Security Standards** - Enforce security contexts

## 📈 Production Recommendations

1. **High Availability**
   - Run multiple replicas of stateless services
   - Use PostgreSQL replication for database HA
   - Configure pod disruption budgets

2. **Monitoring**
   - Deploy Prometheus and Grafana
   - Set up alerts for critical metrics
   - Enable application tracing

3. **Backup Strategy**
   - Automated PostgreSQL backups
   - Persistent volume snapshots
   - Disaster recovery plan

4. **Performance**
   - Configure horizontal pod autoscaling
   - Optimize resource requests/limits
   - Use SSD storage for database

## 🆘 Getting Help

- Check pod logs first: `kubectl logs -n taskflow <pod-name>`
- Review events: `kubectl get events -n taskflow`
- Describe problematic resources: `kubectl describe pod -n taskflow <pod-name>`
- Consult the main TaskFlow documentation
- Submit issues to the TaskFlow GitHub repository
