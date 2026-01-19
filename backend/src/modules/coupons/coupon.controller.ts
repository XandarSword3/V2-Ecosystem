import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { z } from 'zod';

// Validation schemas
const createCouponSchema = z.object({
  code: z.string().min(3).max(50).transform(val => val.toUpperCase()),
  name: z.string().max(100),
  description: z.string().optional(),
  discountType: z.enum(['percentage', 'fixed', 'fixed_amount', 'free_item']),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().min(0).default(0),
  maxDiscountAmount: z.number().positive().optional(),
  appliesTo: z.enum(['all', 'restaurant', 'chalets', 'pool', 'snack', 'snack_bar']).default('all'),
  usageLimit: z.number().int().positive().optional(),
  perUserLimit: z.number().int().positive().default(1),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});

const updateCouponSchema = createCouponSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const validateCouponSchema = z.object({
  code: z.string().min(3).max(50),
  orderType: z.enum(['restaurant', 'chalets', 'pool', 'snack']),
  orderAmount: z.number().positive(),
  itemCount: z.number().int().positive().default(1),
  userId: z.string().uuid().optional(),
});

const applyCouponSchema = validateCouponSchema.extend({
  orderId: z.string().uuid(),
});

export class CouponController {
  /**
   * Validate a coupon code (before checkout)
   */
  async validateCoupon(req: Request, res: Response) {
    try {
      const validation = validateCouponSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { code, orderType, orderAmount, itemCount, userId } = validation.data;
      const normalizedCode = code.toUpperCase().trim();

      // Get coupon
      const supabase = getSupabase();
      const { data: c, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', normalizedCode)
        .eq('is_active', true)
        .single();

      if (couponError || !c) {
        return res.status(404).json({
          success: false,
          error: 'Invalid coupon code',
          valid: false,
        });
      }

      // Check validity period
      const now = new Date();
      if (c.valid_from && new Date(c.valid_from) > now) {
        return res.json({
          success: false,
          error: 'Coupon is not yet active',
          valid: false,
        });
      }
      if (c.valid_until && new Date(c.valid_until) < now) {
        return res.json({
          success: false,
          error: 'Coupon has expired',
          valid: false,
        });
      }

      // Check applies to
      if (c.applies_to !== 'all' && c.applies_to !== orderType) {
        return res.json({
          success: false,
          error: `This coupon only applies to ${c.applies_to} orders`,
          valid: false,
        });
      }

      // Check minimum order amount
      if (orderAmount < c.min_order_amount) {
        return res.json({
          success: false,
          error: `Minimum order amount is $${c.min_order_amount}`,
          valid: false,
        });
      }

      // Check minimum items
      if (itemCount < c.requires_min_items) {
        return res.json({
          success: false,
          error: `Minimum ${c.requires_min_items} items required`,
          valid: false,
        });
      }

      // Check usage limit
      if (c.usage_limit && c.usage_count >= c.usage_limit) {
        return res.json({
          success: false,
          error: 'Coupon usage limit reached',
          valid: false,
        });
      }

      // Check per-user limit
      if (userId && c.per_user_limit) {
        const { count: userUsageCount, error: usageError } = await supabase
          .from('coupon_usage')
          .select('*', { count: 'exact', head: true })
          .eq('coupon_id', c.id)
          .eq('user_id', userId);

        if (!usageError && userUsageCount !== null && userUsageCount >= c.per_user_limit) {
          return res.json({
            success: false,
            error: 'You have already used this coupon',
            valid: false,
          });
        }
      }

      // Check first order only
      if (c.first_order_only && userId) {
        // Check restaurant orders
        const { count: restaurantCount } = await supabase
          .from('restaurant_orders')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        // Check chalet bookings
        const { count: chaletCount } = await supabase
          .from('chalet_bookings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        // Check pool passes
        const { count: poolCount } = await supabase
          .from('pool_passes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        const totalOrders = (restaurantCount || 0) + (chaletCount || 0) + (poolCount || 0);
        if (totalOrders > 0) {
          return res.json({
            success: false,
            error: 'This coupon is only valid for first orders',
            valid: false,
          });
        }
      }

      // Calculate discount
      let discountAmount = 0;
      if (c.discount_type === 'percentage') {
        discountAmount = orderAmount * (c.discount_value / 100);
        if (c.max_discount_amount && discountAmount > c.max_discount_amount) {
          discountAmount = c.max_discount_amount;
        }
      } else if (c.discount_type === 'fixed') {
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
      res.status(500).json({
        success: false,
        error: 'Failed to validate coupon',
        message: error.message,
      });
    }
  }

  /**
   * Apply a coupon to an order (during checkout)
   */
  async applyCoupon(req: Request, res: Response) {
    try {
      const validation = applyCouponSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { code, orderType, orderAmount, userId, orderId } = validation.data;

      // Reuse validation logic
      const normalizedCode = code.toUpperCase().trim();
      const supabase = getSupabase();
      
      const { data: c, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', normalizedCode)
        .eq('is_active', true)
        .single();

      if (couponError || !c) {
        return res.status(404).json({ success: false, error: 'Invalid coupon code' });
      }

      // Calculate discount
      let discountAmount = 0;
      if (c.discount_type === 'percentage') {
        discountAmount = orderAmount * (c.discount_value / 100);
        if (c.max_discount_amount && discountAmount > c.max_discount_amount) {
          discountAmount = parseFloat(c.max_discount_amount);
        }
      } else if (c.discount_type === 'fixed') {
        discountAmount = Math.min(parseFloat(c.discount_value), orderAmount);
      }

      // Record usage (Note: order_type column doesn't exist in coupon_usage table)
      const { error: usageInsertError } = await supabase
        .from('coupon_usage')
        .insert({
          coupon_id: c.id,
          user_id: userId,
          order_id: orderId,
          discount_applied: discountAmount,
        });

      if (usageInsertError) {
        throw usageInsertError;
      }

      // Update usage count
      const { error: updateError } = await supabase
        .from('coupons')
        .update({
          usage_count: c.usage_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', c.id);

      if (updateError) {
        throw updateError;
      }

      // Also update the order with coupon discount (Bug #7 fix)
      // Determine the correct orders table based on orderType
      let ordersTable = 'restaurant_orders';
      if (orderType === 'snack') {
        ordersTable = 'snack_orders';
      } else if (orderType === 'chalets') {
        ordersTable = 'chalet_bookings';
      } else if (orderType === 'pool') {
        ordersTable = 'pool_tickets';
      }

      // Update the order with coupon info and recalculate total
      if (orderType === 'restaurant' || orderType === 'snack') {
        const { data: currentOrder } = await supabase
          .from(ordersTable)
          .select('subtotal, tax_amount, service_charge, delivery_fee, discount_amount')
          .eq('id', orderId)
          .single();

        if (currentOrder) {
          const newTotalAmount = 
            parseFloat(currentOrder.subtotal || 0) +
            parseFloat(currentOrder.tax_amount || 0) +
            parseFloat(currentOrder.service_charge || 0) +
            parseFloat(currentOrder.delivery_fee || 0) -
            discountAmount;

          const { error: orderUpdateError } = await supabase
            .from(ordersTable)
            .update({
              coupon_id: c.id,
              coupon_code: c.code,
              coupon_discount: discountAmount,
              discount_amount: discountAmount,
              total_amount: Math.max(0, newTotalAmount),
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

          if (orderUpdateError) {
            console.error('Error updating order with coupon:', orderUpdateError);
            // Don't fail the whole request, just log the error
          }
        }
      }

      res.json({
        success: true,
        data: {
          couponId: c.id,
          discountApplied: Math.round(discountAmount * 100) / 100,
          finalAmount: Math.max(0, orderAmount - discountAmount),
        },
      });
    } catch (error: any) {
      console.error('Error applying coupon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply coupon',
        message: error.message,
      });
    }
  }

  /**
   * Get all active coupons (public - for display)
   */
  async getActiveCoupons(req: Request, res: Response) {
    try {
      const supabase = getSupabase();
      const now = new Date().toISOString();

      // Build the query for active coupons
      const { data: coupons, error } = await supabase
        .from('coupons')
        .select('code, name, description, discount_type, discount_value, min_order_amount, max_discount_amount, applies_to, valid_until')
        .eq('is_active', true)
        .or(`valid_from.is.null,valid_from.lte.${now}`)
        .or(`valid_until.is.null,valid_until.gt.${now}`)
        .order('discount_value', { ascending: false });

      if (error) {
        throw error;
      }

      // Filter out coupons that have reached usage limit (need to do this in memory since we can't compare columns)
      // Note: Ideally this would be done with a raw query or database function
      const { data: allCoupons, error: allError } = await supabase
        .from('coupons')
        .select('code, name, description, discount_type, discount_value, min_order_amount, max_discount_amount, applies_to, valid_from, valid_until, usage_limit, usage_count')
        .eq('is_active', true)
        .order('discount_value', { ascending: false });

      if (allError) {
        throw allError;
      }

      const filteredCoupons = (allCoupons || []).filter(c => {
        const validFromOk = !c.valid_from || new Date(c.valid_from) <= new Date();
        const validUntilOk = !c.valid_until || new Date(c.valid_until) > new Date();
        const usageLimitOk = !c.usage_limit || c.usage_count < c.usage_limit;
        return validFromOk && validUntilOk && usageLimitOk;
      }).map(({ usage_limit, usage_count, ...rest }) => rest);

      res.json({
        success: true,
        data: filteredCoupons,
      });
    } catch (error: any) {
      console.error('Error fetching coupons:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch coupons',
        message: error.message,
      });
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

      const supabase = getSupabase();
      const now = new Date().toISOString();

      // Build base query - Note: LEFT JOIN with users requires a different approach
      // We'll fetch coupons first, then enrich with user data
      let query = supabase
        .from('coupons')
        .select('*, users!coupons_created_by_fkey(full_name)', { count: 'exact' });

      // Apply filters
      if (status === 'active') {
        query = query
          .eq('is_active', true)
          .or(`valid_until.is.null,valid_until.gt.${now}`);
      } else if (status === 'inactive') {
        query = query.or(`is_active.eq.false,valid_until.lte.${now}`);
      }

      if (appliesTo) {
        query = query.eq('applies_to', appliesTo as string);
      }

      if (search) {
        query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);
      }

      // Apply pagination and ordering
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      const { data: coupons, error, count } = await query;

      if (error) {
        throw error;
      }

      // Transform data to include created_by_name
      const transformedCoupons = (coupons || []).map(coupon => {
        const { users, ...rest } = coupon as any;
        return {
          ...rest,
          created_by_name: users?.full_name || null,
        };
      });

      res.json({
        success: true,
        data: transformedCoupons,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limitNum),
        },
      });
    } catch (error: any) {
      console.error('Error fetching all coupons:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch coupons',
        message: error.message,
      });
    }
  }

  /**
   * Get coupon details (admin)
   */
  async getCoupon(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const supabase = getSupabase();

      // Get coupon with creator info
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*, users!coupons_created_by_fkey(full_name)')
        .eq('id', id)
        .single();

      if (couponError || !coupon) {
        return res.status(404).json({ success: false, error: 'Coupon not found' });
      }

      // Get usage history
      const { data: usages, error: usagesError } = await supabase
        .from('coupon_usage')
        .select('*, users!coupon_usage_user_id_fkey(full_name, email)')
        .eq('coupon_id', id)
        .order('used_at', { ascending: false })
        .limit(50);

      if (usagesError) {
        throw usagesError;
      }

      // Transform data
      const { users: creatorUser, ...couponRest } = coupon as any;
      const transformedUsages = (usages || []).map((usage: any) => {
        const { users: usageUser, ...usageRest } = usage;
        return {
          ...usageRest,
          user_name: usageUser?.full_name || null,
          user_email: usageUser?.email || null,
        };
      });

      res.json({
        success: true,
        data: {
          ...couponRest,
          created_by_name: creatorUser?.full_name || null,
          usages: transformedUsages,
        },
      });
    } catch (error: any) {
      console.error('Error fetching coupon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch coupon',
        message: error.message,
      });
    }
  }

  /**
   * Create a coupon (admin)
   */
  async createCoupon(req: Request, res: Response) {
    try {
      const validation = createCouponSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const userId = (req as any).user?.id;
      const supabase = getSupabase();

      // Check if code exists
      const { data: existing } = await supabase
        .from('coupons')
        .select('id')
        .eq('code', data.code)
        .single();

      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Coupon code already exists',
        });
      }

