"""
Configuration API router
Provides configuration data to the frontend
"""

from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from ..config_loader import get_config_loader

router = APIRouter(prefix="/api/config", tags=["configuration"])


@router.get("/ui-labels")
async def get_ui_labels() -> Dict[str, Any]:
    """Get UI labels configuration."""
    try:
        config_loader = get_config_loader()
        return config_loader.get_ui_labels()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading UI labels: {str(e)}")


@router.get("/terminology")
async def get_terminology() -> Dict[str, str]:
    """Get terminology configuration."""
    try:
        config_loader = get_config_loader()
        return config_loader.get_terminology()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading terminology: {str(e)}")


@router.get("/app-info")
async def get_app_info() -> Dict[str, str]:
    """Get application information."""
    try:
        config_loader = get_config_loader()
        return {
            "name": config_loader.get_app_name(),
            "title": config_loader.get_app_title(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading app info: {str(e)}")


@router.get("/dashboard")
async def get_dashboard_config() -> Dict[str, Any]:
    """Get dashboard configuration."""
    try:
        config_loader = get_config_loader()
        return config_loader.get_dashboard_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading dashboard config: {str(e)}")


@router.get("/workflow")
async def get_workflow_config() -> Dict[str, Any]:
    """Get workflow configuration."""
    try:
        config_loader = get_config_loader()
        return config_loader.get_workflow_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading workflow config: {str(e)}")


@router.post("/refresh")
async def refresh_config() -> Dict[str, str]:
    """Refresh configuration from files."""
    try:
        config_loader = get_config_loader()
        config_loader.refresh_config()
        return {"status": "success", "message": "Configuration refreshed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error refreshing config: {str(e)}")


@router.get("/domain")
async def get_domain_config() -> Dict[str, Any]:
    """Get domain configuration."""
    try:
        config_loader = get_config_loader()
        return config_loader.get_domain_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading domain config: {str(e)}")


@router.get("/security")
async def get_security_config() -> Dict[str, Any]:
    """Get security configuration (public safe values only)."""
    try:
        config_loader = get_config_loader()
        security_config = config_loader.get_security_config()

        # Only return public-safe security settings
        return {
            "access_control": security_config.get("access_control", {}),
            "privacy": {
                "mask_sensitive_data": security_config.get("privacy", {}).get(
                    "mask_sensitive_data", True
                ),
                "audit_trail": security_config.get("privacy", {}).get("audit_trail", True),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading security config: {str(e)}")
