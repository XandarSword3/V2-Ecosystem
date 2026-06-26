import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { z } from 'zod';

/**
 * Loyalty Controller
 *
 * Issue 17: Added property_id scoping on all direct Supabase queries and inserts.
 * Atomic RPCs (earn/redeem/adjust) operate by user_id and do not take property_id —
 * scoping there is handled at the DB level via loyalty_members.property_id.
 */

function getPropertyId(req: Request): string | undefined {
  return (req as any).propertyId || (req.headers?.['x-property-id'] as string) || undefined;
}

// Validation schemas
const earnPointsSchema = z.object({
  userId: z.string().uuid(),
  points: z.number().int().positive(),
  description: z.string().max(255).optional(),
  referenceType: z.enum(['order', 'booking', 'pool_ticket', 'manual', 'bonus']).optional(),
  referenceId: z.string().uuid().optional(),
});

const redeemPointsSchema = z.object({
  userId: z.string().uuid(),
  points: z.number().int().positive(),
  description: z.string().max(255).optional(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
});

const adjustPointsSchema = z.object({
  userId: z.string().uuid(),
  points: z.number().int(),
  reason: z.string().max(255),
});

const adjustPointsByAccountIdSchema = z.object({
  points: z.number().int(),
  reason: z.string().max(255),
});

const updateSettingsSchema = z.object({
  pointsPerDollar: z.number().positive().optional(),
  redemptionRate: z.number().positive().optional(),
  minRedemption: z.number().int().positive().optional(),
  pointsExpiryDays: z.number().int().positive().optional(),
  signupBonus: z.number().int().min(0).optional(),
  birthdayBonus: z.number().int().min(0).optional(),
  isEnabled: z.boolean().optional(),
});

const updateTierSchema = z.object({
  name: z.string().max(50).optional(),
  min_points: z.number().int().min(0).optional(),
  points_multiplier: z.number().positive().optional(),
  benefits: z.union([z.record(z.string(), z.any()), z.array(z.string())]).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  is_active: z.boolean().optional(),
});

const createTierSchema = z.object({
  name: z.string().max(50),
  min_points: z.number().int().min(0),
  points_multiplier: z.number().positive().optional().default(1),
  benefits: z.union([z.record(z.string(), z.any()), z.array(z.string())]).optional().default({}),
  color: z.string().optional().default('#6B7280'),
  icon: z.string().optional(),
  is_active: z.boolean().optional().default(true),
});

export class LoyaltyController {
  /**
   * Get loyalty account for a user
   */
  async getAccount(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      // Get account with tier info — scoped to property
      let memberQuery = supabase
        .from('loyalty_members')
        .select(`*, tier:loyalty_tiers(*)`)
        .eq('user_id', userId);
      if (propertyId) memberQuery = memberQuery.eq('property_id', propertyId);

      const { data: account, error } = await memberQuery.single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!account) {
        // Create account if doesn't exist — scoped to property
        let settingsQuery = supabase.from('loyalty_settings').select('*');
        if (propertyId) settingsQuery = settingsQuery.eq('property_id', propertyId);
        const { data: settings } = await settingsQuery.limit(1).single();

        let tierQuery = supabase
          .from('loyalty_tiers')
          .select('id')
          .order('min_points', { ascending: true });
        if (propertyId) tierQuery = tierQuery.eq('property_id', propertyId);
        const { data: defaultTier } = await tierQuery.limit(1).single();

        const signupBonus = settings?.signup_bonus || 0;

        const { data: newAccount, error: createError } = await supabase
          .from('loyalty_members')
          .insert({
            user_id: userId,
            property_id: propertyId || null,
            tier_id: defaultTier?.id,
            available_points: signupBonus,
            lifetime_points: signupBonus,
            total_points: signupBonus,
          })
          .select(`*, tier:loyalty_tiers(*)`)
          .single();

        if (createError) throw createError;

        // Log signup bonus if any
        if (signupBonus > 0) {
          await supabase.from('loyalty_transactions').insert({
            member_id: newAccount.id,
            type: 'bonus',
            points: signupBonus,
            balance_after: signupBonus,
            description: 'Welcome bonus',
          });
        }

        return res.json({ success: true, data: newAccount });
      }

      res.json({ success: true, data: account });
    } catch (error: any) {
      console.error('Error fetching loyalty account:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch loyalty account',
        message: error.message,
      });
    }
  }

  /**
   * Get my loyalty account (for logged-in user)
   */
  async getMyAccount(req: Request, res: Response) {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
      }
      req.params.userId = userId;
      return this.getAccount(req, res);
    } catch (error: any) {
      console.error('Error fetching my loyalty account:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch loyalty account',
        message: error.message,
      });
    }
  }

  /**
   * Earn points for a user (ATOMIC via RPC + Mutex)
   */
  async earnPoints(req: Request, res: Response) {
    try {
      const validation = earnPointsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { userId, points, description, referenceType, referenceId } = validation.data;
      const supabase = getSupabase();

      const { data: result, error: rpcError } = await supabase.rpc(
        'earn_loyalty_points_atomic',
        {
          p_user_id: userId,
          p_order_total: points,
          p_order_id: referenceId || '00000000-0000-0000-0000-000000000000',
          p_points_per_dollar: 1,
        }
      );

      if (rpcError) throw rpcError;

      const row = result?.[0];
      if (!row?.success) {
        return res.status(400).json({
          success: false,
          error: row?.error_message || 'Failed to earn points',
        });
      }

      res.json({
        success: true,
        data: {
          pointsEarned: row.points_earned,
          multiplier: parseFloat(row.tier_multiplier) || 1,
          newBalance: row.new_balance,
          newTier: null,
        },
      });
    } catch (error: any) {
      if (res.headersSent) return;
      console.error('Error earning points:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to earn points',
        message: error.message,
      });
    }
  }

  /**
   * Redeem points for a user (ATOMIC via RPC + Mutex)
   */
  async redeemPoints(req: Request, res: Response) {
    try {
      const validation = redeemPointsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { userId, points, description, referenceType, referenceId } = validation.data;
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      // Get settings scoped to property
      let settingsQuery = supabase.from('loyalty_settings').select('*');
      if (propertyId) settingsQuery = settingsQuery.eq('property_id', propertyId);
      const { data: settings } = await settingsQuery.limit(1).single();

      const minRedemption = settings?.min_redemption || 100;
      const redemptionRate = settings?.redemption_rate || 0.01;

      if (points < minRedemption) {
        return res.status(400).json({
          success: false,
          error: `Minimum redemption is ${minRedemption} points`,
        });
      }

      const dollarValue = points * redemptionRate;

      const { data: result, error: rpcError } = await supabase.rpc(
        'redeem_loyalty_points_atomic',
        {
          p_user_id: userId,
          p_points: points,
          p_order_id: referenceId || '00000000-0000-0000-0000-000000000000',
          p_dollar_value: dollarValue,
        }
      );

      if (rpcError) throw rpcError;

      const row = result?.[0];
      if (!row?.success) {
        const errMsg = row?.error_message || 'Failed to redeem points';
        const status = errMsg.includes('Insufficient') ? 400 : errMsg.includes('not found') ? 404 : 400;
        return res.status(status).json({
          success: false,
          error: errMsg,
          available: row?.new_balance,
        });
      }

      res.json({
        success: true,
        data: {
          pointsRedeemed: row.points_redeemed,
          dollarValue,
          newBalance: row.new_balance,
        },
      });
    } catch (error: any) {
      if (res.headersSent) return;
      console.error('Error redeeming points:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to redeem points',
        message: error.message,
      });
    }
  }

  /**
   * Adjust points (admin only) (ATOMIC via RPC + Mutex)
   */
  async adjustPoints(req: Request, res: Response) {
    try {
      const validation = adjustPointsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { userId, points, reason } = validation.data;
      const supabase = getSupabase();

      const { data: result, error: rpcError } = await supabase.rpc(
        'adjust_loyalty_points_atomic',
        {
          p_user_id: userId,
          p_points: points,
          p_reason: reason || 'Admin adjustment',
          p_admin_id: req.user?.id || null,
        }
      );

      if (rpcError) throw rpcError;

      const row = result?.[0];
      if (!row?.success) {
        return res.status(404).json({
          success: false,
          error: row?.error_message || 'Loyalty account not found',
        });
      }

      res.json({
        success: true,
        data: {
          adjustment: row.adjustment,
          newBalance: row.new_balance,
          reason,
          newTier: row.tier_name,
        },
      });
    } catch (error: any) {
      if (res.headersSent) return;
      console.error('Error adjusting points:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to adjust points',
        message: error.message,
      });
    }
  }

  /**
   * Adjust points by account ID (admin only) (ATOMIC via RPC)
   */
  async adjustPointsByAccountId(req: Request, res: Response) {
    try {
      const { accountId } = req.params;
      const validation = adjustPointsByAccountIdSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { points, reason } = validation.data;
      const supabase = getSupabase();

      const { data: result, error: rpcError } = await supabase.rpc(
        'adjust_loyalty_points_by_account_atomic',
        {
          p_account_id: accountId,
          p_points: points,
          p_reason: reason || 'Admin adjustment',
          p_admin_id: req.user?.id || null,
        }
      );

      if (rpcError) throw rpcError;

      const row = result?.[0];
      if (!row?.success) {
        return res.status(404).json({
          success: false,
          error: row?.error_message || 'Loyalty account not found',
        });
      }

      res.json({
        success: true,
        data: {
          adjustment: row.adjustment,
          newBalance: row.new_balance,
          reason,
          newTier: row.tier_name,
        },
      });
    } catch (error: any) {
      console.error('Error adjusting points by account ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to adjust points',
        message: error.message,
      });
    }
  }

  /**
   * Get transaction history
   */
  async getTransactions(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { page = '1', limit = '20', type } = req.query;
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      // Find member — scoped to property
      let memberQuery = supabase.from('loyalty_members').select('id').eq('user_id', userId);
      if (propertyId) memberQuery = memberQuery.eq('property_id', propertyId);
      const { data: account } = await memberQuery.single();

      if (!account) {
        return res.json({ success: true, data: [], pagination: { total: 0 } });
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = supabase
        .from('loyalty_transactions')
        .select('*', { count: 'exact' })
        .eq('member_id', account.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (type) {
        query = query.eq('type', type);
      }

      const { data: transactions, count, error } = await query;
      if (error) throw error;

      const allReferenceIds = (transactions || []).map((row: any) => row.reference_id).filter(Boolean);

      const { data: transactionData } = await supabase
        .from('transactions')
        .select('id, engine_type, metadata, amount, status')
        .in('id', allReferenceIds);

      const legacyTypeMap: Record<string, string> = {
        'instant_transaction': 'restaurant_order',
        'shared_capacity_access': 'pool_ticket',
        'time_exclusive_reservation': 'chalet_booking',
      };

      const sourceLookup = new Map<string, any>();
      (transactionData || []).forEach((row: any) => sourceLookup.set(row.id, row));

      const enrichedTransactions = (transactions || []).map((row: any) => {
        const source = row.reference_id ? sourceLookup.get(row.reference_id) : undefined;
        if (!source) return row;
        const meta = source.metadata || {};
        return {
          ...row,
          source_summary: {
            type: source.engine_type,
            id: row.reference_id,
            number: meta.order_number || meta.booking_number || row.reference_id || meta.ticket_number || null,
            total_amount: source.amount || null,
            status: source.status || null,
          },
        };
      });

      res.json({
        success: true,
        data: enrichedTransactions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limitNum),
        },
      });
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transactions',
        message: error.message,
      });
    }
  }

  /**
   * Get all tiers
   */
  async getTiers(req: Request, res: Response) {
    try {
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      let tiersQuery = supabase.from('loyalty_tiers').select('*');
      if (propertyId) tiersQuery = tiersQuery.eq('property_id', propertyId);

      const { data: tiers, error } = await tiersQuery.order('min_points', { ascending: true });
      if (error) throw error;

      res.json({ success: true, data: tiers });
    } catch (error: any) {
      console.error('Error fetching tiers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tiers',
        message: error.message,
      });
    }
  }

  /**
   * Update a tier (admin only)
   */
  async updateTier(req: Request, res: Response) {
    try {
      const { tierId } = req.params;
      const validation = updateTierSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      const updates: Record<string, any> = {};
      if (data.name !== undefined) updates.name = data.name;
      if (data.min_points !== undefined) updates.min_points = data.min_points;
      if (data.points_multiplier !== undefined) updates.points_multiplier = data.points_multiplier;
      if (data.benefits !== undefined) updates.benefits = data.benefits;
      if (data.color !== undefined) updates.color = data.color;
      if (data.icon !== undefined) updates.icon = data.icon;
      if (data.is_active !== undefined) updates.is_active = data.is_active;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      let updateQuery = supabase.from('loyalty_tiers').update(updates).eq('id', tierId);
      if (propertyId) updateQuery = updateQuery.eq('property_id', propertyId);

      const { data: tier, error } = await updateQuery.select().single();
      if (error) throw error;

      res.json({ success: true, data: tier });
    } catch (error: any) {
      console.error('Error updating tier:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update tier',
        message: error.message,
      });
    }
  }

  /**
   * Get loyalty settings
   */
  async getSettings(req: Request, res: Response) {
    try {
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      let settingsQuery = supabase.from('loyalty_settings').select('*');
      if (propertyId) settingsQuery = settingsQuery.eq('property_id', propertyId);

      const { data: settings, error } = await settingsQuery.limit(1).single();
      if (error && error.code !== 'PGRST116') throw error;

      res.json({ success: true, data: settings || {} });
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch settings',
        message: error.message,
      });
    }
  }

  /**
   * Update loyalty settings (admin only)
   */
  async updateSettings(req: Request, res: Response) {
    try {
      const validation = updateSettingsSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      const updates: Record<string, any> = {};
      if (data.pointsPerDollar !== undefined) updates.points_per_dollar = data.pointsPerDollar;
      if (data.redemptionRate !== undefined) updates.redemption_rate = data.redemptionRate;
      if (data.minRedemption !== undefined) updates.min_redemption = data.minRedemption;
      if (data.pointsExpiryDays !== undefined) updates.points_expiry_days = data.pointsExpiryDays;
      if (data.signupBonus !== undefined) updates.signup_bonus = data.signupBonus;
      if (data.birthdayBonus !== undefined) updates.birthday_bonus = data.birthdayBonus;
      if (data.isEnabled !== undefined) updates.is_enabled = data.isEnabled;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      // Check if settings exist for this property
      let findQuery = supabase.from('loyalty_settings').select('id');
      if (propertyId) findQuery = findQuery.eq('property_id', propertyId);
      const { data: existing } = await findQuery.limit(1).single();

      let settings;
      if (existing) {
        const { data, error } = await supabase
          .from('loyalty_settings')
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        settings = data;
      } else {
        const { data, error } = await supabase
          .from('loyalty_settings')
          .insert({ ...updates, property_id: propertyId || null })
          .select()
          .single();
        if (error) throw error;
        settings = data;
      }

      res.json({ success: true, data: settings });
    } catch (error: any) {
      console.error('Error updating settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update settings',
        message: error.message,
      });
    }
  }

  /**
   * Get all loyalty accounts (admin)
   */
  async getAllAccounts(req: Request, res: Response) {
    try {
      const { page = '1', limit = '20', tier, search } = req.query;
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = supabase
        .from('loyalty_members')
        .select(`
          *,
          user:users (id, email, full_name),
          tier:loyalty_tiers(*)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (propertyId) query = query.eq('property_id', propertyId);
      if (tier) query = query.eq('tier_id', tier);

      const { data: accounts, count, error } = await query;
      if (error) throw error;

      res.json({
        success: true,
        data: accounts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limitNum),
        },
      });
    } catch (error: any) {
      console.error('Error fetching all accounts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch accounts',
        message: error.message,
      });
    }
  }

  /**
   * Get loyalty statistics (admin dashboard)
   */
  async getStats(req: Request, res: Response) {
    try {
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      // Total members — scoped to property
      let membersQuery = supabase.from('loyalty_members').select('*', { count: 'exact', head: true });
      if (propertyId) membersQuery = membersQuery.eq('property_id', propertyId);
      const { count: totalMembers } = await membersQuery;

      // Points data — scoped to property
      let pointsQuery = supabase.from('loyalty_members').select('available_points, lifetime_points');
      if (propertyId) pointsQuery = pointsQuery.eq('property_id', propertyId);
      const { data: pointsData } = await pointsQuery;

      const totalOutstanding = pointsData?.reduce((sum, row) => sum + (row.available_points || 0), 0) || 0;
      const totalLifetime = pointsData?.reduce((sum, row) => sum + (row.lifetime_points || 0), 0) || 0;

      // Tier distribution — scoped to property
      let tierQuery = supabase.from('loyalty_members').select(`tier_id, tier:loyalty_tiers(name, color)`);
      if (propertyId) tierQuery = tierQuery.eq('property_id', propertyId);
      const { data: tierAccounts } = await tierQuery;

      const tierCounts: Record<string, { name: string; color: string; count: number }> = {};
      tierAccounts?.forEach((account: any) => {
        const tierName = account.tier?.name || 'Unknown';
        const tierColor = account.tier?.color || '#6b7280';
        if (!tierCounts[tierName]) {
          tierCounts[tierName] = { name: tierName, color: tierColor, count: 0 };
        }
        tierCounts[tierName].count++;
      });

      // Recent activity (last 30 days) — transactions are member-scoped, not property-scoped directly.
      // Join via loyalty_members to respect property isolation.
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get member IDs for this property first
      let memberIdsQuery = supabase.from('loyalty_members').select('id');
      if (propertyId) memberIdsQuery = memberIdsQuery.eq('property_id', propertyId);
      const { data: memberIds } = await memberIdsQuery;
      const memberIdList = (memberIds || []).map((m: any) => m.id);

      let recentTransactions: any[] = [];
      if (memberIdList.length > 0) {
        const { data: txData } = await supabase
          .from('loyalty_transactions')
          .select('type, points, created_at')
          .in('member_id', memberIdList)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false });
        recentTransactions = txData || [];
      }

      const activityByDate: Record<string, { earned: number; redeemed: number; count: number }> = {};
      recentTransactions.forEach((t: any) => {
        const date = new Date(t.created_at).toISOString().split('T')[0];
        if (!activityByDate[date]) {
          activityByDate[date] = { earned: 0, redeemed: 0, count: 0 };
        }
        if (t.type === 'earn') {
          activityByDate[date].earned += t.points;
        } else if (t.type === 'redeem') {
          activityByDate[date].redeemed += Math.abs(t.points);
        }
        activityByDate[date].count++;
      });

      res.json({
        success: true,
        data: {
          summary: {
            total_members: totalMembers,
            total_outstanding_points: totalOutstanding,
            total_lifetime_points: totalLifetime,
            avg_points_per_member: (totalMembers || 0) > 0 ? Math.round(totalOutstanding / (totalMembers || 1)) : 0,
          },
          tierDistribution: Object.values(tierCounts),
          recentActivity: Object.entries(activityByDate).map(([date, data]) => ({
            date,
            points_earned: data.earned,
            points_redeemed: data.redeemed,
            transaction_count: data.count,
          })),
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
   * Calculate points for an order (helper for checkout)
   */
  async calculatePoints(req: Request, res: Response) {
    try {
      const { userId, amount } = req.body;
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid amount' });
      }

      let settingsQuery = supabase.from('loyalty_settings').select('*').eq('is_enabled', true);
      if (propertyId) settingsQuery = settingsQuery.eq('property_id', propertyId);
      const { data: settings } = await settingsQuery.limit(1).single();

      if (!settings) {
        return res.json({ success: true, data: { pointsToEarn: 0, enabled: false } });
      }

      let multiplier = 1;
      if (userId) {
        let memberQuery = supabase
          .from('loyalty_members')
          .select(`tier:loyalty_tiers(points_multiplier)`)
          .eq('user_id', userId);
        if (propertyId) memberQuery = memberQuery.eq('property_id', propertyId);
        const { data: account } = await memberQuery.single();
        multiplier = (account?.tier as any)?.points_multiplier || 1;
      }

      const pointsToEarn = Math.floor(amount * settings.points_per_dollar * multiplier);
      const dollarValue = pointsToEarn * settings.redemption_rate;

      res.json({
        success: true,
        data: { pointsToEarn, multiplier, dollarValue, enabled: true },
      });
    } catch (error: any) {
      console.error('Error calculating points:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate points',
        message: error.message,
      });
    }
  }

  /**
   * Enroll user (POST /enroll) — delegates to getAccount which auto-creates with signup bonus
   */
  async enrollUser(req: Request, res: Response) {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
      }
      req.params.userId = userId;
      return this.getAccount(req, res);
    } catch (error: any) {
      console.error('Error enrolling in loyalty program:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to enroll in loyalty program',
        message: error.message,
      });
    }
  }

  /**
   * Create a new tier (POST /tiers)
   */
  async createTier(req: Request, res: Response) {
    try {
      const validation = createTierSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const data = validation.data;
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      const tierPayload: Record<string, any> = {
        name: data.name,
        min_points: data.min_points,
        points_multiplier: data.points_multiplier,
        benefits: data.benefits,
        color: data.color,
        icon: data.icon,
        is_active: data.is_active,
        property_id: propertyId || null,
      };

      let { data: tier, error } = await supabase
        .from('loyalty_tiers')
        .insert(tierPayload)
        .select()
        .single();

      // Compat fallback: legacy schema may not have is_active column
      if (error && /is_active|schema cache|column/i.test(String(error.message || error.details || ''))) {
        const { is_active, ...payloadWithoutActive } = tierPayload;
        ({ data: tier, error } = await supabase
          .from('loyalty_tiers')
          .insert(payloadWithoutActive)
          .select()
          .single());
      }

      // Idempotent for repeated setup runs
      if (error && error.code === '23505') {
        let dupeQuery = supabase.from('loyalty_tiers').select('*').eq('name', data.name);
        if (propertyId) dupeQuery = dupeQuery.eq('property_id', propertyId);
        ({ data: tier, error } = await dupeQuery.single());
      }

      if (error) throw error;

      res.status(201).json({ success: true, data: tier });
    } catch (error: any) {
      console.error('Error creating tier:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create tier',
        message: error.message,
      });
    }
  }

  /**
   * Delete a tier (DELETE /tiers/:tierId)
   */
  async deleteTier(req: Request, res: Response) {
    try {
      const { tierId } = req.params;
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      // Check tier isn't in use — check both table names for compat
      const { data: accountsUsingTier } = await supabase
        .from('loyalty_members')
        .select('id')
        .eq('tier_id', tierId)
        .limit(1);

      if (accountsUsingTier && accountsUsingTier.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete tier: it is currently assigned to members. Reassign them first.',
        });
      }

      let deleteQuery = supabase.from('loyalty_tiers').delete().eq('id', tierId);
      if (propertyId) deleteQuery = deleteQuery.eq('property_id', propertyId);

      const { error } = await deleteQuery;
      if (error) throw error;

      res.json({ success: true, message: 'Tier deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting tier:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete tier',
        message: error.message,
      });
    }
  }
}

export const loyaltyController = new LoyaltyController();
