/**
 * Supabase Pool Repository Implementation
 *
 * Implements the PoolRepository interface using Supabase as the data store.
 * All database logic for pool-related entities is encapsulated here,
 * keeping controllers thin and testable.
 *
 * ARCHITECTURE NOTE: Pool tickets are NOT stored in a separate pool_tickets table.
 * They are transactions with engine_type = 'shared_capacity_access'.
 * All ticket data (date, session_id, adults, children, qr_code) lives in metadata JSONB.
 * See ARCHITECTURE_LAW.md at the project root for the full rationale.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PoolRepository, PoolSession, PoolTicket } from '../container/types.js';
import dayjs from 'dayjs';

const ENGINE_TYPE = 'shared_capacity_access';

/** Map a transactions row to the PoolTicket interface shape */
function txToTicket(tx: any): PoolTicket {
  const meta = tx.metadata || {};
  return {
    id: tx.id,
    ticket_number: tx.booking_number || tx.order_number || tx.id,
    session_id: meta.session_id,
    date: meta.date || meta.ticket_date,
    guest_name: meta.guest_name || meta.customer_name || '',
    guest_email: meta.guest_email || meta.customer_email,
    guest_phone: meta.guest_phone || meta.customer_phone,
    adults: meta.adults ?? 0,
    children: meta.children ?? 0,
    infants: meta.infants ?? 0,
    total_price: tx.amount,
    payment_method: tx.payment_method,
    payment_status: tx.payment_status,
    qr_code: meta.qr_code,
    entry_time: meta.entry_time,
    exit_time: meta.exit_time,
    status: tx.status,
    created_at: tx.created_at,
    updated_at: tx.updated_at,
  };
}

export class SupabasePoolRepository implements PoolRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getSessions(moduleId?: string): Promise<PoolSession[]> {
    let query = this.supabase
      .from('pool_sessions')
      .select('*')
      .eq('is_active', true);

    if (moduleId) {
      query = query.eq('module_id', moduleId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(this.normalizeSession);
  }

  async getSessionById(id: string): Promise<PoolSession | null> {
    const { data, error } = await this.supabase
      .from('pool_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? this.normalizeSession(data) : null;
  }

  async getAvailability(
    date: string,
    sessionId?: string,
    moduleId?: string
  ): Promise<{ session: PoolSession; booked: number; available: number }[]> {
    const targetDate = dayjs(date).format('YYYY-MM-DD');

    // Get sessions
    let sessionsQuery = this.supabase
      .from('pool_sessions')
      .select('*')
      .eq('is_active', true);

    if (moduleId) {
      sessionsQuery = sessionsQuery.eq('module_id', moduleId);
    }
    if (sessionId) {
      sessionsQuery = sessionsQuery.eq('id', sessionId);
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery;
    if (sessionsError) throw sessionsError;

    // Count confirmed/active transactions for this date from the unified table
    const { data: tickets, error: ticketsError } = await this.supabase
      .from('transactions')
      .select('metadata')
      .eq('engine_type', ENGINE_TYPE)
      .filter('metadata->>date', 'eq', targetDate)
      .in('status', ['pending', 'confirmed', 'active', 'used']);

    if (ticketsError) throw ticketsError;

    // Aggregate headcount per session from metadata
    const headcountBySession = new Map<string, number>();
    (tickets || []).forEach((tx: any) => {
      const meta = tx.metadata || {};
      const sid: string = meta.session_id;
      if (!sid) return;
      const current = headcountBySession.get(sid) || 0;
      headcountBySession.set(sid, current + (meta.adults || 0) + (meta.children || 0));
    });

    return (sessions || []).map((s) => {
      const session = this.normalizeSession(s);
      const booked = headcountBySession.get(s.id) || 0;
      return {
        session,
        booked,
        available: Math.max(0, session.capacity - booked),
      };
    });
  }

  async createTicket(ticket: Omit<PoolTicket, 'id' | 'created_at' | 'updated_at'>): Promise<PoolTicket> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('transactions')
      .insert({
        engine_type: ENGINE_TYPE,
        status: ticket.status || 'pending',
        amount: ticket.total_price,
        net_amount: ticket.total_price,
        payment_method: ticket.payment_method,
        payment_status: ticket.payment_status,
        booking_number: ticket.ticket_number,
        created_at: now,
        updated_at: now,
        metadata: {
          session_id: ticket.session_id,
          date: ticket.date,
          guest_name: ticket.guest_name,
          guest_email: ticket.guest_email,
          guest_phone: ticket.guest_phone,
          adults: ticket.adults,
          children: ticket.children,
          infants: ticket.infants,
          qr_code: ticket.qr_code,
        },
      })
      .select()
      .single();

    if (error) throw error;
    return txToTicket(data);
  }

  async getTicketById(id: string): Promise<PoolTicket | null> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('engine_type', ENGINE_TYPE)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? txToTicket(data) : null;
  }

  async getTicketByNumber(ticketNumber: string): Promise<PoolTicket | null> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('engine_type', ENGINE_TYPE)
      .eq('booking_number', ticketNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? txToTicket(data) : null;
  }

  async getTicketsByDate(date: string): Promise<PoolTicket[]> {
    const targetDate = dayjs(date).format('YYYY-MM-DD');

    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('engine_type', ENGINE_TYPE)
      .filter('metadata->>date', 'eq', targetDate)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(txToTicket);
  }

  async getTicketsByUser(userId: string): Promise<PoolTicket[]> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('engine_type', ENGINE_TYPE)
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(txToTicket);
  }

