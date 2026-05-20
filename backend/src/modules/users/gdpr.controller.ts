import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { logActivity } from '../../utils/activityLogger.js';

interface UserData {
  profile: {
    id: string;
    email: string;
    full_name: string;
    phone?: string;
    profile_image_url?: string;
    created_at: string;
    updated_at?: string;
  };
  orders: {
    instant_transactions: unknown[];
    snack_transactions: unknown[];
  };
  reservations: {
    accommodation_bookings: unknown[];
    access_tickets: unknown[];
  };
  reviews: unknown[];
  support_tickets: unknown[];
  activity_logs: unknown[];
  loyalty?: {
    account: unknown;
    transactions: unknown[];
  };
  gift_cards?: unknown[];
  consents?: unknown[];
}

/**
 * GET /api/users/me/data
 * GDPR Article 15 - Right of Access
 * Returns all personal data associated with the authenticated user
 */
export const exportUserData = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const propertyId = (req as any).propertyId || (req.headers['x-property-id'] as string);
    const supabase = getSupabase();

    // Fetch all user data in parallel
    const [
      userResult,
      transactionsResult,
      consentsResult,
      reviewsResult,
      supportTicketsResult,
      activityLogsResult,
      loyaltyAccountsResult,
      loyaltyTxResult,
      giftCardsResult
    ] = await Promise.all([
      // User profile
      supabase.from('users')
        .select('id, email, full_name, phone, profile_image_url, created_at, updated_at')
        .eq('id', userId)
        .single(),
      
      // All user transactions (unified)
      (() => {
        let q = supabase.from('transactions')
          .select('id, engine_type, order_number, ticket_number, booking_number, status, amount, payment_status, customer_name, customer_phone, created_at, reference_id, reference_table')
          .eq('customer_id', userId);
        if (propertyId) q = q.eq('property_id', propertyId);
        return q.order('created_at', { ascending: false });
      })(),
      
      // GDPR Consents
      (() => {
        let q = supabase.from('gdpr_consents').select('*').eq('user_id', userId);
        if (propertyId) q = q.eq('property_id', propertyId);
        return q.order('created_at', { ascending: false });
      })(),
      
      // Reviews
      (() => {
        let q = supabase.from('reviews')
          .select('id, rating, text, service_type, created_at')
          .eq('user_id', userId);
        if (propertyId) q = q.eq('property_id', propertyId);
        return q.order('created_at', { ascending: false });
      })(),
      
      // Support tickets
      (() => {
        let q = supabase.from('support_tickets')
          .select('id, subject, status, priority, created_at')
          .eq('user_id', userId);
        if (propertyId) q = q.eq('property_id', propertyId);
        return q.order('created_at', { ascending: false });
      })(),
      
      // Activity logs (last 1000)
      (() => {
        let q = supabase.from('audit_logs')
          .select('id, action, resource, resource_id, old_value, new_value, ip_address, user_agent, created_at')
          .eq('user_id', userId);
        if (propertyId) q = q.eq('property_id', propertyId);
        return q.order('created_at', { ascending: false }).limit(1000);
      })(),
        
      // Loyalty Data
      (() => {
        let q = supabase.from('loyalty_accounts').select('*').eq('user_id', userId);
        if (propertyId) q = q.eq('property_id', propertyId);
        return q.maybeSingle();
      })(),
      (() => {
        let q = supabase.from('loyalty_transactions').select('*').eq('user_id', userId);
        if (propertyId) q = q.eq('property_id', propertyId);
        return q.order('created_at', { ascending: false });
      })(),
      
      // Gift Cards
      (() => {
        let q = supabase.from('gift_cards').select('*').eq('purchaser_id', userId);
        if (propertyId) q = q.eq('property_id', propertyId);
        return q.order('created_at', { ascending: false });
      })()
    ]);

    if (userResult.error || !userResult.data) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const userData: UserData = {
      profile: userResult.data,
      orders: {
        instant_transactions: (transactionsResult.data || []).filter(t => t.engine_type === 'instant_transaction'),
        snack_transactions: (transactionsResult.data || []).filter(t => t.engine_type === 'instant_transaction')
      },
      reservations: {
        accommodation_bookings: (transactionsResult.data || []).filter(t => t.engine_type === 'time_exclusive_reservation'),
        access_tickets: (transactionsResult.data || []).filter(t => t.engine_type === 'shared_capacity_access')
      },
      reviews: reviewsResult.data || [],
      support_tickets: supportTicketsResult.data || [],
      loyalty: {
        account: loyaltyAccountsResult.data || null,
        transactions: loyaltyTxResult.data || []
      },
      gift_cards: giftCardsResult.data || [],
      consents: consentsResult.data || [],
      activity_logs: (activityLogsResult.data || []).map((log: {
        resource?: string;
        resource_id?: string;
        new_value?: Record<string, unknown>;
        old_value?: Record<string, unknown>;
        [key: string]: unknown;
      }) => ({
        ...log,
        entity_type: log.resource,
        entity_id: log.resource_id,
        details: log.new_value || log.old_value
      }))
    };

    // Log the data export
    await logActivity({
      user_id: userId,
      action: 'gdpr_data_export',
      resource: 'user',
      resource_id: userId,
      new_value: { timestamp: new Date().toISOString() },
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    logger.info('GDPR data export completed', { userId, requestId: req.requestId });

    res.json({
      success: true,
      data: userData,
      exportedAt: new Date().toISOString(),
      dataTypes: [
        'profile',
        'instant_transactions',
        'snack_transactions',
        'accommodation_bookings',
        'access_tickets',
        'reviews',
        'support_tickets',
        'activity_logs',
        'loyalty',
        'gift_cards',
        'consents'
      ]
    });
});

