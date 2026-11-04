/**
 * Phase 2 suite bootstrap
 *
 * Ensures each phase2 test file can run independently by preparing the
 * minimum shared state it requires (tokens and core entity IDs) without
 * relying on another file to run first.
 */

import { TEST_CONFIG } from '../config';
import { Phase2Client } from './phase2-client';
import { resetPhase2State, state, type Phase2State } from './phase2-state';
import { Pool } from 'pg';

const FALLBACK_ID = '00000000-0000-0000-0000-000000000000';
const FALLBACK_TOKEN = 'phase2-suite-fallback-token';

/**
 * Dedicated super_admin actor for the phase2 operator journey.
 *
 * Deliberately NOT admin@v2ecosystem.com (real account — never touched) and
 * NOT test.admin@v2ecosystem.com (its tenant-scoped login resolves the
 * property_manager row, which authorize('admin') correctly rejects).
 *
 * Homed to the platform-root tenant so the bare-localhost tenant fallback
 * resolves it, and so getCallerTenantId returns a concrete tenant. The
 * mandatory-2FA journey (Q103) is exercised for real: the harness clears this
 * user's two_factor_* rows on every run, then loginAsAdmin() enrolls via the
 * public API and lands a real session.
 */
const PHASE2_ADMIN_EMAIL = 'phase2.admin@v2ecosystem.test';
const PHASE2_ADMIN_PASSWORD = 'Phase2Admin123!';

/** Credentials of the dedicated phase2 admin actor (see comment above). */
export const PHASE2_ADMIN_CREDENTIALS = {
  email: PHASE2_ADMIN_EMAIL,
  password: PHASE2_ADMIN_PASSWORD,
};

type StateKey = keyof Phase2State;
type LooseRecord = Record<string, unknown>;

interface UserSeed {
  name: string;
  email: string;
  password: string;
  role: string;
  tokenKey: keyof Pick<
    Phase2State,
    'kitchenStaffToken' | 'capacityStaffToken' | 'accommodationStaffToken' | 'hkStaffToken' | 'managerToken' |
    'aliceToken' | 'bobToken' | 'carolToken'
  >;
  idKey: keyof Pick<
    Phase2State,
    'kitchenStaffId' | 'poolStaffId' | 'chaletStaffId' | 'hkStaffId' | 'managerId' |
    'aliceId' | 'bobId' | 'carolId'
  >;
}

const staffSeeds: UserSeed[] = [
  {
    name: 'Kitchen Staff',
    email: 'kitchen1@v2ecosystem.com',
    password: 'Staff123!',
    role: 'staff',
    tokenKey: 'kitchenStaffToken',
    idKey: 'kitchenStaffId',
  },
  {
    name: 'Pool Staff',
    email: 'pool1@v2ecosystem.com',
    password: 'Staff123!',
    role: 'staff',
    tokenKey: 'capacityStaffToken',
    idKey: 'poolStaffId',
  },
  {
    name: 'AccommodationUnit Staff',
    email: 'chalet1@v2ecosystem.com',
    password: 'Staff123!',
    role: 'staff',
    tokenKey: 'accommodationStaffToken',
    idKey: 'chaletStaffId',
  },
  {
    name: 'Housekeeping Staff',
    email: 'hk1@v2ecosystem.com',
    password: 'Staff123!',
    role: 'staff',
    tokenKey: 'hkStaffToken',
    idKey: 'hkStaffId',
  },
  {
    name: 'Property Manager',
    email: 'manager@v2ecosystem.com',
    password: 'Manager123!',
    role: 'admin',
    tokenKey: 'managerToken',
    idKey: 'managerId',
  },
];

const customerSeeds: UserSeed[] = [
  {
    name: 'Alice Johnson',
    email: 'alice@test.com',
    password: 'Customer123!',
    role: 'customer',
    tokenKey: 'aliceToken',
    idKey: 'aliceId',
  },
  {
    name: 'Bob Smith',
    email: 'bob@test.com',
    password: 'Customer123!',
    role: 'customer',
    tokenKey: 'bobToken',
    idKey: 'bobId',
  },
  {
    name: 'Carol Williams',
    email: 'carol@test.com',
    password: 'Customer123!',
    role: 'customer',
    tokenKey: 'carolToken',
    idKey: 'carolId',
  },
];

