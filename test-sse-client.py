#!/usr/bin/env python3
"""
Test SSE client for TaskFlow real-time updates
"""
import requests
import json
import sys
import time
from datetime import datetime

def test_sse_updates(request_id):
    """Connect to SSE endpoint and display real-time updates"""
    print(f"\n🔌 Connecting to SSE endpoint for request {request_id}...")
    
    url = f"http://localhost:8008/api/requests/{request_id}/events"
    
    try:
        response = requests.get(url, stream=True, headers={
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache'
        })
        response.raise_for_status()
        
        print("✅ Connected! Listening for events...\n")
        
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                
                # Parse SSE format
                if line_str.startswith('event:'):
                    event_type = line_str.split(':', 1)[1].strip()
                elif line_str.startswith('data:'):
                    data_str = line_str.split(':', 1)[1].strip()
                    try:
                        data = json.loads(data_str)
                        timestamp = datetime.now().strftime('%H:%M:%S.%f')[:-3]
                        
                        # Pretty print the event
                        print(f"[{timestamp}] 📨 Event: {data.get('type', event_type)}")
                        
                        # Show specific fields based on event type
                        if 'progress' in data.get('payload', {}):
                            progress = data['payload']['progress']
                            bar_length = 20
                            filled = int(bar_length * progress)
                            bar = '█' * filled + '░' * (bar_length - filled)
                            print(f"    Progress: [{bar}] {progress*100:.1f}%")
                        
                        if 'message' in data.get('payload', {}):
                            print(f"    Message: {data['payload']['message']}")
                        
                        if 'status' in data.get('payload', {}):
                            print(f"    Status: {data['payload']['status']}")
                        
                        if 'error' in data.get('payload', {}):
                            print(f"    ❌ Error: {data['payload']['error']}")
                        
                        print()  # Empty line for readability
                        
                    except json.JSONDecodeError:
                        print(f"    Raw data: {data_str}")
                
    except KeyboardInterrupt:
        print("\n\n👋 Disconnected by user")
    except requests.exceptions.RequestException as e:
        print(f"\n❌ Connection error: {e}")

def create_test_request():
    """Create a new request and return its ID"""
    print("📝 Creating new test request...")
    
    response = requests.post(
        "http://localhost:8008/api/requests",
        json={
            "text": "Test request for real-time SSE updates demonstration",
            "requester": "sse-test@example.com"
        }
    )
    response.raise_for_status()
    data = response.json()
    
    print(f"✅ Created request ID: {data['id']}")
    return data['id']

if __name__ == "__main__":
    if len(sys.argv) > 1:
        request_id = int(sys.argv[1])
    else:
        # Create a new request if no ID provided
        request_id = create_test_request()
        time.sleep(1)  # Give the system a moment to process
    
    test_sse_updates(request_id)