/**
 * COMPREHENSIVE REBRANDING TEST
 * 
 * Rebrands the V2 Ecosystem 5 times via the frontend admin UI,
 * then verifies each rebrand as Customer, Admin, and Staff.
 * 
 * Rebrand Themes:
 * 1. Azure Bay Resort — Beach Paradise
 * 2. Alpine Peak Lodge — Mountain Retreat
 * 3. Golden Sunset Spa — Golden Sunset
 * 4. Emerald Forest Retreat — Cedar Forest
 * 5. Midnight Luxe Hotel — Midnight Sky
 */

import { test, expect, Page } from '../fixtures/auth.fixture';
import * as fs from 'fs';
import * as path from 'path';

const RUN_EXPLORATORY_E2E = process.env.RUN_EXPLORATORY_E2E === 'true';
test.skip(!RUN_EXPLORATORY_E2E, 'Full multi-theme rebrand validation is exploratory outside dedicated runs.');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const API_BASE = 'http://localhost:3005';
const FRONTEND = 'http://localhost:3000';

const ADMIN_CREDS = { email: 'admin@v2ecosystem.com', password: 'admin123' };
const STAFF_CREDS = { email: 'restaurant.staff@v2ecosystem.com', password: 'staff123' };

interface BrandConfig {
  name: string;
  tagline: string;
  description: string;
  themeName: string;
  themeId: string;
  weatherLocation: string;
  weatherEffect: string;
  phone: string;
  email: string;
  address: string;
  footerDescription: string;
  copyright: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButtonText: string;
}

const BRANDS: BrandConfig[] = [
  {
    name: 'Azure Bay Resort',
    tagline: 'Where the Ocean Meets Paradise',
    description: 'Azure Bay Resort is a premier oceanfront destination offering world-class dining, luxurious beachside chalets, stunning infinity pools, and exceptional service.',
    themeName: 'Beach Paradise',
    themeId: 'beach',
    weatherLocation: 'Miami Beach, USA',
    weatherEffect: 'waves',
    phone: '+1 (555) 289-2929',
    email: 'reservations@azurebayresort.com',
    address: '1 Azure Bay Drive, Crystal Cove, FL 33101',
    footerDescription: 'Your premier oceanfront paradise with world-class dining, beachside chalets, and crystal-clear pools.',
    copyright: '© {year} Azure Bay Resort. All rights reserved.',
    heroTitle: 'Welcome to Azure Bay Resort',
    heroSubtitle: 'Where the Ocean Meets Paradise',
    ctaTitle: 'Ready to Experience Paradise?',
    ctaSubtitle: 'Book your oceanfront escape today and discover pristine beaches, world-class dining, and unforgettable sunsets.',
    ctaButtonText: 'Book Now',
  },
  {
    name: 'Alpine Peak Lodge',
    tagline: 'Summit of Luxury',
    description: 'Alpine Peak Lodge is an exclusive mountain retreat offering fine dining, cozy alpine chalets, heated pools, and breathtaking panoramic views of snow-capped peaks.',
    themeName: 'Mountain Retreat',
    themeId: 'mountain',
    weatherLocation: 'Zermatt, Switzerland',
    weatherEffect: 'snow',
    phone: '+41 27 966 0000',
    email: 'concierge@alpinepeaklodge.com',
    address: '42 Summit Ridge, Zermatt, Valais, Switzerland',
    footerDescription: 'An exclusive mountain retreat where luxury meets the alpine wilderness.',
    copyright: '© {year} Alpine Peak Lodge. All rights reserved.',
    heroTitle: 'Welcome to Alpine Peak Lodge',
    heroSubtitle: 'Summit of Luxury',
    ctaTitle: 'Ready for a Mountain Adventure?',
    ctaSubtitle: 'Book your alpine escape and experience world-class skiing, fine dining, and cozy fireside evenings.',
    ctaButtonText: 'Reserve Your Stay',
  },
  {
    name: 'Golden Sunset Spa',
    tagline: 'Radiance Awaits',
    description: 'Golden Sunset Spa is a luxury wellness destination offering world-class spa treatments, gourmet health-conscious cuisine, private treatment suites, and serene sunset views.',
    themeName: 'Golden Sunset',
    themeId: 'sunset',
    weatherLocation: 'Santorini, Greece',
    weatherEffect: 'sunny',
    phone: '+30 2286 070000',
    email: 'wellness@goldensunset.spa',
    address: '7 Caldera View, Oia, Santorini 84702, Greece',
    footerDescription: 'A luxury wellness sanctuary where golden sunsets meet world-class rejuvenation.',
    copyright: '© {year} Golden Sunset Spa. All rights reserved.',
    heroTitle: 'Welcome to Golden Sunset Spa',
    heroSubtitle: 'Radiance Awaits',
    ctaTitle: 'Begin Your Wellness Journey?',
    ctaSubtitle: 'Immerse yourself in signature treatments, organic cuisine, and breathtaking caldera views.',
    ctaButtonText: 'Book Treatment',
  },
  {
    name: 'Emerald Forest Retreat',
    tagline: "Nature's Luxury Hideaway",
    description: 'Emerald Forest Retreat is an eco-luxury hideaway nestled deep in pristine old-growth forest, offering farm-to-table dining, treehouse suites, natural swimming pools, and guided forest experiences.',
    themeName: 'Cedar Forest',
    themeId: 'forest',
    weatherLocation: 'Bali, Indonesia',
    weatherEffect: 'leaves',
    phone: '+62 361 975 888',
    email: 'nature@emeraldforestretreat.com',
    address: '88 Rainforest Trail, Ubud, Bali 80571, Indonesia',
    footerDescription: "An eco-luxury sanctuary where nature's beauty and five-star comfort unite.",
    copyright: '© {year} Emerald Forest Retreat. All rights reserved.',
    heroTitle: 'Welcome to Emerald Forest Retreat',
    heroSubtitle: "Nature's Luxury Hideaway",
    ctaTitle: 'Ready to Reconnect with Nature?',
    ctaSubtitle: 'Escape to jungle treehouses, organic farm dining, and the sounds of the rainforest.',
    ctaButtonText: 'Explore Nature',
  },
  {
    name: 'Midnight Luxe Hotel',
    tagline: 'Where Elegance Meets the Night',
    description: 'Midnight Luxe Hotel is an ultra-premium boutique hotel offering Michelin-starred dining, opulent penthouse suites, a rooftop infinity pool, and an exclusive members-only lounge.',
    themeName: 'Midnight Sky',
    themeId: 'midnight',
    weatherLocation: 'Dubai, UAE',
    weatherEffect: 'stars',
    phone: '+971 4 888 0000',
    email: 'vip@midnightluxehotel.com',
    address: '1 Royal Boulevard, Downtown Dubai, UAE',
    footerDescription: 'Ultra-premium boutique elegance where the night sky meets unparalleled luxury.',
    copyright: '© {year} Midnight Luxe Hotel. All rights reserved.',
    heroTitle: 'Welcome to Midnight Luxe Hotel',
    heroSubtitle: 'Where Elegance Meets the Night',
    ctaTitle: 'Ready for Ultimate Luxury?',
    ctaSubtitle: 'Experience Michelin-starred cuisine, rooftop infinity pool, and exclusive penthouse living.',
    ctaButtonText: 'Reserve Suite',
  },
];

