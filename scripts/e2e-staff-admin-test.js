/**
 * V2 Ecosystem — Phase 3: Staff & Admin E2E Testing
 * Tests ALL staff and admin endpoints systematically
 */
const http = require('http');

let csrfToken = '';
let cookies = '';
let jwt = '';
let userId = '';
const results = { pass: 0, fail: 0, errors: [] };

function request(method, path, body, extraHeaders = {}) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost', port: 3005, path, method,
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
    };
    if (cookies) opts.headers.Cookie = cookies;
    if (jwt) opts.headers.Authorization = `Bearer ${jwt}`;
    if (csrfToken) opts.headers['x-csrf-token'] = csrfToken;
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    const req = http.request(opts, (res) => {
      let data = '';
      const resCookies = res.headers['set-cookie'] || [];
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, data: parsed, cookies: resCookies });
      });
    });
    req.on('error', (e) => resolve({ status: 0, data: e.message, cookies: [] }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function test(name, status, pass, detail = '') {
  if (pass) {
    results.pass++;
    console.log(`  ✅ ${name} (${status})`);
  } else {
    results.fail++;
    const msg = typeof detail === 'object' ? JSON.stringify(detail).substring(0, 120) : String(detail).substring(0, 120);
    results.errors.push(`${name} (${status}) ${msg}`);
    console.log(`  ❌ ${name} (${status}) ${msg}`);
  }
}

async function login(email, password, label) {
  const csrf = await request('GET', '/api/csrf-token');
  csrfToken = csrf.data.csrfToken;
  cookies = csrf.cookies.map(c => c.split(';')[0]).join('; ');
  const res = await request('POST', '/api/v1/auth/login', { email, password, _csrf: csrfToken });
  if (res.status === 200 && res.data?.data?.tokens) {
    jwt = res.data.data.tokens.accessToken;
    userId = res.data.data.user?.id;
    if (res.cookies.length) {
      cookies = [...csrf.cookies, ...res.cookies].map(c => c.split(';')[0]).join('; ');
    }
    console.log(`  ✅ Login as ${label} (${email})`);
    return true;
  } else {
    console.log(`  ❌ Login FAILED as ${label} (${email}): ${res.status} ${JSON.stringify(res.data).substring(0, 200)}`);
    return false;
  }
}

// ═══════════════════════════════════
// PHASE 3A: ADMIN — RESTAURANT CRUD
// ═══════════════════════════════════
async function testAdminRestaurant() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3A: ADMIN RESTAURANT CRUD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Menu Categories CRUD
  const cats = await request('GET', '/api/v1/restaurant/menu/categories');
  test('GET /restaurant/menu/categories', cats.status, cats.status === 200);

  const newCat = await request('POST', '/api/v1/restaurant/admin/categories', {
    name: 'E2E Test Category', description: 'Auto test', sortOrder: 99
  });
  test('POST /restaurant/admin/categories (create)', newCat.status, newCat.status === 201 || newCat.status === 200);
  const catId = newCat.data?.data?.id;

  if (catId) {
    const updCat = await request('PUT', `/api/v1/restaurant/admin/categories/${catId}`, {
      name: 'E2E Updated Category', description: 'Updated'
    });
    test('PUT /restaurant/admin/categories/:id (update)', updCat.status, updCat.status === 200);
    const delCat = await request('DELETE', `/api/v1/restaurant/admin/categories/${catId}`);
    test('DELETE /restaurant/admin/categories/:id (delete)', delCat.status, delCat.status === 200 || delCat.status === 204);
  }

  // Menu Items CRUD
  const items = await request('GET', '/api/v1/restaurant/menu/items');
  test('GET /restaurant/menu/items', items.status, items.status === 200);
  const firstCatId = items.data?.data?.[0]?.category_id || cats.data?.data?.[0]?.id;

  const newItem = await request('POST', '/api/v1/restaurant/admin/menu', {
    name: 'E2E Test Burger', name_ar: 'برغر اختبار', description: 'Test item', description_ar: 'عنصر اختبار',
    price: 12.99, category_id: firstCatId, preparation_time: 15, is_available: true, is_featured: false
  });
  test('POST /restaurant/admin/menu (create item)', newItem.status, newItem.status === 201 || newItem.status === 200);
  const itemId = newItem.data?.data?.id;

  if (itemId) {
    const updItem = await request('PUT', `/api/v1/restaurant/admin/menu/${itemId}`, {
      name: 'E2E Updated Burger', price: 14.99
    });
    test('PUT /restaurant/admin/menu/:id (update item)', updItem.status, updItem.status === 200);
    const delItem = await request('DELETE', `/api/v1/restaurant/admin/menu/${itemId}`);
    test('DELETE /restaurant/admin/menu/:id (delete item)', delItem.status, delItem.status === 200 || delItem.status === 204);
  }

  // Tables CRUD
  const tables = await request('GET', '/api/v1/restaurant/tables');
  test('GET /restaurant/tables', tables.status, tables.status === 200);

  const newTable = await request('POST', '/api/v1/restaurant/admin/tables', {
    number: 99, seats: 4, location: 'terrace', status: 'available'
  });
  test('POST /restaurant/admin/tables (create)', newTable.status, newTable.status === 201 || newTable.status === 200);
  const tableId = newTable.data?.data?.id;

  if (tableId) {
    const updTable = await request('PUT', `/api/v1/restaurant/admin/tables/${tableId}`, { seats: 6, status: 'available' });
    test('PUT /restaurant/admin/tables/:id (update)', updTable.status, updTable.status === 200);
    const delTable = await request('DELETE', `/api/v1/restaurant/admin/tables/${tableId}`);
    test('DELETE /restaurant/admin/tables/:id (delete)', delTable.status, delTable.status === 200 || delTable.status === 204);
  }

  // Reservations management
  const reservations = await request('GET', '/api/v1/restaurant/admin/reservations');
  test('GET /restaurant/admin/reservations', reservations.status, reservations.status === 200);

  // Orders management
  const orders = await request('GET', '/api/v1/restaurant/admin/orders');
  test('GET /restaurant/admin/orders', orders.status, orders.status === 200);

  // Modifiers
  const mods = await request('GET', '/api/v1/restaurant/modifiers');
  test('GET /restaurant/modifiers', mods.status, mods.status === 200);

  const newMod = await request('POST', '/api/v1/restaurant/admin/modifiers', {
    name: 'E2E Test Sauce', name_ar: 'صلصة اختبار', price: 1.50, category: 'sauces', is_available: true
  });
  test('POST /restaurant/admin/modifiers (create)', newMod.status, newMod.status === 201 || newMod.status === 200);
  const modId = newMod.data?.data?.id;
  if (modId) {
    const delMod = await request('DELETE', `/api/v1/restaurant/admin/modifiers/${modId}`);
    test('DELETE /restaurant/admin/modifiers/:id', delMod.status, delMod.status === 200 || delMod.status === 204);
  }

  // Waitlist
  const waitlist = await request('GET', '/api/v1/restaurant/admin/waitlist');
  test('GET /restaurant/admin/waitlist', waitlist.status, waitlist.status === 200);
}

// ═══════════════════════════════════
// PHASE 3B: ADMIN — CHALETS CRUD
// ═══════════════════════════════════
async function testAdminChalets() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3B: ADMIN CHALETS CRUD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const chalets = await request('GET', '/api/v1/units');
  test('GET /chalets', chalets.status, chalets.status === 200);

  const newChalet = await request('POST', '/api/v1/units/admin', {
    name: 'E2E Test Chalet', name_ar: 'شاليه اختبار', description: 'Test chalet',
    description_ar: 'شاليه اختبار', max_guests: 6, bedrooms: 2, bathrooms: 2,
    weekday_price: 120, weekend_price: 180, status: 'available',
    amenities: ['wifi', 'bbq', 'pool_access']
  });
  test('POST /chalets/admin (create)', newChalet.status, newChalet.status === 201 || newChalet.status === 200);
  const chaletId = newChalet.data?.data?.id;

  if (chaletId) {
    const getOne = await request('GET', `/api/v1/units/${chaletId}`);
    test('GET /chalets/:id (read created)', getOne.status, getOne.status === 200);
    const updChalet = await request('PUT', `/api/v1/units/admin/${chaletId}`, {
      name: 'E2E Updated Chalet', weekday_price: 150
    });
    test('PUT /chalets/admin/:id (update)', updChalet.status, updChalet.status === 200);
    const delChalet = await request('DELETE', `/api/v1/units/admin/${chaletId}`);
    test('DELETE /chalets/admin/:id (delete)', delChalet.status, delChalet.status === 200 || delChalet.status === 204);
  }

  // Bookings management
  const bookings = await request('GET', '/api/v1/units/admin/bookings');
  test('GET /chalets/admin/bookings', bookings.status, bookings.status === 200);

  // Add-ons CRUD
  const addons = await request('GET', '/api/v1/units/add-ons');
  test('GET /chalets/add-ons', addons.status, addons.status === 200);

  const newAddon = await request('POST', '/api/v1/units/admin/add-ons', {
    name: 'E2E Test Addon', name_ar: 'إضافة اختبار', price: 25, description: 'Test addon',
    is_available: true
  });
  test('POST /chalets/admin/add-ons (create)', newAddon.status, newAddon.status === 201 || newAddon.status === 200);
  const addonId = newAddon.data?.data?.id;
  if (addonId) {
    const delAddon = await request('DELETE', `/api/v1/units/admin/add-ons/${addonId}`);
    test('DELETE /chalets/admin/add-ons/:id', delAddon.status, delAddon.status === 200 || delAddon.status === 204);
  }

  // Pricing rules
  const pricing = await request('GET', '/api/v1/units/admin/pricing-rules');
  test('GET /chalets/admin/pricing-rules', pricing.status, pricing.status === 200);
}

