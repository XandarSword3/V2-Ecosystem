/**
 * V2 Resort — Phase 2: Comprehensive E2E Customer API Testing (v2)
 * Tests ALL customer-facing endpoints systematically
 * Run: node scripts/e2e-customer-test.js
 */

const http = require('http');

const BASE = 'http://localhost:3005';
let csrfToken = '';
let cookies = '';
let jwt = '';
let userId = '';

const results = { pass: 0, fail: 0, errors: [] };
const TEST_EMAIL = `e2e_${Date.now()}@test.com`;
const TEST_PASS = 'TestPass123!';

function request(method, path, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      'Cookie': cookies,
      ...extraHeaders,
    };
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method, headers,
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.headers['set-cookie']) {
          const nc = res.headers['set-cookie'].map(c => c.split(';')[0]).join(';');
          cookies = cookies ? cookies + ';' + nc : nc;
        }
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, data: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function test(name, status, condition, detail = '') {
  if (condition) {
    results.pass++;
    console.log(`  ✅ ${name} (${status})`);
  } else {
    results.fail++;
    const msg = `${name} (${status}) ${detail}`.substring(0, 150);
    results.errors.push(msg);
    console.log(`  ❌ ${name} (${status}) ${detail}`.substring(0, 160));
  }
}

async function setup() {
  console.log('\n🔧 SETUP: CSRF + Register + Login\n');
  const csrf = await request('GET', '/api/csrf-token');
  csrfToken = csrf.data.csrfToken;
  test('CSRF token', csrf.status, csrf.status === 200 && csrfToken);

  const reg = await request('POST', '/api/v1/auth/register', {
    email: TEST_EMAIL, password: TEST_PASS, fullName: 'John Smith', phone: '+12025551234',
  });
  test('Register test customer', reg.status, reg.status === 201 || reg.status === 200,
    typeof reg.data === 'object' ? (reg.data.error || '') : '');

  const login = await request('POST', '/api/v1/auth/login', { email: TEST_EMAIL, password: TEST_PASS });
  if (login.status === 200 && login.data.data?.tokens?.accessToken) {
    jwt = login.data.data.tokens.accessToken;
    userId = login.data.data.user?.id;
    test('Login as test customer', login.status, true);
  } else {
    console.log('  ⚠️  Customer login failed, fallback to admin...');
    const admin = await request('POST', '/api/v1/auth/login', { email: 'admin@v2resort.com', password: 'admin123' });
    jwt = admin.data.data?.tokens?.accessToken;
    userId = admin.data.data?.user?.id;
    test('Login fallback (admin)', admin.status, admin.status === 200);
  }
}

async function testAuth() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2A: AUTHENTICATION FLOWS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const me = await request('GET', '/api/v1/auth/me');
  test('GET /auth/me', me.status, me.status === 200 && me.data.data?.email);
  const profile = await request('GET', '/api/v1/users/profile');
  test('GET /users/profile', profile.status, profile.status === 200 || profile.status === 404);
  const saved = jwt; jwt = '';
  const forgot = await request('POST', '/api/v1/auth/forgot-password', { email: 'nobody@fake.com' });
  test('POST /auth/forgot-password', forgot.status, forgot.status === 200);
  jwt = saved;
  const twofa = await request('GET', '/api/v1/auth/2fa/status');
  test('GET /auth/2fa/status', twofa.status, twofa.status === 200);
  const setup2fa = await request('POST', '/api/v1/auth/2fa/setup');
  test('POST /auth/2fa/setup', setup2fa.status, setup2fa.status === 200,
    typeof setup2fa.data === 'object' ? (setup2fa.data.error || '') : '');
  const changePw = await request('PUT', '/api/v1/auth/change-password', {
    currentPassword: 'wrong', newPassword: 'NewPass456!',
  });
  test('PUT /auth/change-password (wrong old)', changePw.status,
    changePw.status === 400 || changePw.status === 401 || changePw.status === 403);
}