function setState<K extends StateKey>(key: K, value: Phase2State[K] | null | undefined): void {
  if (value !== undefined && value !== null && value !== '') {
    state[key] = value;
  }
}

function ensureState<K extends StateKey>(key: K, value: Phase2State[K]): void {
  if (!state[key]) {
    state[key] = value;
  }
}

function asArray<T = LooseRecord>(data: unknown, nestedKeys: string[] = []): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  const obj = (data as LooseRecord | null) || {};

  for (const key of nestedKeys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return [];
}

function normalizeName(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function toId(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return undefined;
}

function extractId(entity: LooseRecord | undefined): string | undefined {
  if (!entity) {
    return undefined;
  }

  const direct = toId(entity.id);
  if (direct) {
    return direct;
  }

  for (const key of ['module', 'category', 'item', 'menuItem', 'accommodation_unit', 'session', 'user']) {
    const nested = entity[key] as LooseRecord | undefined;
    const nestedId = toId(nested?.id);
    if (nestedId) {
      return nestedId;
    }
  }

  return undefined;
}

function findByName(items: LooseRecord[], names: string[]): LooseRecord | undefined {
  const normalized = names.map((n) => n.toLowerCase());
  return items.find((item) => {
    const candidate = normalizeName(item?.name || item?.title || item?.slug);
    return normalized.some((n) => candidate.includes(n));
  });
}

function extractMenuItems(menuData: unknown): LooseRecord[] {
  const direct = asArray<LooseRecord>(menuData, ['items', 'menuItems', 'catalog_items']);
  if (direct.length > 0) {
    return direct;
  }

  const categories = asArray<LooseRecord>(menuData, ['categories']);
  return categories.flatMap((category) =>
    asArray<LooseRecord>(category, ['items', 'menuItems', 'catalog_items'])
  );
}

function dbPool(): Pool {
  return new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  });
}

/**
 * Clear the phase2 admin user's 2FA state so the mandatory-enrollment journey
 * (Q103) runs from scratch on the next loginAsAdmin(). Idempotent.
 */
export async function resetPhase2Admin2FA(): Promise<void> {
  const pool = dbPool();
  try {
    const tenantRes = await pool.query(
      'SELECT id FROM tenants WHERE is_platform_root = TRUE ORDER BY created_at LIMIT 1',
    );
    const tenantId: string | undefined = tenantRes.rows[0]?.id;
    const userRes = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1',
      [PHASE2_ADMIN_EMAIL, tenantId],
    );
    const userId: string | undefined = userRes.rows[0]?.id;
    if (!userId) {
      return;
    }
    await pool.query('DELETE FROM two_factor_auth WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM two_factor_pending WHERE user_id = $1', [userId]);
    // login() reads users.two_factor_enabled (not the two_factor_* tables) —
    // clearing the tables alone would leave the login answering
    // requiresTwoFactor instead of starting a fresh enrollment.
    await pool.query('UPDATE users SET two_factor_enabled = FALSE WHERE id = $1', [userId]);
  } finally {
    await pool.end();
  }
}

/**
 * Ensure the dedicated phase2 super_admin exists and is reset to a
 * deterministic pre-login state (2FA cleared so the enrollment journey runs
 * fresh on every suite start). Idempotent.
 */
async function ensurePhase2AdminUser(): Promise<void> {
  const pool = dbPool();
  try {
    const tenantRes = await pool.query(
      'SELECT id FROM tenants WHERE is_platform_root = TRUE ORDER BY created_at LIMIT 1',
    );
    const tenantId: string | undefined = tenantRes.rows[0]?.id;
    if (!tenantId) {
      throw new Error('phase2 bootstrap: no platform-root tenant found');
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(PHASE2_ADMIN_PASSWORD, 12);

    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1',
      [PHASE2_ADMIN_EMAIL, tenantId],
    );
    let userId: string;
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
      await pool.query(
        `UPDATE users SET password_hash = $2, scope = 'super_admin', is_active = TRUE,
           email_verified = TRUE, full_name = 'Phase2 Admin' WHERE id = $1`,
        [userId, passwordHash],
      );
    } else {
      const inserted = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, email_verified, is_active, scope, tenant_id)
         VALUES ($1, $2, 'Phase2 Admin', TRUE, TRUE, 'super_admin', $3) RETURNING id`,
        [PHASE2_ADMIN_EMAIL, passwordHash, tenantId],
      );
      userId = inserted.rows[0].id;
    }
  } finally {
    await pool.end();
  }

  await resetPhase2Admin2FA();
}

/**
 * Complete the real email-verification journey for a freshly registered
 * user: registration issues no session until the email is verified (login
 * answers 403 EMAIL_NOT_VERIFIED). The verification token is stored in the
 * sessions table (session_type='email_verification'); the harness reads it
 * and calls the public GET /auth/verify-email endpoint — the same link a
 * real user clicks. Idempotent.
 */
export async function verifyNewUserEmail(client: Phase2Client, userId: string): Promise<boolean> {
  const pool = dbPool();
  try {
    const res = await pool.query(
      `SELECT token FROM sessions
       WHERE user_id = $1 AND session_type = 'email_verification' AND is_active = TRUE
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    const token: string | undefined = res.rows[0]?.token;
    if (!token) {
      return false;
    }
    const verifyRes = await client.get(`/auth/verify-email?token=${encodeURIComponent(token)}`, { auth: false });
    return verifyRes.success;
  } finally {
    await pool.end();
  }
}

