import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { z } from 'zod';

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
  minPoints: z.number().int().min(0).optional(),
  pointsMultiplier: z.number().positive().optional(),
  benefits: z.array(z.string()).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export class LoyaltyController {
  /**
   * Get loyalty account for a user
   */
  async getAccount(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const supabase = getSupabase();

      // Get account with tier info
      const { data: account, error } = await supabase
        .from('loyalty_accounts')
        .select(`
          *,
          tier:loyalty_tiers(*)
        `)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!account) {
        // Create account if doesn't exist
        const { data: settings } = await supabase
          .from('loyalty_settings')
          .select('*')
          .limit(1)
          .single();

        const { data: defaultTier } = await supabase
          .from('loyalty_tiers')
          .select('id')
          .order('min_points', { ascending: true })
          .limit(1)
          .single();

        const signupBonus = settings?.signup_bonus || 0;

        const { data: newAccount, error: createError } = await supabase
          .from('loyalty_accounts')
          .insert({
            user_id: userId,
            tier_id: defaultTier?.id,
            available_points: signupBonus,
            total_points: signupBonus,
            lifetime_points: signupBonus,
          })
          .select(`*, tier:loyalty_tiers(*)`)
          .single();

        if (createError) throw createError;

        // Log signup bonus if any
        if (signupBonus > 0) {
          await supabase.from('loyalty_transactions').insert({
            account_id: newAccount.id,
            type: 'bonus',
            points: signupBonus,
            balance_after: signupBonus,
            description: 'Welcome bonus',
          });
        }

        return res.json({
          success: true,
          data: newAccount,
        });
      }

      res.json({
        success: true,
        data: account,
      });
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
      // JWT payload uses 'userId', not 'id'
      const userId = (req as any).user?.userId || (req as any).user?.id;
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
   * Earn points for a user
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

      // Get or create account
      let { data: account } = await supabase
        .from('loyalty_accounts')
        .select(`*, tier:loyalty_tiers(*)`)
        .eq('user_id', userId)
        .single();

      if (!account) {
        const { data: defaultTier } = await supabase
          .from('loyalty_tiers')
          .select('id')
          .order('min_points', { ascending: true })
          .limit(1)
          .single();

        const { data: newAccount, error } = await supabase
          .from('loyalty_accounts')
          .insert({
            user_id: userId,
            tier_id: defaultTier?.id,
            available_points: 0,
            total_points: 0,
            lifetime_points: 0,
          })
          .select(`*, tier:loyalty_tiers(*)`)
          .single();

        if (error) throw error;
        account = newAccount;
      }

      // Get settings
      const { data: settings } = await supabase
        .from('loyalty_settings')
        .select('*')
        .limit(1)
        .single();

      const multiplier = (account.tier as any)?.points_multiplier || 1;
      const earnedPoints = Math.floor(points * multiplier);
      const newBalance = (account.available_points || 0) + earnedPoints;
      const newLifetime = (account.lifetime_points || 0) + earnedPoints;

      // Update account
      const { error: updateError } = await supabase
        .from('loyalty_accounts')
        .update({
          available_points: newBalance,
          total_points: newBalance,
          lifetime_points: newLifetime,
          last_activity: new Date().toISOString(),
        })
        .eq('id', account.id);

      if (updateError) throw updateError;

      // Log transaction
      await supabase.from('loyalty_transactions').insert({
        account_id: account.id,
        type: 'earn',
        points: earnedPoints,
        balance_after: newBalance,
        description: description || 'Points earned',
        reference_type: referenceType,
        reference_id: referenceId,
        created_by: (req as any).user?.id,
      });

      // Check for tier upgrade
      const { data: newTier } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .lte('min_points', newLifetime)
        .order('min_points', { ascending: false })
        .limit(1)
        .single();

      let tierUpgrade = null;
      if (newTier && newTier.id !== account.tier_id) {
        await supabase
          .from('loyalty_accounts')
          .update({ tier_id: newTier.id })
          .eq('id', account.id);
        tierUpgrade = newTier.name;
      }

      res.json({
        success: true,
        data: {
          pointsEarned: earnedPoints,
          multiplier,
          newBalance,
          newTier: tierUpgrade,
        },
      });
    } catch (error: any) {
      console.error('Error earning points:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to earn points',
        message: error.message,
      });
    }
  }

  /**
   * Redeem points for a user
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
      const supabase = getSupabase();

      // Get account
      const { data: account, error } = await supabase
        .from('loyalty_accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !account) {
        return res.status(404).json({ success: false, error: 'Loyalty account not found' });
      }

      // Get settings for min redemption
      const { data: settings } = await supabase
        .from('loyalty_settings')
        .select('*')
        .limit(1)
        .single();

      const minRedemption = settings?.min_redemption || 100;
      const redemptionRate = settings?.redemption_rate || 0.01;

      if (points < minRedemption) {
        return res.status(400).json({
          success: false,
          error: `Minimum redemption is ${minRedemption} points`,
        });
      }

      if ((account.available_points || 0) < points) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient points',
          available: account.available_points || 0,
        });
      }

      const newBalance = (account.available_points || 0) - points;
      const dollarValue = points * redemptionRate;

      // Update account
      await supabase
        .from('loyalty_accounts')
        .update({
          available_points: newBalance,
          total_points: newBalance,
          last_activity: new Date().toISOString(),
        })
        .eq('id', account.id);

      // Log transaction
      await supabase.from('loyalty_transactions').insert({
        account_id: account.id,
        type: 'redeem',
        points: -points,
        balance_after: newBalance,
        description: description || 'Points redeemed',
        reference_type: referenceType,
        reference_id: referenceId,
        created_by: (req as any).user?.id,
      });

      res.json({
        success: true,
        data: {
          pointsRedeemed: points,
          dollarValue,
          newBalance,
        },
      });
    } catch (error: any) {
      console.error('Error redeeming points:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to redeem points',
        message: error.message,
      });
    }
  }

  /**
   * Adjust points (admin only)
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

      const { data: account, error } = await supabase
        .from('loyalty_accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !account) {
        return res.status(404).json({ success: false, error: 'Loyalty account not found' });
      }

      const newBalance = Math.max(0, (account.available_points || 0) + points);
      const newLifetime = points > 0 ? (account.lifetime_points || 0) + points : (account.lifetime_points || 0);

      await supabase
        .from('loyalty_accounts')
        .update({
          available_points: newBalance,
          total_points: newBalance,
          lifetime_points: newLifetime,
        })
        .eq('id', account.id);

      await supabase.from('loyalty_transactions').insert({
        account_id: account.id,
        type: 'adjust',
        points: points,
        balance_after: newBalance,
        description: reason,
        created_by: (req as any).user?.id,
      });

      res.json({
        success: true,
        data: {
          adjustment: points,
          newBalance,
          reason,
        },
      });
    } catch (error: any) {
      console.error('Error adjusting points:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to adjust points',
        message: error.message,
      });
    }
  }

  /**
   * Adjust points by account ID (admin only)
   * This route accepts accountId in URL path instead of userId in body
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

      const { data: account, error } = await supabase
        .from('loyalty_accounts')
        .select('*')
        .eq('id', accountId)
        .single();

      if (error || !account) {
        return res.status(404).json({ success: false, error: 'Loyalty account not found' });
      }

      const newBalance = Math.max(0, (account.available_points || 0) + points);
      const newLifetime = points > 0 ? (account.lifetime_points || 0) + points : (account.lifetime_points || 0);

      await supabase
        .from('loyalty_accounts')
        .update({
          available_points: newBalance,
          total_points: newBalance,
          lifetime_points: newLifetime,
        })
        .eq('id', account.id);

      await supabase.from('loyalty_transactions').insert({
        account_id: account.id,
        type: 'adjust',
        points: points,
        balance_after: newBalance,
        description: reason,
        created_by: (req as any).user?.id,
      });

      res.json({
        success: true,
        data: {
          adjustment: points,
          newBalance,
          reason,
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
      const supabase = getSupabase();

      // First get account
      const { data: account } = await supabase
        .from('loyalty_accounts')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!account) {
        return res.json({ success: true, data: [], pagination: { total: 0 } });
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = supabase
        .from('loyalty_transactions')
        .select('*', { count: 'exact' })
        .eq('account_id', account.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (type) {
        query = query.eq('type', type);
      }

      const { data: transactions, count, error } = await query;

      if (error) throw error;

      res.json({
        success: true,
        data: transactions,
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
      const supabase = getSupabase();
      const { data: tiers, error } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .order('min_points', { ascending: true });

      if (error) throw error;

      res.json({
        success: true,
        data: tiers,
      });
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
      const supabase = getSupabase();

      const updates: Record<string, any> = {};
      if (data.name !== undefined) updates.name = data.name;
      if (data.minPoints !== undefined) updates.min_points = data.minPoints;
      if (data.pointsMultiplier !== undefined) updates.points_multiplier = data.pointsMultiplier;
      if (data.benefits !== undefined) updates.benefits = data.benefits;
      if (data.color !== undefined) updates.color = data.color;
      if (data.icon !== undefined) updates.icon = data.icon;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      const { data: tier, error } = await supabase
        .from('loyalty_tiers')
        .update(updates)
        .eq('id', tierId)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        data: tier,
      });
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
      const supabase = getSupabase();
      const { data: settings, error } = await supabase
        .from('loyalty_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      res.json({
        success: true,
        data: settings || {},
      });
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

      // Check if settings exist
      const { data: existing } = await supabase
        .from('loyalty_settings')
        .select('id')
        .limit(1)
        .single();

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
          .insert(updates)
          .select()
          .single();
        if (error) throw error;
        settings = data;
      }

      res.json({
        success: true,
        data: settings,
      });
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
      const supabase = getSupabase();

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = supabase
        .from('loyalty_accounts')
        .select(`
          *,
          user:users(id, full_name, email),
          tier:loyalty_tiers(id, name, color)
        `, { count: 'exact' })
        .order('lifetime_points', { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (tier) {
        query = query.eq('tier_id', tier);
      }

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
      const supabase = getSupabase();

      // Get summary stats
      const { data: accounts } = await supabase
        .from('loyalty_accounts')
        .select('available_points, lifetime_points');

      const totalMembers = accounts?.length || 0;
      const totalOutstanding = accounts?.reduce((sum, a) => sum + (a.available_points || 0), 0) || 0;
      const totalLifetime = accounts?.reduce((sum, a) => sum + (a.lifetime_points || 0), 0) || 0;

      // Get tier distribution
      const { data: tierAccounts } = await supabase
        .from('loyalty_accounts')
        .select(`
          tier_id,
          tier:loyalty_tiers(name, color)
        `)
        .eq('is_active', true);

      const tierCounts: Record<string, { name: string; color: string; count: number }> = {};
      tierAccounts?.forEach((account: any) => {
        const tierName = account.tier?.name || 'Unknown';
        const tierColor = account.tier?.color || '#6b7280';
        if (!tierCounts[tierName]) {
          tierCounts[tierName] = { name: tierName, color: tierColor, count: 0 };
        }
        tierCounts[tierName].count++;
      });

      // Get recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentTransactions } = await supabase
        .from('loyalty_transactions')
        .select('type, points, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      // Group by date
      const activityByDate: Record<string, { earned: number; redeemed: number; count: number }> = {};
      recentTransactions?.forEach((t: any) => {
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
            avg_points_per_member: totalMembers > 0 ? Math.round(totalOutstanding / totalMembers) : 0,
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
      const supabase = getSupabase();

      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid amount' });
      }

      const { data: settings } = await supabase
        .from('loyalty_settings')
        .select('*')
        .eq('is_enabled', true)
        .limit(1)
        .single();

      if (!settings) {
        return res.json({
          success: true,
          data: { pointsToEarn: 0, enabled: false },
        });
      }

      let multiplier = 1;
      if (userId) {
        const { data: account } = await supabase
          .from('loyalty_accounts')
          .select(`tier:loyalty_tiers(points_multiplier)`)
          .eq('user_id', userId)
          .single();
        multiplier = (account?.tier as any)?.points_multiplier || 1;
      }

      const pointsToEarn = Math.floor(amount * settings.points_per_dollar * multiplier);
      const dollarValue = pointsToEarn * settings.redemption_rate;

      res.json({
        success: true,
        data: {
          pointsToEarn,
          multiplier,
          dollarValue,
          enabled: true,
        },
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
}

export const loyaltyController = new LoyaltyController();
