// Stress Test Configuration
export const CONFIG = {
  // API Configuration
  BASE_URL: process.env.STRESS_TEST_URL || 'http://127.0.0.1:3005',
  API_BASE_URL: process.env.API_URL || 'http://127.0.0.1:3005/api/v1',
  SOCKET_URL: process.env.SOCKET_URL || 'http://127.0.0.1:3005',

  // Logging
  VERBOSE_LOGGING: false,  // Set true to log every API request

  // Bot Counts
  CUSTOMER_BOTS: 50,
  STAFF_BOTS_INITIAL: 7,   // Use the 7 pre-seeded staff accounts
  STAFF_BOTS_TRAINEES: 5,  // Admin will hire these during test
  ADMIN_BOTS: 2,
  MANAGER_BOTS: 2,         // Manager role: approvals, shifts, reports

  // Bot Ratios (when CHAOS_CONFIG.ENABLED is true)
  BOT_RATIOS: {
    CHAOS_CUSTOMER: 0.2,    // 20% of customers are chaotic
    MALICIOUS: 0.1,        // 10% of customers are malicious
  },

  // Timing (milliseconds)
  CUSTOMER_ACTION_INTERVAL: { min: 3000, max: 10000 },  // 3-10 seconds between actions
  STAFF_ACTION_INTERVAL: { min: 2000, max: 8000 },     // 2-8 seconds
  ADMIN_ACTION_INTERVAL: { min: 10000, max: 30000 },   // 10-30 seconds (slower, more deliberate)
  MANAGER_ACTION_INTERVAL: { min: 8000, max: 20000 },  // 8-20 seconds (deliberate oversight)

  // Metrics reporting interval
  METRICS_INTERVAL: 15000,  // Print metrics every 15 seconds

  // Test Duration
  TEST_DURATION_MS: 5 * 60 * 1000, // 5 minutes default

  // Admin Credentials (for creating users)
  ADMIN_EMAIL: process.env.STRESS_TEST_ADMIN_EMAIL || 'admin@v2resort.com',
  ADMIN_PASSWORD: process.env.STRESS_TEST_ADMIN_PASS || 'admin123',

  // Probability Weights (must sum to 100 for each bot type)
  CUSTOMER_ACTIONS: {
    BROWSE_RESTAURANT_MENU: 11,
    BROWSE_SNACK_MENU: 7,
    VIEW_CHALETS: 7,
    CHECK_CHALET_AVAILABILITY: 5,
    VIEW_POOL_SESSIONS: 5,
    ADD_TO_CART: 10,
    PLACE_RESTAURANT_ORDER: 6,
    PLACE_SNACK_ORDER: 4,
    BOOK_CHALET: 4,
    BUY_POOL_TICKET: 4,
    VIEW_MY_ORDERS: 4,
    VIEW_MY_BOOKINGS: 2,
    VIEW_MY_TICKETS: 2,
    SUBMIT_REVIEW: 2,
    CONTACT_SUPPORT: 1,
    VIEW_PROFILE: 1,
    // --- Gift Cards ---
    BROWSE_GIFT_CARDS: 3,
    PURCHASE_GIFT_CARD: 2,
    CHECK_GIFT_CARD_BALANCE: 1,
    // --- Loyalty ---
    VIEW_LOYALTY: 3,
    ENROLL_LOYALTY: 1,
    // --- GDPR / Privacy ---
    VIEW_PRIVACY_DASHBOARD: 1,
    REQUEST_DATA_EXPORT: 1,
    // --- Coupons ---
    BROWSE_COUPONS: 2,
    APPLY_COUPON: 1,
    // --- Dynamic Modules ---
    BROWSE_DYNAMIC_MODULE: 3,
    PLACE_DYNAMIC_MODULE_ORDER: 2,
  },

  STAFF_ACTIONS: {
    VIEW_LIVE_ORDERS: 20,
    UPDATE_ORDER_STATUS: 25,
    VIEW_TODAY_BOOKINGS: 10,
    CHECKIN_GUEST: 8,
    CHECKOUT_GUEST: 5,
    VALIDATE_POOL_TICKET: 12,
    RECORD_POOL_ENTRY: 5,
    RECORD_POOL_EXIT: 3,
    VIEW_POOL_CAPACITY: 5,
    RECORD_PAYMENT: 5,
    VIEW_TABLES: 2,
  },

  ADMIN_ACTIONS: {
    VIEW_DASHBOARD: 10,
    VIEW_REVENUE_STATS: 7,
    VIEW_REPORTS: 7,
    VIEW_USERS: 5,
    CREATE_USER: 3,      // For hiring trainees
    UPDATE_USER: 2,
    VIEW_MODULES: 4,
    UPDATE_MODULE: 2,
    CREATE_MODULE: 2,    // Create new dynamic modules
    VIEW_SETTINGS: 3,
    UPDATE_SETTINGS: 2,
    VIEW_REVIEWS: 5,
    APPROVE_REVIEW: 3,
    REJECT_REVIEW: 1,
    VIEW_AUDIT_LOGS: 3,
    CREATE_BACKUP: 1,
    MANAGE_BACKUPS: 1,
    COMPARE_TRANSLATIONS: 2,
    MANAGE_MENU_CATEGORY: 2,
    MANAGE_MENU_ITEM: 3,
    MANAGE_CHALET: 2,
    MANAGE_POOL_SESSION: 2,
    // --- Inventory ---
    MANAGE_INVENTORY: 3,
    // --- Housekeeping ---
    MANAGE_HOUSEKEEPING: 2,
    // --- Loyalty (Admin) ---
    MANAGE_LOYALTY: 2,
    // --- Gift Cards (Admin) ---
    MANAGE_GIFT_CARDS: 2,
    // --- Coupons (Admin) ---
    MANAGE_COUPONS: 2,
    // --- Channels ---
    MANAGE_CHANNELS: 1,
    // --- Customizations ---
    MANAGE_CUSTOMIZATIONS: 1,
    // --- Terminology ---
    MANAGE_TERMINOLOGY: 1,
    // --- Notifications ---
    MANAGE_NOTIFICATIONS: 2,
    // --- Kiosk ---
    MANAGE_KIOSK: 1,
  },

  MANAGER_ACTIONS: {
    VIEW_PENDING_APPROVALS: 15,
    APPROVE_REQUEST: 12,
    DENY_REQUEST: 5,
    VIEW_APPROVAL_STATS: 8,
    VIEW_ALL_APPROVALS: 8,
    VIEW_SHIFTS: 10,
    VIEW_TODAY_SCHEDULE: 10,
    CREATE_SHIFT: 5,
    CLOCK_IN: 5,
    CLOCK_OUT: 5,
    VIEW_DASHBOARD: 10,
    VIEW_REVENUE_STATS: 7,
  },

  // Chaos Engineering Configuration
  CHAOS_CONFIG: {
    ENABLED: process.env.CHAOS_MODE === 'true',
    LATENCY_CHANCE: 0.3,       // 30% of requests will lag
    LATENCY_MS: { min: 500, max: 5000 },
    ERROR_CHANCE: 0.1,         // 10% of requests will fail network-side
    REPLAY_CHANCE: 0.05,       // 5% of requests will be sent twice (idempotency)
    OFFLINE_CHANCE: 0.05,      // 5% chance bot goes "offline" for a minute
    // Simulated Partial Outages (probability of 503 Service Unavailable for specific paths)
    OUTAGE_PATTERNS: {
      '/restaurant': 0.0,    // 0% outage
      '/pool': 0.0,
      '/chalets': 0.0,
      '/payments': 0.0
    }
  },
};

