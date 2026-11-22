/**
 * Detect SaaS subscriptions whose Stripe Price disagrees with the plan they
 * are supposed to be on (Batch 3, Task 4).
 *
 * Read-only: this script calls `subscriptions.retrieve` / `plans` and prints a
 * report. It never updates Stripe or Postgres.
 *
 * The bug it looks for: `changeTier` used to call `getPriceId(newTier)` with
 * the default monthly cycle, so an annual Pro -> Business change swapped the
 * tenant onto the monthly Business Price. Symptoms:
 *
 *   * the Stripe Price interval is `month` while `subscription.metadata.billing_cycle`
 *     is `annual` (or missing);
 *   * the Price ID is neither the plan's monthly nor annual Price from
 *     `plans`, i.e. a legacy/stale Price;
 *   * the plan's annual Price exists but the subscription bills monthly.
 *
 * Usage:
 *   npx tsx scripts/audit/detect-misrpriced-subscriptions.ts          # table
 *   npx tsx scripts/audit/detect-misrpriced-subscriptions.ts --json   # JSON
 *
 * Requires DATABASE_URL and STRIPE_SECRET_KEY in backend/.env.
 * Refuses a non-local DATABASE_URL unless ALLOW_REMOTE_READONLY=1, because
 * the usual intent is to inspect the local mirror; set the flag only for a
 * deliberate read against a non-local database.
 */

import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import Stripe from 'stripe';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const AS_JSON = process.argv.includes('--json');
const ALLOW_REMOTE = process.env.ALLOW_REMOTE_READONLY === '1';

interface TenantRow {
  id: string;
  name: string | null;
  subscription_tier: string | null;
  stripe_subscription_id: string | null;
}

interface PlanRow {
  code: string;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
}

interface Finding {
  tenantId: string;
  tenantName: string | null;
  subscriptionId: string;
  planCode: string | null;
  actualCycle: 'monthly' | 'annual';
  metadataCycle: string | null;
  currentPriceId: string;
  expectedPriceId: string | null;
  problems: string[];
}

function assertSafeTarget(connectionString: string): void {
  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (!/^(127\.0\.0\.1|localhost|::1)$/.test(host) && !ALLOW_REMOTE) {
    throw new Error(
      `Refusing to inspect non-local database host "${host}". ` +
        'Set ALLOW_REMOTE_READONLY=1 only for a reviewed, read-only run.',
    );
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is required');
  assertSafeTarget(databaseUrl);

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });

  try {
    const tenants = await pool.query<TenantRow>(
      `SELECT id, name, subscription_tier, stripe_subscription_id
         FROM tenants
        WHERE stripe_subscription_id IS NOT NULL
        ORDER BY id`,
    );
    const plans = await pool.query<PlanRow>(
      `SELECT code, stripe_monthly_price_id, stripe_annual_price_id
         FROM plans
        WHERE is_active = true`,
    );
    const planByCode = new Map(plans.rows.map((p) => [p.code, p]));

    const findings: Finding[] = [];

    for (const tenant of tenants.rows) {
      if (!tenant.stripe_subscription_id) continue;

      let subscription: Stripe.Subscription;
      try {
        subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);
      } catch (error) {
        findings.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          subscriptionId: tenant.stripe_subscription_id,
          planCode: tenant.subscription_tier,
          actualCycle: 'monthly',
          metadataCycle: null,
          currentPriceId: '(unavailable)',
          expectedPriceId: null,
          problems: [
            `could not retrieve subscription: ${error instanceof Error ? error.message : String(error)}`,
          ],
        });
        continue;
      }

      const price = subscription.items.data[0]?.price;
      const interval = price?.recurring?.interval;
      const actualCycle: 'monthly' | 'annual' = interval === 'year' ? 'annual' : 'monthly';
      const metadataCycle = subscription.metadata?.billing_cycle ?? null;
      const planCode = tenant.subscription_tier;
      const plan = planCode ? planByCode.get(planCode) : undefined;
      const expectedPriceId = plan
        ? actualCycle === 'annual'
          ? plan.stripe_annual_price_id
          : plan.stripe_monthly_price_id
        : null;

      const problems: string[] = [];
      if (!metadataCycle) {
        problems.push('subscription metadata has no billing_cycle (predates the fix or was overwritten)');
      } else if (metadataCycle !== actualCycle) {
        problems.push(`metadata billing_cycle='${metadataCycle}' but Stripe Price interval is '${interval}'`);
      }
      if (planCode && !plan) {
        problems.push(`tenant subscription_tier='${planCode}' has no active plans row`);
      }
      if (expectedPriceId && price && price.id !== expectedPriceId) {
        problems.push(
          `current Price ${price.id} is not the ${actualCycle} Price for plan '${planCode}' (${expectedPriceId})`,
        );
      }
      if (actualCycle === 'monthly' && plan?.stripe_annual_price_id && metadataCycle === 'annual') {
        problems.push('billing on a monthly Price while metadata claims annual');
      }

      if (problems.length > 0) {
        findings.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          subscriptionId: tenant.stripe_subscription_id,
          planCode,
          actualCycle,
          metadataCycle,
          currentPriceId: price?.id ?? '(no price)',
          expectedPriceId,
          problems,
        });
      }
    }

    if (AS_JSON) {
      process.stdout.write(`${JSON.stringify({ checked: tenants.rowCount, findings }, null, 2)}\n`);
    } else {
      console.log(`Checked ${tenants.rowCount} tenant subscription(s); ${findings.length} finding(s).`);
      for (const finding of findings) {
        console.log(
          `\n- tenant ${finding.tenantId} (${finding.tenantName ?? 'unnamed'}) plan=${finding.planCode ?? '?'} ` +
            `sub=${finding.subscriptionId}`,
        );
        console.log(
          `  price=${finding.currentPriceId} interval=${finding.actualCycle} metadata.billing_cycle=${finding.metadataCycle ?? 'null'}`,
        );
        for (const problem of finding.problems) console.log(`  ! ${problem}`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
