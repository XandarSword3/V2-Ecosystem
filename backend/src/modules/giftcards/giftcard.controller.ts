import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { z } from 'zod';
import { emailService } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';

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
  templateId: z.string().uuid().optional(),
  amount: z.number().positive().min(10).max(1000).optional(),
  customAmount: z.number().positive().min(10).max(1000).optional(),
  recipientEmail: z.string().email(),
  recipientName: z.string().max(100).optional(),
  senderName: z.string().max(100).optional(),
  message: z.string().max(500).optional(),
  personalMessage: z.string().max(500).optional(),
  isGuestPurchase: z.boolean().optional(),
  senderEmail: z.string().email().optional(),
}).refine(data => data.templateId || data.amount || data.customAmount, {
  message: "Either 'templateId', 'amount', or 'customAmount' is required",
});

const redeemGiftCardSchema = z.object({
  code: z.string().min(8).max(20),
  amount: z.number().positive(),
  referenceType: z.string().optional(),
  referenceId: z.string().uuid().optional(),
});

// Generate unique gift card code
function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class GiftCardController {
  /**
   * Get all gift card templates (for purchase UI)
   */
  async getTemplates(req: Request, res: Response) {
    try {
      const supabase = getSupabase();
      
      const { data: templates, error } = await supabase
        .from('gift_card_templates')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      res.json({
        success: true,
        data: templates || [],
      });
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch gift card templates',
        message: error.message,
      });
    }
  }

  /**
   * Purchase a gift card (customer)
   */
  async purchaseGiftCard(req: Request, res: Response) {
    try {
      const validation = purchaseGiftCardSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { templateId, amount, customAmount, recipientEmail, recipientName, senderName, message, personalMessage } = validation.data;
      const userId = (req as any).user?.id;
      const supabase = getSupabase();

      // Get amount from template or use provided amount or customAmount
      let finalAmount = amount || customAmount;
      const finalMessage = message || personalMessage;
      if (templateId) {
        const { data: template, error: templateError } = await supabase
          .from('gift_card_templates')
          .select('amount')
          .eq('id', templateId)
          .eq('is_active', true)
          .single();
        
        if (templateError || !template) {
          return res.status(404).json({ success: false, error: 'Gift card template not found' });
        }
        finalAmount = template.amount;
      }

      if (!finalAmount) {
        return res.status(400).json({ success: false, error: 'Amount is required' });
      }

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

      // Calculate expiry (default 1 year)
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      // Create gift card - using correct DB column names
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
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Log purchase transaction - using correct DB column names
      await supabase
        .from('gift_card_transactions')
        .insert({
          gift_card_id: giftCard.id,
          transaction_type: 'purchase',
          amount: finalAmount,
          balance_after: finalAmount,
          notes: 'Gift card purchased',
          performed_by: userId,
        });

      // Send email to recipient with the gift card code
      if (recipientEmail) {
        // Get purchaser name for the email
        let senderName: string | undefined;
        if (userId) {
          const { data: purchaser } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', userId)
            .single();
          senderName = purchaser?.full_name;
        }

        const emailSent = await emailService.sendGiftCard({
          recipientEmail,
          recipientName: recipientName || 'Valued Guest',
          senderName,
          code: giftCard.code,
          amount: finalAmount,
          message,
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
      const supabase = getSupabase();

      // Search for both formats: with dashes and without
      const { data: card, error } = await supabase
        .from('gift_cards')
        .select('id, code, current_balance, status, expires_at')
        .or(`code.eq.${upperCode},code.eq.${normalizedCode}`)
        .limit(1)
        .single();

      if (error || !card) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      // Check if expired
      if (card.expires_at && new Date(card.expires_at) < new Date()) {
        return res.json({
          success: true,
          data: {
            code: card.code,
            balance: 0,
            status: 'expired',
            message: 'This gift card has expired',
          },
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
   * Redeem gift card (at checkout)
   */
  async redeemGiftCard(req: Request, res: Response) {
    try {
      const validation = redeemGiftCardSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.error.errors,
        });
      }

      const { code, amount, referenceType, referenceId } = validation.data;
      const upperCode = code.toUpperCase();
      const normalizedCode = upperCode.replace(/-/g, '');
      const supabase = getSupabase();

      // Get gift card - search both with and without dashes
      const { data: card, error: fetchError } = await supabase
        .from('gift_cards')
        .select('*')
        .or(`code.eq.${upperCode},code.eq.${normalizedCode}`)
        .limit(1)
        .single();

      if (fetchError || !card) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      // Validate card status
      if (card.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: `Gift card is ${card.status}`,
        });
      }

      // Check expiry
      if (card.expires_at && new Date(card.expires_at) < new Date()) {
        await supabase
          .from('gift_cards')
          .update({ status: 'expired' })
          .eq('id', card.id);
        return res.status(400).json({
          success: false,
          error: 'Gift card has expired',
        });
      }

      // Check balance
      const currentBalance = parseFloat(card.current_balance);
      if (currentBalance <= 0) {
        await supabase
          .from('gift_cards')
          .update({ status: 'used' })
          .eq('id', card.id);
        return res.status(400).json({
          success: false,
          error: 'Gift card has no remaining balance',
        });
      }

      // Calculate redemption amount (can't exceed balance or requested amount)
      const redeemAmount = Math.min(amount, currentBalance);
      const newBalance = currentBalance - redeemAmount;

      // Update gift card
      const newStatus = newBalance <= 0 ? 'used' : 'active';
      const { error: updateError } = await supabase
        .from('gift_cards')
        .update({ 
          current_balance: newBalance, 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', card.id);

      if (updateError) throw updateError;

      // Log transaction
      await supabase
        .from('gift_card_transactions')
        .insert({
          gift_card_id: card.id,
          type: 'redeem',
          amount: -redeemAmount,
          balance_after: newBalance,
          reference_type: referenceType,
          reference_id: referenceId,
          created_by: (req as any).user?.id,
        });

      res.json({
        success: true,
        data: {
          amountRedeemed: redeemAmount,
          remainingBalance: newBalance,
          cardStatus: newStatus,
        },
      });
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
      const userId = (req as any).user?.id;
      const userEmail = (req as any).user?.email;
      const supabase = getSupabase();

      // Get purchased cards
      const { data: purchased, error: purchasedError } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('purchaser_id', userId)
        .order('created_at', { ascending: false });

      if (purchasedError) throw purchasedError;

      // Get received cards
      const { data: received, error: receivedError } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('recipient_email', userEmail)
        .neq('purchaser_id', userId)
        .order('created_at', { ascending: false });

      if (receivedError) throw receivedError;

      // Combine and mark type
      const giftCards = [
        ...(purchased || []).map(gc => ({ ...gc, type: 'purchased' })),
        ...(received || []).map(gc => ({ ...gc, type: 'received' })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      res.json({
        success: true,
        data: giftCards,
      });
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
      const supabase = getSupabase();

      // Get gift card with purchaser info (separate queries to avoid FK issues)
      const { data: giftCard, error: cardError } = await supabase
        .from('gift_cards')
        .select('*')
        .eq('id', id)
        .single();

      if (cardError || !giftCard) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      // Get purchaser info if exists
      let purchaserInfo = null;
      if (giftCard.purchaser_id) {
        const { data: purchaser } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', giftCard.purchaser_id)
          .single();
        purchaserInfo = purchaser;
      }

      // Get transactions
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
          purchaser_name: purchaserInfo?.name,
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
      const supabase = getSupabase();

      let query = supabase
        .from('gift_cards')
        .select('*', { count: 'exact' });

      if (status) {
        query = query.eq('status', status as string);
      }

      if (search) {
        query = query.or(`code.ilike.%${search}%,recipient_email.ilike.%${search}%,recipient_name.ilike.%${search}%`);
      }

      const { data: giftCards, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit as string) - 1);

      if (error) throw error;

      // Get purchaser info for each card
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

      // Map purchaser name
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
          details: validation.error.errors,
        });
      }

      const { amount, initialValue, recipientEmail, recipientName, message, personalMessage, expiresInDays } = validation.data;
      const finalAmount = amount || initialValue!;
      const finalMessage = personalMessage || message;
      const userId = (req as any).user?.id;
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

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Create gift card
      const { data: giftCard, error: insertError } = await supabase
        .from('gift_cards')
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
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Log creation
      await supabase
        .from('gift_card_transactions')
        .insert({
          gift_card_id: giftCard.id,
          transaction_type: 'purchase',
          amount: finalAmount,
          balance_after: finalAmount,
          notes: 'Gift card created by admin',
          performed_by: userId,
        });

      res.status(201).json({
        success: true,
        data: giftCard,
      });
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
      const supabase = getSupabase();

      const { data: result, error: updateError } = await supabase
        .from('gift_cards')
        .update({ 
          status: 'disabled',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError || !result) {
        return res.status(404).json({ success: false, error: 'Gift card not found' });
      }

      // Log
      await supabase
        .from('gift_card_transactions')
        .insert({
          gift_card_id: id,
          type: 'refund',
          amount: 0,
          balance_after: result.current_balance,
          notes: reason || 'Gift card disabled by admin',
          created_by: (req as any).user?.id,
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
      const supabase = getSupabase();

      // Get all gift cards for stats
      const { data: allCards, error: cardsError } = await supabase
        .from('gift_cards')
        .select('status, initial_value, current_balance, created_at');

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

      // Get recent sales (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentCards = cards.filter(c => new Date(c.created_at) > thirtyDaysAgo);
      
      // Group by date
      const salesByDate = recentCards.reduce((acc, card) => {
        const date = new Date(card.created_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { date, cards_sold: 0, amount_sold: 0 };
        }
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

  /**
   * Update template (admin)
   */
  async updateTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, amount, description, imageUrl, isActive, sortOrder } = req.body;
      const supabase = getSupabase();

      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) updates.name = name;
      if (amount !== undefined) updates.amount = amount;
      if (description !== undefined) updates.description = description;
      if (imageUrl !== undefined) updates.image_url = imageUrl;
      if (isActive !== undefined) updates.is_active = isActive;
      if (sortOrder !== undefined) updates.sort_order = sortOrder;

      if (Object.keys(updates).length === 1) { // Only updated_at
        return res.status(400).json({ success: false, error: 'No fields to update' });
      }

      const { data: result, error } = await supabase
        .from('gift_card_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error || !result) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error updating template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update template',
        message: error.message,
      });
    }
  }

  /**
   * Create template (admin)
   */
  async createTemplate(req: Request, res: Response) {
    try {
      const { name, amount, description, imageUrl, sortOrder } = req.body;
      const supabase = getSupabase();

      if (!name || !amount) {
        return res.status(400).json({ success: false, error: 'Name and amount are required' });
      }

      const { data: result, error } = await supabase
        .from('gift_card_templates')
        .insert({
          name,
          amount,
          description,
          image_url: imageUrl,
          sort_order: sortOrder || 0,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Error creating template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create template',
        message: error.message,
      });
    }
  }
}

export const giftCardController = new GiftCardController();
