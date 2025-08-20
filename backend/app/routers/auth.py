"""
Simple authentication system for development/demo purposes.
In production, this should be replaced with proper authentication.
"""

from datetime import datetime

# Unused imports removed

from app.models.pydantic_models import User, UserRole


# Mock user for development - replace with proper auth in production
def get_current_user() -> User:
    """Get the current authenticated user. Returns a mock admin user for development."""
    return User(
        id=1,
        name="Admin User",
        email="admin@example.com",
        role=UserRole.ADMIN,
        created_at=datetime.now(),
    )
