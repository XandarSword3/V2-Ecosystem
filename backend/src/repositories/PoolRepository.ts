import { BaseRepository, FindManyOptions } from './BaseRepository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoolSession {
  [key: string]: unknown;
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  price: string;
  gender_restriction?: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PoolTicket {
  [key: string]: unknown;
  id: string;
  ticket_number: string;
  session_id: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  ticket_date: string;
  number_of_guests: number;
  total_amount: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  qr_code: string;
  validated_at?: string | null;
  validated_by?: string | null;
  bracelet_number?: string | null;
  bracelet_color?: string | null;
  bracelet_assigned_at?: string | null;
  bracelet_assigned_by?: string | null;
  bracelet_returned_at?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export class PoolSessionRepository extends BaseRepository<PoolSession> {
  constructor() {
    super('pool_sessions');
  }

  /** Return only active pool sessions. */
  async findActive(): Promise<PoolSession[]> {
    return this.findMany(
      { is_active: true },
      { orderBy: 'start_time', ascending: true },
    );
  }

  /** Find sessions available for a given gender restriction. */
  async findByGender(gender: string): Promise<PoolSession[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .or(`gender_restriction.eq.mixed,gender_restriction.eq.${gender}`)
      .order('start_time', { ascending: true });

    if (error) throw new Error(`[pool_sessions] findByGender failed: ${error.message}`);
    return (data as PoolSession[]) ?? [];
  }
}

export class PoolTicketRepository extends BaseRepository<PoolTicket> {
  constructor() {
    super('transactions');
    this.baseFilters = { engine_type: 'shared_capacity_access' };
  }

  /** Find tickets for a specific session. */
  async findBySession(
    sessionId: string,
    options?: FindManyOptions,
  ): Promise<PoolTicket[]> {
    const { data, error } = await this.getQuery()
      .contains('metadata', { session_id: sessionId })
      .order('created_at', { ascending: false });

    if (error) throw new Error(`[transactions] findBySession failed: ${error.message}`);
    return (data as PoolTicket[]) ?? [];
  }

  /** Find tickets for a specific date. */
  async findByDate(date: string): Promise<PoolTicket[]> {
    const { data, error } = await this.getQuery()
      .contains('metadata', { ticket_date: date })
      .order('created_at', { ascending: false });

    if (error) throw new Error(`[transactions] findByDate failed: ${error.message}`);
    return (data as PoolTicket[]) ?? [];
  }

  /** Find tickets for a specific customer. */
  async findByCustomer(
    customerId: string,
    options?: FindManyOptions,
  ): Promise<PoolTicket[]> {
    return this.findMany(
      { customer_id: customerId },
      { orderBy: 'created_at', ascending: false, ...options },
    );
  }

  /** Find valid (non-expired, non-cancelled) tickets for a session on a date. */
  async findValidForSession(sessionId: string, date: string): Promise<PoolTicket[]> {
    const { data, error } = await this.getQuery()
      .contains('metadata', { session_id: sessionId, ticket_date: date })
      .eq('status', 'valid');

    if (error) throw new Error(`[transactions] findValidForSession failed: ${error.message}`);
    return (data as PoolTicket[]) ?? [];
  }

  /** Count guests for a session on a given date. */
  async countGuestsForSession(sessionId: string, date: string): Promise<number> {
    const tickets = await this.findValidForSession(sessionId, date);
    // Note: number_of_guests is likely in metadata now if not explicit
    return tickets.reduce((sum, t) => {
      const ticket = t as PoolTicket & { metadata?: { number_of_guests?: number } };
      const guests = typeof ticket.metadata?.number_of_guests === 'number'
        ? ticket.metadata.number_of_guests
        : (ticket.number_of_guests || 0);
      return sum + Number(guests);
    }, 0);
  }
}

/** Facade combining pool sub-repositories. */
export class PoolRepository {
  readonly sessions = new PoolSessionRepository();
  readonly tickets = new PoolTicketRepository();
}
