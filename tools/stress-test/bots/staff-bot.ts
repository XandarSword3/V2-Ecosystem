import { ApiClient } from '../utils/api-client';
import { Logger, globalMetrics } from '../utils/logger';
import { CONFIG, generateStaffData } from '../config';
import {
  weightedRandom,
  randomDelay,
  randomInt,
  randomElement,
  nextOrderStatus,
} from '../utils/helpers';

export class StaffBot {
  private api: ApiClient;
  private logger: Logger;
  private botId: number;
  private isTrainee: boolean;
  private isRunning = false;
  
  // Cached work items
  private pendingOrders: any[] = [];
  private todayBookings: any[] = [];
  private todayTickets: any[] = [];
  private tables: any[] = [];
  private dynamicModuleSlugs: string[] = []; // Track dynamic modules for staff

  constructor(botId: number, isTrainee = false) {
    this.botId = botId;
    this.isTrainee = isTrainee;
    this.api = new ApiClient();
    this.logger = new Logger('Staff', `${botId}${isTrainee ? ' (Trainee)' : ''}`);
  }

  async initialize(): Promise<boolean> {
    const userData = generateStaffData(this.botId, this.isTrainee);
    return this.initializeWithCredentials(userData.email, userData.password);
  }

  async initializeWithCredentials(email: string, password: string): Promise<boolean> {
    // Try to login first
    let success = await this.api.login(email, password);
    
    if (!success) {
      // Try alternate passwords (seeded accounts might use 'staff123')
      success = await this.api.login(email, 'staff123');
    }
    
    if (!success) {
      this.logger.warn(`Could not login as ${email}, credentials may not exist`);
      return false;
    }

    this.logger.success(`Logged in as ${this.isTrainee ? 'Trainee' : 'Staff'} ${email}`);
    
    // Load initial work data
    await this.refreshWorkData();
    
    return true;
  }

  private async refreshWorkData(): Promise<void> {
    const [restOrders, snackOrders, bookings, tickets, tables, modulesRes] = await Promise.all([
      this.api.getLiveOrders('restaurant'),
      this.api.getLiveOrders('snack'),
      this.api.getTodayBookings(),
      this.api.getTodayTickets(),
      this.api.getTables(),
      this.api.getModules(),
    ]);

    if (restOrders.success && restOrders.data) {
      const orders = Array.isArray(restOrders.data) ? restOrders.data : (restOrders.data.orders || []);
      // Tag orders with their module for correct routing when updating
      orders.forEach((o: any) => o.module = 'restaurant');
      this.pendingOrders.push(...orders);
    }

    if (snackOrders.success && snackOrders.data) {
      const orders = Array.isArray(snackOrders.data) ? snackOrders.data : (snackOrders.data.orders || []);
      // Tag orders with their module for correct routing when updating
      orders.forEach((o: any) => o.module = 'snack');
      this.pendingOrders.push(...orders);
    }

    if (bookings.success && bookings.data) {
      this.todayBookings = Array.isArray(bookings.data) ? bookings.data : (bookings.data.bookings || []);
    }

    if (tickets.success && tickets.data) {
      this.todayTickets = Array.isArray(tickets.data) ? tickets.data : (tickets.data.tickets || []);
    }

    if (tables.success && tables.data) {
      this.tables = Array.isArray(tables.data) ? tables.data : (tables.data.tables || []);
    }

    // Get dynamic modules (menu_service type)
    if (modulesRes.success && modulesRes.data) {
      const modules = Array.isArray(modulesRes.data) ? modulesRes.data : (modulesRes.data.modules || []);
      this.dynamicModuleSlugs = modules
        .filter((m: any) => 
          m.template_type === 'menu_service' && 
          m.is_active &&
          !['restaurant', 'snack-bar'].includes(m.slug)
        )
        .map((m: any) => m.slug);
    }
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info(`Starting ${this.isTrainee ? 'trainee' : 'staff'} simulation...`);

    while (this.isRunning) {
      // Realistic staff behavior:
      // 1. Prioritize processing pending orders
      // 2. Refresh orders periodically
      // 3. Handle other tasks when no orders pending
      
      let action: string;
      
      // Always check for orders first
      if (this.pendingOrders.length === 0) {
        // Refresh orders from API
        action = 'VIEW_LIVE_ORDERS';
      } else {
        // Find orders that need to be advanced
        const orderToProcess = this.pendingOrders.find(o => 
          o.status && this.shouldAdvanceOrder(o)
        );
        
        if (orderToProcess) {
          // Process orders that are ready to be advanced
          action = 'UPDATE_ORDER_STATUS';
        } else {
          // No orders ready to advance - do other tasks or wait
          action = weightedRandom(CONFIG.STAFF_ACTIONS);
        }
      }
      
      await this.performAction(action);
      await randomDelay(CONFIG.STAFF_ACTION_INTERVAL.min, CONFIG.STAFF_ACTION_INTERVAL.max);
    }
  }

