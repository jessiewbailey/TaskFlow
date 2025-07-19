import json
import asyncio
from typing import Dict, Any, List, Optional
import ollama
import structlog
import httpx
from config import settings

logger = structlog.get_logger()

class WorkflowProcessor:
    def __init__(self):
        self.client = ollama.AsyncClient(host=settings.ollama_host)
        self.default_model = settings.model_name
        
    async def execute_workflow(self, workflow_id: int, request_text: str, request_id: int = None) -> Dict[str, Any]:
        """Execute a workflow by processing its blocks in order"""
        logger.info("Starting workflow execution", workflow_id=workflow_id, request_id=request_id)
        
        try:
            # Get workflow and blocks from backend
            workflow_data = await self._get_workflow(workflow_id)
            blocks = sorted(workflow_data['blocks'], key=lambda x: x['order'])
            
            # Get custom instructions if request_id is provided
            custom_instructions_map = {}
            if request_id:
                custom_instructions_map = await self._get_custom_instructions(request_id)
                logger.info("Custom instructions retrieved", 
                           request_id=request_id,
                           custom_instructions_map=custom_instructions_map)
            
            logger.info("Retrieved workflow", 
                       workflow_id=workflow_id, 
                       name=workflow_data['name'],
                       num_blocks=len(blocks),
                       custom_instructions_count=len(custom_instructions_map))
            
            # Initialize context with request text
            context = {'request_text': request_text}
            results = {}
            
            # Create a mapping from block ID to block name for input resolution
            block_id_to_name = {block['id']: block['name'] for block in blocks}
            
            # Execute each block in order
            for block in blocks:
                block_name = block['name']
                logger.info("Executing block", block_name=block_name, order=block['order'])
                
                try:
                    # Process block inputs to prepare context variables
                    block_context = await self._prepare_block_context(block, context, block_id_to_name)
                    
                    # Prepare prompt with context variables
                    prompt = self._prepare_prompt(block['prompt'], block_context)
                    
                    # Debug: Log the actual prompt being sent
                    logger.info("Prepared prompt for block", 
                              block_name=block_name, 
                              prompt=prompt[:200], 
                              block_context_keys=list(block_context.keys()),
                              block_inputs=len(block.get('inputs', [])))
                    
                    # Get model for this block (use block's model_name or default)
                    model_name = block.get('model_name') or self.default_model
                    
                    # Get custom instructions for this block
                    block_custom_instructions = custom_instructions_map.get(block['id'], "")
                    logger.info("Processing block with custom instructions",
                               block_name=block_name,
                               block_id=block['id'],
                               has_custom_instructions=bool(block_custom_instructions),
                               custom_instructions=block_custom_instructions)
                    
                    # Execute the block
                    result = await self._execute_block(prompt, block_name, model_name, block.get('output_schema'), block_custom_instructions)
                    
                    # Store result in context for future blocks
                    context[block_name.lower().replace(' ', '_')] = result
                    results[block_name] = result
                    
                    # Also add common aliases for backward compatibility
                    if 'metadata' in block_name.lower():
                        context['basic_metadata'] = result
                    elif 'topic' in block_name.lower():
                        context['topic_classification'] = result
                        context['topic_info'] = json.dumps(result, indent=2)
                        if 'primary_topic' in result:
                            context['topic'] = result['primary_topic']
                    elif 'summary' in block_name.lower() or 'summarize' in block_name.lower():
                        context['summary'] = json.dumps(result, indent=2)
                    elif 'sensitivity' in block_name.lower():
                        context['sensitivity_assessment'] = result
                        if 'score' in result:
                            context['sensitivity_score'] = result['score']
                    elif 'action' in block_name.lower() or 'suggest' in block_name.lower():
                        context['redaction_suggestions'] = result.get('redaction_suggestions', [])
                    
                    logger.info("Block completed successfully", 
                               block_name=block_name,
                               result_keys=list(result.keys()) if isinstance(result, dict) else 'non-dict')
                    
                except Exception as e:
                    logger.error("Block execution failed", 
                                block_name=block_name, 
                                error=str(e))
                    # Continue with other blocks, but mark this one as failed
                    results[block_name] = {
                        "error": str(e),
                        "status": "failed"
                    }
            
            logger.info("Workflow execution completed", 
                       workflow_id=workflow_id,
                       num_results=len(results))
            
            return results
            
        except Exception as e:
            logger.error("Workflow execution failed", 
                        workflow_id=workflow_id, 
                        error=str(e))
            raise
    
    async def _get_workflow(self, workflow_id: int) -> Dict[str, Any]:
        """Get workflow configuration from backend API"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{settings.backend_api_url}/api/workflows/{workflow_id}"
            )
            response.raise_for_status()
            return response.json()
    
    def _prepare_prompt(self, prompt_template: str, context: Dict[str, Any]) -> str:
        """Prepare prompt by substituting variables from context"""
        try:
            return prompt_template.format(**context)
        except KeyError as e:
            logger.warning("Missing context variable in prompt", 
                          variable=str(e), 
                          available_keys=list(context.keys()))
            # Return template as-is if variable substitution fails
            return prompt_template
    
    async def _execute_block(self, prompt: str, block_name: str, model_name: str, output_schema: Dict[str, Any] = None, custom_instructions: str = "") -> Dict[str, Any]:
        """Execute a single workflow block"""
        # Enhance prompt with JSON format instructions and schema
        schema_instruction = ""
        if output_schema:
            # Create an example based on the schema to make it clearer
            example = self._create_schema_example(output_schema)
            schema_instruction = f"\n\nYour response must be a JSON object with this structure:\n{example}\n\nDo not return the schema itself - return actual data values that match this structure."
        
        # Add custom instructions if provided
        custom_instruction_text = ""
        if custom_instructions:
            custom_instruction_text = f"\n\nADDITIONAL CUSTOM INSTRUCTIONS:\n{custom_instructions}\n\nPlease incorporate these additional instructions into your analysis while maintaining the required JSON output format."
        
        enhanced_prompt = f"""{prompt}{schema_instruction}{custom_instruction_text}

