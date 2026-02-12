# V2 Resort — Customer-Facing Feature Inventory (Micro-Level)

> **Generated from exhaustive source-code analysis of every page and component in `frontend/src/`.**  
> Format: **FEATURE** / **PAGE** / **FILE** / **TYPE** / **DESCRIPTION**

---

## 1. HOMEPAGE (`/`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 1 | Hero Carousel Auto-Rotate | Home | `app/page.tsx` | Display | CMS-driven image carousel auto-rotates every 6 seconds |
| 2 | Hero Carousel Dot Navigation | Home | `app/page.tsx` | Navigation | Clickable dot indicators to jump to specific carousel slides |
| 3 | Hero Primary CTA Button | Home | `app/page.tsx` | Navigation | CMS-configurable primary action button (e.g., "Book Now") linking to a module |
| 4 | Hero Secondary CTA Button | Home | `app/page.tsx` | Navigation | CMS-configurable secondary action button with outline style |
| 5 | Weather Widget (Header) | Home | `components/WeatherWidget.tsx` | Display | Real-time weather badge showing temperature and condition icon; auto-refreshes every 30 min |
| 6 | Dynamic Service Cards | Home | `app/page.tsx` | Navigation | Grid of clickable cards for each active module (restaurant, chalets, pool, etc.), CMS-driven icons and descriptions |
| 7 | Animated Stats Row | Home | `app/page.tsx` | Display | Animated counter stats (e.g., years of service, happy guests, rooms) |
| 8 | Features Section | Home | `app/page.tsx` | Display | Feature highlights grid with icons and descriptions |
| 9 | Testimonials Carousel | Home | `app/page.tsx` | Display | Auto-rotating testimonial cards from CMS with star ratings |
| 10 | Homepage CTA Section | Home | `app/page.tsx` | Navigation | Bottom call-to-action block with "Book Now" button |
| 11 | Interactive Resort Map | Home | `app/page.tsx` | Interactive | Clickable map showing resort areas and points of interest |
| 12 | Scroll Indicator | Home | `app/page.tsx` | Display | Animated scroll-down indicator at bottom of hero section |

---

## 2. GLOBAL HEADER & NAVIGATION

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 13 | Logo / Home Link | Global | `components/Header.tsx` | Navigation | Dynamic logo (resort initials from CMS) linking to homepage |
| 14 | Desktop Navigation Bar | Global | `components/Header.tsx` | Navigation | Horizontal nav links auto-generated from active modules or CMS navbar config |
| 15 | Mobile Hamburger Menu | Global | `components/Header.tsx` | Navigation | Toggle button opening mobile navigation drawer |
| 16 | Mobile Navigation Drawer | Global | `components/Header.tsx` | Navigation | Full-screen slide-out drawer with all nav items + auth links |
| 17 | Cart Icon with Badge | Global | `components/Header.tsx` | Navigation | Shopping cart icon showing item count badge; links to `/cart` |
| 18 | Currency Switcher | Global | `components/CurrencySwitcher.tsx` | Setting | Dropdown to switch display currency (USD / EUR / LBP) with symbol |
| 19 | Language Switcher (Dropdown) | Global | `components/LanguageSwitcher.tsx` | Setting | Dropdown with flag + language name per locale (EN / AR / FR); persists via cookie |
| 20 | Language Switcher (Inline Flags) | Global | `components/LanguageSwitcher.tsx` | Setting | Compact variant with inline flag buttons for quick locale switching |
| 21 | Theme Toggle (Cycle) | Global | `components/ThemeToggle.tsx` | Setting | Button cycling through light → dark → system themes |
| 22 | Theme Toggle (Dropdown) | Global | `components/ThemeToggle.tsx` | Setting | Dropdown variant with explicit light / dark / system selection |
| 23 | Settings / Preferences Button | Global | `components/Header.tsx` | Action | Opens UserPreferencesModal for accessibility and display settings |
| 24 | Sign In Button | Global | `components/Header.tsx` | Navigation | Header auth button linking to `/login` (shown when logged out) |
| 25 | Register Button | Global | `components/Header.tsx` | Navigation | Header auth button linking to `/register` (shown when logged out) |
| 26 | Profile Link | Global | `components/Header.tsx` | Navigation | Header link to `/profile` (shown when logged in) |

---

## 3. COOKIE CONSENT

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 27 | Cookie Banner — Accept All | Global | `components/CookieConsentBanner.tsx` | Action | One-click accept all cookie categories |
| 28 | Cookie Banner — Reject Non-Essential | Global | `components/CookieConsentBanner.tsx` | Action | One-click reject all non-essential cookies |
| 29 | Cookie Banner — Customize | Global | `components/CookieConsentBanner.tsx` | Action | Opens detailed cookie preferences modal |
| 30 | Cookie Preferences — Category Toggles | Global | `components/CookieConsentBanner.tsx` | Toggle | Per-category toggles: Necessary (locked on), Functional, Analytics, Marketing |
| 31 | Cookie Preferences — Cookie Tables | Global | `components/CookieConsentBanner.tsx` | Display | Accordion sections showing individual cookies per category |
| 32 | Cookie Preferences — Save | Global | `components/CookieConsentBanner.tsx` | Action | Save Preferences button to apply cookie consent choices |
| 33 | Cookie Consent Reset | Global | `components/CookieConsentBanner.tsx` | Action | `useCookieConsent().resetConsent()` — programmatic consent reset |

---

## 4. LIVE CHAT / CONTACT WIDGET

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 34 | Floating Contact Button | Global | `components/LiveChatWidget.tsx` | Action | Always-visible floating button to open contact panel |
| 35 | Contact Panel — Name Input | Global | `components/LiveChatWidget.tsx` | Form Field | Text input for customer name |
| 36 | Contact Panel — Email Input | Global | `components/LiveChatWidget.tsx` | Form Field | Text input for email address |
| 37 | Contact Panel — Phone Input | Global | `components/LiveChatWidget.tsx` | Form Field | Text input for phone number |
| 38 | Contact Panel — Subject Dropdown | Global | `components/LiveChatWidget.tsx` | Form Field | Dropdown with options: Reservation, General Inquiry, Feedback, Complaint |
| 39 | Contact Panel — Message Textarea | Global | `components/LiveChatWidget.tsx` | Form Field | Message textarea |
| 40 | Contact Panel — Send Button | Global | `components/LiveChatWidget.tsx` | Action | Submit the contact/chat form |
| 41 | Contact Panel — Success Close | Global | `components/LiveChatWidget.tsx` | Action | Close button after successful send |

---

## 5. WISHLIST

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 42 | Wishlist Heart Toggle | Various | `components/Wishlist.tsx` | Action | Heart icon button on items to add/remove from wishlist (Zustand + persist) |
| 43 | Wishlist Panel Open | Various | `components/Wishlist.tsx` | Action | Slide-out panel showing all wishlisted items |
| 44 | Wishlist — Item Card | Various | `components/Wishlist.tsx` | Display | Item with image, name, price, and link to item page |
| 45 | Wishlist — Remove Item | Various | `components/Wishlist.tsx` | Action | Remove individual item from wishlist |
| 46 | Wishlist — Clear All | Various | `components/Wishlist.tsx` | Action | Remove all items from wishlist |
| 47 | Wishlist — Explore Now Link | Various | `components/Wishlist.tsx` | Navigation | Link shown on empty wishlist to browse items |

---

## 6. AUTHENTICATION

