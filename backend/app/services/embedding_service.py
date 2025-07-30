import os
import logging
from typing import List, Optional, Dict, Any
import numpy as np
from ollama import Client as OllamaClient
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
import uuid

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(self):
        self.ollama_host = os.getenv("OLLAMA_HOST", "http://ollama-service:11434")
        self.qdrant_url = os.getenv("QDRANT_URL", "http://qdrant:6333")
        self.embedding_model = "nomic-embed-text"
        self.collection_name = "tasks"
        self.vector_size = 768  # nomic-embed-text dimension
        
        logger.info(f"Initializing EmbeddingService with Ollama at {self.ollama_host} and Qdrant at {self.qdrant_url}")
        
        try:
            self.ollama_client = OllamaClient(host=self.ollama_host)
            self.qdrant_client = QdrantClient(url=self.qdrant_url)
            
            # Test Ollama connection
            logger.info("Testing Ollama connection...")
            # Don't use the client's list method as it might be buggy
            import requests
            response = requests.get(f"{self.ollama_host}/api/tags", timeout=5)
            response.raise_for_status()
            logger.info(f"Ollama connection successful. Available models: {[m['name'] for m in response.json().get('models', [])]}")
            
            self._ensure_collection()
        except Exception as e:
            logger.error(f"Failed to initialize EmbeddingService: {str(e)}")
            raise
    
    def _ensure_collection(self):
        """Ensure the Qdrant collection exists with proper configuration."""
        try:
            logger.info(f"Checking for collection '{self.collection_name}' in Qdrant at {self.qdrant_url}")
            
            collections = self.qdrant_client.get_collections().collections
            collection_names = [col.name for col in collections]
            
            if self.collection_name not in collection_names:
                logger.info(f"Creating new collection '{self.collection_name}' in Qdrant at {self.qdrant_url}")
                
                self.qdrant_client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.vector_size,
                        distance=Distance.COSINE
                    )
                )
                logger.info(f"Successfully created Qdrant collection '{self.collection_name}' with vector size {self.vector_size}")
            else:
                logger.info(f"Qdrant collection '{self.collection_name}' already exists at {self.qdrant_url}")
        except Exception as e:
            logger.error(f"Error ensuring collection at Qdrant {self.qdrant_url}: {str(e)}")
            raise
    
    async def generate_embedding(self, text: str, max_retries: int = 3) -> List[float]:
        """Generate embedding for the given text using Ollama with retry logic."""
        import asyncio
        
        for attempt in range(max_retries):
            try:
                logger.info(f"Generating embedding using Ollama at {self.ollama_host} with model {self.embedding_model} (attempt {attempt + 1})")
                logger.debug(f"Text to embed (first 100 chars): {text[:100]}...")
                
                # Use requests directly instead of the Ollama client which might have issues
                import requests
                import json
                
                payload = {
                    "model": self.embedding_model,
                    "prompt": text
                }
                
                logger.debug(f"Sending embedding request to {self.ollama_host}/api/embeddings")
                
                response = requests.post(
                    f"{self.ollama_host}/api/embeddings",
                    json=payload,
                    timeout=30  # 30 second timeout
                )
                response.raise_for_status()
                
                result = response.json()
                embedding = result.get("embedding", [])
                
                if not embedding:
                    raise ValueError("No embedding returned from Ollama")
                
                logger.info(f"Successfully generated embedding with {len(embedding)} dimensions")
                return embedding
                
            except Exception as e:
                logger.warning(f"Embedding generation attempt {attempt + 1} failed: {str(e)}")
                
                if attempt < max_retries - 1:
                    # Wait with exponential backoff before retry
                    wait_time = (2 ** attempt) + 1  # 2, 5, 9 seconds
                    logger.info(f"Retrying in {wait_time} seconds...")
                    await asyncio.sleep(wait_time)  # Use async sleep
                else:
                    logger.error(f"All {max_retries} embedding generation attempts failed from Ollama at {self.ollama_host}: {str(e)}")
                    raise
    
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
            logger.info(f"Storing embedding in Qdrant at {self.qdrant_url}, collection: {self.collection_name}, point_id: {point_id}")
            
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
                        }
                    )
                ]
            )
            
            logger.info(f"Successfully stored embedding for task {task_id} in Qdrant")
            return point_id
            
        except Exception as e:
            logger.error(f"Error storing task embedding: {str(e)}")
            raise
    
    async def search_similar_tasks(self, query_text: str, limit: int = 5, filters: Optional[Dict] = None) -> List[Dict[str, Any]]:
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
                            match=MatchValue(value=filters["exercise_id"])
                        )
                    )
                if filters.get("priority"):
                    conditions.append(
                        FieldCondition(
                            key="priority",
                            match=MatchValue(value=filters["priority"])
                        )
                    )
                if filters.get("status"):
                    conditions.append(
                        FieldCondition(
                            key="status",
                            match=MatchValue(value=filters["status"])
                        )
                    )
                
                if conditions:
                    qdrant_filter = Filter(must=conditions)
            
            # Search in Qdrant
            logger.info(f"Performing vector search in Qdrant at {self.qdrant_url}, collection: {self.collection_name}")
            logger.debug(f"Search filters: {filters if filters else 'None'}")
            
            search_result = self.qdrant_client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                limit=limit,
                query_filter=qdrant_filter
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
    
    async def search_similar_by_task_id(self, task_id: int, limit: int = 5, exclude_self: bool = True, filters: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """Search for tasks similar to a given task ID."""
        try:
            # First, get the task's embedding from Qdrant
            search_result = self.qdrant_client.scroll(
                collection_name=self.collection_name,
                scroll_filter=Filter(
                    must=[
                        FieldCondition(
                            key="task_id",
                            match=MatchValue(value=task_id)
                        )
                    ]
                ),
                limit=1
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
                with_vectors=True  # Note: with_vectors (plural)
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
                            match=MatchValue(value=filters["exercise_id"])
                        )
                    )
                
                if conditions:
                    qdrant_filter = Filter(must=conditions)
            
            # Search for similar tasks
            similar_tasks = self.qdrant_client.search(
                collection_name=self.collection_name,
                query_vector=task_embedding,
                limit=limit + 1 if exclude_self else limit,
                query_filter=qdrant_filter
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
                    must=[
                        FieldCondition(
                            key="task_id",
                            match=MatchValue(value=task_id)
                        )
                    ]
                )
            )
            logger.info(f"Deleted embedding for task {task_id}")
        except Exception as e:
            logger.error(f"Error deleting task embedding: {str(e)}")
            raise

# Singleton instance
embedding_service = EmbeddingService()