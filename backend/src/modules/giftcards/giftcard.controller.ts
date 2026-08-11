import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { getScopedClient } from '../../security/scoped-client.js';
import { z } from 'zod';
import crypto from 'crypto';
import { emailService } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';

/**
 * Gift Card Controller
 *
 * Issue 17: Added property_id scoping on all queries and inserts.
 * Template system (getTemplates, createTemplate, updateTemplate) removed per CONTEXT — templates
 * were a static-product layer that doesn't fit the white-label model. Routes were already cleaned.
 *
 * Admin routes (giftcard.routes.ts) now run validatePropertyAccess +
 * requirePropertyId before reaching any handler below — that pair verifies
 * the caller's property_id belongs to their own tenant and rejects the
 * request outright if it's missing. getPropertyId() here just reads the
 * already-validated value; it no longer needs to (and must not) fall back to
 * "unscoped" the way the old local header-reading version did — that fallback
 * was a cross-tenant data leak (see CONTEXT.md cross-tenant sweep).
 */

/**
 * Permissive property resolution for customer-facing endpoints (purchase,
 * balance check, redeem, my-cards) that are NOT gated by validatePropertyAccess
 * / requirePropertyId — a guest checking a balance may have no property
 * context at all, and that's a legitimate state for these routes.
 */
function getPropertyId(req: Request): string | undefined {
  return (req as any).propertyId || req.property?.id || (req.headers?.['x-property-id'] as string) || undefined;
}

/**
 * Strict property resolution for admin endpoints. Admin routes
 * (giftcard.routes.ts) run validatePropertyAccess + requirePropertyId before
 * reaching any handler here — that pair verifies the caller's property_id
 * belongs to their own tenant and rejects the request outright if it's
 * missing. This just reads the already-validated value; it must NOT fall
 * back to "unscoped" the way the old local header-reading version did — that
 * fallback was a cross-tenant data leak (see CONTEXT.md cross-tenant sweep).
 * Throwing here is a defense-in-depth backstop in case a route is ever wired
 * up without that middleware — it fails closed instead of querying unscoped.
 */
function getAdminPropertyId(req: Request): string {
  const propertyId = (req as any).propertyId as string | undefined;
  if (!propertyId) {
    throw new Error('Property context missing — requirePropertyId middleware must run before this handler');
  }
  return propertyId;
}

/**
 * Resolve the tenant that owns propertyId directly from the DB, rather than
 * trusting req.tenant. req.tenant is derived from a client-supplied header
 * (X-Tenant-ID/X-Tenant-Slug) and, for a super_admin, may legitimately not
 * match the tenant that owns the specific property being acted on (super
 * admins can act on any property — see validatePropertyAccess). Looking the
 * tenant up from the property itself is correct for every caller, not just
 * the common case.
 */
async function getTenantIdForProperty(propertyId: string): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('properties').select('tenant_id').eq('id', propertyId).maybeSingle();
  if (error || !data?.tenant_id) {
    throw new Error(`Could not resolve tenant for property ${propertyId}`);
  }
  return data.tenant_id;
}

/**
 * Tenant resolution for customer-facing purchase flow, where propertyId may
 * be absent. req.tenant is set globally by resolveTenant for every /api
 * request (subdomain/slug/header resolution) — it is NOT client-spoofable
 * in a way that matters here since a mis-scoped purchase only affects the
 * purchasing tenant's own data, not a cross-tenant read/write. The previous
 * version of this function fell back to `SELECT tenant_id FROM properties
 * LIMIT 1` when nothing else resolved — silently assigning a purchase to an
 * arbitrary, unrelated tenant. That fallback is removed; an unresolvable
 * tenant now fails the purchase instead of mis-filing it.
 */
async function getTenantIdForPurchase(req: Request, propertyId?: string): Promise<string> {
  const reqTenantId = req.tenant?.id || req.user?.tenantId;
  if (reqTenantId) return reqTenantId;
  if (propertyId) {
    return getTenantIdForProperty(propertyId);
  }
  throw new Error('Unable to resolve tenant for this request — no tenant context and no property context');
}

