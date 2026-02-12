import { BaseRepository, FindManyOptions } from './BaseRepository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoyaltyMember {
  [key: string]: unknown;
  id: string;
  user_id: string;
  tier_id?: string | null;
  total_points?: number;
  available_points?: number;
  lifetime_points?: number;
  member_since?: string;
  last_activity?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LoyaltyTransaction {
  [key: string]: unknown;
  id: string;
  member_id: string;
  transaction_type: string;
  points: number;
  balance_after: number;
  description?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  expires_at?: string | null;
  created_at?: string;
}

export interface LoyaltyReward {
  [key: string]: unknown;
  id: string;
  name: string;
  description?: string | null;
  points_required: number;
  reward_type: string;
  reward_value: unknown;
  image_url?: string | null;
  stock?: number | null;
  min_tier_id?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export class LoyaltyMemberRepository extends BaseRepository<LoyaltyMember> {
  constructor() {
    super('loyalty_members');
  }

  /** Find the loyalty account for a specific user. */
  async findByUser(userId: string): Promise<LoyaltyMember | null> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(`[loyalty_members] findByUser failed: ${error.message}`);
    return (data as LoyaltyMember) ?? null;
  }

  /** Find members in a specific loyalty tier. */
  async findByTier(
    tierId: string,
    options?: FindManyOptions,
  ): Promise<LoyaltyMember[]> {
    return this.findMany(
      { tier_id: tierId },
      { orderBy: 'available_points', ascending: false, ...options },
    );
  }

  /** Find top members by lifetime points. */
  async findTopMembers(limit = 10): Promise<LoyaltyMember[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .order('lifetime_points', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`[loyalty_members] findTopMembers failed: ${error.message}`);
    return (data as LoyaltyMember[]) ?? [];
  }
}

export class LoyaltyTransactionRepository extends BaseRepository<LoyaltyTransaction> {
  constructor() {
    super('loyalty_transactions');
  }

  /** Find transactions for a specific member. */
  async findByMember(
    memberId: string,
    options?: FindManyOptions,
  ): Promise<LoyaltyTransaction[]> {
    return this.findMany(
      { member_id: memberId },
      { orderBy: 'created_at', ascending: false, ...options },
    );
  }

  /** Find transactions by type (e.g. 'earn', 'redeem', 'expire'). */
  async findByType(
    transactionType: string,
    options?: FindManyOptions,
  ): Promise<LoyaltyTransaction[]> {
    return this.findMany(
      { transaction_type: transactionType },
      { orderBy: 'created_at', ascending: false, ...options },
    );
  }

  /** Find transactions linked to a specific reference. */
  async findByReference(
    referenceType: string,
    referenceId: string,
  ): Promise<LoyaltyTransaction[]> {
    return this.findMany({ reference_type: referenceType, reference_id: referenceId });
  }
}

export class LoyaltyRewardRepository extends BaseRepository<LoyaltyReward> {
  constructor() {
    super('loyalty_rewards');
  }

  /** Find rewards currently active and available. */
  async findAvailable(): Promise<LoyaltyReward[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .lte('valid_from', now)
      .or(`valid_until.is.null,valid_until.gte.${now}`)
      .order('points_required', { ascending: true });

    if (error) throw new Error(`[loyalty_rewards] findAvailable failed: ${error.message}`);
    return (data as LoyaltyReward[]) ?? [];
  }
}

/** Facade combining loyalty sub-repositories. */
export class LoyaltyRepository {
  readonly members = new LoyaltyMemberRepository();
  readonly transactions = new LoyaltyTransactionRepository();
  readonly rewards = new LoyaltyRewardRepository();
}