### 6a. Login (`/login`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 48 | Email Input | Login | `app/login/page.tsx` | Form Field | Email address field |
| 49 | Password Input | Login | `app/login/page.tsx` | Form Field | Password field with mask |
| 50 | Show/Hide Password Toggle | Login | `app/login/page.tsx` | Toggle | Eye icon to reveal/hide password text |
| 51 | Login Submit | Login | `app/login/page.tsx` | Action | Submit email + password to authenticate |
| 52 | Forgot Password Link | Login | `app/login/page.tsx` | Navigation | Link to `/forgot-password` |
| 53 | 2FA Code Input | Login | `app/login/page.tsx` | Form Field | 6-digit authenticator code input (shown after initial login if 2FA enabled) |
| 54 | 2FA Backup Code Input | Login | `app/login/page.tsx` | Form Field | Backup code input in XXXX-XXXX format |
| 55 | Toggle Authenticator / Backup | Login | `app/login/page.tsx` | Toggle | Switch between authenticator code and backup code input |
| 56 | Google OAuth Sign-In | Login | `app/login/page.tsx` | Action | Sign in with Google button |
| 57 | Apple OAuth Sign-In | Login | `app/login/page.tsx` | Action | Sign in with Apple button |
| 58 | Facebook OAuth (Disabled) | Login | `app/login/page.tsx` | Display | Facebook button shown but disabled |
| 59 | Demo Credentials Quick-Fill | Login | `app/login/page.tsx` | Action | One-click auto-fill with demo user credentials |
| 60 | Sign Up Link | Login | `app/login/page.tsx` | Navigation | Link to `/register` |
| 61 | Back to Home Link | Login | `app/login/page.tsx` | Navigation | Link back to homepage |

### 6b. Registration (`/register`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 62 | First Name Input | Register | `app/register/page.tsx` | Form Field | First name text field |
| 63 | Last Name Input | Register | `app/register/page.tsx` | Form Field | Last name text field |
| 64 | Email Input | Register | `app/register/page.tsx` | Form Field | Email address field |
| 65 | Phone Input (Optional) | Register | `app/register/page.tsx` | Form Field | Optional phone number field |
| 66 | Password Input | Register | `app/register/page.tsx` | Form Field | Password field with strength validation |
| 67 | Confirm Password Input | Register | `app/register/page.tsx` | Form Field | Password confirmation field |
| 68 | Show/Hide Password Toggle | Register | `app/register/page.tsx` | Toggle | Eye icon to reveal/hide password |
| 69 | Register Submit | Register | `app/register/page.tsx` | Action | Create account button |
| 70 | Sign In Link | Register | `app/register/page.tsx` | Navigation | Link to `/login` |
| 71 | Back to Home Link | Register | `app/register/page.tsx` | Navigation | Link back to homepage |

### 6c. Forgot Password (`/forgot-password`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 72 | Email Input | Forgot Password | `app/forgot-password/page.tsx` | Form Field | Email field to receive reset link |
| 73 | Send Reset Link Button | Forgot Password | `app/forgot-password/page.tsx` | Action | Submit to send password reset email |
| 74 | Success State Display | Forgot Password | `app/forgot-password/page.tsx` | Display | Confirmation message after reset link sent |
| 75 | Back to Login Link | Forgot Password | `app/forgot-password/page.tsx` | Navigation | Link back to `/login` |

### 6d. Reset Password (`/reset-password`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 76 | New Password Input | Reset Password | `app/reset-password/page.tsx` | Form Field | New password field |
| 77 | Confirm Password Input | Reset Password | `app/reset-password/page.tsx` | Form Field | Confirm new password field |
| 78 | Show/Hide Password Toggle | Reset Password | `app/reset-password/page.tsx` | Toggle | Eye icon reveal/hide |
| 79 | Reset Password Submit | Reset Password | `app/reset-password/page.tsx` | Action | Reset button; auto-redirects to login on success |
| 80 | Back to Login Link | Reset Password | `app/reset-password/page.tsx` | Navigation | Link back to `/login` |

---

## 7. RESTAURANT MODULE

### 7a. Menu (`/restaurant`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 81 | Category Filter Buttons | Restaurant Menu | `app/restaurant/page.tsx` | Filter | Horizontal scrollable category filter (All, Appetizers, Main, Desserts, etc.) |
| 82 | Featured-Only Toggle | Restaurant Menu | `app/restaurant/page.tsx` | Filter | Toggle to show only featured/promoted items |
| 83 | Dietary Filter — Vegetarian | Restaurant Menu | `app/restaurant/page.tsx` | Filter | Toggle filter for vegetarian items |
| 84 | Dietary Filter — Vegan | Restaurant Menu | `app/restaurant/page.tsx` | Filter | Toggle filter for vegan items |
| 85 | Dietary Filter — Gluten-Free | Restaurant Menu | `app/restaurant/page.tsx` | Filter | Toggle filter for gluten-free items |
| 86 | Menu Item Card — Add Button | Restaurant Menu | `app/restaurant/page.tsx` | Action | Add item to cart (opens Modifier modal if item has modifiers) |
| 87 | Menu Item Card — Remove Button | Restaurant Menu | `app/restaurant/page.tsx` | Action | Remove item from cart |
| 88 | Floating Cart Bar | Restaurant Menu | `app/restaurant/page.tsx` | Navigation | Sticky bottom bar showing cart count, total, and "View Cart" link to `/restaurant/cart` |

### 7b. Modifier Selection Modal

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 89 | Modal Open / Close | Restaurant Menu | `components/restaurant/ModifierSelectionModal.tsx` | Action | Modal triggered by adding item; dismiss via X button or Escape key |
| 90 | Modifier Group Accordion | Restaurant Menu | `components/restaurant/ModifierSelectionModal.tsx` | Interactive | Expandable/collapsible modifier groups (e.g., Size, Toppings, Sauces) |
| 91 | Modifier Option Select/Deselect | Restaurant Menu | `components/restaurant/ModifierSelectionModal.tsx` | Action | Click option to toggle selection; radio for single-select groups, checkbox for multi |
| 92 | Modifier Quantity +/- | Restaurant Menu | `components/restaurant/ModifierSelectionModal.tsx` | Action | Increment/decrement quantity for options that allow multiples |
| 93 | Modifier Price Display | Restaurant Menu | `components/restaurant/ModifierSelectionModal.tsx` | Display | Shows +/- price adjustment for each option |
| 94 | Required Group Indicator | Restaurant Menu | `components/restaurant/ModifierSelectionModal.tsx` | Display | "Required" badge on mandatory groups with min selection enforcement |
| 95 | Selection Count Display | Restaurant Menu | `components/restaurant/ModifierSelectionModal.tsx` | Display | "X selected" counter per group |
| 96 | Special Instructions Textarea | Restaurant Menu | `components/restaurant/ModifierSelectionModal.tsx` | Form Field | Free-text area for special requests (allergies, preferences) |
| 97 | Validation Error Display | Restaurant Menu | `components/restaurant/ModifierSelectionModal.tsx` | Display | Error list when required groups have insufficient selections |
| 98 | Add to Cart with Modifiers | Restaurant Menu | `components/restaurant/ModifierSelectionModal.tsx` | Action | Button showing total price; validates then adds customized item to cart |

