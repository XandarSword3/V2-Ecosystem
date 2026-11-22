import { hostname } from 'os';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { stripeClient } from '../config/stripe.js';
import { getEngineService } from '../engines/engine-service.js';
import { emailService } from '../services/email.service.js';

/**
 * Membership renewal (Batch 3, Task 3 — P0-10).
 *
 * Two independent protections against a double charge:
 *
 *   1. Distributed claim — `job_runs` has PK (job_name, run_window). Every
 *      instance tries the same INSERT; exactly one succeeds, the others get
 *      23505 and return immediately. No Redis, no process-local state.
 *
 *   2. Per-period idempotency — `membership_renewal_attempts` has
 *      UNIQUE (membership_id, billing_period_start). Even if two instances
 *      somehow both run, only one can claim the period. The Stripe invoice is
 *      additionally created with an idempotency key derived from
 *      membership id + period, so a retry after a network timeout returns the
 *      same invoice instead of charging twice.
 */

export interface RenewalRunOptions {
  /** UTC day (or any stable window token). Defaults to today's UTC date. */
  runWindow?: string;
  /** Identifies the claimant for audit. */
  claimedBy?: string;
}

function calculateRenewedEndDate(currentEndDate: string | null, billingCycle: string): string {
  const baseDate = currentEndDate ? new Date(currentEndDate) : new Date();
  const nextDate = new Date(baseDate);
  switch (billingCycle) {
    case 'MONTHLY':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'QUARTERLY':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    case 'ANNUALLY':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }
  return nextDate.toISOString();
}

function todayWindow(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Claim one run window. Returns false when another instance already owns it.
 */
export async function claimJobRun(
  jobName: string,
  runWindow: string,
  claimedBy: string,
): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase.from('job_runs').insert({
    job_name: jobName,
    run_window: runWindow,
    claimed_by: claimedBy,
  });

  if (!error) return true;

  if ((error as { code?: string }).code === '23505') {
    logger.info(`[JobClaim] ${jobName}/${runWindow} already claimed; skipping`, { claimedBy });
    return false;
  }

  logger.error(`[JobClaim] Failed to claim ${jobName}/${runWindow}`, error);
  // Fail closed: an unclaimable run must not proceed, otherwise every instance
  // would continue to the charge loop.
  return false;
}

async function finishJobRun(jobName: string, runWindow: string): Promise<void> {
  try {
    await getSupabase()
      .from('job_runs')
      .update({ finished_at: new Date().toISOString() })
      .eq('job_name', jobName)
      .eq('run_window', runWindow);
  } catch (error) {
    logger.warn('[JobClaim] Could not mark job run finished', {
      jobName,
      runWindow,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

type MembershipRow = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  status: string | null;
  end_date: string | null;
  billing_cycle: string | null;
  stripe_subscription_id: string | null;
  users?: { email?: string } | null;
};

/**
 * Renew one membership if this billing period has not been attempted yet.
 * Exported so the idempotency guarantee can be tested without the job claim.
 */
export async function renewMembershipIfDue(membership: MembershipRow): Promise<boolean> {
  const supabase = getSupabase();
  const engineService = getEngineService();

  if (!membership.stripe_subscription_id) {
    await supabase
      .from('pool_memberships')
      .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
      .eq('id', membership.id)
      .eq('tenant_id', membership.tenant_id);
    return false;
  }

  const periodStart = membership.end_date ?? new Date().toISOString();
  const periodEnd = calculateRenewedEndDate(membership.end_date, membership.billing_cycle || 'MONTHLY');
  const idempotencyKey = `membership_renewal:${membership.id}:${periodStart}`;

  // Claim the period. A conflict means another worker (or an earlier run)
  // already attempted it; never create a second invoice.
  const { data: claimed, error: claimError } = await supabase
    .from('membership_renewal_attempts')
    .upsert(
      {
        membership_id: membership.id,
        tenant_id: membership.tenant_id,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        status: 'claimed',
      },
      { onConflict: 'membership_id,billing_period_start', ignoreDuplicates: true },
    )
    .select('id');

  if (claimError) {
    logger.error('[Membership Renewal Job] Could not claim billing period', {
      membershipId: membership.id,
      error: claimError.message,
    });
    return false;
  }

  if (!claimed || claimed.length === 0) {
    logger.info('[Membership Renewal Job] Billing period already attempted; skipping', {
      membershipId: membership.id,
      periodStart,
    });
    return false;
  }

  const attemptId = (claimed[0] as { id: string }).id;
  let renewed = false;
  let lastError: unknown = null;

  try {
    const invoice = await stripeClient.invoices.create(
      {
        subscription: membership.stripe_subscription_id,
        collection_method: 'charge_automatically',
        auto_advance: true,
      },
      { idempotencyKey },
    );

    await stripeClient.invoices.pay(invoice.id, {}, { idempotencyKey: `${idempotencyKey}:pay` });

    const transition = await engineService.transitionState(
      'ongoing_entitlement',
      String(membership.status || 'ACTIVE').toLowerCase(),
      'renew',
      'system',
    );

    const nextStatus = transition.allowed ? transition.targetState.toUpperCase() : 'ACTIVE';
    await supabase
      .from('pool_memberships')
      .update({
        status: nextStatus,
        end_date: periodEnd,
        renewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.id)
      .eq('tenant_id', membership.tenant_id);

    await supabase
      .from('membership_renewal_attempts')
      .update({
        status: 'succeeded',
        stripe_invoice_id: invoice.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attemptId);

    renewed = true;
  } catch (renewError) {
    lastError = renewError;
    logger.warn('[Membership Renewal Job] Renewal attempt failed', {
      membershipId: membership.id,
      periodStart,
      error: renewError instanceof Error ? renewError.message : String(renewError),
    });
  }

  if (renewed) return true;

  await supabase
    .from('membership_renewal_attempts')
    .update({
      status: 'failed',
      error: lastError instanceof Error ? lastError.message : String(lastError),
      updated_at: new Date().toISOString(),
    })
    .eq('id', attemptId);

  await supabase
    .from('pool_memberships')
    .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
    .eq('id', membership.id)
    .eq('tenant_id', membership.tenant_id);

  const userEmail = (membership.users as { email?: string } | null)?.email;
  if (userEmail) {
    await emailService.sendEmail({
      to: userEmail,
      subject: 'Membership expired after renewal failures',
      html: `
        <h2>Membership Expired</h2>
        <p>We attempted to renew your membership but could not process payment.</p>
        <p>Your membership is now expired. Please update payment details and purchase/renew to restore access.</p>
      `,
    });
  }

  return false;
}

export async function runMembershipRenewalJob(options: RenewalRunOptions = {}): Promise<void> {
  const supabase = getSupabase();
  const runWindow = options.runWindow ?? todayWindow();
  const claimedBy = options.claimedBy ?? `${hostname()}:${process.pid}`;

  const claimed = await claimJobRun('membership_renewal', runWindow, claimedBy);
  if (!claimed) return;

  try {
    const { data: memberships, error } = await supabase
      .from('pool_memberships')
      .select('id, tenant_id, user_id, status, end_date, billing_cycle, stripe_subscription_id, users(email)')
      .in('status', ['ACTIVE', 'active'])
      .lt('end_date', new Date().toISOString());

    if (error) {
      logger.error('[Membership Renewal Job] Failed to query expired active memberships', error);
      return;
    }

    for (const membership of (memberships ?? []) as MembershipRow[]) {
      await renewMembershipIfDue(membership);
    }
  } finally {
    await finishJobRun('membership_renewal', runWindow);
  }
}