  // Check if an order should be advanced based on realistic timing
  // Timings are accelerated for stress testing (real-world would be 5-10x longer)
  private shouldAdvanceOrder(order: any): boolean {
    const now = Date.now();
    const createdAt = new Date(order.created_at || order.createdAt || now).getTime();
    const ageSeconds = (now - createdAt) / 1000;
    
    // Use deterministic thresholds based on order ID to avoid randomness on each check
    const orderHash = order.id ? order.id.charCodeAt(0) % 10 : 0;
    
    // Accelerated timing for stress test (fixed thresholds)
    switch (order.status) {
      case 'pending':
        // Confirm orders within 5-10 seconds
        return ageSeconds > (5 + orderHash % 5);
      case 'confirmed':
        // Start preparing after 8-15 seconds
        return ageSeconds > (8 + orderHash % 7);
      case 'preparing':
        // Ready after 15-25 seconds
        return ageSeconds > (15 + orderHash % 10);
      case 'ready':
        // Deliver after 5-10 seconds
        return ageSeconds > (5 + orderHash % 5);
      case 'delivered':
        // Complete after 3-6 seconds (finalize order)
        return ageSeconds > (3 + orderHash % 3);
      default:
        return false;
    }
  }

  stop(): void {
    this.isRunning = false;
    this.logger.info('Clocking out...');
  }

  private async performAction(action: string): Promise<void> {
    const startTime = Date.now();
    let success = false;

    try {
      switch (action) {
        case 'VIEW_LIVE_ORDERS':
          success = await this.viewLiveOrders();
          break;
        case 'UPDATE_ORDER_STATUS':
          success = await this.updateOrderStatus();
          break;
        case 'VIEW_TODAY_BOOKINGS':
          success = await this.viewTodayBookings();
          break;
        case 'CHECKIN_GUEST':
          success = await this.checkinGuest();
          break;
        case 'CHECKOUT_GUEST':
          success = await this.checkoutGuest();
          break;
        case 'VALIDATE_POOL_TICKET':
          success = await this.validatePoolTicket();
          break;
        case 'RECORD_POOL_ENTRY':
          success = await this.recordPoolEntry();
          break;
        case 'RECORD_POOL_EXIT':
          success = await this.recordPoolExit();
          break;
        case 'VIEW_POOL_CAPACITY':
          success = await this.viewPoolCapacity();
          break;
        case 'RECORD_PAYMENT':
          success = await this.recordPayment();
          break;
        case 'VIEW_TABLES':
          success = await this.viewTables();
          break;
        default:
          this.logger.warn(`Unknown action: ${action}`);
          return;
      }

      const latency = Date.now() - startTime;
      globalMetrics.recordRequest(success, latency);
      globalMetrics.recordAction(`Staff.${action}`);

    } catch (error: any) {
      globalMetrics.recordRequest(false, Date.now() - startTime);
      globalMetrics.recordError(`Staff ${this.botId}: ${action} - ${error.message}`);
      this.logger.error(`${action} failed: ${error.message}`);
    }
  }

