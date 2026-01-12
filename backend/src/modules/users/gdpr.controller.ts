import { Request, Response, NextFunction } from 'express';
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
    restaurant_orders: unknown[];
    snack_orders: unknown[];
  };
  bookings: {
    chalet_bookings: unknown[];
    pool_tickets: unknown[];
  };
  reviews: unknown[];
  support_tickets: unknown[];
  activity_logs: unknown[];
}

/**
 * GET /api/users/me/data
 * GDPR Article 15 - Right of Access
 * Returns all personal data associated with the authenticated user
 */
export async function exportUserData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as Request & { user?: { userId: string } }).user?.userId;
    
    if (!userId) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const supabase = getSupabase();

    // Fetch all user data in parallel
    const [
      userResult,
      restaurantOrdersResult,
      snackOrdersResult,
      chaletBookingsResult,
      poolTicketsResult,
      reviewsResult,
      supportTicketsResult,
      activityLogsResult
    ] = await Promise.all([
      // User profile
      supabase.from('users')
        .select('id, email, full_name, phone, profile_image_url, created_at, updated_at')
        .eq('id', userId)
        .single(),
      
      // Restaurant orders
      supabase.from('restaurant_orders')
        .select('id, order_number, status, total_amount, payment_status, customer_name, customer_phone, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      
      // Snack orders
      supabase.from('snack_orders')
        .select('id, order_number, status, total_amount, payment_status, customer_name, customer_phone, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      
      // Chalet bookings
      supabase.from('chalet_bookings')
        .select('id, confirmation_number, status, check_in_date, check_out_date, total_amount, payment_status, guest_name, guest_email, guest_phone, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      
      // Pool tickets
      supabase.from('pool_tickets')
        .select('id, ticket_number, status, ticket_date, number_of_guests, total_amount, payment_status, guest_name, guest_email, guest_phone, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      
      // Reviews
      supabase.from('reviews')
        .select('id, rating, text, service_type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      
      // Support tickets
      supabase.from('support_tickets')
        .select('id, subject, status, priority, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      
      // Activity logs (last 1000)
      supabase.from('activity_logs')
        .select('id, action, entity_type, entity_id, details, ip_address, user_agent, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000)
    ]);

    if (userResult.error || !userResult.data) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const userData: UserData = {
      profile: userResult.data,
      orders: {
        restaurant_orders: restaurantOrdersResult.data || [],
        snack_orders: snackOrdersResult.data || []
      },
      bookings: {
        chalet_bookings: chaletBookingsResult.data || [],
        pool_tickets: poolTicketsResult.data || []
      },
      reviews: reviewsResult.data || [],
      support_tickets: supportTicketsResult.data || [],
      activity_logs: activityLogsResult.data || []
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
        'restaurant_orders',
        'snack_orders',
        'chalet_bookings',
        'pool_tickets',
        'reviews',
        'support_tickets',
        'activity_logs'
      ]
    });
  } catch (error) {
    logger.error('GDPR data export failed', { error, userId: (req as Request & { user?: { userId: string } }).user?.userId });
    next(error);
  }
}

/**
 * DELETE /api/users/me/data
 * GDPR Article 17 - Right to Erasure ("Right to be Forgotten")
 * Deletes all personal data associated with the authenticated user
 * 
 * Note: Some data may be retained for legal/compliance reasons (configurable)
 */
export async function deleteUserData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as Request & { user?: { userId: string } }).user?.userId;
    
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
      .from('activity_logs')
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

    // 5. Anonymize orders (keep for accounting but remove PII)
    const { error: restOrderError, count: restOrderCount } = await supabase
      .from('restaurant_orders')
      .update({
        customer_name: 'DELETED USER',
        customer_phone: null,
        customer_email: null,
        user_id: null
      })
      .eq('user_id', userId);
    deletionResults.restaurant_orders_anonymized = { deleted: restOrderCount || 0, error: restOrderError?.message };

    const { error: snackOrderError, count: snackOrderCount } = await supabase
      .from('snack_orders')
      .update({
        customer_name: 'DELETED USER',
        customer_phone: null,
        user_id: null
      })
      .eq('user_id', userId);
    deletionResults.snack_orders_anonymized = { deleted: snackOrderCount || 0, error: snackOrderError?.message };

    // 6. Anonymize bookings
    const { error: chaletError, count: chaletCount } = await supabase
      .from('chalet_bookings')
      .update({
        guest_name: 'DELETED USER',
        guest_email: null,
        guest_phone: null,
        user_id: null
      })
      .eq('user_id', userId);
    deletionResults.chalet_bookings_anonymized = { deleted: chaletCount || 0, error: chaletError?.message };

    const { error: poolError, count: poolCount } = await supabase
      .from('pool_tickets')
      .update({
        guest_name: 'DELETED USER',
        guest_email: null,
        guest_phone: null,
        user_id: null
      })
      .eq('user_id', userId);
    deletionResults.pool_tickets_anonymized = { deleted: poolCount || 0, error: poolError?.message };

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

    res.json({
      success: true,
      message: 'Account and personal data have been deleted',
      deletedAt: new Date().toISOString(),
      summary: deletionResults,
      note: 'Financial records have been anonymized for compliance but retained for accounting purposes'
    });
  } catch (error) {
    logger.error('GDPR account deletion failed', { 
      error, 
      userId: (req as Request & { user?: { userId: string } }).user?.userId 
    });
    next(error);
  }
}

/**
 * POST /api/users/me/data/portable
 * GDPR Article 20 - Right to Data Portability
 * Returns user data in a machine-readable format (JSON)
 */
export async function getPortableData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as Request & { user?: { userId: string } }).user?.userId;
    
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

    await exportUserData(tempReq, tempRes as unknown as Response, next);
  } catch (error) {
    logger.error('GDPR data portability failed', { 
      error, 
      userId: (req as Request & { user?: { userId: string } }).user?.userId 
    });
    next(error);
  }
}