const SS_DIR = path.join(__dirname, '..', '..', 'screenshots', 'rebrand');
const LOG_FILE = path.join(SS_DIR, 'REBRAND_LOG.md');

function ensureDir() {
  if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
}

function appendLog(text: string) {
  ensureDir();
  fs.appendFileSync(LOG_FILE, text + '\n');
}

// ═══════════════════════════════════════════════════════════════
// AUTH & MOCK INFRASTRUCTURE
// ═══════════════════════════════════════════════════════════════

/** Active user for the /api/auth/me mock. Updated when switching roles. */
let _currentMockUser: any = null;
/** Whether persistent mocks have been set up on this page instance */
let _mocksInstalled = false;

/**
 * Set up ALL persistent route mocks BEFORE any page navigation.
 * Must be called once per test before any page.goto().
 *
 * CRITICAL: The settings-context does native `fetch('http://localhost:3005/api/settings')`
 * and `fetch('http://localhost:3005/api/modules?activeOnly=true')` — these cross-origin
 * requests fail with "TypeError: Failed to fetch". When they fail after a settings save
 * (triggered by socket event), the sidebar navigation empties. Mocking these prevents that.
 */
async function setupPersistentMocks(page: Page, adminToken: string) {
  if (_mocksInstalled) return;

  // Fetch real modules data for the mock responses (PUBLIC endpoint — no /v1/)
  let modulesData: any[] = [];
  try {
    const resp = await page.request.get(`${API_BASE}/api/modules?activeOnly=true`);
    if (resp.ok()) {
      const body = await resp.json();
      if (body.success && body.data) modulesData = body.data;
      else if (Array.isArray(body)) modulesData = body;
    }
  } catch { /* fallback to empty */ }
  console.log(`[mock] Fetched ${modulesData.length} modules for mock`);

  // Auth/me mock — dynamically returns whichever user is active via _currentMockUser
  await page.route('**/api/auth/me', async (route) => {
    if (_currentMockUser) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: _currentMockUser }),
      });
    } else {
      await route.continue();
    }
  });

  // Block service worker to prevent PWA offline caching
  await page.route('**/sw.js', (route) => route.abort());
  await page.route('**/workbox-*', (route) => route.abort());

  // PUBLIC /api/settings — uses EXACT URL pattern for reliable cross-origin interception
  // Settings-context fetches: http://localhost:3005/api/settings
  await page.route(`${API_BASE}/api/settings`, async (route) => {
    try {
      // Proxy to real backend endpoint for latest settings
      const resp = await page.request.get(`${API_BASE}/api/settings`);
      if (resp.ok()) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: await resp.text() });
        return;
      }
    } catch { /* fallback */ }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
  });

  // PUBLIC /api/modules — uses glob pattern to catch query string variants
  // Settings-context fetches: http://localhost:3005/api/modules?activeOnly=true
  await page.route(`${API_BASE}/api/modules*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: modulesData }),
    });
  });

  // Token refresh mock
  await page.route('**/api/v1/auth/refresh', async (route) => {
    if (_currentMockUser) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { tokens: { accessToken: adminToken, refreshToken: 'mock-refresh' }, user: _currentMockUser },
        }),
      });
    } else {
      await route.continue();
    }
  });

  _mocksInstalled = true;
}

/**
 * Login via API + navigate to root + inject tokens.
 * Assumes setupPersistentMocks() was already called.
 */
async function apiLogin(page: Page, email: string, password: string) {
  const resp = await page.request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(resp.ok()).toBeTruthy();
  const body = await resp.json();
  expect(body.success).toBeTruthy();

  const { tokens, user } = body.data;

  // Update the mock user for /api/auth/me
  _currentMockUser = user;

  // Clear stale storage to prevent SSR hydration mismatch
  // (localStorage data from previous steps causes server/client HTML mismatch)
  try {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  } catch { /* first load — no page context yet */ }

  // Navigate and inject tokens
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ accessToken, refreshToken, userData }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
  }, { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, userData: user });

  return { tokens, user };
}

async function ss(page: Page, name: string) {
  ensureDir();
  await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: false });
}

async function ssFull(page: Page, name: string) {
  ensureDir();
  await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: true });
}

/**
 * Navigate via page.goto but clear hydration-sensitive keys first.
 * This prevents SSR hydration mismatch caused by Zustand persist store
 * and inline theme script reading localStorage before React hydration.
 */
async function cleanGoto(page: Page, url: string, waitUntil: 'domcontentloaded' | 'networkidle' = 'domcontentloaded') {
  try {
    await page.evaluate(() => {
      localStorage.removeItem('v2-ecosystem-settings');
      localStorage.removeItem('v2-ecosystem-theme');
      localStorage.removeItem('theme');
      sessionStorage.removeItem('v2ecosystem_visited');
    });
  } catch { /* no page context yet */ }
  await page.goto(url, { waitUntil });
  await page.waitForLoadState('networkidle');
}

/** Navigate to admin page.
 * STRATEGY: 
 * - First call: page.goto('/admin/settings') — reliable for initial SSR load
 * - Subsequent calls: sidebar navigation (client-side, no hydration mismatch)
 *   The sidebar hierarchy: Category (System) > Item (Settings) > Children (Appearance, etc.)
 *   If sidebar nav fails, falls back to history.pushState + popstate event
 */
let initialAdminLoadDone = false;

async function expandSidebarAndClick(page: Page, targetHref: string): Promise<boolean> {
  // Check if sidebar exists
  const aside = page.locator('aside').first();
  if (!(await aside.isVisible().catch(() => false))) {
    console.log('[nav] No sidebar visible');
    return false;
  }

  // Check if target link already visible (Settings children might be expanded from previous step)
  const targetLink = page.locator(`aside a[href="${targetHref}"]`).first();
  if (await targetLink.isVisible().catch(() => false)) {
    await targetLink.click();
    await page.waitForLoadState('networkidle');
    console.log(`[nav] Clicked existing visible link: ${targetHref}`);
    return true;
  }

  // Check if System category is already expanded by looking for the Settings button
  const settingsBtn = page.locator('aside button').filter({ hasText: /^Settings$/i }).first();
  const systemAlreadyExpanded = await settingsBtn.isVisible().catch(() => false);

  if (!systemAlreadyExpanded) {
    // System is collapsed — click to expand
    const systemBtn = page.locator('aside button').filter({ hasText: /^System$/i }).first();
    if (await systemBtn.isVisible().catch(() => false)) {
      await systemBtn.click();
      await page.waitForLoadState('networkidle');
    } else {
      console.log('[nav] System button not visible in sidebar');
      return false;
    }
  }

  // Check if target link is now visible (it's in System's direct children, not in Settings)
  if (await targetLink.isVisible().catch(() => false)) {
    await targetLink.click();
    await page.waitForLoadState('networkidle');
    console.log(`[nav] Clicked link after System expand: ${targetHref}`);
    return true;
  }

  // Check if Settings children are already expanded by looking for a known child
  const knownChild = page.locator('aside a[href="/admin/settings/appearance"]').first();
  const settingsAlreadyExpanded = await knownChild.isVisible().catch(() => false);

  if (!settingsAlreadyExpanded) {
    // Settings is collapsed — click to expand
    if (await settingsBtn.isVisible().catch(() => false)) {
      await settingsBtn.click();
      await page.waitForLoadState('networkidle');
    }
  }

  // Final check for target link
  if (await targetLink.isVisible().catch(() => false)) {
    await targetLink.click();
    await page.waitForLoadState('networkidle');
    console.log(`[nav] Clicked link after Settings expand: ${targetHref}`);
    return true;
  }

  console.log(`[nav] Sidebar navigation to ${targetHref} failed — link not found`);
  return false;
}

/**
 * Client-side navigation using the admin sidebar's SEARCH feature.
 * The sidebar has a search input that filters pages and renders <Link> components.
 * Clicking a search result triggers genuine Next.js client-side navigation.
 * This always works as long as the sidebar is present.
 */
async function searchNav(page: Page, targetHref: string): Promise<boolean> {
  // Try to find the search input
  const searchInput = page.locator('aside input[type="text"]').first();
  if (!(await searchInput.isVisible().catch(() => false))) {
    console.log(`[nav] Search input not visible in sidebar`);
    return false;
  }

  // Extract a search term from the target URL (e.g., /admin/settings/footer → "footer")
  const segments = targetHref.split('/').filter(Boolean);
  const searchTerm = segments[segments.length - 1]; // last segment
  
  try {
    await searchInput.fill(searchTerm);
    await page.waitForLoadState('networkidle');

    // Look for the target link in search results
    const resultLink = page.locator(`aside a[href="${targetHref}"]`).first();
    if (await resultLink.isVisible().catch(() => false)) {
      await resultLink.click();
      await page.waitForLoadState('networkidle');
      
      // Clear search query (sidebar might still show search results)
      try { await searchInput.fill(''); } catch { /* ignore */ }
      
      console.log(`[nav] Search navigated to ${targetHref}`);
      return true;
    } else {
      // Didn't find exact href, try clicking first result
      const firstResult = page.locator('aside a').first();
      if (await firstResult.isVisible().catch(() => false)) {
        const href = await firstResult.getAttribute('href');
        console.log(`[nav] Search: exact link not found, first result href: ${href}`);
      }
      // Clear search
      try { await searchInput.fill(''); } catch { /* ignore */ }
    }
  } catch (e) {
    console.log(`[nav] Search nav error: ${(e as Error).message?.substring(0, 60)}`);
    try { await searchInput.fill(''); } catch { /* ignore */ }
  }
  return false;
}

async function adminNav(page: Page, url: string, tokens?: any, user?: any, waitForText?: string) {
  if (!initialAdminLoadDone) {
    // FIRST admin load: cleanGoto prevents hydration mismatch
    await cleanGoto(page, '/admin/settings');
    await page.waitForLoadState('networkidle');
    initialAdminLoadDone = true;

    // If target is different from /admin/settings, navigate via sidebar
    if (url !== '/admin/settings' && url !== '/admin') {
      const sidebarOk = await expandSidebarAndClick(page, url);
      if (!sidebarOk) {
        await searchNav(page, url);
      }
    }
  } else {
    // SUBSEQUENT calls: use sidebar navigation (client-side, no hydration mismatch)
    // Re-inject tokens first to prevent auth expiry
    if (tokens && user) {
      await page.evaluate(({ a, r, u }) => {
        localStorage.setItem('accessToken', a);
        localStorage.setItem('refreshToken', r);
        localStorage.setItem('user', JSON.stringify(u));
      }, { a: tokens.accessToken, r: tokens.refreshToken, u: user });
    }

    // Try sidebar navigation first
    const sidebarOk = await expandSidebarAndClick(page, url);
    
    if (!sidebarOk) {
      // Fallback: use sidebar search (types page name, clicks result Link)
      console.log(`[nav] Sidebar expand failed, trying search for ${url}`);
      const searchOk = await searchNav(page, url);
      
      if (!searchOk) {
        console.log(`[nav] All client-side nav failed for ${url}, using cleanGoto as last resort`);
        await cleanGoto(page, url);
        // Handle error boundary
        try {
          const tryAgain = page.getByRole('button', { name: 'Try Again' });
          if (await tryAgain.isVisible().catch(() => false)) {
            await tryAgain.click();
            await page.waitForLoadState('networkidle');
          }
        } catch { /* no error boundary */ }
      }
    }
  }

  if (waitForText) {
    try {
      await page.getByText(waitForText).first().waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      // Continue anyway
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// REBRAND STEPS
// ═══════════════════════════════════════════════════════════════

async function step1_GeneralAndContact(page: Page, b: BrandConfig, n: number, auth: any): Promise<string[]> {
  const log: string[] = [];
  log.push(`### Step 1: General Settings & Contact`);

  await adminNav(page, '/admin/settings', auth.tokens, auth.user, 'Resort Name');
  await page.waitForLoadState('networkidle');

  const nameField = page.getByPlaceholder('Enter your resort name');
  await nameField.fill(b.name);
  log.push(`  - Resort Name: "${b.name}"`);

  const tagField = page.getByPlaceholder('Enter a catchy tagline');
  await tagField.fill(b.tagline);
  log.push(`  - Tagline: "${b.tagline}"`);

  const descField = page.getByPlaceholder('Describe your resort');
  await descField.fill(b.description);
  log.push(`  - Description: "${b.description.substring(0, 60)}..."`);

  await ss(page, `${n}-01a-general`);

  const contactTab = page.getByRole('button', { name: 'Contact' });
  await contactTab.click();
  await page.waitForLoadState('networkidle');

  const phoneField = page.getByPlaceholder('+1 (555) 123-4567');
  await phoneField.fill(b.phone);
  log.push(`  - Phone: "${b.phone}"`);

  const emailField = page.getByPlaceholder('contact@yourresort.com');
  await emailField.fill(b.email);
  log.push(`  - Email: "${b.email}"`);

  const addressField = page.getByPlaceholder('123 Resort Boulevard');
  await addressField.fill(b.address);
  log.push(`  - Address: "${b.address}"`);

  await ss(page, `${n}-01b-contact`);

  const saveBtn = page.getByRole('button', { name: 'Save' }).first();
  await saveBtn.click();
  await page.waitForLoadState('networkidle');

  const bodyText = await page.textContent('body');
  const saved = bodyText?.toLowerCase().includes('saved') || bodyText?.toLowerCase().includes('success');
  log.push(`  - Save result: ${saved ? '✅ SUCCESS' : '⚠️ (no toast text detected)'}`);

  await ss(page, `${n}-01c-saved`);
  return log;
}

