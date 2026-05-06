-- =============================================
-- MANDATORY RECONCILIATION JOB
-- Detects and fixes drift between source tables and transactions
-- This is NOT optional - run daily to prevent silent data divergence
-- =============================================

-- =============================================
-- 1. RECONCILIATION LOG TABLE
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

-- =============================================
-- 2. RECONCILIATION FUNCTION
-- Compares source tables to transactions and fixes discrepancies
-- =============================================
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
    v_record RECORD;
BEGIN
    -- Check for missing transactions
    IF p_source_table = 'restaurant_orders' THEN
        FOR v_record IN 
            SELECT ro.id, ro.status, ro.payment_status, ro.total_amount, ro.module_id, ro.property_id, ro.customer_id, ro.created_at, ro.completed_at, ro.order_number, ro.order_type
            FROM restaurant_orders ro
            LEFT JOIN transactions t ON t.reference_id = ro.id AND t.reference_table = 'restaurant_orders'
            WHERE t.id IS NULL
            AND ro.created_at > NOW() - INTERVAL '7 days'  -- Only recent records
        LOOP
            v_count := v_count + 1;
            
            -- Attempt to create missing transaction
            BEGIN
                INSERT INTO transactions (
                    module_id, engine_type, property_id, status, amount, 
                    net_amount, currency, customer_id, reference_id, reference_table,
                    created_at, completed_at, metadata
                )
                SELECT 
                    v_record.module_id,
                    CASE m.template_type
                        WHEN 'multi_day_booking' THEN 'time_exclusive_reservation'
                        WHEN 'session_access' THEN 'shared_capacity_access'
                        ELSE 'instant_transaction'
                    END,
                    COALESCE(v_record.property_id, m.property_id),
                    COALESCE(v_record.payment_status, v_record.status, 'pending'),
                    COALESCE(v_record.total_amount, 0),
                    COALESCE(v_record.total_amount, 0),
                    'USD',
                    v_record.customer_id,
                    v_record.id,
                    'restaurant_orders',
                    v_record.created_at,
                    v_record.completed_at,
                    jsonb_build_object('order_number', v_record.order_number, 'order_type', v_record.order_type)
                FROM modules m WHERE m.id = v_record.module_id;
                
                v_fixed := v_fixed + 1;
            EXCEPTION WHEN OTHERS THEN
                v_details := v_details || jsonb_build_object(
                    'operation', 'insert_missing',
                    'reference_id', v_record.id,
                    'error', SQLERRM
                );
            END;
        END LOOP;
        
    ELSIF p_source_table = 'chalet_bookings' THEN
        FOR v_record IN 
            SELECT cb.id, cb.status, cb.payment_status, cb.total_price, cb.property_id, cb.user_id, cb.created_at, cb.updated_at, cb.booking_number, cb.chalet_id
            FROM chalet_bookings cb
            LEFT JOIN transactions t ON t.reference_id = cb.id AND t.reference_table = 'chalet_bookings'
            WHERE t.id IS NULL
            AND cb.created_at > NOW() - INTERVAL '7 days'
        LOOP
            v_count := v_count + 1;
            
            BEGIN
                INSERT INTO transactions (
                    engine_type, property_id, status, amount, 
                    net_amount, currency, customer_id, reference_id, reference_table,
                    created_at, completed_at, metadata
                ) VALUES (
                    'time_exclusive_reservation',
                    v_record.property_id,
                    COALESCE(v_record.payment_status, v_record.status, 'pending'),
                    COALESCE(v_record.total_price, 0),
                    COALESCE(v_record.total_price, 0),
                    'USD',
                    v_record.user_id,
                    v_record.id,
                    'chalet_bookings',
                    v_record.created_at,
                    CASE WHEN v_record.status IN ('checked_out', 'CHECKED_OUT') THEN v_record.updated_at ELSE NULL END,
                    jsonb_build_object('booking_number', v_record.booking_number, 'chalet_id', v_record.chalet_id)
                );
                
                v_fixed := v_fixed + 1;
            EXCEPTION WHEN OTHERS THEN
                v_details := v_details || jsonb_build_object(
                    'operation', 'insert_missing',
                    'reference_id', v_record.id,
                    'error', SQLERRM
                );
            END;
        END LOOP;
        
    ELSIF p_source_table = 'pool_tickets' THEN
        FOR v_record IN 
            SELECT pt.id, pt.status, pt.payment_status, pt.total_price, pt.property_id, pt.user_id, pt.created_at, pt.ticket_number, pt.session_id
            FROM pool_tickets pt
            LEFT JOIN transactions t ON t.reference_id = pt.id AND t.reference_table = 'pool_tickets'
            WHERE t.id IS NULL
            AND pt.created_at > NOW() - INTERVAL '7 days'
        LOOP
            v_count := v_count + 1;
            
            BEGIN
                INSERT INTO transactions (
                    engine_type, property_id, status, amount, 
                    net_amount, currency, customer_id, reference_id, reference_table,
                    created_at, metadata
                ) VALUES (
                    'shared_capacity_access',
                    v_record.property_id,
                    COALESCE(v_record.payment_status, v_record.status, 'pending'),
                    COALESCE(v_record.total_price, 0),
                    COALESCE(v_record.total_price, 0),
                    'USD',
                    v_record.user_id,
                    v_record.id,
                    'pool_tickets',
                    v_record.created_at,
                    jsonb_build_object('ticket_number', v_record.ticket_number, 'session_id', v_record.session_id)
                );
                
                v_fixed := v_fixed + 1;
            EXCEPTION WHEN OTHERS THEN
                v_details := v_details || jsonb_build_object(
                    'operation', 'insert_missing',
                    'reference_id', v_record.id,
                    'error', SQLERRM
                );
            END;
        END LOOP;
    END IF;
    
    -- Log results
    INSERT INTO reconciliation_log (table_name, mismatches_found, mismatches_fixed, details)
    VALUES (p_source_table, v_count, v_fixed, v_details);
    
    RETURN QUERY SELECT v_count, v_fixed, v_details;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 3. ALERT FUNCTION - Notify on excessive drift
