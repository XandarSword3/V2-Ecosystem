
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const sqlPath = path.resolve(__dirname, '../supabase/migrations/20260224000000_atomic_safety_functions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  try {
     const res = await axios.post('http://localhost:3005/admin/execute-sql-fix', { sql }, {
         headers: { 'x-admin-secret': 'temp-fix-secret-123' }
     });
     console.log('Success:', res.data);
  } catch (e) {
     console.error('Failed:', e.response?.data || e.message);
  }
}
run();
