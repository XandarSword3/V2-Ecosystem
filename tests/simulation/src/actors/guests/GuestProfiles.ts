/**
 * Guest Profile Types - Different guest personas
 */

import { GuestBot, GuestConfig, GuestProfile } from './GuestBot';

/**
 * Business Traveler
 * Impatient, efficiency-focused, expense account dining
 */
export class BusinessTravelerBot extends GuestBot {
  constructor(config: Omit<GuestConfig, 'profile' | 'type' | 'role'> & { profile?: Partial<GuestProfile> }) {
    const defaultProfile: GuestProfile = {
      budgetLevel: 'luxury',
      pace: 'fast',
      complaintLikelihood: 0.4, // More likely to complain about time issues
      tipPercentage: 20,
      preferredDiningTimes: [7, 12, 19], // Early breakfast, quick lunch, early dinner
      preferredActivities: ['gym', 'business_center', 'bar'],
      dietaryRestrictions: [],
      specialRequests: ['Early check-in', 'Express check-out', 'Quiet room'],
    };

    super({
      ...config,
      role: 'business_traveler',
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Business travelers prioritize efficiency
    this.registerAction({
      name: 'request_early_checkout',
      weight: 3,
      preconditions: () => {
        const simTime = this.eventBus.getSimulationTime();
        const hoursUntilDeparture = (this.departureDate.getTime() - simTime.getTime()) / (1000 * 60 * 60);
        return hoursUntilDeparture < 24 && hoursUntilDeparture > 2;
      },
      execute: async () => this.requestExpressCheckout(),
    });

    // Use business center
    this.registerAction({
      name: 'use_business_center',
      weight: 4,
      cooldown: 3 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => {
        this.guestState.currentLocation = 'business_center';
        return { success: true, action: 'use_business_center', data: { location: 'business_center' } };
      },
    });
  }

  private async requestExpressCheckout(): Promise<{ success: boolean; action: string; data?: any; error?: string }> {
    const result = await this.apiCall('POST', '/api/v1/front-desk/express-checkout', {
      roomNumber: this.guestState.roomNumber,
      emailReceipt: true,
    });

    return {
      success: result.success,
      action: 'request_early_checkout',
      data: result.data,
      error: result.error,
    };
  }
}

/**
 * Family Vacationer
 * Careful with spending, needs kid-friendly options
 */
export class FamilyVacationerBot extends GuestBot {
  private childrenCount: number;

  constructor(config: Omit<GuestConfig, 'profile' | 'type' | 'role'> & { 
    profile?: Partial<GuestProfile>;
    childrenCount?: number;
  }) {
    const defaultProfile: GuestProfile = {
      budgetLevel: 'mid',
      pace: 'moderate',
      complaintLikelihood: 0.3,
      tipPercentage: 15,
      preferredDiningTimes: [8, 12, 18], // Family-friendly times
      preferredActivities: ['capacity', 'kids_club', 'menu_service'],
      dietaryRestrictions: [],
      specialRequests: ['Connecting rooms', 'Crib', 'Kids menu'],
    };

    super({
      ...config,
      role: 'family_vacationer',
      profile: { ...defaultProfile, ...config.profile },
    });

    this.childrenCount = config.childrenCount || 2;
  }

  protected registerActions(): void {
    super.registerActions();

    // Drop kids at kids club
    this.registerAction({
      name: 'use_kids_club',
      weight: 5,
      cooldown: 2 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn && this.childrenCount > 0,
      execute: async () => {
        this.guestState.currentLocation = 'kids_club';
        return { success: true, action: 'use_kids_club', data: { childrenCount: this.childrenCount } };
      },
    });

    // Order kids meals
    this.registerAction({
      name: 'order_kids_meals',
      weight: 4,
      preconditions: () => 
        this.guestState.currentLocation === 'menu_service' && 
        this.childrenCount > 0,
      execute: async () => this.orderKidsMeals(),
    });
  }

  private async orderKidsMeals(): Promise<{ success: boolean; action: string; data?: any; error?: string }> {
    const result = await this.apiCall('POST', '/api/v1/orders', {
      items: [
        { menuItemId: 'kids_chicken_fingers', quantity: this.childrenCount },
        { menuItemId: 'kids_fries', quantity: this.childrenCount },
      ],
      roomNumber: this.guestState.roomNumber,
      notes: 'Kids meals - no nuts please',
    });

    return {
      success: result.success,
      action: 'order_kids_meals',
      data: result.data,
      error: result.error,
    };
  }

  protected selectMenuItems(): Array<{ menuItemId: string; quantity: number }> {
    // Families order more, more variety
    return [
      { menuItemId: 'appetizer_' + Math.ceil(Math.random() * 5), quantity: 2 },
      { menuItemId: 'main_' + Math.ceil(Math.random() * 10), quantity: 2 },
      { menuItemId: 'kids_meal_' + Math.ceil(Math.random() * 5), quantity: this.childrenCount },
      { menuItemId: 'drink_' + Math.ceil(Math.random() * 8), quantity: 2 + this.childrenCount },
    ];
  }
}

/**
 * Luxury Seeker
 * High expectations, premium services, spa enthusiast
 */
export class LuxurySeekerBot extends GuestBot {
  constructor(config: Omit<GuestConfig, 'profile' | 'type' | 'role'> & { profile?: Partial<GuestProfile> }) {
    const defaultProfile: GuestProfile = {
      budgetLevel: 'luxury',
      pace: 'relaxed',
      complaintLikelihood: 0.5, // High standards = more complaints
      tipPercentage: 25,
      preferredDiningTimes: [10, 14, 20], // Leisurely times
      preferredActivities: ['spa', 'fine_dining', 'capacity', 'cabana'],
      dietaryRestrictions: ['gluten-free'],
      specialRequests: ['Suite upgrade', 'Champagne on arrival', 'Turn-down service'],
    };

    super({
      ...config,
      role: 'luxury_seeker',
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Book cabana
    this.registerAction({
      name: 'book_cabana',
      weight: 4,
      cooldown: 24 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.bookCabana(),
    });

    // Request suite upgrade
    this.registerAction({
      name: 'request_upgrade',
      weight: 2,
      preconditions: () => this.guestState.isCheckedIn && !this.getState('upgradeRequested'),
      execute: async () => this.requestUpgrade(),
    });

    // Fine dining reservation
    this.registerAction({
      name: 'book_fine_dining',
      weight: 5,
      cooldown: 12 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.bookFineDining(),
    });
  }

  private async bookCabana(): Promise<{ success: boolean; action: string; data?: any; error?: string }> {
    const result = await this.apiCall('POST', '/api/v1/pool/cabanas', {
      guestId: this.id,
      date: this.eventBus.getSimulationTime().toISOString().split('T')[0],
      fullDay: true,
    });

    return {
      success: result.success,
      action: 'book_cabana',
      data: result.data,
      error: result.error,
    };
  }

  private async requestUpgrade(): Promise<{ success: boolean; action: string; data?: any; error?: string }> {
    this.setState('upgradeRequested', true);
    
    const result = await this.apiCall('POST', '/api/v1/front-desk/upgrade-request', {
      roomNumber: this.guestState.roomNumber,
      requestedType: 'suite',
      willingToPay: true,
    });

    return {
      success: result.success,
      action: 'request_upgrade',
      data: result.data,
      error: result.error,
    };
  }

  private async bookFineDining(): Promise<{ success: boolean; action: string; data?: any; error?: string }> {
    const result = await this.apiCall('POST', '/api/v1/menu services/reservations', {
      guestId: this.id,
      menu service: 'fine_dining',
      partySize: this.partySize,
      time: '19:30',
      specialRequests: 'Window table preferred',
    });

    return {
      success: result.success,
      action: 'book_fine_dining',
      data: result.data,
      error: result.error,
    };
  }

  protected selectMenuItems(): Array<{ menuItemId: string; quantity: number }> {
    // Luxury seekers order premium items
    return [
      { menuItemId: 'premium_appetizer_' + Math.ceil(Math.random() * 5), quantity: 1 },
      { menuItemId: 'premium_main_' + Math.ceil(Math.random() * 8), quantity: 1 },
      { menuItemId: 'wine_pairing', quantity: 1 },
      { menuItemId: 'dessert_' + Math.ceil(Math.random() * 5), quantity: 1 },
    ];
  }
}

/**
 * Budget Conscious Guest
 * Value-focused, uses coupons, avoids extras
 */
export class BudgetConsciousBot extends GuestBot {
  constructor(config: Omit<GuestConfig, 'profile' | 'type' | 'role'> & { profile?: Partial<GuestProfile> }) {
    const defaultProfile: GuestProfile = {
      budgetLevel: 'budget',
      pace: 'moderate',
      complaintLikelihood: 0.2,
      tipPercentage: 10,
      preferredDiningTimes: [7, 11, 17], // Off-peak for deals
      preferredActivities: ['capacity', 'beach', 'free_amenities'],
      dietaryRestrictions: [],
      specialRequests: [],
    };

    super({
      ...config,
      role: 'budget_conscious',
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Check for deals
    this.registerAction({
      name: 'check_deals',
      weight: 5,
      cooldown: 4 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.checkDeals(),
    });

    // Use free amenities
    this.registerAction({
      name: 'use_free_amenities',
      weight: 6,
      cooldown: 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => {
        const amenities = ['capacity', 'beach', 'gym', 'garden'];
        const selected = amenities[Math.floor(Math.random() * amenities.length)];
        this.guestState.currentLocation = selected;
        return { success: true, action: 'use_free_amenities', data: { amenity: selected } };
      },
    });
  }

  private async checkDeals(): Promise<{ success: boolean; action: string; data?: any; error?: string }> {
    const result = await this.apiCall<{ deals: any[] }>('GET', '/api/v1/promotions/current');

    return {
      success: result.success,
      action: 'check_deals',
      data: result.data,
      error: result.error,
    };
  }

  protected selectMenuItems(): Array<{ menuItemId: string; quantity: number }> {
    // Budget guests order minimal
    return [
      { menuItemId: 'value_meal_' + Math.ceil(Math.random() * 5), quantity: 1 },
      { menuItemId: 'water', quantity: 1 },
    ];
  }
}

/**
 * Honeymooner
 * Romantic packages, privacy, special occasions
 */
export class HoneymoonerBot extends GuestBot {
  constructor(config: Omit<GuestConfig, 'profile' | 'type' | 'role'> & { profile?: Partial<GuestProfile> }) {
    const defaultProfile: GuestProfile = {
      budgetLevel: 'luxury',
      pace: 'relaxed',
      complaintLikelihood: 0.4, // Want everything perfect
      tipPercentage: 20,
      preferredDiningTimes: [10, 19], // Late breakfast, romantic dinner
      preferredActivities: ['spa', 'couples_massage', 'fine_dining', 'sunset_cruise'],
      dietaryRestrictions: [],
      specialRequests: ['Rose petals on bed', 'Champagne', 'Late checkout'],
    };

    super({
      ...config,
      role: 'honeymooner',
      partySize: 2,
      profile: { ...defaultProfile, ...config.profile },
    });
  }

  protected registerActions(): void {
    super.registerActions();

    // Book couples spa
    this.registerAction({
      name: 'book_couples_spa',
      weight: 6,
      cooldown: 24 * 60 * 60 * 1000,
      preconditions: () => this.guestState.isCheckedIn,
      execute: async () => this.bookCouplesSpa(),
    });

    // Request romantic setup
    this.registerAction({
      name: 'request_romantic_setup',
      weight: 4,
      preconditions: () => this.guestState.isCheckedIn && !this.getState('romanticSetupRequested'),
      execute: async () => this.requestRomanticSetup(),
    });
  }

  private async bookCouplesSpa(): Promise<{ success: boolean; action: string; data?: any; error?: string }> {
    const result = await this.apiCall('POST', '/api/v1/spa/couples-packages', {
      guestId: this.id,
      package: 'honeymoon_special',
      duration: 120,
    });

    return {
      success: result.success,
      action: 'book_couples_spa',
      data: result.data,
      error: result.error,
    };
  }

  private async requestRomanticSetup(): Promise<{ success: boolean; action: string; data?: any; error?: string }> {
    this.setState('romanticSetupRequested', true);

    const result = await this.apiCall('POST', '/api/v1/housekeeping/special-requests', {
      roomNumber: this.guestState.roomNumber,
      type: 'romantic_setup',
      items: ['rose_petals', 'champagne', 'candles', 'chocolate_strawberries'],
    });

    return {
      success: result.success,
      action: 'request_romantic_setup',
      data: result.data,
      error: result.error,
    };
  }
}

/**
 * Group/Conference Attendee
 * Event-focused, shared activities, networking
 */
export class ConferenceAttendeeBot extends GuestBot {
  private eventId: string;

  constructor(config: Omit<GuestConfig, 'profile' | 'type' | 'role'> & { 
    profile?: Partial<GuestProfile>;
    eventId: string;
  }) {
    const defaultProfile: GuestProfile = {
      budgetLevel: 'mid',
      pace: 'fast',
      complaintLikelihood: 0.2,
      tipPercentage: 15,
      preferredDiningTimes: [7, 12, 19],
      preferredActivities: ['conference_center', 'networking', 'bar'],
      dietaryRestrictions: [],
      specialRequests: [],
    };

    super({
      ...config,
      role: 'conference_attendee',
      profile: { ...defaultProfile, ...config.profile },
    });

    this.eventId = config.eventId;
  }

  protected registerActions(): void {
    super.registerActions();

    // Attend session
    this.registerAction({
      name: 'attend_session',
      weight: 8,
      cooldown: 60 * 60 * 1000,
      preconditions: () => {
        const hour = this.eventBus.getSimulationTime().getHours();
        return this.guestState.isCheckedIn && hour >= 8 && hour <= 17;
      },
      execute: async () => {
        this.guestState.currentLocation = 'conference_center';
        return { success: true, action: 'attend_session', data: { eventId: this.eventId } };
      },
    });

    // Network at bar
    this.registerAction({
      name: 'network_at_bar',
      weight: 4,
      preconditions: () => {
        const hour = this.eventBus.getSimulationTime().getHours();
        return this.guestState.isCheckedIn && hour >= 17;
      },
      execute: async () => {
        this.guestState.currentLocation = 'bar';
        return { success: true, action: 'network_at_bar', data: { location: 'bar' } };
      },
    });
  }
}

// Export factory function
export function createGuestBot(
  type: 'business' | 'family' | 'luxury' | 'budget' | 'honeymoon' | 'conference',
  config: Omit<GuestConfig, 'profile' | 'type' | 'role'> & { profile?: Partial<GuestProfile>; eventId?: string; childrenCount?: number }
): GuestBot {
  switch (type) {
    case 'business':
      return new BusinessTravelerBot(config);
    case 'family':
      return new FamilyVacationerBot(config);
    case 'luxury':
      return new LuxurySeekerBot(config);
    case 'budget':
      return new BudgetConsciousBot(config);
    case 'honeymoon':
      return new HoneymoonerBot(config);
    case 'conference':
      if (!config.eventId) throw new Error('Conference attendee requires eventId');
      return new ConferenceAttendeeBot({ ...config, eventId: config.eventId });
    default:
      return new GuestBot(config as GuestConfig);
  }
}