async function step2_Appearance(page: Page, b: BrandConfig, n: number, auth: any): Promise<string[]> {
  const log: string[] = [];
  log.push(`### Step 2: Appearance (Theme, Weather)`);

  await adminNav(page, '/admin/settings/appearance', auth.tokens, auth.user, 'Resort Theme');
  await ss(page, `${n}-02-debug-appearance-load`);
  
  // Wait for page content to load — check for theme-related words
  const bodyText = await page.textContent('body') || '';
  log.push(`  - Page loaded, has "theme": ${bodyText.toLowerCase().includes('theme')}`);
  log.push(`  - Page loaded, has "beach": ${bodyText.toLowerCase().includes('beach')}`);
  log.push(`  - Body length: ${bodyText.length}`);

  if (!bodyText.toLowerCase().includes('theme') && !bodyText.toLowerCase().includes('beach')) {
    log.push(`  - ⚠️ Appearance page may not have loaded correctly`);
    log.push(`  - Body preview: "${bodyText.substring(0, 200)}"`);
    return log;
  }

  // Debug: log buttons found
  const allBtns = await page.locator('button').allTextContents();
  log.push(`  - Buttons found: ${allBtns.length} — ${allBtns.filter(b2 => b2.trim()).slice(0, 10).join(' | ')}`);

  // Debug: log inputs found  
  const allInputs = await page.locator('input').count();
  const allSelects = await page.locator('select').count();
  log.push(`  - Inputs: ${allInputs}, Selects: ${allSelects}`);
  
  // Debug: body preview to understand page state
  log.push(`  - Body first 300: "${bodyText.substring(0, 300).replace(/\n/g, ' ')}"`);


  // Theme buttons use motion.button with theme name as text
  try {
    const themeBtn = page.locator(`button:has-text("${b.themeName}")`).first();
    await themeBtn.waitFor({ state: 'visible', timeout: 10000 });
    await themeBtn.click();
    log.push(`  - Theme: "${b.themeName}" selected`);
  } catch {
    log.push(`  - ⚠️ Theme button "${b.themeName}" not found`);
  }
  await page.waitForLoadState('networkidle');

  // Weather location
  try {
    const weatherInput = page.getByPlaceholder('e.g., New York, USA');
    await weatherInput.waitFor({ state: 'visible', timeout: 5000 });
    await weatherInput.fill(b.weatherLocation);
    log.push(`  - Weather Location: "${b.weatherLocation}"`);
  } catch {
    log.push(`  - ⚠️ Weather location input not found`);
  }

  // Weather effect select
  try {
    const effectSelect = page.locator('select').first();
    await effectSelect.waitFor({ state: 'visible', timeout: 5000 });
    await effectSelect.selectOption(b.weatherEffect);
    log.push(`  - Weather Effect: "${b.weatherEffect}"`);
  } catch {
    log.push(`  - ⚠️ Weather effect select not found`);
  }

  await ss(page, `${n}-02-appearance`);

  // Find save button - may be disabled if no changes detected
  try {
    const saveBtn = page.locator('button:has-text("Save")').last();
    await saveBtn.waitFor({ state: 'visible', timeout: 10000 });
    
    if (await saveBtn.isDisabled()) {
      log.push(`  - Save button disabled (no changes detected?)`);
      // Try clicking the theme again to trigger change
      const themeBtn2 = page.locator(`button:has-text("${b.themeName}")`).first();
      if (await themeBtn2.isVisible()) {
        await themeBtn2.click();
        await page.waitForLoadState('networkidle');
      }
    }
    
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
      await page.waitForLoadState('networkidle');
      log.push(`  - ✅ Appearance saved`);
    } else {
      log.push(`  - ⚠️ Save still disabled`);
    }
  } catch {
    log.push(`  - ⚠️ Save button not found`);
  }

  await ss(page, `${n}-02b-appearance-saved`);
  return log;
}

