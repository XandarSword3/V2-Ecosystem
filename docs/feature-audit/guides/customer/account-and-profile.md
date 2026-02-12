# Customer Guide: Account & Profile

> **Modules:** CUS-AUTH (12), CUS-ACCT (9), CUS-NAV (15), CUS-SET (4), CUS-CART (5), CUS-STATIC (4), CUS-MOD (6)
> **Features:** 55 features
> **Last Updated:** 2026-02-08

---

## Overview

This guide covers everything related to your V2 Resort account — from registration and login through profile management, navigation, settings, and universal features that span the entire platform. It includes authentication (with OAuth and 2FA), password management, the universal cart, settings like language/currency/theme, cookie consent, live chat, wishlist, and static informational pages.

## Prerequisites

- An email address is required for registration
- OAuth login requires an existing Google, Facebook, or Apple account
- 2FA setup requires an authenticator app (e.g., Google Authenticator, Authy)
- Some features (browsing, static pages) are accessible without an account

## Features Covered

### CUS-AUTH — Authentication (12 features)

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-AUTH-001 | Register with email/password | ✅ Implemented |
| CUS-AUTH-002 | Login with email/password | ✅ Implemented |
| CUS-AUTH-003 | OAuth login — Google | ✅ Implemented |
| CUS-AUTH-004 | OAuth login — Facebook | ✅ Implemented |
| CUS-AUTH-005 | OAuth login — Apple | ✅ Implemented |
| CUS-AUTH-006 | Enable two-factor authentication (2FA) | ✅ Implemented |
| CUS-AUTH-007 | Login with 2FA code | ✅ Implemented |
| CUS-AUTH-008 | Forgot password | ✅ Implemented |
| CUS-AUTH-009 | Reset password via email link | ✅ Implemented |
| CUS-AUTH-010 | Change password | ✅ Implemented |
| CUS-AUTH-011 | Password strength meter | ✅ Implemented |
| CUS-AUTH-012 | Logout | ✅ Implemented |

### CUS-ACCT — Account Management (9 features)

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-ACCT-001 | View profile | ✅ Implemented |
| CUS-ACCT-002 | Edit profile | ✅ Implemented |
| CUS-ACCT-003 | Upload profile photo | ✅ Implemented |
| CUS-ACCT-004 | View order history | ✅ Implemented |
| CUS-ACCT-005 | Track active orders | ✅ Implemented |
| CUS-ACCT-006 | View booking history | ✅ Implemented |
| CUS-ACCT-007 | Session timeout monitor | ✅ Implemented |
| CUS-ACCT-008 | Wishlist — toggle heart | ✅ Implemented |
| CUS-ACCT-009 | Wishlist — view panel | ✅ Implemented |

### CUS-NAV — Navigation (15 features)

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-NAV-001 | Desktop navigation bar | ✅ Implemented |
| CUS-NAV-002 | Mobile hamburger menu | ✅ Implemented |
| CUS-NAV-003 | Cart icon with badge count | ✅ Implemented |
| CUS-NAV-004 | User menu dropdown | ✅ Implemented |
| CUS-NAV-005 | Breadcrumb navigation | ✅ Implemented |
| CUS-NAV-006 | Footer navigation links | ✅ Implemented |
| CUS-NAV-007 | Search bar (global) | ✅ Implemented |
| CUS-NAV-008 | Notification bell icon | ✅ Implemented |
| CUS-NAV-009 | Language selector | ✅ Implemented |
| CUS-NAV-010 | Currency selector | ✅ Implemented |
| CUS-NAV-011 | Theme switcher | ✅ Implemented |
| CUS-NAV-012 | Back to top button | ✅ Implemented |
| CUS-NAV-013 | 404 page | ✅ Implemented |
| CUS-NAV-014 | Loading skeleton screens | ✅ Implemented |
| CUS-NAV-015 | Responsive layout breakpoints | ✅ Implemented |

### CUS-SET — Settings (4 features)

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-SET-001 | Currency preference | ✅ Implemented |
| CUS-SET-002 | Language preference | ✅ Implemented |
| CUS-SET-003 | Theme preference | ✅ Implemented |
| CUS-SET-004 | User preferences modal | ✅ Implemented |

