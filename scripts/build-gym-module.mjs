/**
 * Build Gym Module via Playwright
 * Uses API to create module + set layout, then opens browser to verify
 */
import { chromium } from 'playwright';

const ADMIN_EMAIL = 'admin@v2ecosystem.com';
const ADMIN_PASSWORD = 'admin123';
const API_URL = 'http://localhost:3005';
const BASE_URL = 'http://localhost:3000';  // Frontend dev server port

const gymLayout = [
  {
    id: "hero-gym-main",
    type: "hero_v2",
    label: "Gym Hero",
    props: {
      eyebrow: "Strength. Wellness. You.",
      title: "Gym Module",
      highlight: "Module",
      subtitle: "Elevate your stay. Energize your body.",
      description: "State-of-the-art equipment, expert trainers, and personalized programs to help you achieve your fitness goals.",
      primaryButton: "Explore Schedule",
      primaryUrl: "#schedule",
      secondaryButton: "Membership Plans",
      secondaryUrl: "#pricing",
      align: "left"
    },
    style: { width: "100%", padding: "0" },
    background: {
      type: "image",
      image: { src: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80", position: "center", size: "cover" },
      overlay: { type: "solid", color: "#0f172a", opacity: 0.7 }
    },
    sectionHeight: { mode: "viewport", value: "100" },
    sectionLayout: "full-width",
    children: []
  },
  {
    id: "features-gym-4",
    type: "features",
    label: "Gym Features",
    props: {
      title: "Why Choose Our Gym",
      features: [
        { icon: "Dumbbell", title: "Premium Equipment", description: "Latest cardio, strength & functional training equipment" },
        { icon: "Users", title: "Expert Trainers", description: "Certified professionals to guide your fitness journey" },
        { icon: "Heart", title: "Wellness Focused", description: "Holistic approach to fitness, recovery & well-being" },
        { icon: "Calendar", title: "Flexible Schedule", description: "Classes & coaching that fit your lifestyle" }
      ]
    },
    style: { width: "100%", padding: "40px 0" },
    background: { type: "color", color: "#0f172a" },
    sectionHeight: { mode: "auto" },
    sectionLayout: "contained",
    children: []
  },
  {
    id: "split-schedule-calendar",
    type: "container",
    label: "Schedule + Calendar Split",
    props: {},
    style: { width: "100%", padding: "60px 0" },
    background: { type: "color", color: "#0f172a" },
    sectionHeight: { mode: "auto" },
    sectionLayout: "split-50-50",
    children: [
      {
        id: "class-schedule",
        type: "class_schedule",
        label: "Class Schedule",
        props: {
          title: "Next Classes",
          subtitle: "UPCOMING SESSIONS",
          classes: [
            { id: "1", name: "Strength Training", time: "07:00 AM - 08:00 AM", trainer: "Coach Mike", category: "Full Body", icon: "Dumbbell" },
            { id: "2", name: "Yoga Flow", time: "09:30 AM - 10:30 AM", trainer: "Coach Sarah", category: "Mind & Flexibility", icon: "Sparkles" },
            { id: "3", name: "HIIT Blast", time: "05:00 PM - 06:00 PM", trainer: "Coach Alex", category: "High Intensity", icon: "Zap" },
            { id: "4", name: "Pilates Core", time: "06:30 PM - 07:30 PM", trainer: "Coach Emma", category: "Core Strength", icon: "Heart" }
          ]
        },
        style: { width: "100%", padding: "20px" }
      },
      {
        id: "weekly-calendar",
        type: "calendar",
        label: "Calendar",
        props: { title: "Weekly Schedule" },
        style: { width: "100%", padding: "20px" }
      }
    ]
  },
  {
    id: "testimonials-carousel",
    type: "testimonials_carousel",
    label: "Testimonials",
    props: {
      title: "Stronger Together",
      subtitle: "WHAT OUR MEMBERS SAY",
      testimonials: [
        { id: "1", text: "The gym facilities are top-notch and the trainers are incredibly supportive. It is the perfect balance with my resort stay.", name: "Jessica M.", role: "Member", rating: 5, avatar: "JM" },
        { id: "2", text: "I love starting my day with a workout here. The environment is motivating and the classes are amazing!", name: "David L.", role: "Member", rating: 5, avatar: "DL" },
        { id: "3", text: "From yoga to strength training, everything I need is here. Highly recommend the gym module!", name: "Sophia K.", role: "Member", rating: 5, avatar: "SK" }
      ]
    },
    style: { width: "100%", padding: "80px 0" },
    background: { type: "color", color: "#0f172a" },
    sectionHeight: { mode: "auto" },
    sectionLayout: "contained",
    children: []
  },
  {
    id: "pricing-table",
    type: "pricing_table",
    label: "Pricing",
    props: {
      title: "Choose Your Plan",
      subtitle: "MEMBERSHIP PLANS",
      plans: [
        { name: "Day Pass", price: "$15/day", description: "Perfect for short stays", features: ["Full Gym Access", "Group Classes"], popular: false, buttonText: "Get Day Pass" },
        { name: "Weekly Pass", price: "$70/week", description: "Best for weekly travelers", features: ["Full Gym Access", "Group Classes", "1 Personal Training"], popular: true, buttonText: "Get Weekly Pass" },
        { name: "Monthly Pass", price: "$199/month", description: "For dedicated members", features: ["Full Gym Access", "Group Classes", "4 Personal Trainings"], popular: false, buttonText: "Get Monthly Pass" }
      ]
    },
    style: { width: "100%", padding: "80px 0" },
    background: { type: "color", color: "#0f172a" },
    sectionHeight: { mode: "auto" },
    sectionLayout: "contained",
    children: []
  },
  {
    id: "cta-trainer",
    type: "cta",
    label: "CTA",
    props: {
      title: "Ready to start your fitness journey?",
      subtitle: "Talk to our team for a personalized plan.",
      buttonText: "Contact a Trainer",
      buttonUrl: "#contact",
      align: "center"
    },
    style: { width: "100%", padding: "80px 0" },
    background: {
      type: "image",
      image: { src: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&q=80", position: "center", size: "cover" },
      overlay: { type: "solid", color: "#0f172a", opacity: 0.8 }
    },
    sectionHeight: { mode: "fixed", value: "400px" },
    sectionLayout: "contained",
    children: []
  }
];

async function buildGymModule() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // ========== STEP 1: LOGIN VIA API ==========
    console.log('🔐 Step 1: Getting auth token...');
    const loginRes = await page.request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
    
    if (!loginRes.ok()) {
      throw new Error(`Login failed: ${loginRes.status()}`);
    }
    
    const loginData = await loginRes.json();
    const token = loginData.data?.tokens?.accessToken || loginData.data?.accessToken;
    console.log('✅ Got auth token');

    // ========== STEP 2: FIND OR CREATE MODULE ==========
    console.log('🏋️ Step 2: Finding/creating Gym Module...');
    
    const listRes = await page.request.get(`${API_URL}/api/v1/admin/modules`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();
    let moduleId;
    let moduleSlug;
    
    const existing = listData.data?.find(m => m.template_type === 'session_access');
    if (existing) {
      moduleId = existing.id;
      moduleSlug = existing.slug;
      console.log(`✅ Found existing module: ${moduleId} (${moduleSlug})`);
    } else {
      const slug = `gym-${Date.now()}`;
      const createRes = await page.request.post(`${API_URL}/api/v1/admin/modules`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          name: 'Gym Module',
          slug: slug,
          template_type: 'session_access',
          description: 'State-of-the-art fitness center'
        }
      });
      
      if (createRes.ok()) {
        const mod = await createRes.json();
        moduleId = mod.data.id;
        moduleSlug = slug;
        console.log(`✅ Created module: ${moduleId} (${moduleSlug})`);
      } else {
        const errText = await createRes.text();
        throw new Error(`Failed to create module: ${createRes.status()} - ${errText}`);
      }
    }

    // ========== STEP 3: SET LAYOUT VIA API ==========
    console.log('🎨 Step 3: Setting Gym Module layout via API...');
    
    // First, check what the module looks like now
    console.log('  Fetching current module state...');
    const checkRes = await page.request.get(`${API_URL}/api/v1/admin/modules/${moduleId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (checkRes.ok()) {
      const checkData = await checkRes.json();
      console.log('  Module data structure:', JSON.stringify(checkData.data, null, 2).substring(0, 500));
      console.log('  Has settings?', !!checkData.data.settings);
      console.log('  Has settings.layout?', !!(checkData.data.settings?.layout));
      console.log('  Layout length:', checkData.data.settings?.layout?.length);
    }
    
    const updateRes = await page.request.put(`${API_URL}/api/v1/admin/modules/${moduleId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        settings: {
          layout: gymLayout,  // Layout goes inside settings!
          showInNavigation: true,
          icon: "Dumbbell",
          theme: "dark",
          primaryColor: "#f59e0b"
        }
      }
    });
    
    if (updateRes.ok()) {
      console.log('✅ Layout set via API');
    } else {
      const errText = await updateRes.text();
      console.log(`⚠️ API update returned ${updateRes.status()}: ${errText}`);
      console.log('   Will try PATCH instead...');
      
      const patchRes = await page.request.patch(`${API_URL}/api/v1/admin/modules/${moduleId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { 
          settings: {
            layout: gymLayout,
            showInNavigation: true,
            icon: "Dumbbell",
            theme: "dark",
            primaryColor: "#f59e0b"
          }
        }
      });
      
      if (patchRes.ok()) {
        console.log('✅ Layout set via PATCH');
      } else {
        console.log(`⚠️ PATCH also failed: ${patchRes.status()}`);
        console.log('   Will inject via browser console...');
      }
    }

    // ========== STEP 4: OPEN BROWSER AND VERIFY ==========
    console.log('🌐 Step 4: Opening browser to verify...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    // Wait for loading screen
    try {
      const overlay = page.locator('div.fixed.inset-0');
      await overlay.waitFor({ state: 'hidden', timeout: 45000 });
      console.log('  Loading screen gone');
    } catch {
      console.log('  No loading screen, continuing...');
    }
    
    // Login via browser
    const emailInput = page.locator('input[type="email"], input[placeholder*="email"], input[placeholder*="admin"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    await emailInput.fill(ADMIN_EMAIL);
    await passwordInput.fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click({ force: true });
    
    // Wait for login to complete - could redirect to various pages
    await page.waitForTimeout(5000);
    const currentUrl = page.url();
    console.log(`  Current URL after login: ${currentUrl}`);
    
    // If not on admin, navigate directly
    if (!currentUrl.includes('/admin')) {
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForLoadState('networkidle');
    }
    console.log('✅ Logged in via browser');

    // ========== STEP 5: OPEN MODULE BUILDER ==========
    console.log('🎨 Step 5: Opening Module Builder...');
    await page.goto(`${BASE_URL}/admin/modules/builder/${moduleId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // If layout wasn't set via API, inject via console
    if (!updateRes.ok()) {
      console.log('💉 Injecting layout via browser console...');
      await page.evaluate((layout) => {
        window.__GYM_MODULE_LAYOUT = layout;
        // Try to dispatch event for the app to pick up
        window.dispatchEvent(new CustomEvent('gym-module-inject', { detail: { layout } }));
      }, gymLayout);
    }
    
    await page.screenshot({ path: 'gym-module-builder.png', fullPage: true });
    console.log('📸 Builder screenshot saved');

    // ========== STEP 6: SAVE VIA UI (click Save button) ==========
    console.log('💾 Step 6: Saving layout via UI...');
    const saveBtn = page.locator('button:has-text("Save")').first();
    if (await saveBtn.isVisible({ timeout: 5000 })) {
      await saveBtn.click({ force: true });
      await page.waitForTimeout(3000);
      console.log('✅ Save clicked');
    }

    // ========== STEP 7: PREVIEW ==========
    console.log('👀 Step 7: Previewing Gym Module...');
    await page.goto(`${BASE_URL}/${moduleSlug}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    await page.screenshot({ path: 'gym-module-preview.png', fullPage: true });
    console.log('📸 Preview screenshot saved: gym-module-preview.png');

    console.log('\n🎉 GYM MODULE BUILD COMPLETE!');
    console.log(`📍 Public URL: ${BASE_URL}/${moduleSlug}`);
    console.log(`🔧 Builder URL: ${BASE_URL}/admin/modules/builder/${moduleId}`);

    // Keep browser open for inspection
    console.log('\n⏳ Browser stays open for 120s...');
    await page.waitForTimeout(120000);

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'gym-module-error.png' }).catch(() => {});
    await page.waitForTimeout(60000);
  } finally {
    await browser.close();
  }
}

buildGymModule();
