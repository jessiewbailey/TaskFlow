import asyncio
import logging
import os
import uuid
from asyncio import Semaphore
from typing import Any, Dict, List, Optional

from ollama import Client as OllamaClient
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self):
        self.ollama_host = os.getenv("OLLAMA_HOST", "http://ollama-service:11434")
        self.qdrant_url = os.getenv("QDRANT_URL", "http://qdrant:6333")
        self.embedding_model = "nomic-embed-text:latest"
        self.collection_name = "tasks"
        self.vector_size = 768  # nomic-embed-text dimension

        # Concurrency control - limit to 2 simultaneous embedding requests
        self._embedding_semaphore = Semaphore(2)

        # Create a session for connection pooling
        import requests

        self.session = requests.Session()
        self.session.mount("http://", requests.adapters.HTTPAdapter(max_retries=3))

        logger.info(
            f"Initializing EmbeddingService with Ollama at {self.ollama_host} "
            f"and Qdrant at {self.qdrant_url}"
        )

        try:
            self.ollama_client = OllamaClient(host=self.ollama_host)
            self.qdrant_client = QdrantClient(url=self.qdrant_url)

            # Test Ollama connection (non-blocking for startup)
            logger.info("Testing Ollama connection...")
            try:
                response = self.session.get(f"{self.ollama_host}/api/tags", timeout=10)
                response.raise_for_status()
                models = [m["name"] for m in response.json().get("models", [])]
                logger.info(f"Ollama connection successful. Available models: {models}")

                if self.embedding_model not in models:
                    logger.warning(
                        f"Required embedding model '{self.embedding_model}' not found in Ollama!"
                    )
                    logger.warning(f"Available models: {models}")
            except Exception as e:
                logger.warning(
                    f"Ollama connection failed during startup (this is normal if Ollama "
                    f"is still starting): {str(e)}"
                )
                logger.info(
                    "EmbeddingService will retry connections when embedding "
                    "operations are requested"
                )

            # Initialize Qdrant collection (this usually works)
            try:
                self._ensure_collection()
            except Exception as e:
                logger.warning(f"Qdrant collection initialization failed during startup: {str(e)}")
                logger.info("EmbeddingService will retry Qdrant connection when needed")
        except Exception as e:
            logger.warning(f"EmbeddingService initialization had issues: {str(e)}")
            logger.info("EmbeddingService will continue startup and retry connections when needed")

    def _ensure_collection(self):
        """Ensure the Qdrant collection exists with proper configuration."""
        try:
            logger.info(
                f"Checking for collection '{self.collection_name}' in Qdrant at {self.qdrant_url}"
            )

            collections = self.qdrant_client.get_collections().collections
            collection_names = [col.name for col in collections]

            if self.collection_name not in collection_names:
                logger.info(
                    f"Creating new collection '{self.collection_name}' in Qdrant at "
                    f"{self.qdrant_url}"
                )

                self.qdrant_client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=self.vector_size, distance=Distance.COSINE),
                )
                logger.info(
                    f"Successfully created Qdrant collection '{self.collection_name}' "
                    f"with vector size {self.vector_size}"
                )
            else:
                logger.info(
                    f"Qdrant collection '{self.collection_name}' already exists at "
                    f"{self.qdrant_url}"
                )
        except Exception as e:
            logger.error(f"Error ensuring collection at Qdrant {self.qdrant_url}: {str(e)}")
            raise

    async def generate_embedding(self, text: str, max_retries: int = 3) -> List[float]:
        """Generate embedding for text using Ollama with retry logic and concurrency control."""

        # Use semaphore to limit concurrent requests
        async with self._embedding_semaphore:
            logger.info(
                f"Acquired embedding semaphore, generating embedding for text: '{text[:50]}...'"
            )

            for attempt in range(max_retries):
                try:
                    logger.info(
                        f"Generating embedding using Ollama at {self.ollama_host} "
                        f"with model {self.embedding_model} (attempt {attempt + 1})"
                    )

                    payload = {"model": self.embedding_model, "prompt": text}

                    # Run the synchronous request in a thread pool to avoid blocking
                    loop = asyncio.get_event_loop()

                    # Increase timeout to 60 seconds for embedding generation
                    response = await loop.run_in_executor(
                        None,
                        lambda: self.session.post(
                            f"{self.ollama_host}/api/embeddings",
                            json=payload,
                            timeout=60,  # Increased from 30 to 60 seconds
                        ),
                    )

                    response.raise_for_status()

                    result = response.json()
                    embedding = result.get("embedding", [])

                    if not embedding:
                        raise ValueError("No embedding returned from Ollama")

                    logger.info(
                        f"Successfully generated embedding with {len(embedding)} dimensions"
                    )
                    return embedding

                except Exception as e:
                    logger.warning(f"Embedding generation attempt {attempt + 1} failed: {str(e)}")

                    if attempt < max_retries - 1:
                        # Wait with exponential backoff before retry
                        wait_time = min((2**attempt) + 1, 10)  # Cap at 10 seconds
                        logger.info(f"Retrying in {wait_time} seconds...")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(
                            f"All {max_retries} embedding generation attempts failed "
                            f"from Ollama at {self.ollama_host}: {str(e)}"
                        )
                        # Return a zero vector as fallback to prevent crashes
                        logger.warning("Returning zero vector as fallback for failed embedding")
                        return [0.0] * self.vector_size
            # This should never be reached, but added for mypy completeness
            logger.error("Unexpected end of embedding generation function")
            return [0.0] * self.vector_size

    async def store_task_embedding(self, task_id: int, task_data: Dict[str, Any]) -> str:
        """Store task embedding in Qdrant."""
        try:
            # Create text representation of the task
            text_parts = []
            if task_data.get("title"):
                text_parts.append(f"Title: {task_data['title']}")
            if task_data.get("description"):
                text_parts.append(f"Description: {task_data['description']}")
            if task_data.get("priority"):
                text_parts.append(f"Priority: {task_data['priority']}")
            if task_data.get("status"):
                text_parts.append(f"Status: {task_data['status']}")
            if task_data.get("tags"):
                text_parts.append(f"Tags: {', '.join(task_data['tags'])}")

            text = "\n".join(text_parts)

            # Generate embedding
            embedding = await self.generate_embedding(text)

            # Generate unique ID for the point
            point_id = str(uuid.uuid4())

            # Store in Qdrant
            logger.info(
                f"Storing embedding in Qdrant at {self.qdrant_url}, "
                f"collection: {self.collection_name}, point_id: {point_id}"
            )

            self.qdrant_client.upsert(
                collection_name=self.collection_name,
                points=[
                    PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload={
                            "task_id": task_id,
                            "title": task_data.get("title", ""),
                            "description": task_data.get("description", ""),
                            "priority": task_data.get("priority", ""),
                            "status": task_data.get("status", ""),
                            "tags": task_data.get("tags", []),
                            "exercise_id": task_data.get("exercise_id"),
                            "created_at": task_data.get("created_at", ""),
                        },
                    )
                ],
            )

            logger.info(f"Successfully stored embedding for task {task_id} in Qdrant")
            return point_id

        except Exception as e:
            logger.error(f"Error storing task embedding: {str(e)}")
            raise

    async def search_similar_tasks(
        self, query_text: str, limit: int = 5, filters: Optional[Dict] = None
    ) -> List[Dict[str, Any]]:
        """Search for similar tasks based on query text."""
        try:
            logger.info(f"Searching for similar tasks using query: '{query_text}' (limit: {limit})")

            # Generate embedding for query
            query_embedding = await self.generate_embedding(query_text)

            # Build filter if provided
            qdrant_filter = None
            if filters:
                conditions = []
                if filters.get("exercise_id"):
                    conditions.append(
                        FieldCondition(
                            key="exercise_id",
                            match=MatchValue(value=filters["exercise_id"]),
                        )
                    )
                if filters.get("priority"):
                    conditions.append(
                        FieldCondition(key="priority", match=MatchValue(value=filters["priority"]))
                    )
                if filters.get("status"):
                    conditions.append(
                        FieldCondition(key="status", match=MatchValue(value=filters["status"]))
                    )

                if conditions:
                    qdrant_filter = Filter(must=conditions)

            # Search in Qdrant
            logger.info(
                f"Performing vector search in Qdrant at {self.qdrant_url}, "
                f"collection: {self.collection_name}"
            )
            logger.debug(f"Search filters: {filters if filters else 'None'}")

            search_result = self.qdrant_client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                limit=limit,
                query_filter=qdrant_filter,
            )

            logger.info(f"Qdrant search returned {len(search_result)} results")

            # Format results
            results = []
            for hit in search_result:
                result = {
                    "score": hit.score,
                    "task_id": hit.payload.get("task_id"),
                    "title": hit.payload.get("title"),
                    "description": hit.payload.get("description"),
                    "priority": hit.payload.get("priority"),
                    "status": hit.payload.get("status"),
                    "tags": hit.payload.get("tags", []),
                    "exercise_id": hit.payload.get("exercise_id"),
                    "created_at": hit.payload.get("created_at"),
                }
                results.append(result)

            return results

        except Exception as e:
            logger.error(f"Error searching similar tasks: {str(e)}")
            raise

    async def search_similar_by_task_id(
        self,
        task_id: int,
        limit: int = 5,
        exclude_self: bool = True,
        filters: Optional[Dict] = None,
    ) -> List[Dict[str, Any]]:
        """Search for tasks similar to a given task ID."""
        try:
            # First, get the task's embedding from Qdrant
            search_result = self.qdrant_client.scroll(
                collection_name=self.collection_name,
                scroll_filter=Filter(
                    must=[FieldCondition(key="task_id", match=MatchValue(value=task_id))]
                ),
                limit=1,
            )

            if not search_result[0]:
                logger.warning(f"No embedding found for task {task_id}")
                return []

            # Get the point with vector
            task_point = search_result[0][0]
            # Need to retrieve the point with vector included
            point_result = self.qdrant_client.retrieve(
                collection_name=self.collection_name,
                ids=[task_point.id],
                with_vectors=True,  # Note: with_vectors (plural)
            )

            if not point_result:
                logger.warning(f"Could not retrieve vector for task {task_id}")
                return []

            task_embedding = point_result[0].vector

            # Build filter if provided
            qdrant_filter = None
            if filters:
                conditions = []
                if filters.get("exercise_id") is not None:
                    conditions.append(
                        FieldCondition(
                            key="exercise_id",
                            match=MatchValue(value=filters["exercise_id"]),
                        )
                    )

                if conditions:
                    qdrant_filter = Filter(must=conditions)

            # Search for similar tasks
            similar_tasks = self.qdrant_client.search(
                collection_name=self.collection_name,
                query_vector=task_embedding,
                limit=limit + 1 if exclude_self else limit,
                query_filter=qdrant_filter,
            )

            # Format results and exclude self if requested
            results = []
            for hit in similar_tasks:
                if exclude_self and hit.payload.get("task_id") == task_id:
                    continue

                result = {
                    "score": hit.score,
                    "task_id": hit.payload.get("task_id"),
                    "title": hit.payload.get("title"),
                    "description": hit.payload.get("description"),
                    "priority": hit.payload.get("priority"),
                    "status": hit.payload.get("status"),
                    "tags": hit.payload.get("tags", []),
                    "exercise_id": hit.payload.get("exercise_id"),
                    "created_at": hit.payload.get("created_at"),
                }
                results.append(result)

                if len(results) >= limit:
                    break

            return results

        except Exception as e:
            logger.error(f"Error searching similar tasks by ID: {str(e)}")
            raise

    async def delete_task_embedding(self, task_id: int):
        """Delete task embedding from Qdrant."""
        try:
            self.qdrant_client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[FieldCondition(key="task_id", match=MatchValue(value=task_id))]
                ),
            )
            logger.info(f"Deleted embedding for task {task_id}")
        except Exception as e:
            logger.error(f"Error deleting task embedding: {str(e)}")
            raise


