
import axios from 'axios';

async function run() {
  const sql = "SELECT string_agg(column_name, ', ') as columns FROM information_schema.columns WHERE table_name = 'pool_tickets'";
  
  try {
     const res = await axios.post('http://localhost:3005/admin/execute-sql-fix', { sql }, {
         headers: { 'x-admin-secret': 'temp-fix-secret-123' }
     });
     console.log('Pool Sessions Count:', res.data);
  } catch (e) {
     console.error('Failed:', e.response?.data || e.message);
  }
}
run();