// Validation schemas
const createGiftCardSchema = z.object({
  amount: z.number().positive().min(10).max(1000).optional(),
  initialValue: z.number().positive().min(10).max(1000).optional(),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().max(100).optional(),
  message: z.string().max(500).optional(),
  personalMessage: z.string().max(500).optional(),
  expiresInDays: z.number().int().positive().default(365),
}).refine(data => data.amount || data.initialValue, {
  message: "Either 'amount' or 'initialValue' is required",
});

const purchaseGiftCardSchema = z.object({
  amount: z.number().positive().min(10).max(1000).optional(),
  customAmount: z.number().positive().min(10).max(1000).optional(),
  recipientEmail: z.string().email(),
  recipientName: z.string().max(100).optional(),
  senderName: z.string().max(100).optional(),
  message: z.string().max(500).optional(),
  personalMessage: z.string().max(500).optional(),
  isGuestPurchase: z.boolean().optional(),
  senderEmail: z.string().email().optional(),
}).refine(data => data.amount || data.customAmount, {
  message: "Either 'amount' or 'customAmount' is required",
});

const redeemGiftCardSchema = z.object({
  code: z.string().min(8).max(20),
  amount: z.number().positive(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
});

// Generate unique gift card code using cryptographically secure random
function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}

// In-process mutex to prevent same-card concurrent redemption races.
const giftCardLocks = new Map<string, Promise<void>>();

async function acquireGiftCardLock(code: string): Promise<() => void> {
  while (giftCardLocks.has(code)) {
    await giftCardLocks.get(code);
  }
  let releaseLock: (() => void) | null = null;
  const lockPromise = new Promise<void>((resolve) => { releaseLock = resolve; });
  giftCardLocks.set(code, lockPromise);
  return () => {
    giftCardLocks.delete(code);
    if (releaseLock) releaseLock();
  };
}