/**
 * Resolve the tenant/property context the admin client sends on every request.
 * The harness hits bare localhost, so tenant resolution falls back to the
 * platform-root tenant; admin settings writes additionally need a property
 * (site_settings.property_id is NOT NULL).
 */
export async function wireAdminContext(): Promise<void> {
  const pool = dbPool();
  try {
    const tenantRes = await pool.query(
      'SELECT id FROM tenants WHERE is_platform_root = TRUE ORDER BY created_at LIMIT 1',
    );
    const tenantId: string | undefined = tenantRes.rows[0]?.id;
    const propertyRes = await pool.query(
      `SELECT id FROM properties WHERE tenant_id = $1 ORDER BY (id = '00000000-0000-0000-0000-000000000001') DESC, created_at LIMIT 1`,
      [tenantId],
    );
    const propertyId: string | undefined = propertyRes.rows[0]?.id;
    if (tenantId && propertyId) {
      Phase2Client.setDefaultHeaders({ 'X-Tenant-ID': tenantId, 'X-Property-Id': propertyId });
    }
  } finally {
    await pool.end();
  }
}

async function loginUser(email: string, password: string): Promise<{ token?: string; userId?: string }> {
  const c = new Phase2Client();
  const loginRes = await c.login(email, password);
  if (!loginRes.success) {
    return {};
  }

  return {
    token: c.getToken() || undefined,
    userId: c.userId || loginRes.data?.user?.id || loginRes.data?.id,
  };
}

// Map the legacy seed `role` string to the scope model. users.scope is the
// authorization source of truth — the admin create-user endpoint accepts
// `scope`, and the legacy roles/user_roles tables are frozen.
function roleToScope(role: string): string {
  switch (role) {
    case 'admin': return 'tenant_admin';
    case 'staff': return 'property_staff';
    case 'customer': return 'customer';
    default: return 'customer';
  }
}

async function ensureUser(admin: Phase2Client, seed: UserSeed): Promise<void> {
  let login = await loginUser(seed.email, seed.password);

  if (!login.token) {
    await admin.createAdminUser({
      full_name: seed.name,
      email: seed.email,
      password: seed.password,
      scope: roleToScope(seed.role),
    });

    login = await loginUser(seed.email, seed.password);
  }

  // Ensure staff / property_staff users have user_property_access on the suite's property
  if (login.userId && seed.role === 'staff') {
    const pool = dbPool();
    try {
      const tenantRes = await pool.query(
        'SELECT id FROM tenants WHERE is_platform_root = TRUE ORDER BY created_at LIMIT 1',
      );
      const tenantId: string | undefined = tenantRes.rows[0]?.id;
      const propertyRes = await pool.query(
        `SELECT id FROM properties WHERE tenant_id = $1 ORDER BY (id = '00000000-0000-0000-0000-000000000001') DESC, created_at LIMIT 1`,
        [tenantId],
      );
      const propertyId: string | undefined = propertyRes.rows[0]?.id;
      if (propertyId && tenantId) {
        await pool.query(
          `INSERT INTO user_property_access (user_id, property_id, tenant_id, access_level)
           VALUES ($1, $2, $3, 'write')
           ON CONFLICT (user_id, property_id) DO NOTHING`,
          [login.userId, propertyId, tenantId],
        );
      }
    } finally {
      await pool.end();
    }
  }

  setState(seed.tokenKey, login.token);
  setState(seed.idKey, login.userId);
}

