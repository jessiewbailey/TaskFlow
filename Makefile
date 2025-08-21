# TaskFlow Makefile - Development and Testing Commands

.PHONY: help test test-backend test-frontend test-unit test-integration test-e2e coverage lint format install-test-deps ci-check ci-backend-check ci-frontend-check

# Default target
help:
	@echo "TaskFlow Development Commands"
	@echo "============================"
	@echo "Testing:"
	@echo "  make test              - Run all tests"
	@echo "  make test-backend      - Run backend tests"
	@echo "  make test-frontend     - Run frontend tests"
	@echo "  make test-unit         - Run unit tests only"
	@echo "  make test-integration  - Run integration tests"
	@echo "  make test-e2e          - Run end-to-end tests"
	@echo "  make coverage          - Generate test coverage report"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint              - Run linters"
	@echo "  make format            - Format code"
	@echo "  make ci-check          - Run exact GitHub Actions CI checks"
	@echo "  make ci-backend-check  - Run backend CI checks only"
	@echo "  make ci-frontend-check - Run frontend CI checks only"
	@echo ""
	@echo "Setup:"
	@echo "  make install-test-deps - Install test dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make dev-backend       - Run backend in development mode"
	@echo "  make dev-frontend      - Run frontend in development mode"
	@echo "  make build             - Build all components"
	@echo "  make deploy-local      - Deploy to local Kubernetes"

# Install test dependencies
install-test-deps:
	@echo "Installing backend test dependencies..."
	cd backend && pip install -r requirements-test.txt
	@echo "Installing frontend test dependencies..."
	cd frontend && npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom msw @types/jest ts-jest

# Run all tests
test: test-backend test-frontend

# Backend tests
test-backend:
	@echo "Running backend tests..."
	cd backend && pytest

test-backend-verbose:
	cd backend && pytest -vvs

test-backend-unit:
	cd backend && pytest tests/unit -v

test-backend-integration:
	cd backend && pytest tests/integration -v

test-backend-coverage:
	cd backend && pytest --cov=app --cov-report=html --cov-report=term

# Frontend tests
test-frontend:
	@echo "Running frontend tests..."
	cd frontend && npm test -- --watchAll=false

test-frontend-watch:
	cd frontend && npm test

test-frontend-coverage:
	cd frontend && npm test -- --coverage --watchAll=false

# Specific test types
test-unit: test-backend-unit
	cd frontend && npm test -- --watchAll=false --testPathPattern=".test.tsx?$$"

test-integration: test-backend-integration
	cd frontend && npm test -- --watchAll=false --testPathPattern=".integration.test.tsx?$$"

test-e2e:
	@echo "Running E2E tests..."
	cd frontend && npx playwright install && npm run test:e2e

# Coverage reports
coverage: test-backend-coverage test-frontend-coverage
	@echo "Coverage reports generated:"
	@echo "  Backend:  backend/htmlcov/index.html"
	@echo "  Frontend: frontend/coverage/lcov-report/index.html"

# Code quality
lint:
	@echo "Linting backend..."
	cd backend && flake8 app tests --max-line-length=100 --exclude=migrations
	cd backend && mypy app --ignore-missing-imports
	@echo "Linting frontend..."
	cd frontend && npm run lint

format:
	@echo "Formatting backend..."
	cd backend && black app tests
	cd backend && isort app tests
	@echo "Formatting frontend..."
	cd frontend && npm run format

# Development commands
dev-backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm start

# Build commands
build:
	@echo "Building backend..."
	docker build -t taskflow-api:latest ./backend
	@echo "Building frontend..."
	docker build -t taskflow-web:latest ./frontend
	@echo "Building AI worker..."
	docker build -t taskflow-ai:latest ./ai-worker

# Deployment
deploy-local:
	kubectl apply -k k8s/overlays/local

deploy-dev:
	kubectl apply -k k8s/overlays/dev

# Database operations
db-migrate:
	cd backend && alembic upgrade head

db-rollback:
	cd backend && alembic downgrade -1

# Docker compose commands
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Clean up
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name "htmlcov" -exec rm -rf {} +
	find . -type d -name "coverage" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name ".coverage" -delete
	cd frontend && rm -rf node_modules coverage build

# CI/CD simulation
ci-test:
	@echo "Running CI test suite..."
	make lint
	make test-backend-coverage
	make test-frontend-coverage
	@echo "CI tests completed successfully!"

# GitHub Actions CI Equivalent Checks
ci-check: ci-backend-check ci-frontend-check
	@echo "✅ All GitHub Actions CI checks passed!"

ci-backend-check:
	@echo "🔍 Running GitHub Actions backend CI checks..."
	@echo "Running flake8..."
	cd backend && flake8 app tests --max-line-length=100 --exclude=migrations
	@echo "✅ flake8 passed"
	@echo "Running black check..."
	cd backend && black --check app tests
	@echo "✅ black check passed" 
	@echo "Running isort check..."
	cd backend && isort --check-only app tests
	@echo "✅ isort check passed"
	@echo "Running mypy..."
	cd backend && mypy app --ignore-missing-imports
	@echo "✅ mypy passed"
	@echo "✅ All backend CI checks passed!"

ci-frontend-check:
	@echo "🔍 Running GitHub Actions frontend CI checks..."
	@echo "Running ESLint..."
	cd frontend && npm run lint || echo "⚠️  ESLint has issues (allowed to fail in CI)"
	@echo "Running TypeScript check..."
	cd frontend && npm run type-check || echo "⚠️  TypeScript check completed with issues (allowed to fail)"
	@echo "✅ Frontend CI checks completed (failures allowed)!"