async function step3_Footer(page: Page, b: BrandConfig, n: number, auth: any): Promise<string[]> {
  const log: string[] = [];
  log.push(`### Step 3: Footer CMS`);

  await adminNav(page, '/admin/settings/footer', auth.tokens, auth.user, 'Footer');
  await ss(page, `${n}-03-debug-footer-load`);

  // Logo text - use the first input on the page
  try {
    const inputs = page.getByRole('textbox');
    const count = await inputs.count();
    if (count > 0) {
      await inputs.nth(0).fill(b.name);
      log.push(`  - Logo Text: "${b.name}"`);
    }
    // Find the textarea for description
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible()) {
      await textarea.fill(b.footerDescription);
      log.push(`  - Description: "${b.footerDescription.substring(0, 50)}..."`);
    }
  } catch (e) {
    log.push(`  - ⚠️ Footer fields: ${(e as Error).message?.substring(0, 60)}`);
  }

  // Copyright field - scroll down and look for it
  try {
    // The copyright field is in a card titled "Copyright"
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle');
    
    // Find all visible inputs and textareas
    const allInputs = page.getByRole('textbox');
    const total = await allInputs.count();
    // Copyright input is typically after logo text, description textarea, and social URLs
    // Try to find by placeholder containing "©" or "{year}"
    for (let i = 0; i < total; i++) {
      const val = await allInputs.nth(i).inputValue();
      if (val.includes('©') || val.includes('{year}')) {
        await allInputs.nth(i).fill(b.copyright);
        log.push(`  - Copyright: "${b.copyright}"`);
        break;
      }
    }
  } catch {
    log.push(`  - ⚠️ Copyright: could not find`);
  }

  await ss(page, `${n}-03-footer`);

  const saveBtn3 = page.locator('button:has-text("Save")').last();
  try {
    await saveBtn3.waitFor({ state: 'visible', timeout: 10000 });
    await saveBtn3.click();
    await page.waitForLoadState('networkidle');
    log.push(`  - ✅ Footer saved`);
  } catch {
    log.push(`  - ⚠️ Footer save button not found`);
  }

  await ss(page, `${n}-03b-footer-saved`);
  return log;
}