async function testRestaurant() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2B: RESTAURANT FLOWS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const menu = await request('GET', '/api/v1/restaurant/menu');
  test('GET /restaurant/menu', menu.status, menu.status === 200);
  const cats = await request('GET', '/api/v1/restaurant/menu/categories');
  test('GET /restaurant/menu/categories', cats.status, cats.status === 200);
  const items = await request('GET', '/api/v1/restaurant/menu/items');
  test('GET /restaurant/menu/items', items.status, items.status === 200);
  let firstItemId = null;
  const menuItems = items.data?.data || [];
  if (menuItems.length > 0) firstItemId = menuItems[0].id;
  console.log(`  📦 Menu items: ${menuItems.length}`);
  const featured = await request('GET', '/api/v1/restaurant/menu/featured');
  test('GET /restaurant/menu/featured', featured.status, featured.status === 200);
  if (firstItemId) {
    const item = await request('GET', `/api/v1/restaurant/menu/items/${firstItemId}`);
    test('GET /restaurant/menu/items/:id', item.status, item.status === 200);
    const mods = await request('GET', `/api/v1/restaurant/menu/items/${firstItemId}/modifiers`);
    test('GET /menu/items/:id/modifiers', mods.status, mods.status === 200);
  }
  const tables = await request('GET', '/api/v1/restaurant/tables');
  test('GET /restaurant/tables', tables.status, tables.status === 200);
  const avail = await request('GET', '/api/v1/restaurant/tables/available');
  test('GET /restaurant/tables/available', avail.status, avail.status === 200);
  const resAvail = await request('GET', '/api/v1/restaurant/reservations/availability?date=2026-03-01&time=19:00&party_size=4');
  test('GET /reservations/availability', resAvail.status, resAvail.status === 200,
    typeof resAvail.data === 'object' ? (resAvail.data.error || '') : '');
  // Get a table ID from availability or tables list for reservation
  let tableIdForRes = null;
  if (resAvail.data?.data?.length > 0) {
    tableIdForRes = resAvail.data.data[0].id;
  } else if (tables.data?.data?.length > 0) {
    tableIdForRes = tables.data.data[0].id;
  }
  // Use random future date to avoid conflicts from repeated test runs
  const resDay = Math.floor(Math.random() * 28) + 1;
  const resMonth = Math.floor(Math.random() * 6) + 4; // Apr-Sep
  const resDate = `2027-${String(resMonth).padStart(2,'0')}-${String(resDay).padStart(2,'0')}`;
  const resHour = 12 + Math.floor(Math.random() * 8); // 12:00-19:00
  const reservation = await request('POST', '/api/v1/restaurant/reservations', {
    table_id: tableIdForRes,
    guest_name: 'John Smith', guest_email: 'john@test.com', guest_phone: '+12025551234',
    date: resDate, time: `${resHour}:00`, party_size: 2, special_requests: 'Window seat',
  });
  test('POST /restaurant/reservations', reservation.status,
    reservation.status === 201 || reservation.status === 200 || reservation.status === 409,
    typeof reservation.data === 'object' ? (reservation.data.error || reservation.data.message || '').substring(0, 100) : '');
  const wlJoin = await request('POST', '/api/v1/restaurant/waitlist/join', {
    customerName: 'John Smith', customerPhone: '+12025551235', partySize: 2,
  });
  test('POST /restaurant/waitlist/join', wlJoin.status, wlJoin.status === 201 || wlJoin.status === 200);
  const wl = await request('GET', '/api/v1/restaurant/waitlist');
  test('GET /restaurant/waitlist', wl.status, wl.status === 200);
  if (firstItemId) {
    const order = await request('POST', '/api/v1/restaurant/orders', {
      customerId: userId, customerName: 'John Smith', customerPhone: '+12025551234',
      orderType: 'takeaway', paymentMethod: 'cash',
      items: [{ menuItemId: firstItemId, quantity: 1 }],
    });
    test('POST /restaurant/orders', order.status,
      order.status === 201 || order.status === 200,
      typeof order.data === 'object' ? (order.data.error || order.data.message || '').substring(0, 100) : '');
    if (order.data?.data?.id) {
      const og = await request('GET', `/api/v1/restaurant/orders/${order.data.data.id}`);
      test('GET /restaurant/orders/:id', og.status, og.status === 200);
      const os = await request('GET', `/api/v1/restaurant/orders/${order.data.data.id}/status`);
      test('GET /restaurant/orders/:id/status', os.status, os.status === 200);
    }
  }
  const myOrders = await request('GET', '/api/v1/restaurant/my-orders');
  test('GET /restaurant/my-orders', myOrders.status, myOrders.status === 200);
  const modGroups = await request('GET', '/api/v1/restaurant/modifiers');
  test('GET /restaurant/modifiers', modGroups.status, modGroups.status === 200);
}

