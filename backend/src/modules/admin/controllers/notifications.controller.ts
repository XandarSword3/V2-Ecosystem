/**
 * Notifications Controller
 * Handles notification retrieval and management
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../../../database/connection';

export async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const supabase = getSupabase();

    // Get recent orders, bookings, and system events as notifications
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const notifications: Array<{ id: string; title: string; message: string; time: string; read: boolean }> = [];

    // Get recent restaurant orders
    const { data: recentOrders } = await supabase
      .from('restaurant_orders')
      .select('id, order_number, status, created_at')
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    (recentOrders || []).forEach(order => {
      const createdAt = new Date(order.created_at);
      const diffMs = now.getTime() - createdAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const timeAgo = diffMins < 60 ? `${diffMins} min ago` : `${Math.floor(diffMins / 60)} hours ago`;

      notifications.push({
        id: `order-${order.id}`,
        title: 'New Order',
        message: `Order #${order.order_number} - ${order.status}`,
        time: timeAgo,
        read: order.status !== 'pending',
      });
    });

    // Get recent chalet bookings
    const { data: recentBookings } = await supabase
      .from('chalet_bookings')
      .select('id, chalet_id, check_in_date, status, created_at')
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    (recentBookings || []).forEach(booking => {
      const createdAt = new Date(booking.created_at);
      const diffMs = now.getTime() - createdAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const timeAgo = diffMins < 60 ? `${diffMins} min ago` : `${Math.floor(diffMins / 60)} hours ago`;

      notifications.push({
        id: `booking-${booking.id}`,
        title: 'Chalet Booking',
        message: `New booking for ${booking.check_in_date}`,
        time: timeAgo,
        read: booking.status !== 'pending',
      });
    });

    // Get pending reviews
    const { data: pendingReviews } = await supabase
      .from('reviews')
      .select('id, rating, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    (pendingReviews || []).forEach(review => {
      const createdAt = new Date(review.created_at);
      const diffMs = now.getTime() - createdAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const timeAgo = diffMins < 60 ? `${diffMins} min ago` : `${Math.floor(diffMins / 60)} hours ago`;

      notifications.push({
        id: `review-${review.id}`,
        title: 'Review Pending',
        message: `New ${review.rating}-star review awaiting approval`,
        time: timeAgo,
        read: false,
      });
    });

    // Sort by time (most recent first) and limit
    notifications.sort((a, b) => {
      const aTime = parseInt(a.time) || 0;
      const bTime = parseInt(b.time) || 0;
      return aTime - bTime;
    });

    res.json({ success: true, data: notifications.slice(0, 10) });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    // Since notifications are computed from various sources,
    // we'd need to update the source record's status
    // For now, return success (real implementation would track read state)
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(req: Request, res: Response, next: NextFunction) {
  try {
    // Similar to above, this would update multiple source records
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
}
