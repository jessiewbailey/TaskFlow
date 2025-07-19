# Quick Start Guide - Docker Desktop

This guide will help you run the TaskFlow Request Processing Application locally using Docker Desktop.

## Prerequisites

1. **Docker Desktop** - Install and start Docker Desktop
2. **Git** - To clone the repository
3. **4GB+ RAM** - Recommended for running all services
4. **10GB+ Disk Space** - For images and AI model

## Quick Setup (Automated)

1. **Clone and setup**:
   ```bash
   cd TaskFlow
   ./scripts/setup-dev.sh
   ```

   This script will:
   - Create environment files
   - Build and start all services
   - Download the AI model
   - Wait for everything to be ready

2. **Access the application**:
   - Frontend: http://localhost:3000
   - API Documentation: http://localhost:8000/docs
   - API Health: http://localhost:8000/healthz

## Manual Setup (Step by Step)

If you prefer to run setup manually:

1. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Start the services**:
   ```bash
   docker-compose up -d --build
   ```

3. **Wait for services** (check status):
   ```bash
   docker-compose ps
   ```

4. **Download AI model** (first time only):
   ```bash
   docker-compose exec ollama ollama pull gemma3:1b
   ```

5. **Verify everything is running**:
   ```bash
   curl http://localhost:8000/healthz
   curl http://localhost:8001/healthz
   curl http://localhost:3000/health
   ```

## Testing the Application

1. **Open the frontend**: http://localhost:3000

2. **Create a test task request**:
   - Click "New Request"
   - Enter some sample text like:
     ```
     I am requesting all documents related to the 2023 budget planning 
     for the Department of Transportation, including internal memos, 
     emails, and meeting minutes from January to March 2023.
     ```
   - Click "Create Request"

3. **Watch the AI processing**:
   - The request will appear in the table
   - Click on it to open the details drawer
   - Switch to the "AI Analysis" tab to see results when complete

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs -f [service-name]

# Common issues:
# - Port conflicts: Make sure ports 3000, 8000, 8001, 3306, 11434 are free
# - Memory: Ensure Docker has at least 4GB RAM allocated
```

### AI model download fails
```bash
# Manual model download
docker-compose exec ollama ollama pull gemma2:2b

# Check Ollama logs
docker-compose logs ollama
```

### Database connection issues
```bash
# Check MySQL logs
docker-compose logs mysql

# Reset database
docker-compose down -v
docker-compose up -d mysql
```

### Frontend build fails
```bash
# Check if Node.js dependencies are installed
docker-compose exec taskflow-web npm install

# Rebuild frontend
docker-compose build taskflow-web
```

## Development Commands

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f taskflow-api

# Restart a service
docker-compose restart taskflow-api

# Stop all services
docker-compose down

# Stop and remove volumes (reset everything)
docker-compose down -v

# Check service status
docker-compose ps

# Execute commands in containers
docker-compose exec taskflow-api bash
docker-compose exec mysql mysql -u taskflow_user -p taskflow_db
```

## Available Services

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | React web application |
| API | http://localhost:8000 | FastAPI backend |
| API Docs | http://localhost:8000/docs | Interactive API documentation |
| AI Worker | http://localhost:8001 | AI processing service |
| MySQL | localhost:3306 | Database (taskflow_user/taskflow_password) |
| Ollama | http://localhost:11434 | AI model server |

## Default Test Data

The database is initialized with:
- 3 test users (Admin, Analyst, Supervisor)
- Empty requests table (ready for testing)

## Performance Notes

- First startup takes 5-10 minutes (downloading AI model)
- Subsequent startups take 1-2 minutes
- AI processing takes 30-60 seconds per request
- Uses about 3-4GB RAM total

## Next Steps

Once everything is running:
1. Create test TaskFlow requests
2. Test AI analysis features
3. Try custom processing instructions
4. Explore the API documentation at http://localhost:8000/docs