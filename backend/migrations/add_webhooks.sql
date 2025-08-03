-- Migration: Add webhooks table for external notifications
-- Description: Creates webhook configuration table to allow external systems to receive TaskFlow events

CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    description TEXT,
    events TEXT[] NOT NULL, -- Array of event types to subscribe to
    headers JSONB DEFAULT '{}', -- Custom headers to include in webhook calls
    is_active BOOLEAN DEFAULT true,
    secret_token VARCHAR(255), -- For webhook signature verification
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_triggered_at TIMESTAMP,
    
    CONSTRAINT webhook_name_unique UNIQUE (name)
);

-- Create indexes for performance
CREATE INDEX idx_webhooks_active ON webhooks(is_active);
CREATE INDEX idx_webhooks_events ON webhooks USING GIN(events);

-- Table to track webhook deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'pending', 'success', 'failed'
    attempts INTEGER DEFAULT 0,
    response_status INTEGER,
    response_body TEXT,
    error_message TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Index for querying recent deliveries
    CONSTRAINT webhook_delivery_status_check CHECK (status IN ('pending', 'success', 'failed'))
);

CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_webhooks_updated_at
    BEFORE UPDATE ON webhooks
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_updated_at();

-- Comments for documentation
COMMENT ON TABLE webhooks IS 'Stores webhook configurations for external event notifications';
COMMENT ON COLUMN webhooks.events IS 'Array of event types this webhook subscribes to (e.g., job.completed, request.created)';
COMMENT ON COLUMN webhooks.headers IS 'Custom HTTP headers to include in webhook requests';
COMMENT ON COLUMN webhooks.secret_token IS 'Used to generate HMAC signatures for webhook payload verification';

COMMENT ON TABLE webhook_deliveries IS 'Tracks webhook delivery attempts and their results';
COMMENT ON COLUMN webhook_deliveries.event_data IS 'The actual event payload that was/will be sent';