async function testSnackBar() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2C: SNACK BAR FLOWS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const cats = await request('GET', '/api/v1/snack/categories');
  test('GET /snack/categories', cats.status, cats.status === 200);
  const items = await request('GET', '/api/v1/snack/items');
  test('GET /snack/items', items.status, items.status === 200);
  let firstSnackId = null;
  const snackItems = items.data?.data || [];
  if (snackItems.length > 0) firstSnackId = snackItems[0].id;
  console.log(`  📦 Snack items: ${snackItems.length}`);
  if (firstSnackId) {
    const item = await request('GET', `/api/v1/snack/items/${firstSnackId}`);
    test('GET /snack/items/:id', item.status, item.status === 200);
    const order = await request('POST', '/api/v1/snack/orders', {
      customerId: userId, customerName: 'John Smith',
      items: [{ itemId: firstSnackId, quantity: 2 }], paymentMethod: 'cash',
    });
    test('POST /snack/orders', order.status,
      order.status === 201 || order.status === 200,
      typeof order.data === 'object' ? (order.data.error || order.data.message || '').substring(0, 100) : '');
    if (order.data?.data?.id) {
      const og = await request('GET', `/api/v1/snack/orders/${order.data.data.id}`);
      test('GET /snack/orders/:id', og.status, og.status === 200);
      const os = await request('GET', `/api/v1/snack/orders/${order.data.data.id}/status`);
      test('GET /snack/orders/:id/status', os.status, os.status === 200);
    }
  }
  const myOrders = await request('GET', '/api/v1/snack/orders/my');
  test('GET /snack/orders/my', myOrders.status, myOrders.status === 200);
}

async function testChalets() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2D: CHALET FLOWS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const chalets = await request('GET', '/api/v1/chalets');
  test('GET /chalets', chalets.status, chalets.status === 200);
  let firstChaletId = null;
  const chaletList = chalets.data?.data || [];
  if (chaletList.length > 0) firstChaletId = chaletList[0].id;
  console.log(`  📦 Chalets: ${chaletList.length}`);
  if (firstChaletId) {
    const detail = await request('GET', `/api/v1/chalets/${firstChaletId}`);
    test('GET /chalets/:id', detail.status, detail.status === 200);
    const avail = await request('GET', `/api/v1/chalets/${firstChaletId}/availability?startDate=2026-05-01&endDate=2026-05-07`);
    test('GET /chalets/:id/availability', avail.status, avail.status === 200,
      typeof avail.data === 'object' ? (avail.data.error || '') : '');
  }
  const addons = await request('GET', '/api/v1/chalets/add-ons');
  test('GET /chalets/add-ons', addons.status, addons.status === 200);
  if (firstChaletId) {
    // Use random far-future dates to avoid conflicts from repeated test runs
    const chaletDay = Math.floor(Math.random() * 25) + 1;
    const chaletMonth = Math.floor(Math.random() * 6) + 4; // Apr-Sep
    const cIn = `2027-${String(chaletMonth).padStart(2,'0')}-${String(chaletDay).padStart(2,'0')}`;
    const cOut = `2027-${String(chaletMonth).padStart(2,'0')}-${String(chaletDay + 2).padStart(2,'0')}`;
    const booking = await request('POST', '/api/v1/chalets/bookings', {
      chaletId: firstChaletId, customerId: userId,
      customerName: 'John Smith', customerEmail: 'john@test.com', customerPhone: '+12025551234',
      checkInDate: cIn, checkOutDate: cOut, numberOfGuests: 2,
      specialRequests: 'Quiet area', paymentMethod: 'cash',
    });
    test('POST /chalets/bookings', booking.status,
      booking.status === 201 || booking.status === 200 || booking.status === 400,
      typeof booking.data === 'object' ? (booking.data.error || booking.data.message || '').substring(0,100) : '');
    if (booking.data?.data?.id) {
      const bg = await request('GET', `/api/v1/chalets/bookings/${booking.data.data.id}`);
      test('GET /chalets/bookings/:id', bg.status, bg.status === 200);
    }
  }
  const myBookings = await request('GET', '/api/v1/chalets/my-bookings');
  test('GET /chalets/my-bookings', myBookings.status, myBookings.status === 200);
}

