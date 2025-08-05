# TaskFlow Testing Plan and Procedures

## Table of Contents
1. [Overview](#overview)
2. [Testing Strategy](#testing-strategy)
3. [Backend Testing](#backend-testing)
4. [Frontend Testing](#frontend-testing)
5. [Integration Testing](#integration-testing)
6. [End-to-End Testing](#end-to-end-testing)
7. [Testing Procedures](#testing-procedures)
8. [CI/CD Integration](#cicd-integration)
9. [Testing Standards](#testing-standards)

## Overview

This document outlines the comprehensive testing strategy for the TaskFlow application, covering unit tests, integration tests, and end-to-end tests across both backend and frontend components.

### Testing Goals
- Ensure code reliability and maintainability
- Catch bugs early in the development cycle
- Document expected behavior through tests
- Enable safe refactoring
- Maintain >80% code coverage for critical paths

## Testing Strategy

### Testing Pyramid
```
         /\
        /E2E\       (5%)  - Critical user journeys
       /------\
      /Integration\ (20%) - API & service integration
     /------------\
    /  Unit Tests  \(75%) - Individual components/functions
   /----------------\
```

### Technology Stack
- **Backend**: pytest, pytest-asyncio, pytest-cov, httpx (for API testing)
- **Frontend**: Jest, React Testing Library, MSW (Mock Service Worker)
- **E2E**: Playwright or Cypress
- **API Testing**: pytest + httpx for backend, MSW for frontend mocking

## Backend Testing

### Unit Tests Structure
```
backend/
├── tests/
│   ├── __init__.py
│   ├── conftest.py                 # Shared fixtures
│   ├── unit/
│   │   ├── __init__.py
│   │   ├── models/
│   │   │   ├── test_schemas.py
│   │   │   └── test_pydantic_models.py
│   │   ├── services/
│   │   │   ├── test_job_service.py
│   │   │   ├── test_embedding_service.py
│   │   │   ├── test_event_bus.py
│   │   │   └── test_webhook_service.py
│   │   ├── routers/
│   │   │   ├── test_requests.py
│   │   │   ├── test_workflows.py
│   │   │   ├── test_auth.py
│   │   │   └── test_rag_search.py
│   │   └── utils/
│   │       └── test_helpers.py
│   ├── integration/
│   │   ├── __init__.py
│   │   ├── test_database_operations.py
│   │   ├── test_redis_pubsub.py
│   │   ├── test_qdrant_operations.py
│   │   └── test_workflow_execution.py
│   └── fixtures/
│       ├── __init__.py
│       ├── sample_data.py
│       └── mock_responses.py
```

### Backend Test Examples

#### 1. Service Unit Test Example
```python
# tests/unit/services/test_job_service.py
import pytest
from unittest.mock import Mock, AsyncMock, patch
from app.services.job_service import JobService, JobQueueManager
from app.models.schemas import JobStatus, JobType

@pytest.fixture
def mock_db():
    """Mock database session"""
    db = AsyncMock()
    db.commit = AsyncMock()
    db.add = Mock()
    return db

@pytest.fixture
def job_service(mock_db):
    """Create JobService instance with mocked dependencies"""
    return JobService(mock_db)

class TestJobService:
    @pytest.mark.asyncio
    async def test_create_job_success(self, job_service, mock_db):
        """Test successful job creation"""
        # Arrange
        request_id = 123
        job_type = JobType.STANDARD
        
        # Act
        with patch('uuid.uuid4', return_value='test-uuid'):
            job_id = await job_service.create_job(
                request_id=request_id,
                job_type=job_type
            )
        
        # Assert
        assert job_id == 'test-uuid'
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_job_queue_position(self, job_service):
        """Test queue position calculation"""
        # Arrange
        queue_manager = JobQueueManager(max_concurrent_jobs=2)
        job_id = 'test-job-1'
        
        # Act
        position = queue_manager.get_queue_position(job_id)
        
        # Assert
        assert position == -1  # Not in queue yet

    @pytest.mark.asyncio
    async def test_job_retry_logic(self, job_service, mock_db):
        """Test job retry on failure"""
        # Test implementation here
        pass
```

#### 2. Router Unit Test Example
```python
# tests/unit/routers/test_workflows.py
import pytest
from httpx import AsyncClient
from fastapi import status
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

class TestWorkflowRoutes:
    @pytest.mark.asyncio
    async def test_get_workflows(self, client, mock_auth):
        """Test GET /api/workflows endpoint"""
        response = await client.get(
            "/api/workflows",
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.asyncio
    async def test_create_workflow_validation(self, client, mock_auth):
        """Test workflow creation with invalid data"""
        invalid_workflow = {
            "name": "",  # Empty name should fail
            "blocks": []
        }
        
        response = await client.post(
            "/api/workflows",
            json=invalid_workflow,
            headers={"Authorization": "Bearer test-token"}
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
```

#### 3. Integration Test Example
```python
# tests/integration/test_workflow_execution.py
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schemas import Request, Workflow, ProcessingJob
from app.services.job_service import JobService

class TestWorkflowIntegration:
    @pytest.mark.asyncio
    async def test_complete_workflow_execution(
        self, 
        db_session: AsyncSession,
        sample_workflow,
        sample_request
    ):
        """Test complete workflow execution from request to completion"""
        # Create job
        job_service = JobService(db_session)
        job_id = await job_service.create_job(
            request_id=sample_request.id,
            workflow_id=sample_workflow.id,
            job_type=JobType.WORKFLOW
        )
        
        # Simulate job processing
        await job_service._process_job(job_id)
        
        # Verify results
        job = await db_session.get(ProcessingJob, job_id)
        assert job.status == JobStatus.COMPLETED
        
        # Check if embedding was generated
        request = await db_session.get(Request, sample_request.id)
        assert request.embedding_status == EmbeddingStatus.COMPLETED
```

### Backend Testing Requirements

#### Required Test Packages
```txt
# requirements-test.txt
pytest==8.2.0
pytest-asyncio==0.23.6
pytest-cov==5.0.0
pytest-mock==3.14.0
httpx==0.27.0
faker==24.4.0
factory-boy==3.3.0
pytest-env==1.1.3
testcontainers==4.4.0  # For integration tests with real databases
```

## Frontend Testing

### Frontend Test Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── RequestCard/
│   │   │   ├── RequestCard.tsx
│   │   │   └── RequestCard.test.tsx
│   │   ├── WorkflowEditor/
│   │   │   ├── WorkflowEditor.tsx
│   │   │   └── WorkflowEditor.test.tsx
│   │   └── ...
│   ├── hooks/
│   │   ├── useEventStream.ts
│   │   └── useEventStream.test.ts
│   ├── services/
│   │   ├── api.ts
│   │   └── api.test.ts
│   └── pages/
│       ├── Dashboard/
│       │   ├── Dashboard.tsx
│       │   └── Dashboard.test.tsx
│       └── ...
├── __tests__/
│   ├── integration/
│   │   └── workflow-creation.test.tsx
│   └── e2e/
│       └── user-journey.spec.ts
└── test-utils/
    ├── setup.ts
    ├── test-utils.tsx
    └── mocks/
        ├── handlers.ts
        └── server.ts
```

### Frontend Test Examples

#### 1. Component Unit Test
```typescript
// src/components/RequestCard/RequestCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { RequestCard } from './RequestCard'
import { mockRequest } from '../../test-utils/mocks/data'

describe('RequestCard', () => {
  it('renders request information correctly', () => {
    render(<RequestCard request={mockRequest} />)
    
    expect(screen.getByText(mockRequest.text)).toBeInTheDocument()
    expect(screen.getByText(`Priority: ${mockRequest.priority}`)).toBeInTheDocument()
  })
  
  it('shows processing status when job is running', () => {
    const processingRequest = {
      ...mockRequest,
      processing_status: 'RUNNING',
      queue_position: 3
    }
    
    render(<RequestCard request={processingRequest} />)
    
    expect(screen.getByText('3 jobs ahead')).toBeInTheDocument()
  })
  
  it('handles click events', async () => {
    const handleClick = jest.fn()
    render(<RequestCard request={mockRequest} onClick={handleClick} />)
    
    fireEvent.click(screen.getByRole('article'))
    
    expect(handleClick).toHaveBeenCalledWith(mockRequest.id)
  })
})
```

#### 2. Hook Test
```typescript
// src/hooks/useEventStream.test.ts
import { renderHook, act } from '@testing-library/react'
import { useEventStream } from './useEventStream'
import { server } from '../test-utils/mocks/server'
import { rest } from 'msw'

describe('useEventStream', () => {
  it('connects to SSE endpoint and receives events', async () => {
    const { result } = renderHook(() => useEventStream('/api/events'))
    
    // Initially not connected
    expect(result.current.isConnected).toBe(false)
    
    // Wait for connection
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })
    
    expect(result.current.isConnected).toBe(true)
  })
  
  it('handles connection errors gracefully', async () => {
    // Mock server error
    server.use(
      rest.get('/api/events', (req, res, ctx) => {
        return res(ctx.status(500))
      })
    )
    
    const { result } = renderHook(() => useEventStream('/api/events'))
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })
    
    expect(result.current.error).toBeTruthy()
  })
})
```

#### 3. Integration Test
```typescript
// __tests__/integration/workflow-creation.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../src/App'
import { server } from '../../test-utils/mocks/server'
import { rest } from 'msw'

describe('Workflow Creation Integration', () => {
  it('creates a new workflow successfully', async () => {
    const user = userEvent.setup()
    
    render(<App />)
    
    // Navigate to workflows
    await user.click(screen.getByText('Workflows'))
    
    // Click create button
    await user.click(screen.getByText('Create Workflow'))
    
    // Fill form
    await user.type(screen.getByLabelText('Workflow Name'), 'Test Workflow')
    await user.type(screen.getByLabelText('Description'), 'Test Description')
    
    // Add a block
    await user.click(screen.getByText('Add Block'))
    await user.type(screen.getByLabelText('Block Name'), 'Summarize')
    
    // Save
    await user.click(screen.getByText('Save Workflow'))
    
    // Verify success
    await waitFor(() => {
      expect(screen.getByText('Workflow created successfully')).toBeInTheDocument()
    })
  })
})
```

### Frontend Testing Requirements

#### Test Setup
```javascript
// test-utils/setup.ts
import '@testing-library/jest-dom'
import { server } from './mocks/server'

// Start Mock Service Worker
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})
```

#### Package Updates
```json
// package.json additions
{
  "devDependencies": {
    "@testing-library/react": "^14.2.1",
    "@testing-library/jest-dom": "^6.4.2",
    "@testing-library/user-event": "^14.5.2",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "msw": "^2.2.1",
    "@types/jest": "^29.5.12",
    "ts-jest": "^29.1.2"
  }
}
```

## Integration Testing

### API Integration Tests
```python
# tests/integration/test_api_integration.py
import pytest
from httpx import AsyncClient
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

@pytest.fixture(scope="session")
async def postgres_container():
    with PostgresContainer("postgres:15") as postgres:
        yield postgres

@pytest.fixture(scope="session") 
async def redis_container():
    with RedisContainer("redis:7") as redis:
        yield redis

class TestAPIIntegration:
    @pytest.mark.asyncio
    async def test_request_lifecycle(
        self, 
        client: AsyncClient,
        postgres_container,
        redis_container
    ):
        """Test complete request lifecycle from creation to completion"""
        # Create request
        request_data = {
            "text": "Test request",
            "workflow_id": 1,
            "priority": "high"
        }
        
        response = await client.post("/api/requests", json=request_data)
        assert response.status_code == 201
        request_id = response.json()["id"]
        
        # Check SSE updates
        async with client.stream("GET", "/api/events") as response:
            async for line in response.aiter_lines():
                if line.startswith("data:"):
                    event_data = json.loads(line[5:])
                    if event_data["request_id"] == request_id:
                        assert event_data["status"] in ["PENDING", "RUNNING", "COMPLETED"]
```

## End-to-End Testing

### E2E Test Structure
```typescript
// e2e/user-journeys/create-and-process-request.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Request Creation and Processing', () => {
  test('user can create request and see it processed', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    
    // Navigate to dashboard
    await expect(page).toHaveURL('/dashboard')
    
    // Create new request
    await page.click('text=New Request')
    await page.fill('[name="requestText"]', 'Analyze this document for key insights')
    await page.selectOption('[name="workflow"]', 'summarization')
    await page.click('text=Submit')
    
    // Wait for processing
    await expect(page.locator('.request-status')).toContainText('Processing', {
      timeout: 30000
    })
    
    // Verify completion
    await expect(page.locator('.request-status')).toContainText('Completed', {
      timeout: 60000
    })
    
    // Check results
    await page.click('text=View Results')
    await expect(page.locator('.ai-output')).toBeVisible()
  })
})
```

## Testing Procedures

### 1. Development Workflow
```bash
# Before committing
make test           # Run all tests
make test-unit      # Run only unit tests
make test-coverage  # Generate coverage report
```

### 2. Test Writing Guidelines
- **Test Naming**: Use descriptive names that explain what is being tested
  - ✅ `test_create_workflow_with_invalid_name_returns_422`
  - ❌ `test_workflow_1`

- **AAA Pattern**: Arrange, Act, Assert
```python
def test_example():
    # Arrange
    service = MyService()
    input_data = {"key": "value"}
    
    # Act
    result = service.process(input_data)
    
    # Assert
    assert result.status == "success"