  // ============ ACTION IMPLEMENTATIONS ============

  private async viewLiveOrders(): Promise<boolean> {
    const module = randomElement(['restaurant', 'snack']) as 'restaurant' | 'snack';
    this.logger.action(`Checking live ${module} orders...`);
    
    const result = await this.api.getLiveOrders(module);
    
    if (result.success) {
      const orders = Array.isArray(result.data) ? result.data : (result.data?.orders || []);
      // Tag orders with their module for correct routing when updating
      orders.forEach((o: any) => o.module = module);
      
      // MERGE orders instead of replacing - keep orders from other module
      const existingOtherModule = this.pendingOrders.filter(o => o.module !== module);
      // Filter out completed orders and merge
      const activeNewOrders = orders.filter((o: any) => 
        o.status !== 'completed' && o.status !== 'cancelled'
      );
      this.pendingOrders = [...existingOtherModule, ...activeNewOrders];
      
      this.logger.success(`Found ${orders.length} ${module} orders (${this.pendingOrders.length} total tracked)`);
    }

    // Also check dynamic modules if we have any
    if (this.dynamicModuleSlugs.length > 0) {
      const slug = randomElement(this.dynamicModuleSlugs);
      await this.fetchDynamicModuleOrders(slug);
    }

    return result.success;
  }

  private async fetchDynamicModuleOrders(slug: string): Promise<void> {
    // Dynamic module staff endpoints may not exist yet - fail silently
    try {
      const result = await this.api.getModuleLiveOrders(slug);
      
      if (result.success && result.data) {
        const orders = Array.isArray(result.data) ? result.data : (result.data?.orders || []);
        if (orders.length > 0) {
          orders.forEach((o: any) => o.module = slug);
          
          // Merge with existing (keep orders from other modules)
          const existingOtherModule = this.pendingOrders.filter(o => o.module !== slug);
          const activeNewOrders = orders.filter((o: any) => 
            o.status !== 'completed' && o.status !== 'cancelled'
          );
          this.pendingOrders = [...existingOtherModule, ...activeNewOrders];
          
          this.logger.success(`Found ${orders.length} ${slug} orders`);
        }
      }
    } catch (e) {
      // Dynamic module order endpoints not implemented yet - that's OK
    }
  }

  private async updateOrderStatus(): Promise<boolean> {
    // Refresh orders if empty
    if (this.pendingOrders.length === 0) {
      await this.refreshWorkData();
      if (this.pendingOrders.length === 0) {
        this.logger.info('No orders to process');
        return true; // Not a failure
      }
    }

    // Find an order that can be advanced AND is ready based on realistic timing
    const order = this.pendingOrders.find(o => 
      o.status && nextOrderStatus(o.status) !== null && this.shouldAdvanceOrder(o)
    );

    if (!order) {
      // Log how many orders are waiting
      const pendingCount = this.pendingOrders.filter(o => o.status && nextOrderStatus(o.status) !== null).length;
      if (pendingCount > 0) {
        this.logger.info(`⏳ ${pendingCount} orders processing (respecting prep time)...`);
      } else {
        this.logger.info('No orders ready for status update');
      }
      return true;
    }

    const newStatus = nextOrderStatus(order.status);
    if (!newStatus) return true;

    const module = order.module || (order.table_number !== undefined ? 'restaurant' : 'snack');
    
    // Realistic status messages
    const statusEmoji: Record<string, string> = {
      'confirmed': '✅',
      'preparing': '👨‍🍳',
      'ready': '🔔',
      'completed': '🎉'
    };
    
    this.logger.action(`${statusEmoji[newStatus] || '📋'} Order ${order.id}: ${order.status} → ${newStatus}`);
    
    // Use appropriate API based on module type
    let result;
    if (module === 'restaurant' || module === 'snack') {
      result = await this.api.updateOrderStatus(module, order.id, newStatus);
    } else {
      // Dynamic module - use the module-specific endpoint
      result = await this.api.updateModuleOrderStatus(module, order.id, newStatus);
    }
    
    if (result.success) {
      // Update local cache
      order.status = newStatus;
      if (newStatus === 'completed') {
        this.pendingOrders = this.pendingOrders.filter(o => o.id !== order.id);
        this.logger.success(`🎉 Order ${order.id} completed and delivered!`);
      } else {
        this.logger.success(`Order ${order.id} updated to ${newStatus}`);
      }
    } else {
      // Mark as completed to stop retrying
      this.pendingOrders = this.pendingOrders.filter(o => o.id !== order.id);
      this.logger.warn(`Order update failed: ${result.error}`);
    }
    return result.success;
  }