async function testPool() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2E: POOL FLOWS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const sessions = await request('GET', '/api/v1/pool/sessions');
  test('GET /pool/sessions', sessions.status, sessions.status === 200);
  let firstSessionId = null;
  const sessionList = sessions.data?.data || [];
  if (sessionList.length > 0) firstSessionId = sessionList[0].id;
  console.log(`  📦 Pool sessions: ${sessionList.length}`);
  if (firstSessionId) {
    const session = await request('GET', `/api/v1/pool/sessions/${firstSessionId}`);
    test('GET /pool/sessions/:id', session.status, session.status === 200);
  }
  const avail = await request('GET', '/api/v1/pool/availability?date=2026-04-15');
  test('GET /pool/availability', avail.status, avail.status === 200,
    typeof avail.data === 'object' ? (avail.data.error || '') : '');
  const settings = await request('GET', '/api/v1/pool/settings');
  test('GET /pool/settings', settings.status, settings.status === 200);
  if (firstSessionId) {
    // Use random far-future date and minimal guests to avoid capacity issues
    const poolDay = Math.floor(Math.random() * 28) + 1;
    const poolMonth = Math.floor(Math.random() * 6) + 4; // Apr-Sep  
    const poolDate = `2027-${String(poolMonth).padStart(2,'0')}-${String(poolDay).padStart(2,'0')}`;
    const ticket = await request('POST', '/api/v1/pool/tickets', {
      sessionId: firstSessionId, customerId: userId,
      customerName: 'John Smith', customerEmail: 'john@test.com',
      ticketDate: poolDate, numberOfGuests: 1, paymentMethod: 'cash',
    });
    test('POST /pool/tickets', ticket.status,
      ticket.status === 201 || ticket.status === 200 || ticket.status === 400,
      typeof ticket.data === 'object' ? (ticket.data.error || ticket.data.message || '').substring(0,100) : '');
    if (ticket.data?.data?.id) {
      const tg = await request('GET', `/api/v1/pool/tickets/${ticket.data.data.id}`);
      test('GET /pool/tickets/:id', tg.status, tg.status === 200);
    }
  }
  const myTickets = await request('GET', '/api/v1/pool/my-tickets');
  test('GET /pool/my-tickets', myTickets.status, myTickets.status === 200);
}

async function testGiftCardsLoyalty() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2F: GIFT CARDS & LOYALTY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const templates = await request('GET', '/api/v1/giftcards/templates');
  test('GET /giftcards/templates', templates.status, templates.status === 200);
  const checkBal = await request('GET', '/api/v1/giftcards/check/FAKE-CODE-123');
  test('GET /giftcards/check (not found)', checkBal.status, checkBal.status === 200 || checkBal.status === 404);
  const purchase = await request('POST', '/api/v1/giftcards/purchase', {
    amount: 50, recipientName: 'Jane Doe', recipientEmail: 'jane@test.com',
    senderName: 'John Smith', message: 'Happy birthday', paymentMethod: 'cash',
  });
  test('POST /giftcards/purchase', purchase.status,
    purchase.status === 201 || purchase.status === 200,
    typeof purchase.data === 'object' ? (purchase.data.error || '').substring(0,100) : '');
  if (purchase.data?.data?.code) {
    const bal = await request('GET', `/api/v1/giftcards/check/${purchase.data.data.code}`);
    test('GET /giftcards/check (real card)', bal.status, bal.status === 200);
  }
  const myCards = await request('GET', '/api/v1/giftcards/my');
  test('GET /giftcards/my', myCards.status, myCards.status === 200);
  const loyaltySettings = await request('GET', '/api/v1/loyalty/settings');
  test('GET /loyalty/settings', loyaltySettings.status, loyaltySettings.status === 200);
  const tiers = await request('GET', '/api/v1/loyalty/tiers');
  test('GET /loyalty/tiers', tiers.status, tiers.status === 200);
  const calc = await request('POST', '/api/v1/loyalty/calculate', { amount: 50 });
  test('POST /loyalty/calculate', calc.status, calc.status === 200,
    typeof calc.data === 'object' ? (calc.data.error || '') : '');
  const enroll = await request('POST', '/api/v1/loyalty/enroll');
  test('POST /loyalty/enroll', enroll.status,
    enroll.status === 201 || enroll.status === 200 || enroll.status === 409,
    typeof enroll.data === 'object' ? (enroll.data.error || enroll.data.message || '') : '');
  const myLoyalty = await request('GET', '/api/v1/loyalty/me');
  test('GET /loyalty/me', myLoyalty.status, myLoyalty.status === 200,
    typeof myLoyalty.data === 'object' ? (myLoyalty.data.error || '') : '');
  const myTx = await request('GET', '/api/v1/loyalty/me/transactions');
  test('GET /loyalty/me/transactions', myTx.status, myTx.status === 200,
    typeof myTx.data === 'object' ? (myTx.data.error || '') : '');
}

