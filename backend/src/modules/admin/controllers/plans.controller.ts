import { Request, Response } from 'express';
import Stripe from 'stripe';
import { asyncHandler } from '../../../middleware/async-handler.js';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';

/**
 * Plans Controller
 *
 * Full CRUD for the platform-level plans table, with automatic Stripe sync.
 *
 * On CREATE — creates a Stripe Product + monthly/annual Prices and stores the
 *             returned IDs directly in the DB. No manual pasting.
 * On UPDATE — updates the Stripe Product if name/description changed; archives
 *             old Prices and creates new ones if amounts changed (Stripe prices
 *             are immutable). If the plan had no Stripe product yet (e.g. saved
 *             before STRIPE_SECRET_KEY was configured), creates it now.
 * On DELETE — archives the Stripe Product before deleting from DB (Stripe does
 *             not allow hard-deleting products that have prices).
 *
 * Stripe sync is non-fatal: if STRIPE_SECRET_KEY is absent or a Stripe call
 * fails, the plan is saved to the DB and a warning is logged. The card footer
 * on the plans page shows unsynced status until Stripe catches up.
 *
 * All routes require super_admin authorization (enforced in admin.routes.ts).
 */

// ─── Stripe client ────────────────────────────────────────────────────────────
// Returns null instead of throwing when STRIPE_SECRET_KEY is absent — plan
// CRUD still works in environments that haven't connected Stripe yet.

let _stripe: Stripe | null = null;

function getStripeClient(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key, {
    apiVersion: '2023-10-16',
    typescript: true,
    appInfo: { name: 'V2 Platform SaaS', version: '2.0.0' },
  });
  return _stripe;
}

// ─── Stripe sync ──────────────────────────────────────────────────────────────

interface StripePlanIds {
  stripe_product_id: string;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
}

/**
 * Create a Stripe Product and its monthly/annual Prices for a new plan.
 * Skips creating a Price for tiers priced at zero (free plans).
 * Returns null if Stripe is not configured.
 */
async function createStripeProduct(plan: {
  code: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
}): Promise<StripePlanIds | null> {
  const stripe = getStripeClient();
  if (!stripe) {
    logger.warn('[Plans] STRIPE_SECRET_KEY not set — plan saved without Stripe product');
    return null;
  }

  const product = await stripe.products.create({
    name: plan.name,
    ...(plan.description ? { description: plan.description } : {}),
    metadata: { plan_code: plan.code },
  });

  const monthlyPrice = plan.price_monthly_cents > 0
    ? await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price_monthly_cents,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { plan_code: plan.code, billing_interval: 'monthly' },
      })
    : null;

  const annualPrice = plan.price_annual_cents > 0
    ? await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price_annual_cents,
        currency: 'usd',
        recurring: { interval: 'year' },
        metadata: { plan_code: plan.code, billing_interval: 'annual' },
      })
    : null;

  logger.info('[Plans] Stripe product and prices created', {
    code: plan.code,
    productId: product.id,
    monthlyPriceId: monthlyPrice?.id ?? null,
    annualPriceId: annualPrice?.id ?? null,
  });

  return {
    stripe_product_id: product.id,
    stripe_monthly_price_id: monthlyPrice?.id ?? null,
    stripe_annual_price_id: annualPrice?.id ?? null,
  };
}

/**
 * Sync edits to an existing plan's Stripe Product.
 *
 * - Name/description change → update Product fields
 * - Price change → archive the old Price (immutable in Stripe), create a new one
 *
 * Only syncs fields that are actually present in `updates` AND differ from
 * existing values, so a description-only edit doesn't churn prices.
 *
 * Returns any new stripe IDs that need to be written back to the DB.
 */