### 7c. Restaurant Cart (`/restaurant/cart`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 99 | 3-Step Wizard Indicator | Restaurant Cart | `app/restaurant/cart/page.tsx` | Display | Visual step tracker: Review → Details → Payment |
| 100 | Cart Item — Quantity Increase (+) | Restaurant Cart | `app/restaurant/cart/page.tsx` | Action | Increment item quantity |
| 101 | Cart Item — Quantity Decrease (−) | Restaurant Cart | `app/restaurant/cart/page.tsx` | Action | Decrement item quantity |
| 102 | Cart Item — Remove (Trash) | Restaurant Cart | `app/restaurant/cart/page.tsx` | Action | Remove item from cart entirely |
| 103 | Order Type Selection | Restaurant Cart | `app/restaurant/cart/page.tsx` | Form Field | Toggle: Dine In / Takeaway / Delivery |
| 104 | Customer Name Input | Restaurant Cart | `app/restaurant/cart/page.tsx` | Form Field | Text field for customer name |
| 105 | Customer Phone Input | Restaurant Cart | `app/restaurant/cart/page.tsx` | Form Field | Text field for phone number |
| 106 | Table Number Input | Restaurant Cart | `app/restaurant/cart/page.tsx` | Form Field | Conditional input shown when order type is dine-in |
| 107 | Special Requests Textarea | Restaurant Cart | `app/restaurant/cart/page.tsx` | Form Field | Text area for order notes |
| 108 | Payment Method — Cash/Card Toggle | Restaurant Cart | `app/restaurant/cart/page.tsx` | Toggle | Switch between cash and card payment |
| 109 | Coupon Code Input | Restaurant Cart | `components/CouponInput.tsx` | Form Field | Coupon code text field with Enter key support |
| 110 | Coupon Validate Button | Restaurant Cart | `components/CouponInput.tsx` | Action | Validate coupon via API; shows error or applied state |
| 111 | Applied Coupon Display & Remove | Restaurant Cart | `components/CouponInput.tsx` | Display/Action | Shows code, discount type (%), savings amount; remove button |
| 112 | Gift Card Code Input | Restaurant Cart | `components/PaymentDiscounts.tsx` | Form Field | Gift card code entry field |
| 113 | Gift Card Check Balance | Restaurant Cart | `components/PaymentDiscounts.tsx` | Action | Check balance of entered gift card |
| 114 | Gift Card Apply / Remove | Restaurant Cart | `components/PaymentDiscounts.tsx` | Action | Apply gift card to order or remove applied card |
| 115 | Loyalty Points Input | Restaurant Cart | `components/PaymentDiscounts.tsx` | Form Field | Number of loyalty points to redeem |
| 116 | Loyalty Redeem All Button | Restaurant Cart | `components/PaymentDiscounts.tsx` | Action | Redeem all available loyalty points |
| 117 | Loyalty Dollar Value Display | Restaurant Cart | `components/PaymentDiscounts.tsx` | Display | Shows dollar equivalent of points entered |
| 118 | Discounts Section Toggle | Restaurant Cart | `components/PaymentDiscounts.tsx` | Toggle | Expandable "Discounts & Rewards" section aggregating coupon + gift card + loyalty |
| 119 | Total Discount Display | Restaurant Cart | `components/PaymentDiscounts.tsx` | Display | Aggregate discount amount from all sources |
| 120 | Price Summary (Subtotal/Tax/Discount/Total) | Restaurant Cart | `app/restaurant/cart/page.tsx` | Display | Detailed price breakdown with dynamic tax rate |
| 121 | Step Navigation (Next/Back) | Restaurant Cart | `app/restaurant/cart/page.tsx` | Navigation | Navigate between wizard steps |
| 122 | Place Order Button | Restaurant Cart | `app/restaurant/cart/page.tsx` | Action | Final submit; opens Stripe modal if card selected |
| 123 | Stripe Payment Modal | Restaurant Cart | `components/payments/StripePayment.tsx` | Modal | Full Stripe Elements form for card payment |
| 124 | Stripe — Payment Element | Restaurant Cart | `components/payments/StripePayment.tsx` | Form Field | Stripe-hosted card input (tabs layout) |
| 125 | Stripe — Pay Button | Restaurant Cart | `components/payments/StripePayment.tsx` | Action | Submit payment with amount display; shows processing spinner |
| 126 | Stripe — Cancel Button | Restaurant Cart | `components/payments/StripePayment.tsx` | Action | Cancel payment and return to cart |
| 127 | Stripe — Error Display | Restaurant Cart | `components/payments/StripePayment.tsx` | Display | Payment error message with icon |
| 128 | Stripe — Go Back on Init Error | Restaurant Cart | `components/payments/StripePayment.tsx` | Action | Button shown when payment intent creation fails |

### 7d. Restaurant Confirmation (`/restaurant/confirmation`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 129 | Order QR Code | Restaurant Confirmation | `app/restaurant/confirmation/page.tsx` | Display | QR code for the order |
| 130 | Order Number Display | Restaurant Confirmation | `app/restaurant/confirmation/page.tsx` | Display | Order reference number |
| 131 | Order Status Badge | Restaurant Confirmation | `app/restaurant/confirmation/page.tsx` | Display | Status indicator (pending, preparing, ready) |
| 132 | Order Type & Table Display | Restaurant Confirmation | `app/restaurant/confirmation/page.tsx` | Display | Dine-in/takeaway/delivery label with table number |
| 133 | Estimated Preparation Time | Restaurant Confirmation | `app/restaurant/confirmation/page.tsx` | Display | Estimated time until order ready |
| 134 | Customer Info Display | Restaurant Confirmation | `app/restaurant/confirmation/page.tsx` | Display | Name, phone, contact details |
| 135 | Items List with Prices | Restaurant Confirmation | `app/restaurant/confirmation/page.tsx` | Display | Ordered items with quantities and line prices |
| 136 | Price Breakdown Display | Restaurant Confirmation | `app/restaurant/confirmation/page.tsx` | Display | Subtotal, tax, discounts, total |
| 137 | Payment Status Display | Restaurant Confirmation | `app/restaurant/confirmation/page.tsx` | Display | Paid / Pending payment badge |
| 138 | Order More Link | Restaurant Confirmation | `app/restaurant/confirmation/page.tsx` | Navigation | Link back to restaurant menu |
| 139 | View My Orders Link | Restaurant Confirmation | `app/restaurant/confirmation/page.tsx` | Navigation | Link to profile orders tab |

### 7e. Restaurant Reservation (`/restaurant/reserve`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 140 | Party Size Selection | Reservation | `app/restaurant/reserve/page.tsx` | Form Field | Buttons for 1-8 guests plus "9+ Large Party" option |
| 141 | Date Navigation — Previous Day | Reservation | `app/restaurant/reserve/page.tsx` | Navigation | Arrow to go to previous day |
| 142 | Date Navigation — Next Day | Reservation | `app/restaurant/reserve/page.tsx` | Navigation | Arrow to go to next day |
| 143 | Date Input | Reservation | `app/restaurant/reserve/page.tsx` | Form Field | Direct date input field |
| 144 | Time Slot Grid | Reservation | `app/restaurant/reserve/page.tsx` | Form Field | Grid of available time slots; click to select |
| 145 | Continue Button (to Guest Details) | Reservation | `app/restaurant/reserve/page.tsx` | Action | Proceed from time selection to guest details step |
| 146 | Guest Name Input | Reservation | `app/restaurant/reserve/page.tsx` | Form Field | Name field for reservation |
| 147 | Guest Email Input | Reservation | `app/restaurant/reserve/page.tsx` | Form Field | Email field |
| 148 | Guest Phone Input | Reservation | `app/restaurant/reserve/page.tsx` | Form Field | Phone field |
| 149 | Special Requests Textarea | Reservation | `app/restaurant/reserve/page.tsx` | Form Field | Special requests / notes |
| 150 | Reservation Review Display | Reservation | `app/restaurant/reserve/page.tsx` | Display | Summary of party size, date, time, guest info before confirming |
| 151 | Confirm Reservation Submit | Reservation | `app/restaurant/reserve/page.tsx` | Action | Final confirm button to create reservation |
| 152 | Success — Back to Restaurant | Reservation | `app/restaurant/reserve/page.tsx` | Navigation | Link back to restaurant menu after success |

### 7f. Restaurant Waitlist (`/restaurant/waitlist`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 153 | Name Input | Waitlist | `app/restaurant/waitlist/page.tsx` | Form Field | Name for waitlist entry |
| 154 | Phone Input | Waitlist | `app/restaurant/waitlist/page.tsx` | Form Field | Phone number |
| 155 | Party Size Input | Waitlist | `app/restaurant/waitlist/page.tsx` | Form Field | Number of guests |
| 156 | Join Waitlist Submit | Waitlist | `app/restaurant/waitlist/page.tsx` | Action | Submit to join the waitlist |
| 157 | Check Status — ID Prompt | Waitlist | `app/restaurant/waitlist/page.tsx` | Form Field | Input for waitlist ID to check position |
| 158 | Position & Wait Time Display | Waitlist | `app/restaurant/waitlist/page.tsx` | Display | Shows queue position and estimated wait; auto-refreshes every 30s |
| 159 | Leave Waitlist Button | Waitlist | `app/restaurant/waitlist/page.tsx` | Action | Remove yourself from the waitlist |
| 160 | Join Again Button | Waitlist | `app/restaurant/waitlist/page.tsx` | Action | Re-join after leaving |

