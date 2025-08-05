"""
Shared pytest fixtures for TaskFlow tests

This module provides common fixtures used across all test modules.
"""
# Import test initialization first
from . import test_init

import pytest
import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, Mock, patch
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
# Lazy imports to avoid metaclass conflict
TestClient = None
AsyncClient = None

# Now we can safely import the app
from app.main import app
from app.models.database import Base, get_db
from app.models.pydantic_models import User, UserRole
from app.routers.auth import get_current_user


# Test database URL - using SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create a test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture(scope="function")
def override_get_db(db_session):
    """Override the get_db dependency with test session."""
    async def _override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user() -> User:
    """Create a test user."""
    from datetime import datetime
    return User(
        id=1,
        name="Test User",
        email="test@example.com",
        role=UserRole.ANALYST,
        created_at=datetime.utcnow()
    )


@pytest.fixture(scope="function")
def mock_current_user(test_user):
    """Mock the current user dependency."""
    app.dependency_overrides[get_current_user] = lambda: test_user
    yield test_user
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def client(override_get_db, mock_current_user):
    """Create a test client with overridden dependencies."""
    global TestClient
    if TestClient is None:
        from fastapi.testclient import TestClient
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="function")
async def async_client(override_get_db, mock_current_user):
    """Create an async test client."""
    global AsyncClient
    if AsyncClient is None:
        from httpx import AsyncClient
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=True)
    redis.publish = AsyncMock(return_value=1)
    redis.subscribe = AsyncMock()
    return redis


@pytest.fixture
def mock_qdrant_client():
    """Mock Qdrant client."""
    client = Mock()
    client.upsert = Mock(return_value=True)
    client.search = Mock(return_value=[])
    client.delete = Mock(return_value=True)
    client.get_collections = Mock(return_value=Mock(collections=[]))
    client.create_collection = Mock(return_value=True)
    return client


@pytest.fixture
def mock_ollama_client():
    """Mock Ollama client."""
    client = Mock()
    client.embeddings = Mock(return_value={"embedding": [0.1] * 768})
    return client


@pytest.fixture
def mock_embedding_service():
    """Mock embedding service."""
    service = Mock()
    service.generate_embedding = AsyncMock(return_value=[0.1] * 768)
    service.store_task_embedding = AsyncMock(return_value="test-id")
    service.search_similar_tasks = AsyncMock(return_value=[])
    service.delete_task_embedding = AsyncMock()
    return service


# Sample data fixtures
@pytest.fixture
def sample_request_data():
    """Sample request data for testing."""
    return {
        "text": "Please analyze this document and provide key insights.",
        "requester": "test@example.com",
        "priority": "high",
        "workflow_id": 1
    }


@pytest.fixture
def sample_workflow_data():
    """Sample workflow data for testing."""
    return {
        "name": "Test Workflow",
        "description": "A workflow for testing",
        "blocks": [
            {
                "name": "Summarize",
                "prompt": "Summarize the following text: {{REQUEST_TEXT}}",
                "order": 1,
                "block_type": "CUSTOM"
            }
        ]
    }


@pytest.fixture
def sample_embedding_config():
    """Sample embedding configuration."""
    return {
        "enabled": True,
        "embedding_template": "Summary: {{Summarize.summary}}\nRequest: {{REQUEST_TEXT}}"
    }


# Environment variable fixtures
@pytest.fixture(autouse=True)
def mock_env_vars(monkeypatch):
    """Set test environment variables."""
    monkeypatch.setenv("SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("DATABASE_URL", TEST_DATABASE_URL)
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379")
    monkeypatch.setenv("QDRANT_URL", "http://localhost:6333")
    monkeypatch.setenv("OLLAMA_HOST", "http://localhost:11434")
    monkeypatch.setenv("AI_WORKER_URL", "http://localhost:8001")