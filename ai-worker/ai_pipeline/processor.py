import json
import asyncio
from typing import Dict, Any, Optional
import ollama
import structlog
from config import settings
from domain_config.domain_config import get_domain_config

logger = structlog.get_logger()

class AIProcessor:
    def __init__(self):
        self.client = ollama.AsyncClient(host=settings.ollama_host)
        self.model = settings.model_name
        self.domain_config = get_domain_config()
        
    async def _call_ollama(self, prompt: str, custom_instructions: str = "") -> Dict[str, Any]:
        """Make a call to Ollama with retry logic"""
        full_prompt = prompt
        if custom_instructions:
            full_prompt = f"{prompt}\n\nAdditional Instructions: {custom_instructions}"
            
        for attempt in range(settings.max_retries + 1):
            try:
                response = await self.client.chat(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": self.domain_config.get_system_prompt()},
                        {"role": "user", "content": full_prompt}
                    ],
                    format='json',
                    options={
                        "temperature": 0.1,
                        "top_p": 0.9,
                        "stop": ["<|endoftext|>"]
                    }
                )
                
                # Parse JSON response
                result = json.loads(response['message']['content'])
                
                # Add metadata
                result['_metadata'] = {
                    'model': self.model,
                    'tokens_used': response.get('eval_count', 0) + response.get('prompt_eval_count', 0),
                    'duration_ms': response.get('total_duration', 0) // 1000000  # Convert to ms
                }
                
                return result
                
            except json.JSONDecodeError as e:
                logger.error("Invalid JSON response from Ollama", attempt=attempt, error=str(e))
                if attempt == settings.max_retries:
                    raise Exception(f"Failed to get valid JSON after {settings.max_retries + 1} attempts")
                    
            except Exception as e:
                logger.error("Ollama API call failed", attempt=attempt, error=str(e))
                if attempt == settings.max_retries:
                    raise
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
    
    async def extract_basic_metadata(self, request_text: str) -> Dict[str, Any]:
        """Extract basic metadata from request"""
        prompt_template = self.domain_config.get_prompt_template('extract_metadata')
        prompt = prompt_template.format(request_text=request_text)
        return await self._call_ollama(prompt)
    
    async def classify_topic(self, request_text: str) -> Dict[str, Any]:
        """Classify the topic of the request"""
        prompt_template = self.domain_config.get_prompt_template('classify_topic')
        prompt = prompt_template.format(request_text=request_text)
        return await self._call_ollama(prompt)
    
    async def summarize_request(self, request_text: str, custom_instructions: str = "") -> Dict[str, Any]:
        """Summarize the request"""
        prompt_template = self.domain_config.get_prompt_template('summarize_request')
        prompt = prompt_template.format(
            request_text=request_text,
            custom_instructions=custom_instructions or ""
        )
        return await self._call_ollama(prompt, custom_instructions)
    
    async def assess_sensitivity(self, request_text: str, topic_info: Dict[str, Any]) -> Dict[str, Any]:
        """Assess sensitivity score based on topic classification"""
        prompt_template = self.domain_config.get_prompt_template('sensitivity_score')
        prompt = prompt_template.format(
            request_text=request_text,
            topic_info=json.dumps(topic_info, indent=2)
        )
        return await self._call_ollama(prompt)
    
    async def suggest_redactions(
        self, 
        request_text: str, 
        summary: Dict[str, Any],
        sensitivity_score: float,
        topic: str,
        custom_instructions: str = ""
    ) -> Dict[str, Any]:
        """Suggest potential redactions"""
        prompt_template = self.domain_config.get_prompt_template('suggest_redactions')
        prompt = prompt_template.format(
            request_text=request_text,
            summary=json.dumps(summary, indent=2),
            sensitivity_score=sensitivity_score,
            topic=topic,
            custom_instructions=custom_instructions or ""
        )
        return await self._call_ollama(prompt, custom_instructions)
    
    async def process_standard_pipeline(self, request_text: str) -> Dict[str, Any]:
        """Run the standard AI processing pipeline"""
        logger.info("Starting standard AI pipeline")
        
        try:
            # Step 1: Extract basic metadata
            logger.info("Step 1: Extracting basic metadata")
            metadata = await self.extract_basic_metadata(request_text)
            
            # Step 2: Classify topic
            logger.info("Step 2: Classifying topic")
            topic_classification = await self.classify_topic(request_text)
            
            # Step 3: Summarize request
            logger.info("Step 3: Summarizing request")
            summary = await self.summarize_request(request_text)
            
            # Step 4: Assess sensitivity
            logger.info("Step 4: Assessing sensitivity")
            sensitivity = await self.assess_sensitivity(request_text, topic_classification)
            
            # Step 5: Suggest redactions
            logger.info("Step 5: Suggesting redactions")
            redactions = await self.suggest_redactions(
                request_text=request_text,
                summary=summary,
                sensitivity_score=sensitivity.get('score', 0.5),
                topic=topic_classification.get('primary_topic', 'Unknown')
            )
            
            result = {
                "basic_metadata": metadata,
                "topic_classification": topic_classification,
                "summary": summary,
                "sensitivity_assessment": sensitivity,
                "redaction_suggestions": redactions.get('redaction_suggestions', [])
            }
            
            logger.info("Standard AI pipeline completed successfully")
            return result
            
        except Exception as e:
            logger.error("Standard AI pipeline failed", error=str(e))
            raise
    
    async def process_custom_pipeline(self, request_text: str, custom_instructions: str) -> Dict[str, Any]:
        """Run the custom AI processing pipeline with user instructions"""
        logger.info("Starting custom AI pipeline", instructions_length=len(custom_instructions))
        
        try:
            # Step 1: Extract basic metadata (no custom instructions)
            logger.info("Step 1: Extracting basic metadata")
            metadata = await self.extract_basic_metadata(request_text)
            
            # Step 2: Classify topic (no custom instructions)
            logger.info("Step 2: Classifying topic")
            topic_classification = await self.classify_topic(request_text)
            
            # Step 3: Summarize request (with custom instructions)
            logger.info("Step 3: Summarizing request with custom instructions")
            summary = await self.summarize_request(request_text, custom_instructions)
            
            # Step 4: Assess sensitivity (no custom instructions)
            logger.info("Step 4: Assessing sensitivity")
            sensitivity = await self.assess_sensitivity(request_text, topic_classification)
            
            # Step 5: Suggest redactions (with custom instructions)
            logger.info("Step 5: Suggesting redactions with custom instructions")
            redactions = await self.suggest_redactions(
                request_text=request_text,
                summary=summary,
                sensitivity_score=sensitivity.get('score', 0.5),
                topic=topic_classification.get('primary_topic', 'Unknown'),
                custom_instructions=custom_instructions
            )
            
            result = {
                "basic_metadata": metadata,
                "topic_classification": topic_classification,
                "summary": summary,
                "sensitivity_assessment": sensitivity,
                "redaction_suggestions": redactions.get('redaction_suggestions', []),
                "custom_instructions": custom_instructions
            }
            
            logger.info("Custom AI pipeline completed successfully")
            return result
            
        except Exception as e:
            logger.error("Custom AI pipeline failed", error=str(e))
            raise