---

## 8. CHALETS MODULE

### 8a. Chalets Listing (`/chalets`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 161 | Chalet Card Display | Chalets Listing | `app/chalets/page.tsx` | Display | Card with image, name, specs (capacity, bedrooms, bathrooms), amenity icons, pricing |
| 162 | Featured Badge | Chalets Listing | `app/chalets/page.tsx` | Display | "Featured" badge on promoted chalets |
| 163 | Weekend Rate Notice | Chalets Listing | `app/chalets/page.tsx` | Display | Indicator when weekend pricing differs |
| 164 | View Details & Book Button | Chalets Listing | `app/chalets/page.tsx` | Navigation | Links to individual chalet detail page |
| 165 | Hero Stats Display | Chalets Listing | `app/chalets/page.tsx` | Display | Summary stats (total chalets, capacity range, etc.) |

### 8b. Chalet Detail (`/chalets/[id]`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 166 | Image Gallery — Previous | Chalet Detail | `app/chalets/[id]/page.tsx` | Navigation | Arrow button to view previous image |
| 167 | Image Gallery — Next | Chalet Detail | `app/chalets/[id]/page.tsx` | Navigation | Arrow button to view next image |
| 168 | Image Gallery — Dot Indicators | Chalet Detail | `app/chalets/[id]/page.tsx` | Navigation | Clickable dots to jump to specific image |
| 169 | Back to Chalets Link | Chalet Detail | `app/chalets/[id]/page.tsx` | Navigation | Back link to chalets listing |
| 170 | Chalet Info Display | Chalet Detail | `app/chalets/[id]/page.tsx` | Display | Name, description, capacity, bedrooms, bathrooms |
| 171 | Amenities List | Chalet Detail | `app/chalets/[id]/page.tsx` | Display | Icons and names for all chalet amenities |
| 172 | Weekday / Weekend Pricing Display | Chalet Detail | `app/chalets/[id]/page.tsx` | Display | Both weekday and weekend per-night rates |
| 173 | Check-In Date Input | Chalet Detail | `app/chalets/[id]/page.tsx` | Form Field | Date picker for check-in |
| 174 | Check-Out Date Input | Chalet Detail | `app/chalets/[id]/page.tsx` | Form Field | Date picker for check-out |
| 175 | Availability Calendar | Chalet Detail | `components/chalets/AvailabilityCalendar.tsx` | Interactive | Visual month calendar with blocked dates, date range selection, hover preview, weekend highlighting, per-day pricing display |
| 176 | Calendar — Previous Month | Chalet Detail | `components/chalets/AvailabilityCalendar.tsx` | Navigation | Arrow to navigate to previous month |
| 177 | Calendar — Next Month | Chalet Detail | `components/chalets/AvailabilityCalendar.tsx` | Navigation | Arrow to navigate to next month |
| 178 | Calendar — Check-In/Check-Out Selection | Chalet Detail | `components/chalets/AvailabilityCalendar.tsx` | Action | Two-click flow: first click = check-in, second = check-out; blocked dates auto-reset |
| 179 | Calendar — Date Range Highlight | Chalet Detail | `components/chalets/AvailabilityCalendar.tsx` | Display | Visual highlight of selected stay range |
| 180 | Calendar — Nights Count Display | Chalet Detail | `components/chalets/AvailabilityCalendar.tsx` | Display | Shows number of nights for selected range |
| 181 | Guest Count — Increase (+) | Chalet Detail | `app/chalets/[id]/page.tsx` | Action | Increment guest count |
| 182 | Guest Count — Decrease (−) | Chalet Detail | `app/chalets/[id]/page.tsx` | Action | Decrement guest count |
| 183 | Add-On Toggles | Chalet Detail | `app/chalets/[id]/page.tsx` | Toggle | Toggle switches for optional add-ons (BBQ, extra bedding, etc.) |
| 184 | Add-On Quantity Controls | Chalet Detail | `app/chalets/[id]/page.tsx` | Action | +/- controls for add-on quantities |
| 185 | Contact Name Input | Chalet Detail | `app/chalets/[id]/page.tsx` | Form Field | Booking contact name |
| 186 | Contact Email Input | Chalet Detail | `app/chalets/[id]/page.tsx` | Form Field | Booking contact email |
| 187 | Contact Phone Input | Chalet Detail | `app/chalets/[id]/page.tsx` | Form Field | Booking contact phone |
| 188 | Special Requests Textarea | Chalet Detail | `app/chalets/[id]/page.tsx` | Form Field | Free-text special requests |
| 189 | Pricing Summary Display | Chalet Detail | `app/chalets/[id]/page.tsx` | Display | Breakdown: base rate × nights + add-ons + tax = total |
| 190 | Book Chalet Submit | Chalet Detail | `app/chalets/[id]/page.tsx` | Action | Submit booking form |

### 8c. Booking Confirmation (`/chalets/booking-confirmation`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 191 | Booking Number Display | Booking Confirmation | `app/chalets/booking-confirmation/page.tsx` | Display | Booking reference number |
| 192 | Chalet Name & Details | Booking Confirmation | `app/chalets/booking-confirmation/page.tsx` | Display | Chalet name, dates, number of nights |
| 193 | Guest Count Display | Booking Confirmation | `app/chalets/booking-confirmation/page.tsx` | Display | Number of guests |
| 194 | Contact Info Display | Booking Confirmation | `app/chalets/booking-confirmation/page.tsx` | Display | Name, email, phone |
| 195 | Pricing Breakdown | Booking Confirmation | `app/chalets/booking-confirmation/page.tsx` | Display | Rates, add-ons, tax, deposit, total |
| 196 | Special Requests Display | Booking Confirmation | `app/chalets/booking-confirmation/page.tsx` | Display | Customer's special requests |
| 197 | Browse More Chalets Link | Booking Confirmation | `app/chalets/booking-confirmation/page.tsx` | Navigation | Link back to chalets listing |
| 198 | View My Bookings Link | Booking Confirmation | `app/chalets/booking-confirmation/page.tsx` | Navigation | Link to profile bookings tab |

---

## 9. POOL MODULE

### 9a. Pool Page (`/pool`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 199 | Date Picker | Pool | `app/pool/page.tsx` | Form Field | Select date for pool sessions |
| 200 | Session Cards | Pool | `app/pool/page.tsx` | Interactive | Clickable cards for each pool session showing time, capacity bar, sold-out badge |
| 201 | Session Capacity Bar | Pool | `app/pool/page.tsx` | Display | Visual progress bar showing remaining capacity |
| 202 | Sold Out Badge | Pool | `app/pool/page.tsx` | Display | Badge shown when session is at capacity |
| 203 | Pool Stats Display | Pool | `app/pool/page.tsx` | Display | Stats section (e.g., open hours, capacity) |
| 204 | Booking Sidebar — Customer Name | Pool | `app/pool/page.tsx` | Form Field | Text input for name |
| 205 | Booking Sidebar — Phone | Pool | `app/pool/page.tsx` | Form Field | Text input for phone |
| 206 | Adult Count — Increase (+) | Pool | `app/pool/page.tsx` | Action | Increment adult ticket count |
| 207 | Adult Count — Decrease (−) | Pool | `app/pool/page.tsx` | Action | Decrement adult ticket count |
| 208 | Child Count — Increase (+) | Pool | `app/pool/page.tsx` | Action | Increment child ticket count |
| 209 | Child Count — Decrease (−) | Pool | `app/pool/page.tsx` | Action | Decrement child ticket count |
| 210 | Pricing Calculation Display | Pool | `app/pool/page.tsx` | Display | Real-time total based on adult/child counts and session pricing |
| 211 | Purchase Tickets Button | Pool | `app/pool/page.tsx` | Action | Submit ticket purchase |
| 212 | Your Tickets — Ticket Cards | Pool | `app/pool/page.tsx` | Display | List of purchased tickets with session info |
| 213 | Your Tickets — View Confirmation Link | Pool | `app/pool/page.tsx` | Navigation | Link from ticket card to confirmation page |
| 214 | Your Tickets — View All Link | Pool | `app/pool/page.tsx` | Navigation | Link to see all purchased tickets |
| 215 | Pool Info — Hours | Pool | `app/pool/page.tsx` | Display | Operating hours section |
| 216 | Pool Info — What to Bring | Pool | `app/pool/page.tsx` | Display | List of items to bring |
| 217 | Pool Info — Amenities | Pool | `app/pool/page.tsx` | Display | Pool amenities list |

