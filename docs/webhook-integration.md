# Webhook Integration Guide

## Overview

TaskFlow supports webhooks to notify external systems about events in real-time. This allows you to integrate TaskFlow with other tools and automate workflows based on TaskFlow events.

## Supported Events

The following events can trigger webhooks:

### Job Events
- `job.started` - When a processing job begins
- `job.progress` - Progress updates during job execution
- `job.completed` - When a job completes successfully
- `job.failed` - When a job fails

### Request Events
- `request.created` - When a new request is created
- `request.updated` - When a request is updated
- `request.status.changed` - When request status changes

### Embedding Events
- `embedding.started` - When embedding generation begins
- `embedding.completed` - When embeddings are generated successfully
- `embedding.failed` - When embedding generation fails

## Webhook Configuration

### Creating a Webhook

```bash
POST /api/webhooks
{
  "name": "My Integration",
  "url": "https://example.com/webhook",
  "description": "Notify my system about job completions",
  "events": ["job.completed", "job.failed"],
  "headers": {
    "X-Custom-Header": "value"
  },
  "secret_token": "your-secret-token",
  "retry_count": 3,
  "timeout_seconds": 30
}
```

### Webhook Fields

- `name` (required): Unique name for the webhook
- `url` (required): HTTPS endpoint to receive events
- `events` (required): Array of event types to subscribe to
- `description`: Optional description
- `headers`: Custom headers to include in webhook requests
- `secret_token`: Used to generate HMAC signatures for verification
- `retry_count`: Number of retry attempts (0-10, default: 3)
- `timeout_seconds`: Request timeout (5-300 seconds, default: 30)
- `is_active`: Enable/disable webhook (default: true)

## Webhook Payload

All webhook requests are POST requests with JSON payloads:

```json
{
  "type": "job.completed",
  "request_id": 123,
  "timestamp": "2024-02-01T12:34:56Z",
  "payload": {
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "workflow_id": 5,
    "duration_ms": 15000,
    "result": { ... }
  }
}
```

### Common Headers

All webhook requests include these headers:

- `Content-Type: application/json`
- `X-TaskFlow-Event: {event_type}`
- `X-TaskFlow-Delivery-ID: {delivery_id}`
- `X-TaskFlow-Signature: sha256={signature}` (if secret_token configured)

## Security

### Signature Verification

If you configure a `secret_token`, TaskFlow will sign webhook payloads using HMAC-SHA256:

```python
import hmac
import hashlib

def verify_webhook(request):
    signature = request.headers.get('X-TaskFlow-Signature')
    if not signature:
        return False
    
    expected = hmac.new(
        secret_token.encode(),
        request.body,
        hashlib.sha256
    ).hexdigest()
    
    return f"sha256={expected}" == signature
```

### Best Practices

1. **Use HTTPS**: Always use HTTPS endpoints for webhooks
2. **Verify Signatures**: Configure and verify secret tokens
3. **Idempotency**: Handle duplicate deliveries gracefully
4. **Quick Response**: Respond quickly (< 30s) to avoid timeouts
5. **Return 2xx**: Return HTTP 200-299 to acknowledge receipt

## Retry Logic

Failed webhook deliveries are retried with exponential backoff:

- Attempt 1: Immediate
- Attempt 2: After 2 seconds
- Attempt 3: After 4 seconds
- Attempt 4: After 8 seconds
- Maximum wait: 60 seconds

A delivery is considered failed if:
- Connection timeout
- Non-2xx HTTP response
- Network error

## Managing Webhooks

### List Webhooks

```bash
GET /api/webhooks
```

### Update Webhook

```bash
PATCH /api/webhooks/{webhook_id}
{
  "events": ["job.completed", "job.failed", "request.created"]
}
```

### Delete Webhook

```bash
DELETE /api/webhooks/{webhook_id}
```

### Test Webhook

```bash
POST /api/webhooks/{webhook_id}/test
{
  "event_type": "job.completed",
  "sample_data": {
    "custom": "test data"
  }
}
```

### View Delivery History

```bash
GET /api/webhooks/{webhook_id}/deliveries?status=failed&page=1
```

## Example Integrations

### Slack Notification

```python
# Create webhook for Slack
webhook = {
    "name": "Slack Notifications",
    "url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "events": ["job.failed", "request.created"],
    "headers": {},
    "timeout_seconds": 10
}
```

### Custom Integration

```python
# Your webhook endpoint
@app.post("/taskflow-webhook")
async def handle_webhook(request: Request):
    # Verify signature
    if not verify_signature(request):
        return {"error": "Invalid signature"}, 401
    
    data = await request.json()
    
    if data["type"] == "job.completed":
        # Process completed job
        process_completed_job(data["payload"])
    
    return {"status": "ok"}
```

## Troubleshooting

### Common Issues

1. **Webhook not triggering**
   - Check webhook is active
   - Verify subscribed to correct events
   - Check delivery history for errors

2. **Delivery failures**
   - Verify endpoint is accessible
   - Check for SSL certificate issues
   - Ensure response time < timeout

3. **Signature verification failing**
   - Ensure secret tokens match
   - Use raw request body for HMAC
   - Check for encoding issues

### Debug Tips

- Use the test endpoint to verify connectivity
- Check delivery history for error messages
- Monitor your endpoint logs
- Use tools like ngrok for local testing

## Rate Limits

- Maximum 10 webhooks per user
- Maximum 1000 deliveries per hour per webhook
- Webhooks inactive for 30 days may be disabled

## API Reference

See the API documentation for complete webhook endpoint details:
- `/api/webhooks` - Webhook management
- `/api/webhooks/{id}/deliveries` - Delivery history
- `/api/webhooks/{id}/test` - Test webhook