  private async viewTodayBookings(): Promise<boolean> {
    this.logger.action('Checking today\'s bookings...');
    
    const result = await this.api.getTodayBookings();
    
    if (result.success) {
      this.todayBookings = Array.isArray(result.data) ? result.data : (result.data?.bookings || []);
      this.logger.success(`Found ${this.todayBookings.length} bookings for today`);
    }
    return result.success;
  }

  private async checkinGuest(): Promise<boolean> {
    if (this.todayBookings.length === 0) {
      await this.refreshWorkData();
    }

    // Find a booking pending check-in
    const booking = this.todayBookings.find(b => 
      b.status === 'confirmed' || b.status === 'pending'
    );

    if (!booking) {
      this.logger.info('No guests awaiting check-in');
      return true;
    }

    this.logger.action(`Checking in guest for booking ${booking.id}...`);
    
    const result = await this.api.checkinGuest(booking.id);
    
    if (result.success) {
      booking.status = 'checked_in';
      this.logger.success(`Guest checked in! Booking ${booking.id}`);
    }
    return result.success;
  }

  private async checkoutGuest(): Promise<boolean> {
    const booking = this.todayBookings.find(b => b.status === 'checked_in');

    if (!booking) {
      this.logger.info('No guests ready for check-out');
      return true;
    }

    this.logger.action(`Checking out guest for booking ${booking.id}...`);
    
    const result = await this.api.checkoutGuest(booking.id);
    
    if (result.success) {
      booking.status = 'checked_out';
      this.logger.success(`Guest checked out! Booking ${booking.id}`);
    }
    return result.success;
  }

  private async validatePoolTicket(): Promise<boolean> {
    if (this.todayTickets.length === 0) {
      await this.refreshWorkData();
    }

    const ticket = this.todayTickets.find(t => t.status === 'valid' || t.status === 'active');

    if (!ticket) {
      // Generate a fake code to test validation
      this.logger.action('Validating pool ticket code...');
      const result = await this.api.validatePoolTicket(`TEST-${randomInt(1000, 9999)}`);
      return result.success || true; // Even failure is expected for fake codes
    }

    this.logger.action(`Validating ticket ${ticket.code || ticket.id}...`);
    
    const result = await this.api.validatePoolTicket(ticket.code || ticket.id);
    
    if (result.success) {
      this.logger.success(`Ticket validated: ${result.data?.valid ? 'VALID' : 'INVALID'}`);
    }
    return result.success;
  }

  private async recordPoolEntry(): Promise<boolean> {
    const ticket = this.todayTickets.find(t => 
      t.status === 'valid' && !t.entered
    );

    if (!ticket) {
      this.logger.info('No tickets for pool entry');
      return true;
    }

    this.logger.action(`Recording pool entry for ticket ${ticket.id}...`);
    
    const result = await this.api.recordPoolEntry(ticket.id);
    
    if (result.success) {
      ticket.entered = true;
      this.logger.success('Pool entry recorded');
    }
    return result.success;
  }

  private async recordPoolExit(): Promise<boolean> {
    const ticket = this.todayTickets.find(t => t.entered && !t.exited);

    if (!ticket) {
      this.logger.info('No guests to exit');
      return true;
    }

    this.logger.action(`Recording pool exit for ticket ${ticket.id}...`);
    
    const result = await this.api.recordPoolExit(ticket.id);
    
    if (result.success) {
      ticket.exited = true;
      this.logger.success('Pool exit recorded');
    }
    return result.success;
  }