### 9b. Pool Confirmation (`/pool/confirmation`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 218 | QR Code Display | Pool Confirmation | `app/pool/confirmation/page.tsx` | Display | QR code for the ticket |
| 219 | Ticket Number Display | Pool Confirmation | `app/pool/confirmation/page.tsx` | Display | Ticket reference number |
| 220 | Session Info Display | Pool Confirmation | `app/pool/confirmation/page.tsx` | Display | Session name, date, time slot |
| 221 | Guest Count Display | Pool Confirmation | `app/pool/confirmation/page.tsx` | Display | Adults + children count |
| 222 | Contact Info Display | Pool Confirmation | `app/pool/confirmation/page.tsx` | Display | Customer name and phone |
| 223 | Total & Payment Status | Pool Confirmation | `app/pool/confirmation/page.tsx` | Display | Total amount and paid/pending status |
| 224 | Back to Pool Button | Pool Confirmation | `app/pool/confirmation/page.tsx` | Navigation | Link back to pool page |
| 225 | View My Tickets Link | Pool Confirmation | `app/pool/confirmation/page.tsx` | Navigation | Link to profile tickets tab |

---

## 10. SNACK BAR MODULE

### 10a. Snack Bar Menu (`/snack-bar`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 226 | Category Filter Buttons | Snack Bar | `app/snack-bar/page.tsx` | Filter | All / Sandwich / Drink / Snack / Ice Cream filter tabs |
| 227 | Item Card — Add to Cart | Snack Bar | `app/snack-bar/page.tsx` | Action | Add snack item to cart |
| 228 | Item Card — Quantity Increase (+) | Snack Bar | `app/snack-bar/page.tsx` | Action | Increment item quantity |
| 229 | Item Card — Quantity Decrease (−) | Snack Bar | `app/snack-bar/page.tsx` | Action | Decrement item quantity |
| 230 | Item Unavailability Overlay | Snack Bar | `app/snack-bar/page.tsx` | Display | Visual overlay on unavailable items |
| 231 | Price & Category Badges | Snack Bar | `app/snack-bar/page.tsx` | Display | Price tag and category label on each item |
| 232 | Snack Bar Stats | Snack Bar | `app/snack-bar/page.tsx` | Display | Stats section (items available, etc.) |
| 233 | Floating Cart Bar | Snack Bar | `app/snack-bar/page.tsx` | Navigation | Sticky bottom bar with item count, total, and "Place Order" link to `/snack-bar/cart` |

### 10b. Snack Bar Cart (`/snack-bar/cart`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 234 | Item Quantity +/- Controls | Snack Cart | `app/snack-bar/cart/page.tsx` | Action | Adjust quantity per item |
| 235 | Remove Item Button | Snack Cart | `app/snack-bar/cart/page.tsx` | Action | Remove item from cart |
| 236 | Customer Name Input | Snack Cart | `app/snack-bar/cart/page.tsx` | Form Field | Customer name |
| 237 | Customer Phone Input | Snack Cart | `app/snack-bar/cart/page.tsx` | Form Field | Phone number |
| 238 | Pickup Location Dropdown | Snack Cart | `app/snack-bar/cart/page.tsx` | Form Field | Dropdown: Pool Area / Beach / Counter |
| 239 | Payment Method — Cash/Card Toggle | Snack Cart | `app/snack-bar/cart/page.tsx` | Toggle | Cash or card selection |
| 240 | Special Notes Textarea | Snack Cart | `app/snack-bar/cart/page.tsx` | Form Field | Text area for order notes |
| 241 | Subtotal / Total Display | Snack Cart | `app/snack-bar/cart/page.tsx` | Display | Price summary |
| 242 | Place Order Button | Snack Cart | `app/snack-bar/cart/page.tsx` | Action | Submit snack bar order |
| 243 | Back to Snack Bar Link | Snack Cart | `app/snack-bar/cart/page.tsx` | Navigation | Return to menu |
| 244 | Empty Cart State | Snack Cart | `app/snack-bar/cart/page.tsx` | Display | Empty state with link back to menu |

### 10c. Snack Bar Confirmation (`/snack-bar/confirmation`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 245 | QR Code Display | Snack Confirmation | `app/snack-bar/confirmation/page.tsx` | Display | QR code for pickup |
| 246 | Order Number Display | Snack Confirmation | `app/snack-bar/confirmation/page.tsx` | Display | Order reference number |
| 247 | Status Badge | Snack Confirmation | `app/snack-bar/confirmation/page.tsx` | Display | Order status (preparing, ready, etc.) |
| 248 | Pickup Location Display | Snack Confirmation | `app/snack-bar/confirmation/page.tsx` | Display | Selected pickup point |
| 249 | Estimated Time Display | Snack Confirmation | `app/snack-bar/confirmation/page.tsx` | Display | Estimated preparation time |
| 250 | Customer Info Display | Snack Confirmation | `app/snack-bar/confirmation/page.tsx` | Display | Name and phone |
| 251 | Order Items with Prices | Snack Confirmation | `app/snack-bar/confirmation/page.tsx` | Display | Item list with quantities and prices |
| 252 | Total & Payment Status | Snack Confirmation | `app/snack-bar/confirmation/page.tsx` | Display | Total amount and payment badge |
| 253 | Special Notes Display | Snack Confirmation | `app/snack-bar/confirmation/page.tsx` | Display | Any special notes |
| 254 | Order More Button | Snack Confirmation | `app/snack-bar/confirmation/page.tsx` | Navigation | Link back to snack bar menu |
| 255 | View My Orders Button | Snack Confirmation | `app/snack-bar/confirmation/page.tsx` | Navigation | Link to profile orders |

---

## 11. GIFT CARDS

### 11a. Public Gift Cards (`/giftcards`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 256 | Buy / Check Balance Tabs | Gift Cards | `app/giftcards/page.tsx` | Navigation | Tab switcher between Buy and Check Balance |
| 257 | Template Amount Selection Cards | Gift Cards | `app/giftcards/page.tsx` | Form Field | Preset value cards ($25, $50, $100, etc.) |
| 258 | Custom Amount Input | Gift Cards | `app/giftcards/page.tsx` | Form Field | Manual amount entry ($10–$1,000) |
| 259 | Sender Name Input | Gift Cards | `components/GiftCardPurchase.tsx` | Form Field | Name of gift card buyer |
| 260 | Sender Email Input (Guests) | Gift Cards | `app/giftcards/page.tsx` | Form Field | Email for non-logged-in buyers |
| 261 | Recipient Name Input | Gift Cards | `components/GiftCardPurchase.tsx` | Form Field | Recipient's name |
| 262 | Recipient Email Input | Gift Cards | `components/GiftCardPurchase.tsx` | Form Field | Recipient's email |
| 263 | Personal Message Textarea | Gift Cards | `components/GiftCardPurchase.tsx` | Form Field | Message with 500-character limit |
| 264 | Purchase Gift Card Button | Gift Cards | `app/giftcards/page.tsx` | Action | Submit purchase with loading state |
| 265 | Success — Gift Card Code Display | Gift Cards | `app/giftcards/page.tsx` | Display | Shows the generated gift card code |
| 266 | Success — Buy Another Button | Gift Cards | `app/giftcards/page.tsx` | Action | Reset form to purchase another |
| 267 | Success — View My Gift Cards Link | Gift Cards | `app/giftcards/page.tsx` | Navigation | Link to `/account/giftcards` (logged in) |
| 268 | Success — Sign In to Track Link | Gift Cards | `app/giftcards/page.tsx` | Navigation | Link to login (logged out) |
| 269 | Check Balance — Code Input | Gift Cards | `app/giftcards/page.tsx` | Form Field | Gift card code field |
| 270 | Check Balance — Check Button | Gift Cards | `app/giftcards/page.tsx` | Action | Query balance via API |
| 271 | Check Balance — Result Display | Gift Cards | `app/giftcards/page.tsx` | Display | Shows balance amount and card status |