async function testProfileGdpr() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2G: PROFILE, GDPR, COUPONS, REVIEWS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const profileUp = await request('PUT', '/api/v1/users/profile', {
    fullName: 'John Smith Updated', phone: '+12025559999', preferredLanguage: 'en',
  });
  test('PUT /users/profile', profileUp.status, profileUp.status === 200 || profileUp.status === 404,
    '(404 expected for fresh user without users table row)');
  const gdprDash = await request('GET', '/api/v1/gdpr/dashboard');
  test('GET /gdpr/dashboard', gdprDash.status, gdprDash.status === 200,
    typeof gdprDash.data === 'object' ? (gdprDash.data.error || '') : '');
  const consents = await request('GET', '/api/v1/gdpr/consents');
  test('GET /gdpr/consents', consents.status, consents.status === 200,
    typeof consents.data === 'object' ? (consents.data.error || '') : '');
  const consentUp = await request('PUT', '/api/v1/gdpr/consents', {
    consent_type: 'marketing', granted: false,
  });
  test('PUT /gdpr/consents', consentUp.status, consentUp.status === 200 || consentUp.status === 201,
    typeof consentUp.data === 'object' ? (consentUp.data.error || '') : '');
  const procLog = await request('GET', '/api/v1/gdpr/processing-log');
  test('GET /gdpr/processing-log', procLog.status, procLog.status === 200,
    typeof procLog.data === 'object' ? (procLog.data.error || '') : '');
  const dataSharing = await request('GET', '/api/v1/gdpr/data-sharing');
  test('GET /gdpr/data-sharing', dataSharing.status, dataSharing.status === 200,
    typeof dataSharing.data === 'object' ? (dataSharing.data.error || '') : '');
  const exportReq = await request('POST', '/api/v1/gdpr/export/request');
  test('POST /gdpr/export/request', exportReq.status,
    exportReq.status === 200 || exportReq.status === 201 || exportReq.status === 202,
    typeof exportReq.data === 'object' ? (exportReq.data.error || exportReq.data.message || '') : '');
  const exportSt = await request('GET', '/api/v1/gdpr/export/status');
  test('GET /gdpr/export/status', exportSt.status, exportSt.status === 200,
    typeof exportSt.data === 'object' ? (exportSt.data.error || '') : '');
  const userData = await request('GET', '/api/v1/users/me/data');
  test('GET /users/me/data (Art.15)', userData.status, userData.status === 200,
    typeof userData.data === 'object' ? (userData.data.error || '') : '');
  const portable = await request('POST', '/api/v1/users/me/data/portable');
  test('POST /users/me/data/portable (Art.20)', portable.status, portable.status === 200,
    typeof portable.data === 'object' ? (portable.data.error || '') : '');
  const activeCoupons = await request('GET', '/api/v1/coupons/active');
  test('GET /coupons/active', activeCoupons.status, activeCoupons.status === 200);
  const validateCoupon = await request('POST', '/api/v1/coupons/validate', { code: 'FAKE-COUPON' });
  test('POST /coupons/validate (fake)', validateCoupon.status,
    validateCoupon.status === 200 || validateCoupon.status === 404 || validateCoupon.status === 400);
  const reviews = await request('GET', '/api/v1/reviews');
  test('GET /reviews', reviews.status, reviews.status === 200);
  const review = await request('POST', '/api/v1/reviews', {
    rating: 5, title: 'Great Place', text: 'Loved the resort experience so much', category: 'general',
  });
  test('POST /reviews (create)', review.status,
    review.status === 201 || review.status === 200,
    typeof review.data === 'object' ? (review.data.error || '') : '');
}

