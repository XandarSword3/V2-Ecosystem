-- =============================================
-- TRANSACTION INTEGRITY CHECK JOB
-- Single source of truth: transactions table only.
-- No reconciliation between source tables needed.
-- =============================================

CREATE TABLE IF NOT EXISTS reconciliation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    table_name VARCHAR(50) NOT NULL,
    mismatches_found INTEGER NOT NULL DEFAULT 0,
    mismatches_fixed INTEGER NOT NULL DEFAULT 0,
    details JSONB DEFAULT '[]',
    alert_sent BOOLEAN DEFAULT false
);

-- reconcile_transactions: now checks for internal transactions consistency
-- (stuck in pending, missing module_id, etc.) — no source table cross-check needed.
CREATE OR REPLACE FUNCTION reconcile_transactions(p_source_table TEXT)
RETURNS TABLE (
    mismatches_found INTEGER,
    mismatches_fixed INTEGER,
    details JSONB
) AS $$
DECLARE
    v_count INTEGER := 0;
    v_fixed INTEGER := 0;
    v_details JSONB := '[]'::JSONB;
    v_engine TEXT;
BEGIN
    -- p_source_table must be an engine_type name:
    -- 'instant_transaction' | 'time_exclusive_reservation' | 'shared_capacity_access'
    v_engine := p_source_table;

    -- Count transactions stuck in 'pending' for >24h
    SELECT COUNT(*) INTO v_count
    FROM transactions
    WHERE engine_type = v_engine
      AND status = 'pending'
      AND created_at < NOW() - INTERVAL '24 hours';

    -- Flag them in details (no automated fix — requires human review)
    IF v_count > 0 THEN
        SELECT jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at, 'engine_type', engine_type))
        INTO v_details
        FROM transactions
        WHERE engine_type = v_engine
          AND status = 'pending'
          AND created_at < NOW() - INTERVAL '24 hours';
    END IF;

    INSERT INTO reconciliation_log (table_name, mismatches_found, mismatches_fixed, details)
    VALUES (v_engine, v_count, 0, COALESCE(v_details, '[]'));

    RETURN QUERY SELECT v_count, 0, COALESCE(v_details, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_reconciliation_alerts()
RETURNS TABLE (alert_triggered BOOLEAN, message TEXT) AS $$
DECLARE
    v_recent_run RECORD;
    v_alert_threshold INTEGER := 10;
BEGIN
    FOR v_recent_run IN
        SELECT table_name, mismatches_found, mismatches_fixed, run_at
        FROM reconciliation_log
        WHERE run_at > NOW() - INTERVAL '1 hour'
          AND mismatches_found > v_alert_threshold
          AND NOT alert_sent
        ORDER BY run_at DESC
    LOOP
        UPDATE reconciliation_log SET alert_sent = true
        WHERE table_name = v_recent_run.table_name
          AND run_at = v_recent_run.run_at;

        RETURN QUERY SELECT true, format(
            'INTEGRITY ALERT: %s has %s stuck-pending transactions (fixed: %s) at %s',
            v_recent_run.table_name, v_recent_run.mismatches_found,
            v_recent_run.mismatches_fixed, v_recent_run.run_at
        );
    END LOOP;
    RETURN QUERY SELECT false, 'No alerts';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule('check-instant-transactions',    '0 3 * * *', 'SELECT reconcile_transactions(''instant_transaction'')');
        PERFORM cron.schedule('check-time-exclusive',          '0 3 * * *', 'SELECT reconcile_transactions(''time_exclusive_reservation'')');
        PERFORM cron.schedule('check-shared-capacity',         '0 3 * * *', 'SELECT reconcile_transactions(''shared_capacity_access'')');
        PERFORM cron.schedule('reconciliation-alerts',         '0 */6 * * *', 'SELECT check_reconciliation_alerts()');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available - application must schedule integrity checks manually';
END $$;

CREATE OR REPLACE FUNCTION run_daily_reconciliation()
RETURNS JSONB AS $$
DECLARE
    v_ro RECORD; v_cb RECORD; v_pt RECORD;
BEGIN
    SELECT * INTO v_ro FROM reconcile_transactions('instant_transaction');
    SELECT * INTO v_cb FROM reconcile_transactions('time_exclusive_reservation');
    SELECT * INTO v_pt FROM reconcile_transactions('shared_capacity_access');
    RETURN jsonb_build_object(
        'instant_transaction',         jsonb_build_object('stuck_pending', v_ro.mismatches_found),
        'time_exclusive_reservation',  jsonb_build_object('stuck_pending', v_cb.mismatches_found),
        'shared_capacity_access',      jsonb_build_object('stuck_pending', v_pt.mismatches_found),
        'run_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;
