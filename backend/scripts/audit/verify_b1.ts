import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

async function probeRestAnon() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  console.log('Testing anon PostgREST probe to:', url);

  for (const endpoint of ['transactions', 'engine_financial_ledger', 'token_blacklist', 'payments']) {
    try {
      const res = await fetch(`${url}/rest/v1/${endpoint}?select=*&limit=5`, {
        headers: {
          apikey: anonKey!,
          Authorization: `Bearer ${anonKey}`,
        },
      });
      const data = await res.json().catch(() => null);
      console.log(`[ANON REST] ${endpoint}: status=${res.status}, rows=${Array.isArray(data) ? data.length : 'not-array'}, body=`, data);
    } catch (e: any) {
      console.log(`[ANON REST] ${endpoint}: failed with error ${e.message}`);
    }
  }
}

probeRestAnon().catch(console.error);