### CUS-CART — Universal Cart (5 features)

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-CART-001 | View universal cart | ✅ Implemented |
| CUS-CART-002 | Update item quantity | ✅ Implemented |
| CUS-CART-003 | Remove item from cart | ✅ Implemented |
| CUS-CART-004 | Apply coupon code | ✅ Implemented |
| CUS-CART-005 | Proceed to checkout | ✅ Implemented |

### CUS-STATIC — Static Pages (4 features)

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-STATIC-001 | Contact page | ✅ Implemented |
| CUS-STATIC-002 | Privacy policy page | ✅ Implemented |
| CUS-STATIC-003 | Terms and conditions page | ✅ Implemented |
| CUS-STATIC-004 | Offline fallback page | ✅ Implemented |

### CUS-MOD — Dynamic Modules (6 features)

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-MOD-001 | Cookie consent banner | ✅ Implemented |
| CUS-MOD-002 | Cookie preference categories | ✅ Implemented |
| CUS-MOD-003 | Live chat widget | ✅ Implemented |
| CUS-MOD-004 | Contact support form | ✅ Implemented |
| CUS-MOD-005 | Dynamic module page routing | ✅ Implemented |
| CUS-MOD-006 | Module availability check | ✅ Implemented |

---

## How-To Guides

### 1. Register a New Account

**What it does:** Creates your V2 Resort customer account so you can make bookings, place orders, and access all resort services.

**Steps:**
1. Click **Sign Up** or **Register** on the top navigation bar.
2. Choose your registration method:

   **Email/Password:**
   1. Enter your **full name**, **email address**, and **password**.
   2. The **password strength meter** provides real-time feedback — aim for "Strong" or above. Requirements: minimum 8 characters, at least one uppercase letter, one number, and one special character.
   3. Confirm your password.
   4. Click **Create Account**.
   5. A verification email is sent to your address. Click the link in the email to verify.

   **OAuth (Google / Facebook / Apple):**
   1. Click the **Continue with Google**, **Continue with Facebook**, or **Continue with Apple** button.
   2. You're redirected to the provider's login page.
   3. Log in and authorize V2 Resort to access your basic profile information.
   4. You're redirected back to V2 Resort with your account created and logged in.

**What you'll see:**
- Registration form with validation messages for each field
- Password strength indicator (Weak → Fair → Good → Strong)
- OAuth provider buttons with familiar branding
- Success message and redirect to the homepage or dashboard on completion

**Tips:**
- OAuth registration is the fastest method — one click and you're in.
- If you register with email, check your spam/junk folder for the verification email.
- Your email address is your primary identifier — use one you have reliable access to.

---

### 2. Log In and Use Two-Factor Authentication

**What it does:** Securely access your account with optional two-factor authentication for enhanced security.

**Steps:**

**Standard Login:**
1. Click **Login** or **Sign In** in the navigation bar.
2. Enter your **email** and **password**.
3. Click **Log In**.
4. If 2FA is not enabled, you're logged in directly.

**Login with 2FA:**
1. After entering email and password, if 2FA is enabled, the system prompts for your **6-digit verification code**.
2. Open your authenticator app (Google Authenticator, Authy, etc.).
3. Find the V2 Resort entry and enter the current 6-digit code.
4. Click **Verify**.
5. On success, you're logged in.

**Enable 2FA:**
1. Go to `/profile` → **Security Settings**.
2. Click **Enable Two-Factor Authentication**.
3. A QR code is displayed. Scan it with your authenticator app.
4. Enter the 6-digit code from the app to confirm setup.
5. Save the backup recovery codes shown — store them securely.
6. 2FA is now active on your account.

**What you'll see:**
- Login form with email/password fields and OAuth buttons
- 2FA code input screen (6-digit numeric field)
- QR code for authenticator app scanning during setup
- Backup recovery codes (displayed once during setup)

**Tips:**
- Save your recovery codes somewhere secure — they're the only way to regain access if you lose your authenticator device.
- 2FA protects against unauthorized access even if your password is compromised.
- OAuth logins use the provider's own 2FA (if you have it enabled on Google/Facebook/Apple).

---

### 3. Manage Your Password

**What it does:** Reset a forgotten password, or change your current password from within your account.

**Steps:**