IMPORTANT: You must respond with valid JSON only containing actual data values (not schema definitions). Do not include any markdown formatting, code blocks, or additional text. Your response should be a single JSON object with the actual content."""

        # Log the full prompt being sent
        print(f"=== FULL PROMPT FOR {block_name} ===")
        print(enhanced_prompt)
        print(f"=== END PROMPT FOR {block_name} ===")

        for attempt in range(settings.max_retries + 1):
            try:
                response = await self.client.chat(
                    model=model_name,
                    messages=[
                        {"role": "user", "content": enhanced_prompt}
                    ],
                    format='json',
                    options={
                        "temperature": 0.1,
                        "top_p": 0.9,
                        "stop": ["<|endoftext|>"]
                    }
                )
                
                # Log the raw LLM response
                raw_response = response['message']['content']
                print(f"=== RAW LLM RESPONSE FOR {block_name} ===")
                print(raw_response)
                print(f"=== END LLM RESPONSE FOR {block_name} ===")
                
                result = self._extract_json_from_response(raw_response)
                print(f"=== PARSED JSON FOR {block_name} ===")
                print(json.dumps(result, indent=2))
                print(f"=== END PARSED JSON FOR {block_name} ===")
                
                # Add metadata
                result['_metadata'] = {
                    'model': model_name,
                    'block_name': block_name,
                    'tokens_used': response.get('eval_count', 0) + response.get('prompt_eval_count', 0),
                    'duration_ms': response.get('total_duration', 0) // 1000000  # Convert to ms
                }
                
                return result
                
            except json.JSONDecodeError as e:
                logger.error("Invalid JSON response from Ollama", 
                            attempt=attempt, 
                            block_name=block_name,
                            error=str(e),
                            raw_response=content[:500])
                if attempt == settings.max_retries:
                    raise Exception(f"Failed to get valid JSON from block '{block_name}' after {settings.max_retries + 1} attempts")
                    
            except Exception as e:
                logger.error("Block execution failed", 
                            attempt=attempt, 
                            block_name=block_name,
                            error=str(e))
                if attempt == settings.max_retries:
                    raise
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
    
    def _extract_json_from_response(self, content: str) -> Dict[str, Any]:
        """Extract JSON from response content, handling markdown code blocks"""
        content = content.strip()
        
        # First try to parse as direct JSON
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        
        # Look for JSON in markdown code blocks
        if '```json' in content:
            # Extract content between ```json and ```
            start = content.find('```json') + 7
            end = content.find('```', start)
            if end != -1:
                json_content = content[start:end].strip()
                try:
                    return json.loads(json_content)
                except json.JSONDecodeError:
                    pass
        
        # Look for JSON in any code blocks
        if '```' in content:
            # Extract content between first ``` and next ```
            parts = content.split('```')
            if len(parts) >= 3:
                json_content = parts[1].strip()
                # Remove language identifier if present
                if json_content.startswith('json\n'):
                    json_content = json_content[5:]
                try:
                    return json.loads(json_content)
                except json.JSONDecodeError:
                    pass
        
        # Try to find JSON-like content with braces
        if '{' in content and '}' in content:
            start = content.find('{')
            end = content.rfind('}') + 1
            if start < end:
                json_content = content[start:end]
                try:
                    return json.loads(json_content)
                except json.JSONDecodeError:
                    pass
        
        # If all else fails, raise the original error
        raise json.JSONDecodeError(f"No valid JSON found in response: {content[:200]}...", content, 0)
    
    async def _prepare_block_context(self, block: Dict[str, Any], global_context: Dict[str, Any], block_id_to_name: Dict[int, str]) -> Dict[str, Any]:
        """Prepare context for a specific block based on its input configuration"""
        block_context = global_context.copy()
        
        # Process each input defined for this block
        for block_input in block.get('inputs', []):
            variable_name = block_input['variable_name']
            input_type = block_input['input_type']
            
            if input_type == 'REQUEST_TEXT':
                # Map request text to the specified variable name
                block_context[variable_name] = global_context.get('request_text', '')
                
            elif input_type == 'BLOCK_OUTPUT':
                # Get output from a previous block
                source_block_id = block_input.get('source_block_id')
                if source_block_id is not None:
                    # Find the source block name by its ID
                    source_block_name = block_id_to_name.get(source_block_id)
                    if source_block_name:
                        # Try to find the block output in context
                        # First try the exact name
                        source_key = source_block_name
                        if source_key not in global_context:
                            # Try lowercase with underscores (how we store it)
                            source_key = source_block_name.lower().replace(' ', '_')
                        
                        if source_key in global_context:
                            source_output = global_context[source_key]
                            # Convert output to string for use in prompts
                            if isinstance(source_output, dict):
                                block_context[variable_name] = json.dumps(source_output, indent=2)
                            else:
                                block_context[variable_name] = str(source_output)
                        else:
                            logger.warning("Source block output not found in context", 
                                         source_block_id=source_block_id,
                                         source_block_name=source_block_name,
                                         tried_keys=[source_block_name, source_block_name.lower().replace(' ', '_')],
                                         available_blocks=list(global_context.keys()))
                            block_context[variable_name] = ""
                    else:
                        logger.warning("Source block ID not found in mapping", 
                                     source_block_id=source_block_id,
                                     available_block_ids=list(block_id_to_name.keys()))
                        block_context[variable_name] = ""
                else:
                    logger.warning("BLOCK_OUTPUT input missing source_block_id", 
                                 variable_name=variable_name)
                    block_context[variable_name] = ""
        
        return block_context
    
    def _create_schema_example(self, schema: Dict[str, Any]) -> str:
        """Create a simple example structure from a JSON schema"""
        if not schema or schema.get('type') != 'object':
            return '{"key": "value"}'
        
        example = {}
        properties = schema.get('properties', {})
        
        for field_name, field_schema in properties.items():
            field_type = field_schema.get('type', 'string')
            
            if field_type == 'string':
                example[field_name] = f"<{field_name}_value>"
            elif field_type == 'number' or field_type == 'integer':
                example[field_name] = 0
            elif field_type == 'boolean':
                example[field_name] = True
            elif field_type == 'array':
                example[field_name] = [f"<{field_name}_item>"]
            elif field_type == 'object':
                example[field_name] = {"key": "value"}
            else:
                example[field_name] = f"<{field_name}_value>"
        
        return json.dumps(example, indent=2)
    
    async def _get_custom_instructions(self, request_id: int) -> Dict[int, str]:
        """Get custom instructions for all blocks in a request"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{settings.backend_api_url}/api/requests/{request_id}/custom-instructions"
                )
                if response.status_code == 200:
                    instructions_data = response.json()
                    # Create a mapping from block_id to instruction_text
                    return {
                        instruction['workflow_block_id']: instruction['instruction_text']
                        for instruction in instructions_data
                        if instruction['is_active']
                    }
                else:
                    logger.warning("Failed to fetch custom instructions", 
                                 request_id=request_id, 
                                 status_code=response.status_code)
                    return {}
        except Exception as e:
            logger.error("Error fetching custom instructions", 
                        request_id=request_id, 
                        error=str(e))
            return {}
    