```

- **Test Independence**: Each test should be able to run in isolation
- **Mock External Dependencies**: Use mocks for databases, APIs, etc.
- **Test Data**: Use factories or fixtures for consistent test data

### 3. Coverage Requirements
- **Minimum Coverage**: 80% for new code
- **Critical Paths**: 95% coverage for:
  - Authentication/authorization
  - Payment processing
  - Data validation
  - Error handling

### 4. Performance Testing
```python
# tests/performance/test_api_performance.py
import pytest
from locust import HttpUser, task, between

class TaskFlowUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def get_requests(self):
        self.client.get("/api/requests")
    
    @task
    def create_request(self):
        self.client.post("/api/requests", json={
            "text": "Performance test request",
            "workflow_id": 1
        })
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.12'
    
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
        pip install -r requirements-test.txt
    
    - name: Run tests
      run: |
        cd backend
        pytest -v --cov=app --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./backend/coverage.xml
  
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node
      uses: actions/setup-node@v3
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: |
        cd frontend
        npm ci
    
    - name: Run tests
      run: |
        cd frontend
        npm run test:ci
    
    - name: Run E2E tests
      run: |
        cd frontend
        npx playwright install
        npm run test:e2e
```

## Testing Standards

### 1. Code Review Checklist
- [ ] All new features have corresponding tests
- [ ] Tests follow naming conventions
- [ ] Tests are independent and don't rely on execution order
- [ ] Edge cases are covered
- [ ] Error scenarios are tested
- [ ] Mocks are properly cleaned up
- [ ] No hardcoded test data that could break

### 2. Test Documentation
Each test file should include:
```python
"""
Test module for JobService

Tests cover:
- Job creation and queuing
- Job status updates
- Retry logic
- Error handling
- Queue position calculation
"""
```

### 3. Test Data Management
```python
# tests/fixtures/factories.py
import factory
from app.models.schemas import Request, Workflow

