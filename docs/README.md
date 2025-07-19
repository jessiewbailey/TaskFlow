# TaskFlow Documentation

This directory contains comprehensive documentation for the TaskFlow application.

## Documentation Index

### Getting Started
- **[QUICKSTART.md](./QUICKSTART.md)** - Quick setup guide for development and deployment
- **[DEMO_INSTRUCTIONS.md](./DEMO_INSTRUCTIONS.md)** - Step-by-step demo walkthrough

### Technical Documentation
- **[request-flow.md](./request-flow.md)** - How requests flow through the system
- **[requirements.md](./requirements.md)** - System requirements and dependencies

### Security & Operations
- **[SECURITY.md](./SECURITY.md)** - Security considerations and best practices

### Deployment
- **[../k8s/README.md](../k8s/README.md)** - Kubernetes deployment guide
- **[../k8s/README-external-ollama.md](../k8s/README-external-ollama.md)** - Using external Ollama in production

### Configuration
- **[../config/README.md](../config/README.md)** - Configuration and customization guide

### Database
- **[../database/](../database/)** - Database schemas and migrations
  - `setup/` - Initial database schema
  - `migrations/` - Database migration scripts

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