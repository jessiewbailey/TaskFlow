#!/usr/bin/env python3
"""
Test script specifically for gpt-oss:20b model with Harmony format handling
This tests the model without using the format flag, relying on prompts for JSON
"""

import asyncio
import json
import ollama
import os
import shlex

async def test_harmony_model():
    # Get the Ollama host from environment or use default
    ollama_host = os.getenv("OLLAMA_HOST", "http://ollama-service:11434")
    print(f"Testing Ollama at: {ollama_host}")
    
    # Create Ollama client
    client = ollama.AsyncClient(host=ollama_host)
    
    # Test with gpt-oss:20b model
    model_name = "gpt-oss:20b"
    
    # System prompt to enforce JSON output (Harmony format requirement)
    system_prompt = """You are a helpful assistant that always responds with valid JSON.
    
IMPORTANT: Always respond with valid JSON only. No explanations, no markdown, just raw JSON."""
    
    # User prompt with clear JSON instructions
    user_prompt = """Analyze this request and return a JSON response.

# OUTPUT FORMAT REQUIREMENT

You must output ONLY a valid JSON object. No other text, explanations, or formatting.

Your ENTIRE response must be valid JSON that can be parsed directly.
Do not include:
- Markdown code blocks (```)
- Explanatory text before or after
- Comments in the JSON
- Any non-JSON content

Respond with the raw JSON object only.

Now, create a JSON object with these fields:
- "status": set to "success"
- "model": set to "gpt-oss:20b"
- "test": set to "harmony format working"
- "timestamp": current ISO timestamp"""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    # Note: No format flag for Harmony models
    request_data = {
        "model": model_name,
        "messages": messages,
        "options": {
            "temperature": 0.3,  # Lower temperature for more consistent JSON
            "top_p": 0.9
        },
        "stream": False
    }
    
    print(f"\n=== Testing Harmony model: {model_name} ===")
    print(f"Note: Using prompt-based JSON enforcement (no format flag)")
    print(f"\nRequest JSON:")
    print(json.dumps(request_data, indent=2))
    
    # Generate curl command for manual testing
    curl_json = json.dumps(request_data)
    curl_cmd = f"""
curl -X POST {ollama_host}/api/chat \\
  -H "Content-Type: application/json" \\
  -d {shlex.quote(curl_json)}
"""
    
    print(f"\nEquivalent curl command:")
    print(curl_cmd)
    
    # Also test with format flag to show the difference
    print(f"\n--- Testing WITHOUT format flag (Harmony compatible) ---")
    try:
        response = await client.chat(
            model=model_name,
            messages=messages,
            options=request_data['options']
        )
        
        print(f"SUCCESS: Response received")
        print(f"Response type: {type(response)}")
        print(f"Response keys: {list(response.keys())}")
        print(f"Raw content: {response['message']['content']}")
        
        # Try to parse the JSON
        try:
            parsed_json = json.loads(response['message']['content'])
            print(f"✓ Successfully parsed JSON:")
            print(json.dumps(parsed_json, indent=2))
        except json.JSONDecodeError as e:
            print(f"✗ Failed to parse JSON: {e}")
            print(f"Content was: {response['message']['content'][:500]}")
            
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {str(e)}")
    
    # Now test WITH format flag (likely to fail with Harmony)
    print(f"\n--- Testing WITH format flag (may fail with Harmony) ---")
    try:
        response = await client.chat(
            model=model_name,
            messages=messages,
            format='json',  # This might cause issues with Harmony
            options=request_data['options']
        )
        
        print(f"SUCCESS: Response received with format flag")
        print(f"Raw content: {response['message']['content']}")
        
    except Exception as e:
        print(f"ERROR with format flag: {type(e).__name__}: {str(e)}")
        print(f"This error is expected if the model doesn't support the format flag")
    
    print(f"\n=== Test Complete ===")
    print(f"If the first test (without format flag) worked but the second failed,")
    print(f"it confirms that gpt-oss models need special handling without the format flag.")

if __name__ == "__main__":
    asyncio.run(test_harmony_model())