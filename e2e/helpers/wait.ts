/**
 * e2e/helpers/wait.ts
 *
 * Retry/polling helpers for operations that are inherently async —
 * primarily webhook processing and DB writes that happen out-of-band.
 *
 * Usage:
 *   await pollUntil(
 *     () => getTenantBillingStatus('testcorp'),
 *     (status) => status === 'past_due',
 *     { timeout: 10_000, label: 'billing_status → past_due' }
 *   );
 */

export interface PollOptions {
  /** Max time to wait in ms. Default: 10_000 */
  timeout?: number;
  /** Interval between checks in ms. Default: 500 */
  interval?: number;
  /** Label for the timeout error message */
  label?: string;
}

/**
 * Polls `fn` every `interval` ms until `predicate` returns true,
 * or throws when `timeout` is exceeded.
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  options: PollOptions = {}
): Promise<T> {
  const { timeout = 10_000, interval = 500, label = 'condition' } = options;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const value = await fn();
    if (predicate(value)) return value;
    await sleep(interval);
  }

  throw new Error(
    `[wait] Timed out after ${timeout}ms waiting for: ${label}`
  );
}

/**
 * Simple sleep. Use sparingly — prefer pollUntil for observable state.
 * Acceptable for fixed propagation delays (e.g. webhook → DB write settling).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for a DB row to reach an expected field value.
 * Thin wrapper over pollUntil for the common "wait for webhook to process" case.
 *
 * Example:
 *   await waitForDbField(
 *     () => db.from('tenants').select('billing_status').eq('subdomain','testcorp').single(),
 *     'billing_status',
 *     'past_due'
 *   );
 */
export async function waitForDbField<T extends Record<string, unknown>>(
  queryFn: () => Promise<{ data: T | null; error: unknown }>,
  field: keyof T,
  expected: unknown,
  options: PollOptions = {}
): Promise<T> {
  return pollUntil(
    async () => {
      const { data, error } = await queryFn();
      if (error) throw new Error(`[wait] DB query failed: ${JSON.stringify(error)}`);
      return data;
    },
    (data) => data !== null && data[field] === expected,
    { label: `${String(field)} === ${expected}`, ...options }
  ) as Promise<T>;
}