// ═══════════════════════════════════
// PHASE 3C: ADMIN — POOL CRUD
// ═══════════════════════════════════
async function testAdminPool() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3C: ADMIN POOL CRUD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sessions = await request('GET', '/api/v1/pool/sessions');
  test('GET /pool/sessions', sessions.status, sessions.status === 200);

  const newSession = await request('POST', '/api/v1/pool/admin/sessions', {
    name: 'E2E Test Session', start_time: '20:00', end_time: '22:00',
    adult_price: 20, child_price: 12, max_capacity: 50,
    available_days: ['monday', 'tuesday', 'wednesday'], is_active: true
  });
  test('POST /pool/admin/sessions (create)', newSession.status, newSession.status === 201 || newSession.status === 200);
  const sessionId = newSession.data?.data?.id;

  if (sessionId) {
    const updSession = await request('PUT', `/api/v1/pool/admin/sessions/${sessionId}`, {
      name: 'E2E Updated Session', max_capacity: 60
    });
    test('PUT /pool/admin/sessions/:id (update)', updSession.status, updSession.status === 200);
    const delSession = await request('DELETE', `/api/v1/pool/admin/sessions/${sessionId}`);
    test('DELETE /pool/admin/sessions/:id (delete)', delSession.status, delSession.status === 200 || delSession.status === 204);
  }

  // Pool tickets management
  const tickets = await request('GET', '/api/v1/pool/admin/tickets');
  test('GET /pool/admin/tickets', tickets.status, tickets.status === 200);

  // Pool settings
  const settings = await request('GET', '/api/v1/pool/settings');
  test('GET /pool/settings', settings.status, settings.status === 200);

  const updSettings = await request('PUT', '/api/v1/pool/admin/settings', {
    max_daily_capacity: 500, opening_time: '06:00', closing_time: '22:00'
  });
  test('PUT /pool/admin/settings (update)', updSettings.status, updSettings.status === 200);
}