async function ensureModule(admin: Phase2Client, module: {
  slug: string;
  name: string;
  engine_type: string;
  stateKey: keyof Pick<Phase2State, 'menuServiceModuleId' | 'accommodationModuleId' | 'capacityModuleId' | 'kioskModuleId'>;
}): Promise<void> {
  const modulesRes = await admin.getModules();
  const modules = asArray(modulesRes.data, ['modules']);

  let found = modules.find(
    (m) => normalizeName(m.slug) === module.slug || normalizeName(m.name) === normalizeName(module.name)
  );

  if (!found) {
    const createRes = await admin.createModule({
      name: module.name,
      slug: module.slug,
      engine_type: module.engine_type,
      is_active: true,
      show_in_main: true,
    });

    found = createRes.data?.module || createRes.data;
  }

  setState(module.stateKey, extractId(found as LooseRecord | undefined));
}

async function ensureRestaurantData(admin: Phase2Client): Promise<void> {
  if (!state.menuServiceModuleId) {
    return;
  }

  const categoryDefs: Array<{ key: keyof Pick<Phase2State, 'appetizersCatId' | 'mainsCatId' | 'dessertsCatId' | 'beveragesCatId'>; name: string; order: number }> = [
    { key: 'appetizersCatId', name: 'Appetizers', order: 1 },
    { key: 'mainsCatId', name: 'Main Courses', order: 2 },
    { key: 'dessertsCatId', name: 'Desserts', order: 3 },
    { key: 'beveragesCatId', name: 'Beverages', order: 4 },
  ];

  const menuRes = await admin.getMenu(state.menuServiceModuleId);
  const categories = asArray(menuRes.data, ['categories']);

  for (const def of categoryDefs) {
    let category = categories.find((c) => normalizeName(c.name) === normalizeName(def.name));

    if (!category) {
      const createRes = await admin.createCategory({
        name: def.name,
        module_id: state.menuServiceModuleId,
        display_order: def.order,
        sort_order: def.order,
      });
      category = createRes.data?.category || createRes.data;
    }

    setState(def.key, extractId(category as LooseRecord | undefined));
  }

  const refreshedMenu = await admin.getMenu(state.menuServiceModuleId);
  const allItems = extractMenuItems(refreshedMenu.data);

  const itemDefs: Array<{
    key: keyof Pick<Phase2State, 'bruschettaId' | 'salmonId' | 'cakeId' | 'espressoId' | 'wagyuId'>;
    name: string;
    categoryKey: keyof Pick<Phase2State, 'appetizersCatId' | 'mainsCatId' | 'dessertsCatId' | 'beveragesCatId'>;
    price: number;
  }> = [
    { key: 'bruschettaId', name: 'Bruschetta', categoryKey: 'appetizersCatId', price: 12.5 },
    { key: 'salmonId', name: 'Grilled Salmon', categoryKey: 'mainsCatId', price: 28 },
    { key: 'cakeId', name: 'Chocolate Cake', categoryKey: 'dessertsCatId', price: 9.5 },
    { key: 'espressoId', name: 'Espresso', categoryKey: 'beveragesCatId', price: 4 },
    { key: 'wagyuId', name: 'Wagyu Steak', categoryKey: 'mainsCatId', price: 85 },
  ];

  for (const def of itemDefs) {
    let item = allItems.find((i) => normalizeName(i.name) === normalizeName(def.name));
    const categoryId = state[def.categoryKey];

    if (!item && categoryId) {
      const createRes = await admin.createMenuItem({
        name: def.name,
        category_id: categoryId,
        module_id: state.menuServiceModuleId,
        price: def.price,
        is_available: true,
      });
      item = createRes.data?.item || createRes.data?.menuItem || createRes.data;
    }

    setState(def.key, extractId(item as LooseRecord | undefined));
  }

  const tableDefs: Array<{
    key: keyof Pick<Phase2State, 'table1Id' | 'table2Id' | 'tableT1Id'>;
    tableNumber: string;
    capacity: number;
    section: string;
  }> = [
    { key: 'table1Id', tableNumber: '501', capacity: 4, section: 'indoor' },
    { key: 'table2Id', tableNumber: '502', capacity: 6, section: 'indoor' },
    { key: 'tableT1Id', tableNumber: '503', capacity: 8, section: 'terrace' },
  ];

  const tablesRes = await admin.getTables(state.menuServiceModuleId);
  const tables = asArray<LooseRecord>(tablesRes.data, ['tables']);

  for (const def of tableDefs) {
    let table = tables.find(
      (t) => normalizeName(t.table_number || t.number) === normalizeName(def.tableNumber)
    );

    if (!table) {
      const createRes = await admin.createTable({
        table_number: def.tableNumber,
        capacity: def.capacity,
        section: def.section,
        module_id: state.menuServiceModuleId,
      });
      table = (createRes.data as LooseRecord | undefined) || (createRes.data?.table as LooseRecord | undefined);
      if (table) {
        tables.push(table);
      }
    }

    setState(def.key, extractId(table));
  }
}

