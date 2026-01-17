/**
 * Chalet Repository - Supabase Implementation
 * 
 * Implements ChaletRepository interface using Supabase as the data store.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Chalet,
  ChaletBooking,
  ChaletBookingAddOn,
  ChaletAddOn,
  ChaletPriceRule,
  ChaletRepository,
} from '../container/types.js';
import dayjs from 'dayjs';

export function createSupabaseChaletRepository(supabase: SupabaseClient): ChaletRepository {
  return {
    // ============================================
    // CHALET OPERATIONS
    // ============================================
    
    async getChalets(filters = {}) {
      let query = supabase
        .from('chalets')
        .select('*')
        .is('deleted_at', null);

      if (filters.moduleId) {
        query = query.eq('module_id', filters.moduleId);
      }
      if (filters.activeOnly !== false) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async getChaletById(id: string) {
      const { data, error } = await supabase
        .from('chalets')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    },

    async createChalet(chalet) {
      const { data, error } = await supabase
        .from('chalets')
        .insert(chalet)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async updateChalet(id: string, updates) {
      const { data, error } = await supabase
        .from('chalets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async deleteChalet(id: string) {
      const { error } = await supabase
        .from('chalets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },

    // ============================================
    // BOOKING OPERATIONS
    // ============================================

    async createBooking(booking) {
      const { data, error } = await supabase
        .from('chalet_bookings')
        .insert(booking)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getBookingById(id: string) {
      const { data, error } = await supabase
        .from('chalet_bookings')
        .select(`
          *,
          chalet:chalets(*),
          add_ons:chalet_booking_add_ons(*, add_on:chalet_add_ons(*))
        `)
        .eq('id', id)
        .single();

      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    },

    async getBookingByNumber(bookingNumber: string) {
      const { data, error } = await supabase
        .from('chalet_bookings')
        .select('*')
        .eq('booking_number', bookingNumber)
        .single();

      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    },

    async getBookings(filters) {
      let query = supabase
        .from('chalet_bookings')
        .select('*, chalets:chalet_id(id, name, capacity), users:customer_id(full_name, email, phone)')
        .is('deleted_at', null)
        .order('check_in_date', { ascending: true });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.chaletId) query = query.eq('chalet_id', filters.chaletId);
      if (filters.startDate) query = query.gte('check_in_date', filters.startDate);
      if (filters.endDate) query = query.lte('check_in_date', filters.endDate);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async getBookingsByCustomer(customerId: string) {
      const { data, error } = await supabase
        .from('chalet_bookings')
        .select('*, chalet:chalets(name, images)')
        .eq('customer_id', customerId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async getBookingsForChalet(chaletId: string, startDate?: string, endDate?: string) {
      let query = supabase
        .from('chalet_bookings')
        .select('*')
        .eq('chalet_id', chaletId)
        .is('deleted_at', null);

      if (startDate) query = query.gte('check_out_date', startDate);
      if (endDate) query = query.lte('check_in_date', endDate);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ChaletBooking[];
    },

    async getTodayBookings() {
      const today = dayjs().format('YYYY-MM-DD');

      const [checkInsResult, checkOutsResult] = await Promise.all([
        supabase
          .from('chalet_bookings')
          .select('*, chalets:chalet_id(id, name, capacity), users:customer_id(full_name, email, phone)')
          .gte('check_in_date', `${today}T00:00:00`)
          .lt('check_in_date', `${today}T23:59:59`)
          .is('deleted_at', null),
        supabase
          .from('chalet_bookings')
          .select('*, chalets:chalet_id(id, name, capacity), users:customer_id(full_name, email, phone)')
          .gte('check_out_date', `${today}T00:00:00`)
          .lt('check_out_date', `${today}T23:59:59`)
          .is('deleted_at', null),
      ]);

      if (checkInsResult.error) throw checkInsResult.error;
      if (checkOutsResult.error) throw checkOutsResult.error;

      return {
        checkIns: checkInsResult.data || [],
        checkOuts: checkOutsResult.data || [],
      };
    },

    async updateBooking(id: string, updates) {
      const { data, error } = await supabase
        .from('chalet_bookings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    // ============================================
    // BOOKING ADD-ONS
    // ============================================

    async createBookingAddOns(addOns) {
      if (addOns.length === 0) return [];

      const { data, error } = await supabase
        .from('chalet_booking_add_ons')
        .insert(addOns)
        .select();

      if (error) throw error;
      return data || [];
    },

    async getBookingAddOns(bookingId: string) {
      const { data, error } = await supabase
        .from('chalet_booking_add_ons')
        .select('*, add_on:chalet_add_ons(*)')
        .eq('booking_id', bookingId);

      if (error) throw error;
      return data || [];
    },

    // ============================================
    // ADD-ON OPERATIONS
    // ============================================

    async getAddOns(activeOnly = true) {
      let query = supabase.from('chalet_add_ons').select('*');
      if (activeOnly) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async getAddOnById(id: string) {
      const { data, error } = await supabase
        .from('chalet_add_ons')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    },

    async getAddOnsByIds(ids: string[]) {
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from('chalet_add_ons')
        .select('*')
        .in('id', ids);

      if (error) throw error;
      return data || [];
    },

    async createAddOn(addOn) {
      const { data, error } = await supabase
        .from('chalet_add_ons')
        .insert(addOn)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async updateAddOn(id: string, updates) {
      const { data, error } = await supabase
        .from('chalet_add_ons')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async deleteAddOn(id: string) {
      const { error } = await supabase
        .from('chalet_add_ons')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },

    // ============================================
    // PRICE RULE OPERATIONS
    // ============================================

    async getPriceRules(chaletId?: string) {
      let query = supabase
        .from('chalet_price_rules')
        .select('*, chalet:chalets(name)')
        .order('start_date', { ascending: true });

      if (chaletId) query = query.eq('chalet_id', chaletId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async createPriceRule(rule) {
      const { data, error } = await supabase
        .from('chalet_price_rules')
        .insert(rule)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async updatePriceRule(id: string, updates) {
      const { data, error } = await supabase
        .from('chalet_price_rules')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async deletePriceRule(id: string) {
      const { error } = await supabase
        .from('chalet_price_rules')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },

    // ============================================
    // SETTINGS OPERATIONS
    // ============================================

    async getChaletSettings() {
      const defaults = {
        deposit_percentage: 30,
        check_in_time: '14:00',
        check_out_time: '11:00',
        deposit_type: 'percentage' as const,
        deposit_fixed: 100,
      };

      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'chalets')
          .single();

        if (data?.value) {
          const settings = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          return {
            deposit_percentage: settings.chaletDeposit || settings.depositPercent || defaults.deposit_percentage,
            check_in_time: settings.checkIn || defaults.check_in_time,
            check_out_time: settings.checkOut || defaults.check_out_time,
            deposit_type: settings.chaletDepositType || defaults.deposit_type,
            deposit_fixed: settings.chaletDepositFixed || defaults.deposit_fixed,
          };
        }
      } catch {
        // Return defaults if settings not found
      }

      return defaults;
    },

    async updateChaletSettings(settings: Record<string, unknown>) {
      for (const [key, value] of Object.entries(settings)) {
        await supabase
          .from('site_settings')
          .upsert(
            {
              key,
              value: String(value),
              category: 'chalet',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key,category' }
          );
      }
    },
  };
}