### 11b. Account Gift Cards (`/account/giftcards`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 272 | Buy / My Cards / Check Balance Tabs | Account Gift Cards | `app/account/giftcards/page.tsx` | Navigation | Three tabs for gift card management |
| 273 | GiftCardPurchase Component | Account Gift Cards | `app/account/giftcards/page.tsx` | Form | Embedded purchase form (same as public) |
| 274 | My Cards — Gift Card List | Account Gift Cards | `app/account/giftcards/page.tsx` | Display | List of owned gift cards |
| 275 | My Cards — Code with Copy Button | Account Gift Cards | `app/account/giftcards/page.tsx` | Action | Copy gift card code to clipboard |
| 276 | My Cards — Status Badge | Account Gift Cards | `app/account/giftcards/page.tsx` | Display | Active / Used / Expired badge |
| 277 | My Cards — Balance Display | Account Gift Cards | `app/account/giftcards/page.tsx` | Display | Remaining balance |
| 278 | My Cards — Recipient Info | Account Gift Cards | `app/account/giftcards/page.tsx` | Display | Recipient name and email |
| 279 | My Cards — Expiration Date | Account Gift Cards | `app/account/giftcards/page.tsx` | Display | Card expiry date |
| 280 | Transaction History List | Account Gift Cards | `app/account/giftcards/page.tsx` | Display | Transaction entries with type, amount, date |
| 281 | GiftCardBalance Component | Account Gift Cards | `app/account/giftcards/page.tsx` | Form | Embedded balance checker |

---

## 12. LOYALTY PROGRAM

### 12a. Account Loyalty (`/account/loyalty`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 282 | Loyalty Hero Card | Loyalty | `app/account/loyalty/page.tsx` | Display | Tier name, points balance, multiplier info |
| 283 | Tier Progress Bar | Loyalty | `app/account/loyalty/page.tsx` | Display | Visual progress toward next tier |
| 284 | Stats Grid | Loyalty | `app/account/loyalty/page.tsx` | Display | Earned points, redeemed points, current tier, lifetime value |
| 285 | Benefits List | Loyalty | `app/account/loyalty/page.tsx` | Display | List of current tier benefits |
| 286 | Recent Transactions List | Loyalty | `app/account/loyalty/page.tsx` | Display | Points earned/redeemed history |
| 287 | Tier Cards Carousel | Loyalty | `app/account/loyalty/page.tsx` | Display | Scrollable cards showing all available tiers |
| 288 | CTA — Order Food Link | Loyalty | `app/account/loyalty/page.tsx` | Navigation | Link to restaurant for earning points |
| 289 | CTA — Book a Chalet Link | Loyalty | `app/account/loyalty/page.tsx` | Navigation | Link to chalets for earning points |
| 290 | Enroll Now Button | Loyalty | `app/account/loyalty/page.tsx` | Action | Enrollment button for non-enrolled users |

### 12b. Loyalty Display Component

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 291 | Loyalty Mini Badge | Various | `components/LoyaltyDisplay.tsx` | Display | Compact points count badge linking to `/account/loyalty` |
| 292 | Loyalty Compact Card | Various | `components/LoyaltyDisplay.tsx` | Display | Small card showing tier + points, linking to loyalty page |
| 293 | Loyalty Full Card | Various | `components/LoyaltyDisplay.tsx` | Display | Full display with tier, progress bar, stats, benefits |

---

## 13. GLOBAL CART (`/cart`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 294 | Items Grouped by Module | Global Cart | `app/cart/page.tsx` | Display | Cart items organized by source module (restaurant, snack bar, etc.) |
| 295 | Item Quantity Increase (+) | Global Cart | `app/cart/page.tsx` | Action | Increment quantity |
| 296 | Item Quantity Decrease (−) | Global Cart | `app/cart/page.tsx` | Action | Decrement quantity |
| 297 | Remove Item Button | Global Cart | `app/cart/page.tsx` | Action | Remove single item |
| 298 | Clear Cart Button | Global Cart | `app/cart/page.tsx` | Action | Remove all items from cart |
| 299 | Per-Module Checkout Buttons | Global Cart | `app/cart/page.tsx` | Navigation | Separate checkout per module when items from multiple modules |
| 300 | Total Display | Global Cart | `app/cart/page.tsx` | Display | Cart total amount |
| 301 | Checkout Button | Global Cart | `app/cart/page.tsx` | Action | Proceed to checkout |
| 302 | Empty State — Return Home | Global Cart | `app/cart/page.tsx` | Navigation | Link to homepage when cart is empty |

---

## 14. PROFILE & ACCOUNT (`/profile`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 303 | Tab Navigation | Profile | `app/profile/page.tsx` | Navigation | Tabs: Profile / Orders / Snacks / Bookings / Tickets |
| 304 | Full Name Input | Profile | `app/profile/page.tsx` | Form Field | Editable name field |
| 305 | Email Display (Disabled) | Profile | `app/profile/page.tsx` | Display | Email shown read-only |
| 306 | Phone Input | Profile | `app/profile/page.tsx` | Form Field | Editable phone field |
| 307 | Preferred Language Dropdown | Profile | `app/profile/page.tsx` | Form Field | Dropdown: English / Arabic / French |
| 308 | Save Profile Button | Profile | `app/profile/page.tsx` | Action | Save profile changes |
| 309 | Change Avatar Button | Profile | `app/profile/page.tsx` | Action | Upload/change profile avatar |
| 310 | Roles Display | Profile | `app/profile/page.tsx` | Display | User roles badges |
| 311 | Two-Factor Settings Component | Profile | `app/profile/page.tsx` | Interactive | 2FA setup/management (enable, disable, regenerate backup codes) |
| 312 | Logout Button | Profile | `app/profile/page.tsx` | Action | Sign out of account |
| 313 | Orders Tab — Order Cards | Profile | `app/profile/page.tsx` | Display | List of restaurant orders with number, status, date, amount |
| 314 | Snacks Tab — Snack Order Cards | Profile | `app/profile/page.tsx` | Display | List of snack bar orders with details |
| 315 | Bookings Tab — Booking Cards | Profile | `app/profile/page.tsx` | Navigation | Clickable cards showing chalet name, dates, guests, amount |
| 316 | Tickets Tab — Ticket Cards | Profile | `app/profile/page.tsx` | Display | Pool ticket cards with number, status, date, session, guests, amount |

---

