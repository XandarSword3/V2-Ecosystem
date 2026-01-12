import { ApiClient } from '../utils/api-client';
import { Logger, globalMetrics } from '../utils/logger';
import { CONFIG, generateCustomerData } from '../config';
import {
  weightedRandom,
  randomDelay,
  randomInt,
  randomElement,
  randomName,
  randomPhone,
  randomEmail,
  randomReviewComment,
  randomSpecialInstruction,
  randomSubject,
  futureDate,
} from '../utils/helpers';

interface CartItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  module: 'restaurant' | 'snack' | string; // string for dynamic module slugs
  prepTime?: number; // minutes
}

// Order tracking for realistic status monitoring
interface TrackedOrder {
  id: string;
  module: 'restaurant' | 'snack' | string; // string for dynamic module slugs
  status: string;
  placedAt: number;
  expectedReadyAt: number;
  lastChecked: number;
}

// Dynamic module info cache
interface DynamicModule {
  id: string;
  slug: string;
  name: string;
  template_type: string;
  menuItems?: any[];
}

export class CustomerBot {
  private api: ApiClient;
  private logger: Logger;
  private botId: number;
  private isRunning = false;
  private cart: CartItem[] = [];
  
  // Cached data for realistic behavior
  private menuItems: any[] = [];
  private snackItems: any[] = [];
  private chalets: any[] = [];
  private poolSessions: any[] = [];
  private dynamicModules: DynamicModule[] = [];
  private myOrders: string[] = [];
  private myBookings: string[] = [];
  private myTickets: string[] = [];
  
  // Lifecycle state for realistic behavior
  private phase: 'browsing' | 'ordering' | 'waiting' | 'done' = 'browsing';
  private trackedOrders: TrackedOrder[] = [];
  private hasPlacedOrder = false;
  private browseCount = 0;

  constructor(botId: number) {
    this.botId = botId;
    this.api = new ApiClient();
    this.logger = new Logger('Customer', botId);
  }

  async initialize(): Promise<boolean> {
    const userData = generateCustomerData(this.botId);
    
    // Try to login first, if fails, register
    let success = await this.api.login(userData.email, userData.password);
    
    if (!success) {
      this.logger.info(`Registering new account...`);
      success = await this.api.register(userData.email, userData.password, userData.full_name, userData.phone);
      
      if (!success) {
        // Account might exist with different password, try logging in again
        success = await this.api.login(userData.email, 'TestPass123!');
      }
    }

    if (success) {
      this.logger.success(`Logged in as ${userData.email}`);
    } else {
      this.logger.warn(`Auth failed, continuing as guest`);
    }

    // Pre-fetch data for browsing
    await this.refreshCatalogData();
    
    return true;
  }