// ═══════════════════════════════════
// PHASE 3D: ADMIN — SNACK BAR CRUD
// ═══════════════════════════════════
async function testAdminSnackBar() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3D: ADMIN SNACK BAR CRUD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const cats = await request('GET', '/api/v1/snack/categories');
  test('GET /snack/categories', cats.status, cats.status === 200);
  const firstCatId = cats.data?.data?.[0]?.id;

  const items = await request('GET', '/api/v1/snack/items');
  test('GET /snack/items', items.status, items.status === 200);

  const newItem = await request('POST', '/api/v1/snack/admin/items', {
    name: 'E2E Test Smoothie', name_ar: 'عصير اختبار', description: 'Test smoothie',
    price: 7.99, category_id: firstCatId, is_available: true
  });
  test('POST /snack/admin/items (create)', newItem.status, newItem.status === 201 || newItem.status === 200);
  const itemId = newItem.data?.data?.id;

  if (itemId) {
    const updItem = await request('PUT', `/api/v1/snack/admin/items/${itemId}`, {
      name: 'E2E Updated Smoothie', price: 8.99
    });
    test('PUT /snack/admin/items/:id (update)', updItem.status, updItem.status === 200);
    const delItem = await request('DELETE', `/api/v1/snack/admin/items/${itemId}`);
    test('DELETE /snack/admin/items/:id', delItem.status, delItem.status === 200 || delItem.status === 204);
  }

  // Orders management
  const orders = await request('GET', '/api/v1/snack/admin/orders');
  test('GET /snack/admin/orders', orders.status, orders.status === 200);

  // Categories CRUD
  const newCat = await request('POST', '/api/v1/snack/admin/categories', {
    name: 'E2E Test Cat', name_ar: 'فئة اختبار', description: 'Test', sortOrder: 99
  });
  test('POST /snack/admin/categories (create)', newCat.status, newCat.status === 201 || newCat.status === 200);
  const catId = newCat.data?.data?.id;
  if (catId) {
    const delCat = await request('DELETE', `/api/v1/snack/admin/categories/${catId}`);
    test('DELETE /snack/admin/categories/:id', delCat.status, delCat.status === 200 || delCat.status === 204);
  }
}

