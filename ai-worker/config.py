from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Ollama Configuration
    ollama_host: str = "http://localhost:11434"
    model_name: str = "gemma3:27b"
    
    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8001
    
    # Backend API
    backend_api_url: str = "http://taskflow-api:8000"
    
    # Processing Configuration
    timeout_seconds: int = 60
    max_retries: int = 2
    
    # Observability
    prometheus_port: int = 9091
    
    class Config:
        env_file = ".env"

settings = Settings()