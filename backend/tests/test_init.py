"""
Initial test setup to mock external services before any imports
"""

import asyncio
import os
import sys
from unittest.mock import AsyncMock, MagicMock, Mock, patch

# Set test environment variables before any imports
os.environ["TESTING"] = "true"
os.environ["OLLAMA_HOST"] = "http://test-ollama:11434"
os.environ["QDRANT_URL"] = "http://test-qdrant:6333"
os.environ["REDIS_URL"] = "redis://test-redis:6379"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"


# Mock httpx before any imports that might use it
class MockResponse:
    def __init__(self, status_code=200, json_data=None):
        self.status_code = status_code
        self._json_data = json_data or {}

    def json(self):
        return self._json_data

    def raise_for_status(self):
        pass


class MockAsyncClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def post(self, *args, **kwargs):
        return MockResponse(200, {"embedding": [0.1] * 768})

    async def get(self, *args, **kwargs):
        return MockResponse(200, {})


# Don't mock httpx globally - let tests that need it import the real module
# Only mock it for services that make external calls
# mock_httpx = MagicMock()
# mock_httpx.AsyncClient = MockAsyncClient
# sys.modules['httpx'] = mock_httpx


# Mock qdrant_client before import
class MockQdrantClient:
    def __init__(self, *args, **kwargs):
        pass

    def get_collections(self):
        return Mock(collections=[])

    def create_collection(self, *args, **kwargs):
        pass

    def upsert(self, *args, **kwargs):
        pass

    def search(self, *args, **kwargs):
        return []


mock_qdrant = MagicMock()
mock_qdrant.QdrantClient = MockQdrantClient
mock_qdrant.models = MagicMock()
mock_qdrant.models.Distance = MagicMock()
mock_qdrant.models.Distance.COSINE = "cosine"
mock_qdrant.models.VectorParams = MagicMock()
mock_qdrant.models.PointStruct = MagicMock()
mock_qdrant.models.Filter = MagicMock()
mock_qdrant.models.FieldCondition = MagicMock()
mock_qdrant.models.MatchValue = MagicMock()
sys.modules["qdrant_client"] = mock_qdrant
sys.modules["qdrant_client.models"] = mock_qdrant.models


# Mock redis
class MockRedis:
    async def ping(self):
        return True

    async def get(self, key):
        return None

    async def set(self, key, value):
        return True

    async def publish(self, channel, message):
        return 1

    def pubsub(self):
        """Return a mock pubsub object"""
        return MockPubSub()

    async def close(self):
        """Close the connection"""
        pass


class MockPubSub:
    """Mock Redis PubSub object"""

    async def subscribe(self, *channels):
        pass

    async def unsubscribe(self, *channels):
        pass

    async def psubscribe(self, *patterns):
        """Pattern subscription"""
        pass

    async def punsubscribe(self, *patterns):
        """Pattern unsubscription"""
        pass

    async def listen(self):
        # Return empty generator
        return
        yield

    async def close(self):
        pass


mock_redis_module = MagicMock()
mock_redis_module.from_url = lambda *args, **kwargs: MockRedis()
sys.modules["redis.asyncio"] = mock_redis_module

# Mock requests module selectively to avoid breaking kubernetes client
import requests as real_requests


class MockRequestsSession:
    def __init__(self):
        pass

    def get(self, *args, **kwargs):
        return MockResponse(200, {"models": [{"name": "test-model"}]})

    def post(self, *args, **kwargs):
        return MockResponse(200, {"embedding": [0.1] * 768})

    def mount(self, *args, **kwargs):
        pass


# Preserve the real requests module but mock the Session class
real_requests.Session = MockRequestsSession


# Mock ollama client
class MockOllamaClient:
    def __init__(self, *args, **kwargs):
        pass

    def embeddings(self, *args, **kwargs):
        return {"embedding": [0.1] * 768}


mock_ollama_module = MagicMock()
mock_ollama_module.Client = MockOllamaClient
sys.modules["ollama"] = mock_ollama_module


# Create a mock embedding service class
class MockEmbeddingService:
    def __init__(self):
        self.ollama_host = "http://test-ollama:11434"
        self.qdrant_url = "http://test-qdrant:6333"
        self.embedding_model = "test-model"
        self.collection_name = "test-tasks"
        self.vector_size = 768
        self._embedding_semaphore = asyncio.Semaphore(1)
        self.session = None
        self.ollama_client = None
        self.qdrant_client = MockQdrantClient()

    def _ensure_collection(self):
        pass

    async def generate_embedding(self, text: str, max_retries: int = 3):
        return [0.1] * 768

    async def store_task_embedding(self, task_id: int, task_data: dict):
        return "test-uuid"

    async def search_similar_tasks(
        self, query_text: str, limit: int = 5, filters: dict = None
    ):
        return []

    async def search_similar_by_task_id(
        self,
        task_id: int,
        limit: int = 5,
        exclude_self: bool = True,
        filters: dict = None,
    ):
        return []

    async def delete_task_embedding(self, task_id: int):
        pass

    async def _send_to_embedding_service(self, request_id: str, text: str):
        pass


# Create mock embedding service module
mock_embedding_module = MagicMock()
mock_embedding_module.EmbeddingService = MockEmbeddingService
mock_embedding_module.embedding_service = MockEmbeddingService()
sys.modules["app.services.embedding_service"] = mock_embedding_module