  private async refreshCatalogData(): Promise<void> {
    const [menuRes, snackRes, chaletsRes, poolRes, modulesRes] = await Promise.all([
      this.api.getRestaurantMenu(),
      this.api.getSnackItems(),
      this.api.getChalets(),
      this.api.getPoolSessions(),
      this.api.getModules(),
    ]);

    if (menuRes.success && menuRes.data) {
      // Extract items from menu response - prefer flat items array
      if (menuRes.data.items && Array.isArray(menuRes.data.items)) {
        this.menuItems = menuRes.data.items;
      } else if (menuRes.data.menuByCategory && Array.isArray(menuRes.data.menuByCategory)) {
        // Extract from categories with items
        this.menuItems = menuRes.data.menuByCategory.flatMap((cat: any) => cat.items || []);
      } else if (Array.isArray(menuRes.data)) {
        this.menuItems = menuRes.data.flatMap((cat: any) => cat.items || []);
      } else if (menuRes.data.categories) {
        this.menuItems = menuRes.data.categories.flatMap((cat: any) => cat.items || []);
      }
    }

    if (snackRes.success && snackRes.data) {
      this.snackItems = Array.isArray(snackRes.data) ? snackRes.data : (snackRes.data.items || []);
    }

    if (chaletsRes.success && chaletsRes.data) {
      this.chalets = Array.isArray(chaletsRes.data) ? chaletsRes.data : (chaletsRes.data.chalets || []);
    }

    if (poolRes.success && poolRes.data) {
      this.poolSessions = Array.isArray(poolRes.data) ? poolRes.data : (poolRes.data.sessions || []);
    }

    // Load dynamic modules (menu_service type for ordering)
    if (modulesRes.success && modulesRes.data) {
      const modules = Array.isArray(modulesRes.data) ? modulesRes.data : (modulesRes.data.modules || []);
      // Filter to menu_service type modules that aren't the built-in ones
      this.dynamicModules = modules
        .filter((m: any) => 
          m.template_type === 'menu_service' && 
          m.is_active && 
          !['restaurant', 'snack-bar'].includes(m.slug)
        )
        .map((m: any) => ({
          id: m.id,
          slug: m.slug,
          name: m.name,
          template_type: m.template_type,
          menuItems: [],
        }));
    }
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.logger.info('Starting customer simulation...');

    while (this.isRunning) {
      // Realistic customer lifecycle:
      // 1. Browse first (2-4 actions)
      // 2. Place an order
      // 3. Browse while waiting, check order status periodically
      // 4. Once order is ready/completed, might order again or leave
      
      let action: string;
      
      if (!this.hasPlacedOrder && this.browseCount < randomInt(2, 4)) {
        // Phase 1: Initial browsing
        action = this.getBrowsingAction();
        this.browseCount++;
      } else if (!this.hasPlacedOrder) {
        // Phase 2: Place an order
        action = Math.random() > 0.4 ? 'PLACE_RESTAURANT_ORDER' : 'PLACE_SNACK_ORDER';
      } else if (this.trackedOrders.some(o => o.status !== 'completed' && o.status !== 'cancelled')) {
        // Phase 3: Waiting - check order status or browse
        if (Math.random() > 0.6) {
          action = 'CHECK_ORDER_STATUS';
        } else {
          action = this.getBrowsingAction();
        }
      } else {
        // Phase 4: Order done - might place another or do other activities
        if (Math.random() > 0.7) {
          this.hasPlacedOrder = false;
          this.browseCount = 0;
          action = this.getBrowsingAction();
        } else {
          action = weightedRandom(CONFIG.CUSTOMER_ACTIONS);
        }
      }
      
      await this.performAction(action);
      await randomDelay(CONFIG.CUSTOMER_ACTION_INTERVAL.min, CONFIG.CUSTOMER_ACTION_INTERVAL.max);
    }
  }

  private getBrowsingAction(): string {
    const browsingActions = [
      'BROWSE_RESTAURANT_MENU',
      'BROWSE_SNACK_MENU', 
      'VIEW_CHALETS',
      'VIEW_POOL_SESSIONS',
      'ADD_TO_CART',
      'BROWSE_DYNAMIC_MODULE', // New: browse dynamic modules
    ];
    return randomElement(browsingActions);
  }

  stop(): void {
    this.isRunning = false;
    this.logger.info('Stopping...');
  }

  private async performAction(action: string): Promise<void> {
    const startTime = Date.now();
    let success = false;

    try {
      switch (action) {
        case 'BROWSE_RESTAURANT_MENU':
          success = await this.browseRestaurantMenu();
          break;
        case 'BROWSE_SNACK_MENU':
          success = await this.browseSnackMenu();
          break;
        case 'VIEW_CHALETS':
          success = await this.viewChalets();
          break;
        case 'CHECK_CHALET_AVAILABILITY':
          success = await this.checkChaletAvailability();
          break;
        case 'VIEW_POOL_SESSIONS':
          success = await this.viewPoolSessions();
          break;
        case 'ADD_TO_CART':
          success = await this.addToCart();
          break;
        case 'PLACE_RESTAURANT_ORDER':
          success = await this.placeRestaurantOrder();
          break;
        case 'PLACE_SNACK_ORDER':
          success = await this.placeSnackOrder();
          break;
        case 'BROWSE_DYNAMIC_MODULE':
          success = await this.browseDynamicModule();
          break;
        case 'PLACE_MODULE_ORDER':
          success = await this.placeModuleOrder();
          break;
        case 'BOOK_CHALET':
          success = await this.bookChalet();
          break;
        case 'BUY_POOL_TICKET':
          success = await this.buyPoolTicket();
          break;
        case 'VIEW_MY_ORDERS':
          success = await this.viewMyOrders();
          break;
        case 'CHECK_ORDER_STATUS':
          success = await this.checkOrderStatus();
          break;
        case 'VIEW_MY_BOOKINGS':
          success = await this.viewMyBookings();
          break;
        case 'VIEW_MY_TICKETS':
          success = await this.viewMyTickets();
          break;
        case 'SUBMIT_REVIEW':
          success = await this.submitReview();
          break;
        case 'CONTACT_SUPPORT':
          success = await this.contactSupport();
          break;
        case 'VIEW_PROFILE':
          success = await this.viewProfile();
          break;
        default:
          this.logger.warn(`Unknown action: ${action}`);
          return;
      }

      const latency = Date.now() - startTime;
      globalMetrics.recordRequest(success, latency);
      globalMetrics.recordAction(`Customer.${action}`);

    } catch (error: any) {
      globalMetrics.recordRequest(false, Date.now() - startTime);
      globalMetrics.recordError(`Customer ${this.botId}: ${action} - ${error.message}`);
      this.logger.error(`${action} failed: ${error.message}`);
    }
  }