async function syncStripeProductUpdate(params: {
  stripe_product_id: string;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
  plan_code: string;
  existing: { price_monthly_cents: number; price_annual_cents: number };
  updates: {
    name?: string;
    description?: string | null;
    price_monthly_cents?: number;
    price_annual_cents?: number;
  };
}): Promise<Partial<StripePlanIds>> {
  const stripe = getStripeClient();
  if (!stripe) return {};

  const { stripe_product_id, stripe_monthly_price_id, stripe_annual_price_id, plan_code, existing, updates } = params;
  const newIds: Partial<StripePlanIds> = {};

  // Update product metadata if name or description changed
  if (updates.name !== undefined || updates.description !== undefined) {
    await stripe.products.update(stripe_product_id, {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      // Stripe doesn't accept null — pass empty string to clear description
      ...(updates.description !== undefined ? { description: updates.description ?? '' } : {}),
    });
  }

  // Monthly price changed → archive old, create new
  if (updates.price_monthly_cents !== undefined && updates.price_monthly_cents !== existing.price_monthly_cents) {
    if (stripe_monthly_price_id) {
      await stripe.prices.update(stripe_monthly_price_id, { active: false }).catch((err) => {
        logger.warn('[Plans] Could not archive old monthly price (already inactive?)', { priceId: stripe_monthly_price_id, err });
      });
    }
    if (updates.price_monthly_cents > 0) {
      const newPrice = await stripe.prices.create({
        product: stripe_product_id,
        unit_amount: updates.price_monthly_cents,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: { plan_code, billing_interval: 'monthly' },
      });
      newIds.stripe_monthly_price_id = newPrice.id;
    } else {
      newIds.stripe_monthly_price_id = null;
    }
  }

  // Annual price changed → archive old, create new
  if (updates.price_annual_cents !== undefined && updates.price_annual_cents !== existing.price_annual_cents) {
    if (stripe_annual_price_id) {
      await stripe.prices.update(stripe_annual_price_id, { active: false }).catch((err) => {
        logger.warn('[Plans] Could not archive old annual price (already inactive?)', { priceId: stripe_annual_price_id, err });
      });
    }
    if (updates.price_annual_cents > 0) {
      const newPrice = await stripe.prices.create({
        product: stripe_product_id,
        unit_amount: updates.price_annual_cents,
        currency: 'usd',
        recurring: { interval: 'year' },
        metadata: { plan_code, billing_interval: 'annual' },
      });
      newIds.stripe_annual_price_id = newPrice.id;
    } else {
      newIds.stripe_annual_price_id = null;
    }
  }

  if (Object.keys(newIds).length > 0) {
    logger.info('[Plans] Stripe prices updated', { plan_code, changedIds: Object.keys(newIds) });
  }

  return newIds;
}

// ─── GET /api/v1/admin/plans ──────────────────────────────────────────────────

export const getPlans = asyncHandler(async (_req: Request, res: Response) => {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('[Plans] Failed to fetch plans', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }

  res.json({ success: true, data: data ?? [] });
});

// ─── GET /api/v1/admin/plans/:id ──────────────────────────────────────────────

export const getPlan = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { id } = req.params;

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ success: false, error: 'Plan not found' });
  }

  res.json({ success: true, data });
});

// ─── POST /api/v1/admin/plans ─────────────────────────────────────────────────

export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();

  const {
    code,
    name,
    description,
    price_monthly_cents,
    price_annual_cents,
    feature_limits,
    is_active,
    sort_order,
  } = req.body;

  if (!code || !name) {
    return res.status(400).json({ success: false, error: 'code and name are required' });
  }

  if (typeof price_monthly_cents !== 'number' || typeof price_annual_cents !== 'number') {
    return res.status(400).json({ success: false, error: 'price_monthly_cents and price_annual_cents must be integers' });
  }

  // 1. Insert to DB first — Stripe sync is additive, not a gate
  const { data, error } = await supabase
    .from('plans')
    .insert({
      code,
      name,
      description: description ?? null,
      price_monthly_cents,
      price_annual_cents,
      feature_limits: feature_limits ?? {},
      is_active: is_active ?? true,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: `A plan with code "${code}" already exists` });
    }
    logger.error('[Plans] Failed to create plan', error);
    return res.status(500).json({ success: false, error: 'Failed to create plan' });
  }

  // 2. Sync to Stripe — non-fatal
  try {
    const stripeIds = await createStripeProduct({
      code,
      name,
      description: description ?? null,
      price_monthly_cents,
      price_annual_cents,
    });

    if (stripeIds) {
      const { error: writeBackErr } = await supabase.from('plans').update(stripeIds).eq('id', data.id);
      if (writeBackErr) {
        logger.error('[Plans] Stripe product created but DB write-back FAILED — orphaned Stripe product', {
          code,
          stripeIds,
          error: writeBackErr,
        });
      } else {
        Object.assign(data, stripeIds);
      }
    }
  } catch (stripeErr) {
    logger.error('[Plans] Stripe product creation failed — plan saved without Stripe IDs', {
      code,
      error: stripeErr,
    });
  }

  logger.info('[Plans] Created plan', { code, name });
  res.status(201).json({ success: true, data });
});

