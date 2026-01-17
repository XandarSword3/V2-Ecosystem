/**
 * In-Memory Pool Repository for Testing
 * 
 * A complete in-memory implementation of PoolRepository for unit tests.
 * No database required, all data stored in memory.
 */

import type { PoolRepository, PoolSession, PoolTicket } from '../container/types.js';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

export class InMemoryPoolRepository implements PoolRepository {
  private sessions: Map<string, PoolSession> = new Map();
  private tickets: Map<string, PoolTicket> = new Map();

  // ============================================
  // Test Helpers - Use these to set up test data
  // ============================================

  /**
   * Add a session for testing
   */
  addSession(session: Partial<PoolSession> & { name: string }): PoolSession {
    const fullSession: PoolSession = {
      id: session.id || uuidv4(),
      module_id: session.module_id,
      name: session.name,
      start_time: session.start_time || '09:00',
      end_time: session.end_time || '12:00',
      capacity: session.capacity || 100,
      price: session.price || 25,
      adult_price: session.adult_price ?? session.price ?? 25,
      child_price: session.child_price ?? (session.price ? session.price * 0.5 : 12.5),
      is_active: session.is_active !== false,
      created_at: session.created_at || new Date().toISOString(),
      updated_at: session.updated_at || new Date().toISOString(),
    };
    this.sessions.set(fullSession.id, fullSession);
    return fullSession;
  }

  /**
   * Add a ticket for testing
   */
  addTicket(ticket: Partial<PoolTicket> & { session_id: string; guest_name: string }): PoolTicket {
    const fullTicket: PoolTicket = {
      id: ticket.id || uuidv4(),
      ticket_number: ticket.ticket_number || `P-${Date.now()}`,
      session_id: ticket.session_id,
      date: ticket.date || dayjs().format('YYYY-MM-DD'),
      guest_name: ticket.guest_name,
      guest_email: ticket.guest_email,
      guest_phone: ticket.guest_phone,
      adults: ticket.adults || 1,
      children: ticket.children || 0,
      infants: ticket.infants || 0,
      total_price: ticket.total_price || 25,
      payment_method: ticket.payment_method || 'cash',
      payment_status: ticket.payment_status || 'paid',
      qr_code: ticket.qr_code,
      entry_time: ticket.entry_time,
      exit_time: ticket.exit_time,
      status: ticket.status || 'valid',
      created_at: ticket.created_at || new Date().toISOString(),
      updated_at: ticket.updated_at || new Date().toISOString(),
    };
    this.tickets.set(fullTicket.id, fullTicket);
    return fullTicket;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.sessions.clear();
    this.tickets.clear();
  }

  /**
   * Get raw sessions map for assertions
   */
  getAllSessions(): PoolSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get raw tickets map for assertions
   */
  getAllTickets(): PoolTicket[] {
    return Array.from(this.tickets.values());
  }

  // ============================================
  // PoolRepository Implementation
  // ============================================

  async getSessions(moduleId?: string): Promise<PoolSession[]> {
    const sessions = Array.from(this.sessions.values())
      .filter(s => s.is_active);

    if (moduleId) {
      return sessions.filter(s => s.module_id === moduleId);
    }

    return sessions;
  }

  async getSessionById(id: string): Promise<PoolSession | null> {
    return this.sessions.get(id) || null;
  }

  async getAvailability(
    date: string,
    sessionId?: string,
    moduleId?: string
  ): Promise<{ session: PoolSession; booked: number; available: number }[]> {
    const targetDate = dayjs(date).format('YYYY-MM-DD');
    let sessions = await this.getSessions(moduleId);

    if (sessionId) {
      sessions = sessions.filter(s => s.id === sessionId);
    }

    const ticketsOnDate = Array.from(this.tickets.values())
      .filter(t => t.date === targetDate && ['pending', 'valid', 'used'].includes(t.status));

    return sessions.map(session => {
      const sessionTickets = ticketsOnDate.filter(t => t.session_id === session.id);
      const booked = sessionTickets.reduce((sum, t) => sum + t.adults + t.children, 0);
      return {
        session,
        booked,
        available: Math.max(0, session.capacity - booked),
      };
    });
  }

  async createTicket(ticket: Omit<PoolTicket, 'id' | 'created_at' | 'updated_at'>): Promise<PoolTicket> {
    const fullTicket: PoolTicket = {
      ...ticket,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.tickets.set(fullTicket.id, fullTicket);
    return fullTicket;
  }

  async getTicketById(id: string): Promise<PoolTicket | null> {
    const ticket = this.tickets.get(id);
    if (!ticket) return null;

    // Join with session data
    const session = this.sessions.get(ticket.session_id);
    return { ...ticket, pool_sessions: session } as PoolTicket;
  }

  async getTicketByNumber(ticketNumber: string): Promise<PoolTicket | null> {
    const ticket = Array.from(this.tickets.values())
      .find(t => t.ticket_number === ticketNumber);

    if (!ticket) return null;

    const session = this.sessions.get(ticket.session_id);
    return { ...ticket, pool_sessions: session } as PoolTicket;
  }

  async getTicketsByDate(date: string): Promise<PoolTicket[]> {
    const targetDate = dayjs(date).format('YYYY-MM-DD');
    return Array.from(this.tickets.values())
      .filter(t => t.date === targetDate)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getTicketsByUser(userId: string): Promise<PoolTicket[]> {
    return Array.from(this.tickets.values())
      .filter(t => (t as unknown as { user_id: string }).user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async updateTicket(id: string, data: Partial<PoolTicket>): Promise<PoolTicket> {
    const ticket = this.tickets.get(id);
    if (!ticket) throw new Error(`Ticket ${id} not found`);

    const updated: PoolTicket = {
      ...ticket,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.tickets.set(id, updated);
    return updated;
  }

  async createSession(session: Omit<PoolSession, 'id' | 'created_at' | 'updated_at'>): Promise<PoolSession> {
    const fullSession: PoolSession = {
      ...session,
      id: uuidv4(),
      adult_price: session.adult_price ?? session.price,
      child_price: session.child_price ?? session.price,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.sessions.set(fullSession.id, fullSession);
    return fullSession;
  }

  async updateSession(id: string, data: Partial<PoolSession>): Promise<PoolSession> {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session ${id} not found`);

    const updated: PoolSession = {
      ...session,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.sessions.set(id, updated);
    return updated;
  }

  async deleteSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.is_active = false;
      session.updated_at = new Date().toISOString();
    }
  }
}

/**
 * Factory function to create in-memory repository for tests
 */
export function createInMemoryPoolRepository(): InMemoryPoolRepository {
  return new InMemoryPoolRepository();
}
