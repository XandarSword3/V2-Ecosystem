import fs from "fs";
import path from "path";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const { Pool } = pg;

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(" DATABASE_URL is not defined in .env");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log(" Connected");

    const sqlPath = path.join(__dirname, "../database/migrations/create_permissions_tables.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    
    console.log(" Executing Permissions Migration...");
    await client.query(sql);
    console.log(" Permissions tables created and seeded!");
    
    client.release();
  } catch (error: unknown) {
    const err = error as Error;
    console.error(" Migration failed:", err.message);
  } finally {
    await pool.end();
  }
}

run();