      // Map discount type and applies_to to match database schema
      const discountTypeMap: Record<string, string> = {
        'fixed': 'fixed_amount',
        'percentage': 'percentage',
        'fixed_amount': 'fixed_amount',
        'free_item': 'free_item',
      };
      const appliesToMap: Record<string, string> = {
        'snack': 'snack_bar',
        'snack_bar': 'snack_bar',
        'all': 'all',
        'restaurant': 'restaurant',
        'chalets': 'chalets',
        'pool': 'pool',
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
          applies_to: appliesToMap[data.appliesTo] || data.appliesTo,
          usage_limit: data.usageLimit,
          per_user_limit: data.perUserLimit,
          valid_from: data.validFrom,
          valid_until: data.validUntil,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error creating coupon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create coupon',
        message: error.message,
      });
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
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const supabase = getSupabase();

      // Build update object
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        code: 'code',
        name: 'name',
        description: 'description',
        discountType: 'discount_type',
        discountValue: 'discount_value',
        minOrderAmount: 'min_order_amount',
        maxDiscountAmount: 'max_discount_amount',
        appliesTo: 'applies_to',
        usageLimit: 'usage_limit',
        perUserLimit: 'per_user_limit',
        validFrom: 'valid_from',
        validUntil: 'valid_until',
        requiresMinItems: 'requires_min_items',
        firstOrderOnly: 'first_order_only',
        isActive: 'is_active',
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

      const { data: result, error } = await supabase
        .from('coupons')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ success: false, error: 'Coupon not found' });
        }
        throw error;
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error updating coupon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update coupon',
        message: error.message,
      });
    }
  }

  /**
   * Delete a coupon (admin)
   */
  async deleteCoupon(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const supabase = getSupabase();

      // Check if coupon has been used
      const { count: usageCount, error: countError } = await supabase
        .from('coupon_usage')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', id);

      if (countError) {
        throw countError;
      }

      if (usageCount && usageCount > 0) {
        // Soft delete - just deactivate
        const { error: updateError } = await supabase
          .from('coupons')
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          throw updateError;
        }

        return res.json({
          success: true,
          message: 'Coupon deactivated (has usage history)',
        });
      }

      // Hard delete if never used
      const { error: deleteError } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      res.json({
        success: true,
        message: 'Coupon deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting coupon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete coupon',
        message: error.message,
      });
    }
  }

  /**
   * Get coupon statistics (admin)
   */
  async getStats(req: Request, res: Response) {
    try {
      const supabase = getSupabase();
      const now = new Date().toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Get all coupons for stats calculation
      const { data: allCoupons, error: couponsError } = await supabase
        .from('coupons')
        .select('is_active, valid_until, usage_count');

      if (couponsError) {
        throw couponsError;
      }

      const totalCoupons = allCoupons?.length || 0;
      const activeCoupons = allCoupons?.filter(c => 
        c.is_active && (!c.valid_until || new Date(c.valid_until) > new Date())
      ).length || 0;
      const totalUses = allCoupons?.reduce((sum, c) => sum + (c.usage_count || 0), 0) || 0;

      // Get total discounts
      const { data: usageData, error: usageError } = await supabase
        .from('coupon_usage')
        .select('discount_applied');

      if (usageError) {
        throw usageError;
      }

      const totalDiscount = usageData?.reduce((sum, u) => sum + (parseFloat(u.discount_applied) || 0), 0) || 0;

      // Get top coupons
      const { data: topCoupons, error: topError } = await supabase
        .from('coupons')
        .select('code, name, usage_count, discount_type, discount_value')
        .gt('usage_count', 0)
        .order('usage_count', { ascending: false })
        .limit(10);

      if (topError) {
        throw topError;
      }

      // Get recent usage - we need to aggregate by date
      const { data: recentUsages, error: recentError } = await supabase
        .from('coupon_usage')
        .select('used_at, discount_applied')
        .gte('used_at', thirtyDaysAgo)
        .order('used_at', { ascending: false });

      if (recentError) {
        throw recentError;
      }

      // Aggregate by date in memory
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
          summary: {
            total_coupons: totalCoupons,
            active_coupons: activeCoupons,
            total_uses: totalUses,
            totalDiscountGiven: totalDiscount,
          },
          topCoupons: topCoupons || [],
          recentUsage,
        },
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch statistics',
        message: error.message,
      });
    }
  }

  /**
   * Generate random coupon code
   */
  async generateCode(req: Request, res: Response): Promise<void | Response> {
    try {
      const { prefix = '' } = req.query;
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = (prefix as string).toUpperCase();
      
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Check uniqueness
      const supabase = getSupabase();
      const { data: existing } = await supabase
        .from('coupons')
        .select('id')
        .eq('code', code)
        .single();

      if (existing) {
        return this.generateCode(req, res); // Retry
      }

      res.json({
        success: true,
        data: { code },
      });
    } catch (error: any) {
      console.error('Error generating code:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate code',
        message: error.message,
      });
    }
  }
}

export const couponController = new CouponController();
