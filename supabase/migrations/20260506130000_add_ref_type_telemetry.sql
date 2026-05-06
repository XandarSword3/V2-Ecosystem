-- =============================================
-- REFERENCE TYPE MIGRATION TELEMETRY
-- Track legacy reference_type usage in production
-- This helps identify which external integrations need updates
-- =============================================

-- Telemetry table for tracking legacy value usage
CREATE TABLE IF NOT EXISTS ref_type_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_value TEXT NOT NULL,
    mapped_to TEXT NOT NULL,
    source TEXT NOT NULL,  -- 'stripe_webhook', 'api_call', 'loyalty_integration', etc.
    payment_intent_id TEXT,  -- For Stripe-related events
    count INTEGER DEFAULT 1
);

-- Index for efficient querying
CREATE INDEX idx_ref_type_telemetry_detected ON ref_type_telemetry(detected_at DESC);
CREATE INDEX idx_ref_type_telemetry_raw ON ref_type_telemetry(raw_value);

-- Function to record telemetry (called by reference-type-adapter)
CREATE OR REPLACE FUNCTION record_ref_type_telemetry(
    p_raw_value TEXT,
    p_mapped_to TEXT,
    p_source TEXT,
    p_payment_intent_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO ref_type_telemetry (raw_value, mapped_to, source, payment_intent_id)
    VALUES (p_raw_value, p_mapped_to, p_source, p_payment_intent_id)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- View for monitoring migration progress
CREATE OR REPLACE VIEW ref_type_migration_status AS
SELECT 
    raw_value,
    mapped_to,
    source,
    COUNT(*) as detection_count,
    MAX(detected_at) as last_detected
FROM ref_type_telemetry
WHERE detected_at > NOW() - INTERVAL '30 days'
GROUP BY raw_value, mapped_to, source
ORDER BY detection_count DESC;

-- Alert threshold: if legacy values exceed 100 in 24 hours, investigation needed
CREATE OR REPLACE FUNCTION check_ref_type_migration_health()
RETURNS TABLE (
    healthy BOOLEAN,
    message TEXT,
    legacy_count INTEGER
) AS $$
DECLARE
    v_count INTEGER;
    v_threshold INTEGER := 100;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM ref_type_telemetry
    WHERE detected_at > NOW() - INTERVAL '24 hours';
    
    IF v_count > v_threshold THEN
        RETURN QUERY SELECT 
            false,
            format('WARNING: %s legacy reference_type values detected in 24h. Migration incomplete.', v_count),
            v_count;
    ELSE
        RETURN QUERY SELECT 
            true,
            format('OK: %s legacy values in 24h (threshold: %s)', v_count, v_threshold),
            v_count;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- MIGRATION CHECKLIST
-- =============================================
-- [ ] Deploy reference-type-adapter.ts
-- [ ] Update all payment controllers to use adapter
-- [ ] Monitor ref_type_telemetry table for 2 weeks
-- [ ] When legacy detections drop to 0 for 7 days:
--       - Remove LEGACY_TO_ENGINE mapping
--       - Switch to strict validation only
--       - Archive this telemetry table
-- =============================================
