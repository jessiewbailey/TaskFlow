#!/usr/bin/env python3
"""
Test script to verify chain-of-thought reasoning with gpt-oss:20b model
Tests different reasoning levels: LOW, MEDIUM, HIGH
"""

import asyncio
import json
import ollama
import os
import time
import shlex

async def test_reasoning_level(reasoning_level="MEDIUM"):
    # Get the Ollama host from environment or use default
    ollama_host = os.getenv("OLLAMA_HOST", "http://ollama-service.llm:11434")
    
    # Create Ollama client
    client = ollama.AsyncClient(host=ollama_host)
    
    # Test with gpt-oss:20b model
    model_name = "gpt-oss:20b"
    
    # System prompt with reasoning level instruction
    system_prompt = f"""You are a helpful and accurate assistant.

REASONING LEVEL: {reasoning_level}
- Use {reasoning_level} reasoning effort to analyze the request thoroughly before responding.
- Think step-by-step through the problem internally.
- Ensure your response is accurate and well-considered.

IMPORTANT: After your internal reasoning, respond with valid JSON only."""
    
    # Complex prompt that benefits from reasoning
    user_prompt = """Analyze the following scenario and provide a structured response:

A software team is experiencing slow API response times. The database queries are optimized, 
network latency is minimal, but the API still takes 5-10 seconds to respond. The API handles 
JSON serialization of large datasets (10,000+ records) before sending to clients.

# OUTPUT FORMAT REQUIREMENT

Respond with ONLY a valid JSON object containing:
- "likely_cause": The most probable cause of the issue
- "reasoning_steps": Array of logical steps you considered
- "recommendations": Array of 3 specific recommendations to fix the issue
- "priority": "high", "medium", or "low" based on impact
- "estimated_improvement": Estimated performance improvement percentage

Your ENTIRE response must be valid JSON that can be parsed directly."""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    request_data = {
        "model": model_name,
        "messages": messages,
        "options": {
            "temperature": 0.3,  # Lower for more consistent reasoning
            "top_p": 0.9,
            "num_predict": 1000  # Allow longer responses for reasoning
        },
        "stream": False
    }
    
    print(f"\n=== Testing Reasoning Level: {reasoning_level} ===")
    print(f"Model: {model_name}")
    print(f"System prompt includes reasoning instruction: YES")
    
    # Generate curl command
    curl_json = json.dumps(request_data)
    curl_cmd = f"""
curl -X POST {ollama_host}/api/chat \\
  -H "Content-Type: application/json" \\
  -d {shlex.quote(curl_json)}
"""
    
    print(f"\nCurl command for manual testing:")
    print(curl_cmd)
    
    try:
        print(f"\nSending request with {reasoning_level} reasoning...")
        start_time = time.time()
        
        response = await client.chat(
            model=model_name,
            messages=messages,
            options=request_data['options']
        )
        
        elapsed = time.time() - start_time
        print(f"Response time: {elapsed:.2f} seconds")
        
        # Parse and display response
        try:
            parsed_json = json.loads(response['message']['content'])
            print(f"\n✓ Successfully parsed JSON response:")
            print(json.dumps(parsed_json, indent=2))
            
            # Check if reasoning steps are present
            if 'reasoning_steps' in parsed_json:
                print(f"\n✓ Reasoning steps included: {len(parsed_json['reasoning_steps'])} steps")
            else:
                print(f"\n⚠ No reasoning steps in response")
                
        except json.JSONDecodeError as e:
            print(f"✗ Failed to parse JSON: {e}")
            print(f"Raw response: {response['message']['content'][:500]}")
            
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {str(e)}")

async def main():
    print("=== Testing Chain-of-Thought Reasoning Levels ===")
    print("This test verifies that gpt-oss:20b can use different reasoning levels")
    print("Higher reasoning levels should take longer but provide better analysis\n")
    
    # Test each reasoning level
    for level in ["LOW", "MEDIUM", "HIGH"]:
        await test_reasoning_level(level)
        print("\n" + "="*60)
    
    print("\n=== Summary ===")
    print("- LOW: Quick responses, minimal reasoning")
    print("- MEDIUM: Balanced reasoning and speed")
    print("- HIGH: Thorough analysis, may take longer")
    print("\nIf HIGH reasoning takes noticeably longer and provides more detailed")
    print("reasoning steps, then chain-of-thought is working correctly.")

if __name__ == "__main__":
    asyncio.run(main())