async function ensureChaletData(admin: Phase2Client): Promise<void> {
  const chaletsRes = await admin.getAccommodationUnits();
  const accommodation_units = asArray(chaletsRes.data, ['accommodation_units', 'data']);

  const chaletDefs: Array<{ key: keyof Pick<Phase2State, 'unitAId' | 'unitBId' | 'unitCId'>; name: string; capacity: number; price: number }> = [
    { key: 'unitAId', name: 'Mountain View A', capacity: 4, price: 200 },
    { key: 'unitBId', name: 'Lakeside B', capacity: 6, price: 300 },
    { key: 'unitCId', name: 'Garden C', capacity: 2, price: 150 },
  ];

  for (const def of chaletDefs) {
    let accommodation_unit = accommodation_units.find((c) => normalizeName(c.name) === normalizeName(def.name));

    if (!accommodation_unit) {
      const createRes = await admin.createAccommodationUnit({
        name: def.name,
        capacity: def.capacity,
        base_price: def.price,
        price_per_night: def.price,
        weekend_price: def.price + 30,
        is_active: true,
        module_id: state.accommodationModuleId,
      });
      accommodation_unit = createRes.data?.accommodation_unit || createRes.data;
      if (accommodation_unit) {
        accommodation_units.push(accommodation_unit);
      }
    }

    setState(def.key, extractId(accommodation_unit as LooseRecord | undefined));
  }

  const addOnsRes = await admin.getAddOns(state.accommodationModuleId);
  const addOns = asArray<LooseRecord>(addOnsRes.data, ['addOns', 'addons']);
  const addOnDefs: Array<{
    key: keyof Pick<Phase2State, 'bbqAddonId' | 'basketAddonId' | 'beddingAddonId'>;
    name: string;
    description: string;
    price: number;
    price_type: string;
  }> = [
    { key: 'bbqAddonId', name: 'BBQ Equipment', description: 'Charcoal grill and utensils', price: 25, price_type: 'per_night' },
    { key: 'basketAddonId', name: 'Welcome Basket', description: 'Fruit, wine, and cheese basket', price: 45, price_type: 'one_time' },
    { key: 'beddingAddonId', name: 'Extra Bedding Set', description: 'Additional pillows and blankets', price: 15, price_type: 'per_night' },
  ];

  for (const def of addOnDefs) {
    let addOn = addOns.find((a) => normalizeName(a.name) === normalizeName(def.name));

    if (!addOn) {
      const createRes = await admin.createAddOn({
        name: def.name,
        description: def.description,
        price: def.price,
        price_type: def.price_type,
        is_active: true,
      });
      addOn = (createRes.data as LooseRecord | undefined) || (createRes.data?.addOn as LooseRecord | undefined);
      if (addOn) {
        addOns.push(addOn);
      }
    }

    setState(def.key, extractId(addOn));
  }
}

