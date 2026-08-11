import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { requireTenantScope } from '../../security/tenant-scope.js';

/**
 * Coupon Controller
 *
 * Issue 17 changes:
 * - Added property_id scoping to all admin queries and inserts.
 * - appliesTo and orderType are now free-form strings. Any module slug works
 *   without code changes — 'all' is the wildcard value.
 * - validateCoupon / applyCoupon: orderType is now z.string() — the RPC
 *   apply_coupon_atomic compares against the stored applies_to string, so it
 *   accepts any slug as long as the coupon's applies_to matches or is 'all'.
 */

/**
 * Permissive property resolution for public endpoints (validateCoupon,
 * getActiveCoupons) that are NOT gated by validatePropertyAccess /
 * requirePropertyId — a guest browsing active coupons may have no property
 * context, and that's a legitimate state for these routes.
 */
function getPropertyId(req: Request): string | undefined {
  return (req as any).propertyId || req.property?.id || (req.headers?.['x-property-id'] as string) || undefined;
}

/**
 * Strict property resolution for admin endpoints. Admin routes
 * (coupon.routes.ts) run validatePropertyAccess + requirePropertyId before
 * reaching any handler here — that pair verifies the caller's property_id
 * belongs to their own tenant and rejects the request outright if it's
 * missing, so callers no longer need their own presence check, and — unlike
 * the old local check — a supplied property_id is now actually verified to
 * belong to the caller's tenant rather than merely being non-empty. See
 * CONTEXT.md cross-tenant sweep.
 */