**Forgot Password:**
1. On the login page, click **Forgot Password?**
2. Enter your **registered email address**.
3. Click **Send Reset Link**.
4. Check your email for a password reset link (valid for a limited time, typically 1 hour).
5. Click the link in the email.
6. Enter your **new password** (twice to confirm).
7. The password strength meter guides you toward a strong password.
8. Click **Reset Password**.
9. You're redirected to the login page to sign in with your new password.

**Change Password (while logged in):**
1. Navigate to `/profile` → **Security Settings**.
2. Click **Change Password**.
3. Enter your **current password** for verification.
4. Enter your **new password** and confirm it.
5. Click **Save Password**.

**What you'll see:**
- Forgot password form with email input and success confirmation
- Email with a secure reset link (expires after use or timeout)
- Password change form with current/new/confirm fields
- Real-time password strength meter

**Tips:**
- Use a unique password not shared with other services.
- If you registered via OAuth, you may not have a V2 Resort password set — use OAuth login instead.

---

### 4. View and Edit Your Profile

**What it does:** View your account information and update your personal details, including profile photo.

**Steps:**
1. Click your **user avatar** or **name** in the top-right navigation, then select **Profile** from the dropdown. Or navigate directly to `/profile`.
2. Your profile page shows:
   - Profile photo (or default avatar)
   - Full name
   - Email address
   - Phone number
   - Address (if entered)
   - Account creation date
   - Loyalty tier (if enrolled)
3. Click **Edit Profile** to modify your information.
4. Update any field: name, phone, address. Email changes may require re-verification.
5. **Upload a profile photo:** Click the photo/avatar area, select an image file from your device (JPG, PNG, max 5MB), and crop if prompted.
6. Click **Save Changes**.

**What you'll see:**
- Profile card with all personal information
- Editable form fields when in edit mode
- Image upload dialog with preview and crop tool
- Success toast message after saving

**Tips:**
- Your email is used for all communications — keep it current.
- Profile photos help resort staff recognize you for personalized service.

---

### 5. Navigate the Platform

**What it does:** Use the desktop navigation bar, mobile hamburger menu, and other navigation elements to move around the resort platform.

**Steps:**

**Desktop Navigation:**
- The **top navigation bar** contains: Logo (links to home), module links (Restaurant, Chalets, Pool, Snack Bar, Gift Cards), Cart icon (with badge count), Notification bell, User menu, Language/Currency/Theme selectors.
- **Breadcrumbs** below the nav bar show your current path (e.g., Home > Restaurant > Cart).
- The **footer** contains links to Contact, Privacy Policy, Terms & Conditions, and social media.

**Mobile Navigation:**
- On mobile devices, the navigation collapses into a **hamburger menu** (☰) in the top-left.
- Tap the hamburger icon to open a slide-out menu with all the same links.
- The cart icon and notification bell remain visible in the top bar for quick access.

**Other Navigation Elements:**
- **Back to Top** button appears after scrolling down — click to return to the top of the page.
- **Global search** bar (magnifying glass icon) lets you search across the entire platform.
- **404 page** appears for invalid URLs, with a link back to the homepage.
- **Loading skeletons** appear while content is being fetched, providing visual feedback.

**Tips:**
- The platform is fully responsive — it adapts to desktop, tablet, and mobile screen sizes.
- Use breadcrumbs for efficient navigation when deep inside a section.
- The global search is the fastest way to find a specific feature or page.

---

### 6. Manage Cookie Consent

**What it does:** Control which types of cookies and tracking V2 Resort uses in your browser, in compliance with GDPR and privacy regulations.

**Steps:**
1. On your first visit, a **cookie consent banner** appears at the bottom of the page.
2. You have three options:
   - **Accept All** — Enables all cookie categories (necessary, analytics, marketing, preferences).
   - **Reject All** — Enables only necessary cookies (required for the site to function).
   - **Manage Preferences** — Opens a detailed modal where you can toggle individual categories.
3. If you click **Manage Preferences**:
   - **Necessary Cookies** — Always on; required for login, cart, and basic functionality. Cannot be disabled.
   - **Analytics Cookies** — Track usage patterns to help improve the service. Toggle on/off.
   - **Marketing Cookies** — Enable personalized ads and promotions. Toggle on/off.
   - **Preference Cookies** — Remember your settings (language, theme, etc.) across sessions. Toggle on/off.
