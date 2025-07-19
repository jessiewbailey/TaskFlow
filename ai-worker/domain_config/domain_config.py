"""
Domain-agnostic configuration for prompt templates and terminology.
This allows the system to be adapted for different use cases without code changes.
"""

import json
import os
import yaml
from typing import Dict, List, Any, Optional
from pathlib import Path

class DomainConfig:
    """Manages domain-specific configuration for prompts and terminology."""
    
    def __init__(self, config_path: Optional[str] = None):
        # Check for new YAML config first, fallback to old JSON
        yaml_config_path = "/app/config/domain-config.yaml"
        if os.path.exists(yaml_config_path):
            self.config_path = yaml_config_path
            self.config_type = "yaml"
        else:
            self.config_path = config_path or os.path.join(
                Path(__file__).parent, "domain_settings.json"
            )
            self.config_type = "json"
        self._config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file or create default."""
        try:
            with open(self.config_path, 'r') as f:
                if self.config_type == "yaml":
                    config = yaml.safe_load(f)
                    # Convert YAML structure to expected format
                    return self._convert_yaml_to_config(config)
                else:
                    return json.load(f)
        except FileNotFoundError:
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Default configuration with generic terminology."""
        return {
            "domain": {
                "name": "Document Request Processing",
                "description": "Generic document request analysis system"
            },
            "terminology": {
                "request_type": "document request",
                "requester": "requester", 
                "analyst": "analyst",
                "processing": "analysis"
            },
            "prompts": {
                "system": {
                    "role": "AI assistant specialized in analyzing document requests",
                    "purpose": "help analysts process requests efficiently and accurately",
                    "guidelines": "follow strict guidelines for handling sensitive information and protecting privacy",
                    "format": "Always respond with valid JSON in the exact format requested. Be thorough but concise in your analysis."
                },
                "extract_metadata": {
                    "task": "Analyze this {request_type} and extract basic metadata",
                    "input_label": "Request Text",
                    "considerations": "Consider factors like complexity, scope, and legal requirements when estimating processing time.",
                    "output_schema": {
                        "word_count": "number",
                        "estimated_processing_time": "minutes", 
                        "document_type": "string describing the type of request",
                        "urgency_level": "LOW|MEDIUM|HIGH"
                    }
                },
                "classify_topic": {
                    "task": "Classify the topic and subject matter of this {request_type}",
                    "input_label": "Request Text",
                    "examples": "Law Enforcement, Healthcare, Financial, Environmental, Legal, Administrative, etc.",
                    "output_schema": {
                        "primary_topic": "main subject area",
                        "secondary_topics": ["topic1", "topic2"],
                        "confidence_score": "float between 0.0 and 1.0"
                    }
                },
                "summarize_request": {
                    "task": "Create a comprehensive summary of this {request_type}",
                    "input_label": "Request Text", 
                    "focus": "what specific records or information the requester is seeking",
                    "output_schema": {
                        "executive_summary": "2-3 sentence overview",
                        "key_points": ["point1", "point2", "point3"],
                        "requested_records": ["record type 1", "record type 2"]
                    }
                },
                "sensitivity_score": {
                    "task": "Assess the sensitivity level of this {request_type} based on the topic classification",
                    "input_label": "Request Text",
                    "factors": "privacy implications, security considerations, confidentiality concerns, etc.",
                    "output_schema": {
                        "score": "float between 0.0 and 1.0",
                        "risk_factors": ["factor1", "factor2"], 
                        "explanation": "brief explanation of the score"
                    }
                },
                "suggest_redactions": {
                    "task": "Analyze this {request_type} and suggest potential redactions based on common exemptions",
                    "input_label": "Request Text",
                    "exemption_categories": [
                        "Privacy protection",
                        "Security considerations", 
                        "Internal procedures",
                        "Statutory exemptions",
                        "Trade secrets",
                        "Deliberative process",
                        "Confidential information"
                    ],
                    "output_schema": {
                        "redaction_suggestions": [{
                            "text_span": "exact text that might need redaction",
                            "start_pos": "character position",
                            "end_pos": "character position", 
                            "reason": "explanation",
                            "exemption_category": "category from exemption_categories",
                            "confidence": "float between 0.0 and 1.0"
                        }]
                    }
                }
            }
        }
    
    def get_system_prompt(self) -> str:
        """Generate the system prompt from configuration."""
        system_config = self._config["prompts"]["system"]
        return f"""You are an {system_config["role"]}. 
Your role is to {system_config["purpose"]}. 
You must {system_config["guidelines"]}.

{system_config["format"]}"""
    
    def get_prompt_template(self, prompt_type: str) -> str:
        """Get a formatted prompt template for the given type."""
        if prompt_type not in self._config["prompts"]:
            raise ValueError(f"Unknown prompt type: {prompt_type}")
        
        prompt_config = self._config["prompts"][prompt_type]
        terminology = self._config["terminology"]
        
        # Build the prompt template
        template_parts = []
        
        # Task description
        task = prompt_config["task"].format(**terminology)
        template_parts.append(f"{task}:")
        template_parts.append("")
        
        # Input section
        input_label = prompt_config["input_label"]
        template_parts.append(f"{input_label}:")
        template_parts.append("{request_text}")
        template_parts.append("")
        
        # Custom instructions placeholder (if applicable)
        if prompt_type in ["summarize_request", "suggest_redactions"]:
            template_parts.append("{custom_instructions}")
            template_parts.append("")
        
        # Topic info placeholder (for sensitivity scoring)
        if prompt_type == "sensitivity_score":
            template_parts.append("Topic Classification:")
            template_parts.append("{topic_info}")
            template_parts.append("")
        
        # Previous analysis placeholder (for redactions)
        if prompt_type == "suggest_redactions":
            template_parts.append("Previous Analysis:")
            template_parts.append("- Summary: {summary}")
            template_parts.append("- Sensitivity Score: {sensitivity_score}")
            template_parts.append("- Topic: {topic}")
            template_parts.append("")
        
        # Output format
        template_parts.append("Provide a JSON response with this structure:")
        schema = prompt_config["output_schema"]
        # Escape braces to prevent format string issues
        schema_json = json.dumps(schema, indent=4)
        escaped_schema = schema_json.replace("{", "{{").replace("}", "}}")
        template_parts.append(escaped_schema)
        template_parts.append("")
        
        # Additional context/examples
        if "considerations" in prompt_config:
            template_parts.append(prompt_config["considerations"])
        elif "examples" in prompt_config:
            template_parts.append(f"Common topics include: {prompt_config['examples']}")
        elif "focus" in prompt_config:
            template_parts.append(f"Focus on {prompt_config['focus']}.")
        elif "factors" in prompt_config:
            template_parts.append(f"Consider factors like {prompt_config['factors']}")
        elif "exemption_categories" in prompt_config:
            categories = prompt_config["exemption_categories"] 
            template_parts.append("Common exemption categories:")
            for category in categories:
                template_parts.append(f"- {category}")
        
        return "\n".join(template_parts)
    
    def update_config(self, new_config: Dict[str, Any]) -> None:
        """Update configuration and save to file."""
        self._config.update(new_config)
        self._save_config()
    
    def _save_config(self) -> None:
        """Save current configuration to file."""
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        with open(self.config_path, 'w') as f:
            json.dump(self._config, f, indent=2)
    
    def get_config(self) -> Dict[str, Any]:
        """Get the full configuration."""
        return self._config.copy()
    
    def get_terminology(self) -> Dict[str, str]:
        """Get domain-specific terminology."""
        return self._config["terminology"].copy()
    
    def _convert_yaml_to_config(self, yaml_config: Dict[str, Any]) -> Dict[str, Any]:
        """Convert YAML config structure to expected format."""
        config = self._get_default_config()
        
        # Map YAML structure to expected format
        if "domain" in yaml_config:
            config["domain"] = yaml_config["domain"]
        
        if "terminology" in yaml_config:
            config["terminology"].update(yaml_config["terminology"])
        
        if "ai_processing" in yaml_config:
            ai_config = yaml_config["ai_processing"]
            if "prompt_templates" in ai_config:
                templates = ai_config["prompt_templates"]
                if "system_role" in templates:
                    config["prompts"]["system"]["role"] = templates["system_role"]
                if "system_purpose" in templates:
                    config["prompts"]["system"]["purpose"] = templates["system_purpose"]
                if "system_guidelines" in templates:
                    config["prompts"]["system"]["guidelines"] = templates["system_guidelines"]
                if "system_format" in templates:
                    config["prompts"]["system"]["format"] = templates["system_format"]
        
        return config

# Global instance
_domain_config = None

def get_domain_config() -> DomainConfig:
    """Get the global domain configuration instance."""
    global _domain_config
    if _domain_config is None:
        _domain_config = DomainConfig()
    return _domain_config