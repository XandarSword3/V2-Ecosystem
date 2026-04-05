/**
 * In-Memory Chalet Repository
 * Test double for ChaletRepository using in-memory data structures.
 */

import type {
  ChaletRepository,
  Chalet,
  ChaletBooking,
  ChaletBookingAddOn,
  ChaletAddOn,
  ChaletPriceRule,
} from '../container/types.js';

export interface InMemoryChaletRepository extends ChaletRepository {
  addChalet(chalet: Partial<Chalet> & { id: string }): Chalet;
  addAddOn(addOn: Partial<ChaletAddOn> & { id: string }): ChaletAddOn;
  addPriceRule(rule: Partial<ChaletPriceRule> & { id: string; chalet_id: string }): ChaletPriceRule;
  setSettings(settings: Record<string, unknown>): void;
  reset(): void;
}

export function createInMemoryChaletRepository(): InMemoryChaletRepository {
  const chalets = new Map<string, Chalet>();
  const bookings = new Map<string, ChaletBooking>();
  const bookingAddOns = new Map<string, ChaletBookingAddOn[]>();
  const addOns = new Map<string, ChaletAddOn>();
  const priceRules = new Map<string, ChaletPriceRule>();
  let settings: Record<string, unknown> = {
    deposit_percentage: 25,
    check_in_time: '14:00',
    check_out_time: '11:00',
    deposit_type: 'percentage',
    deposit_fixed: 0,
  };

  function addChalet(chalet: Partial<Chalet> & { id: string }): Chalet {
    const full: Chalet = {
      name: chalet.name ?? 'Chalet',
      capacity: chalet.capacity ?? 4,
      bedroom_count: chalet.bedroom_count ?? 1,
      bathroom_count: chalet.bathroom_count ?? 1,
      amenities: chalet.amenities ?? [],
      images: chalet.images ?? [],
      base_price: chalet.base_price ?? '100.00',
      weekend_price: chalet.weekend_price ?? '150.00',
      is_active: chalet.is_active ?? true,
      created_at: chalet.created_at ?? new Date().toISOString(),
      updated_at: chalet.updated_at ?? new Date().toISOString(),
      ...chalet,
    } as Chalet;
    chalets.set(full.id, full);
    return full;
  }

  function addAddOn(addOn: Partial<ChaletAddOn> & { id: string }): ChaletAddOn {
    const full: ChaletAddOn = {
      name: addOn.name ?? 'Add-On',
      price: addOn.price ?? '10.00',
      price_type: addOn.price_type ?? 'one_time',
      is_active: addOn.is_active ?? true,
      created_at: addOn.created_at ?? new Date().toISOString(),
      updated_at: addOn.updated_at ?? new Date().toISOString(),
      ...addOn,
    } as ChaletAddOn;
    addOns.set(full.id, full);
    return full;
  }

  function addPriceRule(rule: Partial<ChaletPriceRule> & { id: string; chalet_id: string }): ChaletPriceRule {
    const full: ChaletPriceRule = {
      name: rule.name ?? 'Rule',
      start_date: rule.start_date ?? new Date().toISOString(),
      end_date: rule.end_date ?? new Date().toISOString(),
      priority: rule.priority ?? 0,
      is_active: rule.is_active ?? true,
      created_at: rule.created_at ?? new Date().toISOString(),
      updated_at: rule.updated_at ?? new Date().toISOString(),
      ...rule,
    } as ChaletPriceRule;
    priceRules.set(full.id, full);
    return full;
  }

  return {
    // Helpers
    addChalet,
    addAddOn,
    addPriceRule,
    setSettings(s: Record<string, unknown>) {
      settings = { ...settings, ...s };
    },
    reset() {
      chalets.clear();
      bookings.clear();
      bookingAddOns.clear();
      addOns.clear();
      priceRules.clear();
    },

    // Chalet operations
    async getChalets(filters) {
      let result = [...chalets.values()].filter(c => !c.deleted_at);
      if (filters?.moduleId) result = result.filter(c => c.module_id === filters.moduleId);
      if (filters?.activeOnly) result = result.filter(c => c.is_active);
      return result;
    },
    async getChaletById(id) {
      const c = chalets.get(id);
      return c && !c.deleted_at ? c : null;
    },
    async createChalet(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const chalet: Chalet = { ...data, id, created_at: now, updated_at: now } as Chalet;
      chalets.set(id, chalet);
      return chalet;
    },
    async updateChalet(id, data) {
      const existing = chalets.get(id);
      if (!existing) throw new Error(`Chalet ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      chalets.set(id, updated);
      return updated;
    },
    async deleteChalet(id) {
      const existing = chalets.get(id);
      if (existing) {
        chalets.set(id, { ...existing, deleted_at: new Date().toISOString() });
      }
    },

    // Booking operations
    async createBooking(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const booking: ChaletBooking = { ...data, id, created_at: now, updated_at: now } as ChaletBooking;
      bookings.set(id, booking);
      return booking;
    },
    async getBookingById(id) {
      const b = bookings.get(id);
      return b && !b.deleted_at ? b : null;
    },
    async getBookingByNumber(bookingNumber) {
      for (const b of bookings.values()) {
        if (b.booking_number === bookingNumber && !b.deleted_at) return b;
      }
      return null;
    },
    async getBookings(filters) {
      let result = [...bookings.values()].filter(b => !b.deleted_at);
      if (filters.chaletId) result = result.filter(b => b.chalet_id === filters.chaletId);
      if (filters.status) result = result.filter(b => b.status === filters.status);
      if (filters.startDate) result = result.filter(b => b.check_in_date >= filters.startDate!);
      if (filters.endDate) result = result.filter(b => b.check_out_date <= filters.endDate!);
      return result;
    },
    async getBookingsByCustomer(customerId) {
      return [...bookings.values()].filter(b => b.customer_id === customerId && !b.deleted_at);
    },
    async getBookingsForChalet(chaletId, startDate, endDate) {
      let result = [...bookings.values()].filter(b => b.chalet_id === chaletId && !b.deleted_at && b.status !== 'cancelled');
      if (startDate) result = result.filter(b => b.check_out_date > startDate);
      if (endDate) result = result.filter(b => b.check_in_date < endDate);
      return result;
    },
    async getTodayBookings() {
      const today = new Date().toISOString().split('T')[0];
      const all = [...bookings.values()].filter(b => !b.deleted_at);
      return {
        checkIns: all.filter(b => b.check_in_date === today),
        checkOuts: all.filter(b => b.check_out_date === today),
      };
    },
    async updateBooking(id, data) {
      const existing = bookings.get(id);
      if (!existing) throw new Error(`Booking ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      bookings.set(id, updated);
      return updated;
    },

    // Booking add-ons
    async createBookingAddOns(items) {
      const created: ChaletBookingAddOn[] = items.map(item => ({
        ...item,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      })) as ChaletBookingAddOn[];
      for (const item of created) {
        const existing = bookingAddOns.get(item.booking_id) ?? [];
        existing.push(item);
        bookingAddOns.set(item.booking_id, existing);
      }
      return created;
    },
    async getBookingAddOns(bookingId) {
      return bookingAddOns.get(bookingId) ?? [];
    },

    // Add-on operations
    async getAddOns(activeOnly) {
      let result = [...addOns.values()];
      if (activeOnly) result = result.filter(a => a.is_active);
      return result;
    },
    async getAddOnById(id) {
      return addOns.get(id) ?? null;
    },
    async getAddOnsByIds(ids) {
      return ids.map(id => addOns.get(id)).filter((a): a is ChaletAddOn => !!a);
    },
    async createAddOn(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const addOn: ChaletAddOn = { ...data, id, created_at: now, updated_at: now } as ChaletAddOn;
      addOns.set(id, addOn);
      return addOn;
    },
    async updateAddOn(id, data) {
      const existing = addOns.get(id);
      if (!existing) throw new Error(`Add-on ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      addOns.set(id, updated);
      return updated;
    },
    async deleteAddOn(id) {
      addOns.delete(id);
    },

    // Price rule operations
    async getPriceRules(chaletId) {
      let result = [...priceRules.values()];
      if (chaletId) result = result.filter(r => r.chalet_id === chaletId);
      return result;
    },
    async createPriceRule(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const rule: ChaletPriceRule = { ...data, id, created_at: now, updated_at: now } as ChaletPriceRule;
      priceRules.set(id, rule);
      return rule;
    },
    async updatePriceRule(id, data) {
      const existing = priceRules.get(id);
      if (!existing) throw new Error(`Price rule ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      priceRules.set(id, updated);
      return updated;
    },
    async deletePriceRule(id) {
      priceRules.delete(id);
    },

    // Settings
    async getChaletSettings() {
      return {
        deposit_percentage: (settings.deposit_percentage as number) ?? 25,
        check_in_time: (settings.check_in_time as string) ?? '14:00',
        check_out_time: (settings.check_out_time as string) ?? '11:00',
        deposit_type: settings.deposit_type as 'percentage' | 'fixed' | undefined,
        deposit_fixed: settings.deposit_fixed as number | undefined,
      };
    },
    async updateChaletSettings(s) {
      settings = { ...settings, ...s };
    },
  };
}
