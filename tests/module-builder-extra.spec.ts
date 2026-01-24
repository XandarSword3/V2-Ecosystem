import { test, expect } from '@playwright/test';

// Constants
const ADMIN_EMAIL = 'admin@v2resort.com';
const ADMIN_PASSWORD = 'admin123';
const API_URL = 'http://localhost:3005';
const BASE_URL = 'http://localhost:3000';

test.describe('Module Builder New Features', () => {
  let moduleId: string;
  let moduleSlug: string;

  test.beforeEach(async ({ request }) => {
    // 1. Login to get token
    const loginRes = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
    const loginData = await loginRes.json();
    const token = loginData.data?.tokens?.accessToken || loginData.data?.accessToken;
    
    // 2. Create a test module
    moduleSlug = `mb-extra-${Date.now()}`;
    const createRes = await request.post(`${API_URL}/api/v1/admin/modules`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'Extra Features Test',
        slug: moduleSlug,
        template_type: 'menu_service',
        description: 'Testing Button, Form, Undo'
      }
    });

    if (createRes.ok()) {
        const mod = await createRes.json();
        moduleId = mod.data.id;
    } else {
        // Fallback or fail
        throw new Error('Could not create test module');
    }
  });

  test('should support Button, Form components and Undo/Redo', async ({ page }) => {
    // 1. Login
    await page.goto(`${BASE_URL}/login`);
    await page.getByPlaceholder('admin@v2resort.com').fill(ADMIN_EMAIL);
    await page.getByPlaceholder('••••••••').fill(ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin**');
    
    // 2. Go to Module Builder
    await page.goto(`${BASE_URL}/admin/modules/builder/${moduleId}`);
    await expect(page.getByText('Add Component:')).toBeVisible();

    // ---------------------------------------------------------
    // TEST 1: Add Button Component
    // ---------------------------------------------------------
    const buttonTool = page.getByRole('button', { name: 'Button' }).first();
    await expect(buttonTool).toBeVisible();
    await buttonTool.click();
    
    // Verify it appeared in canvas
    const buttonBlock = page.locator('.group').filter({ hasText: 'Button' }).first();
    await expect(buttonBlock).toBeVisible();

    // Select it to see properties
    await buttonBlock.click();
    await expect(page.getByText('Button Settings', { exact: false })).toBeVisible();
    
    // Edit Label
    const labelInput = page.getByLabel('Button Text'); // Actual label in PropertyPanel
    // If exact label not found, try generic input
    await labelInput.fill('Book Now');
    
    // Verify preview updates (assuming canvas updates reactively)
    // The "Button" text in the block header might remain "Button", 
    // but the rendered preview inside the block might show "Book Now"
    // Using DynamicModuleRenderer inside SortableBlock:
    await expect(page.locator('.group button').filter({ hasText: 'Book Now' })).toBeVisible();

    // ---------------------------------------------------------
    // TEST 2: Add Form Component
    // ---------------------------------------------------------
    const formTool = page.getByRole('button', { name: 'Form Container' }).first(); 
    // Name might be "Form Container" or just "Form" depending on icon/label mapping
    if (await formTool.isVisible()) {
        await formTool.click();
    } else {
        await page.getByRole('button', { name: 'Form' }).first().click();
    }

    const formBlock = page.locator('.group').filter({ hasText: 'Form' }).first();
    await expect(formBlock).toBeVisible();

    // ---------------------------------------------------------
    // TEST 3: Undo functionality
    // ---------------------------------------------------------
    // Current state: [Button, Form]
    // Click Undo
    const undoBtn = page.getByRole('button', { name: 'Undo' });
    await undoBtn.click();
    
    // Form should be gone
    await expect(formBlock).not.toBeVisible();
    // Button should still be there
    await expect(page.locator('.group button').filter({ hasText: 'Book Now' })).toBeVisible();

    // ---------------------------------------------------------
    // TEST 4: Redo functionality
    // ---------------------------------------------------------
    const redoBtn = page.getByRole('button', { name: 'Redo' });
    await redoBtn.click();
    
    // Form should be back
    await expect(formBlock).toBeVisible();

    // ---------------------------------------------------------
    // TEST 5: Colors (Basic verification)
    // ---------------------------------------------------------
    // Click on Button again
    await buttonBlock.click();
    // Open style tab or scroll to style section
    // Assuming 'Background' label or color input
    await expect(page.getByText('Background')).toBeVisible();

    // ---------------------------------------------------------
    // TEST 6: Save
    // ---------------------------------------------------------
    await page.click('button:has-text("Save Layout")');
    await expect(page.getByText('Layout saved successfully')).toBeVisible();
  });
});
