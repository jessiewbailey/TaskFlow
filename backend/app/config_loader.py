"""
Configuration loader for TaskFlow
Loads configuration from YAML files in the config directory
"""

import os
from pathlib import Path
from typing import Any, Dict, Optional

import yaml


class ConfigLoader:
    """Loads and manages TaskFlow configuration from YAML files."""

    def __init__(self, config_dir: str = "/app/config"):
        self.config_dir = Path(config_dir)
        self._ui_labels: Optional[Dict[str, Any]] = None
        self._domain_config: Optional[Dict[str, Any]] = None

    def get_ui_labels(self) -> Dict[str, Any]:
        """Load UI labels configuration."""
        if self._ui_labels is None:
            labels_file = self.config_dir / "ui-labels" / "labels.yaml"
            if labels_file.exists():
                with open(labels_file, "r") as f:
                    loaded_config = yaml.safe_load(f)
                    self._ui_labels = loaded_config if loaded_config is not None else {}
            else:
                self._ui_labels = self._get_default_ui_labels()
        return self._ui_labels

    def get_domain_config(self) -> Dict[str, Any]:
        """Load domain configuration."""
        if self._domain_config is None:
            config_file = self.config_dir / "domain-config.yaml"
            if config_file.exists():
                with open(config_file, "r") as f:
                    loaded_config = yaml.safe_load(f)
                    self._domain_config = loaded_config if loaded_config is not None else {}
            else:
                self._domain_config = self._get_default_domain_config()
        return self._domain_config

    def get_terminology(self) -> Dict[str, str]:
        """Get terminology from UI labels."""
        ui_labels = self.get_ui_labels()
        return ui_labels.get("terminology", {})

    def get_app_title(self) -> str:
        """Get application title."""
        ui_labels = self.get_ui_labels()
        return ui_labels.get("app", {}).get("title", "TaskFlow")

    def get_app_name(self) -> str:
        """Get application name."""
        ui_labels = self.get_ui_labels()
        return ui_labels.get("app", {}).get("name", "TaskFlow")

    def get_dashboard_config(self) -> Dict[str, Any]:
        """Get dashboard configuration."""
        domain_config = self.get_domain_config()
        return domain_config.get("dashboard", {})

    def get_workflow_config(self) -> Dict[str, Any]:
        """Get workflow configuration."""
        domain_config = self.get_domain_config()
        return domain_config.get("workflows", {})

    def get_ai_config(self) -> Dict[str, Any]:
        """Get AI processing configuration."""
        domain_config = self.get_domain_config()
        return domain_config.get("ai_processing", {})

    def get_security_config(self) -> Dict[str, Any]:
        """Get security configuration."""
        domain_config = self.get_domain_config()
        return domain_config.get("security", {})

    def _get_default_ui_labels(self) -> Dict[str, Any]:
        """Default UI labels fallback."""
        return {
            "app": {"name": "TaskFlow", "title": "Task Processing System"},
            "terminology": {
                "task": "Task",
                "tasks": "Tasks",
                "requester": "Requester",
                "analyst": "Analyst",
                "new_task": "New Task",
            },
            "dashboard": {"title": "Dashboard"},
        }

    def _get_default_domain_config(self) -> Dict[str, Any]:
        """Default domain configuration fallback."""
        return {
            "domain": {
                "name": "Generic Task Processing System",
                "description": "Configurable task processing system",
            },
            "terminology": {
                "request_type": "task request",
                "requester": "requester",
                "analyst": "analyst",
            },
            "workflows": {"default_workflow_id": 1, "auto_assign": True},
            "dashboard": {"refresh_interval": 30, "max_recent_items": 10},
            "ai_processing": {"model": {"name": "gpt-3.5-turbo", "temperature": 0.1}},
        }

    def refresh_config(self):
        """Reload configuration from files."""
        self._ui_labels = None
        self._domain_config = None


# Global configuration instance
_config_loader = None


def get_config_loader() -> ConfigLoader:
    """Get the global configuration loader instance."""
    global _config_loader
    if _config_loader is None:
        # Try to detect config directory
        config_dir = "/app/config"
        if not os.path.exists(config_dir):
            # Fallback for development
            config_dir = os.path.join(os.path.dirname(__file__), "..", "..", "config")
        _config_loader = ConfigLoader(config_dir)
    return _config_loader