async function ensurePoolData(admin: Phase2Client): Promise<void> {
  const sessionsRes = await admin.getCapacityWindows(state.capacityModuleId);
  let sessions = asArray<LooseRecord>(sessionsRes.data, ['sessions', 'data']);
  if (sessions.length === 0) {
    const globalSessions = await admin.getCapacityWindows();
    sessions = asArray<LooseRecord>(globalSessions.data, ['sessions', 'data']);
  }

  const sessionDefs: Array<{
    key: keyof Pick<Phase2State, 'morningSessionId' | 'afternoonSessionId' | 'eveningSessionId'>;
    names: string[];
    create: { name: string; start_time: string; end_time: string; max_capacity: number; adult_price: number; child_price: number };
  }> = [
    {
      key: 'morningSessionId',
      names: ['morning swim', 'morning'],
      create: { name: 'Morning Swim', start_time: '08:00', end_time: '12:00', max_capacity: 50, adult_price: 15, child_price: 8 },
    },
    {
      key: 'afternoonSessionId',
      names: ['afternoon swim', 'afternoon'],
      create: { name: 'Afternoon Swim', start_time: '13:00', end_time: '17:00', max_capacity: 50, adult_price: 15, child_price: 8 },
    },
    {
      key: 'eveningSessionId',
      names: ['evening swim', 'evening'],
      create: { name: 'Evening Swim', start_time: '18:00', end_time: '21:00', max_capacity: 30, adult_price: 20, child_price: 10 },
    },
  ];

  for (const def of sessionDefs) {
    let session = findByName(sessions, def.names);

    if (!session) {
      const createRes = await admin.createPoolSession({
        ...def.create,
        capacity: def.create.max_capacity,
        price: def.create.adult_price,
        module_id: state.capacityModuleId,
        gender_restriction: 'mixed',
      });
      session = createRes.data?.session || createRes.data;
      if (session) {
        sessions.push(session);
      }
    }

    setState(def.key, extractId(session as LooseRecord | undefined));
  }
}

function ensureFallbacks(): void {
  const tokenKeys: StateKey[] = [
    'adminToken',
    'kitchenStaffToken',
    'capacityStaffToken',
    'accommodationStaffToken',
    'hkStaffToken',
    'managerToken',
    'aliceToken',
    'bobToken',
    'carolToken',
  ];

  const idKeys: StateKey[] = [
    'menuServiceModuleId',
    'accommodationModuleId',
    'capacityModuleId',
    'kioskModuleId',
    'appetizersCatId',
    'mainsCatId',
    'dessertsCatId',
    'beveragesCatId',
    'bruschettaId',
    'salmonId',
    'cakeId',
    'espressoId',
    'wagyuId',
    'table1Id',
    'table2Id',
    'tableT1Id',
    'unitAId',
    'unitBId',
    'unitCId',
    'bbqAddonId',
    'basketAddonId',
    'beddingAddonId',
    'morningSessionId',
    'afternoonSessionId',
    'eveningSessionId',
    'j01OrderId',
    'j03BookingId',
    'j04TicketId',
    'j12BookingId',
  ];

  const adminToken = state.adminToken || FALLBACK_TOKEN;

  for (const key of tokenKeys) {
    ensureState(key, adminToken);
  }

  for (const key of idKeys) {
    ensureState(key, FALLBACK_ID);
  }
}

export async function initializePhase2SuiteState(): Promise<void> {
  resetPhase2State();

  await ensurePhase2AdminUser();

  const admin = new Phase2Client();
  const adminLogin = await admin.loginAsAdmin(PHASE2_ADMIN_EMAIL, PHASE2_ADMIN_PASSWORD);
  if (!adminLogin.success) {
    console.error(`[phase2-bootstrap] admin login failed: ${adminLogin.error}`);
  }
  await wireAdminContext();

  setState('adminToken', admin.getToken());
  setState('managerToken', admin.getToken());

  if (adminLogin.success) {
    await ensureModule(admin, {
      slug: 'menu-service',
      name: 'MenuService',
      engine_type: 'instant_transaction',
      stateKey: 'menuServiceModuleId',
    });

    await ensureModule(admin, {
      slug: 'accommodation-units',
      name: 'AccommodationUnits',
      engine_type: 'time_exclusive_reservation',
      stateKey: 'accommodationModuleId',
    });

    await ensureModule(admin, {
      slug: 'capacity',
      name: 'Pool',
      engine_type: 'shared_capacity_access',
      stateKey: 'capacityModuleId',
    });

    await ensureModule(admin, {
      slug: 'kiosk',
      name: 'KioskItem Bar',
      engine_type: 'instant_transaction',
      stateKey: 'kioskModuleId',
    });

    await ensureRestaurantData(admin);
    await ensureChaletData(admin);
    await ensurePoolData(admin);

    for (const seed of staffSeeds) {
      await ensureUser(admin, seed);
    }

    for (const seed of customerSeeds) {
      await ensureUser(admin, seed);
    }
  }

  ensureFallbacks();
}

export function cleanupPhase2SuiteState(): void {
  resetPhase2State();
}
