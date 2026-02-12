/**
 * Guest Bot - Base class for all guest actors
 * Handles common guest behaviors and state
 */

import { Actor, ActorConfig, ActionResult } from '../base/Actor';
import { EventTypes } from '../../events/EventBus';

export interface GuestProfile {
  budgetLevel: 'budget' | 'mid' | 'luxury';
  pace: 'relaxed' | 'moderate' | 'fast';
  complaintLikelihood: number; // 0-1
  tipPercentage: number;
  preferredDiningTimes: number[]; // Hours
  preferredActivities: string[];
  dietaryRestrictions?: string[];
  specialRequests?: string[];
}

export interface GuestState {
  reservationId?: string;
  roomNumber?: string;
  roomType?: string;
  isCheckedIn: boolean;
  checkInTime?: Date;
  checkOutTime?: Date;
  currentLocation: string;
  folioBllance: number;
  satisfactionLevel: number; // 0-100
  hungerLevel: number; // 0-100
  tirednessLevel: number; // 0-100
  ordersPlaced: number;
  complaintsAbout: string[];
  loyaltyTier?: string;
  pointsBalance?: number;
}

export interface GuestConfig extends ActorConfig {
  profile: GuestProfile;
  arrivalDate: Date;
  departureDate: Date;
  partySize: number;
  reservationDetails?: {
    roomType: string;
    rateCode: string;
    totalAmount: number;
    specialRequests?: string[];
  };
}

export class GuestBot extends Actor {
  protected profile: GuestProfile;
  protected guestState: GuestState;
  protected partySize: number;
  protected arrivalDate: Date;
  protected departureDate: Date;

  constructor(config: Omit<GuestConfig, 'type'>) {
    super({
      ...config,
      type: 'guest',
    });

    this.profile = config.profile;
    this.partySize = config.partySize;
    this.arrivalDate = config.arrivalDate;
    this.departureDate = config.departureDate;

    this.guestState = {
      isCheckedIn: false,
      currentLocation: 'offsite',
      folioBllance: 0,
      satisfactionLevel: 80, // Start neutral-positive
      hungerLevel: 30,
      tirednessLevel: 20,
      ordersPlaced: 0,
      complaintsAbout: [],
    };
  }