# Lazy initialization implementation


class LazyEmbeddingService:
    """Lazy wrapper for EmbeddingService that initializes only when first accessed."""

    def __init__(self):
        self._service: Optional[EmbeddingService] = None
        self._initialized = False
        self._disabled = os.getenv("DISABLE_EMBEDDING_SERVICE", "false").lower() == "true"

    def _ensure_initialized(self):
        """Initialize the service if not already done."""
        if self._initialized:
            return

        self._initialized = True

        if self._disabled:
            logger.warning("EmbeddingService disabled by environment variable")
            self._service = None  # type: ignore[assignment]
            return

        try:
            logger.info("Initializing EmbeddingService on first access...")
            self._service = EmbeddingService()
            logger.info("EmbeddingService initialized successfully")
        except Exception as e:
            logger.warning(f"EmbeddingService initialization failed: {str(e)}")
            logger.warning("EmbeddingService will remain unavailable")
            self._service = None  # type: ignore[assignment]

    def __getattr__(self, name):
        """Delegate attribute access to the underlying service after ensuring it's initialized."""
        self._ensure_initialized()
        if self._service is None:
            raise RuntimeError("EmbeddingService is not available")
        return getattr(self._service, name)

    def __bool__(self):
        """Return True if the service is available."""
        self._ensure_initialized()
        return self._service is not None

    def is_available(self):
        """Check if the embedding service is available without triggering initialization."""
        if not self._initialized:
            return not self._disabled
        return self._service is not None


# Create lazy singleton instance
embedding_service = LazyEmbeddingService()