  // ============ ACTION IMPLEMENTATIONS ============

  private async browseRestaurantMenu(): Promise<boolean> {
    this.logger.action('Browsing restaurant menu...');
    const result = await this.api.getRestaurantMenu();
    
    if (result.success) {
      // Sometimes look at a specific item
      if (this.menuItems.length > 0 && Math.random() > 0.5) {
        const item = randomElement(this.menuItems);
        await this.api.getRestaurantItem(item.id);
        this.logger.info(`Viewed item: ${item.name || item.id}`);
      }
      this.logger.success('Browsed restaurant menu');
    }
    return result.success;
  }

  private async browseSnackMenu(): Promise<boolean> {
    this.logger.action('Browsing snack bar...');
    const result = await this.api.getSnackItems();
    if (result.success) {
      this.logger.success('Browsed snack menu');
    }
    return result.success;
  }

  private async browseDynamicModule(): Promise<boolean> {
    // Refresh modules if empty
    if (this.dynamicModules.length === 0) {
      await this.refreshCatalogData();
      if (this.dynamicModules.length === 0) {
        this.logger.info('No dynamic modules available');
        return true; // Not an error, just nothing to browse
      }
    }

    const module = randomElement(this.dynamicModules);
    this.logger.action(`Browsing ${module.name} (/${module.slug})...`);

    // Get module info (menu endpoint may not exist for dynamic modules)
    const moduleRes = await this.api.getModuleBySlug(module.slug);
    
    if (moduleRes.success && moduleRes.data) {
      this.logger.success(`Viewed module: ${module.name}`);
      
      // Try to get menu if endpoint exists
      const menuRes = await this.api.getModuleMenu(module.slug);
      if (menuRes.success && menuRes.data) {
        const items = Array.isArray(menuRes.data) ? menuRes.data : (menuRes.data.items || menuRes.data.menu || []);
        module.menuItems = items;
        if (items.length > 0) {
          this.logger.info(`  Found ${items.length} menu items`);
        }
      }
      // If menu endpoint fails, that's OK - module may not have menu support yet
    }
    return moduleRes.success;
  }

  private async placeModuleOrder(): Promise<boolean> {
    // Dynamic module orders not supported in backend yet
    // Just clear any dynamic module items from cart
    const moduleItems = this.cart.filter(i => 
      i.module !== 'restaurant' && i.module !== 'snack'
    );
    
    if (moduleItems.length > 0) {
      this.logger.info(`Dynamic module orders not supported yet - clearing ${moduleItems.length} items`);
      this.cart = this.cart.filter(i => i.module === 'restaurant' || i.module === 'snack');
    }
    return true;
  }

  private async viewChalets(): Promise<boolean> {
    this.logger.action('Viewing chalets...');
    const result = await this.api.getChalets();
    
    if (result.success && this.chalets.length > 0) {
      // Sometimes view a specific chalet
      if (Math.random() > 0.5) {
        const chalet = randomElement(this.chalets);
        await this.api.getChalet(chalet.id);
        this.logger.info(`Viewed chalet: ${chalet.name || chalet.id}`);
      }
    }
    return result.success;
  }

  private async checkChaletAvailability(): Promise<boolean> {
    if (this.chalets.length === 0) {
      await this.refreshCatalogData();
      if (this.chalets.length === 0) return false;
    }

    const chalet = randomElement(this.chalets);
    const checkIn = futureDate(randomInt(1, 30));
    const checkOut = futureDate(randomInt(31, 45));
    
    this.logger.action(`Checking availability for ${chalet.name || 'chalet'}...`);
    const result = await this.api.checkChaletAvailability(chalet.id, checkIn, checkOut);
    
    if (result.success) {
      this.logger.success(`Availability checked: ${result.data?.available ? 'Available' : 'Not available'}`);
    }
    return result.success;
  }

