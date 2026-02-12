import { Router, Request, Response } from 'express';
import { authenticate, authorize, optionalAuth } from "../../middleware/auth.middleware";
import { rateLimits } from "../../middleware/userRateLimit.middleware.js";
import * as menuController from "./controllers/menu.controller";
import * as orderController from "./controllers/order.controller";
import * as tableController from "./controllers/table.controller";
import { modifiersController } from './modifiers.controller.js';
import { getSupabase } from '../../database/connection.js';
import { emailService } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// ============================================
// Public Routes (Menu)
// ============================================
// Full menu endpoint (categories + items)
router.get('/menu', menuController.getFullMenu);
router.get('/menu/categories', menuController.getCategories);
router.get('/menu/items', menuController.getMenuItems);
router.get('/menu/items/:id', menuController.getMenuItem);
router.get('/menu/featured', menuController.getFeaturedItems);

// Direct category endpoint (for admin page compatibility)
router.get('/categories', menuController.getCategories);
router.get('/items', menuController.getMenuItems);

// ============================================
// Customer Routes (Orders) - rate limited for abuse prevention
// ============================================
router.post('/orders', optionalAuth, rateLimits.write, orderController.createOrder);
// router.get('/orders/:id', optionalAuth, orderController.getOrder); // Moved to end
// router.get('/orders/:id/status', orderController.getOrderStatus); // Moved to end

// Authenticated customer routes
router.get('/my-orders', authenticate, orderController.getMyOrders);

// ============================================
// Staff Routes
// ============================================
const staffRoles = [
  'staff', 
  'restaurant_staff', 'restaurant_admin', 
  'snack_bar_staff', 'snack_bar_admin',
  'chalet_staff', 'chalet_admin',
  'pool_staff', 'pool_admin',
  'super_admin'
];

router.get('/staff/orders', authenticate, authorize(...staffRoles), orderController.getStaffOrders);
router.get('/staff/orders/live', authenticate, authorize(...staffRoles), orderController.getLiveOrders);
router.patch('/staff/orders/:id/status', authenticate, authorize(...staffRoles), orderController.updateOrderStatus);
router.put('/staff/orders/:id/status', authenticate, authorize(...staffRoles), orderController.updateOrderStatus);

// Tables - Public (for reservations)
router.get('/tables', tableController.getTables);
router.get('/tables/available', tableController.getTables); // Simplified: returns all active tables

// Tables - Staff
router.get('/staff/tables', authenticate, authorize(...staffRoles), tableController.getTables);
router.patch('/staff/tables/:id', authenticate, authorize(...staffRoles), tableController.updateTable);

// ============================================
// Reservations Routes (Real implementation)
// ============================================

