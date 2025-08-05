# TaskFlow Project Manifest

## Overview
This manifest provides a comprehensive guide to the TaskFlow project structure, documentation, and key resources. It serves as a central reference for developers, operators, and contributors.

## Project Structure

```
TaskFlow/
├── backend/                 # FastAPI backend service
├── frontend/               # React TypeScript frontend
├── ai-worker/              # AI processing microservice
├── database/               # Database schemas and migrations
├── k8s/                    # Kubernetes deployment manifests
├── scripts/                # Utility and deployment scripts
├── docs/                   # Project documentation
├── config/                 # Configuration files
├── test-files/             # Sample data for testing
└── assets/                 # Images and media assets
```

## Documentation Index

### 📚 Core Documentation

| Document | Location | Description |
|----------|----------|-------------|
| Main README | [`/README.md`](README.md) | Project overview, features, quick start guide |
| Requirements | [`/docs/requirements.md`](docs/requirements.md) | Technical requirements and specifications |
| Security Guide | [`/docs/SECURITY.md`](docs/SECURITY.md) | Security considerations and best practices |
| Quick Start | [`/docs/QUICKSTART.md`](docs/QUICKSTART.md) | Rapid setup instructions |

### 🗄️ Database Documentation

| Document | Location | Description |
|----------|----------|-------------|
| Database Guide | [`/docs/database/README.md`](docs/database/README.md) | Overview of database architecture |
| Migration Guide | [`/docs/database/MIGRATION_GUIDE.md`](docs/database/MIGRATION_GUIDE.md) | How to create and manage migrations |
| Update Procedures | [`/docs/database/UPDATE_PROCEDURES.md`](docs/database/UPDATE_PROCEDURES.md) | Database update workflows |
| PostgreSQL Migration | [`/docs/POSTGRESQL_MIGRATION_PLAN.md`](docs/POSTGRESQL_MIGRATION_PLAN.md) | PostgreSQL-specific migration details |

### 🚀 Deployment Documentation

| Document | Location | Description |
|----------|----------|-------------|
| Kubernetes Guide | [`/k8s/README.md`](k8s/README.md) | Kubernetes deployment instructions |
| GPU Setup | [`/docs/GPU_SETUP.md`](docs/GPU_SETUP.md) | NVIDIA GPU configuration guide |
| Scripts Guide | [`/scripts/README.md`](scripts/README.md) | Utility scripts documentation |

### 🔧 Development Documentation

| Document | Location | Description |
|----------|----------|-------------|
| Request Flow | [`/docs/request-flow.md`](docs/request-flow.md) | How requests flow through the system |
| Frontend Integration | [`/docs/frontend-integration-plan.md`](docs/frontend-integration-plan.md) | Frontend architecture and integration |
| Real-time Updates | [`/docs/real-time-updates-summary.md`](docs/real-time-updates-summary.md) | SSE implementation details |
| Webhook Integration | [`/docs/webhook-integration.md`](docs/webhook-integration.md) | External webhook configuration |

### 🎨 Feature Documentation

| Document | Location | Description |
|----------|----------|-------------|
| UI Labels Config | [`/docs/configuring-ui-labels.md`](docs/configuring-ui-labels.md) | Customizing UI text and labels |
| SSE Integration | [`/docs/frontend-sse-integration.md`](docs/frontend-sse-integration.md) | Server-sent events implementation |
| Progress Tracking | [`/docs/real-time-progress-tracking.md`](docs/real-time-progress-tracking.md) | Live progress updates feature |
| Queue Position | [`/docs/queue-position-feature.md`](docs/queue-position-feature.md) | Task queue management |
| Vector DB Inspection | [`/docs/vector-database-inspection.md`](docs/vector-database-inspection.md) | Qdrant inspection and troubleshooting |

## Key Components

### Backend Services

1. **API Server** (`/backend`)
   - FastAPI application
   - RESTful endpoints
   - WebSocket support
   - Database ORM with SQLAlchemy

2. **AI Worker** (`/ai-worker`)
   - Task processing engine
   - Ollama integration
   - Workflow execution
   - Embedding generation

### Frontend Application

- **Tech Stack**: React 18, TypeScript, TailwindCSS
- **Key Features**:
  - Visual workflow builder
  - Real-time task monitoring
  - Custom dashboard creation
  - Exercise management

### Database Schema

- **Primary Database**: PostgreSQL 15+
- **Vector Database**: Qdrant
- **Key Tables**:
  - `requests` - Task requests
  - `workflows` - Workflow definitions
  - `workflow_blocks` - Workflow components
  - `ai_outputs` - Processing results
  - `exercises` - Task organization

### Deployment Options

1. **Local Development**:
   - Docker Compose setup
   - Hot-reloading enabled
   - Local Ollama instance

2. **Kubernetes Production**:
   - Multi-replica services
   - Persistent volumes
   - GPU node support
   - Ingress configuration

## Quick Links

### 🛠️ Development
- [Setup Development Environment](docs/QUICKSTART.md#development-setup)
- [API Documentation](http://localhost:8000/docs) (when running)
- [Frontend Development](frontend/README.md)

### 🚢 Deployment
- [Kubernetes Deployment](k8s/README.md)
- [Docker Compose](docker-compose.yml)
- [Environment Variables](config/README.md)

### 📊 Database
- [Migration Tool](scripts/db-migrate.sh)
- [Schema Documentation](docs/database/README.md#database-schema)
- [Backup Procedures](docs/database/UPDATE_PROCEDURES.md#backup-procedures)

## Configuration Files

| File | Purpose |
|------|---------|
| `.env.example` | Environment variable template |
| `docker-compose.yml` | Local development stack |
| `k8s/base/kustomization.yaml` | Kubernetes base configuration |
| `backend/alembic.ini` | Database migration config |

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `scripts/setup-dev.sh` | Initialize development environment |
| `scripts/db-migrate.sh` | Run database migrations |
| `scripts/deploy.sh` | Deploy to Kubernetes |
| `scripts/build-and-push.sh` | Build and push Docker images |

## Version Information

- **Current Version**: See [backend/version.py](backend/version.py)
- **Database Schema Version**: Check with `./scripts/db-migrate.sh status`
- **API Version**: v1 (stable)

## Contributing

1. Read the [contribution guidelines](CONTRIBUTING.md)
2. Check the [issue tracker](https://github.com/yourusername/taskflow/issues)
3. Review the [code style guide](docs/CODE_STYLE.md)
4. Submit pull requests to the `develop` branch

## Support

- **Documentation**: This manifest and linked documents
- **Issues**: GitHub issue tracker
- **Community**: Discord/Slack (if applicable)

## License

See [LICENSE](LICENSE) file for details.

---

*Last Updated: December 2024*