  private async viewPoolSessions(): Promise<boolean> {
    this.logger.action('Viewing pool sessions...');
    const result = await this.api.getPoolSessions();
    if (result.success) {
      this.logger.success(`Found ${this.poolSessions.length} pool sessions`);
    }
    return result.success;
  }

  private async addToCart(): Promise<boolean> {
    // Decide which menu to add from
    const useSnack = Math.random() > 0.6;
    const items = useSnack ? this.snackItems : this.menuItems;
    
    if (items.length === 0) {
      await this.refreshCatalogData();
      return false;
    }

    // Filter to only items with valid IDs
    const validItems = items.filter((i: any) => i.id);
    if (validItems.length === 0) {
      this.logger.warn('No items with valid IDs available');
      return false;
    }

    const item = randomElement(validItems);
    const quantity = randomInt(1, 3);
    
    this.cart.push({
      menuItemId: item.id,
      name: item.name || 'Unknown Item',
      quantity,
      price: item.price || 0,
      module: useSnack ? 'snack' : 'restaurant',
    });

    this.logger.success(`Added ${quantity}x ${item.name || item.id} to cart (${this.cart.length} items total)`);
    return true;
  }

  private async placeRestaurantOrder(): Promise<boolean> {
    let restaurantItems = this.cart.filter(i => i.module === 'restaurant');
    
    if (restaurantItems.length === 0) {
      // Try to get fresh menu data if none cached
      if (this.menuItems.length === 0) {
        await this.refreshCatalogData();
      }
      
      // Filter to only items with valid IDs
      const validItems = this.menuItems.filter(item => item.id);
      if (validItems.length > 0) {
        const item = randomElement(validItems);
        restaurantItems.push({
          menuItemId: item.id,
          name: item.name || 'Menu Item',
          quantity: randomInt(1, 2),
          price: item.price || 0,
          module: 'restaurant',
        });
      } else {
        this.logger.warn('No valid restaurant menu items available');
        return false;
      }
    }

    // Filter out any items with undefined menuItemId
    const validOrderItems = restaurantItems.filter(i => i.menuItemId && i.menuItemId !== 'undefined');
    if (validOrderItems.length === 0) {
      this.logger.warn('No valid items to order (all had undefined IDs)');
      // Clear invalid restaurant items from cart
      this.cart = this.cart.filter(i => i.module !== 'restaurant' || (i.menuItemId && i.menuItemId !== 'undefined'));
      return false;
    }

    this.logger.action(`Placing restaurant order with ${validOrderItems.length} items...`);
    
    const result = await this.api.createRestaurantOrder({
      customerName: randomName(),
      customerPhone: randomPhone(),
      orderType: randomElement(['dine_in', 'takeaway', 'delivery']),
      items: validOrderItems.map(i => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        specialInstructions: randomSpecialInstruction(),
      })),
      tableNumber: Math.random() > 0.5 ? String(randomInt(1, 20)) : undefined,
      notes: Math.random() > 0.8 ? 'Birthday celebration!' : undefined,
    });

    if (result.success) {
      // Clear restaurant items from cart
      this.cart = this.cart.filter(i => i.module !== 'restaurant');
      if (result.data?.id) {
        this.myOrders.push(result.data.id);
        // Track order for status monitoring
        const avgPrepTime = validOrderItems.reduce((sum, i) => sum + (i.prepTime || 15), 0) / validOrderItems.length;
        this.trackedOrders.push({
          id: result.data.id,
          module: 'restaurant',
          status: 'pending',
          placedAt: Date.now(),
          expectedReadyAt: Date.now() + (avgPrepTime * 60 * 1000), // convert minutes to ms
          lastChecked: Date.now(),
        });
        this.hasPlacedOrder = true;
      }
      this.logger.success(`Order placed! ID: ${result.data?.id || 'unknown'} (tracking status...)`);
    } else {
      this.logger.warn(`Restaurant order failed: ${result.error}`);
    }
    return result.success;
  }

  private async placeSnackOrder(): Promise<boolean> {
    let snackItems = this.cart.filter(i => i.module === 'snack');
    
    if (snackItems.length === 0) {
      // Try to get fresh snack data if none cached
      if (this.snackItems.length === 0) {
        await this.refreshCatalogData();
      }
      
      // Filter to only items with valid IDs
      const validItems = this.snackItems.filter(item => item.id);
      if (validItems.length > 0) {
        const item = randomElement(validItems);
        snackItems.push({
          menuItemId: item.id,
          name: item.name || 'Snack Item',
          quantity: randomInt(1, 3),
          price: item.price || 0,
          module: 'snack',
        });
      } else {
        this.logger.warn('No valid snack items available');
        return false;
      }
    }

    // Filter out any items with undefined menuItemId
    const validOrderItems = snackItems.filter(i => i.menuItemId && i.menuItemId !== 'undefined');
    if (validOrderItems.length === 0) {
      this.logger.warn('No valid items to order (all had undefined IDs)');
      // Clear invalid snack items from cart
      this.cart = this.cart.filter(i => i.module !== 'snack' || (i.menuItemId && i.menuItemId !== 'undefined'));
      return false;
    }

    this.logger.action(`Placing snack order with ${validOrderItems.length} items...`);
    
    const result = await this.api.createSnackOrder({
      customerName: randomName(),
      customerPhone: randomPhone(),
      paymentMethod: randomElement(['cash', 'card']) as 'cash' | 'card',
      items: validOrderItems.map(i => ({
        itemId: i.menuItemId,  // Backend expects itemId, not menuItemId
        quantity: i.quantity,
      })),
    });

    if (result.success) {
      this.cart = this.cart.filter(i => i.module !== 'snack');
      if (result.data?.id) {
        this.myOrders.push(result.data.id);
        // Track order for status monitoring (snack orders are quicker - ~5 min)
        this.trackedOrders.push({
          id: result.data.id,
          module: 'snack',
          status: 'pending',
          placedAt: Date.now(),
          expectedReadyAt: Date.now() + (5 * 60 * 1000),
          lastChecked: Date.now(),
        });
        this.hasPlacedOrder = true;
      }
      this.logger.success(`Snack order placed! ID: ${result.data?.id || 'unknown'} (tracking status...)`);
    } else {
      this.logger.warn(`Snack order failed: ${result.error}`);
    }
    return result.success;
  }

  private async bookChalet(): Promise<boolean> {
    if (this.chalets.length === 0) {
      await this.refreshCatalogData();
      if (this.chalets.length === 0) return false;
    }

    const chalet = randomElement(this.chalets);
    // Book for today or tomorrow so it shows in daily dashboard
    const checkInDays = randomInt(0, 1);
    const stayLength = randomInt(1, 3);
    
    this.logger.action(`Booking chalet: ${chalet.name || chalet.id}...`);
    
    const result = await this.api.createChaletBooking({
      chaletId: chalet.id,
      checkInDate: futureDate(checkInDays),
      checkOutDate: futureDate(checkInDays + stayLength),
      customerName: randomName(),
      customerEmail: randomEmail(),
      customerPhone: randomPhone(),
      numberOfGuests: randomInt(1, chalet.capacity || 4),
      paymentMethod: randomElement(['cash', 'card', 'online']) as 'cash' | 'card' | 'online',
    });

    if (result.success) {
      if (result.data?.id) {
        this.myBookings.push(result.data.id);
      }
      this.logger.success(`Chalet booked! ID: ${result.data?.id || 'unknown'}`);
    } else {
      this.logger.warn(`Chalet booking failed: ${result.error}`);
    }
    return result.success;
  }

  private async buyPoolTicket(): Promise<boolean> {
    if (this.poolSessions.length === 0) {
      await this.refreshCatalogData();
      if (this.poolSessions.length === 0) return false;
    }

    const session = randomElement(this.poolSessions);
    const numGuests = randomInt(1, 4);
    
    this.logger.action(`Buying pool ticket for session: ${session.name || session.id}...`);
    
    const result = await this.api.buyPoolTicket({
      sessionId: session.id,
      // Book for today or tomorrow so it shows in daily dashboard
      ticketDate: futureDate(randomInt(0, 1)),
      numberOfGuests: numGuests,
      numberOfAdults: numGuests,
      numberOfChildren: 0,
      customerName: randomName(),
      customerEmail: randomEmail(),
      customerPhone: randomPhone(),
      paymentMethod: randomElement(['cash', 'card', 'online']) as 'cash' | 'card' | 'online',
    });

    if (result.success) {
      if (result.data?.id) {
        this.myTickets.push(result.data.id);
      }
      this.logger.success(`Pool ticket purchased! ID: ${result.data?.id || 'unknown'}`);
    } else {
      this.logger.warn(`Pool ticket failed: ${result.error}`);
    }
    return result.success;
  }

  private async viewMyOrders(): Promise<boolean> {
    this.logger.action('Viewing my orders...');
    const result = await this.api.getMyRestaurantOrders();
    if (result.success) {
      const count = Array.isArray(result.data) ? result.data.length : 0;
      this.logger.success(`Found ${count} orders`);
    }
    return result.success;
  }

  private async checkOrderStatus(): Promise<boolean> {
    // Check status of tracked orders
    const activeOrders = this.trackedOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
    
    if (activeOrders.length === 0) {
      this.logger.info('No active orders to track');
      return true;
    }

    // Check the oldest order first
    const order = activeOrders[0];
    const timeSincePlaced = Math.round((Date.now() - order.placedAt) / 1000);
    const expectedTime = Math.round((order.expectedReadyAt - order.placedAt) / 1000 / 60);
    
    this.logger.action(`Checking order ${order.id.slice(0, 8)}... (placed ${timeSincePlaced}s ago)`);
    
    // Get order status from API
    const result = order.module === 'restaurant' 
      ? await this.api.getRestaurantOrderStatus(order.id)
      : await this.api.getSnackOrderStatus(order.id);
    
    if (result.success && result.data) {
      const newStatus = result.data.status || result.data;
      const previousStatus = order.status;
      
      if (newStatus !== previousStatus) {
        order.status = newStatus;
        order.lastChecked = Date.now();
        
        // Log status change with realistic customer reactions
        if (newStatus === 'confirmed') {
          this.logger.success(`📋 Order confirmed! Staff received my order.`);
        } else if (newStatus === 'preparing') {
          this.logger.success(`👨‍🍳 Order is being prepared! Expected: ~${expectedTime} min`);
        } else if (newStatus === 'ready') {
          const actualTime = Math.round((Date.now() - order.placedAt) / 1000 / 60);
          this.logger.success(`🔔 Order ready! Took ${actualTime} min (expected ${expectedTime} min)`);
        } else if (newStatus === 'completed') {
          this.logger.success(`✅ Order completed! Enjoyed my meal.`);
        } else {
          this.logger.info(`Order status: ${previousStatus} → ${newStatus}`);
        }
      } else {
        this.logger.info(`Order still ${newStatus}... waiting patiently`);
      }
    } else {
      this.logger.warn(`Could not check order status: ${result.error}`);
    }
    
    return result.success;
  }

  private async viewMyBookings(): Promise<boolean> {
    this.logger.action('Viewing my bookings...');
    const result = await this.api.getMyChaletBookings();
    if (result.success) {
      const count = Array.isArray(result.data) ? result.data.length : 0;
      this.logger.success(`Found ${count} bookings`);
    }
    return result.success;
  }

  private async viewMyTickets(): Promise<boolean> {
    this.logger.action('Viewing my pool tickets...');
    const result = await this.api.getMyPoolTickets();
    if (result.success) {
      const count = Array.isArray(result.data) ? result.data.length : 0;
      this.logger.success(`Found ${count} tickets`);
    }
    return result.success;
  }

  private async submitReview(): Promise<boolean> {
    // Reviews require authentication
    if (!this.api.isAuthenticated) {
      this.logger.warn('Cannot submit review - not authenticated');
      return false;
    }
    
    this.logger.action('Submitting a review...');
    
    const result = await this.api.submitReview({
      service_type: randomElement(['restaurant', 'chalets', 'pool', 'snack_bar', 'general']),
      rating: randomInt(3, 5), // Mostly positive reviews
      text: randomReviewComment(),
    });

    if (result.success) {
      this.logger.success('Review submitted!');
    } else {
      this.logger.warn(`Review failed: ${result.error}`);
    }
    return result.success;
  }

  private async contactSupport(): Promise<boolean> {
    this.logger.action('Contacting support...');
    
    const result = await this.api.submitContactForm({
      name: randomName(),
      email: randomEmail(),
      subject: randomSubject(),
      message: 'This is a test message from the stress test bot.',
    });

    if (result.success) {
      this.logger.success('Contact form submitted');
    }
    return result.success;
  }

  private async viewProfile(): Promise<boolean> {
    this.logger.action('Viewing profile...');
    const result = await this.api.getProfile();
    if (result.success) {
      this.logger.success('Profile loaded');
    }
    return result.success;
  }
}
