// Verifies reserve_unit_exclusive_atomic (post discount/tax migration) against the
// real remote Postgres. Everything runs inside one transaction that is ALWAYS rolled
// back at the end (finally block) — zero residue regardless of pass/fail.
require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const results = [];
  const assert = (name, cond, extra) => {
    results.push({ name, pass: !!cond, extra });
  };

  try {
    await client.query('BEGIN');

    // 1. Confirm the function signature now has the new params
    const sig = await client.query(`
      SELECT pg_get_function_identity_arguments(oid) AS args
      FROM pg_proc WHERE proname = 'reserve_unit_exclusive_atomic'
    `);
    const argsText = sig.rows[0]?.args || '';
    assert('function has p_discount_amount param', argsText.includes('p_discount_amount'), argsText);
    assert('function has p_tax_amount param', argsText.includes('p_tax_amount'), argsText);

    // 2. Find a real, active module of the right engine type + a bookable unit under it.
    // accommodation_units currently has zero rows in this DB at all, so if none is found,
    // seed one temporary fixture row scoped to a real multi_day_booking module's
    // tenant_id/property_id. This only lives inside this transaction, which is always
    // rolled back — zero residue on the live DB either way.
    let moduleRow = await client.query(`
      SELECT m.id AS module_id, au.id AS unit_id, au.base_price, au.weekend_price
      FROM modules m
      JOIN accommodation_units au ON au.module_id = m.id
      WHERE m.template_type = 'multi_day_booking'
        AND au.is_active = true
      LIMIT 1
    `);

    if (moduleRow.rows.length === 0) {
      const seedModule = await client.query(`
        SELECT id AS module_id, tenant_id, property_id
        FROM modules WHERE template_type = 'multi_day_booking'
        LIMIT 1
      `);
      if (seedModule.rows.length > 0) {
        const { module_id, tenant_id, property_id } = seedModule.rows[0];
        const seedUnit = await client.query(
          `INSERT INTO accommodation_units (name, base_price, weekend_price, is_active, module_id, tenant_id, property_id)
           VALUES ('TEST FIXTURE UNIT (rolled back)', 200, 250, true, $1, $2, $3)
           RETURNING id AS unit_id, base_price, weekend_price`,
          [module_id, tenant_id, property_id]
        );
        moduleRow = { rows: [{ module_id, ...seedUnit.rows[0] }] };
        assert('seeded temporary accommodation_unit fixture (no live rows existed)', true, seedUnit.rows[0]);
      }
    }

    if (moduleRow.rows.length === 0) {
      assert('found a real module+unit to test against', false, 'none found — falling back to synthetic UUIDs (RPC should still run, just report on structure)');
    } else {
      const { module_id, unit_id } = moduleRow.rows[0];

      const checkIn = '2027-03-01';
      const checkOut = '2027-03-03';

      const rpcRes = await client.query(
        `SELECT * FROM reserve_unit_exclusive_atomic(
           p_unit_id := $1,
           p_module_id := $2,
           p_check_in_date := $3,
           p_check_out_date := $4,
           p_customer_id := NULL,
           p_amount := 200.00,
           p_metadata := '{}'::jsonb,
           p_discount_amount := 25.50,
           p_tax_amount := 10.00
         )`,
        [unit_id, module_id, checkIn, checkOut]
      );

      const row = rpcRes.rows[0];
      assert('RPC call succeeded', row?.success === true, row);

      if (row?.success) {
        const txnRes = await client.query(
          `SELECT amount, net_amount, discount_amount, tax_amount, metadata FROM transactions WHERE id = $1`,
          [row.transaction_id]
        );
        const txn = txnRes.rows[0];
        assert('amount persisted correctly', Number(txn.amount) === 200, txn.amount);
        assert('discount_amount persisted correctly (was always 0 before fix)', Number(txn.discount_amount) === 25.5, txn.discount_amount);
        assert('tax_amount persisted correctly (was always 0 before fix)', Number(txn.tax_amount) === 10, txn.tax_amount);
        assert('metadata still has unit_id/dates (unchanged behavior)', txn.metadata.unit_id === unit_id && txn.metadata.check_in_date === checkIn, txn.metadata);
      }

      // 3. Confirm double-booking protection still works (unchanged core behavior)
      if (row?.success) {
        const overlapRes = await client.query(
          `SELECT * FROM reserve_unit_exclusive_atomic(
             p_unit_id := $1, p_module_id := $2,
             p_check_in_date := $3, p_check_out_date := $4,
             p_amount := 999
           )`,
          [unit_id, module_id, checkIn, checkOut]
        );
        assert('double-booking still rejected', overlapRes.rows[0]?.success === false && /booked/i.test(overlapRes.rows[0]?.error_message || ''), overlapRes.rows[0]);
      }

      // 4. Confirm past-date rejection still works (unchanged core behavior)
      const pastRes = await client.query(
        `SELECT * FROM reserve_unit_exclusive_atomic(
           p_unit_id := $1, p_module_id := $2,
           p_check_in_date := '2020-01-01', p_check_out_date := '2020-01-02',
           p_amount := 50
         )`,
        [unit_id, module_id]
      );
      assert('past check-in still rejected', pastRes.rows[0]?.success === false && /past/i.test(pastRes.rows[0]?.error_message || ''), pastRes.rows[0]);

      // 5. Confirm old-style call (no discount/tax args) still works — backward compatibility
      const legacyCheckIn = '2027-04-01';
      const legacyCheckOut = '2027-04-02';
      const legacyRes = await client.query(
        `SELECT * FROM reserve_unit_exclusive_atomic($1, $2, $3, $4, NULL, 80.00, '{}'::jsonb)`,
        [unit_id, module_id, legacyCheckIn, legacyCheckOut]
      );
      assert('legacy positional call (no discount/tax) still works', legacyRes.rows[0]?.success === true, legacyRes.rows[0]);
      if (legacyRes.rows[0]?.success) {
        const legacyTxn = await client.query(
          `SELECT discount_amount, tax_amount FROM transactions WHERE id = $1`,
          [legacyRes.rows[0].transaction_id]
        );
        assert('legacy call defaults discount/tax to 0', Number(legacyTxn.rows[0].discount_amount) === 0 && Number(legacyTxn.rows[0].tax_amount) === 0, legacyTxn.rows[0]);
      }
    }
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }

  console.log('\n=== RESULTS ===');
  let allPass = true;
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} — ${r.name}`, r.pass ? '' : JSON.stringify(r.extra));
    if (!r.pass) allPass = false;
  }
  console.log(allPass ? '\nALL PASS (transaction rolled back, zero residue)' : '\nSOME FAILED (transaction rolled back, zero residue)');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('SCRIPT ERROR:', err.message);
  process.exit(1);
});