4. Click **Save Preferences** to apply your selections.
5. The banner dismisses and your preferences are saved.
6. To change preferences later, look for "Cookie Settings" in the footer or account settings.

**What you'll see:**
- A non-intrusive banner at the bottom of the screen
- Three clear action buttons
- Category toggles in the preferences modal with descriptions of each category
- Confirmation that settings were saved

**Tips:**
- Rejecting analytics and marketing cookies doesn't affect platform functionality.
- Preference cookies improve your experience by remembering your language, currency, and theme — consider leaving these enabled.

---

### 7. Use Live Chat and Contact Support

**What it does:** Get real-time help from resort staff via the live chat widget, or submit a support request through the contact form.

**Steps:**

**Live Chat:**
1. Look for the **chat bubble icon** (💬) in the bottom-right corner of any page.
2. Click it to open the chat widget.
3. Type your message and press Enter or click Send.
4. A staff member or automated assistant responds in real time.
5. The chat window can be minimized or closed at any time.

**Contact Form:**
1. Navigate to the **Contact** page from the footer or main menu.
2. Fill in: **Name**, **Email**, **Subject**, **Message**.
3. Click **Send Message**.
4. A confirmation appears: "Your message has been sent. We'll respond within 24 hours."

**Tips:**
- Live chat is the fastest way to resolve urgent issues.
- For non-urgent matters, the contact form is ideal — you'll receive a response via email.

---

### 8. Use the Wishlist

**What it does:** Save your favorite chalets, menu items, or experiences to a wishlist for easy access later.

**Steps:**
1. On any item card (chalet, menu item, etc.), click the **heart icon** (♡) to add it to your wishlist. The icon fills in (♥) to confirm it's wishlisted.
2. Click the heart again to remove it from your wishlist.
3. To view your full wishlist, click the **heart/wishlist icon** in the navigation bar, or go to your profile's **Wishlist** tab.
4. The wishlist panel shows all saved items with quick links to their detail pages and "Add to Cart" or "Book Now" buttons.

**What you'll see:**
- Heart icon toggling between outlined (not wishlisted) and filled (wishlisted)
- Wishlist panel/page with saved items and their key details
- Direct action buttons on each wishlisted item

**Tips:**
- Wishlist items persist across sessions as long as you're logged in.
- Use the wishlist to compare chalets side-by-side before making a booking.

---

### 9. Configure Settings (Language, Currency, Theme)

**What it does:** Personalize your experience by choosing your preferred language, currency, and visual theme.

**Steps:**
1. Open the **User Preferences Modal** by clicking the settings/gear icon in the navigation bar, or navigate to your account settings.
2. **Language:** Select from 5 supported languages:
   - 🇬🇧 English (EN)
   - 🇸🇦 Arabic (AR) — also switches layout to RTL (right-to-left)
   - 🇫🇷 French (FR)
   - 🇩🇪 German (DE)
   - 🇮🇹 Italian (IT)
3. **Currency:** Choose your preferred display currency. Prices throughout the platform convert accordingly. Options include USD, EUR, GBP, AED, SAR, and more.
4. **Theme:** Select from 6 visual themes to customize the look and feel (e.g., Light, Dark, Ocean Blue, Sunset, Forest Green, Desert Sand).
5. Click **Save** or preferences apply immediately upon selection.
6. The entire platform updates to reflect your choices.

**What you'll see:**
- A modal or page with dropdown/toggle selectors for each setting
- Instant preview of theme changes
- RTL layout switch when selecting Arabic
- Prices updating to the selected currency across the site

**Tips:**
- Language selectors are also available in the navigation bar and footer for quick switching.
- Currency conversion uses live exchange rates (updated periodically).
- Theme preference is saved to your account and persists across devices when logged in.

---

### 10. Use the Universal Cart

**What it does:** A unified cart system that collects items from across the resort platform, allowing you to view, modify, and check out in one place.

**Steps:**
1. Click the **cart icon** (with badge count) in the top navigation bar.
2. The universal cart opens, showing items from all modules (restaurant, snack bar, etc.) grouped by source.
3. **Update quantity:** Use **−** / **+** buttons on any item.
4. **Remove item:** Click the trash icon on any item.
5. **Apply coupon:** Enter a coupon code in the discount field and click **Apply**.
6. Review the **order summary** with subtotal, discounts, taxes, and total.
7. Click **Checkout** to proceed to payment.

