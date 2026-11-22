import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, execSync, ChildProcess } from 'child_process';
import { makePool, ensureFixtures, cleanupFixtures } from './fixtures';

const BACKEND = process.cwd();
const EVIDENCE = path.resolve(BACKEND, '../../docs/audit-evidence/tests');
const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;

let child: ChildProcess | null = null;

function writeEvidence(file: string, text: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE, file), text, 'utf8');
}

async function waitForHealth(timeoutMs = 90000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child && child.exitCode !== null) {
      throw new Error(`backend exited early with code ${child.exitCode}; see docs/audit-evidence/tests/backend.log`);
    }
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('backend did not become healthy on port 3199 within 90s');
}

export async function setup(): Promise<void> {
  // 1. Local-only env. .env (remote) is never read.
  dotenv.config({ path: path.resolve(BACKEND, '.env.test'), override: true });
  process.env.SUPABASE_DB_PASSWORD = '';
  process.env.STRIPE_SECRET_KEY = '';
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:15421';
  process.env.REDIS_URL = 'redis://127.0.0.1:6380/0';
  process.env.CSRF_BYPASS_IN_TESTS = 'true';

  const preflight = [
    `SUPABASE_URL=${process.env.SUPABASE_URL}`,
    `DATABASE_URL_HOST=${new URL(process.env.DATABASE_URL as string).hostname}`,
    `SUPABASE_DB_PASSWORD_SET=${Boolean(process.env.SUPABASE_DB_PASSWORD)}`,
    `STRIPE_SECRET_KEY_SET=${Boolean(process.env.STRIPE_SECRET_KEY)}`,
    `REDIS_URL=${process.env.REDIS_URL}`,
  ].join('\n');
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE, 'preflight.txt'), preflight + '\n', 'utf8');

  // 2. Fixtures.
  const pool = makePool();
  try {
    await ensureFixtures(pool);
  } finally {
    await pool.end();
  }

  // 3. Port must be free (a stale server would invalidate the run).
  try {
    const res = await fetch(`${BASE}/health`);
    if (res.ok) throw new Error(`port ${PORT} already serving a backend; kill it before running the audit suite`);
  } catch (err: any) {
    if (String(err?.message).includes('already serving')) throw err;
  }

  // 4. Start the backend from the temp dir so no .env is auto-loaded.
  const tempCwd = path.join(os.tmpdir(), 'opencode-audit-suite');
  fs.mkdirSync(tempCwd, { recursive: true });
  const logPath = path.join(EVIDENCE, 'backend.log');
  const log = fs.createWriteStream(logPath, { flags: 'w' });

  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.SUPABASE_DB_PASSWORD;
  env.PORT = String(PORT);
  env.NODE_ENV = 'development';
  env.REDIS_URL = 'redis://127.0.0.1:6399/0';
  env.REDIS_ENABLED = 'false';
  // Offline values: a dummy key lets the handler construct a Stripe client
  // (constructEvent is local crypto) without any chance of a live call, and a
  // known platform webhook secret lets Task 2 prove the null-tenant fallback.
  env.STRIPE_SECRET_KEY = 'sk_test_audit_platform_offline';
  env.STRIPE_WEBHOOK_SECRET = 'whsec_platform_audit_task2';
  env.CSRF_BYPASS_IN_TESTS = 'true';

  const tsxCli = path.join(BACKEND, 'node_modules/tsx/dist/cli.mjs');
  const entry = path.join(BACKEND, 'src/index.ts');
  child = spawn(process.execPath, [tsxCli, entry], {
    cwd: tempCwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);

  fs.writeFileSync(
    path.join(EVIDENCE, 'backend-start.txt'),
    `pid=${child.pid}\ncwd=${tempCwd}\nentry=${entry}\nport=${PORT}\n` +
      `SUPABASE_URL=${env.SUPABASE_URL}\nDATABASE_URL_HOST=${new URL(env.DATABASE_URL as string).hostname}\n` +
      `SUPABASE_DB_PASSWORD_SET=${Boolean(env.SUPABASE_DB_PASSWORD)}\nSTRIPE_SECRET_KEY_SET=${Boolean(env.STRIPE_SECRET_KEY)}\n`,
    'utf8',
  );

  await waitForHealth();
}

export async function teardown(): Promise<void> {
  if (child?.pid) {
    try {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
    }
  }

  const pool = makePool();
  try {
    await cleanupFixtures(pool);
    const counts = await pool.query(
      `SELECT
         (SELECT count(*) FROM users WHERE id = ANY($1::uuid[]))::int AS users,
         (SELECT count(*) FROM modules WHERE tenant_id = ANY($2::uuid[]))::int AS modules,
         (SELECT count(*) FROM transactions WHERE tenant_id = ANY($2::uuid[]))::int AS transactions,
         (SELECT count(*) FROM reservations WHERE tenant_id = ANY($2::uuid[]))::int AS reservations,
         (SELECT count(*) FROM service_locations WHERE tenant_id = ANY($2::uuid[]))::int AS locations,
         (SELECT count(*) FROM payments WHERE tenant_id = ANY($2::uuid[]))::int AS payments,
         (SELECT count(*) FROM tenants WHERE id = ANY($2::uuid[]))::int AS tenants`,
      [
        ['a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-00000000000c'],
        ['aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002'],
      ],
    );
    const triggers = await pool.query(
      `SELECT tgname, tgenabled FROM pg_trigger WHERE tgname IN ('fulfillment_events_immutability_trigger','ensure_fulfillment_on_confirm')`,
    );
    writeEvidence(
      'cleanup-verification.txt',
      `counts=${JSON.stringify(counts.rows[0])}\ntriggers=${JSON.stringify(triggers.rows)}\nport3199_stopped=${child?.exitCode !== null || child?.killed ? 'yes' : 'unknown'}\n`,
    );
  } finally {
    await pool.end();
  }
}