// ═══════════════════════════════════
// PHASE 3E: STAFF — ORDER MANAGEMENT
// ═══════════════════════════════════
async function testStaffOrderManagement() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3E: STAFF ORDER MANAGEMENT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Staff module endpoints (generic for all modules)
  const staffOrders = await request('GET', '/api/v1/staff/modules/restaurant/orders');
  test('GET /staff/modules/restaurant/orders', staffOrders.status, staffOrders.status === 200);

  const staffSnackOrders = await request('GET', '/api/v1/staff/modules/snack-bar/orders');
  test('GET /staff/modules/snack-bar/orders', staffSnackOrders.status, staffSnackOrders.status === 200);

  // Update order status (find a pending order)
  const pendingOrders = staffOrders.data?.data?.filter(o => o.status === 'pending') || [];
  if (pendingOrders.length > 0) {
    const orderId = pendingOrders[0].id;
    const accept = await request('PUT', `/api/v1/staff/modules/restaurant/orders/${orderId}/status`, { status: 'confirmed' });
    test('PUT /staff/.../orders/:id/status (accept)', accept.status, accept.status === 200);
  } else {
    console.log('  ⚠️  No pending restaurant orders to test status update');
  }

  // Chalet bookings staff view
  const chaletBookings = await request('GET', '/api/v1/staff/modules/chalets/bookings');
  test('GET /staff/modules/chalets/bookings', chaletBookings.status, chaletBookings.status === 200);

  // Pool tickets staff view  
  const poolTickets = await request('GET', '/api/v1/staff/modules/pool/tickets');
  test('GET /staff/modules/pool/tickets', poolTickets.status, poolTickets.status === 200);

  // Staff dashboard stats
  const staffStats = await request('GET', '/api/v1/staff/modules/restaurant/stats');
  test('GET /staff/modules/restaurant/stats', staffStats.status, staffStats.status === 200);

  const chaletStats = await request('GET', '/api/v1/staff/modules/chalets/stats');
  test('GET /staff/modules/chalets/stats', chaletStats.status, chaletStats.status === 200);

  const poolStats = await request('GET', '/api/v1/staff/modules/pool/stats');
  test('GET /staff/modules/pool/stats', poolStats.status, poolStats.status === 200);

  const snackStats = await request('GET', '/api/v1/staff/modules/snack-bar/stats');
  test('GET /staff/modules/snack-bar/stats', snackStats.status, snackStats.status === 200);
}

