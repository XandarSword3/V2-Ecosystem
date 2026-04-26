import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { stripeClient } from '../config/stripe.js';
import { getEngineService } from '../engines/engine-service.js';
import { emailService } from '../services/email.service.js';

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

export async function runMembershipRenewalJob(): Promise<void> {
  const supabase = getSupabase();
  const engineService = getEngineService();

  const { data: memberships, error } = await supabase
    .from('pool_memberships')
    .select('id, user_id, status, end_date, billing_cycle, stripe_subscription_id, users(email)')
    .eq('status', 'ACTIVE')
    .lt('end_date', new Date().toISOString());

  if (error) {
    logger.error('[Membership Renewal Job] Failed to query expired active memberships', error);
    return;
  }

  for (const membership of memberships ?? []) {
    if (!membership.stripe_subscription_id) {
      await supabase
        .from('pool_memberships')
        .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
        .eq('id', membership.id);
      continue;
    }

    let renewed = false;
    let attempts = 0;

    while (!renewed && attempts < 3) {
      attempts += 1;
      try {
        const invoice = await stripeClient.invoices.create({
          subscription: membership.stripe_subscription_id,
          collection_method: 'charge_automatically',
          auto_advance: true,
        });

        await stripeClient.invoices.pay(invoice.id);

        const transition = await engineService.transitionState(
          'subscription',
          String(membership.status || 'active').toLowerCase(),
          'renew',
          'system',
        );

        const nextStatus = transition.allowed ? transition.targetState.toUpperCase() : 'ACTIVE';
        await supabase
          .from('pool_memberships')
          .update({
            status: nextStatus,
            end_date: calculateRenewedEndDate(membership.end_date, membership.billing_cycle || 'MONTHLY'),
            renewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', membership.id);

        renewed = true;
      } catch (renewError) {
        logger.warn('[Membership Renewal Job] Renewal attempt failed', {
          membershipId: membership.id,
          attempts,
          error: renewError instanceof Error ? renewError.message : String(renewError),
        });
      }
    }

    if (renewed) {
      continue;
    }

    await supabase
      .from('pool_memberships')
      .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
      .eq('id', membership.id);

    const userEmail = (membership.users as { email?: string } | null)?.email;
    if (userEmail) {
      await emailService.sendEmail({
        to: userEmail,
        subject: 'Membership expired after renewal failures',
        html: `
          <h2>Membership Expired</h2>
          <p>We attempted to renew your membership three times but could not process payment.</p>
          <p>Your membership is now expired. Please update payment details and purchase/renew to restore access.</p>
        `,
      });
    }
  }
}
