from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    # Ollama Configuration
    ollama_host: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    model_name: str = os.getenv("MODEL_NAME", "gemma3:27b")
    
    # API Configuration
    api_host: str = os.getenv("API_HOST", "0.0.0.0")
    api_port: int = int(os.getenv("API_PORT", "8001"))
    
    # Backend API
    backend_api_url: str = os.getenv("BACKEND_API_URL", "http://taskflow-api:8000")
    
    # Processing Configuration
    timeout_seconds: int = 60
    max_retries: int = 2
    
    # Observability
    prometheus_port: int = 9091
    
    class Config:
        env_file = ".env"

settings = Settings()