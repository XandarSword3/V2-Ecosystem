import { BaseRepository, FindManyOptions } from './BaseRepository.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  [key: string]: unknown;
  id: string;
  email: string;
  phone?: string | null;
  password_hash: string;
  full_name: string;
  profile_image_url?: string | null;
  preferred_language?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
  is_active?: boolean;
  last_login_at?: string | null;
  oauth_provider?: string | null;
  oauth_provider_id?: string | null;
  two_factor_enabled?: boolean;
  two_factor_secret?: string | null;
  backup_codes?: unknown;
  last_password_change?: string | null;
  failed_login_attempts?: number;
  locked_until?: string | null;
  last_failed_login?: string | null;
  two_factor_required?: boolean;
  stripe_customer_id?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Role {
  [key: string]: unknown;
  id: string;
  name: string;
  display_name: string;
  description?: string | null;
  business_unit?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  [key: string]: unknown;
  id: string;
  user_id: string;
  role_id: string;
  granted_by?: string | null;
  granted_at: string;
  expires_at?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export class UserAccountRepository extends BaseRepository<User> {
  constructor() {
    super('users');
  }

  /** Find a user by email. */
  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new Error(`[users] findByEmail failed: ${error.message}`);
    return (data as User) ?? null;
  }

  /** Find active users, optionally paginated. */
  async findActive(options?: FindManyOptions): Promise<User[]> {
    return this.findMany(
      { is_active: true },
      { orderBy: 'full_name', ascending: true, ...options },
    );
  }

  /** Search users by name or email (case-insensitive). */
  async search(term: string): Promise<User[]> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
      .is('deleted_at', null);

    if (error) throw new Error(`[users] search failed: ${error.message}`);
    return (data as User[]) ?? [];
  }

  /** Find users whose accounts are currently locked. */
  async findLocked(): Promise<User[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .gt('locked_until', now);

    if (error) throw new Error(`[users] findLocked failed: ${error.message}`);
    return (data as User[]) ?? [];
  }

  /** Find a user by Stripe customer ID. */
  async findByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();

    if (error) throw new Error(`[users] findByStripeCustomerId failed: ${error.message}`);
    return (data as User) ?? null;
  }
}

export class RoleRepository extends BaseRepository<Role> {
  constructor() {
    super('roles');
  }

  /** Find a role by its unique name. */
  async findByName(name: string): Promise<Role | null> {
    const { data, error } = await this.getClient()
      .from(this.tableName)
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (error) throw new Error(`[roles] findByName failed: ${error.message}`);
    return (data as Role) ?? null;
  }

  /** Find roles associated with a specific business unit. */
  async findByBusinessUnit(businessUnit: string): Promise<Role[]> {
    return this.findMany({ business_unit: businessUnit });
  }
}

export class UserRoleRepository extends BaseRepository<UserRole> {
  constructor() {
    super('user_roles');
  }

  /** Find all role assignments for a specific user. */
  async findByUser(userId: string): Promise<UserRole[]> {
    return this.findMany({ user_id: userId });
  }

  /** Find all users assigned a specific role. */
  async findByRole(roleId: string): Promise<UserRole[]> {
    return this.findMany({ role_id: roleId });
  }

  /** Assign a role to a user. */
  async assignRole(
    userId: string,
    roleId: string,
    grantedBy?: string,
  ): Promise<UserRole> {
    return this.create({
      user_id: userId,
      role_id: roleId,
      granted_by: grantedBy ?? null,
    } as Partial<UserRole>);
  }
}

/** Facade combining user sub-repositories. */
export class UserRepository {
  readonly users = new UserAccountRepository();
  readonly roles = new RoleRepository();
  readonly userRoles = new UserRoleRepository();
}