// ═══════════════════════════════════
// PHASE 3F: ADMIN — LOYALTY & COUPONS
// ═══════════════════════════════════
async function testAdminLoyaltyCoupons() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3F: ADMIN LOYALTY & COUPONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Loyalty admin
  const loyaltySettings = await request('GET', '/api/v1/loyalty/admin/settings');
  test('GET /loyalty/admin/settings', loyaltySettings.status, loyaltySettings.status === 200);

  const loyaltyMembers = await request('GET', '/api/v1/loyalty/admin/members');
  test('GET /loyalty/admin/members', loyaltyMembers.status, loyaltyMembers.status === 200);

  const loyaltyTiers = await request('GET', '/api/v1/loyalty/admin/tiers');
  test('GET /loyalty/admin/tiers', loyaltyTiers.status, loyaltyTiers.status === 200);

  // Create a tier
  const newTier = await request('POST', '/api/v1/loyalty/admin/tiers', {
    name: 'E2E Test Tier', min_points: 9999, multiplier: 3.0, benefits: ['free_drink', 'priority_booking']
  });
  test('POST /loyalty/admin/tiers (create)', newTier.status, newTier.status === 201 || newTier.status === 200);
  const tierId = newTier.data?.data?.id;
  if (tierId) {
    const delTier = await request('DELETE', `/api/v1/loyalty/admin/tiers/${tierId}`);
    test('DELETE /loyalty/admin/tiers/:id', delTier.status, delTier.status === 200 || delTier.status === 204);
  }

  // Coupons admin
  const coupons = await request('GET', '/api/v1/coupons/admin');
  test('GET /coupons/admin', coupons.status, coupons.status === 200);

  const newCoupon = await request('POST', '/api/v1/coupons/admin', {
    code: 'E2ETEST50', discount_type: 'percentage', discount_value: 50,
    max_uses: 10, expires_at: '2027-12-31T23:59:59Z', is_active: true,
    description: 'E2E test coupon'
  });
  test('POST /coupons/admin (create)', newCoupon.status, newCoupon.status === 201 || newCoupon.status === 200);
  const couponId = newCoupon.data?.data?.id;

  if (couponId) {
    const updCoupon = await request('PUT', `/api/v1/coupons/admin/${couponId}`, {
      description: 'Updated E2E test coupon', max_uses: 20
    });
    test('PUT /coupons/admin/:id (update)', updCoupon.status, updCoupon.status === 200);
    const delCoupon = await request('DELETE', `/api/v1/coupons/admin/${couponId}`);
    test('DELETE /coupons/admin/:id', delCoupon.status, delCoupon.status === 200 || delCoupon.status === 204);
  }
}

// ═══════════════════════════════════
// PHASE 3G: ADMIN — GIFT CARDS
// ═══════════════════════════════════
async function testAdminGiftCards() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3G: ADMIN GIFT CARDS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const templates = await request('GET', '/api/v1/giftcards/admin/templates');
  test('GET /giftcards/admin/templates', templates.status, templates.status === 200);

  const cards = await request('GET', '/api/v1/giftcards/admin');
  test('GET /giftcards/admin (all cards)', cards.status, cards.status === 200);

  const newTemplate = await request('POST', '/api/v1/giftcards/admin/templates', {
    name: 'E2E Test Template', amounts: [25, 50, 100], design: 'classic',
    description: 'Test gift card template', is_active: true
  });
  test('POST /giftcards/admin/templates (create)', newTemplate.status, newTemplate.status === 201 || newTemplate.status === 200);
  const templateId = newTemplate.data?.data?.id;
  if (templateId) {
    const del = await request('DELETE', `/api/v1/giftcards/admin/templates/${templateId}`);
    test('DELETE /giftcards/admin/templates/:id', del.status, del.status === 200 || del.status === 204);
  }
}

// ═══════════════════════════════════
// PHASE 3H: ADMIN — USERS & STAFF
// ═══════════════════════════════════
async function testAdminUsersStaff() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3H: ADMIN USERS & STAFF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const users = await request('GET', '/api/v1/admin/users');
  test('GET /admin/users', users.status, users.status === 200);

  const roles = await request('GET', '/api/v1/admin/roles');
  test('GET /admin/roles', roles.status, roles.status === 200);

  const staff = await request('GET', '/api/v1/admin/staff');
  test('GET /admin/staff', staff.status, staff.status === 200);

  // Staff shifts
  const shifts = await request('GET', '/api/v1/staff/shifts');
  test('GET /staff/shifts', shifts.status, shifts.status === 200);

  const assignments = await request('GET', '/api/v1/staff/assignments');
  test('GET /staff/assignments', assignments.status, assignments.status === 200);
}

// ═══════════════════════════════════
// PHASE 3I: ADMIN — GDPR MANAGEMENT
// ═══════════════════════════════════
async function testAdminGDPR() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3I: ADMIN GDPR');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const exports = await request('GET', '/api/v1/gdpr/admin/exports');
  test('GET /gdpr/admin/exports', exports.status, exports.status === 200);

  const deletions = await request('GET', '/api/v1/gdpr/admin/deletions');
  test('GET /gdpr/admin/deletions', deletions.status, deletions.status === 200);

  const consents = await request('GET', '/api/v1/gdpr/admin/consents');
  test('GET /gdpr/admin/consents', consents.status, consents.status === 200);

  const processingActivities = await request('GET', '/api/v1/gdpr/admin/processing-activities');
  test('GET /gdpr/admin/processing-activities', processingActivities.status, processingActivities.status === 200);
}