## 15. GDPR PRIVACY CENTER (`/account/privacy`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 317 | Tab Navigation | Privacy Center | `app/account/privacy/page.tsx` | Navigation | Tabs: Overview / Consents / Export / Deletion / Sharing |
| 318 | Overview — Privacy Dashboard | Privacy Center | `app/account/privacy/page.tsx` | Display | Summary of consent status and data activities |
| 319 | Consents — Marketing Email Toggle | Privacy Center | `app/account/privacy/page.tsx` | Toggle | Enable/disable marketing email consent |
| 320 | Consents — Marketing SMS Toggle | Privacy Center | `app/account/privacy/page.tsx` | Toggle | Enable/disable marketing SMS consent |
| 321 | Consents — Analytics Toggle | Privacy Center | `app/account/privacy/page.tsx` | Toggle | Enable/disable analytics tracking consent |
| 322 | Consents — Third-Party Sharing Toggle | Privacy Center | `app/account/privacy/page.tsx` | Toggle | Enable/disable third-party data sharing consent |
| 323 | Export — Request Data Export | Privacy Center | `app/account/privacy/page.tsx` | Action | Request ZIP export of all personal data |
| 324 | Export — Export History | Privacy Center | `app/account/privacy/page.tsx` | Display | List of export requests with status (pending/processing/completed) |
| 325 | Export — Download Link | Privacy Center | `app/account/privacy/page.tsx` | Action | Download completed data export |
| 326 | Export — Retention Policies Table | Privacy Center | `app/account/privacy/page.tsx` | Display | Table showing data categories, retention periods, legal basis |
| 327 | Deletion — Request Account Deletion | Privacy Center | `app/account/privacy/page.tsx` | Action | Button initiating deletion flow |
| 328 | Deletion — Reason Textarea | Privacy Center | `app/account/privacy/page.tsx` | Form Field | Required reason for deletion request |
| 329 | Deletion — Confirm Deletion | Privacy Center | `app/account/privacy/page.tsx` | Action | Final confirmation of deletion request |
| 330 | Deletion — Cancel Deletion | Privacy Center | `app/account/privacy/page.tsx` | Action | Cancel the deletion flow |
| 331 | Deletion — Deletion History | Privacy Center | `app/account/privacy/page.tsx` | Display | Past deletion requests with status, reason, rejection reason, retention exceptions |
| 332 | Sharing — Data Sharing Log | Privacy Center | `app/account/privacy/page.tsx` | Display | Record of third-party data shares (party, purpose, data shared, date) |
| 333 | Recent Activity Log | Privacy Center | `app/account/privacy/page.tsx` | Display | Timeline of privacy-related activities |

---

## 16. TABLE / QR ORDERING (`/order`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 334 | Category Tabs | QR Order | `app/order/page.tsx` | Filter | Horizontal category filter tabs |
| 335 | Menu Item Cards | QR Order | `app/order/page.tsx` | Display | Item cards with image, name, price, dietary badges (featured/spicy/vegetarian) |
| 336 | Add to Cart Button | QR Order | `app/order/page.tsx` | Action | Add menu item to in-page cart drawer |
| 337 | Cart Drawer Toggle Button | QR Order | `app/order/page.tsx` | Action | Floating button with item count badge to open cart drawer |
| 338 | Cart Drawer — Item Quantity +/- | QR Order | `app/order/page.tsx` | Action | Adjust item quantities in drawer |
| 339 | Cart Drawer — Remove Item | QR Order | `app/order/page.tsx` | Action | Remove item from drawer cart |
| 340 | Cart Drawer — Customer Name Input | QR Order | `app/order/page.tsx` | Form Field | Optional name field |
| 341 | Cart Drawer — Order Total | QR Order | `app/order/page.tsx` | Display | Running total of items |
| 342 | Cart Drawer — Submit Order Button | QR Order | `app/order/page.tsx` | Action | Submit the table order |
| 343 | Cart Drawer — Close Button | QR Order | `app/order/page.tsx` | Action | Close the cart drawer |

---

## 17. SELF-SERVICE KIOSK (`/kiosk`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 344 | Idle / Attract Screen | Kiosk | `app/kiosk/page.tsx` | Display | Welcome screen shown when kiosk is inactive |
| 345 | Check-In Mode Button | Kiosk | `app/kiosk/page.tsx` | Action | Select check-in workflow |
| 346 | Check-Out Mode Button | Kiosk | `app/kiosk/page.tsx` | Action | Select check-out workflow |
| 347 | Progress Steps Indicator | Kiosk | `app/kiosk/page.tsx` | Display | Visual step tracker (Identify → Confirm → Payment/Key → Complete) |
| 348 | Confirmation Code Input | Kiosk | `app/kiosk/page.tsx` | Form Field | Enter booking confirmation code |
| 349 | Guest Lookup | Kiosk | `app/kiosk/page.tsx` | Action | Search for guest by confirmation code |
| 350 | Confirm Guest Button | Kiosk | `app/kiosk/page.tsx` | Action | Verify and confirm guest identity |
| 351 | Process Payment | Kiosk | `app/kiosk/page.tsx` | Action | Handle check-in payment |
| 352 | Encode Key | Kiosk | `app/kiosk/page.tsx` | Action | Encode room/chalet key during check-in |
| 353 | Cancel / Reset Button | Kiosk | `app/kiosk/page.tsx` | Action | Cancel current flow and return to idle screen |

---

## 18. DYNAMIC MODULES (`/[slug]`)

### 18a. Dynamic Module Page

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 354 | Menu Service Rendering | Dynamic Module | `app/[slug]/page.tsx` | Display | Renders food/drink menu for menu-type modules |
| 355 | Booking Service Rendering | Dynamic Module | `app/[slug]/page.tsx` | Display | Renders booking interface for bookable modules |
| 356 | Session Service Rendering | Dynamic Module | `app/[slug]/page.tsx` | Display | Renders session/ticket interface for session-type modules |
| 357 | Dynamic Module Renderer | Dynamic Module | `app/[slug]/page.tsx` | Display | Custom layout rendering for non-standard modules |
| 358 | Disabled Module Message | Dynamic Module | `app/[slug]/page.tsx` | Display | Friendly message when module is disabled |
| 359 | Return Home Button | Dynamic Module | `app/[slug]/page.tsx` | Navigation | Link back to homepage |

### 18b. Dynamic Module Cart (`/[slug]/cart`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 360 | 3-Step Wizard (Review/Details/Payment) | Dynamic Cart | `app/[slug]/cart/page.tsx` | Display | Same structure as restaurant cart |
| 361 | Item Quantity +/- Controls | Dynamic Cart | `app/[slug]/cart/page.tsx` | Action | Quantity adjustment per item |
| 362 | Remove Item Button | Dynamic Cart | `app/[slug]/cart/page.tsx` | Action | Remove item from cart |
| 363 | Order Type Selection | Dynamic Cart | `app/[slug]/cart/page.tsx` | Form Field | Dine-in / Takeaway / Delivery toggle |
| 364 | Customer Name Input | Dynamic Cart | `app/[slug]/cart/page.tsx` | Form Field | Customer name |
| 365 | Customer Phone Input | Dynamic Cart | `app/[slug]/cart/page.tsx` | Form Field | Phone number |
| 366 | Table Number Input | Dynamic Cart | `app/[slug]/cart/page.tsx` | Form Field | Conditional on dine-in |
| 367 | Payment Method Toggle | Dynamic Cart | `app/[slug]/cart/page.tsx` | Toggle | Cash / Card |
| 368 | Special Notes Textarea | Dynamic Cart | `app/[slug]/cart/page.tsx` | Form Field | Order notes |
| 369 | PaymentDiscounts Section | Dynamic Cart | `app/[slug]/cart/page.tsx` | Interactive | Coupon + Gift Card + Loyalty (same as restaurant) |
| 370 | Dynamic Tax Rate Pricing | Dynamic Cart | `app/[slug]/cart/page.tsx` | Display | Tax calculated from CMS settings |
| 371 | Place Order Button | Dynamic Cart | `app/[slug]/cart/page.tsx` | Action | Submit order |
| 372 | Step Navigation (Next/Back) | Dynamic Cart | `app/[slug]/cart/page.tsx` | Navigation | Between wizard steps |