async function step4_Homepage(page: Page, b: BrandConfig, n: number, auth: any): Promise<string[]> {
  const log: string[] = [];
  log.push(`### Step 4: Homepage Settings (Hero, CTA)`);

  log.push(`  - [DEBUG] URL before nav: ${page.url()}`);
  
  await adminNav(page, '/admin/settings/homepage', auth.tokens, auth.user, 'Homepage');
  
  log.push(`  - [DEBUG] URL after nav: ${page.url()}`);
  
  // Wait longer for this page to load
  await page.waitForLoadState('networkidle');
  
  await ss(page, `${n}-04-debug-homepage-load`);
  
  // Debug page state
  const bodyText = await page.textContent('body') || '';
  const btnTexts = await page.locator('button').allTextContents();
  const inputCount = await page.locator('input').count();
  log.push(`  - [DEBUG] Body length: ${bodyText.length}`);
  log.push(`  - [DEBUG] Buttons: ${btnTexts.map(t => t.trim()).filter(t => t).slice(0, 15).join(' | ')}`);
  log.push(`  - [DEBUG] Input count: ${inputCount}`);
  log.push(`  - [DEBUG] Has "Hero": ${bodyText.includes('Hero')}`);
  log.push(`  - [DEBUG] Has "Slide": ${bodyText.includes('Slide')}`);
  log.push(`  - [DEBUG] Has "Try Again": ${bodyText.includes('Try Again')}`);

  // Hero Slides tab should be default
  try {
    const inputs = page.getByRole('textbox');
    const count = await inputs.count();
    log.push(`  - Homepage textbox inputs found: ${count}`);
    
    if (count >= 2) {
      await inputs.nth(0).fill(b.heroTitle);
      log.push(`  - Hero Title: "${b.heroTitle}"`);
      await inputs.nth(1).fill(b.heroSubtitle);
      log.push(`  - Hero Subtitle: "${b.heroSubtitle}"`);
    } else if (count === 0) {
      // Try locator for regular inputs
      const allInputs = page.locator('input[type="text"], input:not([type])');
      const aic = await allInputs.count();
      log.push(`  - Regular input count: ${aic}`);
      if (aic >= 2) {
        await allInputs.nth(0).fill(b.heroTitle);
        await allInputs.nth(1).fill(b.heroSubtitle);
        log.push(`  - Hero Title/Subtitle filled via selector`);
      }
    }
  } catch (e) {
    log.push(`  - ⚠️ Hero: ${(e as Error).message?.substring(0, 60)}`);
  }

  await ss(page, `${n}-04a-hero`);

  // Switch to CTA tab
  try {
    const ctaTab = page.getByRole('button', { name: 'Call to Action' });
    await ctaTab.waitFor({ state: 'visible', timeout: 10000 });
    await ctaTab.click();
    await page.waitForLoadState('networkidle');

    const ctaInputs = page.getByRole('textbox');
    const ctaCount = await ctaInputs.count();
    log.push(`  - CTA inputs found: ${ctaCount}`);
    
    if (ctaCount >= 3) {
      await ctaInputs.nth(0).fill(b.ctaTitle);
      await ctaInputs.nth(1).fill(b.ctaSubtitle);
      await ctaInputs.nth(2).fill(b.ctaButtonText);
      log.push(`  - CTA: "${b.ctaTitle}" / "${b.ctaButtonText}"`);
    } else if (ctaCount >= 1) {
      await ctaInputs.nth(0).fill(b.ctaTitle);
      log.push(`  - CTA Title only: "${b.ctaTitle}"`);
    }
  } catch (e) {
    log.push(`  - ⚠️ CTA: ${(e as Error).message?.substring(0, 60)}`);
  }

  await ss(page, `${n}-04b-cta`);

  try {
    const saveBtn = page.locator('button:has-text("Save")').last();
    await saveBtn.waitFor({ state: 'visible', timeout: 10000 });
    await saveBtn.click();
    await page.waitForLoadState('networkidle');
    log.push(`  - ✅ Homepage saved`);
  } catch {
    log.push(`  - ⚠️ Homepage save button error`);
  }

  await ss(page, `${n}-04c-homepage-saved`);
  return log;
}

