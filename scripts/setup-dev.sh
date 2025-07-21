#!/bin/bash

# TaskFlow Application Development Setup Script

set -e

echo "🚀 Setting up TaskFlow Application for Development..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker is running"

# Function to generate random password
generate_password() {
    # Generate a 32-character random password
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file with secure passwords..."
    
    # Generate random passwords
    MYSQL_ROOT_PWD=$(generate_password)
    MYSQL_USER_PWD=$(generate_password)
    SECRET_KEY=$(generate_password)
    
    cat > .env << EOF
# Database
DATABASE_URL=mysql+aiomysql://taskflow_user:${MYSQL_USER_PWD}@mysql:3306/taskflow_db
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PWD}
MYSQL_DATABASE=taskflow_db
MYSQL_USER=taskflow_user
MYSQL_PASSWORD=${MYSQL_USER_PWD}

# API
SECRET_KEY=${SECRET_KEY}
DEBUG=true
AI_WORKER_URL=http://taskflow-ai:8001

# AI Worker
OLLAMA_HOST=http://ollama:11434
MODEL_NAME=gemma3:1b
BACKEND_API_URL=http://taskflow-api:8000

# Frontend
VITE_API_BASE_URL=http://localhost:8000
EOF
    echo "✅ Created .env file with secure passwords"
    echo ""
    echo "⚠️  IMPORTANT: Save these credentials securely!"
    echo "   • MySQL Root Password: ${MYSQL_ROOT_PWD}"
    echo "   • MySQL User Password: ${MYSQL_USER_PWD}"
    echo "   • Secret Key: ${SECRET_KEY}"
    echo ""
fi

# Create frontend .env.local if it doesn't exist
if [ ! -f frontend/.env.local ]; then
    echo "📝 Creating frontend/.env.local..."
    cat > frontend/.env.local << 'EOF'
VITE_API_BASE_URL=http://localhost:8000
EOF
    echo "✅ Created frontend/.env.local"
fi

# Build and start services
echo "🏗️  Building and starting services..."
docker-compose -f docker-compose.yml up -d --build

echo "⏳ Waiting for services to start..."

# Wait for MySQL
echo "⏳ Waiting for MySQL..."
timeout 60s bash -c 'until docker-compose exec -T mysql mysqladmin ping -h localhost --silent; do sleep 2; done'
echo "✅ MySQL is ready"

# Wait for Ollama and pull model
echo "⏳ Waiting for Ollama and pulling model (this may take a few minutes)..."
timeout 300s bash -c 'until curl -s http://localhost:11434/api/tags > /dev/null; do sleep 5; done'
echo "✅ Ollama is ready"

# Pull the model
echo "📦 Pulling Gemma3:1b model..."
docker-compose exec ollama ollama pull gemma3:1b
echo "✅ Model downloaded"

# Wait for API
echo "⏳ Waiting for API..."
timeout 60s bash -c 'until curl -s http://localhost:8000/healthz > /dev/null; do sleep 2; done'
echo "✅ API is ready"

# Wait for AI Worker
echo "⏳ Waiting for AI Worker..."
timeout 120s bash -c 'until curl -s http://localhost:8001/healthz > /dev/null; do sleep 5; done'
echo "✅ AI Worker is ready"

# Wait for Frontend
echo "⏳ Waiting for Frontend..."
timeout 60s bash -c 'until curl -s http://localhost:3000/health > /dev/null; do sleep 2; done'
echo "✅ Frontend is ready"

echo ""
echo "🎉 TaskFlow Application is ready!"
echo ""
echo "📱 Access the application:"
echo "   • Frontend: http://localhost:3000"
echo "   • API Docs: http://localhost:8000/docs"
echo "   • API Health: http://localhost:8000/healthz"
echo "   • AI Worker Health: http://localhost:8001/healthz"
echo ""
echo "🔧 Useful commands:"
echo "   • View logs: docker-compose logs -f [service-name]"
echo "   • Stop services: docker-compose down"
echo "   • Restart services: docker-compose restart"
echo "   • Check status: docker-compose ps"
echo ""
echo "🗄️  Database info:"
echo "   • Host: localhost:3306"
echo "   • Database: taskflow_db"
echo "   • User: taskflow_user"
echo "   • Password: See .env file"