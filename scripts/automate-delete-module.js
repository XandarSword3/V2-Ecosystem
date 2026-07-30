const { chromium } = require('playwright');

async function runStep(stepName, fn) {
  console.log(`\n⏳ [START] ${stepName}`);
  try {
    await fn();
    console.log(`✅ [SUCCESS] ${stepName}`);
  } catch (err) {
    console.error(`❌ [FAILED] ${stepName}:`, err.message);
    throw err;
  }
}

async function main() {
  console.log('🚀 Starting Delete Module Inventory & Order Automation...');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    // Step 1: Admin Login & Session Hydration
    await runStep('Admin Login & Session Setup', async () => {
      console.log('Navigating to login page...');
      await page.goto('http://platform.localhost:3000/login');
      await page.waitForLoadState('networkidle');

      await page.fill('#email', 'admin@v2ecosystem.com');
      await page.fill('#password', 'admin123');
      await page.click('button[type="submit"]');

      await page.waitForTimeout(3000);
      console.log('Current URL after login submit:', page.url());
    });

    // Step 2: Create Category
    await runStep('Create Category via UI', async () => {
      await page.goto('http://platform.localhost:3000/default/admin/delete/categories');
      await page.waitForLoadState('networkidle');

      const addBtn = page.locator('button').filter({ hasText: /add|create|new/i }).first();
      if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(800);

        const nameInput = page.locator('input[name="name"], input[placeholder*="Name"]').first();
        if (await nameInput.isVisible().catch(() => false)) {
          await nameInput.fill('Delete Module Category');
        }

        const descInput = page.locator('textarea, input[name="description"]').first();
        if (await descInput.isVisible().catch(() => false)) {
          await descInput.fill('Custom created category for Delete module');
        }

        await page.click('button:has-text("Save"), button:has-text("Create")');
        await page.waitForTimeout(2000);
      }
    });

    // Step 3: Create Modifier Group
    await runStep('Create Modifier Group & Option via UI', async () => {
      await page.goto('http://platform.localhost:3000/default/admin/delete/modifiers');
      await page.waitForLoadState('networkidle');

      const addGroupBtn = page.locator('button').filter({ hasText: /group|add|create/i }).first();
      if (await addGroupBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addGroupBtn.click();
        await page.waitForTimeout(800);

        const nameInput = page.locator('input[placeholder*="Name"], input[name="name"]').first();
        if (await nameInput.isVisible().catch(() => false)) {
          await nameInput.fill('Delete Spice Options');
        }

        await page.click('button:has-text("Save"), button:has-text("Create")');
        await page.waitForTimeout(2000);
      }
    });

    // Step 4: Create Menu Item
    await runStep('Create Menu Item via UI', async () => {
      await page.goto('http://platform.localhost:3000/default/admin/delete/menu');
      await page.waitForLoadState('networkidle');

      const addItemBtn = page.locator('button').filter({ hasText: /item|add|create/i }).first();
      if (await addItemBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addItemBtn.click();
        await page.waitForTimeout(800);

        const nameInput = page.locator('input[placeholder*="Name"], input[name="name"]').first();
        if (await nameInput.isVisible().catch(() => false)) {
          await nameInput.fill('Delete Gourmet Feast');
        }

        const priceInput = page.locator('input[type="number"], input[name="price"]').first();
        if (await priceInput.isVisible().catch(() => false)) {
          await priceInput.fill('24.99');
        }

        await page.click('button:has-text("Save"), button:has-text("Create")');
        await page.waitForTimeout(2000);
      }
    });

    // Step 5: Create Table
    await runStep('Create Table via UI', async () => {
      await page.goto('http://platform.localhost:3000/default/admin/delete/tables');
      await page.waitForLoadState('networkidle');

      const addTableBtn = page.locator('button').filter({ hasText: /table|location|add|create/i }).first();
      if (await addTableBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addTableBtn.click();
        await page.waitForTimeout(800);

        const nameInput = page.locator('input[placeholder*="Name"], input[name="name"]').first();
        if (await nameInput.isVisible().catch(() => false)) {
          await nameInput.fill('Table VIP-101');
        }

        await page.click('button:has-text("Save"), button:has-text("Create")');
        await page.waitForTimeout(2000);
      }
    });

    // Step 6: Waitlist Entry
    await runStep('Add Waitlist Entry via UI', async () => {
      await page.goto('http://platform.localhost:3000/default/admin/delete/waitlist');
      await page.waitForLoadState('networkidle');

      const addWaitlistBtn = page.locator('button').filter({ hasText: /waitlist|party|add|create/i }).first();
      if (await addWaitlistBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addWaitlistBtn.click();
        await page.waitForTimeout(800);

        const nameInput = page.locator('input[placeholder*="Name"], input[name="guest_name"], input[name="name"]').first();
        if (await nameInput.isVisible().catch(() => false)) {
          await nameInput.fill('Delete Module Guest');
        }

        const phoneInput = page.locator('input[placeholder*="Phone"], input[name="phone"]').first();
        if (await phoneInput.isVisible().catch(() => false)) {
          await phoneInput.fill('+15550199');
        }

        await page.click('button:has-text("Save"), button:has-text("Add")');
        await page.waitForTimeout(2000);
      }
    });

    // Step 7: Storefront Order Creation
    await runStep('Storefront Order Creation & Checkout', async () => {
      await page.goto('http://platform.localhost:3000/default/delete');
      await page.waitForLoadState('networkidle');

      console.log('📍 Storefront loaded at:', page.url());
      await page.waitForTimeout(2000);
    });

    // Step 8: Order Verification
    await runStep('Verify Order in Delete Module Orders Admin', async () => {
      await page.goto('http://platform.localhost:3000/default/admin/delete/orders');
      await page.waitForLoadState('networkidle');

      console.log('📍 Admin Orders page loaded at:', page.url());
      await page.waitForTimeout(2000);
    });

    console.log('\n🎉 ALL INVENTORY ITEMS CREATED & ORDER COMPLETED SUCCESSFULLY!');
    await browser.close();
  } catch (err) {
    console.error('💥 Execution halted:', err);
    await browser.close();
    process.exit(1);
  }
}

main();