-- =============================================
CREATE OR REPLACE FUNCTION check_reconciliation_alerts()
RETURNS TABLE (alert_triggered BOOLEAN, message TEXT) AS $$
DECLARE
    v_recent_run RECORD;
    v_alert_threshold INTEGER := 10;  -- Alert if >10 mismatches in any table
BEGIN
    FOR v_recent_run IN 
        SELECT table_name, mismatches_found, mismatches_fixed, run_at
        FROM reconciliation_log
        WHERE run_at > NOW() - INTERVAL '1 hour'
        AND mismatches_found > v_alert_threshold
        AND NOT alert_sent
        ORDER BY run_at DESC
    LOOP
        -- Mark as alerted
        UPDATE reconciliation_log SET alert_sent = true 
        WHERE table_name = v_recent_run.table_name 
        AND run_at = v_recent_run.run_at;
        
        RETURN QUERY SELECT true, format(
            'RECONCILIATION ALERT: %s had %s mismatches (fixed: %s) at %s',
            v_recent_run.table_name,
            v_recent_run.mismatches_found,
            v_recent_run.mismatches_fixed,
            v_recent_run.run_at
        );
    END LOOP;
    
    RETURN QUERY SELECT false, 'No alerts';
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 4. SCHEDULE VIA PG_CRON (if available)
-- Fallback: Application must call reconcile_transactions() daily
-- =============================================
DO $$
BEGIN
    -- Try to schedule with pg_cron if available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Daily reconciliation at 3 AM
        PERFORM cron.schedule('reconcile-restaurant-orders', '0 3 * * *', 'SELECT reconcile_transactions(''restaurant_orders'')');
        PERFORM cron.schedule('reconcile-chalet-bookings', '0 3 * * *', 'SELECT reconcile_transactions(''chalet_bookings'')');
        PERFORM cron.schedule('reconcile-pool-tickets', '0 3 * * *', 'SELECT reconcile_transactions(''pool_tickets'')');
        PERFORM cron.schedule('reconciliation-alerts', '0 */6 * * *', 'SELECT check_reconciliation_alerts()');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available - application must schedule reconciliation manually';
END $$;

-- =============================================
-- 5. MANUAL EXECUTION WRAPPER
-- Call this from application scheduler if pg_cron unavailable
-- =============================================
CREATE OR REPLACE FUNCTION run_daily_reconciliation()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}'::JSONB;
    v_ro RECORD;
    v_cb RECORD;
    v_pt RECORD;
BEGIN
    SELECT * INTO v_ro FROM reconcile_transactions('restaurant_orders');
    SELECT * INTO v_cb FROM reconcile_transactions('chalet_bookings');
    SELECT * INTO v_pt FROM reconcile_transactions('pool_tickets');
    
    v_result := jsonb_build_object(
        'restaurant_orders', jsonb_build_object('found', v_ro.mismatches_found, 'fixed', v_ro.mismatches_fixed),
        'chalet_bookings', jsonb_build_object('found', v_cb.mismatches_found, 'fixed', v_cb.mismatches_fixed),
        'pool_tickets', jsonb_build_object('found', v_pt.mismatches_found, 'fixed', v_pt.mismatches_fixed),
        'run_at', NOW()
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- MANDATORY: Add to application startup checklist
-- =============================================
-- 1. Call run_daily_reconciliation() every 24 hours via job scheduler
-- 2. Monitor reconciliation_log table for trends
-- 3. Set up alerts when mismatches_found > threshold
-- =============================================
