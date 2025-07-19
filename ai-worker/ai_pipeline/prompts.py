"""
DEPRECATED: This file has been replaced by the configurable prompt system.

All prompts are now managed through:
- config/domain_config.py - Configuration management 
- config/domain_settings.json - Actual prompt definitions

The new system allows:
- Domain-agnostic prompts
- Runtime configuration updates
- UI-based prompt editing
- Consistent terminology management

To use prompts, import from config.domain_config instead:
    from config.domain_config import get_domain_config
    config = get_domain_config()
    config.get_system_prompt()
    config.get_prompt_template('extract_metadata')
"""

# Legacy constants for backward compatibility (if needed)
# These should not be used - import from domain_config instead
SYSTEM_PROMPT = "DEPRECATED - Use get_domain_config().get_system_prompt()"
EXTRACT_METADATA_PROMPT = "DEPRECATED - Use get_domain_config().get_prompt_template('extract_metadata')"
CLASSIFY_TOPIC_PROMPT = "DEPRECATED - Use get_domain_config().get_prompt_template('classify_topic')" 
SUMMARIZE_REQUEST_PROMPT = "DEPRECATED - Use get_domain_config().get_prompt_template('summarize_request')"
SENSITIVITY_SCORE_PROMPT = "DEPRECATED - Use get_domain_config().get_prompt_template('sensitivity_score')"
SUGGEST_REDACTIONS_PROMPT = "DEPRECATED - Use get_domain_config().get_prompt_template('suggest_redactions')"