import { BaseRepository, FindManyOptions } from './BaseRepository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Chalet {
  [key: string]: unknown;
  id: string;
  name: string;
  name_ar?: string | null;
  name_fr?: string | null;
  description?: string | null;
  description_ar?: string | null;
  description_fr?: string | null;
  capacity: number;
  bedroom_count: number;
  bathroom_count: number;
  amenities?: string[] | null;
  images?: string[] | null;
  base_price: string;
  weekend_price: string;
  is_active?: boolean;
  clean_state?: string;
  cleaning_status?: string;
  is_blocked?: boolean;
  block_reason?: string | null;
  blocked_until?: string | null;
  last_cleaned_at?: string | null;
  last_inspected_at?: string | null;
  maintenance_notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface ChaletBooking {
  [key: string]: unknown;
  id: string;
  booking_number: string;
  chalet_id: string;
  customer_id?: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  number_of_nights: number;
  base_amount: string;
  add_ons_amount?: string;
  discount_amount?: string;
  deposit_amount?: string;
  total_amount: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  special_requests?: string | null;
  housekeeping_status?: string;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  checked_in_by?: string | null;
  checked_out_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface ChaletAddOn {
  [key: string]: unknown;
  id: string;
  name: string;
  name_ar?: string | null;
  name_fr?: string | null;
  description?: string | null;
  price: string;
  price_type: string;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export class ChaletUnitRepository extends BaseRepository<Chalet> {
  constructor() {
    super('accommodation_units');
  }

  /** Return only active, unblocked accommodation units. */
  async findAvailable(): Promise<Chalet[]> {
    const { data, error } = await this.getQuery()
      .eq('is_active', true)
      .eq('is_blocked', false)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) throw new Error(`[accommodation_units] findAvailable failed: ${error.message}`);
    return (data as Chalet[]) ?? [];
  }

  /** Find units that can accommodate at least `guests` people. */
  async findByCapacity(guests: number): Promise<Chalet[]> {
    const { data, error } = await this.getQuery()
      .gte('capacity', guests)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('capacity', { ascending: true });

    if (error) throw new Error(`[accommodation_units] findByCapacity failed: ${error.message}`);
    return (data as Chalet[]) ?? [];
  }
}

export class ChaletBookingRepository extends BaseRepository<ChaletBooking> {
  constructor() {
    super('transactions');
    this.baseFilters = { engine_type: 'time_exclusive_reservation' };
  }

  /** Check whether an accommodation unit is available for the given date range. */
  async checkAvailability(
    chaletId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<boolean> {
    const { data, error } = await this.getQuery()
      .contains('metadata', { chalet_id: chaletId })
      .not('status', 'in', '("cancelled","no_show")')
      .lt('metadata->>check_in_date', checkOut)
      .gt('metadata->>check_out_date', checkIn);

    if (error) throw new Error(`[transactions] checkAvailability failed: ${error.message}`);
    return !data || data.length === 0;
  }

  /** Find bookings for a specific chalet. */
  async findByChalet(
    chaletId: string,
    options?: FindManyOptions,
  ): Promise<ChaletBooking[]> {
    const { data, error } = await this.getQuery()
      .contains('metadata', { chalet_id: chaletId })
      .order('created_at', { ascending: false });

    if (error) throw new Error(`[transactions] findByChalet failed: ${error.message}`);
    return (data as ChaletBooking[]) ?? [];
  }

  /** Find bookings for a specific customer. */
  async findByCustomer(
    customerId: string,
    options?: FindManyOptions,
  ): Promise<ChaletBooking[]> {
    return this.findMany(
      { customer_id: customerId },
      { orderBy: 'created_at', ascending: false, ...options },
    );
  }

  /** Find bookings by status (e.g. 'confirmed', 'checked_in'). */
  async findByStatus(
    status: string,
    options?: FindManyOptions,
  ): Promise<ChaletBooking[]> {
    return this.findMany(
      { status },
      { orderBy: 'created_at', ascending: true, ...options },
    );
  }

  /** Find bookings overlapping with a date range. */
  async findByDateRange(from: string, to: string): Promise<ChaletBooking[]> {
    const { data, error } = await this.getQuery()
      .lt('metadata->>check_in_date', to)
      .gt('metadata->>check_out_date', from)
      .order('metadata->>check_in_date', { ascending: true });

    if (error) throw new Error(`[transactions] findByDateRange failed: ${error.message}`);
    return (data as ChaletBooking[]) ?? [];
  }
}

export class ChaletAddOnRepository extends BaseRepository<ChaletAddOn> {
  constructor() {
    super('chalet_add_ons');
  }

  /** Return only active add-ons. */
  async findActive(): Promise<ChaletAddOn[]> {
    return this.findMany({ is_active: true });
  }
}

/** Facade combining chalet sub-repositories. */
export class ChaletRepository {
  readonly chalets = new ChaletUnitRepository();
  readonly bookings = new ChaletBookingRepository();
  readonly addOns = new ChaletAddOnRepository();
}
