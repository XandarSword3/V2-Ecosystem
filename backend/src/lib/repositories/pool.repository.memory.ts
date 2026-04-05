/**
 * In-Memory Pool Repository
 * Test double for PoolRepository using in-memory data structures.
 */

import type { PoolRepository, PoolSession, PoolTicket } from '../container/types.js';

export interface InMemoryPoolRepository extends PoolRepository {
  addSession(data: Partial<PoolSession>): PoolSession;
  addTicket(data: Partial<PoolTicket>): PoolTicket;
  reset(): void;
}

export function createInMemoryPoolRepository(): InMemoryPoolRepository {
  const sessions = new Map<string, PoolSession>();
  const tickets = new Map<string, PoolTicket>();
  let ticketCounter = 1000;

  return {
    addSession(data: Partial<PoolSession>): PoolSession {
      const id = data.id ?? crypto.randomUUID();
      const now = new Date().toISOString();
      const session: PoolSession = {
        id,
        name: data.name ?? 'Session',
        module_id: data.module_id,
        start_time: data.start_time ?? '09:00',
        end_time: data.end_time ?? '12:00',
        capacity: data.capacity ?? 50,
        price: data.price ?? 10,
        adult_price: data.adult_price,
        child_price: data.child_price,
        is_active: data.is_active ?? true,
        created_at: data.created_at ?? now,
        updated_at: data.updated_at ?? now,
      };
      sessions.set(id, session);
      return session;
    },

    addTicket(data: Partial<PoolTicket>): PoolTicket {
      const id = data.id ?? crypto.randomUUID();
      const now = new Date().toISOString();
      const ticket: PoolTicket = {
        id,
        ticket_number: data.ticket_number ?? `PT-${++ticketCounter}`,
        session_id: data.session_id ?? '',
        date: data.date ?? now.split('T')[0],
        guest_name: data.guest_name ?? 'Guest',
        guest_email: data.guest_email,
        guest_phone: data.guest_phone,
        adults: data.adults ?? 1,
        children: data.children ?? 0,
        infants: data.infants ?? 0,
        total_price: data.total_price ?? 0,
        payment_method: data.payment_method ?? 'cash',
        payment_status: data.payment_status ?? 'pending',
        qr_code: data.qr_code,
        entry_time: data.entry_time,
        exit_time: data.exit_time,
        status: data.status ?? 'valid',
        created_at: data.created_at ?? now,
        updated_at: data.updated_at ?? now,
      };
      tickets.set(id, ticket);
      return ticket;
    },

    reset() {
      sessions.clear();
      tickets.clear();
      ticketCounter = 1000;
    },

    // PoolRepository interface
    async getSessions(moduleId?: string) {
      let result = [...sessions.values()].filter(s => s.is_active);
      if (moduleId) result = result.filter(s => s.module_id === moduleId);
      return result;
    },

    async getSessionById(id) {
      return sessions.get(id) ?? null;
    },

    async getAvailability(date, sessionId?, moduleId?) {
      let sessionList = [...sessions.values()].filter(s => s.is_active);
      if (sessionId) sessionList = sessionList.filter(s => s.id === sessionId);
      if (moduleId) sessionList = sessionList.filter(s => s.module_id === moduleId);

      return sessionList.map(session => {
        const sessionTickets = [...tickets.values()].filter(
          t => t.session_id === session.id && t.date === date && t.status !== 'cancelled'
        );
        const booked = sessionTickets.reduce((sum, t) => sum + t.adults + t.children, 0);
        return { session, booked, available: session.capacity - booked };
      });
    },

    async createTicket(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const ticket: PoolTicket = {
        ...data,
        id,
        ticket_number: (data as any).ticket_number ?? `PT-${++ticketCounter}`,
        infants: (data as any).infants ?? 0,
        total_price: (data as any).total_price ?? 0,
        payment_method: (data as any).payment_method ?? 'cash',
        payment_status: (data as any).payment_status ?? 'pending',
        status: (data as any).status ?? 'valid',
        created_at: now,
        updated_at: now,
      } as PoolTicket;
      tickets.set(id, ticket);
      return ticket;
    },

    async getTicketById(id) {
      return tickets.get(id) ?? null;
    },

    async getTicketByNumber(ticketNumber) {
      for (const t of tickets.values()) {
        if (t.ticket_number === ticketNumber) return t;
      }
      return null;
    },

    async getTicketsByDate(date) {
      return [...tickets.values()].filter(t => t.date === date);
    },

    async getTicketsByUser(userId) {
      return [...tickets.values()].filter(t => (t as any).user_id === userId);
    },

    async updateTicket(id, data) {
      const existing = tickets.get(id);
      if (!existing) throw new Error(`Ticket ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      tickets.set(id, updated);
      return updated;
    },

    async createSession(data) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const session: PoolSession = {
        ...data,
        id,
        is_active: (data as any).is_active ?? true,
        capacity: (data as any).capacity ?? 50,
        price: (data as any).price ?? 10,
        created_at: now,
        updated_at: now,
      } as PoolSession;
      sessions.set(id, session);
      return session;
    },

    async updateSession(id, data) {
      const existing = sessions.get(id);
      if (!existing) throw new Error(`Session ${id} not found`);
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
      sessions.set(id, updated);
      return updated;
    },

    async deleteSession(id) {
      sessions.delete(id);
    },
  };
}