### 18c. Dynamic Session Confirmation (`/[slug]/confirmation`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 373 | QR Code Display | Dynamic Confirmation | `app/[slug]/confirmation/page.tsx` | Display | Ticket QR code |
| 374 | Ticket Number Display | Dynamic Confirmation | `app/[slug]/confirmation/page.tsx` | Display | Reference number |
| 375 | Session Info Display | Dynamic Confirmation | `app/[slug]/confirmation/page.tsx` | Display | Session details, date, time |
| 376 | Guest Count Display | Dynamic Confirmation | `app/[slug]/confirmation/page.tsx` | Display | Number of guests |
| 377 | Contact Info Display | Dynamic Confirmation | `app/[slug]/confirmation/page.tsx` | Display | Customer contact details |
| 378 | Total & Payment Status | Dynamic Confirmation | `app/[slug]/confirmation/page.tsx` | Display | Amount and paid/pending badge |
| 379 | Back to Module Button | Dynamic Confirmation | `app/[slug]/confirmation/page.tsx` | Navigation | Return to module page |
| 380 | View My Tickets Link | Dynamic Confirmation | `app/[slug]/confirmation/page.tsx` | Navigation | Link to profile tickets |

---

## 19. CUSTOMIZATION SELECTOR (Universal)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 381 | Customization Modal Open/Close | Various | `components/customization/CustomizationSelector.tsx` | Action | Full-screen modal for entity customization (any entity type) |
| 382 | Customization Group Accordion | Various | `components/customization/CustomizationSelector.tsx` | Interactive | Expandable groups (auto-expand required); toggle with chevron |
| 383 | Single Select Mode | Various | `components/customization/CustomizationSelector.tsx` | Action | Radio-style single option selection per group |
| 384 | Multiple Select Mode | Various | `components/customization/CustomizationSelector.tsx` | Action | Checkbox-style multi-option selection (up to max) |
| 385 | Quantity Select Mode | Various | `components/customization/CustomizationSelector.tsx` | Action | +/- quantity controls per option |
| 386 | Required Group Badge | Various | `components/customization/CustomizationSelector.tsx` | Display | "Required" label on mandatory groups |
| 387 | Popular Badge | Various | `components/customization/CustomizationSelector.tsx` | Display | "Popular" sparkle badge on popular options |
| 388 | Custom Badge Text | Various | `components/customization/CustomizationSelector.tsx` | Display | CMS-defined badge text per option |
| 389 | Type Badges (Add/Remove/Swap/Upgrade) | Various | `components/customization/CustomizationSelector.tsx` | Display | Color-coded type indicator per option |
| 390 | Price Display per Option | Various | `components/customization/CustomizationSelector.tsx` | Display | +/- price adjustment with context (per item, per night, per person, %) |
| 391 | Out of Stock Indicator | Various | `components/customization/CustomizationSelector.tsx` | Display | Disabled state with "Out of stock" message |
| 392 | Quantity Selector (Footer) | Various | `components/customization/CustomizationSelector.tsx` | Action | +/- controls for overall item quantity |
| 393 | Price Summary (Base + Customizations + Total) | Various | `components/customization/CustomizationSelector.tsx` | Display | Real-time calculated breakdown |
| 394 | Validation Error Display | Various | `components/customization/CustomizationSelector.tsx` | Display | Server-validated errors shown inline |
| 395 | Confirm Selection Button | Various | `components/customization/CustomizationSelector.tsx` | Action | Final confirm with total price; disables during validation |
| 396 | Retry on Error | Various | `components/customization/CustomizationSelector.tsx` | Action | Retry button when customization fetch fails |

---

## 20. CONTACT PAGE (`/contact`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 397 | Contact Form — Name Input | Contact | `app/contact/page.tsx` | Form Field | Customer name |
| 398 | Contact Form — Email Input | Contact | `app/contact/page.tsx` | Form Field | Email address |
| 399 | Contact Form — Phone Input | Contact | `app/contact/page.tsx` | Form Field | Phone number |
| 400 | Contact Form — Subject Input | Contact | `app/contact/page.tsx` | Form Field | Message subject |
| 401 | Contact Form — Message Textarea | Contact | `app/contact/page.tsx` | Form Field | Message body |
| 402 | Contact Form — Send Button | Contact | `app/contact/page.tsx` | Action | Submit contact form |
| 403 | Success — Send Another Message | Contact | `app/contact/page.tsx` | Action | Reset form after successful send |
| 404 | Contact Sidebar — Phone Link | Contact | `app/contact/page.tsx` | Action | Clickable tel: link to call |
| 405 | Contact Sidebar — Email Link | Contact | `app/contact/page.tsx` | Action | Clickable mailto: link |
| 406 | Contact Sidebar — Address Display | Contact | `app/contact/page.tsx` | Display | Physical address |
| 407 | Contact Sidebar — Hours Display | Contact | `app/contact/page.tsx` | Display | Reception hours |
| 408 | Business Hours Display | Contact | `app/contact/page.tsx` | Display | Restaurant, pool, reception hours |

---

## 21. STATIC / LEGAL PAGES

### 21a. Privacy Policy (`/privacy`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 409 | Back to Home Link | Privacy Policy | `app/privacy/page.tsx` | Navigation | Return to homepage |
| 410 | Privacy Policy Content | Privacy Policy | `app/privacy/page.tsx` | Display | CMS-driven or default policy sections |
| 411 | Contact Email Link | Privacy Policy | `app/privacy/page.tsx` | Action | Clickable email link (privacy@...) |

### 21b. Terms of Service (`/terms`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 412 | Back to Home Link | Terms of Service | `app/terms/page.tsx` | Navigation | Return to homepage |
| 413 | Terms Content | Terms of Service | `app/terms/page.tsx` | Display | CMS-driven or default terms sections |
| 414 | Contact Email Link | Terms of Service | `app/terms/page.tsx` | Action | Clickable email link (legal@...) |

### 21c. Cancellation Policy (`/cancellation`)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 415 | Back to Home Link | Cancellation Policy | `app/cancellation/page.tsx` | Navigation | Return to homepage |
| 416 | Cancellation Policy Content | Cancellation Policy | `app/cancellation/page.tsx` | Display | CMS-driven or default cancellation sections |
| 417 | Contact Support Link | Cancellation Policy | `app/cancellation/page.tsx` | Navigation | Link to contact/support |

---

## 22. WEATHER WIDGET (Variants)

| # | FEATURE | PAGE | FILE | TYPE | DESCRIPTION |
|---|---------|------|------|------|-------------|
| 418 | Weather — Header Badge | Global | `components/WeatherWidget.tsx` | Display | Compact temperature + icon in header bar |
| 419 | Weather — Compact Card | Various | `components/WeatherWidget.tsx` | Display | Small card with temperature, condition, icon |
| 420 | Weather — Full Card | Various | `components/WeatherWidget.tsx` | Display | Detailed card with all weather data |

---

## SUMMARY

| Category | Feature Count |
|----------|--------------|
| Homepage | 12 |
| Global Header & Navigation | 14 |
| Cookie Consent | 7 |
| Live Chat Widget | 8 |
| Wishlist | 6 |
| Authentication (Login/Register/Forgot/Reset) | 20 |
| Restaurant (Menu + Modifiers + Cart + Confirmation + Reservation + Waitlist) | 72 |
| Chalets (Listing + Detail + Calendar + Confirmation) | 38 |
| Pool (Page + Confirmation) | 28 |
| Snack Bar (Menu + Cart + Confirmation) | 30 |
| Gift Cards (Public + Account) | 26 |
| Loyalty Program | 12 |
| Global Cart | 9 |
| Profile & Account | 14 |
| GDPR Privacy Center | 17 |
| Table/QR Ordering | 10 |
| Self-Service Kiosk | 10 |
| Dynamic Modules (Page + Cart + Confirmation) | 27 |
| Customization Selector | 16 |
| Contact Page | 12 |
| Static/Legal Pages | 9 |
| Weather Widget | 3 |
| **TOTAL** | **420** |

---

*All file paths are relative to `v2-resort/frontend/src/`. Every entry was identified from direct source-code analysis of the TSX files.*