  private async viewPoolCapacity(): Promise<boolean> {
    this.logger.action('Checking pool capacity...');
    
    const result = await this.api.getPoolCapacity();
    
    if (result.success) {
      const capacity = result.data?.current || result.data?.capacity || 'unknown';
      this.logger.success(`Current pool capacity: ${capacity}`);
    }
    return result.success;
  }

  private async recordPayment(): Promise<boolean> {
    // Randomly choose what type of payment to record
    // Prioritize: orders (most common), then bookings, then tickets
    const paymentType = weightedRandom({
      'order': 50,
      'booking': 30,
      'ticket': 20,
    });

    switch (paymentType) {
      case 'order':
        return this.recordOrderPayment();
      case 'booking':
        return this.recordBookingPayment();
      case 'ticket':
        return this.recordTicketPayment();
      default:
        return this.recordOrderPayment();
    }
  }

  private async recordOrderPayment(): Promise<boolean> {
    // Find an order that needs payment
    const order = this.pendingOrders.find(o => 
      o.payment_status === 'pending' || o.payment_status === 'unpaid'
    );

    if (!order) {
      this.logger.info('No pending order payments');
      return true;
    }

    this.logger.action(`Recording payment for ${order.module || 'restaurant'} order ${order.id}...`);
    
    // Determine referenceType based on module
    const referenceType = order.module === 'snack' ? 'snack_order' : 'restaurant_order';
    
    const result = await this.api.recordPayment({
      referenceType,
      referenceId: order.id,
      amount: order.total || order.amount || 50,
      method: randomElement(['cash', 'card', 'whish']),
      notes: 'Stress test payment',
    });

    if (result.success) {
      order.payment_status = 'paid';
      this.logger.success('Order payment recorded');
    }
    return result.success;
  }

  private async recordBookingPayment(): Promise<boolean> {
    // Find a chalet booking that needs payment
    const booking = this.todayBookings.find(b => 
      b.payment_status === 'pending' || b.payment_status === 'unpaid'
    );

    if (!booking) {
      this.logger.info('No pending booking payments');
      // Try order payment instead
      return this.recordOrderPayment();
    }

    this.logger.action(`Recording payment for chalet booking ${booking.id}...`);
    
    const result = await this.api.recordPayment({
      referenceType: 'chalet_booking',
      referenceId: booking.id,
      amount: booking.total_price || booking.total || 200,
      method: randomElement(['cash', 'card']),
      notes: 'Stress test chalet payment',
    });

    if (result.success) {
      booking.payment_status = 'paid';
      this.logger.success('Chalet booking payment recorded');
    }
    return result.success;
  }

  private async recordTicketPayment(): Promise<boolean> {
    // Find a pool ticket that needs payment
    const ticket = this.todayTickets.find(t => 
      t.payment_status === 'pending' || t.payment_status === 'unpaid'
    );

    if (!ticket) {
      this.logger.info('No pending ticket payments');
      // Try order payment instead  
      return this.recordOrderPayment();
    }

    this.logger.action(`Recording payment for pool ticket ${ticket.id}...`);
    
    const result = await this.api.recordPayment({
      referenceType: 'pool_ticket',
      referenceId: ticket.id,
      amount: ticket.total_price || ticket.price || 15,
      method: randomElement(['cash', 'card']),
      notes: 'Stress test pool ticket payment',
    });

    if (result.success) {
      ticket.payment_status = 'paid';
      this.logger.success('Pool ticket payment recorded');
    }
    return result.success;
  }

  private async viewTables(): Promise<boolean> {
    this.logger.action('Checking restaurant tables...');
    
    const result = await this.api.getTables();
    
    if (result.success) {
      this.tables = Array.isArray(result.data) ? result.data : (result.data?.tables || []);
      this.logger.success(`Found ${this.tables.length} tables`);
    }
    return result.success;
  }
}
