/**
 * Staff Profile Types - Different staff roles
 */

import { StaffBot, StaffConfig, StaffProfile, Task } from './StaffBot';
import { EventTypes } from '../../events/EventBus';

/**
 * Front Desk Agent
 * Handles check-ins, check-outs, guest requests
 */
export class FrontDeskAgent extends StaffBot {
  constructor(config: Omit<StaffConfig, 'department' | 'type' | 'profile' | 'role'> & { profile?: Partial<StaffProfile>; role?: string }) {
    const defaultProfile: StaffProfile = {
      skillLevel: 'mid',
      speed: 1.0,
      accuracy: 0.95,
      multitaskLimit: 3,
      breakPreference: 'flexible',
      escalationThreshold: 7,
    };

    super({
      ...config,
      department: 'front_desk',
      role: config.role || 'front_desk_agent',
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Process check-in
    this.registerAction({
      name: 'process_checkin',
      weight: 8,
      preconditions: () => this.canTakeTask() && this.hasGuestWaiting('checkin'),
      execute: async () => this.processCheckIn(),
    });

    // Process check-out
    this.registerAction({
      name: 'process_checkout',
      weight: 8,
      preconditions: () => this.canTakeTask() && this.hasGuestWaiting('checkout'),
      execute: async () => this.processCheckOut(),
    });

    // Handle guest request
    this.registerAction({
      name: 'handle_request',
      weight: 5,
      preconditions: () => this.canTakeTask() && this.hasGuestWaiting('request'),
      execute: async () => this.handleGuestRequest(),
    });

    // Answer phone
    this.registerAction({
      name: 'answer_phone',
      weight: 4,
      preconditions: () => this.canTakeTask(),
      execute: async () => this.answerPhone(),
    });
  }

  private hasGuestWaiting(type: string): boolean {
    // This would check a queue - simplified for now
    return Math.random() > 0.5;
  }

  private async processCheckIn(): Promise<{ success: boolean; action: string; data?: any; error?: string; cascades?: string[] }> {
    const result = await this.apiCall('POST', '/api/v1/front-desk/check-in/process', {
      agentId: this.id,
    });

    if (result.success) {
      this.emitEvent(EventTypes.GUEST_CHECK_IN_COMPLETED, 'checkin', {
        agentId: this.id,
        processedBy: this.name,
      });

      return {
        success: true,
        action: 'process_checkin',
        data: result.data,
        cascades: [EventTypes.GUEST_CHECK_IN_COMPLETED],
      };
    }

    return { success: false, action: 'process_checkin', error: result.error };
  }

  private async processCheckOut(): Promise<{ success: boolean; action: string; data?: any; error?: string; cascades?: string[] }> {
    const result = await this.apiCall('POST', '/api/v1/front-desk/check-out/process', {
      agentId: this.id,
    });

    if (result.success) {
      this.emitEvent(EventTypes.GUEST_CHECK_OUT_COMPLETED, 'checkout', {
        agentId: this.id,
        processedBy: this.name,
      });

      return {
        success: true,
        action: 'process_checkout',
        data: result.data,
        cascades: [EventTypes.GUEST_CHECK_OUT_COMPLETED],
      };
    }

    return { success: false, action: 'process_checkout', error: result.error };
  }

  private async handleGuestRequest(): Promise<{ success: boolean; action: string; data?: any; error?: string }> {
    const result = await this.apiCall('POST', '/api/v1/front-desk/requests', {
      agentId: this.id,
    });

    return {
      success: result.success,
      action: 'handle_request',
      data: result.data,
      error: result.error,
    };
  }

  private async answerPhone(): Promise<{ success: boolean; action: string; data?: any }> {
    // Simulate phone call duration
    await this.wait(5);
    return { success: true, action: 'answer_phone', data: { duration: 5 } };
  }
}

/**
 * Housekeeping Staff
 * Cleans rooms, responds to requests
 */
export class HousekeepingStaff extends StaffBot {
  private roomsCleanedToday = 0;

  constructor(config: Omit<StaffConfig, 'department' | 'type' | 'profile' | 'role'> & { profile?: Partial<StaffProfile>; role?: string }) {
    const defaultProfile: StaffProfile = {
      skillLevel: 'mid',
      speed: 1.0,
      accuracy: 0.9,
      multitaskLimit: 1, // One room at a time
      breakPreference: 'regular',
      escalationThreshold: 8,
    };

    super({
      ...config,
      department: 'housekeeping',
      role: config.role || 'housekeeper',
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected subscribeToEvents(): void {
    super.subscribeToEvents();

    // Listen for rooms marked dirty
    this.eventBus.subscribe(EventTypes.ROOM_MARKED_DIRTY, (event) => {
      const payload = event.payload as { roomNumber: string; priority?: string; isCheckout?: boolean };
      if (this.canTakeTask()) {
        const task: Task = {
          id: `clean_${payload.roomNumber}_${Date.now()}`,
          type: 'room_cleaning',
          priority: payload.priority === 'urgent' ? 'high' : 'normal',
          difficulty: payload.isCheckout ? 5 : 3,
          estimatedMinutes: payload.isCheckout ? 45 : 25,
          data: { roomNumber: payload.roomNumber },
        };
        this.assignTask(task);
      }
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Clean room
    this.registerAction({
      name: 'clean_room',
      weight: 10,
      preconditions: () => {
        const cleaningTask = this.staffState.currentTasks.find(t => t.type === 'room_cleaning');
        return this.staffState.isOnShift && !this.staffState.isOnBreak && !!cleaningTask;
      },
      execute: async () => this.cleanRoom(),
    });

    // Restock cart
    this.registerAction({
      name: 'restock_cart',
      weight: 2,
      cooldown: 2 * 60 * 60 * 1000,
      preconditions: () => this.roomsCleanedToday > 0 && this.roomsCleanedToday % 5 === 0,
      execute: async () => this.restockCart(),
    });

    // Report maintenance issue
    this.registerAction({
      name: 'report_issue',
      weight: 1,
      preconditions: () => Math.random() < 0.1, // 10% chance to find an issue
      execute: async () => this.reportIssue(),
    });
  }

  private async cleanRoom(): Promise<{ success: boolean; action: string; data?: any; error?: string; cascades?: string[] }> {
    const task = this.staffState.currentTasks.find(t => t.type === 'room_cleaning');
    if (!task) {
      return { success: false, action: 'clean_room', error: 'No cleaning task' };
    }

    const roomNumber = task.data.roomNumber;
    this.staffState.currentLocation = `room_${roomNumber}`;

    this.emitEvent(EventTypes.ROOM_CLEANING_STARTED, 'housekeeping', {
      roomNumber,
      staffId: this.id,
      staffName: this.name,
    });

    // Simulate cleaning time
    const cleaningTime = task.estimatedMinutes / this.profile.speed;
    await this.wait(cleaningTime);

    // Check for accuracy (might miss something)
    const thoroughClean = Math.random() < this.profile.accuracy;

    // Remove task
    this.staffState.currentTasks = this.staffState.currentTasks.filter(t => t.id !== task.id);
    this.staffState.completedTasks++;
    this.roomsCleanedToday++;

    this.emitEvent(EventTypes.ROOM_CLEANING_COMPLETED, 'housekeeping', {
      roomNumber,
      staffId: this.id,
      staffName: this.name,
      thoroughClean,
      duration: cleaningTime,
    });

    // Update room status via API
    await this.apiCall('PUT', `/api/v1/housekeeping/rooms/${roomNumber}/status`, {
      status: 'clean',
      cleanedBy: this.id,
      inspectionNeeded: true,
    });

    return {
      success: true,
      action: 'clean_room',
      data: { roomNumber, duration: cleaningTime, thoroughClean },
      cascades: [EventTypes.ROOM_CLEANING_COMPLETED],
    };
  }

  private async restockCart(): Promise<{ success: boolean; action: string; data?: any }> {
    this.staffState.currentLocation = 'supply_room';
    await this.wait(10);
    return { success: true, action: 'restock_cart', data: { restocked: true } };
  }

  private async reportIssue(): Promise<{ success: boolean; action: string; data?: any; error?: string; cascades?: string[] }> {
    const issues = ['broken_ac', 'leaky_faucet', 'stained_carpet', 'broken_lamp'];
    const issue = issues[Math.floor(Math.random() * issues.length)];

    const result = await this.apiCall('POST', '/api/v1/maintenance/issues', {
      reportedBy: this.id,
      location: this.staffState.currentLocation,
      issueType: issue,
      priority: 'normal',
    });

    if (result.success) {
      this.emitEvent(EventTypes.ISSUE_REPORTED, 'housekeeping', {
        reportedBy: this.id,
        location: this.staffState.currentLocation,
        issueType: issue,
      });

      return {
        success: true,
        action: 'report_issue',
        data: { issue },
        cascades: [EventTypes.ISSUE_REPORTED],
      };
    }

    return { success: false, action: 'report_issue', error: result.error };
  }
}

/**
 * Kitchen Staff
 * Prepares food orders
 */
export class KitchenStaff extends StaffBot {
  private station: string;

  constructor(config: Omit<StaffConfig, 'department' | 'type' | 'profile' | 'role'> & { 
    profile?: Partial<StaffProfile>;
    station?: string;
    role?: string;
  }) {
    const defaultProfile: StaffProfile = {
      skillLevel: 'mid',
      speed: 1.0,
      accuracy: 0.92,
      multitaskLimit: 4, // Multiple orders at once
      breakPreference: 'flexible',
      escalationThreshold: 8,
    };

    super({
      ...config,
      department: 'kitchen',
      role: config.role || 'line_cook',
      profile: { ...defaultProfile, ...config.profile },
    });

    this.station = config.station || 'main';
  }

  protected subscribeToEvents(): void {
    super.subscribeToEvents();

    // Listen for new orders
    this.eventBus.subscribe(EventTypes.ORDER_PLACED, (event) => {
      const payload = event.payload as { orderId: string; priority?: 'low' | 'normal' | 'high' | 'urgent'; items: any[] };
      if (this.canTakeTask()) {
        const task: Task = {
          id: `cook_${payload.orderId}`,
          type: 'food_preparation',
          priority: payload.priority || 'normal',
          difficulty: 4,
          estimatedMinutes: 15,
          data: { 
            orderId: payload.orderId,
            items: payload.items,
          },
        };
        this.assignTask(task);
      }
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Prepare order
    this.registerAction({
      name: 'prepare_order',
      weight: 10,
      preconditions: () => {
        const cookingTask = this.staffState.currentTasks.find(t => t.type === 'food_preparation');
        return this.staffState.isOnShift && !this.staffState.isOnBreak && !!cookingTask;
      },
      execute: async () => this.prepareOrder(),
    });

    // Prep ingredients
    this.registerAction({
      name: 'prep_ingredients',
      weight: 3,
      cooldown: 30 * 60 * 1000,
      preconditions: () => {
        const hour = this.eventBus.getSimulationTime().getHours();
        return this.staffState.isOnShift && (hour < 11 || hour < 17);
      },
      execute: async () => this.prepIngredients(),
    });

    // 86 an item
    this.registerAction({
      name: '86_item',
      weight: 1,
      preconditions: () => Math.random() < 0.05, // 5% chance
      execute: async () => this.item86(),
    });
  }

  private async prepareOrder(): Promise<{ success: boolean; action: string; data?: any; error?: string; cascades?: string[] }> {
    const task = this.staffState.currentTasks.find(t => t.type === 'food_preparation');
    if (!task) {
      return { success: false, action: 'prepare_order', error: 'No order to prepare' };
    }

    const orderId = task.data.orderId;

    this.emitEvent(EventTypes.ORDER_ITEM_STARTED, 'fb', {
      orderId,
      station: this.station,
      staffId: this.id,
    });

    // Simulate cooking time
    const cookTime = task.estimatedMinutes / this.profile.speed;
    await this.wait(cookTime);

    // Check for accuracy
    const success = Math.random() < this.profile.accuracy;

    if (success) {
      // Remove task
      this.staffState.currentTasks = this.staffState.currentTasks.filter(t => t.id !== task.id);
      this.staffState.completedTasks++;

      this.emitEvent(EventTypes.ORDER_ITEM_READY, 'fb', {
        orderId,
        station: this.station,
        staffId: this.id,
        cookTime,
      });

      // Update order via API
      await this.apiCall('PUT', `/api/v1/orders/${orderId}/status`, {
        status: 'ready',
        preparedBy: this.id,
      });

      return {
        success: true,
        action: 'prepare_order',
        data: { orderId, cookTime },
        cascades: [EventTypes.ORDER_ITEM_READY],
      };
    } else {
      // Dish needs remake
      task.estimatedMinutes = 10;
      return {
        success: false,
        action: 'prepare_order',
        error: 'Dish needs remake',
        data: { orderId },
      };
    }
  }

  private async prepIngredients(): Promise<{ success: boolean; action: string; data?: any }> {
    await this.wait(20);
    return { success: true, action: 'prep_ingredients', data: { prepped: true } };
  }

  private async item86(): Promise<{ success: boolean; action: string; data?: any; cascades?: string[] }> {
    const items = ['lobster', 'special_soup', 'fresh_fish', 'dessert_special'];
    const item = items[Math.floor(Math.random() * items.length)];

    this.emitEvent(EventTypes.ITEM_86D, 'fb', {
      item,
      station: this.station,
      reportedBy: this.id,
    });

    await this.apiCall('POST', '/api/v1/kitchen/86', {
      itemName: item,
      reportedBy: this.id,
    });

    return {
      success: true,
      action: '86_item',
      data: { item },
      cascades: [EventTypes.ITEM_86D],
    };
  }
}

/**
 * Server/Waitstaff
 * Takes orders, delivers food, handles payments
 */
export class ServerStaff extends StaffBot {
  private assignedSection: string;
  private activeTables: string[] = [];

  constructor(config: Omit<StaffConfig, 'department' | 'type' | 'profile' | 'role'> & { 
    profile?: Partial<StaffProfile>;
    section?: string;
    role?: string;
  }) {
    const defaultProfile: StaffProfile = {
      skillLevel: 'mid',
      speed: 1.0,
      accuracy: 0.95,
      multitaskLimit: 5, // Multiple tables
      breakPreference: 'flexible',
      escalationThreshold: 7,
    };

    super({
      ...config,
      department: 'fb_service',
      role: config.role || 'server',
      profile: { ...defaultProfile, ...config.profile },
    });

    this.assignedSection = config.section || 'A';
  }

  protected registerActions(): void {
    super.registerActions();

    // Greet table
    this.registerAction({
      name: 'greet_table',
      weight: 6,
      preconditions: () => this.canTakeTask() && this.hasNewTable(),
      execute: async () => this.greetTable(),
    });

    // Take order
    this.registerAction({
      name: 'take_order',
      weight: 8,
      preconditions: () => this.activeTables.length > 0,
      execute: async () => this.takeOrder(),
    });

    // Deliver food
    this.registerAction({
      name: 'deliver_food',
      weight: 9,
      preconditions: () => this.hasFoodReady(),
      execute: async () => this.deliverFood(),
    });

    // Process payment
    this.registerAction({
      name: 'process_payment',
      weight: 7,
      preconditions: () => this.hasTableWaitingForCheck(),
      execute: async () => this.processPayment(),
    });

    // Clear table
    this.registerAction({
      name: 'clear_table',
      weight: 4,
      preconditions: () => this.hasTableToClear(),
      execute: async () => this.clearTable(),
    });
  }

  private hasNewTable(): boolean {
    return Math.random() > 0.7;
  }

  private hasFoodReady(): boolean {
    return this.activeTables.length > 0 && Math.random() > 0.5;
  }

  private hasTableWaitingForCheck(): boolean {
    return this.activeTables.length > 0 && Math.random() > 0.6;
  }

  private hasTableToClear(): boolean {
    return this.activeTables.length > 0 && Math.random() > 0.7;
  }

  private async greetTable(): Promise<{ success: boolean; action: string; data?: any; cascades?: string[] }> {
    const tableNumber = `${this.assignedSection}${Math.floor(Math.random() * 10) + 1}`;
    this.activeTables.push(tableNumber);

    this.emitEvent(EventTypes.TABLE_SEATED, 'fb', {
      tableNumber,
      serverId: this.id,
      section: this.assignedSection,
    });

    return {
      success: true,
      action: 'greet_table',
      data: { tableNumber },
      cascades: [EventTypes.TABLE_SEATED],
    };
  }

  private async takeOrder(): Promise<{ success: boolean; action: string; data?: any; error?: string }> {
    const tableNumber = this.activeTables[0];
    if (!tableNumber) {
      return { success: false, action: 'take_order', error: 'No active tables' };
    }

    const result = await this.apiCall('POST', '/api/v1/orders', {
      tableNumber,
      serverId: this.id,
      items: [
        { menuItemId: `item_${Math.ceil(Math.random() * 20)}`, quantity: 1 },
      ],
    });

    return {
      success: result.success,
      action: 'take_order',
      data: result.data,
      error: result.error,
    };
  }

  private async deliverFood(): Promise<{ success: boolean; action: string; data?: any; cascades?: string[] }> {
    const tableNumber = this.activeTables[0];

    this.emitEvent(EventTypes.ORDER_DELIVERED, 'fb', {
      tableNumber,
      serverId: this.id,
    });

    return {
      success: true,
      action: 'deliver_food',
      data: { tableNumber },
      cascades: [EventTypes.ORDER_DELIVERED],
    };
  }

  private async processPayment(): Promise<{ success: boolean; action: string; data?: any; error?: string; cascades?: string[] }> {
    const tableNumber = this.activeTables[Math.floor(Math.random() * this.activeTables.length)];

    const result = await this.apiCall('POST', '/api/v1/payments/process', {
      tableNumber,
      serverId: this.id,
      paymentMethod: 'card',
    });

    if (result.success) {
      this.emitEvent(EventTypes.PAYMENT_PROCESSED, 'financial', {
        tableNumber,
        serverId: this.id,
      });

      return {
        success: true,
        action: 'process_payment',
        data: result.data,
        cascades: [EventTypes.PAYMENT_PROCESSED],
      };
    }

    return { success: false, action: 'process_payment', error: result.error };
  }

  private async clearTable(): Promise<{ success: boolean; action: string; data?: any; cascades?: string[] }> {
    const tableNumber = this.activeTables.pop();

    this.emitEvent(EventTypes.TABLE_CLEARED, 'fb', {
      tableNumber,
      serverId: this.id,
    });

    return {
      success: true,
      action: 'clear_table',
      data: { tableNumber },
      cascades: [EventTypes.TABLE_CLEARED],
    };
  }
}

/**
 * Spa Therapist
 * Performs treatments, manages appointments
 */
export class SpaTherapist extends StaffBot {
  private specialties: string[];

  constructor(config: Omit<StaffConfig, 'department' | 'type' | 'profile' | 'role'> & { 
    profile?: Partial<StaffProfile>;
    specialties?: string[];
    role?: string;
  }) {
    const defaultProfile: StaffProfile = {
      skillLevel: 'senior',
      speed: 1.0,
      accuracy: 0.98,
      multitaskLimit: 1, // One client at a time
      breakPreference: 'regular',
      escalationThreshold: 9,
    };

    super({
      ...config,
      department: 'spa',
      role: config.role || 'spa_therapist',
      profile: { ...defaultProfile, ...config.profile },
    });

    this.specialties = config.specialties || ['massage', 'facial'];
  }

  protected subscribeToEvents(): void {
    super.subscribeToEvents();

    // Listen for spa check-ins
    this.eventBus.subscribe(EventTypes.SPA_CHECKED_IN, (event) => {
      const payload = event.payload as { 
        serviceType: string; 
        appointmentId: string; 
        guestId: string; 
        duration?: number 
      };
      if (this.canTakeTask() && this.specialties.includes(payload.serviceType)) {
        const task: Task = {
          id: `treatment_${payload.appointmentId}`,
          type: 'spa_treatment',
          priority: 'normal',
          difficulty: 5,
          estimatedMinutes: payload.duration || 60,
          data: {
            appointmentId: payload.appointmentId,
            guestId: payload.guestId,
            serviceType: payload.serviceType,
          },
        };
        this.assignTask(task);
      }
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Perform treatment
    this.registerAction({
      name: 'perform_treatment',
      weight: 10,
      preconditions: () => {
        const treatmentTask = this.staffState.currentTasks.find(t => t.type === 'spa_treatment');
        return this.staffState.isOnShift && !this.staffState.isOnBreak && !!treatmentTask;
      },
      execute: async () => this.performTreatment(),
    });

    // Prepare room
    this.registerAction({
      name: 'prepare_room',
      weight: 4,
      cooldown: 60 * 60 * 1000,
      preconditions: () => this.staffState.currentTasks.length === 0,
      execute: async () => this.prepareRoom(),
    });
  }

  private async performTreatment(): Promise<{ success: boolean; action: string; data?: any; error?: string; cascades?: string[] }> {
    const task = this.staffState.currentTasks.find(t => t.type === 'spa_treatment');
    if (!task) {
      return { success: false, action: 'perform_treatment', error: 'No treatment scheduled' };
    }

    this.emitEvent(EventTypes.SPA_TREATMENT_STARTED, 'spa', {
      appointmentId: task.data.appointmentId,
      therapistId: this.id,
      serviceType: task.data.serviceType,
    });

    // Simulate treatment time
    await this.wait(task.estimatedMinutes);

    // Remove task
    this.staffState.currentTasks = this.staffState.currentTasks.filter(t => t.id !== task.id);
    this.staffState.completedTasks++;

    this.emitEvent(EventTypes.SPA_TREATMENT_COMPLETED, 'spa', {
      appointmentId: task.data.appointmentId,
      therapistId: this.id,
      duration: task.estimatedMinutes,
    });

    // Update appointment via API
    await this.apiCall('PUT', `/api/v1/spa/appointments/${task.data.appointmentId}`, {
      status: 'completed',
      therapistId: this.id,
    });

    return {
      success: true,
      action: 'perform_treatment',
      data: { appointmentId: task.data.appointmentId },
      cascades: [EventTypes.SPA_TREATMENT_COMPLETED],
    };
  }

  private async prepareRoom(): Promise<{ success: boolean; action: string; data?: any }> {
    await this.wait(10);
    return { success: true, action: 'prepare_room', data: { prepared: true } };
  }
}

// Factory function
export function createStaffBot(
  type: 'front_desk' | 'housekeeping' | 'kitchen' | 'server' | 'spa' | 'host' | 'concierge' | 'pool_attendant',
  config: Omit<StaffConfig, 'department' | 'type' | 'profile' | 'role'> & { 
    profile?: Partial<StaffProfile>; 
    role?: string;
    station?: string;
    section?: string;
    specialties?: string[];
  }
): StaffBot {
  switch (type) {
    case 'front_desk':
      return new FrontDeskAgent(config);
    case 'housekeeping':
      return new HousekeepingStaff(config);
    case 'kitchen':
      return new KitchenStaff(config);
    case 'server':
      return new ServerStaff(config);
    case 'spa':
      return new SpaTherapist(config);
    case 'host':
      return new RestaurantHost(config);
    case 'concierge':
      return new Concierge(config);
    case 'pool_attendant':
      return new PoolAttendant(config);
    default:
      throw new Error(`Unknown staff type: ${type}`);
  }
}

/**
 * MenuService Host
 * Manages reservations, waitlist, and seating
 */
export class RestaurantHost extends StaffBot {
  private waitlist: Array<{ id: string; guestName: string; partySize: number; addedAt: Date }> = [];

  constructor(config: Omit<StaffConfig, 'department' | 'type' | 'profile' | 'role'> & { profile?: Partial<StaffProfile>; role?: string }) {
    const defaultProfile: StaffProfile = {
      skillLevel: 'mid',
      speed: 1.0,
      accuracy: 0.95,
      multitaskLimit: 3,
      breakPreference: 'flexible',
      escalationThreshold: 7,
    };

    super({
      ...config,
      department: 'fb_service',
      role: config.role || 'host',
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected subscribeToEvents(): void {
    super.subscribeToEvents();

    // Listen for waitlist additions
    this.eventBus.subscribe(EventTypes.WAITLIST_JOINED, (event) => {
      const payload = event.payload as { waitlistId: string; guestId: string; partySize: number };
      this.waitlist.push({
        id: payload.waitlistId,
        guestName: payload.guestId,
        partySize: payload.partySize,
        addedAt: this.eventBus.getSimulationTime(),
      });
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Manage reservations
    this.registerAction({
      name: 'check_reservations',
      weight: 6,
      cooldown: 15 * 60 * 1000,
      preconditions: () => this.staffState.isOnShift && !this.staffState.isOnBreak,
      execute: async () => this.checkReservations(),
    });

    // Seat walk-in
    this.registerAction({
      name: 'seat_walkin',
      weight: 5,
      preconditions: () => this.staffState.isOnShift && !this.staffState.isOnBreak && Math.random() > 0.6,
      execute: async () => this.seatWalkin(),
    });

    // Call waitlist
    this.registerAction({
      name: 'call_waitlist',
      weight: 7,
      cooldown: 5 * 60 * 1000,
      preconditions: () => this.staffState.isOnShift && this.waitlist.length > 0,
      execute: async () => this.callWaitlist(),
    });

    // Update estimated wait times
    this.registerAction({
      name: 'update_wait_times',
      weight: 4,
      cooldown: 10 * 60 * 1000,
      preconditions: () => this.staffState.isOnShift && this.waitlist.length > 0,
      execute: async () => this.updateWaitTimes(),
    });

    // Send reservation reminders
    this.registerAction({
      name: 'send_reminders',
      weight: 3,
      cooldown: 30 * 60 * 1000,
      preconditions: () => this.staffState.isOnShift,
      execute: async () => this.sendReminders(),
    });
  }

  private async checkReservations(): Promise<{ success: boolean; action: string; data?: any; error?: string }> {
    const now = this.eventBus.getSimulationTime();
    const result = await this.apiCall<{ reservations: any[] }>(
      'GET',
      `/api/v1/${slug}/reservations?date=${now.toISOString().split('T')[0]}`
    );

    if (result.success && result.data) {
      // Check for upcoming reservations in next 15 minutes
      const upcoming = result.data.reservations.filter((r: any) => {
        const resTime = new Date(r.time);
        return resTime.getTime() - now.getTime() < 15 * 60 * 1000;
      });

      return {
        success: true,
        action: 'check_reservations',
        data: { total: result.data.reservations.length, upcoming: upcoming.length },
      };
    }

    return { success: false, action: 'check_reservations', error: result.error };
  }

  private async seatWalkin(): Promise<{ success: boolean; action: string; data?: any; error?: string; cascades?: string[] }> {
    const partySize = Math.floor(Math.random() * 4) + 1;

    const result = await this.apiCall<{ tableNumber: string }>(
      'POST',
      '/api/v1/${slug}/tables/seat',
      {
        partySize,
        type: 'walk_in',
        seatedBy: this.id,
      }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.TABLE_SEATED, 'menu_service', {
        tableNumber: result.data.tableNumber,
        partySize,
        type: 'walk_in',
        seatedBy: this.id,
      });

      return {
        success: true,
        action: 'seat_walkin',
        data: result.data,
        cascades: [EventTypes.TABLE_SEATED],
      };
    }

    return { success: false, action: 'seat_walkin', error: result.error || 'No tables available' };
  }

  private async callWaitlist(): Promise<{ success: boolean; action: string; data?: any; cascades?: string[] }> {
    if (this.waitlist.length === 0) {
      return { success: false, action: 'call_waitlist', data: { message: 'No one on waitlist' } };
    }

    const next = this.waitlist.shift()!;

    // Check if table is available
    const result = await this.apiCall<{ tableNumber: string }>(
      'POST',
      '/api/v1/${slug}/waitlist/call',
      {
        waitlistId: next.id,
        partySize: next.partySize,
      }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.WAITLIST_CALLED, 'menu_service', {
        waitlistId: next.id,
        guestName: next.guestName,
        tableNumber: result.data.tableNumber,
      });

      return {
        success: true,
        action: 'call_waitlist',
        data: { called: next.guestName, tableNumber: result.data.tableNumber },
        cascades: [EventTypes.WAITLIST_CALLED],
      };
    }

    // Put back on waitlist if no table
    this.waitlist.unshift(next);
    return { success: false, action: 'call_waitlist', data: { message: 'No tables available' } };
  }

  private async updateWaitTimes(): Promise<{ success: boolean; action: string; data?: any }> {
    const baseWait = 15; // minutes
    
    for (let i = 0; i < this.waitlist.length; i++) {
      const entry = this.waitlist[i];
      const estimatedWait = baseWait * (i + 1);
      
      await this.apiCall('PUT', `/api/v1/${slug}/waitlist/${entry.id}`, {
        estimatedWait,
      });
    }

    return {
      success: true,
      action: 'update_wait_times',
      data: { updated: this.waitlist.length },
    };
  }

  private async sendReminders(): Promise<{ success: boolean; action: string; data?: any }> {
    const result = await this.apiCall<{ sent: number }>(
      'POST',
      '/api/v1/${slug}/reservations/send-reminders',
      {
        hoursAhead: 2,
      }
    );

    return {
      success: result.success,
      action: 'send_reminders',
      data: result.data,
    };
  }
}

/**
 * Concierge
 * Handles guest requests, recommendations, bookings
 */
export class Concierge extends StaffBot {
  constructor(config: Omit<StaffConfig, 'department' | 'type' | 'profile' | 'role'> & { profile?: Partial<StaffProfile>; role?: string }) {
    const defaultProfile: StaffProfile = {
      skillLevel: 'senior',
      speed: 1.0,
      accuracy: 0.95,
      multitaskLimit: 4,
      breakPreference: 'flexible',
      escalationThreshold: 8,
    };

    super({
      ...config,
      department: 'concierge',
      role: config.role || 'concierge',
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected subscribeToEvents(): void {
    super.subscribeToEvents();

    // Listen for guest messages
    this.eventBus.subscribe(EventTypes.GUEST_MESSAGE_SENT, (event) => {
      const payload = event.payload as { guestId: string; messageType: string; conversationId: string };
      if (this.canTakeTask()) {
        const task: Task = {
          id: `msg_${payload.conversationId}`,
          type: 'guest_message',
          priority: 'high',
          difficulty: 3,
          estimatedMinutes: 5,
          data: {
            guestId: payload.guestId,
            conversationId: payload.conversationId,
            messageType: payload.messageType,
          },
        };
        this.assignTask(task);
      }
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Respond to messages
    this.registerAction({
      name: 'respond_to_message',
      weight: 9,
      preconditions: () => {
        const msgTask = this.staffState.currentTasks.find(t => t.type === 'guest_message');
        return this.staffState.isOnShift && !this.staffState.isOnBreak && !!msgTask;
      },
      execute: async () => this.respondToMessage(),
    });

    // Make external booking
    this.registerAction({
      name: 'make_external_booking',
      weight: 5,
      preconditions: () => this.staffState.isOnShift && !this.staffState.isOnBreak && Math.random() > 0.7,
      execute: async () => this.makeExternalBooking(),
    });

    // Handle special request
    this.registerAction({
      name: 'handle_special_request',
      weight: 6,
      preconditions: () => this.staffState.isOnShift && !this.staffState.isOnBreak,
      execute: async () => this.handleSpecialRequest(),
    });

    // Update local recommendations
    this.registerAction({
      name: 'update_recommendations',
      weight: 2,
      cooldown: 4 * 60 * 60 * 1000,
      preconditions: () => this.staffState.isOnShift,
      execute: async () => this.updateRecommendations(),
    });
  }

  private async respondToMessage(): Promise<{ success: boolean; action: string; data?: any; error?: string; cascades?: string[] }> {
    const task = this.staffState.currentTasks.find(t => t.type === 'guest_message');
    if (!task) {
      return { success: false, action: 'respond_to_message', error: 'No message task' };
    }

    const responses: Record<string, string> = {
      request: 'I will arrange that for you right away.',
      question: 'Great question! Let me provide you with that information.',
      feedback: 'Thank you for your feedback, we appreciate it!',
      complaint: 'I sincerely apologize. Let me address this immediately.',
    };

    const response = responses[task.data.messageType] || 'How may I assist you further?';

    const result = await this.apiCall<{ messageId: string }>(
      'POST',
      `/api/v1/messaging/conversations/${task.data.conversationId}/reply`,
      {
        staffId: this.id,
        message: response,
      }
    );

    if (result.success) {
      this.staffState.currentTasks = this.staffState.currentTasks.filter(t => t.id !== task.id);
      this.staffState.completedTasks++;

      this.emitEvent(EventTypes.STAFF_MESSAGE_SENT, 'messaging', {
        conversationId: task.data.conversationId,
        staffId: this.id,
        guestId: task.data.guestId,
      });

      return {
        success: true,
        action: 'respond_to_message',
        data: result.data,
        cascades: [EventTypes.STAFF_MESSAGE_SENT],
      };
    }

    return { success: false, action: 'respond_to_message', error: result.error };
  }

  private async makeExternalBooking(): Promise<{ success: boolean; action: string; data?: any }> {
    const bookingTypes = ['menu_service', 'tour', 'transportation', 'theater', 'spa_external'];
    const type = bookingTypes[Math.floor(Math.random() * bookingTypes.length)];

    const result = await this.apiCall<{ bookingId: string }>(
      'POST',
      '/api/v1/concierge/external-bookings',
      {
        type,
        guestId: `guest_${Math.floor(Math.random() * 100)}`,
        date: this.eventBus.getSimulationTime().toISOString(),
        notes: 'Simulation booking',
        bookedBy: this.id,
      }
    );

    return {
      success: result.success,
      action: 'make_external_booking',
      data: { type, ...result.data },
    };
  }

  private async handleSpecialRequest(): Promise<{ success: boolean; action: string; data?: any }> {
    const requests = ['flowers', 'champagne', 'birthday_setup', 'anniversary_package', 'late_checkout'];
    const request = requests[Math.floor(Math.random() * requests.length)];

    const result = await this.apiCall<{ requestId: string }>(
      'POST',
      '/api/v1/concierge/special-requests',
      {
        type: request,
        guestId: `guest_${Math.floor(Math.random() * 100)}`,
        handledBy: this.id,
      }
    );

    return {
      success: result.success,
      action: 'handle_special_request',
      data: { request, ...result.data },
    };
  }

  private async updateRecommendations(): Promise<{ success: boolean; action: string; data?: any }> {
    await this.apiCall('POST', '/api/v1/concierge/recommendations/refresh');
    return { success: true, action: 'update_recommendations', data: { refreshed: true } };
  }
}

/**
 * Pool Attendant
 * Manages pool access, bracelets, towels, safety
 */
export class PoolAttendant extends StaffBot {
  private currentCapacity = 0;
  private maxCapacity = 100;

  constructor(config: Omit<StaffConfig, 'department' | 'type' | 'profile' | 'role'> & { profile?: Partial<StaffProfile>; role?: string }) {
    const defaultProfile: StaffProfile = {
      skillLevel: 'mid',
      speed: 1.0,
      accuracy: 0.95,
      multitaskLimit: 5,
      breakPreference: 'flexible',
      escalationThreshold: 7,
    };

    super({
      ...config,
      department: 'spa', // Pool often under spa department
      role: config.role || 'pool_attendant',
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected subscribeToEvents(): void {
    super.subscribeToEvents();

    // Track bracelet issues
    this.eventBus.subscribe(EventTypes.CAPACITY_ACCESS_ISSUED, () => {
      this.currentCapacity++;
      if (this.currentCapacity > this.maxCapacity * 0.9) {
        this.emitEvent(EventTypes.POOL_CAPACITY_ALERT, 'capacity', {
          currentCapacity: this.currentCapacity,
          maxCapacity: this.maxCapacity,
        });
      }
    });

    this.eventBus.subscribe(EventTypes.POOL_BRACELET_RETURNED, () => {
      this.currentCapacity = Math.max(0, this.currentCapacity - 1);
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Issue bracelet
    this.registerAction({
      name: 'issue_bracelet',
      weight: 8,
      preconditions: () => 
        this.staffState.isOnShift && 
        !this.staffState.isOnBreak && 
        this.currentCapacity < this.maxCapacity,
      execute: async () => this.issueBracelet(),
    });

    // Collect bracelet
    this.registerAction({
      name: 'collect_bracelet',
      weight: 7,
      preconditions: () => this.staffState.isOnShift && !this.staffState.isOnBreak,
      execute: async () => this.collectBracelet(),
    });

    // Restock towels
    this.registerAction({
      name: 'restock_towels',
      weight: 4,
      cooldown: 30 * 60 * 1000,
      preconditions: () => this.staffState.isOnShift,
      execute: async () => this.restockTowels(),
    });

    // Monitor safety
    this.registerAction({
      name: 'safety_check',
      weight: 6,
      cooldown: 15 * 60 * 1000,
      preconditions: () => this.staffState.isOnShift,
      execute: async () => this.safetyCheck(),
    });

    // Check water quality
    this.registerAction({
      name: 'water_quality_check',
      weight: 3,
      cooldown: 60 * 60 * 1000,
      preconditions: () => this.staffState.isOnShift,
      execute: async () => this.waterQualityCheck(),
    });

    // Manage locker assignments
    this.registerAction({
      name: 'manage_lockers',
      weight: 2,
      cooldown: 30 * 60 * 1000,
      preconditions: () => this.staffState.isOnShift,
      execute: async () => this.manageLockers(),
    });
  }

  private async issueBracelet(): Promise<{ success: boolean; action: string; data?: any; error?: string; cascades?: string[] }> {
    const result = await this.apiCall<{ braceletId: string; lockerNumber: number }>(
      'POST',
      '/api/v1/pool/bracelets/issue',
      {
        issuedBy: this.id,
        guestId: `guest_${Math.floor(Math.random() * 100)}`,
      }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.CAPACITY_ACCESS_ISSUED, 'capacity', {
        braceletId: result.data.braceletId,
        lockerNumber: result.data.lockerNumber,
        issuedBy: this.id,
      });

      return {
        success: true,
        action: 'issue_bracelet',
        data: result.data,
        cascades: [EventTypes.CAPACITY_ACCESS_ISSUED],
      };
    }

    return { success: false, action: 'issue_bracelet', error: result.error };
  }

  private async collectBracelet(): Promise<{ success: boolean; action: string; data?: any; cascades?: string[] }> {
    const result = await this.apiCall<{ returned: boolean }>(
      'POST',
      '/api/v1/pool/bracelets/collect',
      {
        collectedBy: this.id,
      }
    );

    if (result.success) {
      this.emitEvent(EventTypes.POOL_BRACELET_RETURNED, 'capacity', {
        collectedBy: this.id,
      });

      return {
        success: true,
        action: 'collect_bracelet',
        data: result.data,
        cascades: [EventTypes.POOL_BRACELET_RETURNED],
      };
    }

    return { success: false, action: 'collect_bracelet', data: { message: 'No bracelets to collect' } };
  }

  private async restockTowels(): Promise<{ success: boolean; action: string; data?: any }> {
    await this.apiCall('POST', '/api/v1/pool/towels/restock', {
      quantity: 50,
      restockedBy: this.id,
    });

    return { success: true, action: 'restock_towels', data: { restocked: 50 } };
  }

  private async safetyCheck(): Promise<{ success: boolean; action: string; data?: any }> {
    const result = await this.apiCall<{ issues: any[] }>(
      'POST',
      '/api/v1/pool/safety-check',
      {
        checkedBy: this.id,
        areas: ['main_pool', 'kids_pool', 'hot_tub', 'deck'],
      }
    );

    return {
      success: result.success,
      action: 'safety_check',
      data: { issuesFound: result.data?.issues?.length || 0 },
    };
  }

  private async waterQualityCheck(): Promise<{ success: boolean; action: string; data?: any }> {
    const result = await this.apiCall<{ ph: number; chlorine: number; temperature: number }>(
      'POST',
      '/api/v1/pool/water-quality',
      {
        checkedBy: this.id,
      }
    );

    if (result.success && result.data) {
      const isGood = result.data.ph >= 7.2 && result.data.ph <= 7.6 && 
                     result.data.chlorine >= 1 && result.data.chlorine <= 3;

      if (!isGood) {
        this.emitEvent(EventTypes.ALERT_TRIGGERED, 'capacity', {
          type: 'water_quality_issue',
          system: 'capacity',
          readings: result.data,
        });
      }

      return {
        success: true,
        action: 'water_quality_check',
        data: { ...result.data, isGood },
      };
    }

    return { success: false, action: 'water_quality_check', data: result.data };
  }

  private async manageLockers(): Promise<{ success: boolean; action: string; data?: any }> {
    const result = await this.apiCall<{ available: number; inUse: number }>(
      'GET',
      '/api/v1/pool/lockers/status'
    );

    return {
      success: result.success,
      action: 'manage_lockers',
      data: result.data,
    };
  }
}

/**
 * AccommodationUnit Staff
 * Handles accommodation unit check-ins, check-outs, maintenance
 */
export class ChaletStaff extends StaffBot {
  constructor(config: Omit<StaffConfig, 'department' | 'type' | 'profile' | 'role'> & { profile?: Partial<StaffProfile>; role?: string }) {
    const defaultProfile: StaffProfile = {
      skillLevel: 'mid',
      speed: 0.9,
      accuracy: 0.92,
      multitaskLimit: 2,
      breakPreference: 'scheduled',
      escalationThreshold: 6,
    };

    super({
      ...config,
      department: 'accommodation_units',
      role: config.role || 'chalet_attendant',
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Process accommodation unit check-in
    this.registerAction({
      name: 'process_chalet_checkin',
      weight: 8,
      preconditions: () => this.canTakeTask() && this.hasPendingChaletCheckin(),
      execute: async () => this.processChaletCheckIn(),
    });

    // Process accommodation unit check-out
    this.registerAction({
      name: 'process_chalet_checkout',
      weight: 8,
      preconditions: () => this.canTakeTask() && this.hasPendingChaletCheckout(),
      execute: async () => this.processChaletCheckOut(),
    });

    // Prepare accommodation unit
    this.registerAction({
      name: 'prepare_chalet',
      weight: 6,
      preconditions: () => this.canTakeTask(),
      execute: async () => this.prepareChalet(),
    });

    // Inspect accommodation unit
    this.registerAction({
      name: 'inspect_chalet',
      weight: 5,
      preconditions: () => this.canTakeTask(),
      execute: async () => this.inspectChalet(),
    });

    // Deliver add-ons
    this.registerAction({
      name: 'deliver_chalet_addon',
      weight: 4,
      preconditions: () => this.canTakeTask() && this.hasPendingAddOnDelivery(),
      execute: async () => this.deliverChaletAddOn(),
    });

    // Handle accommodation unit maintenance request
    this.registerAction({
      name: 'handle_chalet_maintenance',
      weight: 5,
      preconditions: () => this.canTakeTask(),
      execute: async () => this.handleChaletMaintenance(),
    });
  }

  private hasPendingChaletCheckin(): boolean {
    return Math.random() > 0.6;
  }

  private hasPendingChaletCheckout(): boolean {
    return Math.random() > 0.7;
  }

  private hasPendingAddOnDelivery(): boolean {
    return Math.random() > 0.8;
  }

  private async processChaletCheckIn(): Promise<{ success: boolean; action: string; data?: any; error?: string; cascades?: string[] }> {
    const result = await this.apiCall<{ bookingId: string; unitId: string }>(
      'POST',
      '/api/v1/units/bookings/check-in',
      {
        staffId: this.id,
      }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.ACCOMMODATION_UNIT_CHECKED_IN, 'accommodation unit', {
        staffId: this.id,
        bookingId: result.data.bookingId,
        unitId: result.data.unitId,
      });

      return {
        success: true,
        action: 'process_chalet_checkin',
        data: result.data,
        cascades: [EventTypes.ACCOMMODATION_UNIT_CHECKED_IN],
      };
    }

    return { success: false, action: 'process_chalet_checkin', error: result.error };
  }

  private async processChaletCheckOut(): Promise<{ success: boolean; action: string; data?: any; error?: string; cascades?: string[] }> {
    const result = await this.apiCall<{ bookingId: string; unitId: string; damageCharges?: number }>(
      'POST',
      '/api/v1/units/bookings/check-out',
      {
        staffId: this.id,
      }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.ACCOMMODATION_UNIT_CHECKED_OUT, 'accommodation unit', {
        staffId: this.id,
        bookingId: result.data.bookingId,
        unitId: result.data.unitId,
        damageCharges: result.data.damageCharges,
      });

      return {
        success: true,
        action: 'process_chalet_checkout',
        data: result.data,
        cascades: [EventTypes.ACCOMMODATION_UNIT_CHECKED_OUT],
      };
    }

    return { success: false, action: 'process_chalet_checkout', error: result.error };
  }

  private async prepareChalet(): Promise<{ success: boolean; action: string; data?: any }> {
    const result = await this.apiCall<{ unitId: string; prepared: boolean }>(
      'POST',
      '/api/v1/units/prepare',
      {
        preparedBy: this.id,
        checklist: ['clean', 'linens', 'amenities', 'bbq_check', 'inventory'],
      }
    );

    return {
      success: result.success,
      action: 'prepare_chalet',
      data: result.data,
    };
  }

  private async inspectChalet(): Promise<{ success: boolean; action: string; data?: any }> {
    const result = await this.apiCall<{ unitId: string; issues: any[]; passed: boolean }>(
      'POST',
      '/api/v1/units/inspect',
      {
        inspectedBy: this.id,
        areas: ['interior', 'exterior', 'kitchen', 'bathroom', 'deck'],
      }
    );

    if (result.success && result.data && !result.data.passed) {
      this.emitEvent(EventTypes.ISSUE_REPORTED, 'accommodation unit', {
        type: 'chalet_inspection_failed',
        unitId: result.data.unitId,
        issues: result.data.issues,
        reportedBy: this.id,
      });
    }

    return {
      success: result.success,
      action: 'inspect_chalet',
      data: result.data,
    };
  }

  private async deliverChaletAddOn(): Promise<{ success: boolean; action: string; data?: any; cascades?: string[] }> {
    const result = await this.apiCall<{ deliveryId: string; addOnType: string; unitId: string }>(
      'POST',
      '/api/v1/units/add-ons/deliver',
      {
        deliveredBy: this.id,
      }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.CHALET_ADD_ON_PURCHASED, 'accommodation unit', {
        deliveryId: result.data.deliveryId,
        addOnType: result.data.addOnType,
        unitId: result.data.unitId,
        deliveredBy: this.id,
      });

      return {
        success: true,
        action: 'deliver_chalet_addon',
        data: result.data,
        cascades: [EventTypes.CHALET_ADD_ON_PURCHASED],
      };
    }

    return { success: false, action: 'deliver_chalet_addon', data: { message: 'No add-ons to deliver' } };
  }

  private async handleChaletMaintenance(): Promise<{ success: boolean; action: string; data?: any }> {
    const result = await this.apiCall<{ maintenanceId: string; unitId: string; issue: string; resolved: boolean }>(
      'POST',
      '/api/v1/units/maintenance/handle',
      {
        handledBy: this.id,
      }
    );

    return {
      success: result.success,
      action: 'handle_chalet_maintenance',
      data: result.data,
    };
  }
}

/**
 * KioskItem Bar Staff
 * Handles kiosk orders, preparation, and delivery
 */
export class SnackBarStaff extends StaffBot {
  constructor(config: Omit<StaffConfig, 'department' | 'type' | 'profile' | 'role'> & { profile?: Partial<StaffProfile>; role?: string }) {
    const defaultProfile: StaffProfile = {
      skillLevel: 'mid',
      speed: 1.2,
      accuracy: 0.90,
      multitaskLimit: 4,
      breakPreference: 'flexible',
      escalationThreshold: 5,
    };

    super({
      ...config,
      department: 'fb',
      role: config.role || 'snack_bar_attendant',
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Take kiosk item order
    this.registerAction({
      name: 'take_snack_order',
      weight: 7,
      preconditions: () => this.canTakeTask() && this.hasWaitingCustomer(),
      execute: async () => this.takeSnackOrder(),
    });

    // Prepare kiosk item order
    this.registerAction({
      name: 'prepare_snack_order',
      weight: 8,
      preconditions: () => this.canTakeTask() && this.hasPendingOrder(),
      execute: async () => this.prepareSnackOrder(),
    });

    // Deliver kiosk item order
    this.registerAction({
      name: 'deliver_snack_order',
      weight: 6,
      preconditions: () => this.canTakeTask() && this.hasReadyOrder(),
      execute: async () => this.deliverSnackOrder(),
    });

    // Restock items
    this.registerAction({
      name: 'restock_snack_items',
      weight: 3,
      cooldown: 60 * 60 * 1000,
      preconditions: () => this.canTakeTask(),
      execute: async () => this.restockSnackItems(),
    });

    // Check inventory
    this.registerAction({
      name: 'check_snack_inventory',
      weight: 2,
      cooldown: 2 * 60 * 60 * 1000,
      preconditions: () => this.canTakeTask(),
      execute: async () => this.checkSnackInventory(),
    });
  }

  private hasWaitingCustomer(): boolean {
    return Math.random() > 0.4;
  }

  private hasPendingOrder(): boolean {
    return Math.random() > 0.3;
  }

  private hasReadyOrder(): boolean {
    return Math.random() > 0.5;
  }

  private async takeSnackOrder(): Promise<{ success: boolean; action: string; data?: any; error?: string }> {
    const result = await this.apiCall<{ orderId: string; items: number }>(
      'POST',
      '/api/v1/kiosk item/orders/take',
      {
        staffId: this.id,
      }
    );

    return {
      success: result.success,
      action: 'take_snack_order',
      data: result.data,
      error: result.error,
    };
  }

  private async prepareSnackOrder(): Promise<{ success: boolean; action: string; data?: any; cascades?: string[] }> {
    const result = await this.apiCall<{ orderId: string; items: any[]; estimatedTime: number }>(
      'POST',
      '/api/v1/kiosk item/orders/prepare',
      {
        preparedBy: this.id,
      }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.KIOSK_ORDER_PREPARED, 'kiosk item', {
        orderId: result.data.orderId,
        preparedBy: this.id,
        itemCount: result.data.items?.length || 0,
      });

      return {
        success: true,
        action: 'prepare_snack_order',
        data: result.data,
        cascades: [EventTypes.KIOSK_ORDER_PREPARED],
      };
    }

    return { success: false, action: 'prepare_snack_order', data: { message: 'No orders to prepare' } };
  }

  private async deliverSnackOrder(): Promise<{ success: boolean; action: string; data?: any; cascades?: string[] }> {
    const result = await this.apiCall<{ orderId: string; deliveredTo: string; deliveryLocation: string }>(
      'POST',
      '/api/v1/kiosk item/orders/deliver',
      {
        deliveredBy: this.id,
      }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.KIOSK_ORDER_DELIVERED, 'kiosk item', {
        orderId: result.data.orderId,
        deliveredTo: result.data.deliveredTo,
        deliveryLocation: result.data.deliveryLocation,
        deliveredBy: this.id,
      });

      return {
        success: true,
        action: 'deliver_snack_order',
        data: result.data,
        cascades: [EventTypes.KIOSK_ORDER_DELIVERED],
      };
    }

    return { success: false, action: 'deliver_snack_order', data: { message: 'No orders ready for delivery' } };
  }

  private async restockSnackItems(): Promise<{ success: boolean; action: string; data?: any }> {
    const result = await this.apiCall<{ itemsRestocked: number }>(
      'POST',
      '/api/v1/kiosk item/inventory/restock',
      {
        restockedBy: this.id,
        items: ['hot_dogs', 'buns', 'drinks', 'chips', 'ice_cream'],
      }
    );

    return {
      success: result.success,
      action: 'restock_snack_items',
      data: result.data,
    };
  }

  private async checkSnackInventory(): Promise<{ success: boolean; action: string; data?: any }> {
    const result = await this.apiCall<{ items: Array<{ name: string; stock: number; lowStock: boolean }> }>(
      'GET',
      '/api/v1/kiosk item/inventory'
    );

    if (result.success && result.data) {
      const lowStockItems = result.data.items.filter(i => i.lowStock);
      
      if (lowStockItems.length > 0) {
        this.emitEvent(EventTypes.ALERT_TRIGGERED, 'kiosk item', {
          type: 'low_inventory',
          system: 'kiosk item',
          items: lowStockItems,
        });
      }

      return {
        success: true,
        action: 'check_snack_inventory',
        data: {
          totalItems: result.data.items.length,
          lowStockCount: lowStockItems.length,
        },
      };
    }

    return { success: false, action: 'check_snack_inventory', data: result.data };
  }
}