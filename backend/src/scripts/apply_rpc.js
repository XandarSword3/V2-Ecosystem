const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const sql = `-- Atomic Chalet Booking RPC with Overlap Check
CREATE OR REPLACE FUNCTION create_chalet_booking_safe(
  p_chalet_id UUID,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_check_in_date TIMESTAMPTZ,
  p_check_out_date TIMESTAMPTZ,
  p_number_of_guests INTEGER,
  p_number_of_nights INTEGER,
  p_base_amount NUMERIC(15,2),
  p_add_ons_amount NUMERIC(15,2),
  p_deposit_amount NUMERIC(15,2),
  p_total_amount NUMERIC(15,2),
  p_payment_method TEXT,
  p_special_requests TEXT,
  p_booking_number TEXT,
  p_customer_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_overlap_count INTEGER;
  v_booking_record RECORD;
BEGIN
  -- 1. Locking: Acquire an exclusive lock on the specific chalet row to serialize bookings for it
  PERFORM * FROM chalets WHERE id = p_chalet_id FOR UPDATE;

  -- 2. Availability Check
  SELECT count(*)
  INTO v_overlap_count
  FROM chalet_bookings
  WHERE chalet_id = p_chalet_id
    AND status NOT IN ('cancelled', 'no_show')
    AND deleted_at IS NULL
    AND (p_check_in_date < check_out_date AND p_check_out_date > check_in_date);

  IF v_overlap_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chalet is already booked for the selected dates');
  END IF;

  -- 3. Atomic Insertion
  INSERT INTO chalet_bookings (
    booking_number, 
    chalet_id, 
    customer_id, 
    customer_name, 
    customer_email, 
    customer_phone, 
    check_in_date, 
    check_out_date, 
    number_of_guests, 
    number_of_nights, 
    base_amount, 
    add_ons_amount, 
    deposit_amount, 
    total_amount, 
    status, 
    payment_status, 
    payment_method, 
    special_requests
  ) VALUES (
    p_booking_number, 
    p_chalet_id, 
    p_customer_id, 
    p_customer_name, 
    p_customer_email, 
    p_customer_phone, 
    p_check_in_date, 
    p_check_out_date, 
    p_number_of_guests, 
    p_number_of_nights, 
    p_base_amount, 
    p_add_ons_amount, 
    p_deposit_amount, 
    p_total_amount, 
    'pending', 
    'pending', 
    p_payment_method, 
    p_special_requests
  ) RETURNING * INTO v_booking_record;

  RETURN jsonb_build_object(
    'success', true, 
    'id', v_booking_record.id,
    'booking_number', v_booking_record.booking_number,
    'total_amount', v_booking_record.total_amount,
    'status', v_booking_record.status,
    'check_in_date', v_booking_record.check_in_date,
    'check_out_date', v_booking_record.check_out_date,
    'payment_status', v_booking_record.payment_status
  );
END;
$$ LANGUAGE plpgsql;`;

async function run() {
    const connectionString = process.env.DATABASE_URL || process.env.STRESS_TEST_DB_URL;
    if (!connectionString) {
        console.error('DATABASE_URL or STRESS_TEST_DB_URL not found in environment');
        process.exit(1);
    }

    const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

    const pool = new Pool({
        connectionString,
        ssl: isLocal ? false : { rejectUnauthorized: false }
    });

    try {
        console.log('Applying RPC migration...');
        await pool.query(sql);
        console.log('RPC migration applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