// ─── PUT /api/v1/admin/plans/:id ──────────────────────────────────────────────
// Partial update — only updates fields present in body.
// 'code' is permanently excluded (codes are immutable identifiers).
// 'stripe_*' fields are managed internally and excluded from the request body.

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { id } = req.params;

  // Fetch existing record for Stripe sync comparison
  const { data: existing, error: fetchErr } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !existing) {
    return res.status(404).json({ success: false, error: 'Plan not found' });
  }

  const allowed = [
    'name',
    'description',
    'price_monthly_cents',
    'price_annual_cents',
    'feature_limits',
    'is_active',
    'sort_order',
    // stripe_* intentionally excluded — managed by this controller
  ];

  const payload: Record<string, unknown> = {};
  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      payload[field] = req.body[field];
    }
  }

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ success: false, error: 'No valid fields to update' });
  }

  const { data, error } = await supabase
    .from('plans')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    logger.error('[Plans] Failed to update plan', { id, error });
    return res.status(500).json({ success: false, error: 'Failed to update plan' });
  }

  // Stripe sync
  try {
    if (existing.stripe_product_id) {
      // Already has a Stripe product — diff and update
      const stripeUpdates: Parameters<typeof syncStripeProductUpdate>[0]['updates'] = {};
      if (payload.name !== undefined) stripeUpdates.name = payload.name as string;
      if (payload.description !== undefined) stripeUpdates.description = payload.description as string | null;
      if (payload.price_monthly_cents !== undefined) stripeUpdates.price_monthly_cents = payload.price_monthly_cents as number;
      if (payload.price_annual_cents !== undefined) stripeUpdates.price_annual_cents = payload.price_annual_cents as number;

      if (Object.keys(stripeUpdates).length > 0) {
        const newIds = await syncStripeProductUpdate({
          stripe_product_id: existing.stripe_product_id,
          stripe_monthly_price_id: existing.stripe_monthly_price_id,
          stripe_annual_price_id: existing.stripe_annual_price_id,
          plan_code: existing.code,
          existing: {
            price_monthly_cents: existing.price_monthly_cents,
            price_annual_cents: existing.price_annual_cents,
          },
          updates: stripeUpdates,
        });

        if (Object.keys(newIds).length > 0) {
          const { error: writeBackErr } = await supabase.from('plans').update(newIds).eq('id', id);
          if (writeBackErr) {
            logger.error('[Plans] Stripe price(s) updated but DB write-back FAILED — DB/Stripe now out of sync', {
              id,
              newIds,
              error: writeBackErr,
            });
          } else {
            Object.assign(data, newIds);
          }
        }
      }
    } else {
      // No Stripe product yet — create one now (covers plans seeded before Stripe was configured)
      const stripeIds = await createStripeProduct({
        code: existing.code,
        name: (payload.name as string) ?? existing.name,
        description: (payload.description !== undefined ? payload.description as string | null : existing.description),
        price_monthly_cents: (payload.price_monthly_cents as number) ?? existing.price_monthly_cents,
        price_annual_cents: (payload.price_annual_cents as number) ?? existing.price_annual_cents,
      });

      if (stripeIds) {
        const { error: writeBackErr } = await supabase.from('plans').update(stripeIds).eq('id', id);
        if (writeBackErr) {
          logger.error('[Plans] Stripe product created but DB write-back FAILED — orphaned Stripe product', {
            id,
            stripeIds,
            error: writeBackErr,
          });
        } else {
          Object.assign(data, stripeIds);
        }
      }
    }
  } catch (stripeErr) {
    logger.error('[Plans] Stripe sync failed on update — DB is up to date, Stripe may be out of sync', {
      id,
      error: stripeErr,
    });
  }

  logger.info('[Plans] Updated plan', { id, fields: Object.keys(payload) });
  res.json({ success: true, data });
});

// ─── DELETE /api/v1/admin/plans/:id ──────────────────────────────────────────

export const deletePlan = asyncHandler(async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const { id } = req.params;

  const { data: existing, error: fetchError } = await supabase
    .from('plans')
    .select('id, code, name, stripe_product_id')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return res.status(404).json({ success: false, error: 'Plan not found' });
  }

  // Archive Stripe product before deleting from DB.
  // Stripe doesn't allow hard-deleting products that have prices — archiving
  // (active: false) is the correct approach.
  if (existing.stripe_product_id) {
    try {
      const stripe = getStripeClient();
      if (stripe) {
        await stripe.products.update(existing.stripe_product_id, { active: false });
        logger.info('[Plans] Archived Stripe product', {
          code: existing.code,
          productId: existing.stripe_product_id,
        });
      }
    } catch (stripeErr) {
      // Non-fatal — proceed with DB delete even if Stripe archive fails.
      // The product will just remain active in Stripe but orphaned.
      logger.warn('[Plans] Failed to archive Stripe product — proceeding with DB delete', {
        id,
        productId: existing.stripe_product_id,
        error: stripeErr,
      });
    }
  }

  const { error } = await supabase
    .from('plans')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error('[Plans] Failed to delete plan', { id, error });
    return res.status(500).json({ success: false, error: 'Failed to delete plan' });
  }

  logger.info('[Plans] Deleted plan', { id, code: existing.code, name: existing.name });
  res.json({ success: true, message: `Plan "${existing.name}" deleted` });
});