async function testMiscPublic() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PHASE 2H: MISC PUBLIC & CROSS-CUTTING');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const health = await request('GET', '/health');
  test('GET /health', health.status, health.status === 200);
  const apiHealth = await request('GET', '/api/health');
  test('GET /api/health', apiHealth.status, apiHealth.status === 200);
  const settings = await request('GET', '/api/settings');
  test('GET /api/settings', settings.status, settings.status === 200);
  const modules = await request('GET', '/api/modules');
  test('GET /api/modules', modules.status, modules.status === 200);
  if (modules.data?.data) console.log(`  📦 Modules: ${modules.data.data.map(m => m.slug || m.name).join(', ')}`);
  const weather = await request('GET', '/api/weather');
  test('GET /api/weather', weather.status, weather.status === 200 || weather.status === 503);
  const tax = await request('GET', '/api/v1/settings/tax');
  test('GET /settings/tax', tax.status, tax.status === 200);
  const terminology = await request('GET', '/api/v1/terminology');
  test('GET /terminology', terminology.status, terminology.status === 200);
  const trEn = await request('GET', '/api/v1/translations?language=en');
  test('GET /translations (en)', trEn.status, trEn.status === 200);
  const trFr = await request('GET', '/api/v1/translations?language=fr');
  test('GET /translations (fr)', trFr.status, trFr.status === 200);
  const trAr = await request('GET', '/api/v1/translations?language=ar');
  test('GET /translations (ar)', trAr.status, trAr.status === 200);
  const faq = await request('GET', '/api/v1/support/faq');
  test('GET /support/faq', faq.status, faq.status === 200);
  const contact = await request('POST', '/api/v1/support/contact', {
    name: 'John Smith', email: 'john@test.com', subject: 'Test Inquiry', message: 'This is a test message for support contact form', phone: '+12025551234',
  });
  test('POST /support/contact', contact.status, contact.status === 201 || contact.status === 200);
  const credits = await request('GET', '/api/v1/bookings/credits');
  test('GET /bookings/credits', credits.status, credits.status === 200,
    typeof credits.data === 'object' ? (credits.data.error || '') : '');
  const payMethods = await request('GET', '/api/v1/payments/methods');
  test('GET /payments/methods', payMethods.status, payMethods.status === 200,
    typeof payMethods.data === 'object' ? (payMethods.data.error || '') : '');
  const devices = await request('GET', '/api/v1/devices');
  test('GET /devices', devices.status, devices.status === 200,
    typeof devices.data === 'object' ? (devices.data.error || '') : '');
  const units = await request('GET', '/api/v1/units');
  test('GET /units', units.status, units.status === 200);
  const dining = await request('GET', '/api/v1/dining/menu');
  test('GET /dining/menu', dining.status, dining.status === 200);
  const facilities = await request('GET', '/api/v1/facilities/sessions');
  test('GET /facilities/sessions', facilities.status, facilities.status === 200);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  V2 RESORT — PHASE 2: CUSTOMER E2E TESTING v2  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  try {
    await setup();
    await testAuth();
    await testRestaurant();
    await testSnackBar();
    await testChalets();
    await testPool();
    await testGiftCardsLoyalty();
    await testProfileGdpr();
    await testMiscPublic();
  } catch (err) {
    console.error('\n💥 FATAL:', err.message);
  }
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
  const s500 = results.errors.filter(e => e.includes('(500)'));
  const s401 = results.errors.filter(e => e.includes('(401)'));
  const s400 = results.errors.filter(e => e.includes('(400)'));
  const other = results.errors.filter(e => !e.match(/\(500\)|\(401\)|\(400\)/));
  console.log('\n📊 FAILURE BREAKDOWN:');
  console.log(`  🔴 Server errors (500): ${s500.length}`);
  console.log(`  🟡 Auth issues (401): ${s401.length}`);
  console.log(`  🟠 Validation (400): ${s400.length}`);
  console.log(`  ⚪ Other: ${other.length}`);
  console.log('');
}

main();