  async updateTicket(id: string, ticketData: Partial<PoolTicket>): Promise<PoolTicket> {
    // Fetch current metadata first to merge
    const { data: current, error: fetchError } = await this.supabase
      .from('transactions')
      .select('metadata')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    const existingMeta = (current as any).metadata || {};

    // Build the metadata patch from the ticket fields
    const metaPatch: Record<string, any> = {};
    if (ticketData.session_id !== undefined) metaPatch.session_id = ticketData.session_id;
    if (ticketData.date !== undefined) metaPatch.date = ticketData.date;
    if (ticketData.guest_name !== undefined) metaPatch.guest_name = ticketData.guest_name;
    if (ticketData.guest_email !== undefined) metaPatch.guest_email = ticketData.guest_email;
    if (ticketData.guest_phone !== undefined) metaPatch.guest_phone = ticketData.guest_phone;
    if (ticketData.adults !== undefined) metaPatch.adults = ticketData.adults;
    if (ticketData.children !== undefined) metaPatch.children = ticketData.children;
    if (ticketData.infants !== undefined) metaPatch.infants = ticketData.infants;
    if (ticketData.qr_code !== undefined) metaPatch.qr_code = ticketData.qr_code;
    if (ticketData.entry_time !== undefined) metaPatch.entry_time = ticketData.entry_time;
    if (ticketData.exit_time !== undefined) metaPatch.exit_time = ticketData.exit_time;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
      metadata: { ...existingMeta, ...metaPatch },
    };

    if (ticketData.status !== undefined) updatePayload.status = ticketData.status;
    if (ticketData.total_price !== undefined) updatePayload.amount = ticketData.total_price;
    if (ticketData.payment_status !== undefined) updatePayload.payment_status = ticketData.payment_status;
    if (ticketData.payment_method !== undefined) updatePayload.payment_method = ticketData.payment_method;

    const { data: updated, error } = await this.supabase
      .from('transactions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return txToTicket(updated);
  }

  async createSession(session: Omit<PoolSession, 'id' | 'created_at' | 'updated_at'>): Promise<PoolSession> {
    const { data, error } = await this.supabase
      .from('pool_sessions')
      .insert(session)
      .select()
      .single();

    if (error) throw error;
    return this.normalizeSession(data);
  }

  async updateSession(id: string, data: Partial<PoolSession>): Promise<PoolSession> {
    const { data: updated, error } = await this.supabase
      .from('pool_sessions')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.normalizeSession(updated);
  }

  async deleteSession(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('pool_sessions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Normalize session data for consistent price fields
   */
  private normalizeSession(session: Record<string, unknown>): PoolSession {
    return {
      ...session,
      adult_price: session.adult_price ?? session.price ?? 0,
      child_price: session.child_price ?? session.price ?? 0,
    } as PoolSession;
  }
}

/**
 * Factory function to create PoolRepository
 * In production: uses real Supabase client
 * In tests: can be provided with a mock
 */
export function createPoolRepository(supabase: SupabaseClient): PoolRepository {
  return new SupabasePoolRepository(supabase);
}
