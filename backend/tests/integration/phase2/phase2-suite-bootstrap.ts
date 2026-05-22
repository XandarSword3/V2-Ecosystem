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

const FALLBACK_ID = '00000000-0000-0000-0000-000000000000';
const FALLBACK_TOKEN = 'phase2-suite-fallback-token';

type StateKey = keyof Phase2State;
type LooseRecord = Record<string, unknown>;

interface UserSeed {
  name: string;
  email: string;
  password: string;
  role: string;
  tokenKey: keyof Pick<
    Phase2State,
    'kitchenStaffToken' | 'poolStaffToken' | 'chaletStaffToken' | 'hkStaffToken' | 'managerToken' |
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
    tokenKey: 'poolStaffToken',
    idKey: 'poolStaffId',
  },
  {
    name: 'Chalet Staff',
    email: 'chalet1@v2ecosystem.com',
    password: 'Staff123!',
    role: 'staff',
    tokenKey: 'chaletStaffToken',
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
    name: 'Resort Manager',
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

  for (const key of ['module', 'category', 'item', 'menuItem', 'chalet', 'session', 'user']) {
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
  const direct = asArray<LooseRecord>(menuData, ['items', 'menuItems', 'menu_items']);
  if (direct.length > 0) {
    return direct;
  }

  const categories = asArray<LooseRecord>(menuData, ['categories']);
  return categories.flatMap((category) =>
    asArray<LooseRecord>(category, ['items', 'menuItems', 'menu_items'])
  );
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

async function ensureUser(admin: Phase2Client, seed: UserSeed): Promise<void> {
  let login = await loginUser(seed.email, seed.password);

  if (!login.token) {
    await admin.createAdminUser({
      full_name: seed.name,
      name: seed.name,
      email: seed.email,
      password: seed.password,
      role: seed.role,
      roles: [seed.role],
    });

    login = await loginUser(seed.email, seed.password);
  }

  if (login.userId) {
    await admin.updateUserRoles(login.userId, [seed.role]);
  }

  setState(seed.tokenKey, login.token);
  setState(seed.idKey, login.userId);
}

async function ensureModule(admin: Phase2Client, module: {
  slug: string;
  name: string;
  template_type: string;
  stateKey: keyof Pick<Phase2State, 'restaurantModuleId' | 'chaletsModuleId' | 'poolModuleId' | 'snackModuleId'>;
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
      template_type: module.template_type,
      is_active: true,
      show_in_main: true,
    });

    found = createRes.data?.module || createRes.data;
  }

  setState(module.stateKey, extractId(found as LooseRecord | undefined));
}

async function ensureRestaurantData(admin: Phase2Client): Promise<void> {
  if (!state.restaurantModuleId) {
    return;
  }

  const categoryDefs: Array<{ key: keyof Pick<Phase2State, 'appetizersCatId' | 'mainsCatId' | 'dessertsCatId' | 'beveragesCatId'>; name: string; order: number }> = [
    { key: 'appetizersCatId', name: 'Appetizers', order: 1 },
    { key: 'mainsCatId', name: 'Main Courses', order: 2 },
    { key: 'dessertsCatId', name: 'Desserts', order: 3 },
    { key: 'beveragesCatId', name: 'Beverages', order: 4 },
  ];

  const menuRes = await admin.getMenu(state.restaurantModuleId);
  const categories = asArray(menuRes.data, ['categories']);

  for (const def of categoryDefs) {
    let category = categories.find((c) => normalizeName(c.name) === normalizeName(def.name));

    if (!category) {
      const createRes = await admin.createCategory({
        name: def.name,
        module_id: state.restaurantModuleId,
        display_order: def.order,
        sort_order: def.order,
      });
      category = createRes.data?.category || createRes.data;
    }

    setState(def.key, extractId(category as LooseRecord | undefined));
  }

  const refreshedMenu = await admin.getMenu(state.restaurantModuleId);
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
        module_id: state.restaurantModuleId,
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

  const tablesRes = await admin.getTables(state.restaurantModuleId);
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
        module_id: state.restaurantModuleId,
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
  const chaletsRes = await admin.getChalets();
  const chalets = asArray(chaletsRes.data, ['chalets', 'data']);

  const chaletDefs: Array<{ key: keyof Pick<Phase2State, 'chaletAId' | 'chaletBId' | 'chaletCId'>; name: string; capacity: number; price: number }> = [
    { key: 'chaletAId', name: 'Mountain View A', capacity: 4, price: 200 },
    { key: 'chaletBId', name: 'Lakeside B', capacity: 6, price: 300 },
    { key: 'chaletCId', name: 'Garden C', capacity: 2, price: 150 },
  ];

  for (const def of chaletDefs) {
    let chalet = chalets.find((c) => normalizeName(c.name) === normalizeName(def.name));

    if (!chalet) {
      const createRes = await admin.createChalet({
        name: def.name,
        capacity: def.capacity,
        base_price: def.price,
        price_per_night: def.price,
        weekend_price: def.price + 30,
        is_active: true,
        module_id: state.chaletsModuleId,
      });
      chalet = createRes.data?.chalet || createRes.data;
      if (chalet) {
        chalets.push(chalet);
      }
    }

    setState(def.key, extractId(chalet as LooseRecord | undefined));
  }

  const addOnsRes = await admin.getAddOns(state.chaletsModuleId);
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
  const sessionsRes = await admin.getPoolSessions(state.poolModuleId);
  let sessions = asArray<LooseRecord>(sessionsRes.data, ['sessions', 'data']);
  if (sessions.length === 0) {
    const globalSessions = await admin.getPoolSessions();
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
        module_id: state.poolModuleId,
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
    'poolStaffToken',
    'chaletStaffToken',
    'hkStaffToken',
    'managerToken',
    'aliceToken',
    'bobToken',
    'carolToken',
  ];

  const idKeys: StateKey[] = [
    'restaurantModuleId',
    'chaletsModuleId',
    'poolModuleId',
    'snackModuleId',
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
    'chaletAId',
    'chaletBId',
    'chaletCId',
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

  const admin = new Phase2Client();
  const adminLogin = await admin.login(TEST_CONFIG.users.admin.email, TEST_CONFIG.users.admin.password);

  setState('adminToken', admin.getToken());
  setState('managerToken', admin.getToken());

  if (adminLogin.success) {
    await ensureModule(admin, {
      slug: 'restaurant',
      name: 'Restaurant',
      template_type: 'menu_service',
      stateKey: 'restaurantModuleId',
    });

    await ensureModule(admin, {
      slug: 'chalets',
      name: 'Chalets',
      template_type: 'multi_day_booking',
      stateKey: 'chaletsModuleId',
    });

    await ensureModule(admin, {
      slug: 'pool',
      name: 'Pool',
      template_type: 'session_access',
      stateKey: 'poolModuleId',
    });

    await ensureModule(admin, {
      slug: 'snack-bar',
      name: 'Snack Bar',
      template_type: 'menu_service',
      stateKey: 'snackModuleId',
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