// Get all reservations (staff/admin only)
router.get('/reservations', authenticate, authorize(...staffRoles), async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { date, status, table_id } = req.query;
    
    let query = supabase
      .from('table_reservations')
      .select(`
        *,
        restaurant_tables (id, table_number, section, capacity)
      `)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    
    if (date) {
      query = query.eq('date', date as string);
    }
    if (status) {
      query = query.eq('status', status as string);
    }
    if (table_id) {
      query = query.eq('table_id', table_id as string);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.error('Failed to fetch reservations:', error.message, 'code:', error.code, 'details:', error.details);
      // If table doesn't exist, return empty array gracefully
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return res.json({ success: true, data: [] });
      }
      return res.status(500).json({ success: false, error: 'Failed to fetch reservations' });
    }
    
    res.json({ success: true, data: data || [] });
  } catch (error) {
    logger.error('Error fetching reservations:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get public reservations for a date (for availability check)
router.get('/reservations/availability', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { date, party_size } = req.query;
    
    if (!date) {
      return res.status(400).json({ success: false, error: 'Date is required' });
    }
    
    // Get all available tables
    const { data: tables, error: tablesError } = await supabase
      .from('restaurant_tables')
      .select('id, number, section, capacity, status')
      .eq('is_active', true)
      .gte('capacity', parseInt(party_size as string || '1', 10));
    
    if (tablesError) {
      return res.status(500).json({ success: false, error: 'Failed to fetch tables' });
    }
    
    // Get reservations for that date
    const { data: reservations, error: resError } = await supabase
      .from('table_reservations')
      .select('table_id, time, end_time, status')
      .eq('date', date as string)
      .in('status', ['CONFIRMED', 'PENDING', 'SEATED']);
    
    if (resError) {
      return res.status(500).json({ success: false, error: 'Failed to fetch reservations' });
    }
    
    res.json({
      success: true,
      data: {
        tables: tables || [],
        reservations: reservations || []
      }
    });
  } catch (error) {
    logger.error('Error checking availability:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create a new reservation (public with rate limiting)
router.post('/reservations', rateLimits.write, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const {
      table_id,
      date,
      time,
      end_time,
      party_size,
      guest_name,
      guest_phone,
      guest_email,
      special_requests
    } = req.body;
    
    // Validate required fields
    if (!date || !time || !party_size || !guest_name || !guest_phone) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: date, time, party_size, guest_name, guest_phone'
      });
    }
    
    // Calculate end_time if not provided (default 2 hours)
    const calculatedEndTime = end_time || calculateEndTime(time);
    
    // Check for conflicts if table_id provided
    if (table_id) {
      const { data: conflicts } = await supabase
        .from('table_reservations')
        .select('id')
        .eq('table_id', table_id)
        .eq('date', date)
        .in('status', ['CONFIRMED', 'PENDING', 'SEATED'])
        .or(`time.lte.${calculatedEndTime},end_time.gte.${time}`);
      
      if (conflicts && conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'This table is already reserved for the selected time slot'
        });
      }
    }
    
    // Create reservation
    const { data: reservation, error } = await supabase
      .from('table_reservations')
      .insert({
        table_id,
        date,
        time,
        end_time: calculatedEndTime,
        party_size: parseInt(party_size, 10),
        guest_name,
        guest_phone,
        guest_email: guest_email || null,
        special_requests: special_requests || null,
        status: 'PENDING'
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Failed to create reservation:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to create reservation' });
    }
    
    // Send confirmation email if email provided
    if (guest_email && reservation) {
      try {
        await emailService.sendEmail({
          to: guest_email,
          subject: 'Your Table Reservation - Confirmation',
          template: 'reservation_confirmation',
          data: {
            guestName: guest_name,
            reservationDate: date,
            reservationTime: time,
            partySize: party_size,
            specialRequests: special_requests || 'None',
            reservationId: reservation.id
          }
        });
        logger.info(`Reservation confirmation email sent to ${guest_email}`);
      } catch (emailError) {
        logger.warn('Failed to send confirmation email:', emailError);
        // Don't fail the reservation if email fails
      }
    }
    
    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    logger.error('Error creating reservation:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update reservation status (staff only)
router.patch('/reservations/:id', authenticate, authorize(...staffRoles), async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user?.id;
    
    // Add audit fields based on status
    if (updates.status === 'CONFIRMED') {
      updates.confirmed_at = new Date().toISOString();
      updates.confirmed_by = userId;
    } else if (updates.status === 'SEATED') {
      updates.seated_at = new Date().toISOString();
      updates.seated_by = userId;
    } else if (updates.status === 'COMPLETED') {
      updates.completed_at = new Date().toISOString();
    } else if (updates.status === 'CANCELLED') {
      updates.cancelled_at = new Date().toISOString();
    } else if (updates.status === 'NO_SHOW') {
      updates.no_show_marked_at = new Date().toISOString();
      updates.no_show_marked_by = userId;
    }
    
    const { data, error } = await supabase
      .from('table_reservations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      logger.error('Failed to update reservation:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to update reservation' });
    }
    
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error updating reservation:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Assign table to reservation (staff only)
router.post('/reservations/:id/assign-table', authenticate, authorize(...staffRoles), async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const { table_id } = req.body;
    
    if (!table_id) {
      return res.status(400).json({ success: false, error: 'table_id is required' });
    }
    
    const { data, error } = await supabase
      .from('table_reservations')
      .update({ table_id })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      logger.error('Failed to assign table:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to assign table' });
    }
    
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error assigning table:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get single reservation
router.get('/reservations/:id', authenticate, authorize(...staffRoles), async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('table_reservations')
      .select(`
        *,
        restaurant_tables (id, table_number, section, capacity)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }
    
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error fetching reservation:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Helper function to calculate end time (default 2 hours from start)
function calculateEndTime(startTime: string): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const endHours = (hours + 2) % 24;
  return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// ============================================
// Admin Routes (Menu Management)
// ============================================
const adminRoles = [
  'restaurant_admin', 
  'snack_bar_admin',
  'chalet_admin',
  'pool_admin',
  'admin',
  'super_admin'
];

// ... (Admin routes would go here if I had them in context, but I'll just append the moved routes at the end of the file)

// Moved parameterized routes to end
router.get('/orders/:id', optionalAuth, orderController.getOrder);
router.get('/orders/:id/status', optionalAuth, orderController.getOrderStatus);

// Categories
router.post('/admin/categories', authenticate, authorize(...adminRoles), menuController.createCategory);
router.put('/admin/categories/:id', authenticate, authorize(...adminRoles), menuController.updateCategory);
router.delete('/admin/categories/:id', authenticate, authorize(...adminRoles), menuController.deleteCategory);

// Menu Items
router.post('/admin/items', authenticate, authorize(...adminRoles), menuController.createMenuItem);
router.put('/admin/items/:id', authenticate, authorize(...adminRoles), menuController.updateMenuItem);
router.delete('/admin/items/:id', authenticate, authorize(...adminRoles), menuController.deleteMenuItem);
router.patch('/admin/items/:id/availability', authenticate, authorize(...adminRoles), menuController.toggleAvailability);

// Admin Orders (for admin dashboard)
router.get('/admin/orders', authenticate, authorize(...adminRoles), orderController.getStaffOrders);
router.put('/admin/orders/:id/status', authenticate, authorize(...adminRoles), orderController.updateOrderStatus);
router.patch('/admin/orders/:id/status', authenticate, authorize(...adminRoles), orderController.updateOrderStatus);

// Tables
router.post('/admin/tables', authenticate, authorize(...adminRoles), tableController.createTable);
router.delete('/admin/tables/:id', authenticate, authorize(...adminRoles), tableController.deleteTable);

// Reports
router.get('/admin/reports/daily', authenticate, authorize(...adminRoles), orderController.getDailyReport);
router.get('/admin/reports/sales', authenticate, authorize(...adminRoles), orderController.getSalesReport);

// ============================================
// Modifier Routes (Public + Admin)
// ============================================
// Public - Get modifiers for a menu item (for customer ordering UI)
router.get('/menu/items/:menuItemId/modifiers', modifiersController.getItemModifiers);

// Admin - Modifier Groups CRUD
router.get('/admin/modifiers/groups', authenticate, authorize(...adminRoles), modifiersController.getGroups);
router.post('/admin/modifiers/groups', authenticate, authorize(...adminRoles), modifiersController.createGroup);
router.put('/admin/modifiers/groups/:id', authenticate, authorize(...adminRoles), modifiersController.updateGroup);
router.delete('/admin/modifiers/groups/:id', authenticate, authorize(...adminRoles), modifiersController.deleteGroup);

// Admin - Modifier Options CRUD
router.post('/admin/modifiers/groups/:groupId/options', authenticate, authorize(...adminRoles), modifiersController.createOption);
router.put('/admin/modifiers/options/:optionId', authenticate, authorize(...adminRoles), modifiersController.updateOption);
router.delete('/admin/modifiers/options/:optionId', authenticate, authorize(...adminRoles), modifiersController.deleteOption);

// Admin - Link modifiers to menu items
router.get('/admin/items/:menuItemId/modifiers', authenticate, authorize(...adminRoles), modifiersController.getItemModifiers);
router.post('/admin/items/:menuItemId/modifiers', authenticate, authorize(...adminRoles), modifiersController.setItemModifiers);

// Admin - Inventory items for linking (helper)
router.get('/admin/modifiers/inventory-items', authenticate, authorize(...adminRoles), modifiersController.getInventoryItems);

export default router;