  protected registerActions(): void {
    // Check-in action
    this.registerAction({
      name: 'check_in',
      weight: 10,
      preconditions: () => 
        !this.guestState.isCheckedIn && 
        this.guestState.currentLocation === 'lobby',
      execute: async () => this.performCheckIn(),
    });

    // Go to restaurant
    this.registerAction({
      name: 'go_to_restaurant',
      weight: 5,
      cooldown: 90 * 60 * 1000, // 90 min simulated
      preconditions: () => 
        this.guestState.isCheckedIn && 
        this.guestState.hungerLevel > 60,
      execute: async () => this.goToRestaurant(),
    });

    // Place food order
    this.registerAction({
      name: 'place_order',
      weight: 8,
      preconditions: () => 
        this.guestState.currentLocation === 'restaurant' ||
        this.guestState.currentLocation === 'pool_bar' ||
        this.guestState.currentLocation === 'snack_bar',
      execute: async () => this.placeOrder(),
    });

    // Book spa
    this.registerAction({
      name: 'book_spa',
      weight: 2,
      cooldown: 4 * 60 * 60 * 1000, // 4 hours simulated
      preconditions: () => 
        this.guestState.isCheckedIn &&
        this.profile.preferredActivities.includes('spa'),
      execute: async () => this.bookSpa(),
    });

    // Go to pool
    this.registerAction({
      name: 'go_to_pool',
      weight: 4,
      cooldown: 2 * 60 * 60 * 1000,
      preconditions: () => 
        this.guestState.isCheckedIn &&
        this.guestState.currentLocation !== 'pool',
      execute: async () => this.goToPool(),
    });

    // Return to room
    this.registerAction({
      name: 'return_to_room',
      weight: 3,
      preconditions: () => 
        this.guestState.isCheckedIn &&
        this.guestState.currentLocation !== 'room' &&
        this.guestState.tirednessLevel > 70,
      execute: async () => this.returnToRoom(),
    });

    // File complaint
    this.registerAction({
      name: 'file_complaint',
      weight: 1,
      cooldown: 60 * 60 * 1000,
      preconditions: () => 
        this.guestState.isCheckedIn &&
        this.guestState.satisfactionLevel < 40 &&
        Math.random() < this.profile.complaintLikelihood,
      execute: async () => this.fileComplaint(),
    });

    // Check out
    this.registerAction({
      name: 'check_out',
      weight: 10,
      preconditions: () => {
        const simTime = this.eventBus.getSimulationTime();
        return this.guestState.isCheckedIn &&
          simTime >= this.departureDate;
      },
      execute: async () => this.performCheckOut(),
    });

    // Request service
    this.registerAction({
      name: 'request_room_service',
      weight: 2,
      cooldown: 60 * 60 * 1000,
      preconditions: () => 
        this.guestState.isCheckedIn &&
        this.guestState.currentLocation === 'room' &&
        this.guestState.hungerLevel > 50,
      execute: async () => this.requestRoomService(),
    });

    // View folio
    this.registerAction({
      name: 'view_folio',
      weight: 1,
      cooldown: 2 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.viewFolio(),
    });

    // =============================================
    // LOYALTY PROGRAM ACTIONS
    // =============================================
    
    this.registerAction({
      name: 'check_loyalty_status',
      weight: 1,
      cooldown: 4 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.checkLoyaltyStatus(),
    });

    this.registerAction({
      name: 'redeem_loyalty_points',
      weight: 1,
      cooldown: 24 * 60 * 60 * 1000,
      preconditions: () => 
        this.guestState.isCheckedIn && 
        (this.guestState.pointsBalance || 0) > 1000,
      execute: async () => this.redeemLoyaltyPoints(),
    });

    // =============================================
    // GIFT CARD ACTIONS
    // =============================================

    this.registerAction({
      name: 'purchase_gift_card',
      weight: 0.5,
      cooldown: 24 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.purchaseGiftCard(),
    });

    this.registerAction({
      name: 'check_gift_card_balance',
      weight: 0.5,
      cooldown: 8 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.checkGiftCardBalance(),
    });

    // =============================================
    // COUPON ACTIONS
    // =============================================

    this.registerAction({
      name: 'view_available_coupons',
      weight: 1,
      cooldown: 4 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.viewAvailableCoupons(),
    });

    // =============================================
    // RESTAURANT RESERVATION ACTIONS
    // =============================================

    this.registerAction({
      name: 'make_restaurant_reservation',
      weight: 2,
      cooldown: 4 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.makeRestaurantReservation(),
    });

    this.registerAction({
      name: 'cancel_restaurant_reservation',
      weight: 0.5,
      cooldown: 2 * 60 * 60 * 1000,
      preconditions: () => 
        this.guestState.isCheckedIn && 
        this.getState('hasRestaurantReservation'),
      execute: async () => this.cancelRestaurantReservation(),
    });

    this.registerAction({
      name: 'join_waitlist',
      weight: 2,
      cooldown: 30 * 60 * 1000,
      preconditions: () => 
        this.guestState.currentLocation === 'restaurant' &&
        this.guestState.hungerLevel > 70,
      execute: async () => this.joinWaitlist(),
    });

    // =============================================
    // MESSAGING ACTIONS
    // =============================================

    this.registerAction({
      name: 'send_message_to_staff',
      weight: 1,
      cooldown: 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.sendMessageToStaff(),
    });

    this.registerAction({
      name: 'check_messages',
      weight: 1,
      cooldown: 30 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.checkMessages(),
    });

    // =============================================
    // POOL ACTIONS (ENHANCED)
    // =============================================

    this.registerAction({
      name: 'buy_pool_ticket',
      weight: 2,
      cooldown: 24 * 60 * 60 * 1000,
      preconditions: () => 
        this.guestState.isCheckedIn &&
        this.profile.preferredActivities.includes('pool'),
      execute: async () => this.buyPoolTicket(),
    });

    this.registerAction({
      name: 'get_pool_bracelet',
      weight: 2,
      preconditions: () => 
        this.getState('hasPoolTicket') &&
        !this.getState('hasPoolBracelet'),
      execute: async () => this.getPoolBracelet(),
    });

    this.registerAction({
      name: 'return_pool_bracelet',
      weight: 3,
      preconditions: () => 
        this.getState('hasPoolBracelet') &&
        this.guestState.currentLocation !== 'pool',
      execute: async () => this.returnPoolBracelet(),
    });

    // =============================================
    // REVIEW ACTIONS
    // =============================================

    this.registerAction({
      name: 'submit_review',
      weight: 1,
      cooldown: 24 * 60 * 60 * 1000,
      preconditions: () => 
        this.guestState.isCheckedIn &&
        this.eventBus.getSimulationTime() > new Date(this.arrivalDate.getTime() + 24 * 60 * 60 * 1000),
      execute: async () => this.submitReview(),
    });

    // =============================================
    // SUPPORT TICKET ACTIONS
    // =============================================

    this.registerAction({
      name: 'create_support_ticket',
      weight: 0.5,
      cooldown: 2 * 60 * 60 * 1000,
      preconditions: () => 
        this.guestState.isCheckedIn &&
        this.guestState.satisfactionLevel < 50,
      execute: async () => this.createSupportTicket(),
    });

    this.registerAction({
      name: 'check_ticket_status',
      weight: 1,
      cooldown: 60 * 60 * 1000,
      preconditions: () => this.getState('hasSupportTicket'),
      execute: async () => this.checkTicketStatus(),
    });

    // =============================================
    // MOBILE CHECK-IN ACTIONS
    // =============================================

    this.registerAction({
      name: 'start_mobile_checkin',
      weight: 3,
      preconditions: () => 
        !this.guestState.isCheckedIn &&
        this.getState('hasMobileCheckinToken'),
      execute: async () => this.startMobileCheckin(),
    });

    this.registerAction({
      name: 'upload_id_document',
      weight: 5,
      preconditions: () => this.getState('mobileCheckinInProgress'),
      execute: async () => this.uploadIdDocument(),
    });

    this.registerAction({
      name: 'submit_mobile_checkin',
      weight: 5,
      preconditions: () => 
        this.getState('mobileCheckinInProgress') &&
        this.getState('idDocumentUploaded'),
      execute: async () => this.submitMobileCheckin(),
    });

    // =============================================
    // KIOSK CHECK-IN ACTIONS
    // =============================================

    this.registerAction({
      name: 'use_kiosk_checkin',
      weight: 3,
      preconditions: () => 
        !this.guestState.isCheckedIn &&
        this.guestState.currentLocation === 'lobby' &&
        Math.random() < 0.3, // 30% prefer kiosk
      execute: async () => this.useKioskCheckin(),
    });

    // =============================================
    // BILLING ACTIONS
    // =============================================

    this.registerAction({
      name: 'dispute_charge',
      weight: 0.5,
      cooldown: 4 * 60 * 60 * 1000,
      preconditions: () => 
        this.guestState.isCheckedIn &&
        this.guestState.folioBllance > 0 &&
        Math.random() < 0.1, // 10% chance
      execute: async () => this.disputeCharge(),
    });

    this.registerAction({
      name: 'request_invoice',
      weight: 1,
      cooldown: 24 * 60 * 60 * 1000,
      preconditions: () => 
        this.guestState.isCheckedIn &&
        this.profile.budgetLevel === 'luxury', // Business travelers
      execute: async () => this.requestInvoice(),
    });

    // =============================================
    // GDPR ACTIONS
    // =============================================

    this.registerAction({
      name: 'request_data_export',
      weight: 0.1,
      cooldown: 24 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.requestDataExport(),
    });

    this.registerAction({
      name: 'manage_consent',
      weight: 0.5,
      cooldown: 12 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.manageConsent(),
    });

    // =============================================
    // MOBILE APP ACTIONS
    // =============================================

    this.registerAction({
      name: 'register_mobile_device',
      weight: 2,
      preconditions: () => 
        this.guestState.isCheckedIn &&
        !this.getState('mobileDeviceRegistered'),
      execute: async () => this.registerMobileDevice(),
    });

    this.registerAction({
      name: 'enable_push_notifications',
      weight: 1,
      preconditions: () => 
        this.getState('mobileDeviceRegistered') &&
        !this.getState('pushEnabled'),
      execute: async () => this.enablePushNotifications(),
    });

    // =============================================
    // CHALET BOOKING ACTIONS
    // =============================================

    this.registerAction({
      name: 'browse_chalets',
      weight: 2,
      cooldown: 4 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.browseChalets(),
    });

    this.registerAction({
      name: 'check_chalet_availability',
      weight: 1,
      cooldown: 2 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.checkChaletAvailability(),
    });

    this.registerAction({
      name: 'book_chalet',
      weight: 2,
      cooldown: 24 * 60 * 60 * 1000,
      preconditions: () => 
        this.guestState.isCheckedIn &&
        this.profile.budgetLevel !== 'budget',
      execute: async () => this.bookChalet(),
    });

    this.registerAction({
      name: 'cancel_chalet_booking',
      weight: 0.5,
      cooldown: 12 * 60 * 60 * 1000,
      preconditions: () => this.getState('hasChaletBooking'),
      execute: async () => this.cancelChaletBooking(),
    });

    this.registerAction({
      name: 'view_chalet_addons',
      weight: 1,
      cooldown: 4 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.viewChaletAddons(),
    });

    // =============================================
    // SNACK BAR ACTIONS
    // =============================================

    this.registerAction({
      name: 'browse_snack_menu',
      weight: 2,
      cooldown: 2 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.browseSnackMenu(),
    });

    this.registerAction({
      name: 'order_from_snack_bar',
      weight: 3,
      cooldown: 60 * 60 * 1000,
      preconditions: () => 
        (this.guestState.currentLocation === 'pool' ||
         this.guestState.currentLocation === 'beach') &&
        this.guestState.hungerLevel > 40,
      execute: async () => this.orderFromSnackBar(),
    });

    this.registerAction({
      name: 'check_snack_order_status',
      weight: 2,
      cooldown: 5 * 60 * 1000,
      preconditions: () => this.getState('hasSnackOrder'),
      execute: async () => this.checkSnackOrderStatus(),
    });

    // =============================================
    // PROMOTIONS ACTIONS
    // =============================================

    this.registerAction({
      name: 'view_active_promotions',
      weight: 1,
      cooldown: 4 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.viewActivePromotions(),
    });

    this.registerAction({
      name: 'claim_promotion',
      weight: 1,
      cooldown: 24 * 60 * 60 * 1000,
      preconditions: () => 
        this.guestState.isCheckedIn &&
        this.getState('hasAvailablePromotion'),
      execute: async () => this.claimPromotion(),
    });
  }

  protected async performCheckIn(): Promise<ActionResult> {
    this.emitEvent(EventTypes.GUEST_CHECK_IN_STARTED, 'checkin', {
      guestId: this.id,
      guestName: this.name,
      partySize: this.partySize,
    });

    // API call to check in
    const result = await this.apiCall<{ roomNumber: string; roomType: string }>(
      'POST',
      '/api/v1/front-desk/check-in',
      {
        reservationId: this.guestState.reservationId,
        guestName: this.name,
        idVerified: true,
      }
    );

    if (result.success && result.data) {
      this.guestState.isCheckedIn = true;
      this.guestState.roomNumber = result.data.roomNumber;
      this.guestState.roomType = result.data.roomType;
      this.guestState.checkInTime = this.eventBus.getSimulationTime();
      this.guestState.currentLocation = 'room';

      this.emitEvent(EventTypes.GUEST_CHECK_IN_COMPLETED, 'checkin', {
        guestId: this.id,
        guestName: this.name,
        roomNumber: this.guestState.roomNumber,
        roomType: this.guestState.roomType,
      });

      return {
        success: true,
        action: 'check_in',
        data: { roomNumber: this.guestState.roomNumber },
        cascades: [EventTypes.GUEST_CHECK_IN_COMPLETED],
      };
    }

    return {
      success: false,
      action: 'check_in',
      error: result.error || 'Check-in failed',
    };
  }

