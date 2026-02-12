import { BaseRepository, FindManyOptions } from './BaseRepository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Payment {
  [key: string]: unknown;
  id: string;
  reference_type: string;
  reference_id: string;
  amount: string;
  currency?: string;
  method: string;
  status: string;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  receipt_url?: string | null;
  processed_by?: string | null;
  processed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class PaymentRepository extends BaseRepository<Payment> {
  constructor() {
    super('payments');
  }

  /** Find payments linked to a specific reference (e.g. order, booking). */
  async findByReference(
    referenceType: string,
    referenceId: string,
  ): Promise<Payment[]> {
    return this.findMany({ reference_type: referenceType, reference_id: referenceId });
  }

  /** Find payments by status (e.g. 'pending', 'completed', 'refunded'). */
  async findByStatus(
    status: string,
    options?: FindManyOptions,
  ): Promise<Payment[]> {
    return this.findMany(
      { status },
      { orderBy: 'created_at', ascending: false, ...options },
    );
  }

  /** Find payments by method (e.g. 'cash', 'card'). */
  async findByMethod(
    method: string,
    options?: FindManyOptions,
  ): Promise<Payment[]> {
    return this.findMany(
      { method },
      { orderBy: 'created_at', ascending: false, ...options },
    );
  }

  /** Find payments within a date range. */
  async findByDateRange(from: string, to: string): Promise<Payment[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`[payments] findByDateRange failed: ${error.message}`);
    return (data as Payment[]) ?? [];
  }

  /** Find a payment by its Stripe payment intent ID. */
  async findByStripeIntent(intentId: string): Promise<Payment | null> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('stripe_payment_intent_id', intentId)
      .maybeSingle();

    if (error) throw new Error(`[payments] findByStripeIntent failed: ${error.message}`);
    return (data as Payment) ?? null;
  }

  /** Sum total payments for a reference. */
  async totalForReference(referenceType: string, referenceId: string): Promise<number> {
    const payments = await this.findByReference(referenceType, referenceId);
    return payments
      .filter((p) => p.status !== 'refunded')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
  }
}
