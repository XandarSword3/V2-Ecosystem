-- Webhook Event Idempotency Table
-- Prevents duplicate processing of Stripe webhook events

CREATE TABLE IF NOT EXISTS processed_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    payload_hash VARCHAR(64), -- SHA-256 hash of the event payload
    result JSONB, -- Store any relevant result data for debugging
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups by event_id
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_id 
ON processed_webhook_events(event_id);

-- Index for querying by event type
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_event_type 
ON processed_webhook_events(event_type);

-- Index for cleanup queries (remove old events)
CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_processed_at 
ON processed_webhook_events(processed_at);

-- Function to check if event was already processed
CREATE OR REPLACE FUNCTION is_webhook_event_processed(p_event_id VARCHAR(255))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM processed_webhook_events WHERE event_id = p_event_id
    );
END;
$$ LANGUAGE plpgsql;

-- Function to mark event as processed
CREATE OR REPLACE FUNCTION mark_webhook_event_processed(
    p_event_id VARCHAR(255),
    p_event_type VARCHAR(100),
    p_payload_hash VARCHAR(64) DEFAULT NULL,
    p_result JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO processed_webhook_events (event_id, event_type, payload_hash, result)
    VALUES (p_event_id, p_event_type, p_payload_hash, p_result)
    ON CONFLICT (event_id) DO NOTHING;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function to remove old processed events (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM processed_webhook_events
    WHERE processed_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comment for documentation
COMMENT ON TABLE processed_webhook_events IS 'Tracks processed Stripe webhook events for idempotency';
COMMENT ON COLUMN processed_webhook_events.event_id IS 'Stripe event ID (e.g., evt_1234567890)';
COMMENT ON COLUMN processed_webhook_events.event_type IS 'Stripe event type (e.g., payment_intent.succeeded)';
COMMENT ON COLUMN processed_webhook_events.payload_hash IS 'SHA-256 hash of event payload for verification';
COMMENT ON COLUMN processed_webhook_events.result IS 'Processing result for debugging and auditing';