  protected async performCheckOut(): Promise<ActionResult> {
    this.emitEvent(EventTypes.GUEST_CHECK_OUT_STARTED, 'checkout', {
      guestId: this.id,
      guestName: this.name,
      roomNumber: this.guestState.roomNumber,
    });

    // API call to check out
    const result = await this.apiCall<{ finalBill: number }>(
      'POST',
      '/api/v1/front-desk/check-out',
      {
        roomNumber: this.guestState.roomNumber,
        paymentMethod: 'card_on_file',
      }
    );

    if (result.success) {
      this.guestState.isCheckedIn = false;
      this.guestState.checkOutTime = this.eventBus.getSimulationTime();
      this.guestState.currentLocation = 'offsite';

      this.emitEvent(EventTypes.GUEST_CHECK_OUT_COMPLETED, 'checkout', {
        guestId: this.id,
        guestName: this.name,
        roomNumber: this.guestState.roomNumber,
        finalBill: result.data?.finalBill,
      });

      // Room is now dirty
      this.emitEvent(EventTypes.ROOM_MARKED_DIRTY, 'housekeeping', {
        roomNumber: this.guestState.roomNumber,
        priority: 'normal',
      });

      return {
        success: true,
        action: 'check_out',
        data: { finalBill: result.data?.finalBill },
        cascades: [EventTypes.GUEST_CHECK_OUT_COMPLETED, EventTypes.ROOM_MARKED_DIRTY],
      };
    }

    return {
      success: false,
      action: 'check_out',
      error: result.error || 'Check-out failed',
    };
  }

  protected async goToRestaurant(): Promise<ActionResult> {
    this.guestState.currentLocation = 'restaurant';
    
    return {
      success: true,
      action: 'go_to_restaurant',
      data: { location: 'restaurant' },
    };
  }

  protected async placeOrder(): Promise<ActionResult> {
    // Select menu items based on profile
    const orderItems = this.selectMenuItems();

    const result = await this.apiCall<{ orderId: string; total: number }>(
      'POST',
      '/api/v1/orders',
      {
        items: orderItems,
        roomNumber: this.guestState.roomNumber,
        tableNumber: this.guestState.currentLocation === 'restaurant' ? 'T1' : undefined,
        notes: this.profile.dietaryRestrictions?.join(', '),
      }
    );

    if (result.success && result.data) {
      this.guestState.ordersPlaced++;
      this.guestState.hungerLevel = Math.max(0, this.guestState.hungerLevel - 60);

      this.emitEvent(EventTypes.ORDER_PLACED, 'fb', {
        guestId: this.id,
        orderId: result.data.orderId,
        total: result.data.total,
        itemCount: orderItems.length,
        location: this.guestState.currentLocation,
      });

      return {
        success: true,
        action: 'place_order',
        data: { orderId: result.data.orderId, total: result.data.total },
        cascades: [EventTypes.ORDER_PLACED],
      };
    }

    return {
      success: false,
      action: 'place_order',
      error: result.error || 'Order failed',
    };
  }

  protected selectMenuItems(): Array<{ menuItemId: string; quantity: number }> {
    // Simple selection - override in profile-specific subclasses
    const itemCount = Math.floor(Math.random() * 3) + 1;
    const items: Array<{ menuItemId: string; quantity: number }> = [];

    for (let i = 0; i < itemCount; i++) {
      items.push({
        menuItemId: `item_${Math.floor(Math.random() * 50) + 1}`,
        quantity: 1,
      });
    }

    return items;
  }

  protected async bookSpa(): Promise<ActionResult> {
    const result = await this.apiCall<{ appointmentId: string }>(
      'POST',
      '/api/v1/spa/bookings',
      {
        guestId: this.id,
        serviceType: 'massage',
        duration: 60,
        preferredTime: this.eventBus.getSimulationTime(),
      }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.SPA_BOOKED, 'spa', {
        guestId: this.id,
        appointmentId: result.data.appointmentId,
      });

      return {
        success: true,
        action: 'book_spa',
        data: { appointmentId: result.data.appointmentId },
        cascades: [EventTypes.SPA_BOOKED],
      };
    }

