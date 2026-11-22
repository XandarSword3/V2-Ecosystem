/**
 * Batch 3, Task 0b — test-environment containment guard.
 *
 * A test run must never reach a remote database, Supabase project, or a
 * shared/remote Redis. `.env.test` is supposed to pin everything to
 * 127.0.0.1, but two escape hatches existed:
 *
 *   1. Shell environment variables win over `.env.test` because
 *      `dotenv.config()` does not override existing keys.
 *   2. `backend/.env` (remote) is loaded second and fills any key that
 *      `.env.test` does not define.
 *
 * `assertLocalTestEnvironment()` closes both by aborting at startup when a
 * connection-bearing variable resolves to a non-loopback host.
 *
 * Loopback hosts allowed: 127.0.0.1, ::1, localhost.
 * Redis must additionally use port 6380 (the dedicated test container).
 *
 * There is deliberately no bypass flag.
 */

export const GUARDED_VARS = [
  'DATABASE_URL',
  'TEST_DATABASE_URL',
  'SUPABASE_URL',
  'REDIS_URL',
  'TEST_REDIS_URL',
  'UPSTASH_REDIS_REST_URL',
] as const;

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]', '0.0.0.0']);

export function hostOf(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

export function resolvedHosts(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of GUARDED_VARS) {
    const value = env[key];
    if (!value || value.trim() === '') continue;
    out[key] = hostOf(value.trim()) ?? '(unparseable)';
  }
  return out;
}

export function assertLocalTestEnvironment(env: NodeJS.ProcessEnv = process.env, suite = 'test'): void {
  const problems: string[] = [];

  for (const key of GUARDED_VARS) {
    const raw = env[key];
    if (!raw || raw.trim() === '') continue;
    const value = raw.trim();
    const host = hostOf(value);

    if (host === null) {
      problems.push(`${key} is set but is not a parseable URL (value withheld)`);
      continue;
    }
    if (!LOOPBACK_HOSTS.has(host)) {
      problems.push(
        `${key} points at non-local host "${host}" — ${suite} runs may only reach loopback (127.0.0.1 / ::1 / localhost)`
      );
      continue;
    }
    // Redis must use the dedicated test container, never a shared local instance.
    if (key === 'REDIS_URL' || key === 'TEST_REDIS_URL') {
      const port = new URL(value).port || '6379';
      if (port !== '6380') {
        problems.push(
          `${key} points at local port ${port} — the test Redis must be the dedicated container on 6380`
        );
      }
    }
  }

  if (env.PRINT_TEST_ENV_HOSTS === '1') {
    // eslint-disable-next-line no-console
    console.log(`[env-guard] ${suite} resolved hosts: ${JSON.stringify(resolvedHosts(env))}`);
  }

  if (problems.length > 0) {
    throw new Error(
      `\n[env-guard] ABORTING ${suite} run — remote or shared test infrastructure detected:\n` +
        problems.map((p) => `  - ${p}`).join('\n') +
        `\n\nFix backend/.env.test so every connection variable points at loopback ` +
        `(Redis on 6380) and unset any conflicting shell variables.\n`
    );
  }
}