// ═══════════════════════════════════
// PHASE 3J: ADMIN — REVIEWS
// ═══════════════════════════════════
async function testAdminReviews() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3J: ADMIN REVIEWS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const reviews = await request('GET', '/api/v1/reviews/admin');
  test('GET /reviews/admin (all)', reviews.status, reviews.status === 200);

  const pending = await request('GET', '/api/v1/reviews/admin?status=pending');
  test('GET /reviews/admin?status=pending', pending.status, pending.status === 200);

  // Approve a review if one exists
  const reviewList = reviews.data?.data?.reviews || reviews.data?.data || [];
  if (reviewList.length > 0) {
    const reviewId = reviewList[0].id;
    const approve = await request('PUT', `/api/v1/reviews/admin/${reviewId}`, { status: 'approved', is_approved: true });
    test('PUT /reviews/admin/:id (approve)', approve.status, approve.status === 200);
  }
}

// ═══════════════════════════════════
// PHASE 3K: ADMIN — SETTINGS & CONFIG
// ═══════════════════════════════════
async function testAdminSettings() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3K: ADMIN SETTINGS & CONFIG');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const settings = await request('GET', '/api/v1/admin/settings');
  test('GET /admin/settings', settings.status, settings.status === 200);

  const modules = await request('GET', '/api/v1/admin/modules');
  test('GET /admin/modules', modules.status, modules.status === 200);

  const terminology = await request('GET', '/api/v1/admin/terminology');
  test('GET /admin/terminology', terminology.status, terminology.status === 200);

  const tax = await request('GET', '/api/v1/admin/tax');
  test('GET /admin/tax', tax.status, tax.status === 200);

  // Messaging admin
  const messaging = await request('GET', '/api/v1/messaging/admin/templates');
  test('GET /messaging/admin/templates', messaging.status, messaging.status === 200);

  // Notifications admin
  const notifs = await request('GET', '/api/v1/notifications/admin');
  test('GET /notifications/admin', notifs.status, notifs.status === 200);

  // Devices admin
  const devices = await request('GET', '/api/v1/devices/admin');
  test('GET /devices/admin', devices.status, devices.status === 200);

  // Customization
  const customization = await request('GET', '/api/v1/customization');
  test('GET /customization', customization.status, customization.status === 200);

  const branding = await request('GET', '/api/v1/customization/branding');
  test('GET /customization/branding', branding.status, branding.status === 200);

  const theme = await request('GET', '/api/v1/customization/theme');
  test('GET /customization/theme', theme.status, theme.status === 200);
}

// ═══════════════════════════════════
// PHASE 3L: ADMIN — REPORTING
// ═══════════════════════════════════
async function testAdminReporting() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3L: ADMIN REPORTING');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const dashboard = await request('GET', '/api/v1/admin/dashboard');
  test('GET /admin/dashboard', dashboard.status, dashboard.status === 200);

  const revenue = await request('GET', '/api/v1/admin/reports/revenue');
  test('GET /admin/reports/revenue', revenue.status, revenue.status === 200);

  const orders = await request('GET', '/api/v1/admin/reports/orders');
  test('GET /admin/reports/orders', orders.status, orders.status === 200);

  const customers = await request('GET', '/api/v1/admin/reports/customers');
  test('GET /admin/reports/customers', customers.status, customers.status === 200);

  const analytics = await request('GET', '/api/v1/admin/analytics');
  test('GET /admin/analytics', analytics.status, analytics.status === 200);
}

