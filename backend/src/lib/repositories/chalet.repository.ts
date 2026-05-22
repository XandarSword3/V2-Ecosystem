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
        .from('bookable_units')
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
        .from('bookable_units')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    },

    async createChalet(chalet) {
      const { data, error } = await supabase
        .from('bookable_units')
        .insert(chalet)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async updateChalet(id: string, updates) {
      const { data, error } = await supabase
        .from('bookable_units')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async deleteChalet(id: string) {
      const { error } = await supabase
        .from('bookable_units')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },

    // ============================================
    // BOOKING OPERATIONS
    // ============================================

    async createBooking(booking) {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          engine_type: 'time_exclusive_reservation',
          status: booking.status || 'pending',
          amount: booking.total_amount || booking.total_price || 0,
          net_amount: booking.net_amount || booking.total_amount || booking.total_price || 0,
          customer_id: booking.customer_id,
          module_id: booking.module_id,
          property_id: booking.property_id,
          reference_id: booking.chalet_id,
          reference_table: 'chalets',
          booking_number: booking.booking_number,
          metadata: {
            check_in_date: booking.check_in_date,
            check_out_date: booking.check_out_date,
            number_of_guests: booking.number_of_guests || booking.guests || 1,
            special_requests: booking.special_requests,
            customer_name: booking.customer_name,
            customer_email: booking.customer_email,
            customer_phone: booking.customer_phone,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async getBookingById(id: string) {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          chalet:chalets!reference_id(*),
          add_ons:chalet_booking_add_ons(*, add_on:chalet_add_ons(*))
        `)
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('id', id)
        .single();

      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    },

    async getBookingByNumber(bookingNumber: string) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, chalet:chalets!reference_id(*)')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('booking_number', bookingNumber)
        .single();

      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      return data;
    },

    async getBookings(filters) {
      let query = supabase
        .from('transactions')
        .select('*, chalet:chalets!reference_id(id, name, capacity), users:customer_id(full_name, email, phone)')
        .eq('engine_type', 'time_exclusive_reservation')
        .order('created_at', { ascending: true });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.chaletId) query = query.eq('reference_id', filters.chaletId);
      if (filters.startDate) query = query.filter('metadata->>check_in_date', 'gte', filters.startDate);
      if (filters.endDate) query = query.filter('metadata->>check_in_date', 'lte', filters.endDate);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async getBookingsByCustomer(customerId: string) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, chalet:chalets!reference_id(name, images)')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },

    async getBookingsForChalet(chaletId: string, startDate?: string, endDate?: string) {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('engine_type', 'time_exclusive_reservation')
        .eq('reference_id', chaletId);

      if (startDate) query = query.filter('metadata->>check_out_date', 'gte', startDate);
      if (endDate) query = query.filter('metadata->>check_in_date', 'lte', endDate);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ChaletBooking[];
    },

    async getTodayBookings() {
      const today = dayjs().format('YYYY-MM-DD');

      const [checkInsResult, checkOutsResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, chalet:chalets!reference_id(id, name, capacity), users:customer_id(full_name, email, phone)')
          .eq('engine_type', 'time_exclusive_reservation')
          .filter('metadata->>check_in_date', 'gte', `${today}T00:00:00`)
          .filter('metadata->>check_in_date', 'lt', `${today}T23:59:59`),
        supabase
          .from('transactions')
          .select('*, chalet:chalets!reference_id(id, name, capacity), users:customer_id(full_name, email, phone)')
          .eq('engine_type', 'time_exclusive_reservation')
          .filter('metadata->>check_out_date', 'gte', `${today}T00:00:00`)
          .filter('metadata->>check_out_date', 'lt', `${today}T23:59:59`),
      ]);

      if (checkInsResult.error) throw checkInsResult.error;
      if (checkOutsResult.error) throw checkOutsResult.error;

      return {
        checkIns: checkInsResult.data || [],
        checkOuts: checkOutsResult.data || [],
      };
    },

    async updateBooking(id: string, updates) {
      // Build metadata patch for booking-specific fields
      const metaPatch: Record<string, any> = {};
      if (updates.check_in_date !== undefined) metaPatch.check_in_date = updates.check_in_date;
      if (updates.check_out_date !== undefined) metaPatch.check_out_date = updates.check_out_date;
      if (updates.number_of_guests !== undefined) metaPatch.number_of_guests = updates.number_of_guests;
      if (updates.special_requests !== undefined) metaPatch.special_requests = updates.special_requests;
      if (updates.customer_name !== undefined) metaPatch.customer_name = updates.customer_name;
      if (updates.customer_email !== undefined) metaPatch.customer_email = updates.customer_email;
      if (updates.customer_phone !== undefined) metaPatch.customer_phone = updates.customer_phone;

      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.status !== undefined) updatePayload.status = updates.status;
      if (updates.total_amount !== undefined) updatePayload.amount = updates.total_amount;
      if (updates.total_price !== undefined) updatePayload.amount = updates.total_price;
      if (updates.net_amount !== undefined) updatePayload.net_amount = updates.net_amount;
      if (updates.customer_id !== undefined) updatePayload.customer_id = updates.customer_id;
      if (updates.module_id !== undefined) updatePayload.module_id = updates.module_id;
      if (updates.property_id !== undefined) updatePayload.property_id = updates.property_id;
      if (updates.chalet_id !== undefined) updatePayload.reference_id = updates.chalet_id;
      if (updates.booking_number !== undefined) updatePayload.booking_number = updates.booking_number;

      // Fetch current metadata to merge
      const { data: current } = await supabase
        .from('transactions')
        .select('metadata')
        .eq('id', id)
        .single();

      if (Object.keys(metaPatch).length > 0) {
        updatePayload.metadata = { ...(current?.metadata || {}), ...metaPatch };
      }

      const { data, error } = await supabase
        .from('transactions')
        .update(updatePayload)
        .eq('id', id)
        .eq('engine_type', 'time_exclusive_reservation')
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
      let query = supabase.from('accommodation_add_ons').select('*');
      if (activeOnly) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async getAddOnById(id: string) {
      const { data, error } = await supabase
        .from('accommodation_add_ons')
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
        .from('accommodation_add_ons')
        .select('*')
        .in('id', ids);

      if (error) throw error;
      return data || [];
    },

    async createAddOn(addOn) {
      const { data, error } = await supabase
        .from('accommodation_add_ons')
        .insert(addOn)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async updateAddOn(id: string, updates) {
      const { data, error } = await supabase
        .from('accommodation_add_ons')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async deleteAddOn(id: string) {
      const { error } = await supabase
        .from('accommodation_add_ons')
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
