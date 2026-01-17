/**
 * Supabase Pool Repository Implementation
 * 
 * Implements the PoolRepository interface using Supabase as the data store.
 * All database logic for pool-related entities is encapsulated here,
 * keeping controllers thin and testable.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PoolRepository, PoolSession, PoolTicket } from '../container/types.js';
import dayjs from 'dayjs';

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

    // Get tickets for this date
    const { data: tickets, error: ticketsError } = await this.supabase
      .from('pool_tickets')
      .select('session_id, adults, children')
      .eq('date', targetDate)
      .in('status', ['pending', 'valid', 'used']);

    if (ticketsError) throw ticketsError;

    // Calculate availability
    const ticketsBySession = new Map<string, number>();
    (tickets || []).forEach((t: { session_id: string; adults: number; children: number }) => {
      const current = ticketsBySession.get(t.session_id) || 0;
      ticketsBySession.set(t.session_id, current + t.adults + t.children);
    });

    return (sessions || []).map((s) => {
      const session = this.normalizeSession(s);
      const booked = ticketsBySession.get(s.id) || 0;
      return {
        session,
        booked,
        available: Math.max(0, session.capacity - booked),
      };
    });
  }

  async createTicket(ticket: Omit<PoolTicket, 'id' | 'created_at' | 'updated_at'>): Promise<PoolTicket> {
    const { data, error } = await this.supabase
      .from('pool_tickets')
      .insert(ticket)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getTicketById(id: string): Promise<PoolTicket | null> {
    const { data, error } = await this.supabase
      .from('pool_tickets')
      .select('*, pool_sessions(*)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async getTicketByNumber(ticketNumber: string): Promise<PoolTicket | null> {
    const { data, error } = await this.supabase
      .from('pool_tickets')
      .select('*, pool_sessions(*)')
      .eq('ticket_number', ticketNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async getTicketsByDate(date: string): Promise<PoolTicket[]> {
    const targetDate = dayjs(date).format('YYYY-MM-DD');
    
    const { data, error } = await this.supabase
      .from('pool_tickets')
      .select('*, pool_sessions(*)')
      .eq('date', targetDate)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getTicketsByUser(userId: string): Promise<PoolTicket[]> {
    const { data, error } = await this.supabase
      .from('pool_tickets')
      .select('*, pool_sessions(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateTicket(id: string, data: Partial<PoolTicket>): Promise<PoolTicket> {
    const { data: updated, error } = await this.supabase
      .from('pool_tickets')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return updated;
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