    return {
      success: false,
      action: 'book_spa',
      error: result.error || 'Spa booking failed',
    };
  }

  protected async goToPool(): Promise<ActionResult> {
    this.guestState.currentLocation = 'pool';
    this.guestState.tirednessLevel += 10;

    return {
      success: true,
      action: 'go_to_pool',
      data: { location: 'pool' },
    };
  }

  protected async returnToRoom(): Promise<ActionResult> {
    this.guestState.currentLocation = 'room';
    this.guestState.tirednessLevel = Math.max(0, this.guestState.tirednessLevel - 30);

    return {
      success: true,
      action: 'return_to_room',
      data: { location: 'room' },
    };
  }

  protected async fileComplaint(): Promise<ActionResult> {
    const complaintReason = this.determineComplaintReason();

    const result = await this.apiCall<{ complaintId: string }>(
      'POST',
      '/api/v1/support/complaints',
      {
        guestId: this.id,
        roomNumber: this.guestState.roomNumber,
        category: complaintReason.category,
        description: complaintReason.description,
        severity: complaintReason.severity,
      }
    );

    if (result.success && result.data) {
      this.guestState.complaintsAbout.push(complaintReason.category);

      this.emitEvent(EventTypes.COMPLAINT_FILED, 'guest_lifecycle', {
        guestId: this.id,
        complaintId: result.data.complaintId,
        category: complaintReason.category,
        severity: complaintReason.severity,
      });

      return {
        success: true,
        action: 'file_complaint',
        data: { complaintId: result.data.complaintId },
        cascades: [EventTypes.COMPLAINT_FILED],
      };
    }

    return {
      success: false,
      action: 'file_complaint',
      error: result.error || 'Complaint filing failed',
    };
  }

  protected determineComplaintReason(): { category: string; description: string; severity: string } {
    const reasons = [
      { category: 'cleanliness', description: 'Room not properly cleaned', severity: 'medium' },
      { category: 'noise', description: 'Noise from adjacent room', severity: 'low' },
      { category: 'service', description: 'Slow service at restaurant', severity: 'low' },
      { category: 'amenities', description: 'Pool towels not available', severity: 'low' },
      { category: 'billing', description: 'Incorrect charge on folio', severity: 'medium' },
    ];

    return reasons[Math.floor(Math.random() * reasons.length)];
  }

  protected async requestRoomService(): Promise<ActionResult> {
    const orderItems = this.selectMenuItems();

    const result = await this.apiCall<{ orderId: string; estimatedDelivery: number }>(
      'POST',
      '/api/v1/room-service/orders',
      {
        roomNumber: this.guestState.roomNumber,
        items: orderItems,
        specialInstructions: this.profile.specialRequests?.join(', '),
      }
    );

    if (result.success && result.data) {
      this.guestState.ordersPlaced++;
      this.guestState.hungerLevel = Math.max(0, this.guestState.hungerLevel - 50);

      this.emitEvent(EventTypes.ORDER_PLACED, 'fb', {
        guestId: this.id,
        orderId: result.data.orderId,
        type: 'room_service',
        roomNumber: this.guestState.roomNumber,
      });

      return {
        success: true,
        action: 'request_room_service',
        data: result.data,
        cascades: [EventTypes.ORDER_PLACED],
      };
    }

    return {
      success: false,
      action: 'request_room_service',
      error: result.error || 'Room service order failed',
    };
  }

  protected async viewFolio(): Promise<ActionResult> {
    const result = await this.apiCall<{ balance: number; charges: any[] }>(
      'GET',
      `/api/v1/guests/${this.id}/folio`
    );

    if (result.success && result.data) {
      this.guestState.folioBllance = result.data.balance;

      // Check for unexpected charges
      if (result.data.balance > this.guestState.folioBllance * 1.5) {
        this.guestState.satisfactionLevel -= 10;
      }

      return {
        success: true,
        action: 'view_folio',
        data: { balance: result.data.balance },
      };
    }

    return {
      success: false,
      action: 'view_folio',
      error: result.error || 'Failed to view folio',
    };
  }

  // =============================================
  // LOYALTY PROGRAM IMPLEMENTATIONS
  // =============================================

  protected async checkLoyaltyStatus(): Promise<ActionResult> {
    const result = await this.apiCall<{ tier: string; points: number; expiringPoints: number }>(
      'GET',
      `/api/v1/loyalty/members/${this.id}`
    );

    if (result.success && result.data) {
      this.guestState.loyaltyTier = result.data.tier;
      this.guestState.pointsBalance = result.data.points;
      this.setState('expiringPoints', result.data.expiringPoints);

      return {
        success: true,
        action: 'check_loyalty_status',
        data: result.data,
      };
    }

    return {
      success: false,
      action: 'check_loyalty_status',
      error: result.error || 'Failed to check loyalty status',
    };
  }

  protected async redeemLoyaltyPoints(): Promise<ActionResult> {
    const pointsToRedeem = Math.min(this.guestState.pointsBalance || 0, 5000);
    
    const result = await this.apiCall<{ redemptionId: string; discount: number; remainingPoints: number }>(
      'POST',
      '/api/v1/loyalty/redeem',
      {
        memberId: this.id,
        points: pointsToRedeem,
        redemptionType: 'folio_credit',
      }
    );

    if (result.success && result.data) {
      this.guestState.pointsBalance = result.data.remainingPoints;
      this.guestState.satisfactionLevel += 5;

      this.emitEvent(EventTypes.LOYALTY_POINTS_REDEEMED, 'loyalty', {
        guestId: this.id,
        pointsRedeemed: pointsToRedeem,
        discount: result.data.discount,
      });

      return {
        success: true,
        action: 'redeem_loyalty_points',
        data: result.data,
        cascades: [EventTypes.LOYALTY_POINTS_REDEEMED],
      };
    }

    return {
      success: false,
      action: 'redeem_loyalty_points',
      error: result.error || 'Failed to redeem points',
    };
  }

  // =============================================
  // GIFT CARD IMPLEMENTATIONS
  // =============================================

  protected async purchaseGiftCard(): Promise<ActionResult> {
    const amount = [50, 100, 150, 200, 250][Math.floor(Math.random() * 5)];
    
    const result = await this.apiCall<{ cardNumber: string; pin: string }>(
      'POST',
      '/api/v1/gift-cards',
      {
        amount,
        purchaserEmail: `${this.id}@simulation.test`,
        recipientEmail: `recipient-${Date.now()}@simulation.test`,
        message: 'Enjoy your stay!',
      }
    );

    if (result.success && result.data) {
      this.guestState.folioBllance += amount;

      this.emitEvent(EventTypes.GIFT_CARD_PURCHASED, 'giftcards', {
        guestId: this.id,
        amount,
        cardNumber: result.data.cardNumber,
      });

      return {
        success: true,
        action: 'purchase_gift_card',
        data: result.data,
        cascades: [EventTypes.GIFT_CARD_PURCHASED],
      };
    }

    return {
      success: false,
      action: 'purchase_gift_card',
      error: result.error || 'Failed to purchase gift card',
    };
  }

  protected async checkGiftCardBalance(): Promise<ActionResult> {
    const cardNumber = this.getState('giftCardNumber');
    if (!cardNumber) {
      return { success: false, action: 'check_gift_card_balance', error: 'No gift card' };
    }

    const result = await this.apiCall<{ balance: number; expiryDate: string }>(
      'GET',
      `/api/v1/gift-cards/${cardNumber}/balance`
    );

    if (result.success) {
      return {
        success: true,
        action: 'check_gift_card_balance',
        data: result.data,
      };
    }

    return {
      success: false,
      action: 'check_gift_card_balance',
      error: result.error || 'Failed to check balance',
    };
  }

  // =============================================
  // COUPON IMPLEMENTATIONS
  // =============================================

  protected async viewAvailableCoupons(): Promise<ActionResult> {
    const result = await this.apiCall<{ coupons: Array<{ code: string; discount: number; expiresAt: string }> }>(
      'GET',
      `/api/v1/coupons/available?guestId=${this.id}`
    );

    if (result.success && result.data) {
      this.setState('availableCoupons', result.data.coupons);

      return {
        success: true,
        action: 'view_available_coupons',
        data: { count: result.data.coupons.length },
      };
    }

    return {
      success: false,
      action: 'view_available_coupons',
      error: result.error || 'Failed to fetch coupons',
    };
  }

  // =============================================
  // RESTAURANT RESERVATION IMPLEMENTATIONS
  // =============================================

  protected async makeRestaurantReservation(): Promise<ActionResult> {
    const reservationTime = new Date(this.eventBus.getSimulationTime());
    reservationTime.setHours(reservationTime.getHours() + 2);

    const result = await this.apiCall<{ reservationId: string; confirmationCode: string }>(
      'POST',
      '/api/v1/restaurant/reservations',
      {
        guestId: this.id,
        partySize: this.partySize,
        reservationTime: reservationTime.toISOString(),
        specialRequests: this.profile.specialRequests?.join(', '),
      }
    );

    if (result.success && result.data) {
      this.setState('hasRestaurantReservation', true);
      this.setState('restaurantReservationId', result.data.reservationId);

      this.emitEvent(EventTypes.RESTAURANT_RESERVATION_MADE, 'restaurant', {
        guestId: this.id,
        reservationId: result.data.reservationId,
        partySize: this.partySize,
        time: reservationTime,
      });

      return {
        success: true,
        action: 'make_restaurant_reservation',
        data: result.data,
        cascades: [EventTypes.RESTAURANT_RESERVATION_MADE],
      };
    }

    return {
      success: false,
      action: 'make_restaurant_reservation',
      error: result.error || 'Failed to make reservation',
    };
  }

  protected async cancelRestaurantReservation(): Promise<ActionResult> {
    const reservationId = this.getState('restaurantReservationId');

    const result = await this.apiCall<{ cancelled: boolean }>(
      'DELETE',
      `/api/v1/restaurant/reservations/${reservationId}`
    );

    if (result.success) {
      this.setState('hasRestaurantReservation', false);
      this.setState('restaurantReservationId', null);

      this.emitEvent(EventTypes.RESTAURANT_RESERVATION_CANCELLED, 'restaurant', {
        guestId: this.id,
        reservationId,
      });

      return {
        success: true,
        action: 'cancel_restaurant_reservation',
        data: { cancelled: true },
        cascades: [EventTypes.RESTAURANT_RESERVATION_CANCELLED],
      };
    }

    return {
      success: false,
      action: 'cancel_restaurant_reservation',
      error: result.error || 'Failed to cancel reservation',
    };
  }

  protected async joinWaitlist(): Promise<ActionResult> {
    const result = await this.apiCall<{ waitlistId: string; position: number; estimatedWait: number }>(
      'POST',
      '/api/v1/restaurant/waitlist',
      {
        guestId: this.id,
        partySize: this.partySize,
        phone: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
      }
    );

    if (result.success && result.data) {
      this.setState('onWaitlist', true);
      this.setState('waitlistPosition', result.data.position);

      this.emitEvent(EventTypes.WAITLIST_JOINED, 'restaurant', {
        guestId: this.id,
        waitlistId: result.data.waitlistId,
        position: result.data.position,
        estimatedWait: result.data.estimatedWait,
      });

      return {
        success: true,
        action: 'join_waitlist',
        data: result.data,
        cascades: [EventTypes.WAITLIST_JOINED],
      };
    }

    return {
      success: false,
      action: 'join_waitlist',
      error: result.error || 'Failed to join waitlist',
    };
  }

  // =============================================
  // MESSAGING IMPLEMENTATIONS
  // =============================================

  protected async sendMessageToStaff(): Promise<ActionResult> {
    const messageTypes = ['request', 'question', 'feedback', 'complaint'];
    const messageType = messageTypes[Math.floor(Math.random() * messageTypes.length)];

    const messages: Record<string, string> = {
      request: 'Could we get extra towels please?',
      question: 'What time does the pool close?',
      feedback: 'The room is wonderful, thank you!',
      complaint: 'The air conditioning is not working properly.',
    };

    const result = await this.apiCall<{ messageId: string; conversationId: string }>(
      'POST',
      '/api/v1/messaging/conversations',
      {
        guestId: this.id,
        roomNumber: this.guestState.roomNumber,
        message: messages[messageType],
        channel: 'app',
      }
    );

    if (result.success && result.data) {
      this.setState('conversationId', result.data.conversationId);

      this.emitEvent(EventTypes.GUEST_MESSAGE_SENT, 'messaging', {
        guestId: this.id,
        messageType,
        conversationId: result.data.conversationId,
      });

      return {
        success: true,
        action: 'send_message_to_staff',
        data: result.data,
        cascades: [EventTypes.GUEST_MESSAGE_SENT],
      };
    }

    return {
      success: false,
      action: 'send_message_to_staff',
      error: result.error || 'Failed to send message',
    };
  }

  protected async checkMessages(): Promise<ActionResult> {
    const result = await this.apiCall<{ messages: Array<{ id: string; content: string; isRead: boolean }> }>(
      'GET',
      `/api/v1/messaging/conversations?guestId=${this.id}`
    );

    if (result.success && result.data) {
      const unreadCount = result.data.messages.filter(m => !m.isRead).length;

      return {
        success: true,
        action: 'check_messages',
        data: { totalMessages: result.data.messages.length, unreadCount },
      };
    }

    return {
      success: false,
      action: 'check_messages',
      error: result.error || 'Failed to check messages',
    };
  }

  // =============================================
  // POOL TICKET IMPLEMENTATIONS
  // =============================================

  protected async buyPoolTicket(): Promise<ActionResult> {
    const ticketType = this.partySize > 2 ? 'family' : 'individual';
    
    const result = await this.apiCall<{ ticketId: string; validUntil: string }>(
      'POST',
      '/api/v1/pool/tickets',
      {
        guestId: this.id,
        ticketType,
        quantity: this.partySize,
        roomNumber: this.guestState.roomNumber,
      }
    );

    if (result.success && result.data) {
      this.setState('hasPoolTicket', true);
      this.setState('poolTicketId', result.data.ticketId);

      this.emitEvent(EventTypes.POOL_TICKET_PURCHASED, 'pool', {
        guestId: this.id,
        ticketId: result.data.ticketId,
        ticketType,
      });

      return {
        success: true,
        action: 'buy_pool_ticket',
        data: result.data,
        cascades: [EventTypes.POOL_TICKET_PURCHASED],
      };
    }

    return {
      success: false,
      action: 'buy_pool_ticket',
      error: result.error || 'Failed to buy pool ticket',
    };
  }

  protected async getPoolBracelet(): Promise<ActionResult> {
    const ticketId = this.getState('poolTicketId');

    const result = await this.apiCall<{ braceletId: string; lockerNumber: number }>(
      'POST',
      '/api/v1/pool/bracelets',
      {
        ticketId,
        guestId: this.id,
      }
    );

    if (result.success && result.data) {
      this.setState('hasPoolBracelet', true);
      this.setState('braceletId', result.data.braceletId);
      this.setState('lockerNumber', result.data.lockerNumber);

      this.emitEvent(EventTypes.POOL_BRACELET_ISSUED, 'pool', {
        guestId: this.id,
        braceletId: result.data.braceletId,
        lockerNumber: result.data.lockerNumber,
      });

      return {
        success: true,
        action: 'get_pool_bracelet',
        data: result.data,
        cascades: [EventTypes.POOL_BRACELET_ISSUED],
      };
    }

    return {
      success: false,
      action: 'get_pool_bracelet',
      error: result.error || 'Failed to get bracelet',
    };
  }

  protected async returnPoolBracelet(): Promise<ActionResult> {
    const braceletId = this.getState('braceletId');

    const result = await this.apiCall<{ returned: boolean }>(
      'POST',
      `/api/v1/pool/bracelets/${braceletId}/return`
    );

    if (result.success) {
      this.setState('hasPoolBracelet', false);
      this.setState('braceletId', null);

      this.emitEvent(EventTypes.POOL_BRACELET_RETURNED, 'pool', {
        guestId: this.id,
        braceletId,
      });

      return {
        success: true,
        action: 'return_pool_bracelet',
        data: { returned: true },
        cascades: [EventTypes.POOL_BRACELET_RETURNED],
      };
    }

    return {
      success: false,
      action: 'return_pool_bracelet',
      error: result.error || 'Failed to return bracelet',
    };
  }

  // =============================================
  // REVIEW IMPLEMENTATIONS
  // =============================================

  protected async submitReview(): Promise<ActionResult> {
    const rating = Math.round(this.guestState.satisfactionLevel / 20); // 1-5 based on satisfaction

    const result = await this.apiCall<{ reviewId: string }>(
      'POST',
      '/api/v1/reviews',
      {
        guestId: this.id,
        reservationId: this.guestState.reservationId,
        rating,
        title: rating >= 4 ? 'Great stay!' : rating >= 3 ? 'Decent stay' : 'Needs improvement',
        content: this.generateReviewContent(rating),
        categories: {
          cleanliness: Math.max(1, Math.min(5, rating + (Math.random() > 0.5 ? 1 : -1))),
          service: Math.max(1, Math.min(5, rating + (Math.random() > 0.5 ? 1 : -1))),
          location: Math.max(1, Math.min(5, rating + 1)),
          amenities: Math.max(1, Math.min(5, rating)),
        },
      }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.REVIEW_SUBMITTED, 'reviews', {
        guestId: this.id,
        reviewId: result.data.reviewId,
        rating,
      });

      return {
        success: true,
        action: 'submit_review',
        data: { reviewId: result.data.reviewId, rating },
        cascades: [EventTypes.REVIEW_SUBMITTED],
      };
    }

    return {
      success: false,
      action: 'submit_review',
      error: result.error || 'Failed to submit review',
    };
  }

  private generateReviewContent(rating: number): string {
    const positive = ['wonderful staff', 'clean rooms', 'great location', 'excellent amenities'];
    const negative = ['slow service', 'noisy', 'dated decor', 'limited parking'];
    
    if (rating >= 4) {
      return `Excellent stay! The ${positive[Math.floor(Math.random() * positive.length)]} made our visit memorable.`;
    } else if (rating >= 3) {
      return `Good overall experience. ${positive[Math.floor(Math.random() * positive.length)]} but ${negative[Math.floor(Math.random() * negative.length)]}.`;
    } else {
      return `Disappointing stay. ${negative[Math.floor(Math.random() * negative.length)]} was a major issue.`;
    }
  }

  // =============================================
  // SUPPORT TICKET IMPLEMENTATIONS
  // =============================================

  protected async createSupportTicket(): Promise<ActionResult> {
    const issues = [
      { category: 'room_issue', description: 'Air conditioning not working' },
      { category: 'noise', description: 'Loud noise from adjacent room' },
      { category: 'cleanliness', description: 'Room was not properly cleaned' },
      { category: 'billing', description: 'Incorrect charge on my folio' },
      { category: 'amenity', description: 'TV remote not working' },
    ];
    const issue = issues[Math.floor(Math.random() * issues.length)];

    const result = await this.apiCall<{ ticketId: string; ticketNumber: string }>(
      'POST',
      '/api/v1/support/tickets',
      {
        guestId: this.id,
        roomNumber: this.guestState.roomNumber,
        category: issue.category,
        description: issue.description,
        priority: this.guestState.satisfactionLevel < 30 ? 'high' : 'medium',
      }
    );

    if (result.success && result.data) {
      this.setState('hasSupportTicket', true);
      this.setState('supportTicketId', result.data.ticketId);

      this.emitEvent(EventTypes.SUPPORT_TICKET_CREATED, 'support', {
        guestId: this.id,
        ticketId: result.data.ticketId,
        category: issue.category,
      });

      return {
        success: true,
        action: 'create_support_ticket',
        data: result.data,
        cascades: [EventTypes.SUPPORT_TICKET_CREATED],
      };
    }

    return {
      success: false,
      action: 'create_support_ticket',
      error: result.error || 'Failed to create ticket',
    };
  }

  protected async checkTicketStatus(): Promise<ActionResult> {
    const ticketId = this.getState('supportTicketId');

    const result = await this.apiCall<{ status: string; updates: any[] }>(
      'GET',
      `/api/v1/support/tickets/${ticketId}`
    );

    if (result.success && result.data) {
      if (result.data.status === 'resolved') {
        this.setState('hasSupportTicket', false);
        this.guestState.satisfactionLevel += 10;
      }

      return {
        success: true,
        action: 'check_ticket_status',
        data: result.data,
      };
    }

    return {
      success: false,
      action: 'check_ticket_status',
      error: result.error || 'Failed to check ticket status',
    };
  }

  // =============================================
  // MOBILE CHECK-IN IMPLEMENTATIONS
  // =============================================

  protected async startMobileCheckin(): Promise<ActionResult> {
    const result = await this.apiCall<{ sessionId: string; requiredDocuments: string[] }>(
      'POST',
      '/api/v1/mobile-checkin/start',
      {
        reservationId: this.guestState.reservationId,
        guestEmail: `${this.id}@simulation.test`,
      }
    );

    if (result.success && result.data) {
      this.setState('mobileCheckinInProgress', true);
      this.setState('mobileCheckinSessionId', result.data.sessionId);

      this.emitEvent(EventTypes.MOBILE_CHECKIN_STARTED, 'mobile-checkin', {
        guestId: this.id,
        sessionId: result.data.sessionId,
      });

      return {
        success: true,
        action: 'start_mobile_checkin',
        data: result.data,
        cascades: [EventTypes.MOBILE_CHECKIN_STARTED],
      };
    }

    return {
      success: false,
      action: 'start_mobile_checkin',
      error: result.error || 'Failed to start mobile check-in',
    };
  }

  protected async uploadIdDocument(): Promise<ActionResult> {
    const sessionId = this.getState('mobileCheckinSessionId');

    const result = await this.apiCall<{ verified: boolean }>(
      'POST',
      `/api/v1/mobile-checkin/${sessionId}/documents`,
      {
        documentType: 'passport',
        documentData: 'base64_encoded_document_data_simulation',
      }
    );

    if (result.success && result.data?.verified) {
      this.setState('idDocumentUploaded', true);

      return {
        success: true,
        action: 'upload_id_document',
        data: { verified: true },
      };
    }

    return {
      success: false,
      action: 'upload_id_document',
      error: result.error || 'Document verification failed',
    };
  }

  protected async submitMobileCheckin(): Promise<ActionResult> {
    const sessionId = this.getState('mobileCheckinSessionId');

    const result = await this.apiCall<{ roomNumber: string; keyCode: string }>(
      'POST',
      `/api/v1/mobile-checkin/${sessionId}/complete`,
      {
        signature: 'digital_signature_simulation',
        termsAccepted: true,
      }
    );

    if (result.success && result.data) {
      this.guestState.isCheckedIn = true;
      this.guestState.roomNumber = result.data.roomNumber;
      this.guestState.checkInTime = this.eventBus.getSimulationTime();
      this.setState('mobileCheckinInProgress', false);
      this.setState('hasMobileKey', true);

      this.emitEvent(EventTypes.GUEST_CHECK_IN_COMPLETED, 'mobile-checkin', {
        guestId: this.id,
        roomNumber: result.data.roomNumber,
        method: 'mobile',
      });

      return {
        success: true,
        action: 'submit_mobile_checkin',
        data: result.data,
        cascades: [EventTypes.GUEST_CHECK_IN_COMPLETED],
      };
    }

    return {
      success: false,
      action: 'submit_mobile_checkin',
      error: result.error || 'Mobile check-in submission failed',
    };
  }

  // =============================================
  // KIOSK CHECK-IN IMPLEMENTATIONS
  // =============================================

  protected async useKioskCheckin(): Promise<ActionResult> {
    // Find available kiosk
    const kioskResult = await this.apiCall<{ kioskId: string }>(
      'GET',
      '/api/v1/kiosk/available'
    );

    if (!kioskResult.success || !kioskResult.data) {
      return {
        success: false,
        action: 'use_kiosk_checkin',
        error: 'No kiosk available',
      };
    }

    // Start kiosk session
    const sessionResult = await this.apiCall<{ sessionId: string }>(
      'POST',
      `/api/v1/kiosk/${kioskResult.data.kioskId}/session`,
      {
        reservationId: this.guestState.reservationId,
        idDocumentScanned: true,
      }
    );

    if (!sessionResult.success || !sessionResult.data) {
      return {
        success: false,
        action: 'use_kiosk_checkin',
        error: 'Failed to start kiosk session',
      };
    }

    // Complete check-in
    const checkInResult = await this.apiCall<{ roomNumber: string; keyEncoded: boolean }>(
      'POST',
      `/api/v1/kiosk/${kioskResult.data.kioskId}/check-in`,
      {
        sessionId: sessionResult.data.sessionId,
        paymentAuthorized: true,
      }
    );

    if (checkInResult.success && checkInResult.data) {
      this.guestState.isCheckedIn = true;
      this.guestState.roomNumber = checkInResult.data.roomNumber;
      this.guestState.checkInTime = this.eventBus.getSimulationTime();
      this.guestState.currentLocation = 'room';

      this.emitEvent(EventTypes.GUEST_CHECK_IN_COMPLETED, 'kiosk', {
        guestId: this.id,
        roomNumber: checkInResult.data.roomNumber,
        method: 'kiosk',
        kioskId: kioskResult.data.kioskId,
      });

      return {
        success: true,
        action: 'use_kiosk_checkin',
        data: checkInResult.data,
        cascades: [EventTypes.GUEST_CHECK_IN_COMPLETED],
      };
    }

    return {
      success: false,
      action: 'use_kiosk_checkin',
      error: checkInResult.error || 'Kiosk check-in failed',
    };
  }

  // =============================================
  // BILLING IMPLEMENTATIONS
  // =============================================

  protected async disputeCharge(): Promise<ActionResult> {
    const result = await this.apiCall<{ disputeId: string; status: string }>(
      'POST',
      `/api/v1/billing/disputes`,
      {
        guestId: this.id,
        roomNumber: this.guestState.roomNumber,
        reason: 'I do not recognize this charge',
        amount: Math.floor(Math.random() * 50) + 10,
      }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.CHARGE_DISPUTED, 'billing', {
        guestId: this.id,
        disputeId: result.data.disputeId,
      });

      return {
        success: true,
        action: 'dispute_charge',
        data: result.data,
        cascades: [EventTypes.CHARGE_DISPUTED],
      };
    }

    return {
      success: false,
      action: 'dispute_charge',
      error: result.error || 'Failed to dispute charge',
    };
  }

  protected async requestInvoice(): Promise<ActionResult> {
    const result = await this.apiCall<{ invoiceId: string; pdfUrl: string }>(
      'POST',
      `/api/v1/billing/invoices`,
      {
        guestId: this.id,
        roomNumber: this.guestState.roomNumber,
        companyName: 'Simulation Corp',
        taxId: 'SIM-12345',
      }
    );

    if (result.success && result.data) {
      return {
        success: true,
        action: 'request_invoice',
        data: result.data,
      };
    }

    return {
      success: false,
      action: 'request_invoice',
      error: result.error || 'Failed to generate invoice',
    };
  }

  // =============================================
  // GDPR IMPLEMENTATIONS
  // =============================================

  protected async requestDataExport(): Promise<ActionResult> {
    const result = await this.apiCall<{ requestId: string; estimatedCompletion: string }>(
      'POST',
      '/api/v1/gdpr/data-export',
      {
        guestId: this.id,
        email: `${this.id}@simulation.test`,
        format: 'json',
      }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.GDPR_DATA_EXPORT_REQUESTED, 'gdpr', {
        guestId: this.id,
        requestId: result.data.requestId,
      });

      return {
        success: true,
        action: 'request_data_export',
        data: result.data,
        cascades: [EventTypes.GDPR_DATA_EXPORT_REQUESTED],
      };
    }

    return {
      success: false,
      action: 'request_data_export',
      error: result.error || 'Failed to request data export',
    };
  }

  protected async manageConsent(): Promise<ActionResult> {
    const result = await this.apiCall<{ updated: boolean }>(
      'PUT',
      `/api/v1/gdpr/consent/${this.id}`,
      {
        marketing: Math.random() > 0.3,
        analytics: true,
        thirdParty: Math.random() > 0.5,
      }
    );

    if (result.success) {
      return {
        success: true,
        action: 'manage_consent',
        data: { updated: true },
      };
    }

    return {
      success: false,
      action: 'manage_consent',
      error: result.error || 'Failed to update consent',
    };
  }

  // =============================================
  // MOBILE APP IMPLEMENTATIONS
  // =============================================

  protected async registerMobileDevice(): Promise<ActionResult> {
    const result = await this.apiCall<{ deviceId: string }>(
      'POST',
      '/api/v1/mobile/devices',
      {
        guestId: this.id,
        platform: Math.random() > 0.5 ? 'ios' : 'android',
        deviceToken: `simulation_device_${this.id}_${Date.now()}`,
      }
    );

    if (result.success && result.data) {
      this.setState('mobileDeviceRegistered', true);
      this.setState('deviceId', result.data.deviceId);

      return {
        success: true,
        action: 'register_mobile_device',
        data: result.data,
      };
    }

    return {
      success: false,
      action: 'register_mobile_device',
      error: result.error || 'Failed to register device',
    };
  }

  protected async enablePushNotifications(): Promise<ActionResult> {
    const deviceId = this.getState('deviceId');

    const result = await this.apiCall<{ enabled: boolean }>(
      'PUT',
      `/api/v1/mobile/devices/${deviceId}/notifications`,
      {
        enabled: true,
        categories: ['booking', 'marketing', 'service'],
      }
    );

    if (result.success) {
      this.setState('pushEnabled', true);

      return {
        success: true,
        action: 'enable_push_notifications',
        data: { enabled: true },
      };
    }

    return {
      success: false,
      action: 'enable_push_notifications',
      error: result.error || 'Failed to enable notifications',
    };
  }

  // =============================================
  // CHALET IMPLEMENTATIONS
  // =============================================

  protected async browseChalets(): Promise<ActionResult> {
    const result = await this.apiCall<{ chalets: Array<{ id: string; name: string; type: string; capacity: number; pricePerDay: number }> }>(
      'GET',
      '/api/v1/chalets?available=true'
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.CHALET_BROWSED, 'chalet', {
        guestId: this.id,
        chaletCount: result.data.chalets.length,
      });

      // Store available chalets for potential booking
      this.setState('availableChalets', result.data.chalets);

      return {
        success: true,
        action: 'browse_chalets',
        data: { chaletCount: result.data.chalets.length },
      };
    }

    return {
      success: false,
      action: 'browse_chalets',
      error: result.error || 'Failed to browse chalets',
    };
  }

  protected async checkChaletAvailability(): Promise<ActionResult> {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + Math.floor(Math.random() * 7));
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + Math.floor(Math.random() * 3) + 1);

    const result = await this.apiCall<{ available: boolean; chalets: Array<{ id: string; pricePerDay: number }> }>(
      'GET',
      `/api/v1/chalets/availability?checkIn=${checkIn.toISOString()}&checkOut=${checkOut.toISOString()}`
    );

    if (result.success && result.data) {
      return {
        success: true,
        action: 'check_chalet_availability',
        data: {
          available: result.data.available,
          chaletCount: result.data.chalets?.length || 0,
        },
      };
    }

    return {
      success: false,
      action: 'check_chalet_availability',
      error: result.error || 'Failed to check availability',
    };
  }

  protected async bookChalet(): Promise<ActionResult> {
    const availableChalets = this.getState('availableChalets') as Array<{ id: string; name: string }>;
    
    if (!availableChalets || availableChalets.length === 0) {
      return {
        success: false,
        action: 'book_chalet',
        error: 'No chalets available to book',
      };
    }

    const chalet = availableChalets[Math.floor(Math.random() * availableChalets.length)];
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 1);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + Math.floor(Math.random() * 3) + 1);

    const result = await this.apiCall<{ bookingId: string; totalAmount: number }>(
      'POST',
      '/api/v1/chalets/bookings',
      {
        chaletId: chalet.id,
        guestId: this.id,
        checkInDate: checkIn.toISOString(),
        checkOutDate: checkOut.toISOString(),
        guestCount: Math.floor(Math.random() * 4) + 1,
        specialRequests: this.profile.specialRequests?.join(', ') || null,
      }
    );

    if (result.success && result.data) {
      this.setState('hasChaletBooking', true);
      this.setState('chaletBookingId', result.data.bookingId);

      this.emitEvent(EventTypes.CHALET_BOOKED, 'chalet', {
        guestId: this.id,
        bookingId: result.data.bookingId,
        chaletId: chalet.id,
        totalAmount: result.data.totalAmount,
      });

      return {
        success: true,
        action: 'book_chalet',
        data: result.data,
        cascades: [EventTypes.CHALET_BOOKED],
      };
    }

    return {
      success: false,
      action: 'book_chalet',
      error: result.error || 'Failed to book chalet',
    };
  }

  protected async cancelChaletBooking(): Promise<ActionResult> {
    const bookingId = this.getState('chaletBookingId');

    if (!bookingId) {
      return {
        success: false,
        action: 'cancel_chalet_booking',
        error: 'No chalet booking to cancel',
      };
    }

    const result = await this.apiCall<{ cancelled: boolean; refundAmount?: number }>(
      'POST',
      `/api/v1/chalets/bookings/${bookingId}/cancel`
    );

    if (result.success && result.data) {
      this.setState('hasChaletBooking', false);
      this.setState('chaletBookingId', null);

      this.emitEvent(EventTypes.CHALET_BOOKING_CANCELLED, 'chalet', {
        guestId: this.id,
        bookingId: bookingId,
        refundAmount: result.data.refundAmount,
      });

      return {
        success: true,
        action: 'cancel_chalet_booking',
        data: result.data,
        cascades: [EventTypes.CHALET_BOOKING_CANCELLED],
      };
    }

    return {
      success: false,
      action: 'cancel_chalet_booking',
      error: result.error || 'Failed to cancel booking',
    };
  }

  protected async viewChaletAddons(): Promise<ActionResult> {
    const result = await this.apiCall<{ addOns: Array<{ id: string; name: string; price: number; description: string }> }>(
      'GET',
      '/api/v1/chalets/add-ons'
    );

    if (result.success && result.data) {
      this.setState('chaletAddOns', result.data.addOns);

      return {
        success: true,
        action: 'view_chalet_addons',
        data: { addOnCount: result.data.addOns.length },
      };
    }

    return {
      success: false,
      action: 'view_chalet_addons',
      error: result.error || 'Failed to fetch add-ons',
    };
  }

  // =============================================
  // SNACK BAR IMPLEMENTATIONS
  // =============================================

  protected async browseSnackMenu(): Promise<ActionResult> {
    const result = await this.apiCall<{ categories: Array<{ id: string; name: string; items: Array<{ id: string; name: string; price: number }> }> }>(
      'GET',
      '/api/v1/snack/categories'
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.SNACK_MENU_BROWSED, 'snack', {
        guestId: this.id,
        categoryCount: result.data.categories.length,
      });

      this.setState('snackMenu', result.data.categories);

      return {
        success: true,
        action: 'browse_snack_menu',
        data: { categoryCount: result.data.categories.length },
      };
    }

    return {
      success: false,
      action: 'browse_snack_menu',
      error: result.error || 'Failed to browse snack menu',
    };
  }

  protected async orderFromSnackBar(): Promise<ActionResult> {
    const snackMenu = this.getState('snackMenu') as Array<{ id: string; name: string; items: Array<{ id: string; name: string; price: number }> }>;
    
    // If no menu cached, fetch items directly
    if (!snackMenu || snackMenu.length === 0) {
      const itemsResult = await this.apiCall<{ items: Array<{ id: string; name: string; price: number }> }>(
        'GET',
        '/api/v1/snack/items?available=true'
      );

      if (!itemsResult.success || !itemsResult.data?.items.length) {
        return {
          success: false,
          action: 'order_from_snack_bar',
          error: 'No snack items available',
        };
      }

      // Select 1-3 random items
      const items = itemsResult.data.items;
      const orderItems: Array<{ itemId: string; quantity: number }> = [];
      const itemCount = Math.min(items.length, Math.floor(Math.random() * 3) + 1);
      
      for (let i = 0; i < itemCount; i++) {
        const item = items[Math.floor(Math.random() * items.length)];
        orderItems.push({
          itemId: item.id,
          quantity: Math.floor(Math.random() * 2) + 1,
        });
      }

      const result = await this.apiCall<{ orderId: string; totalAmount: number; estimatedWaitMinutes: number }>(
        'POST',
        '/api/v1/snack/orders',
        {
          guestId: this.id,
          items: orderItems,
          deliveryLocation: this.guestState.currentLocation || 'pool',
          notes: null,
        }
      );

      if (result.success && result.data) {
        this.setState('hasSnackOrder', true);
        this.setState('snackOrderId', result.data.orderId);

        this.emitEvent(EventTypes.SNACK_ORDER_PLACED, 'snack', {
          guestId: this.id,
          orderId: result.data.orderId,
          totalAmount: result.data.totalAmount,
          itemCount: orderItems.length,
        });

        // Reduce hunger since food is coming
        this.guestState.hungerLevel = Math.max(0, this.guestState.hungerLevel - 20);

        return {
          success: true,
          action: 'order_from_snack_bar',
          data: result.data,
          cascades: [EventTypes.SNACK_ORDER_PLACED],
        };
      }

      return {
        success: false,
        action: 'order_from_snack_bar',
        error: result.error || 'Failed to place snack order',
      };
    }

    // Use cached menu
    const allItems = snackMenu.flatMap(cat => cat.items);
    const orderItems: Array<{ itemId: string; quantity: number }> = [];
    const itemCount = Math.min(allItems.length, Math.floor(Math.random() * 3) + 1);
    
    for (let i = 0; i < itemCount; i++) {
      const item = allItems[Math.floor(Math.random() * allItems.length)];
      orderItems.push({
        itemId: item.id,
        quantity: Math.floor(Math.random() * 2) + 1,
      });
    }

    const result = await this.apiCall<{ orderId: string; totalAmount: number; estimatedWaitMinutes: number }>(
      'POST',
      '/api/v1/snack/orders',
      {
        guestId: this.id,
        items: orderItems,
        deliveryLocation: this.guestState.currentLocation || 'pool',
        notes: null,
      }
    );

    if (result.success && result.data) {
      this.setState('hasSnackOrder', true);
      this.setState('snackOrderId', result.data.orderId);

      this.emitEvent(EventTypes.SNACK_ORDER_PLACED, 'snack', {
        guestId: this.id,
        orderId: result.data.orderId,
        totalAmount: result.data.totalAmount,
        itemCount: orderItems.length,
      });

      this.guestState.hungerLevel = Math.max(0, this.guestState.hungerLevel - 20);

      return {
        success: true,
        action: 'order_from_snack_bar',
        data: result.data,
        cascades: [EventTypes.SNACK_ORDER_PLACED],
      };
    }

    return {
      success: false,
      action: 'order_from_snack_bar',
      error: result.error || 'Failed to place snack order',
    };
  }

  protected async checkSnackOrderStatus(): Promise<ActionResult> {
    const orderId = this.getState('snackOrderId');

    if (!orderId) {
      return {
        success: false,
        action: 'check_snack_order_status',
        error: 'No active snack order',
      };
    }

    const result = await this.apiCall<{ status: string; estimatedReadyTime?: string }>(
      'GET',
      `/api/v1/snack/orders/${orderId}/status`
    );

    if (result.success && result.data) {
      // If delivered, clear the order state
      if (result.data.status === 'delivered' || result.data.status === 'completed') {
        this.setState('hasSnackOrder', false);
        this.setState('snackOrderId', null);
        this.guestState.hungerLevel = Math.max(0, this.guestState.hungerLevel - 40);

        this.emitEvent(EventTypes.SNACK_ORDER_DELIVERED, 'snack', {
          guestId: this.id,
          orderId: orderId,
        });

        return {
          success: true,
          action: 'check_snack_order_status',
          data: result.data,
          cascades: [EventTypes.SNACK_ORDER_DELIVERED],
        };
      }

      return {
        success: true,
        action: 'check_snack_order_status',
        data: result.data,
      };
    }

    return {
      success: false,
      action: 'check_snack_order_status',
      error: result.error || 'Failed to check order status',
    };
  }

  // =============================================
  // PROMOTIONS IMPLEMENTATIONS
  // =============================================

  protected async viewActivePromotions(): Promise<ActionResult> {
    const result = await this.apiCall<{ promotions: Array<{ id: string; name: string; discountType: string; discountValue: number; validUntil: string }> }>(
      'GET',
      '/api/v1/promotions?active=true'
    );

    if (result.success && result.data) {
      this.setState('availablePromotions', result.data.promotions);
      this.setState('hasAvailablePromotion', result.data.promotions.length > 0);

      this.emitEvent(EventTypes.PROMOTION_VIEWED, 'promotion', {
        guestId: this.id,
        promotionCount: result.data.promotions.length,
      });

      return {
        success: true,
        action: 'view_active_promotions',
        data: { promotionCount: result.data.promotions.length },
      };
    }

    return {
      success: false,
      action: 'view_active_promotions',
      error: result.error || 'Failed to fetch promotions',
    };
  }

  protected async claimPromotion(): Promise<ActionResult> {
    const promotions = this.getState('availablePromotions') as Array<{ id: string; name: string }>;

    if (!promotions || promotions.length === 0) {
      return {
        success: false,
        action: 'claim_promotion',
        error: 'No promotions available to claim',
      };
    }

    const promo = promotions[Math.floor(Math.random() * promotions.length)];

    const result = await this.apiCall<{ claimed: boolean; code?: string }>(
      'POST',
      `/api/v1/promotions/${promo.id}/claim`,
      { guestId: this.id }
    );

    if (result.success && result.data) {
      this.emitEvent(EventTypes.PROMOTION_CLAIMED, 'promotion', {
        guestId: this.id,
        promotionId: promo.id,
        promotionName: promo.name,
      });

      // Remove claimed promo from available list
      const remaining = promotions.filter(p => p.id !== promo.id);
      this.setState('availablePromotions', remaining);
      this.setState('hasAvailablePromotion', remaining.length > 0);

      return {
        success: true,
        action: 'claim_promotion',
        data: result.data,
        cascades: [EventTypes.PROMOTION_CLAIMED],
      };
    }

    return {
      success: false,
      action: 'claim_promotion',
      error: result.error || 'Failed to claim promotion',
    };
  }

  /**
   * Update hunger/tiredness over time (called by orchestrator)
   */
  updateNeeds(elapsedMinutes: number): void {
    this.guestState.hungerLevel = Math.min(100, this.guestState.hungerLevel + elapsedMinutes * 0.5);
    this.guestState.tirednessLevel = Math.min(100, this.guestState.tirednessLevel + elapsedMinutes * 0.2);
  }

  /**
   * Modify satisfaction
   */
  adjustSatisfaction(delta: number): void {
    this.guestState.satisfactionLevel = Math.max(0, Math.min(100, this.guestState.satisfactionLevel + delta));
  }

  /**
   * Get guest state
   */
  getGuestState(): GuestState {
    return { ...this.guestState };
  }

  /**
   * Get profile
   */
  getProfile(): GuestProfile {
    return { ...this.profile };
  }
}
