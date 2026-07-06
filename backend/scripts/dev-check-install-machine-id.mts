/**
 * DEV-ONLY diagnostic. Reproduces install.controller.ts's deriveMachineId()
 * exactly, compares it against whatever is stored in system_config, and
 * dumps every non-internal network interface so we can see if there's
 * more than one candidate MAC (which would make the derivation unstable
 * across runs / adapters / VPN state).
 */
import os from 'os';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function deriveMachineId(): { id: string; hostname: string; mac: string } {
  const hostname = os.hostname();
  let mac = 'no-mac';
  const ifaces = os.networkInterfaces();
  outer: for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        mac = iface.mac;
        break outer;
      }
    }
  }
  const id = crypto.createHash('sha256').update(`${hostname}:${mac}`).digest('hex');
  return { id, hostname, mac };
}

async function main() {
  console.log('=== All non-internal network interfaces (candidates for MAC selection) ===');
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (!iface.internal) {
        console.log(`- ${name}: mac=${iface.mac} family=${iface.family} address=${iface.address}`);
      }
    }
  }

  const current = deriveMachineId();
  console.log('\n=== Current derived machine ID ===');
  console.log('hostname:', current.hostname);
  console.log('mac used:', current.mac);
  console.log('id:', current.id);

  console.log('\n=== Stored system_config row (install.machine_id) ===');
  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .eq('key', 'install.machine_id')
    .maybeSingle();

  if (error) {
    console.log('Query error:', error.message);
  } else if (!data) {
    console.log('No row found at all — genuine first boot, install was never completed on this DB.');
  } else {
    console.log('Row:', JSON.stringify(data, null, 2));
    const storedId = data.value?.id;
    console.log('\n=== Comparison ===');
    console.log('stored id: ', storedId);
    console.log('current id:', current.id);
    console.log('MATCH:', storedId === current.id);
  }
}

main();
