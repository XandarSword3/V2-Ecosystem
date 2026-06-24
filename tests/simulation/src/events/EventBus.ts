/**
 * Event Bus - Central nervous system of the simulation
 * Handles all inter-actor and system communication
 */

import { EventEmitter } from 'events';

export type EventSeverity = 'info' | 'warning' | 'error' | 'critical';
export type EventCategory = 
  | 'guest_lifecycle' 
  | 'booking' 
  | 'checkin' 
  | 'checkout'
  | 'fb' 
  | 'menu_service'
  | 'housekeeping' 
  | 'spa'
  | 'capacity'
  | 'financial' 
  | 'billing'
  | 'loyalty'
  | 'giftcards'
  | 'coupons'
  | 'messaging'
  | 'reviews'
  | 'support'
  | 'mobile-checkin'
  | 'kiosk'
  | 'gdpr'
  | 'marketing'
  | 'channels'
  | 'groups'
  | 'accommodation unit'
  | 'kiosk item'
  | 'promotion'
  | 'pos'
  | 'staff' 
  | 'manager' 
  | 'admin'
  | 'system'
  | 'assertion';

export interface SimulationEvent<T = any> {
  id: string;
  type: string;
  category: EventCategory;
  timestamp: Date;
  simulationTime: Date;
  payload: T;
  source: string;
  correlationId?: string;
  severity?: EventSeverity;
}

export interface EventHandler<T = any> {
  (event: SimulationEvent<T>): void | Promise<void>;
}

export interface EventFilter {
  types?: string[];
  categories?: EventCategory[];
  sources?: string[];
  severities?: EventSeverity[];
}

export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private eventLog: SimulationEvent[] = [];
  private maxLogSize = 10000;
  private simulationTime: Date = new Date();
  private eventCounter = 0;

  private constructor() {
    super();
    this.setMaxListeners(100); // Allow many actors to listen
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  static resetInstance(): void {
    if (EventBus.instance) {
      EventBus.instance.removeAllListeners();
      EventBus.instance.eventLog = [];
    }
    EventBus.instance = new EventBus();
  }

  setSimulationTime(time: Date): void {
    this.simulationTime = time;
  }

  getSimulationTime(): Date {
    return this.simulationTime;
  }

  /**
   * Emit a simulation event
   */
  emitEvent<T>(
    type: string,
    category: EventCategory,
    payload: T,
    source: string,
    options?: {
      correlationId?: string;
      severity?: EventSeverity;
    }
  ): SimulationEvent<T> {
    const event: SimulationEvent<T> = {
      id: `evt_${++this.eventCounter}_${Date.now()}`,
      type,
      category,
      timestamp: new Date(),
      simulationTime: new Date(this.simulationTime),
      payload,
      source,
      correlationId: options?.correlationId,
      severity: options?.severity || 'info',
    };

    // Log the event
    this.logEvent(event);

    // Emit to all listeners of this type
    this.emit(type, event);

    // Emit to category listeners
    this.emit(`category:${category}`, event);

    // Emit to global listeners
    this.emit('*', event);

    return event;
  }

  /**
   * Subscribe to specific event types
   */
  subscribe<T>(type: string, handler: EventHandler<T>): () => void {
    this.on(type, handler);
    return () => this.off(type, handler);
  }

  /**
   * Subscribe to all events in a category
   */
  subscribeToCategory(category: EventCategory, handler: EventHandler): () => void {
    const categoryEvent = `category:${category}`;
    this.on(categoryEvent, handler);
    return () => this.off(categoryEvent, handler);
  }

  /**
   * Subscribe to all events
   */
  subscribeToAll(handler: EventHandler): () => void {
    this.on('*', handler);
    return () => this.off('*', handler);
  }

  /**
   * Subscribe with filter
   */
  subscribeWithFilter(filter: EventFilter, handler: EventHandler): () => void {
    const filteredHandler = (event: SimulationEvent) => {
      if (filter.types && !filter.types.includes(event.type)) return;
      if (filter.categories && !filter.categories.includes(event.category)) return;
      if (filter.sources && !filter.sources.includes(event.source)) return;
      if (filter.severities && event.severity && !filter.severities.includes(event.severity)) return;
      handler(event);
    };
    this.on('*', filteredHandler);
    return () => this.off('*', filteredHandler);
  }

  private logEvent(event: SimulationEvent): void {
    this.eventLog.push(event);
    
    // Trim log if too large
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize / 2);
    }
  }

  /**
   * Get event history
   */
  getEventLog(filter?: EventFilter): SimulationEvent[] {
    if (!filter) return [...this.eventLog];

    return this.eventLog.filter(event => {
      if (filter.types && !filter.types.includes(event.type)) return false;
      if (filter.categories && !filter.categories.includes(event.category)) return false;
      if (filter.sources && !filter.sources.includes(event.source)) return false;
      if (filter.severities && event.severity && !filter.severities.includes(event.severity)) return false;
      return true;
    });
  }

  /**
   * Get events since a timestamp
   */
  getEventsSince(timestamp: Date): SimulationEvent[] {
    return this.eventLog.filter(e => e.timestamp >= timestamp);
  }

  /**
   * Get events by correlation ID (for tracking cascades)
   */
  getCorrelatedEvents(correlationId: string): SimulationEvent[] {
    return this.eventLog.filter(e => e.correlationId === correlationId);
  }

  /**
   * Clear event log
   */
  clearLog(): void {
    this.eventLog = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalEvents: number;
    eventsByCategory: Record<string, number>;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
  } {
    const stats = {
      totalEvents: this.eventLog.length,
      eventsByCategory: {} as Record<string, number>,
      eventsByType: {} as Record<string, number>,
      eventsBySeverity: {} as Record<string, number>,
    };

    for (const event of this.eventLog) {
      stats.eventsByCategory[event.category] = (stats.eventsByCategory[event.category] || 0) + 1;
      stats.eventsByType[event.type] = (stats.eventsByType[event.type] || 0) + 1;
      if (event.severity) {
        stats.eventsBySeverity[event.severity] = (stats.eventsBySeverity[event.severity] || 0) + 1;
      }
    }

    return stats;
  }
}

