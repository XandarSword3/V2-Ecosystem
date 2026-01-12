// Stress Test Configuration
export const CONFIG = {
  // API Configuration
  BASE_URL: process.env.STRESS_TEST_URL || 'http://localhost:3005',
  API_BASE_URL: process.env.API_URL || 'http://localhost:3005/api',
  SOCKET_URL: process.env.SOCKET_URL || 'http://localhost:3005',

  // Bot Counts
  CUSTOMER_BOTS: 50,
  STAFF_BOTS_INITIAL: 7,   // Use the 7 pre-seeded staff accounts
  STAFF_BOTS_TRAINEES: 5,  // Admin will hire these during test
  ADMIN_BOTS: 2,

  // Timing (milliseconds)
  CUSTOMER_ACTION_INTERVAL: { min: 3000, max: 10000 },  // 3-10 seconds between actions
  STAFF_ACTION_INTERVAL: { min: 2000, max: 8000 },     // 2-8 seconds
  ADMIN_ACTION_INTERVAL: { min: 10000, max: 30000 },   // 10-30 seconds (slower, more deliberate)
  
  // Metrics reporting interval
  METRICS_INTERVAL: 15000,  // Print metrics every 15 seconds
  
  // Test Duration
  TEST_DURATION_MS: 5 * 60 * 1000, // 5 minutes default
  
  // Admin Credentials (for creating users)
  ADMIN_EMAIL: process.env.STRESS_TEST_ADMIN_EMAIL || 'admin@v2resort.com',
  ADMIN_PASSWORD: process.env.STRESS_TEST_ADMIN_PASS || 'admin123',

  // Probability Weights (must sum to 100 for each bot type)
  CUSTOMER_ACTIONS: {
    BROWSE_RESTAURANT_MENU: 15,
    BROWSE_SNACK_MENU: 10,
    VIEW_CHALETS: 10,
    CHECK_CHALET_AVAILABILITY: 8,
    VIEW_POOL_SESSIONS: 8,
    ADD_TO_CART: 12,
    PLACE_RESTAURANT_ORDER: 8,
    PLACE_SNACK_ORDER: 5,
    BOOK_CHALET: 5,
    BUY_POOL_TICKET: 5,
    VIEW_MY_ORDERS: 5,
    VIEW_MY_BOOKINGS: 3,
    VIEW_MY_TICKETS: 2,
    SUBMIT_REVIEW: 2,
    CONTACT_SUPPORT: 1,
    VIEW_PROFILE: 1,
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
    VIEW_DASHBOARD: 15,
    VIEW_REVENUE_STATS: 10,
    VIEW_REPORTS: 10,
    VIEW_USERS: 8,
    CREATE_USER: 5,      // For hiring trainees
    UPDATE_USER: 3,
    VIEW_MODULES: 5,
    UPDATE_MODULE: 3,
    CREATE_MODULE: 3,    // Create new dynamic modules
    VIEW_SETTINGS: 5,
    UPDATE_SETTINGS: 3,
    VIEW_REVIEWS: 8,
    APPROVE_REVIEW: 5,
    REJECT_REVIEW: 2,
    VIEW_AUDIT_LOGS: 5,
    CREATE_BACKUP: 2,
    MANAGE_BACKUPS: 2,
    COMPARE_TRANSLATIONS: 3,
    MANAGE_MENU_CATEGORY: 3,
    MANAGE_MENU_ITEM: 4,
    MANAGE_CHALET: 2,
    MANAGE_POOL_SESSION: 2,
  },
};

// Generate test user data
export function generateCustomerData(index: number) {
  return {
    email: `testcustomer${index}@stresstest.local`,
    password: 'TestPass123!',
    full_name: `Test Customer ${index}`,
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
    full_name: `${isTrainee ? 'Trainee' : 'Stress Test Staff'} ${index}`,
    phone: `+961${String(71000000 + index).padStart(8, '0')}`,
    roles: roleList,
  };
}

export function generateAdminData(index: number) {
  return {
    email: `testadmin${index}@stresstest.local`,
    password: 'AdminPass123!',
    full_name: `Test Admin ${index}`,
    phone: `+961${String(72000000 + index).padStart(8, '0')}`,
    roles: ['super_admin'],
  };
}