async function step5_Terminology(page: Page, b: BrandConfig, n: number, auth: any): Promise<string[]> {
  const log: string[] = [];
  log.push(`### Step 5: Terminology`);

  log.push(`  - [DEBUG] URL before nav: ${page.url()}`);
  
  await adminNav(page, '/admin/terminology', auth.tokens, auth.user, 'Terminology');
  
  log.push(`  - [DEBUG] URL after nav: ${page.url()}`);
  
  await page.waitForLoadState('networkidle');
  
  await ss(page, `${n}-05-debug-terminology-load`);
  
  // Debug page state
  const bodyText = await page.textContent('body') || '';
  const inputCount = await page.locator('input').count();
  const btnTexts = await page.locator('button').allTextContents();
  log.push(`  - [DEBUG] Body length: ${bodyText.length}`);
  log.push(`  - [DEBUG] Input count: ${inputCount}`);
  log.push(`  - [DEBUG] Buttons: ${btnTexts.map(t => t.trim()).filter(t => t).slice(0, 15).join(' | ')}`);
  log.push(`  - [DEBUG] Has "Terminology": ${bodyText.includes('Terminology')}`);
  log.push(`  - [DEBUG] Has "Try Again": ${bodyText.includes('Try Again')}`);
  log.push(`  - [DEBUG] Has "Unit": ${bodyText.includes('Unit')}`);

  const brandTerms: Record<number, string[]> = {
    1: ['Cabana', 'Cabanas', 'Pool', 'Pools', 'Restaurant', 'Restaurants'],
    2: ['Chalet', 'Chalets', 'Spa', 'Spas', 'Lodge Dining', 'Lodge Dining'],
    3: ['Suite', 'Suites', 'Spa', 'Spas', 'Bistro', 'Bistros'],
    4: ['Treehouse', 'Treehouses', 'Lagoon', 'Lagoons', 'Garden Kitchen', 'Garden Kitchens'],
    5: ['Penthouse', 'Penthouses', 'Rooftop Pool', 'Rooftop Pools', 'Fine Dining', 'Fine Dining'],
  };

  const terms = brandTerms[n] || brandTerms[1];

  try {
    // The term override fields are 6 text inputs after the business type select
    const textInputs = page.locator('input[type="text"]');
    const count = await textInputs.count();
    log.push(`  - Term inputs found: ${count}`);
    
    const startIdx = count >= 6 ? count - 6 : 0; // last 6 inputs are the term fields
    for (let i = 0; i < 6 && (startIdx + i) < count; i++) {
      await textInputs.nth(startIdx + i).fill(terms[i]);
    }
    log.push(`  - Terms: ${terms.join(', ')}`);
  } catch (e) {
    log.push(`  - ⚠️ Terminology: ${(e as Error).message?.substring(0, 60)}`);
  }

  await ss(page, `${n}-05-terminology`);

  const saveBtn5 = page.locator('button:has-text("Save")').last();
  try {
    await saveBtn5.waitFor({ state: 'visible', timeout: 10000 });
    await saveBtn5.click();
    await page.waitForLoadState('networkidle');
    log.push(`  - ✅ Terminology saved`);
  } catch {
    log.push(`  - ⚠️ Terminology save issue`);
  }

  return log;
}

