# TaskFlow Documentation

This directory contains comprehensive documentation for the TaskFlow application.

## 📚 Documentation Index

### 🚀 Getting Started
- **[QUICKSTART.md](./QUICKSTART.md)** - Quick setup guide for development and deployment
- **[requirements.md](./requirements.md)** - System requirements and dependencies
- **[GPU_SETUP.md](./GPU_SETUP.md)** - NVIDIA GPU configuration for acceleration

### 📐 Architecture & Design
- **[request-flow.md](./request-flow.md)** - How requests flow through the system
- **[frontend-integration-plan.md](./frontend-integration-plan.md)** - Frontend architecture details
- **[real-time-updates-summary.md](./real-time-updates-summary.md)** - Real-time features overview

### 🗄️ Database
- **[database/README.md](./database/README.md)** - Database architecture and schema
- **[database/MIGRATION_GUIDE.md](./database/MIGRATION_GUIDE.md)** - Creating and managing migrations
- **[database/UPDATE_PROCEDURES.md](./database/UPDATE_PROCEDURES.md)** - Database update workflows
- **[POSTGRESQL_MIGRATION_PLAN.md](./POSTGRESQL_MIGRATION_PLAN.md)** - PostgreSQL migration details

### 🔧 Features & Integration
- **[configuring-ui-labels.md](./configuring-ui-labels.md)** - Customizing UI text and labels
- **[webhook-integration.md](./webhook-integration.md)** - External webhook configuration
- **[frontend-sse-integration.md](./frontend-sse-integration.md)** - Server-sent events setup
- **[real-time-progress-tracking.md](./real-time-progress-tracking.md)** - Live progress updates
- **[vector-database-inspection.md](./vector-database-inspection.md)** - Qdrant vector database inspection and troubleshooting

### 🔒 Security & Operations
- **[SECURITY.md](./SECURITY.md)** - Security considerations and best practices

### 🚢 Deployment
- **[../k8s/README.md](../k8s/README.md)** - Kubernetes deployment guide
- **[../scripts/README.md](../scripts/README.md)** - Deployment and utility scripts

### ⚙️ Configuration
- **[../config/README.md](../config/README.md)** - Configuration and environment variables

## Quick Reference

### Local Development
```bash
# Start development environment
./scripts/setup-dev.sh

# View services
docker-compose ps

# View logs
docker-compose logs -f [service-name]
```

### Kubernetes Deployment
```bash
# Deploy to Kubernetes
kubectl apply -k k8s/

# Check status
kubectl get pods -n taskflow

# View logs
kubectl logs -l app=taskflow-api -n taskflow
```

### Common Issues
- **Port conflicts**: Check if ports 3000, 8000, 11434 are available
- **Memory issues**: Ensure Docker has at least 4GB RAM allocated
- **Model loading**: Gemma3:27b requires significant memory and time to load

## Contributing

When adding new documentation:
1. Place files in the appropriate subdirectory
2. Update this README index
3. Use consistent markdown formatting
4. Include code examples where helpful