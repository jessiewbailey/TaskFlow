import json
import asyncio
from typing import Dict, Any, List, Optional
import ollama
import structlog
import httpx
from openai import AsyncOpenAI
from config import settings

logger = structlog.get_logger()

class WorkflowProcessor:
    def __init__(self):
        self.ollama_client = ollama.AsyncClient(host=settings.ollama_host)
        # Initialize OpenAI client for models that need OpenAI-compatible API
        self.openai_client = AsyncOpenAI(
            base_url=f"{settings.ollama_host}/v1",  # Ollama's OpenAI-compatible endpoint
            api_key="ollama"  # Dummy key for Ollama
        )
        self.default_model = settings.model_name
        self.on_step_complete = None  # Callback for step completion
        self.on_progress = None  # Callback for progress updates
        
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
            total_blocks = len(blocks)
            for idx, block in enumerate(blocks):
                block_name = block['name']
                logger.info("Executing block", block_name=block_name, order=block['order'])
                
                # Emit progress event
                if self.on_progress:
                    await self.on_progress(
                        step_number=idx + 1,
                        total_steps=total_blocks,
                        current_step=block_name,
                        progress=(idx / total_blocks)
                    )
                
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
                    result = await self._execute_block(prompt, block_name, model_name, block.get('output_schema'), block_custom_instructions, block.get('model_parameters'), block.get('system_prompt'))
                    
                    # Store result in context for future blocks
                    context[block_name.lower().replace(' ', '_')] = result
                    results[block_name] = result
                    
                    # Emit completion event for this step
                    if self.on_step_complete:
                        await self.on_step_complete(block_name, result)
                    
                    # Update progress after completion
                    if self.on_progress:
                        await self.on_progress(
                            step_number=idx + 1,
                            total_steps=total_blocks,
                            current_step=block_name,
                            progress=((idx + 1) / total_blocks),
                            completed=True
                        )
                    
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
    
    async def _execute_block(self, prompt: str, block_name: str, model_name: str, output_schema: Dict[str, Any] = None, custom_instructions: str = "", model_parameters: Dict[str, Any] = None, system_prompt: str = None) -> Dict[str, Any]:
        """Execute a single workflow block"""
        
        # Debug: Check if model exists in Ollama
        try:
            available_models = await self.ollama_client.list()
            model_names = [model['name'] for model in available_models['models']]
            logger.info("Available Ollama models", models=model_names, requested_model=model_name)
            print(f"=== OLLAMA MODEL CHECK FOR {block_name} ===")
            print(f"Requested model: {model_name}")
            print(f"Available models: {model_names}")
            print(f"Model exists: {model_name in model_names}")
            print(f"=== END MODEL CHECK ===")
            
            if model_name not in model_names:
                logger.warning("Requested model not found in Ollama", requested=model_name, available=model_names)
        except Exception as e:
            logger.warning("Could not check available models", error=str(e))
        
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
        
        # Detect if this might be a reasoning/chain-of-thought model
        is_reasoning_model = any(indicator in model_name.lower() for indicator in [
            'cot', 'chain', 'reasoning', 'think', 'step', 'openai', 'gpt'
        ])
        
        # Detect if this model requires OpenAI-compatible API
        is_openai_compatible = any(indicator in model_name.lower() for indicator in [
            'gpt-oss', 'openai', 'gpt'
        ])

        print("Dealing with openAI-compatible model:", is_openai_compatible, "for model:", model_name)
        
        if is_reasoning_model:
            json_instructions = """
CRITICAL INSTRUCTIONS FOR JSON OUTPUT:
- You MUST respond with ONLY a valid JSON object
- Do NOT include any reasoning, explanation, or commentary before or after the JSON
- Do NOT use markdown code blocks (no ``` formatting)
- Do NOT include comments in the JSON (// or /* */)
- Do NOT add any text like "Here's the JSON:" or "Based on my analysis:"
- Your entire response should be parseable as JSON directly

EXAMPLE OF CORRECT RESPONSE:
{"summary": "Your actual summary content here"}

EXAMPLE OF INCORRECT RESPONSE:
Let me analyze this step by step... Here's my JSON response: {"summary": "content"}"""
        else:
            json_instructions = """
IMPORTANT: You must respond with valid JSON only containing actual data values (not schema definitions). Do not include any markdown formatting, code blocks, or additional text. Your response should be a single JSON object with the actual content."""

        enhanced_prompt = f"""{prompt}{schema_instruction}{custom_instruction_text}

{json_instructions}"""

        # Log the full prompt being sent
        print(f"=== FULL PROMPT FOR {block_name} ===")
        if system_prompt:
            print(f"SYSTEM PROMPT: {system_prompt}")
        print(f"USER PROMPT: {enhanced_prompt}")
        print(f"=== END PROMPT FOR {block_name} ===")

        # Prepare options with default values and override with model_parameters if provided
        options = {
            "temperature": 0.7,
            "top_p": 0.9,
            "stop": ["<|endoftext|>"]
        }
        
        # Override with model_parameters if provided
        if model_parameters:
            # Map common parameter names to Ollama's expected names
            param_mapping = {
                'max_tokens': 'num_predict',
                'context_window': 'num_ctx',
                'num_ctx': 'num_ctx',
                'temperature': 'temperature',
                'top_p': 'top_p',
                'top_k': 'top_k',
                'repeat_penalty': 'repeat_penalty',
                'seed': 'seed'
            }
            
            for key, value in model_parameters.items():
                if key in param_mapping:
                    ollama_key = param_mapping[key]
                    options[ollama_key] = value
                elif key not in ['stop']:  # Don't override stop tokens
                    # Pass through any other parameters as-is
                    options[key] = value
        
        logger.info(f"Using model parameters for {block_name}: {options}")

        for attempt in range(settings.max_retries + 1):
            try:
                logger.info("Calling Ollama API",
                           block_name=block_name,
                           model_name=model_name,
                           attempt=attempt + 1,
                           options=options)
                
                # Debug: Log the exact request being sent
                if is_openai_compatible:
                    openai_params = {}
                    if options.get('temperature'):
                        openai_params['temperature'] = options['temperature']
                    if options.get('top_p'):
                        openai_params['top_p'] = options['top_p']
                    if options.get('num_predict'):
                        openai_params['max_tokens'] = options['num_predict']
                        
                    request_data = {
                        "model": model_name,
                        "messages": [{"role": "user", "content": enhanced_prompt}],
                        "response_format": {"type": "json_object"},
                        **openai_params
                    }
                    print(f"=== OPENAI REQUEST FOR {block_name} ===")
                    print(f"Model: {model_name}")
                    print(f"Response format: json_object")
                    print(f"Parameters: {openai_params}")
                    print(f"Message length: {len(enhanced_prompt)} characters")
                    print(f"Full request structure: {request_data}")
                    print(f"=== END OPENAI REQUEST ===")
                else:
                    request_data = {
                        "model": model_name,
                        "messages": [{"role": "user", "content": enhanced_prompt}],
                        "format": "json",
                        "options": options
                    }
                    print(f"=== OLLAMA REQUEST FOR {block_name} ===")
                    print(f"Model: {model_name}")
                    print(f"Format: json")
                    print(f"Options: {options}")
                    print(f"Message length: {len(enhanced_prompt)} characters")
                    print(f"Full request structure: {request_data}")
                    print(f"=== END OLLAMA REQUEST ===")
                
                # Choose the appropriate API based on model type
                if is_openai_compatible:
                    # Use OpenAI-compatible API for GPT-OSS and similar models
                    print(f"=== USING OPENAI API FOR {block_name} ===")
                    print(f"Model: {model_name}")
                    print(f"OpenAI client base_url: {self.openai_client.base_url}")
                    print(f"=== END OPENAI API INFO ===")
                    
                    # Convert Ollama options to OpenAI parameters where possible
                    openai_params = {}
                    if options.get('temperature'):
                        openai_params['temperature'] = options['temperature']
                    if options.get('top_p'):
                        openai_params['top_p'] = options['top_p']
                    if options.get('num_predict'):
                        openai_params['max_tokens'] = options['num_predict']
                    
                    # Build messages array with optional system prompt
                    messages = []
                    if system_prompt:
                        messages.append({"role": "system", "content": system_prompt})
                    messages.append({"role": "user", "content": enhanced_prompt})
                    
                    response = await self.openai_client.chat.completions.create(
                        model=model_name,
                        messages=messages,
                        response_format={"type": "json_object"},
                        **openai_params
                    )
                    
                    # Convert OpenAI response to Ollama-like format for compatibility
                    ollama_response = {
                        'message': {
                            'content': response.choices[0].message.content
                        },
                        'eval_count': response.usage.completion_tokens if response.usage else 0,
                        'prompt_eval_count': response.usage.prompt_tokens if response.usage else 0,
                        'total_duration': 0  # Not available in OpenAI API
                    }
                    response = ollama_response
                else:
                    # Use native Ollama API
                    # Build messages array with optional system prompt
                    messages = []
                    if system_prompt:
                        messages.append({"role": "system", "content": system_prompt})
                    messages.append({"role": "user", "content": enhanced_prompt})
                    
                    response = await self.ollama_client.chat(
                        model=model_name,
                        messages=messages,
                        format='json',
                        options=options
                    )
                
                logger.info("Ollama API response received",
                           block_name=block_name,
                           response_keys=list(response.keys()),
                           message_keys=list(response.get('message', {}).keys()),
                           eval_count=response.get('eval_count'),
                           prompt_eval_count=response.get('prompt_eval_count'),
                           total_duration=response.get('total_duration'),
                           full_response_structure=response)
                
                # Debug: Print the full Ollama response structure
                print(f"=== FULL OLLAMA RESPONSE STRUCTURE FOR {block_name} ===")
                print(f"Response type: {type(response)}")
                print(f"Response keys: {list(response.keys()) if isinstance(response, dict) else 'Not a dict'}")
                if isinstance(response, dict) and 'message' in response:
                    print(f"Message keys: {list(response['message'].keys())}")
                    print(f"Message content type: {type(response['message'].get('content'))}")
                    print(f"Message content length: {len(str(response['message'].get('content', '')))}")
                print(f"Full response: {response}")
                print(f"=== END OLLAMA RESPONSE STRUCTURE ===")
                
                # Additional checks for response validity
                if not isinstance(response, dict):
                    logger.error("Ollama response is not a dictionary", response_type=type(response), response_content=str(response))
                    raise Exception(f"Invalid response type from Ollama: {type(response)}")
                
                if 'message' not in response:
                    logger.error("Ollama response missing 'message' key", available_keys=list(response.keys()))
                    raise Exception(f"Ollama response missing 'message' key. Available keys: {list(response.keys())}")
                
                if 'content' not in response['message']:
                    logger.error("Ollama response message missing 'content' key", message_keys=list(response['message'].keys()))
                    raise Exception(f"Ollama message missing 'content' key. Available keys: {list(response['message'].keys())}")
                
                # Log the raw LLM response
                raw_response = response['message']['content']
                logger.info("RAW LLM RESPONSE", 
                           block_name=block_name,
                           raw_response=raw_response)
                print(f"=== RAW LLM RESPONSE FOR {block_name} ===")
                print(raw_response)
                print(f"=== END LLM RESPONSE FOR {block_name} ===")
                
                result = self._extract_json_from_response(raw_response)
                logger.info("PARSED JSON RESULT",
                           block_name=block_name, 
                           parsed_result=result)
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
                            json_error_msg=e.msg,
                            json_error_pos=e.pos,
                            raw_response_full=raw_response,
                            raw_response_preview=raw_response[:500],
                            raw_response_length=len(raw_response))
                # Also print to console for immediate visibility
                print(f"=== JSON DECODE ERROR FOR {block_name} (Attempt {attempt + 1}) ===")
                print(f"Error: {str(e)}")
                print(f"Error message: {e.msg}")
                print(f"Error position: {e.pos}")
                print(f"Response length: {len(raw_response)} characters")
                print(f"Full raw response:")
                print(repr(raw_response))
                print(f"=== END JSON ERROR DEBUG ===")
                
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
        """Extract JSON from response content, handling chain-of-thought and reasoning models"""
        content = content.strip()
        
        logger.info("JSON extraction attempt", content_length=len(content), content_preview=content[:200])
        
        # First try to parse as direct JSON
        try:
            result = json.loads(content)
            logger.info("JSON extracted successfully - direct parse")
            return result
        except json.JSONDecodeError:
            pass
        
        # Strategy 1: Look for JSON in markdown code blocks
        if '```json' in content:
            start = content.find('```json') + 7
            end = content.find('```', start)
            if end != -1:
                json_content = content[start:end].strip()
                try:
                    result = json.loads(json_content)
                    logger.info("JSON extracted successfully - markdown json block")
                    return result
                except json.JSONDecodeError:
                    pass
        
        # Strategy 2: Look for JSON in any code blocks
        if '```' in content:
            parts = content.split('```')
            for i in range(1, len(parts), 2):  # Check odd indices (inside code blocks)
                json_content = parts[i].strip()
                # Remove language identifier if present
                if json_content.startswith('json\n'):
                    json_content = json_content[5:]
                try:
                    result = json.loads(json_content)
                    logger.info("JSON extracted successfully - code block", block_index=i)
                    return result
                except json.JSONDecodeError:
                    continue
        
        # Strategy 3: Find JSON objects by brace matching (handles reasoning text)
        json_candidates = []
        brace_count = 0
        start_pos = -1
        
        for i, char in enumerate(content):
            if char == '{':
                if brace_count == 0:
                    start_pos = i
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0 and start_pos != -1:
                    # Found a complete JSON object
                    json_candidate = content[start_pos:i+1]
                    json_candidates.append(json_candidate)
        
        # Try to parse each candidate
        for candidate in json_candidates:
            try:
                result = json.loads(candidate)
                logger.info("JSON extracted successfully - brace matching", candidate_length=len(candidate))
                return result
            except json.JSONDecodeError:
                continue
        
        # Strategy 4: Clean up common chain-of-thought artifacts
        lines = content.split('\n')
        potential_json_lines = []
        in_json_block = False
        
        for line in lines:
            line = line.strip()
            # Skip common reasoning phrases
            if any(phrase in line.lower() for phrase in [
                'let me', 'first', 'then', 'next', 'based on', 'here is', 'here\'s', 
                'the result', 'my analysis', 'step by step', 'thinking', 'reasoning'
            ]):
                continue
            # Look for JSON-like content
            if line.startswith('{') or in_json_block:
                potential_json_lines.append(line)
                in_json_block = True
                if line.endswith('}') and line.count('}') >= line.count('{'):
                    # Try to parse accumulated JSON
                    json_candidate = '\n'.join(potential_json_lines)
                    try:
                        result = json.loads(json_candidate)
                        logger.info("JSON extracted successfully - line filtering")
                        return result
                    except json.JSONDecodeError:
                        potential_json_lines = []
                        in_json_block = False
        
        # Strategy 5: Remove common JSON-breaking elements and retry
        cleaned_content = content
        
        # Remove comments
        import re
        cleaned_content = re.sub(r'//.*?$', '', cleaned_content, flags=re.MULTILINE)
        cleaned_content = re.sub(r'/\*.*?\*/', '', cleaned_content, flags=re.DOTALL)
        
        # Remove trailing commas
        cleaned_content = re.sub(r',(\s*[}\]])', r'\1', cleaned_content)
        
        # Try parsing cleaned content
        if '{' in cleaned_content and '}' in cleaned_content:
            start = cleaned_content.find('{')
            end = cleaned_content.rfind('}') + 1
            if start < end:
                json_candidate = cleaned_content[start:end]
                try:
                    result = json.loads(json_candidate)
                    logger.info("JSON extracted successfully - after cleaning")
                    return result
                except json.JSONDecodeError:
                    pass
        
        # Strategy 6: Last resort - try to find any valid JSON structure
        # This is more permissive and tries to extract partial JSON
        try:
            # Look for patterns like {"key": "value"}
            json_pattern = re.compile(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}')
            matches = json_pattern.findall(content)
            
            for match in matches:
                try:
                    result = json.loads(match)
                    logger.info("JSON extracted successfully - regex pattern matching")
                    return result
                except json.JSONDecodeError:
                    continue
        except Exception:
            pass
        
        # If all strategies fail, log detailed information and raise error
        logger.error("All JSON extraction strategies failed", 
                    content_length=len(content),
                    content_full=content,
                    brace_count=content.count('{'),
                    closing_brace_count=content.count('}'),
                    has_code_blocks=('```' in content),
                    candidates_found=len(json_candidates))
        
        raise json.JSONDecodeError(f"No valid JSON found in response after trying all extraction strategies. Content: {content[:500]}...", content, 0)
    
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
    
