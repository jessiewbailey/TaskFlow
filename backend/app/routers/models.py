from fastapi import APIRouter
import httpx
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/models", tags=["models"])

@router.get("/ollama")
async def get_available_models():
    """Get available models from Ollama"""
    import os
    try:
        ollama_host = os.getenv("OLLAMA_HOST", "http://ollama-service:11434")
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ollama_host}/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = []
                for model in data.get("models", []):
                    models.append({
                        "name": model["name"],
                        "size": model.get("size", 0),
                        "modified_at": model.get("modified_at"),
                        "digest": model.get("digest"),
                        "details": model.get("details", {})
                    })
                return {"models": models, "total": len(models)}
            else:
                return {"models": [], "total": 0, "error": "Failed to fetch models from Ollama"}
    except Exception as e:
        logger.error("Error fetching Ollama models", error=str(e))
        return {"models": [], "total": 0, "error": str(e)}