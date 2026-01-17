/**
 * Chalet Repository - In-Memory Test Implementation
 * 
 * Implements ChaletRepository interface using in-memory storage for testing.
 * Provides test helpers for seeding and inspecting data.
 */

import type {
  Chalet,
  ChaletBooking,
  ChaletBookingAddOn,
  ChaletAddOn,
  ChaletPriceRule,
  ChaletRepository,
} from '../container/types.js';
import dayjs from 'dayjs';

export interface InMemoryChaletRepository extends ChaletRepository {
  // Test helpers
  addChalet(chalet: Chalet): void;
  addBooking(booking: ChaletBooking): void;
  addBookingAddOn(addOn: ChaletBookingAddOn): void;
  addAddOn(addOn: ChaletAddOn): void;
  addPriceRule(rule: ChaletPriceRule): void;
  setSettings(settings: Record<string, unknown>): void;
  clear(): void;
  getAllChalets(): Chalet[];
  getAllBookings(): ChaletBooking[];
  getAllAddOns(): ChaletAddOn[];
  getAllPriceRules(): ChaletPriceRule[];
}

export function createInMemoryChaletRepository(): InMemoryChaletRepository {
  // Storage
  const chalets = new Map<string, Chalet>();
  const bookings = new Map<string, ChaletBooking>();
  const bookingsByNumber = new Map<string, ChaletBooking>();
  const bookingAddOns = new Map<string, ChaletBookingAddOn[]>();
  const addOns = new Map<string, ChaletAddOn>();
  const priceRules = new Map<string, ChaletPriceRule>();
  let settings: Record<string, unknown> = {
    deposit_percentage: 30,
    check_in_time: '14:00',
    check_out_time: '11:00',
    deposit_type: 'percentage',
    deposit_fixed: 100,
  };

  let nextId = 1;
  const generateId = () => `chalet-item-${nextId++}`;

  return {
    // ============================================
    // CHALET OPERATIONS
    // ============================================
    
    async getChalets(filters = {}) {
      let result = Array.from(chalets.values()).filter(c => !c.deleted_at);
      
      if (filters.moduleId) {
        result = result.filter(c => c.module_id === filters.moduleId);
      }
      if (filters.activeOnly !== false) {
        result = result.filter(c => c.is_active);
      }
      
      return result;
    },

    async getChaletById(id: string) {
      return chalets.get(id) || null;
    },

    async createChalet(chaletData) {
      const now = new Date().toISOString();
      const chalet: Chalet = {
        ...chaletData,
        id: generateId(),
        created_at: now,
        updated_at: now,
      };
      chalets.set(chalet.id, chalet);
      return chalet;
    },

    async updateChalet(id: string, updates) {
      const chalet = chalets.get(id);
      if (!chalet) throw new Error('Chalet not found');
      
      const updated: Chalet = {
        ...chalet,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      chalets.set(id, updated);
      return updated;
    },

    async deleteChalet(id: string) {
      const chalet = chalets.get(id);
      if (chalet) {
        chalet.deleted_at = new Date().toISOString();
        chalets.set(id, chalet);
      }
    },

    // ============================================
    // BOOKING OPERATIONS
    // ============================================

    async createBooking(bookingData) {
      const now = new Date().toISOString();
      const booking: ChaletBooking = {
        ...bookingData,
        id: generateId(),
        created_at: now,
        updated_at: now,
      };
      bookings.set(booking.id, booking);
      bookingsByNumber.set(booking.booking_number, booking);
      bookingAddOns.set(booking.id, []);
      return booking;
    },

    async getBookingById(id: string) {
      return bookings.get(id) || null;
    },

    async getBookingByNumber(bookingNumber: string) {
      return bookingsByNumber.get(bookingNumber) || null;
    },

    async getBookings(filters) {
      let result = Array.from(bookings.values()).filter(b => !b.deleted_at);
      
      if (filters.status) result = result.filter(b => b.status === filters.status);
      if (filters.chaletId) result = result.filter(b => b.chalet_id === filters.chaletId);
      if (filters.startDate) result = result.filter(b => b.check_in_date >= filters.startDate!);
      if (filters.endDate) result = result.filter(b => b.check_in_date <= filters.endDate!);
      
      return result.sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));
    },

    async getBookingsByCustomer(customerId: string) {
      return Array.from(bookings.values())
        .filter(b => b.customer_id === customerId && !b.deleted_at)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async getBookingsForChalet(chaletId: string, startDate?: string, endDate?: string) {
      let result = Array.from(bookings.values())
        .filter(b => b.chalet_id === chaletId && !b.deleted_at);
      
      if (startDate) result = result.filter(b => b.check_out_date >= startDate);
      if (endDate) result = result.filter(b => b.check_in_date <= endDate);
      
      return result;
    },

    async getTodayBookings() {
      const today = dayjs().format('YYYY-MM-DD');
      const allBookings = Array.from(bookings.values()).filter(b => !b.deleted_at);
      
      return {
        checkIns: allBookings.filter(b => b.check_in_date.startsWith(today)),
        checkOuts: allBookings.filter(b => b.check_out_date.startsWith(today)),
      };
    },

    async updateBooking(id: string, updates) {
      const booking = bookings.get(id);
      if (!booking) throw new Error('Booking not found');
      
      const updated: ChaletBooking = {
        ...booking,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      bookings.set(id, updated);
      
      // Update number index if booking number changed
      if (updates.booking_number && updates.booking_number !== booking.booking_number) {
        bookingsByNumber.delete(booking.booking_number);
        bookingsByNumber.set(updated.booking_number, updated);
      } else {
        bookingsByNumber.set(updated.booking_number, updated);
      }
      
      return updated;
    },

    // ============================================
    // BOOKING ADD-ONS
    // ============================================

    async createBookingAddOns(addOnData) {
      const now = new Date().toISOString();
      const created: ChaletBookingAddOn[] = addOnData.map(item => ({
        ...item,
        id: generateId(),
        created_at: now,
      }));
      
      for (const addOn of created) {
        const existing = bookingAddOns.get(addOn.booking_id) || [];
        existing.push(addOn);
        bookingAddOns.set(addOn.booking_id, existing);
      }
      
      return created;
    },

    async getBookingAddOns(bookingId: string) {
      return bookingAddOns.get(bookingId) || [];
    },

    // ============================================
    // ADD-ON OPERATIONS
    // ============================================

    async getAddOns(activeOnly = true) {
      let result = Array.from(addOns.values());
      if (activeOnly) result = result.filter(a => a.is_active);
      return result;
    },

    async getAddOnById(id: string) {
      return addOns.get(id) || null;
    },

    async getAddOnsByIds(ids: string[]) {
      return ids.map(id => addOns.get(id)).filter((a): a is ChaletAddOn => a !== undefined);
    },

    async createAddOn(addOnData) {
      const now = new Date().toISOString();
      const addOn: ChaletAddOn = {
        ...addOnData,
        id: generateId(),
        created_at: now,
        updated_at: now,
      };
      addOns.set(addOn.id, addOn);
      return addOn;
    },

    async updateAddOn(id: string, updates) {
      const addOn = addOns.get(id);
      if (!addOn) throw new Error('Add-on not found');
      
      const updated: ChaletAddOn = {
        ...addOn,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      addOns.set(id, updated);
      return updated;
    },

    async deleteAddOn(id: string) {
      const addOn = addOns.get(id);
      if (addOn) {
        addOn.is_active = false;
        addOns.set(id, addOn);
      }
    },

    // ============================================
    // PRICE RULE OPERATIONS
    // ============================================

    async getPriceRules(chaletId?: string) {
      let result = Array.from(priceRules.values());
      if (chaletId) result = result.filter(r => r.chalet_id === chaletId);
      return result.sort((a, b) => a.start_date.localeCompare(b.start_date));
    },

    async createPriceRule(ruleData) {
      const now = new Date().toISOString();
      const rule: ChaletPriceRule = {
        ...ruleData,
        id: generateId(),
        created_at: now,
        updated_at: now,
      };
      priceRules.set(rule.id, rule);
      return rule;
    },

    async updatePriceRule(id: string, updates) {
      const rule = priceRules.get(id);
      if (!rule) throw new Error('Price rule not found');
      
      const updated: ChaletPriceRule = {
        ...rule,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      priceRules.set(id, updated);
      return updated;
    },

    async deletePriceRule(id: string) {
      const rule = priceRules.get(id);
      if (rule) {
        rule.is_active = false;
        priceRules.set(id, rule);
      }
    },

    // ============================================
    // SETTINGS OPERATIONS
    // ============================================

    async getChaletSettings() {
      return {
        deposit_percentage: (settings.deposit_percentage as number) || 30,
        check_in_time: (settings.check_in_time as string) || '14:00',
        check_out_time: (settings.check_out_time as string) || '11:00',
        deposit_type: (settings.deposit_type as 'percentage' | 'fixed') || 'percentage',
        deposit_fixed: (settings.deposit_fixed as number) || 100,
      };
    },

    async updateChaletSettings(newSettings: Record<string, unknown>) {
      settings = { ...settings, ...newSettings };
    },

    // ============================================
    // TEST HELPERS
    // ============================================

    addChalet(chalet: Chalet) {
      chalets.set(chalet.id, chalet);
    },

    addBooking(booking: ChaletBooking) {
      bookings.set(booking.id, booking);
      bookingsByNumber.set(booking.booking_number, booking);
      if (!bookingAddOns.has(booking.id)) {
        bookingAddOns.set(booking.id, []);
      }
    },

    addBookingAddOn(addOn: ChaletBookingAddOn) {
      const existing = bookingAddOns.get(addOn.booking_id) || [];
      existing.push(addOn);
      bookingAddOns.set(addOn.booking_id, existing);
    },

    addAddOn(addOn: ChaletAddOn) {
      addOns.set(addOn.id, addOn);
    },

    addPriceRule(rule: ChaletPriceRule) {
      priceRules.set(rule.id, rule);
    },

    setSettings(newSettings: Record<string, unknown>) {
      settings = { ...settings, ...newSettings };
    },

    clear() {
      chalets.clear();
      bookings.clear();
      bookingsByNumber.clear();
      bookingAddOns.clear();
      addOns.clear();
      priceRules.clear();
      settings = {
        deposit_percentage: 30,
        check_in_time: '14:00',
        check_out_time: '11:00',
        deposit_type: 'percentage',
        deposit_fixed: 100,
      };
      nextId = 1;
    },

    getAllChalets() {
      return Array.from(chalets.values());
    },

    getAllBookings() {
      return Array.from(bookings.values());
    },

    getAllAddOns() {
      return Array.from(addOns.values());
    },

    getAllPriceRules() {
      return Array.from(priceRules.values());
    },
  };
}