// Helper to turn an index into a string of letters (0 -> A, 1 -> B, etc.)
function indexToLetters(index: number): string {
  let res = '';
  let n = index;
  do {
    res = String.fromCharCode(65 + (n % 26)) + res;
    n = Math.floor(n / 26);
  } while (n > 0);
  return res;
}

// Generate test user data
export function generateCustomerData(index: number) {
  const letters = indexToLetters(index);
  return {
    email: `testcustomer${index}@stresstest.local`,
    password: 'TestPass123!',
    full_name: `Test Customer ${letters}`,
    phone: `+961${String(70000000 + index).padStart(8, '0')}`,
  };
}

// Staff order is important: stress test uses first N staff bots (default 7)
// Include snack staff early so snack orders can be processed
const SEEDED_STAFF = [
  'restaurant.staff@v2resort.com',   // 1: restaurant_staff
  'snack.staff@v2resort.com',        // 2: snack_bar_staff - moved up!
  'restaurant.admin@v2resort.com',   // 3: restaurant_admin
  'snack.admin@v2resort.com',        // 4: snack_bar_admin - moved up!
  'pool.staff@v2resort.com',         // 5: pool_staff
  'kitchen.staff@v2resort.com',      // 6: kitchen (restaurant_staff)
  'chalet.staff@v2resort.com',       // 7: chalet_staff
  'restaurant.manager@v2resort.com', // 8: moved down
  'pool.admin@v2resort.com',         // 9: moved down
  'chalet.manager@v2resort.com',     // 10: moved down
  'chalet.admin@v2resort.com'        // 11: moved down
];

export function generateStaffData(index: number, isTrainee = false) {
  // Use seeded staff if available and not a trainee
  if (!isTrainee && index <= SEEDED_STAFF.length) {
    // index is 1-based usually in these loops, map 1->0
    const emailIndex = index - 1;
    if (emailIndex >= 0 && emailIndex < SEEDED_STAFF.length) {
      return {
        email: SEEDED_STAFF[emailIndex],
        password: 'staff123',
        full_name: `Seeded Staff ${index}`,
        phone: `+961${String(71000000 + index).padStart(8, '0')}`,
        roles: ['staff'], // Roles are already in DB
      };
    }
  }

  const prefix = isTrainee ? 'trainee' : 'stresstest.staff';
  const roleList = ['restaurant_staff', 'snack_bar_staff', 'pool_staff', 'chalet_staff'];

  return {
    email: `${prefix}${index}@v2resort.com`,
    password: 'StaffPass123!',
    full_name: `${isTrainee ? 'Trainee' : 'Stress Test Staff'} ${indexToLetters(index)}`,
    phone: `+961${String(71000000 + index).padStart(8, '0')}`,
    roles: roleList,
  };
}

export function generateAdminData(index: number) {
  return {
    email: `testadmin${index}@stresstest.local`,
    password: 'AdminPass123!',
    full_name: `Test Admin ${indexToLetters(index)}`,
    phone: `+961${String(72000000 + index).padStart(8, '0')}`,
    roles: ['super_admin'],
  };
}
