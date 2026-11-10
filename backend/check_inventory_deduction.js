const { Pool } = require('pg');

// SECURITY: credentials are no longer hardcoded in source — resolved from
// the DATABASE_URL in backend/.env (same policy as the migration scripts).
const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is not defined in backend/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function checkInventoryDeduction() {
  try {
    // Check current stock of Wagyu Beef Patties
    const item = await pool.query(`
      SELECT id, name, current_stock, quantity, unit 
      FROM inventory_items 
      WHERE id = '934099d2-b7b0-4883-b94d-3019355f206d'
    `);
    console.log('Wagyu Beef Patties current state:');
    console.table(item.rows);

    // Check recent inventory transactions
    const transactions = await pool.query(`
      SELECT * FROM inventory_transactions 
      WHERE item_id = '934099d2-b7b0-4883-b94d-3019355f206d'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.log('\nRecent inventory transactions:');
    console.table(transactions.rows);

    // Check inventory batches
    const batches = await pool.query(`
      SELECT * FROM inventory_batches 
      WHERE item_id = '934099d2-b7b0-4883-b94d-3019355f206d'
      ORDER BY received_date DESC
      LIMIT 5
    `);
    console.log('\nInventory batches:');
    console.table(batches.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkInventoryDeduction();