function getAdminPropertyId(req: Request): string {
  const propertyId = (req as any).propertyId as string | undefined;
  if (!propertyId) {
    throw new Error('Property context missing — requirePropertyId middleware must run before this handler');
  }
  return propertyId;
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const dateOrDatetimeSchema = z.string().transform((val) => {
  if (!val) return undefined;
  if (val.includes('T')) return val;
  return `${val}T00:00:00.000Z`;
}).optional();

const createCouponSchema = z.object({
  code: z.string().min(3).max(50).transform(val => val.toUpperCase()),
  name: z.string().max(100),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed', 'fixed_amount', 'free_item']),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().min(0).default(0),
  maxDiscountAmount: z.number().positive().optional(),
  // Now accepts any module slug so new modules don't require code changes.
  appliesTo: z.string().max(100).default('all'),
  usageLimit: z.number().int().positive().optional(),
  perUserLimit: z.number().int().positive().default(1),
  validFrom: dateOrDatetimeSchema,
  validUntil: dateOrDatetimeSchema,
  requiresMinItems: z.number().int().min(0).optional(),
  firstOrderOnly: z.boolean().optional(),
});

const updateCouponSchema = createCouponSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const validateCouponSchema = z.object({
  code: z.string().min(3).max(50),
  // Now accepts any module slug.
  orderType: z.string().max(100),
  orderAmount: z.number().positive(),
  itemCount: z.number().int().positive().default(1),
  userId: z.string().uuid().optional(),
});

// applyCouponSchema removed along with applyCoupon() below — see that removal
// note for why.

// ─── Controller ───────────────────────────────────────────────────────────────

export class CouponController {
  /**
   * Validate a coupon code (before checkout)
   */
  async validateCoupon(req: Request, res: Response) {
    try {
      const validation = validateCouponSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.issues });
      }

      const { code, orderType, orderAmount, itemCount, userId } = validation.data;
      const normalizedCode = code.toUpperCase().trim();
      const propertyId = getPropertyId(req);

      const supabase = getSupabase();
      let query = supabase.from('coupons').select('*').eq('code', normalizedCode).eq('is_active', true);
      if (propertyId) query = query.eq('property_id', propertyId);

      const { data: c, error: couponError } = await query.single();

      if (couponError || !c) {
        return res.status(404).json({ success: false, error: 'Invalid coupon code', valid: false });
      }

      const now = new Date();
      if (c.valid_from && new Date(c.valid_from) > now) {
        return res.json({ success: false, error: 'Coupon is not yet active', valid: false });
      }
      if (c.valid_until && new Date(c.valid_until) < now) {
        return res.json({ success: false, error: 'Coupon has expired', valid: false });
      }

      if (c.applies_to !== 'all' && c.applies_to !== orderType) {
        return res.json({ success: false, error: `This coupon only applies to ${c.applies_to} orders`, valid: false });
      }

      if (orderAmount < c.min_order_amount) {
        return res.json({ success: false, error: `Minimum order amount is $${c.min_order_amount}`, valid: false });
      }

      if (itemCount < c.min_items) {
        return res.json({ success: false, error: `Minimum ${c.min_items} items required`, valid: false });
      }

      if (c.usage_limit && c.usage_count >= c.usage_limit) {
        return res.json({ success: false, error: 'Coupon usage limit reached', valid: false });
      }

      if (userId && c.per_user_limit) {
        const { count: userUsageCount, error: usageError } = await supabase
          .from('coupon_usage')
          .select('*', { count: 'exact', head: true })
          .eq('coupon_id', c.id)
          .eq('user_id', userId);

        if (!usageError && userUsageCount !== null && userUsageCount >= c.per_user_limit) {
          return res.json({ success: false, error: 'You have already used this coupon', valid: false });
        }
      }

      if (c.first_order_only && userId) {
        let txQuery = supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('customer_id', userId);
        if (propertyId) txQuery = txQuery.eq('property_id', propertyId);
        const { count: totalOrders } = await txQuery;
        if (totalOrders && totalOrders > 0) {
          return res.json({ success: false, error: 'This coupon is only valid for first orders', valid: false });
        }
      }

      let discountAmount = 0;
      if (c.discount_type === 'percentage') {
        discountAmount = orderAmount * (c.discount_value / 100);
        if (c.max_discount_amount && discountAmount > c.max_discount_amount) {
          discountAmount = c.max_discount_amount;
        }
      } else if (c.discount_type === 'fixed' || c.discount_type === 'fixed_amount') {
        discountAmount = Math.min(c.discount_value, orderAmount);
      }

      res.json({
        success: true,
        valid: true,
        data: {
          couponId: c.id,
          code: c.code,
          name: c.name,
          discountType: c.discount_type,
          discountValue: parseFloat(c.discount_value),
          discountAmount: Math.round(discountAmount * 100) / 100,
          finalAmount: Math.max(0, orderAmount - discountAmount),
        },
      });
    } catch (error: any) {
      console.error('Error validating coupon:', error);
      res.status(500).json({ success: false, error: 'Failed to validate coupon', message: error.message });
    }
  }

  // applyCoupon() removed. It was unreachable — the frontend's CouponInput
  // only ever calls /coupons/validate, never /coupons/apply — and would have
  // thrown at runtime anyway: it wrote coupon_id/coupon_code/coupon_discount
  // onto `transactions`, but the live schema (20260522000000_clean_
  // transactions_table.sql) has no such columns, only discount_amount.
  //
  // The real, live coupon-consumption path is server-side inside
  // PricingPipeline.calculate() (discount-resolvers.ts), triggered
  // automatically at order creation — not a separate customer-invoked
  // "apply" call. Its reversal-on-failure/cancel/refund logic (the useful
  // part of this method — see reverse_coupon_usage usage above) now lives in
  // engines/discount-reversal.ts, called from dynamic-module.router.ts and
  // payment.controller.ts, which is the path that's actually reachable.

  /**
   * Get active coupons (public — for display)
   */
  async getActiveCoupons(req: Request, res: Response) {
    try {
      const supabase = getSupabase();
      const propertyId = getPropertyId(req);
      const now = new Date().toISOString();

      let query = supabase
        .from('coupons')
        .select('code, name, description, discount_type, discount_value, min_order_amount, max_discount_amount, applies_to, valid_from, valid_until, usage_limit, usage_count')
        .eq('is_active', true)
        .order('discount_value', { ascending: false });

      if (propertyId) query = query.eq('property_id', propertyId);

      const { data: allCoupons, error } = await query;
      if (error) throw error;

      const filteredCoupons = (allCoupons || []).filter(c => {
        const validFromOk = !c.valid_from || new Date(c.valid_from) <= new Date();
        const validUntilOk = !c.valid_until || new Date(c.valid_until) > new Date();
        const usageLimitOk = !c.usage_limit || c.usage_count < c.usage_limit;
        return validFromOk && validUntilOk && usageLimitOk;
      }).map(({ usage_limit, usage_count, ...rest }) => rest);

      res.json({ success: true, data: filteredCoupons });
    } catch (error: any) {
      console.error('Error fetching coupons:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch coupons', message: error.message });
    }
  }

  /**
   * Get all coupons (admin)
   */
  async getAllCoupons(req: Request, res: Response) {
    try {
      const { page = '1', limit = '20', status, appliesTo, search } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;
      const propertyId = getAdminPropertyId(req);

      const supabase = getSupabase();
      const now = new Date().toISOString();

      let query = supabase
        .from('coupons')
        .select('*, users!coupons_created_by_fkey(full_name)', { count: 'exact' });

      query = query.eq('property_id', propertyId);

      if (status === 'active') {
        query = query.eq('is_active', true).or(`valid_until.is.null,valid_until.gt.${now}`);
      } else if (status === 'inactive') {
        query = query.or(`is_active.eq.false,valid_until.lte.${now}`);
      }

      if (appliesTo) query = query.eq('applies_to', appliesTo as string);
      if (search) query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);

      query = query.order('created_at', { ascending: false }).range(offset, offset + limitNum - 1);

      const { data: coupons, error, count } = await query;
      if (error) throw error;

      const transformedCoupons = (coupons || []).map(coupon => {
        const { users, ...rest } = coupon as any;
        return { ...rest, created_by_name: users?.full_name || null };
      });

      res.json({
        success: true,
        data: transformedCoupons,
        pagination: { page: pageNum, limit: limitNum, total: count || 0, totalPages: Math.ceil((count || 0) / limitNum) },
      });
    } catch (error: any) {
      console.error('Error fetching all coupons:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch coupons', message: error.message });
    }
  }

  /**
   * Get coupon details (admin)
   */
  async getCoupon(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const propertyId = getAdminPropertyId(req);
      const supabase = getSupabase();

      let query = supabase.from('coupons').select('*, users!coupons_created_by_fkey(full_name)').eq('id', id);
      query = query.eq('property_id', propertyId);
      const { data: coupon, error: couponError } = await query.single();

      if (couponError || !coupon) {
        return res.status(404).json({ success: false, error: 'Coupon not found' });
      }

      const { data: usages, error: usagesError } = await supabase
        .from('coupon_usage')
        .select('*, users!coupon_usage_user_id_fkey(full_name, email)')
        .eq('coupon_id', id)
        .order('used_at', { ascending: false })
        .limit(50);

      if (usagesError) throw usagesError;

      const { users: creatorUser, ...couponRest } = coupon as any;
      const transformedUsages = (usages || []).map((usage: any) => {
        const { users: usageUser, ...usageRest } = usage;
        return { ...usageRest, user_name: usageUser?.full_name || null, user_email: usageUser?.email || null };
      });

      res.json({
        success: true,
        data: { ...couponRest, created_by_name: creatorUser?.full_name || null, usages: transformedUsages },
      });
    } catch (error: any) {
      console.error('Error fetching coupon:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch coupon', message: error.message });
    }
  }

  /**
   * Create a coupon (admin)
   */
  async createCoupon(req: Request, res: Response) {
    try {
      const validation = createCouponSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.issues });
      }

      const data = validation.data;
      const userId = req.user?.id;
      const propertyId = getAdminPropertyId(req);

      let tenantId: string;
      try {
        tenantId = requireTenantScope(req);
      } catch (scopeError: any) {
        return res.status(scopeError.statusCode || 403).json({ success: false, error: scopeError.message || 'Tenant scope required' });
      }

      const supabase = getSupabase();

      const { data: existing } = await supabase.from('coupons').select('id').eq('code', data.code).single();
      if (existing) {
        return res.status(400).json({ success: false, error: 'Coupon code already exists' });
      }

      // Normalise discount type (legacy: 'fixed' → 'fixed_amount')
      const discountTypeMap: Record<string, string> = {
        fixed: 'fixed_amount',
        percentage: 'percentage',
        fixed_amount: 'fixed_amount',
        free_item: 'free_item',
      };

      const { data: result, error } = await supabase
        .from('coupons')
        .insert({
          code: data.code,
          name: data.name,
          description: data.description,
          discount_type: discountTypeMap[data.discountType] || data.discountType,
          discount_value: data.discountValue,
          min_order_amount: data.minOrderAmount,
          max_discount_amount: data.maxDiscountAmount,
          applies_to: data.appliesTo,
          usage_limit: data.usageLimit,
          per_user_limit: data.perUserLimit,
          valid_from: data.validFrom,
          valid_until: data.validUntil,
          min_items: data.requiresMinItems,
          first_order_only: data.firstOrderOnly,
          created_by: userId,
          property_id: propertyId,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error creating coupon:', error);
      res.status(500).json({ success: false, error: 'Failed to create coupon', message: error.message });
    }
  }

  /**
   * Update a coupon (admin)
   */
  async updateCoupon(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validation = updateCouponSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: validation.error.issues });
      }

      const data = validation.data;
      const propertyId = getAdminPropertyId(req);
      const supabase = getSupabase();

      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      const fieldMap: Record<string, string> = {
        code: 'code', name: 'name', description: 'description',
        discountType: 'discount_type', discountValue: 'discount_value',
        minOrderAmount: 'min_order_amount', maxDiscountAmount: 'max_discount_amount',
        appliesTo: 'applies_to', usageLimit: 'usage_limit', perUserLimit: 'per_user_limit',
        validFrom: 'valid_from', validUntil: 'valid_until',
        requiresMinItems: 'min_items', firstOrderOnly: 'first_order_only', isActive: 'is_active',
      };

      let hasUpdates = false;
      for (const [key, dbField] of Object.entries(fieldMap)) {
        if ((data as any)[key] !== undefined) {
          updateData[dbField] = (data as any)[key];
          hasUpdates = true;
        }
      }

      if (!hasUpdates) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      let query = supabase.from('coupons').update(updateData).eq('id', id);
      query = query.eq('property_id', propertyId);
      const { data: result, error } = await query.select().single();

      if (error) {
        if (error.code === 'PGRST116') return res.status(404).json({ success: false, error: 'Coupon not found' });
        throw error;
      }

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error updating coupon:', error);
      res.status(500).json({ success: false, error: 'Failed to update coupon', message: error.message });
    }
  }

  /**
   * Delete a coupon (admin) — soft-deletes if usage history exists
   */
  async deleteCoupon(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const propertyId = getAdminPropertyId(req);
      const supabase = getSupabase();

      const { count: usageCount, error: countError } = await supabase
        .from('coupon_usage')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', id);

      if (countError) throw countError;

      if (usageCount && usageCount > 0) {
        let q = supabase.from('coupons').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
        q = q.eq('property_id', propertyId);
        const { error: updateError } = await q;
        if (updateError) throw updateError;
        return res.json({ success: true, message: 'Coupon deactivated (has usage history)' });
      }

      let q = supabase.from('coupons').delete().eq('id', id);
      q = q.eq('property_id', propertyId);
      const { error: deleteError } = await q;
      if (deleteError) throw deleteError;

      res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting coupon:', error);
      res.status(500).json({ success: false, error: 'Failed to delete coupon', message: error.message });
    }
  }

  /**
   * Get coupon statistics (admin)
   */
  async getStats(req: Request, res: Response) {
    try {
      const supabase = getSupabase();
      const propertyId = getAdminPropertyId(req);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      let couponsQuery = supabase.from('coupons').select('is_active, valid_until, usage_count');
      couponsQuery = couponsQuery.eq('property_id', propertyId);
      const { data: allCoupons, error: couponsError } = await couponsQuery;
      if (couponsError) throw couponsError;

      const totalCoupons = allCoupons?.length || 0;
      const activeCoupons = allCoupons?.filter(c => c.is_active && (!c.valid_until || new Date(c.valid_until) > new Date())).length || 0;
      const totalUses = allCoupons?.reduce((sum, c) => sum + (c.usage_count || 0), 0) || 0;

      const { data: usageData, error: usageError } = await supabase.from('coupon_usage').select('discount_applied');
      if (usageError) throw usageError;
      const totalDiscount = usageData?.reduce((sum, u) => sum + (parseFloat(u.discount_applied) || 0), 0) || 0;

      let topQuery = supabase.from('coupons').select('code, name, usage_count, discount_type, discount_value').gt('usage_count', 0).order('usage_count', { ascending: false }).limit(10);
      topQuery = topQuery.eq('property_id', propertyId);
      const { data: topCoupons, error: topError } = await topQuery;
      if (topError) throw topError;

      const { data: recentUsages, error: recentError } = await supabase
        .from('coupon_usage')
        .select('used_at, discount_applied')
        .gte('used_at', thirtyDaysAgo)
        .order('used_at', { ascending: false });
      if (recentError) throw recentError;

      const usageByDate = new Map<string, { uses: number; discounts: number }>();
      (recentUsages || []).forEach(usage => {
        const date = new Date(usage.used_at).toISOString().split('T')[0];
        const existing = usageByDate.get(date) || { uses: 0, discounts: 0 };
        existing.uses += 1;
        existing.discounts += parseFloat(usage.discount_applied) || 0;
        usageByDate.set(date, existing);
      });

      const recentUsage = Array.from(usageByDate.entries())
        .map(([date, data]) => ({ date, uses: data.uses, discounts: data.discounts }))
        .sort((a, b) => b.date.localeCompare(a.date));

      res.json({
        success: true,
        data: {
          summary: { total_coupons: totalCoupons, active_coupons: activeCoupons, total_uses: totalUses, totalDiscountGiven: totalDiscount },
          topCoupons: topCoupons || [],
          recentUsage,
        },
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch statistics', message: error.message });
    }
  }

  /**
   * Generate a random coupon code
   */
  async generateCode(req: Request, res: Response): Promise<void | Response> {
    try {
      const { prefix = '' } = req.query;
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = (prefix as string).toUpperCase();
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const supabase = getSupabase();
      const { data: existing } = await supabase.from('coupons').select('id').eq('code', code).single();
      if (existing) return this.generateCode(req, res);

      res.json({ success: true, data: { code } });
    } catch (error: any) {
      console.error('Error generating code:', error);
      res.status(500).json({ success: false, error: 'Failed to generate code', message: error.message });
    }
  }
}

export const couponController = new CouponController();