class RequestFactory(factory.Factory):
    class Meta:
        model = Request
    
    text = factory.Faker('paragraph')
    requester = factory.Faker('email')
    priority = factory.Iterator(['low', 'medium', 'high'])
    workflow_id = factory.SubFactory(WorkflowFactory)

class WorkflowFactory(factory.Factory):
    class Meta:
        model = Workflow
    
    name = factory.Sequence(lambda n: f"Workflow {n}")
    description = factory.Faker('sentence')
    is_active = True
```

### 4. Testing Best Practices

#### DO:
- Write tests before fixing bugs (regression tests)
- Use descriptive test names
- Keep tests simple and focused
- Use appropriate assertions
- Clean up resources in teardown
- Test both success and failure paths

#### DON'T:
- Write tests that depend on external services
- Use production data in tests
- Write overly complex tests
- Skip error case testing
- Ignore flaky tests
- Test implementation details

### 5. Debugging Failed Tests
```bash
# Run specific test with verbose output
pytest -vvs tests/unit/services/test_job_service.py::TestJobService::test_create_job_success

# Run with debugging
pytest --pdb tests/unit/services/test_job_service.py

# Run with specific markers
pytest -m "not slow" tests/
```

## Maintenance and Updates

### Monthly Tasks
1. Review and update test dependencies
2. Analyze coverage reports for gaps
3. Review and fix flaky tests
4. Update test data and fixtures
5. Performance test baseline updates

### Quarterly Tasks
1. Full E2E test suite review
2. Load testing and performance benchmarks
3. Security testing updates
4. Documentation review and updates

## Appendix: Quick Start Commands

```bash
# Backend testing
cd backend
pip install -r requirements-test.txt
pytest                          # Run all tests
pytest -v                       # Verbose output
pytest -k "test_create"         # Run tests matching pattern
pytest --cov=app               # With coverage
pytest -m "not integration"     # Skip integration tests

# Frontend testing
cd frontend
npm install --save-dev @testing-library/react jest
npm test                        # Run tests in watch mode
npm run test:ci                 # Run once with coverage
npm run test:e2e               # Run E2E tests

# Docker-based testing
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## Resources

- [pytest Documentation](https://docs.pytest.org/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Mock Service Worker](https://mswjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Test Containers](https://www.testcontainers.org/)