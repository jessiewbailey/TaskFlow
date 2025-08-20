"""
Common dependencies for FastAPI routes
"""

from app.routers.auth import get_current_user

__all__ = ["get_current_user"]