**Tips:**
- Items from different modules may be checked out separately depending on the order flow.
- The cart badge in the nav bar shows the total number of items across all modules.

---

### 11. Session Timeout and Security

**What it does:** Monitors your session and warns you before it expires, preventing loss of unsaved work.

**Steps:**
1. After a period of inactivity, a **session timeout warning** modal appears (e.g., "Your session will expire in 2 minutes").
2. Click **Stay Logged In** to extend your session.
3. If you don't respond, the session expires and you're logged out automatically.
4. Any unsaved cart items are preserved for when you log back in (if you have an account).

**Tips:**
- The timeout period is typically 30 minutes of inactivity.
- Keep the tab active or interact periodically during long browsing sessions.

---

### 12. View Order History and Tracking

**What it does:** Access a complete history of all your orders and bookings across the resort.

**Steps:**
1. Navigate to `/profile` and select the **Order History** tab.
2. All historical orders are listed with: date, order type (restaurant, snack bar, pool), order number, items summary, total, and status.
3. Click any order to expand full details.
4. For active orders, a **Track** button opens the real-time status tracker.

---

### 13. Access Static Pages

**What it does:** View informational pages like Contact, Privacy Policy, and Terms & Conditions.

**Steps:**
- **Contact Page:** Accessible from the footer. Contains resort contact details, map, and contact form.
- **Privacy Policy:** Accessible from the footer. Details how V2 Resort handles your data.
- **Terms & Conditions:** Accessible from the footer. Legal terms governing use of resort services.
- **Offline Page:** Displayed automatically when you lose internet connectivity, with a "Retry" button and cached content.

---

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Cannot register — "Email already in use" | You've already created an account with this email | Try logging in instead. Use "Forgot Password" if you don't remember your credentials. |
| OAuth login fails | Provider service issue or cookies blocked | Ensure third-party cookies are enabled. Try a different browser. If the provider is down, use email/password login. |
| 2FA code rejected | Code expired (codes refresh every 30 seconds) or clock sync issue | Wait for a fresh code. Ensure your device's clock is synced (automatic time setting). |
| Password reset email not received | Email in spam, or incorrect address | Check spam/junk. Ensure you entered the correct email. Wait 5 minutes and try again. |
| Session expired unexpectedly | Browser cleared cookies or inactivity timeout | Log in again. Ensure your browser isn't clearing cookies automatically. |
| Language changed but some text still in English | Some content may not have translations yet, or cache needs clearing | Hard-refresh the page (Ctrl+Shift+R). Report untranslated text via the contact form. |
| Currency showing wrong values | Currency selection may not have saved, or cache issue | Re-select your currency and save. Refresh the page. |
| Theme not applying | Browser-level dark mode may override | Check your browser's forced color/theme settings. Try saving the theme preference again. |
| Cart items disappeared | Session expired or logged into a different account | Log into the correct account. Cart items are tied to authenticated sessions. |
| Live chat not responding | Outside staff hours or high volume | Try again later, or use the contact form for non-urgent inquiries. |

## Related Modules

- [Restaurant Ordering](restaurant-ordering.md) — Use your account to order food
- [Chalet Booking](chalet-booking.md) — Book accommodations with your profile
- [Pool Tickets](pool-tickets.md) — Purchase pool tickets from your account
- [Snack Bar](snack-bar.md) — Quick ordering linked to your account
- [Gift Cards](gift-cards.md) — Purchase and manage gift cards
- [Loyalty Program](loyalty-program.md) — View loyalty status from your account
- [GDPR & Privacy](gdpr-privacy.md) — Manage data privacy and consent

## Feature Coverage Summary

| Metric | Value |
|---|---|
| Total Features | 55 |
| Implemented | 55 |
| Pending | 0 |
| Coverage | 100% |
| Key Modules | CUS-AUTH, CUS-ACCT, CUS-NAV, CUS-SET, CUS-CART, CUS-STATIC, CUS-MOD |
| Authentication Methods | Email/Password, Google OAuth, Facebook OAuth, Apple OAuth, 2FA |
| Languages Supported | EN, AR, FR, DE, IT |
| Themes Available | 6 |
| Primary URLs | `/profile`, `/login`, `/register`, `/contact`, `/privacy`, `/terms` |