export class GiftCardController {
  /**
   * Purchase a gift card (customer / guest)
   */
  async purchaseGiftCard(req: Request, res: Response) {
    try {
      const validation = purchaseGiftCardSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        });
      }

      const { amount, customAmount, recipientEmail, recipientName, senderName, message, personalMessage } = validation.data;
      const userId = req.user?.id;
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      const finalAmount = amount || customAmount;
      if (!finalAmount) {
        return res.status(400).json({ success: false, error: 'Amount is required' });
      }

      const finalMessage = message || personalMessage;

      // Generate unique code
      let code: string = '';
      let codeExists = true;
      while (codeExists) {
        code = generateGiftCardCode();
        const { data: existing } = await supabase
          .from('gift_cards')
          .select('id')
          .eq('code', code)
          .single();
        codeExists = !!existing;
      }

      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      const tenant_id = await getTenantIdForPurchase(req, propertyId);
      const { data: giftCard, error: insertError } = await supabase
        .from('gift_cards')
        .insert({
          code,
          initial_value: finalAmount,
          current_balance: finalAmount,
          status: 'active',
          purchased_by: userId || null,
          recipient_email: recipientEmail,
          recipient_name: recipientName || null,
          personal_message: finalMessage || null,
          sender_name: senderName || null,
          expires_at: expiresAt.toISOString(),
          property_id: propertyId || null,
          tenant_id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase.from('gift_card_transactions').insert({
        gift_card_id: giftCard.id,
        transaction_type: 'purchase',
        amount: finalAmount,
        balance_after: finalAmount,
        notes: 'Gift card purchased',
        performed_by: userId,
      });

      if (recipientEmail) {
        let purchaserName: string | undefined = senderName;
        if (!purchaserName && userId) {
          const { data: purchaser } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', userId)
            .single();
          purchaserName = purchaser?.full_name;
        }

        const emailSent = await emailService.sendGiftCard({
          recipientEmail,
          recipientName: recipientName || 'Valued Guest',
          senderName: purchaserName,
          code: giftCard.code,
          amount: finalAmount,
          message: finalMessage,
          expiresAt: giftCard.expires_at,
        });

        if (!emailSent) {
          logger.warn(`Gift card email failed to send for code ${giftCard.code}`);
        } else {
          logger.info(`Gift card email sent to ${recipientEmail}`);
        }
      }

      res.status(201).json({
        success: true,
        data: {
          id: giftCard.id,
          code: giftCard.code,
          amount: finalAmount,
          recipientEmail,
          recipientName,
          expiresAt: giftCard.expires_at,
        },
        message: 'Gift card created successfully',
      });
    } catch (error: any) {
      console.error('Error purchasing gift card:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to purchase gift card',
        message: error.message,
      });
    }
  }

  /**
   * Check gift card balance (public)
   */
  async checkBalance(req: Request, res: Response) {
    try {
      const { code } = req.params;

      if (!code || code.length < 4) {
        return res.status(400).json({ success: false, error: 'Invalid gift card code' });
      }

      const upperCode = code.toUpperCase();
      const normalizedCode = upperCode.replace(/-/g, '');
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      let query = supabase
        .from('gift_cards')
        .select('id, code, current_balance, status, expires_at')
        .or(`code.eq.${upperCode},code.eq.${normalizedCode}`)
        .limit(1);
      if (propertyId) query = query.eq('property_id', propertyId);

      const { data: card, error } = await query.single();

      if (error || !card) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      if (card.expires_at && new Date(card.expires_at) < new Date()) {
        return res.json({
          success: true,
          data: { code: card.code, balance: 0, status: 'expired', message: 'This gift card has expired' },
        });
      }

      if (card.status !== 'active') {
        return res.json({
          success: true,
          data: {
            code: card.code,
            balance: card.current_balance,
            status: card.status,
            message: card.status === 'used' ? 'This gift card has been fully redeemed' : 'This gift card is not active',
          },
        });
      }

      res.json({
        success: true,
        data: {
          code: card.code,
          balance: parseFloat(card.current_balance),
          status: card.status,
          expiresAt: card.expires_at,
        },
      });
    } catch (error: any) {
      console.error('Error checking balance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check gift card balance',
        message: error.message,
      });
    }
  }

  /**
   * Redeem gift card (at checkout) — atomic RPC with SELECT ... FOR UPDATE
   */
  async redeemGiftCard(req: Request, res: Response) {
    try {
      const validation = redeemGiftCardSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        });
      }

      const { code, amount, referenceType, referenceId } = validation.data;
      const upperCode = code.toUpperCase();
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      const releaseLock = await acquireGiftCardLock(upperCode);
      try {
        let cardQuery = supabase
          .from('gift_cards')
          .select('id, current_balance, status, expires_at')
          .eq('code', upperCode);
        if (propertyId) cardQuery = cardQuery.eq('property_id', propertyId);

        const { data: card, error: cardError } = await cardQuery.single();

        if (cardError || !card) {
          return res.status(404).json({ success: false, error: 'Gift card not found' });
        }

        const currentBalance = Number(card.current_balance || 0);
        if (card.status !== 'active') {
          return res.status(400).json({ success: false, error: `Gift card is ${card.status}` });
        }
        if (card.expires_at && new Date(card.expires_at) < new Date()) {
          return res.status(400).json({ success: false, error: 'Gift card has expired' });
        }
        if (currentBalance < amount) {
          return res.status(400).json({ success: false, error: 'Insufficient gift card balance' });
        }

        const { data: result, error: rpcError } = await supabase.rpc('redeem_giftcard_atomic', {
          p_code: upperCode,
          p_amount: amount,
          p_order_id: referenceId || null,
        });

        if (rpcError) {
          logger.error('Gift card atomic redemption RPC error:', rpcError);
          throw rpcError;
        }

        const row = Array.isArray(result) ? result[0] : result;

        if (!row?.success) {
          return res.status(400).json({
            success: false,
            error: row?.error_message || 'Gift card redemption failed',
          });
        }

        res.json({
          success: true,
          data: {
            amountRedeemed: parseFloat(row.amount_redeemed),
            remainingBalance: parseFloat(row.new_balance),
            cardStatus: parseFloat(row.new_balance) <= 0 ? 'redeemed' : 'active',
            giftCardId: row.gift_card_id,
          },
        });
      } finally {
        releaseLock();
      }
    } catch (error: any) {
      console.error('Error redeeming gift card:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to redeem gift card',
        message: error.message,
      });
    }
  }

  /**
   * Get my gift cards (purchased or received)
   */
  async getMyGiftCards(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;
      const propertyId = getPropertyId(req);
      const supabase = getSupabase();

      let purchasedQuery = supabase.from('gift_cards').select('*').eq('purchased_by', userId);
      if (propertyId) purchasedQuery = purchasedQuery.eq('property_id', propertyId);
      const { data: purchased, error: purchasedError } = await purchasedQuery.order('created_at', { ascending: false });
      if (purchasedError) throw purchasedError;

      let receivedQuery = supabase.from('gift_cards').select('*').eq('recipient_email', userEmail).neq('purchased_by', userId);
      if (propertyId) receivedQuery = receivedQuery.eq('property_id', propertyId);
      const { data: received, error: receivedError } = await receivedQuery.order('created_at', { ascending: false });
      if (receivedError) throw receivedError;

      const giftCards = [
        ...(purchased || []).map(gc => ({ ...gc, type: 'purchased' })),
        ...(received || []).map(gc => ({ ...gc, type: 'received' })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      res.json({ success: true, data: giftCards });
    } catch (error: any) {
      console.error('Error fetching my gift cards:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch gift cards',
        message: error.message,
      });
    }
  }

  /**
   * Get gift card details (admin)
   */
  async getGiftCard(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const propertyId = getAdminPropertyId(req);
      const supabase = getSupabase();

      const { data: giftCard, error: cardError } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('id', id)
        .eq('property_id', propertyId)
        .single();

      if (cardError || !giftCard) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      let purchaserInfo = null;
      if (giftCard.purchased_by) {
        const { data: purchaser } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', giftCard.purchased_by)
        .single();
        purchaserInfo = purchaser;
      }

      const { data: transactions, error: txError } = await supabase
        .from('gift_card_transactions')
        .select('*')
        .eq('gift_card_id', id)
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      res.json({
        success: true,
        data: {
          ...giftCard,
          purchaser_name: purchaserInfo?.full_name,
          purchaser_email_account: purchaserInfo?.email,
          transactions: transactions || [],
        },
      });
    } catch (error: any) {
      console.error('Error fetching gift card:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch gift card',
        message: error.message,
      });
    }
  }

  /**
   * Get all gift cards (admin)
   */
  async getAllGiftCards(req: Request, res: Response) {
    try {
      const { page = '1', limit = '20', status, search } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const propertyId = getAdminPropertyId(req);
      const supabase = getSupabase();

      let query = supabase.from('gift_cards').select('*', { count: 'exact' }).eq('property_id', propertyId);

      if (status) query = query.eq('status', status as string);
      if (search) {
        query = query.or(`code.ilike.%${search}%,recipient_email.ilike.%${search}%,recipient_name.ilike.%${search}%`);
      }

      const { data: giftCards, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit as string) - 1);

      if (error) throw error;

      const purchaserIds = [...new Set((giftCards || []).map(gc => gc.purchased_by).filter(Boolean))];
      let purchasersMap: Record<string, any> = {};

      if (purchaserIds.length > 0) {
        const { data: purchasers } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', purchaserIds);

        purchasersMap = (purchasers || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);
      }

      const mappedCards = (giftCards || []).map(gc => ({
        ...gc,
        purchaser_name: purchasersMap[gc.purchased_by]?.full_name,
      }));

      res.json({
        success: true,
        data: mappedCards,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: count || 0,
          totalPages: Math.ceil((count || 0) / parseInt(limit as string)),
        },
      });
    } catch (error: any) {
      console.error('Error fetching all gift cards:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch gift cards',
        message: error.message,
      });
    }
  }

  /**
   * Create gift card (admin)
   */
  async createGiftCard(req: Request, res: Response) {
    try {
      const validation = createGiftCardSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.issues,
        });
      }

      const { amount, initialValue, recipientEmail, recipientName, message, personalMessage, expiresInDays } = validation.data;
      const finalAmount = amount || initialValue!;
      const finalMessage = personalMessage || message;
      const userId = req.user?.id;
      const propertyId = getAdminPropertyId(req);
      const supabase = getSupabase();

      // Generate unique code
      let code: string = '';
      let codeExists = true;
      while (codeExists) {
        code = generateGiftCardCode();
        const { data: existing } = await supabase
          .from('gift_cards')
          .select('id')
          .eq('code', code)
          .single();
        codeExists = !!existing;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Tenant context is built from the PROPERTY's owner, not the caller's
      // JWT tenant — a super_admin can legitimately create a gift card for a
      // property outside their own homed tenant (see validatePropertyAccess's
      // bypass). getScopedClient's insert stamps tenant_id from ctx.tenantId,
      // so passing the property-derived value here (rather than
      // tenantContextFor(req), which would use the caller's own tenant) keeps
      // this correct for that case too, not just the common one.
      const tenant_id = await getTenantIdForProperty(propertyId);
      const scoped = getScopedClient({ tenantId: tenant_id, actorId: req.user?.id });
      const { data: giftCard, error: insertError } = await scoped.from('gift_cards')
        .insert({
          code,
          initial_value: finalAmount,
          current_balance: finalAmount,
          status: 'active',
          purchased_by: userId,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          personal_message: finalMessage,
          expires_at: expiresAt.toISOString(),
          property_id: propertyId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await supabase.from('gift_card_transactions').insert({
        gift_card_id: giftCard.id,
        transaction_type: 'purchase',
        amount: finalAmount,
        balance_after: finalAmount,
        notes: 'Gift card created by admin',
        performed_by: userId,
      });

      if (recipientEmail) {
        let senderName: string | undefined;
        if (userId) {
          const { data: creator } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', userId)
            .single();
          senderName = creator?.full_name || 'Site Admin';
        }

        const emailSent = await emailService.sendGiftCard({
          recipientEmail,
          recipientName: recipientName || 'Valued Guest',
          senderName,
          code: giftCard.code,
          amount: finalAmount,
          message: finalMessage,
          expiresAt: giftCard.expires_at,
        });

        if (!emailSent) {
          logger.warn(`[Admin] Gift card email failed for code ${giftCard.code}`);
        } else {
          logger.info(`[Admin] Gift card email sent to ${recipientEmail}`);
        }
      }

      res.status(201).json({ success: true, data: giftCard });
    } catch (error: any) {
      console.error('Error creating gift card:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create gift card',
        message: error.message,
      });
    }
  }

  /**
   * Disable gift card (admin)
   */
  async disableGiftCard(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const propertyId = getAdminPropertyId(req);
      const supabase = getSupabase();

      const { data: result, error: updateError } = await supabase
        .from('gift_cards')
        .update({ status: 'disabled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('property_id', propertyId)
        .select()
        .single();

      if (updateError || !result) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      await supabase.from('gift_card_transactions').insert({
        gift_card_id: id,
        type: 'refund',
        amount: 0,
        balance_after: result.current_balance,
        notes: reason || 'Gift card disabled by admin',
        created_by: req.user?.id,
      });

      res.json({
        success: true,
        data: result,
        message: 'Gift card disabled successfully',
      });
    } catch (error: any) {
      console.error('Error disabling gift card:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disable gift card',
        message: error.message,
      });
    }
  }

  /**
   * Get gift card statistics (admin)
   */
  async getStats(req: Request, res: Response) {
    try {
      const propertyId = getAdminPropertyId(req);
      const supabase = getSupabase();

      const { data: allCards, error: cardsError } = await supabase
        .from('gift_cards')
        .select('status, initial_value, current_balance, created_at')
        .eq('property_id', propertyId);
      if (cardsError) throw cardsError;

      const cards = allCards || [];
      const totalCards = cards.length;
      const activeCards = cards.filter(c => c.status === 'active').length;
      const totalSold = cards.reduce((sum, c) => sum + parseFloat(c.initial_value || 0), 0);
      const outstandingBalance = cards
        .filter(c => c.status === 'active')
        .reduce((sum, c) => sum + parseFloat(c.current_balance || 0), 0);
      const totalRedeemed = cards.reduce((sum, c) =>
        sum + (parseFloat(c.initial_value || 0) - parseFloat(c.current_balance || 0)), 0);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentCards = cards.filter(c => new Date(c.created_at) > thirtyDaysAgo);

      const salesByDate = recentCards.reduce((acc, card) => {
        const date = new Date(card.created_at).toISOString().split('T')[0];
        if (!acc[date]) acc[date] = { date, cards_sold: 0, amount_sold: 0 };
        acc[date].cards_sold++;
        acc[date].amount_sold += parseFloat(card.initial_value || 0);
        return acc;
      }, {} as Record<string, any>);

      const recentSales = Object.values(salesByDate).sort((a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      res.json({
        success: true,
        data: {
          summary: {
            total_cards: totalCards,
            active_cards: activeCards,
            total_sold: totalSold,
            outstanding_balance: outstandingBalance,
            total_redeemed: totalRedeemed,
          },
          recentSales,
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
}

export const giftCardController = new GiftCardController();