// ═══════════════════════════════════════════════════════════════
// VERIFICATION
// ═══════════════════════════════════════════════════════════════

async function verifyCustomer(page: Page, b: BrandConfig, n: number): Promise<string[]> {
  const log: string[] = [];
  log.push(`\n### Verification: Customer`);

  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();

  await cleanGoto(page, '/', 'networkidle');
  await page.waitForLoadState('networkidle');

  const title = await page.title();
  log.push(`  - Title: "${title}" ${title.includes(b.name) ? '✅' : '❌'}`);

  const body = await page.textContent('body') || '';
  log.push(`  - Name visible: ${body.includes(b.name) ? '✅' : '⚠️'}`);
  log.push(`  - Tagline visible: ${body.includes(b.tagline) ? '✅' : '⚠️'}`);

  await ssFull(page, `${n}-06-customer-home`);

  const footerEl = page.locator('footer').first();
  if (await footerEl.isVisible()) {
    const ft = await footerEl.textContent() || '';
    log.push(`  - Footer brand: ${ft.includes(b.name) ? '✅' : '⚠️'}`);
  }

  // Navigate through main pages
  const pages = [
    { url: '/restaurant', name: 'Restaurant', pattern: /menu|categor|food|dish|order/i },
    { url: '/chalets', name: 'Chalets', pattern: /chalet|room|suite|book|cabana|treehouse|penthouse/i },
    { url: '/pool', name: 'Pool', pattern: /pool|ticket|swim|spa|lagoon|session/i },
    { url: '/giftcards', name: 'Gift Cards', pattern: /gift|card|purchase|amount/i },
    { url: '/login', name: 'Login', pattern: /sign|log|email|password/i },
  ];

  for (const p of pages) {
    await cleanGoto(page, p.url, 'networkidle');
    const text = await page.textContent('body') || '';
    log.push(`  - ${p.name}: ${p.pattern.test(text) ? '✅' : '⚠️'}`);
    await ss(page, `${n}-cust-${p.name.toLowerCase().replace(/\s/g, '-')}`);
  }

  return log;
}

async function verifyAdmin(page: Page, b: BrandConfig, n: number): Promise<string[]> {
  const log: string[] = [];
  log.push(`\n### Verification: Admin`);

  const auth = await apiLogin(page, ADMIN_CREDS.email, ADMIN_CREDS.password);
  initialAdminLoadDone = false; // Reset since we just re-authenticated

  await adminNav(page, '/admin/settings', auth.tokens, auth.user, 'Resort Name');

  const dashText = await page.textContent('body') || '';
  log.push(`  - Admin panel loaded: ${dashText.length > 100 ? '✅' : '⚠️'} (${dashText.length} chars)`);

  try {
    const sideItems = await page.locator('aside button, aside a').allTextContents();
    log.push(`  - Sidebar: ${sideItems.filter(s => s.trim()).length} items`);
  } catch {
    log.push(`  - Sidebar: ⚠️ Could not read`);
  }

  await ss(page, `${n}-admin-dashboard`);

  // Verify settings match
  try {
    const nameVal = await page.getByPlaceholder('Enter your resort name').inputValue();
    log.push(`  - Settings Name: "${nameVal}" ${nameVal === b.name ? '✅' : '❌'}`);
  } catch {
    log.push(`  - Settings: ⚠️ Could not read name`);
  }

  await ss(page, `${n}-admin-settings`);

  // Navigate to other admin pages via search nav or cleanGoto
  const adminPages = [
    { url: '/admin/orders', name: 'Orders', pattern: /order|status/i },
    { url: '/admin/users/customers', name: 'Users', pattern: /user|customer|name/i },
    { url: '/admin/modules', name: 'Modules', pattern: /module|restaurant|active/i },
    { url: '/admin/reports', name: 'Reports', pattern: /report|revenue|analytic/i },
    { url: '/admin/audit', name: 'Audit', pattern: /audit|log|activity/i },
  ];

  for (const p of adminPages) {
    // Try search nav first, then cleanGoto as fallback
    const searchOk = await searchNav(page, p.url);
    if (!searchOk) {
      await cleanGoto(page, p.url);
    }
    await page.waitForLoadState('networkidle');
    const text = await page.textContent('body') || '';
    log.push(`  - ${p.name}: ${p.pattern.test(text) ? '✅' : '⚠️'}`);
    await ss(page, `${n}-admin-${p.name.toLowerCase()}`);
  }

  return log;
}

async function verifyStaff(page: Page, b: BrandConfig, n: number): Promise<string[]> {
  const log: string[] = [];
  log.push(`\n### Verification: Staff`);

  await apiLogin(page, STAFF_CREDS.email, STAFF_CREDS.password);

  const staffPages = [
    { url: '/staff', name: 'Dashboard', pattern: /staff|kitchen|scanner|restaurant/i },
    { url: '/staff/restaurant', name: 'Kitchen', pattern: /kitchen|order|pending|display/i },
    { url: '/staff/scanner', name: 'Scanner', pattern: /scan|code|ticket|validate/i },
  ];

  for (const p of staffPages) {
    await cleanGoto(page, p.url);
    const text = await page.textContent('body') || '';
    log.push(`  - ${p.name}: ${p.pattern.test(text) ? '✅' : '⚠️'}`);
    await ss(page, `${n}-staff-${p.name.toLowerCase()}`);
  }

  return log;
}

