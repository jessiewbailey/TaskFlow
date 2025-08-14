#!/usr/bin/env python3
"""
Test script to verify Ollama API connectivity with gpt-oss:20b model
Run this to test if the model works with native Ollama API
"""

import asyncio
import json
import ollama
import os

async def test_ollama_model():
    # Get the Ollama host from environment or use default
    ollama_host = os.getenv("OLLAMA_HOST", "http://ollama-service:11434")
    print(f"Testing Ollama at: {ollama_host}")
    
    # Create Ollama client
    client = ollama.AsyncClient(host=ollama_host)
    
    # Test with gpt-oss:20b model
    model_name = "gpt-oss:20b"
    
    # Simple test prompt
    test_prompt = """
    Analyze this text and return a JSON object with a single field called "test" containing the value "success".
    
    IMPORTANT: Return ONLY valid JSON, no additional text.
    """
    
    messages = [
        {"role": "user", "content": test_prompt}
    ]
    
    request_data = {
        "model": model_name,
        "messages": messages,
        "format": "json",
        "options": {
            "temperature": 0.7,
            "top_p": 0.9
        }
    }
    
    print(f"\n=== Testing model: {model_name} ===")
    print(f"Request JSON:")
    print(json.dumps(request_data, indent=2))
    
    # Generate curl command for manual testing
    import shlex
    curl_json = json.dumps(request_data)
    curl_cmd = f"""
curl -X POST {ollama_host}/api/chat \\
  -H "Content-Type: application/json" \\
  -d {shlex.quote(curl_json)}
"""
    
    print(f"\nEquivalent curl command:")
    print(curl_cmd)
    
    try:
        print(f"\nSending request to Ollama...")
        response = await client.chat(
            model=model_name,
            messages=messages,
            format='json',
            options=request_data['options']
        )
        
        print(f"\n=== SUCCESS ===")
        print(f"Response type: {type(response)}")
        print(f"Response keys: {list(response.keys())}")
        print(f"Message content: {response['message']['content']}")
        
        # Try to parse the JSON
        try:
            parsed_json = json.loads(response['message']['content'])
            print(f"Parsed JSON: {json.dumps(parsed_json, indent=2)}")
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}")
            
    except Exception as e:
        print(f"\n=== ERROR ===")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print(f"\nTry running the curl command above to debug")
        print(f"\nAlso check if model exists with:")
        print(f"curl {ollama_host}/api/tags")

if __name__ == "__main__":
    asyncio.run(test_ollama_model())