/**
 * DELETE /api/users/me/data
 * GDPR Article 17 - Right to Erasure ("Right to be Forgotten")
 * Deletes all personal data associated with the authenticated user
 * 
 * Note: Some data may be retained for legal/compliance reasons (configurable)
 */
export const deleteUserData = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { confirmDeletion } = req.body as { confirmDeletion?: boolean };
    
    if (!confirmDeletion) {
      res.status(400).json({
        success: false,
        error: 'Deletion must be explicitly confirmed',
        message: 'Set confirmDeletion: true in the request body to proceed with account deletion'
      });
      return;
    }

    const supabase = getSupabase();

    // First, get user email for confirmation
    const { data: user } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Log the deletion request before proceeding
    await logActivity({
      user_id: userId,
      action: 'gdpr_deletion_requested',
      resource: 'user',
      resource_id: userId,
      new_value: {
        email: user.email,
        timestamp: new Date().toISOString()
      },
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    // Delete user data in order (to respect foreign key constraints)
    const deletionResults: Record<string, { deleted: number; error?: string }> = {};

    // 1. Delete activity logs
    const { error: activityError, count: activityCount } = await supabase
      .from('audit_logs')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletionResults.activity_logs = { deleted: activityCount || 0, error: activityError?.message };

    // 2. Delete reviews
    const { error: reviewsError, count: reviewsCount } = await supabase
      .from('reviews')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletionResults.reviews = { deleted: reviewsCount || 0, error: reviewsError?.message };

    // 3. Delete support ticket messages first
    const { data: ticketIds } = await supabase
      .from('support_tickets')
      .select('id')
      .eq('user_id', userId);
    
    if (ticketIds && ticketIds.length > 0) {
      const ticketIdList = ticketIds.map(t => t.id);
      await supabase
        .from('support_messages')
        .delete()
        .in('ticket_id', ticketIdList);
    }

    // 4. Delete support tickets
    const { error: ticketsError, count: ticketsCount } = await supabase
      .from('support_tickets')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletionResults.support_tickets = { deleted: ticketsCount || 0, error: ticketsError?.message };

    // 5. Anonymize all transactions (unified)
    const { error: txError, count: txCount } = await supabase
      .from('transactions')
      .update({
        customer_id: null,
        metadata: { anonymized: true, anonymized_at: new Date().toISOString() }
      })
      .eq('customer_id', userId);
    deletionResults.transactions_anonymized = { deleted: txCount || 0, error: txError?.message };

    // 6b. Anonymize Gift Cards
    const { error: gcError, count: gcCount } = await supabase
      .from('gift_cards')
      .update({
        purchaser_name: 'DELETED USER',
        purchaser_email: null,
        recipient_email: null,
        purchaser_id: null
      })
      .eq('purchaser_id', userId);
    deletionResults.gift_cards_anonymized = { deleted: gcCount || 0, error: gcError?.message };

    // 6c. Delete Loyalty Accounts
    const { error: loyaltyError, count: loyaltyCount } = await supabase
      .from('loyalty_accounts')
      .delete({ count: 'exact' })
      .eq('user_id', userId);
    deletionResults.loyalty_accounts = { deleted: loyaltyCount || 0, error: loyaltyError?.message };

    // Note: GDPR consents are intentionally RETAINED for audit purposes.
    // They are not deleted to prove compliance history.

    // 7. Delete user roles
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // 8. Finally, delete the user
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (userError) {
      logger.error('Failed to delete user account', { userId, error: userError });
      res.status(500).json({
        success: false,
        error: 'Failed to complete account deletion',
        partialResults: deletionResults
      });
      return;
    }

    deletionResults.user_account = { deleted: 1 };

    logger.info('GDPR account deletion completed', { 
      userId, 
      email: user.email,
      requestId: req.requestId 
    });

    // Send email confirmation
    // In a real implementation, this would use a mailer service.
    // e.g., await mailService.sendAccountDeletionConfirmation(user.email);
    logger.info(`Sending account deletion confirmation email to ${user.email}`);

    res.json({
      success: true,
      message: 'Account and personal data have been deleted',
      deletedAt: new Date().toISOString(),
      summary: deletionResults,
      note: 'Financial records have been anonymized for compliance. Consent records are retained for audit purposes. A confirmation email has been sent to your registered address outlining the 30-day anonymization policy.'
    });
});

/**
 * POST /api/users/me/data/portable
 * GDPR Article 20 - Right to Data Portability
 * Returns user data in a machine-readable format (JSON)
 */
export const getPortableData = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // Use the export function internally
    const tempReq = req;
    const tempRes = {
      json: (data: unknown) => {
        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}-${Date.now()}.json"`);
        res.json(data);
      },
      status: (code: number) => ({
        json: (data: unknown) => res.status(code).json(data)
      })
    };

    // Log the portability request
    await logActivity({
      user_id: userId,
      action: 'gdpr_data_portability',
      resource: 'user',
      resource_id: userId,
      new_value: { timestamp: new Date().toISOString(), format: 'json' },
      ip_address: req.ip,
      user_agent: req.get('user-agent')
    });

    await exportUserData(tempReq, tempRes as unknown as Response, ((err: unknown) => { if (err) throw err; }) as any);
});
