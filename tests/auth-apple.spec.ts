import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3005';

test.describe('Apple Authentication', () => {

  test('should display Apple Sign-in button and redirect correctly', async ({ page }) => {
    // 1. Go to Login Page
    await page.goto(`${BASE_URL}/login`);

    // 2. Check for button presence (using translation key or text 'Continue with Apple')
    // It's an anchor link styled as button
    const appleButton = page.getByRole('link', { name: /continue with apple/i });
    await expect(appleButton).toBeVisible();

    // 3. Verify it has the Apple logo (icon)
    // Finding svg inside might be specific, but checking generic visibility is good enough for now.

    // 4. Click and Test Redirect
    // Since we don't have a real Apple account to login with, we just check 
    // that it hits our backend endpoint which redirects to Apple.
    
    // We expect a navigation to apple.com/auth or similar
    // Note: The backend redirects to https://appleid.apple.com/auth/authorize...
    
    await appleButton.click();
    
    // Wait for the URL to change to Apple's domain
    await page.waitForURL(/^https:\/\/appleid\.apple\.com\/auth\/authorize/);
    
    // Validate some query params usually present
    const url = page.url();
    expect(url).toContain('client_id=');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('response_mode=form_post');
  });

});