// Event type constants
export const EventTypes = {
  // Guest Lifecycle
  GUEST_ARRIVED: 'GUEST_ARRIVED',
  GUEST_CHECK_IN_STARTED: 'GUEST_CHECK_IN_STARTED',
  GUEST_CHECK_IN_COMPLETED: 'GUEST_CHECK_IN_COMPLETED',
  GUEST_CHECK_OUT_STARTED: 'GUEST_CHECK_OUT_STARTED',
  GUEST_CHECK_OUT_COMPLETED: 'GUEST_CHECK_OUT_COMPLETED',
  
  // Booking
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_MODIFIED: 'BOOKING_MODIFIED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  
  // F&B
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_ACCEPTED: 'ORDER_ACCEPTED',
  ORDER_ITEM_STARTED: 'ORDER_ITEM_STARTED',
  ORDER_ITEM_READY: 'ORDER_ITEM_READY',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  ORDER_PAID: 'ORDER_PAID',
  TABLE_SEATED: 'TABLE_SEATED',
  TABLE_CLEARED: 'TABLE_CLEARED',
  ITEM_86D: 'ITEM_86D',
  
  // MenuService Reservations & Waitlist
  MENU_RESERVATION_MADE: 'MENU_RESERVATION_MADE',
  RESTAURANT_RESERVATION_CANCELLED: 'RESTAURANT_RESERVATION_CANCELLED',
  WAITLIST_JOINED: 'WAITLIST_JOINED',
  WAITLIST_CALLED: 'WAITLIST_CALLED',
  WAITLIST_SEATED: 'WAITLIST_SEATED',
  WAITLIST_EXPIRED: 'WAITLIST_EXPIRED',
  
  // Housekeeping
  ROOM_MARKED_DIRTY: 'ROOM_MARKED_DIRTY',
  ROOM_CLEANING_STARTED: 'ROOM_CLEANING_STARTED',
  ROOM_CLEANING_COMPLETED: 'ROOM_CLEANING_COMPLETED',
  ROOM_INSPECTED: 'ROOM_INSPECTED',
  ISSUE_REPORTED: 'ISSUE_REPORTED',
  
  // Spa
  SPA_BOOKED: 'SPA_BOOKED',
  SPA_CHECKED_IN: 'SPA_CHECKED_IN',
  SPA_TREATMENT_STARTED: 'SPA_TREATMENT_STARTED',
  SPA_TREATMENT_COMPLETED: 'SPA_TREATMENT_COMPLETED',
  
  // Pool
  POOL_TICKET_PURCHASED: 'POOL_TICKET_PURCHASED',
  CAPACITY_ACCESS_ISSUED: 'CAPACITY_ACCESS_ISSUED',
  POOL_BRACELET_RETURNED: 'POOL_BRACELET_RETURNED',
  POOL_CAPACITY_ALERT: 'POOL_CAPACITY_ALERT',
  
  // Financial
  PAYMENT_PROCESSED: 'PAYMENT_PROCESSED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  REFUND_ISSUED: 'REFUND_ISSUED',
  CHARGE_POSTED: 'CHARGE_POSTED',
  CHARGE_DISPUTED: 'CHARGE_DISPUTED',
  INVOICE_GENERATED: 'INVOICE_GENERATED',
  
  // Loyalty
  LOYALTY_POINTS_EARNED: 'LOYALTY_POINTS_EARNED',
  LOYALTY_POINTS_REDEEMED: 'LOYALTY_POINTS_REDEEMED',
  LOYALTY_TIER_CHANGED: 'LOYALTY_TIER_CHANGED',
  
  // Gift Cards
  GIFT_CARD_PURCHASED: 'GIFT_CARD_PURCHASED',
  GIFT_CARD_REDEEMED: 'GIFT_CARD_REDEEMED',
  GIFT_CARD_BALANCE_CHECKED: 'GIFT_CARD_BALANCE_CHECKED',
  
  // Coupons
  COUPON_APPLIED: 'COUPON_APPLIED',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  
  // Messaging
  GUEST_MESSAGE_SENT: 'GUEST_MESSAGE_SENT',
  STAFF_MESSAGE_SENT: 'STAFF_MESSAGE_SENT',
  MESSAGE_READ: 'MESSAGE_READ',
  
  // Reviews
  REVIEW_SUBMITTED: 'REVIEW_SUBMITTED',
  REVIEW_RESPONDED: 'REVIEW_RESPONDED',
  
  // Support Tickets
  SUPPORT_TICKET_CREATED: 'SUPPORT_TICKET_CREATED',
  SUPPORT_TICKET_UPDATED: 'SUPPORT_TICKET_UPDATED',
  SUPPORT_TICKET_RESOLVED: 'SUPPORT_TICKET_RESOLVED',
  
  // Mobile Check-in
  MOBILE_CHECKIN_STARTED: 'MOBILE_CHECKIN_STARTED',
  MOBILE_CHECKIN_DOCUMENT_UPLOADED: 'MOBILE_CHECKIN_DOCUMENT_UPLOADED',
  MOBILE_CHECKIN_COMPLETED: 'MOBILE_CHECKIN_COMPLETED',
  
  // Kiosk
  KIOSK_SESSION_STARTED: 'KIOSK_SESSION_STARTED',
  KIOSK_CHECKIN_COMPLETED: 'KIOSK_CHECKIN_COMPLETED',
  KIOSK_KEY_ENCODED: 'KIOSK_KEY_ENCODED',
  KIOSK_PAYMENT_PROCESSED: 'KIOSK_PAYMENT_PROCESSED',
  KIOSK_ERROR: 'KIOSK_ERROR',
  
  // GDPR
  GDPR_DATA_EXPORT_REQUESTED: 'GDPR_DATA_EXPORT_REQUESTED',
  GDPR_DATA_EXPORT_COMPLETED: 'GDPR_DATA_EXPORT_COMPLETED',
  GDPR_CONSENT_UPDATED: 'GDPR_CONSENT_UPDATED',
  GDPR_DATA_DELETION_REQUESTED: 'GDPR_DATA_DELETION_REQUESTED',
  
  // Staff
  SHIFT_STARTED: 'SHIFT_STARTED',
  SHIFT_ENDED: 'SHIFT_ENDED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_ESCALATED: 'TASK_ESCALATED',
  
  // Manager
  MANAGER_DECISION: 'MANAGER_DECISION',
  COMP_APPROVED: 'COMP_APPROVED',
  ESCALATION_HANDLED: 'ESCALATION_HANDLED',
  
  // Complaints
  COMPLAINT_FILED: 'COMPLAINT_FILED',
  COMPLAINT_ACKNOWLEDGED: 'COMPLAINT_ACKNOWLEDGED',
  COMPLAINT_RESOLVED: 'COMPLAINT_RESOLVED',
  
  // Marketing
  CAMPAIGN_CREATED: 'CAMPAIGN_CREATED',
  CAMPAIGN_SENT: 'CAMPAIGN_SENT',
  EMAIL_OPENED: 'EMAIL_OPENED',
  EMAIL_CLICKED: 'EMAIL_CLICKED',
  SEGMENT_CREATED: 'SEGMENT_CREATED',
  
  // Channel Management
  CHANNEL_CONNECTED: 'CHANNEL_CONNECTED',
  CHANNEL_SYNC_COMPLETED: 'CHANNEL_SYNC_COMPLETED',
  CHANNEL_RATE_UPDATED: 'CHANNEL_RATE_UPDATED',
  OTA_BOOKING_RECEIVED: 'OTA_BOOKING_RECEIVED',
  
  // Groups
  GROUP_BLOCK_CREATED: 'GROUP_BLOCK_CREATED',
  GROUP_ROOMING_LIST_UPDATED: 'GROUP_ROOMING_LIST_UPDATED',
  GROUP_PICKUP_UPDATED: 'GROUP_PICKUP_UPDATED',
  
  // AccommodationUnits
  CHALET_BROWSED: 'CHALET_BROWSED',
  ACCOMMODATION_UNIT_BOOKED: 'ACCOMMODATION_UNIT_BOOKED',
  CHALET_BOOKING_CANCELLED: 'CHALET_BOOKING_CANCELLED',
  ACCOMMODATION_UNIT_CHECKED_IN: 'ACCOMMODATION_UNIT_CHECKED_IN',
  ACCOMMODATION_UNIT_CHECKED_OUT: 'ACCOMMODATION_UNIT_CHECKED_OUT',
  CHALET_ADD_ON_PURCHASED: 'CHALET_ADD_ON_PURCHASED',
  ACCOMMODATION_UNIT_CREATED: 'ACCOMMODATION_UNIT_CREATED',
  ACCOMMODATION_UNIT_UPDATED: 'ACCOMMODATION_UNIT_UPDATED',
  CHALET_DELETED: 'CHALET_DELETED',
  CHALET_PRICE_RULE_CREATED: 'CHALET_PRICE_RULE_CREATED',
  
  // KioskItem Bar
  SNACK_MENU_BROWSED: 'SNACK_MENU_BROWSED',
  KIOSK_ORDER_PLACED: 'KIOSK_ORDER_PLACED',
  KIOSK_ORDER_PREPARED: 'KIOSK_ORDER_PREPARED',
  KIOSK_ORDER_DELIVERED: 'KIOSK_ORDER_DELIVERED',
  SNACK_CATEGORY_CREATED: 'SNACK_CATEGORY_CREATED',
  SNACK_ITEM_CREATED: 'SNACK_ITEM_CREATED',
  SNACK_ITEM_TOGGLED: 'SNACK_ITEM_TOGGLED',
  
  // Promotions
  PROMOTION_VIEWED: 'PROMOTION_VIEWED',
  PROMOTION_CLAIMED: 'PROMOTION_CLAIMED',
  PROMOTION_CREATED: 'PROMOTION_CREATED',
  PROMOTION_ACTIVATED: 'PROMOTION_ACTIVATED',
  PROMOTION_DEACTIVATED: 'PROMOTION_DEACTIVATED',
  
  // POS Terminal
  POS_READER_REGISTERED: 'POS_READER_REGISTERED',
  POS_READER_CONNECTED: 'POS_READER_CONNECTED',
  POS_PAYMENT_INITIATED: 'POS_PAYMENT_INITIATED',
  POS_PAYMENT_COMPLETED: 'POS_PAYMENT_COMPLETED',
  POS_PRINTER_CONFIGURED: 'POS_PRINTER_CONFIGURED',
  
  // Admin
  ADMIN_CONFIG_CHANGED: 'ADMIN_CONFIG_CHANGED',
  ADMIN_USER_CREATED: 'ADMIN_USER_CREATED',
  ADMIN_PERMISSION_CHANGED: 'ADMIN_PERMISSION_CHANGED',
  
  // System
  SIMULATION_TICK: 'SIMULATION_TICK',
  SIMULATION_STARTED: 'SIMULATION_STARTED',
  SIMULATION_PAUSED: 'SIMULATION_PAUSED',
  SIMULATION_RESUMED: 'SIMULATION_RESUMED',
  SIMULATION_ENDED: 'SIMULATION_ENDED',
  
  // Assertions
  ASSERTION_PASSED: 'ASSERTION_PASSED',
  ASSERTION_FAILED: 'ASSERTION_FAILED',
  
  // Alerts
  ALERT_TRIGGERED: 'ALERT_TRIGGERED',
  CAPACITY_THRESHOLD: 'CAPACITY_THRESHOLD',
  SLA_BREACH: 'SLA_BREACH',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];