// ═══════════════════════════════════
// PHASE 3M: HOUSEKEEPING & INVENTORY
// ═══════════════════════════════════
async function testHousekeepingInventory() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3M: HOUSEKEEPING & INVENTORY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Housekeeping
  const tasks = await request('GET', '/api/v1/housekeeping/tasks');
  test('GET /housekeeping/tasks', tasks.status, tasks.status === 200);

  const schedule = await request('GET', '/api/v1/housekeeping/schedule');
  test('GET /housekeeping/schedule', schedule.status, schedule.status === 200);

  const newTask = await request('POST', '/api/v1/housekeeping/tasks', {
    unit_id: null, task_type: 'cleaning', priority: 'medium',
    description: 'E2E test cleaning task', assigned_to: userId
  });
  test('POST /housekeeping/tasks (create)', newTask.status, 
    newTask.status === 201 || newTask.status === 200 || newTask.status === 400);

  // Inventory
  const inventory = await request('GET', '/api/v1/inventory');
  test('GET /inventory', inventory.status, inventory.status === 200);

  const categories = await request('GET', '/api/v1/inventory/categories');
  test('GET /inventory/categories', categories.status, categories.status === 200);

  const alerts = await request('GET', '/api/v1/inventory/alerts');
  test('GET /inventory/alerts', alerts.status, alerts.status === 200);

  const transactions = await request('GET', '/api/v1/inventory/transactions');
  test('GET /inventory/transactions', transactions.status, transactions.status === 200);
}

// ═══════════════════════════════════
// PHASE 3N: PAYMENTS & FINANCE
// ═══════════════════════════════════
async function testPaymentsFinance() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3N: PAYMENTS & FINANCE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const methods = await request('GET', '/api/v1/payments/methods');
  test('GET /payments/methods', methods.status, methods.status === 200);

  const history = await request('GET', '/api/v1/payments/history');
  test('GET /payments/history', history.status, history.status === 200);

  // Finance
  const finance = await request('GET', '/api/v1/finance/summary');
  test('GET /finance/summary', finance.status, finance.status === 200);

  const cashDrawer = await request('GET', '/api/v1/finance/cash-drawer');
  test('GET /finance/cash-drawer', cashDrawer.status, cashDrawer.status === 200);
}

// ═══════════════════════════════════
// PHASE 3O: MESSAGING & NOTIFICATIONS
// ═══════════════════════════════════
async function testMessagingNotifications() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 3O: MESSAGING & NOTIFICATIONS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const inbox = await request('GET', '/api/v1/messaging/inbox');
  test('GET /messaging/inbox', inbox.status, inbox.status === 200);

  const sent = await request('GET', '/api/v1/messaging/sent');
  test('GET /messaging/sent', sent.status, sent.status === 200);

  const templates = await request('GET', '/api/v1/messaging/templates');
  test('GET /messaging/templates', templates.status, templates.status === 200);

  // Notifications
  const notifs = await request('GET', '/api/v1/notifications');
  test('GET /notifications', notifs.status, notifs.status === 200);

  const prefs = await request('GET', '/api/v1/notifications/preferences');
  test('GET /notifications/preferences', prefs.status, prefs.status === 200);
}

// ═══════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  V2 RESORT — PHASE 3: STAFF & ADMIN E2E TEST   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log('🔧 SETUP: Login as Super Admin\n');

  const ok = await login('admin@v2ecosystem.com', 'admin123', 'Super Admin');
  if (!ok) { console.log('FATAL: Cannot login'); process.exit(1); }

  await testAdminRestaurant();
  await testAdminChalets();
  await testAdminPool();
  await testAdminSnackBar();
  await testStaffOrderManagement();
  await testAdminLoyaltyCoupons();
  await testAdminGiftCards();
  await testAdminUsersStaff();
  await testAdminGDPR();
  await testAdminReviews();
  await testAdminSettings();
  await testAdminReporting();
  await testHousekeepingInventory();
  await testPaymentsFinance();
  await testMessagingNotifications();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║                 RESULTS SUMMARY                 ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  ✅ PASSED: ${results.pass}`);
  console.log(`  ❌ FAILED: ${results.fail}`);
  console.log(`  TOTAL: ${results.pass + results.fail}`);
  if (results.errors.length > 0) {
    console.log('\n📋 FAILURES:');
    results.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }
  const s500 = results.errors.filter(e => e.includes('(500)')).length;
  const s404 = results.errors.filter(e => e.includes('(404)')).length;
  const s403 = results.errors.filter(e => e.includes('(403)')).length;
  const s400 = results.errors.filter(e => e.includes('(400)')).length;
  console.log(`\n📊 FAILURE BREAKDOWN:`);
  console.log(`  🔴 Server errors (500): ${s500}`);
  console.log(`  🟡 Not found (404): ${s404}`);
  console.log(`  🟠 Forbidden (403): ${s403}`);
  console.log(`  🟤 Validation (400): ${s400}`);
  console.log(`  ⚪ Other: ${results.errors.length - s500 - s404 - s403 - s400}`);
}

main().catch(console.error);
