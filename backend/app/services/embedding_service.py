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
        self.ollama_host = os.getenv("OLLAMA_HOST", "http://ollama:11434")
        self.qdrant_url = os.getenv("QDRANT_URL", "http://qdrant:6333")
        self.embedding_model = "nomic-embed-text"
        self.collection_name = "tasks"
        self.vector_size = 768  # nomic-embed-text dimension
        
        logger.info(f"Initializing EmbeddingService with Ollama at {self.ollama_host} and Qdrant at {self.qdrant_url}")
        
        self.ollama_client = OllamaClient(host=self.ollama_host)
        self.qdrant_client = QdrantClient(url=self.qdrant_url)
        
        self._ensure_collection()
    
    def _ensure_collection(self):
        """Ensure the Qdrant collection exists with proper configuration."""
        try:
            collections = self.qdrant_client.get_collections().collections
            collection_names = [col.name for col in collections]
            
            if self.collection_name not in collection_names:
                self.qdrant_client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.vector_size,
                        distance=Distance.COSINE
                    )
                )
                logger.info(f"Created Qdrant collection: {self.collection_name}")
            else:
                logger.info(f"Qdrant collection already exists: {self.collection_name}")
        except Exception as e:
            logger.error(f"Error ensuring collection: {str(e)}")
            raise
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for the given text using Ollama."""
        try:
            response = self.ollama_client.embeddings(
                model=self.embedding_model,
                prompt=text
            )
            return response["embedding"]
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
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
            
            logger.info(f"Stored embedding for task {task_id}")
            return point_id
            
        except Exception as e:
            logger.error(f"Error storing task embedding: {str(e)}")
            raise
    
    async def search_similar_tasks(self, query_text: str, limit: int = 5, filters: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """Search for similar tasks based on query text."""
        try:
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
            search_result = self.qdrant_client.search(
                collection_name=self.collection_name,
                query_vector=query_embedding,
                limit=limit,
                query_filter=qdrant_filter
            )
            
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