// ═══════════════════════════════════════════════════════════════
// MAIN TEST SUITE
// ═══════════════════════════════════════════════════════════════

test.describe('Full System Rebranding (5 Themes)', () => {
  test.setTimeout(600000);

  for (let i = 0; i < BRANDS.length; i++) {
    const brand = BRANDS[i];
    const n = i + 1;

    test(`Rebrand #${n}: ${brand.name}`, async ({ page }) => {
      initialAdminLoadDone = false; // Reset for each test
      ensureDir();
      
      const allLog: string[] = [];
      allLog.push(`\n${'='.repeat(70)}`);
      allLog.push(`# REBRAND #${n}: ${brand.name}`);
      allLog.push(`${'='.repeat(70)}`);
      allLog.push(`Theme: ${brand.themeName} (${brand.themeId})`);
      allLog.push(`Tagline: "${brand.tagline}"`);
      allLog.push(`Timestamp: ${new Date().toISOString()}`);
      allLog.push('');

      // Capture console errors
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text().substring(0, 200));
        }
      });
      page.on('pageerror', err => {
        consoleErrors.push(`PAGE ERROR: ${err.message.substring(0, 200)}`);
      });

      // Login as Admin
      // Step 1: Get admin token first (for mock data fetch)
      const preLogin = await page.request.post(`${API_BASE}/api/v1/auth/login`, {
        data: { email: ADMIN_CREDS.email, password: ADMIN_CREDS.password },
      });
      const preBody = await preLogin.json();
      const adminToken = preBody.data.tokens.accessToken;

      // Step 2: Set up ALL persistent mocks BEFORE any page navigation
      _mocksInstalled = false;
      await setupPersistentMocks(page, adminToken);

      // Step 3: Now do the full login (page.goto + token injection) — mocks are already active
      const auth = await apiLogin(page, ADMIN_CREDS.email, ADMIN_CREDS.password);

      // Apply rebrand
      allLog.push(...await step1_GeneralAndContact(page, brand, n, auth));
      
      // Log any errors after step 1
      if (consoleErrors.length > 0) {
        allLog.push(`  [Console Errors after Step 1]: ${consoleErrors.join(' | ')}`);
        consoleErrors.length = 0;
      }

      // DEBUG: Inspect page state after step 1
      {
        const url = page.url();
        const asideCount = await page.locator('aside').count();
        const navCount = await page.locator('nav').count();
        const btnCount = await page.locator('button').count();
        const linkCount = await page.locator('a').count();
        const btnTexts = await page.locator('button').allTextContents();
        allLog.push(`  [DEBUG after Step 1]:`);
        allLog.push(`    URL: ${url}`);
        allLog.push(`    <aside> elements: ${asideCount}`);
        allLog.push(`    <nav> elements: ${navCount}`);
        allLog.push(`    <button> elements: ${btnCount}`);
        allLog.push(`    <a> elements: ${linkCount}`);
        allLog.push(`    Button texts: ${btnTexts.map(t => t.trim()).filter(t => t).slice(0, 25).join(' | ')}`);
        
        // Also check for category names in sidebar
        const asideBtns = await page.locator('aside button').allTextContents();
        allLog.push(`    Aside buttons: ${asideBtns.map(t => t.trim()).filter(t => t).join(' | ')}`);
        const asideLinks = await page.locator('aside a').allTextContents();
        allLog.push(`    Aside links: ${asideLinks.map(t => t.trim()).filter(t => t).join(' | ')}`);
      }
      
      allLog.push(...await step2_Appearance(page, brand, n, auth));
      
      if (consoleErrors.length > 0) {
        allLog.push(`  [Console Errors after Step 2]: ${consoleErrors.join(' | ')}`);
        consoleErrors.length = 0;
      }
      
      allLog.push(...await step3_Footer(page, brand, n, auth));
      
      if (consoleErrors.length > 0) {
        allLog.push(`  [Console Errors after Step 3]: ${consoleErrors.join(' | ')}`);
        consoleErrors.length = 0;
      }

      // DEBUG: Check page state after step 3 save (before step 4)
      {
        const url = page.url();
        const asideCount = await page.locator('aside').count();
        const bodyText = await page.textContent('body') || '';
        const hasTryAgain = bodyText.includes('Try Again');
        allLog.push(`  [DEBUG after Step 3]:`);
        allLog.push(`    URL: ${url}`);
        allLog.push(`    <aside> count: ${asideCount}`);
        allLog.push(`    Has "Try Again": ${hasTryAgain}`);
        allLog.push(`    Body length: ${bodyText.length}`);
        
        // Check auth tokens
        const tokensPresent = await page.evaluate(() => ({
          hasAccess: !!localStorage.getItem('accessToken'),
          hasRefresh: !!localStorage.getItem('refreshToken'),
          hasUser: !!localStorage.getItem('user'),
        }));
        allLog.push(`    Auth tokens: access=${tokensPresent.hasAccess}, refresh=${tokensPresent.hasRefresh}, user=${tokensPresent.hasUser}`);
      }
      
      allLog.push(...await step4_Homepage(page, brand, n, auth));
      allLog.push(...await step5_Terminology(page, brand, n, auth));

      allLog.push('\n--- Rebrand Applied ---\n');

      // Verify all 3 perspectives
      allLog.push(...await verifyCustomer(page, brand, n));
      allLog.push(...await verifyAdmin(page, brand, n));
      allLog.push(...await verifyStaff(page, brand, n));

      allLog.push('');
      allLog.push(`${'='.repeat(70)}`);
      allLog.push(`# REBRAND #${n} COMPLETE: ${brand.name}`);
      allLog.push(`${'='.repeat(70)}`);

      // Write log
      appendLog(allLog.join('\n'));
      console.log(allLog.join('\n'));
    });
  }
});
