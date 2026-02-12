# Scenario 2: Complete Rebranding to "Serenity Spa & Wellness"

## Mission
Transform the platform into a luxury spa and wellness center management system. This will test the system's adaptability to a completely different business model with different workflows and customer expectations.

---

## Phase 1: CMS Rebranding (Test CMS Flexibility)

### Step 1.1: Homepage Transformation
**Goal:** Rebrand from resort/gym to luxury spa

**Actions:**
1. **Hero Section:**
   - Title: "Discover Tranquility at Serenity Spa"
   - Subtitle: "Luxury Treatments | Wellness Programs | Holistic Healing"
   - Background Image: Calm spa setting with candles/stones
   - CTA Button: "Book Your Escape" → Link to treatments

2. **Features Section:**
   - Replace gym features with spa features:
     * "Signature Massage Therapies"
     * "Rejuvenating Facial Treatments"
     * "Holistic Wellness Programs"
     * "Infrared Sauna & Steam Room"
   - Update icons to spa-related (lotus flower, massage stones, etc.)
   - Update descriptions with calming language

3. **Stats Section:**
   - "5,000+ Treatments Delivered"
   - "12 Expert Therapists"
   - "98% Customer Satisfaction"
   - "Open 7 Days a Week"

4. **Testimonials:**
   - Replace with spa testimonials
   - Names: "Emily S. - Most Relaxing Day", "David K. - Life-Changing Massage"
   - Focus on relaxation and wellness transformation

5. **Ambiance Section:**
   - Add new section: "Our Peaceful Environment"
   - Describe: Tranquil music, aromatherapy, meditation garden

**Verification Checklist:**
- [ ] Hero reflects spa luxury aesthetic
- [ ] Language is calming/wellness-focused
- [ ] Features highlight treatments
- [ ] Stats relevant to spa business
- [ ] Testimonials about relaxation
- [ ] No fitness/gym references

---

### Step 1.2: Footer & Branding
**Goal:** Establish spa brand identity

**Actions:**
1. **Footer Links:**
   - "About Serenity" 
   - "Treatments & Services"
   - "Wellness Programs"
   - "Gift Cards & Packages"
   - "Our Therapists"
   - "Book Appointment"
   - "Spa Policies"

2. **Contact Info:**
   - Address: "789 Peaceful Lane, Malibu, CA 90265"
   - Phone: "+1 (555) SPA-CALM"
   - Email: "bliss@serenityspawellness.com"

3. **Social Media:**
   - Instagram (spa before/after, ambiance shots)
   - Facebook (events, special offers)
   - Pinterest (treatment inspiration)

4. **Brand Colors:**
   - Primary: Soft Sage Green (#B8C5B0)
   - Secondary: Warm Beige (#E8DFD0)
   - Accent: Rose Gold (#B76E79)
   - Dark: Charcoal (#2F3E46)

5. **Logo:**
   - Upload spa logo (lotus or zen stones)
   - Or text: "SERENITY SPA" with tagline "Find Your Balance"

**Verification Checklist:**
- [ ] Footer links spa-appropriate
- [ ] Contact info updated
- [ ] Calming color palette applied
- [ ] Logo displays correctly
- [ ] Social media links updated

---

### Step 1.3: Pages & Navigation
**Goal:** Create spa-specific informational pages

**Actions:**
1. **Create New Pages:**
   - "About Us" - Spa philosophy, founder story
   - "Our Treatments" - Service menu overview
   - "Meet Our Therapists" - Staff bios with specialties
   - "Wellness Journey" - Multi-session programs
   - "Spa Etiquette" - Arrival time, what to bring, policies
   - "Gift Cards" - Perfect gift messaging

2. **Update Navigation Menu:**
   - Home
   - Treatments (links to Module 1)
   - Membership (links to Module 2)
   - Wellness Shop (links to Module 3)
   - About
   - Gift Cards
   - Book Now

**Verification Checklist:**
- [ ] All pages created
- [ ] Content is spa/wellness focused
- [ ] Navigation logical for spa booking
- [ ] Links work correctly
- [ ] Mobile-friendly

---

## Phase 2: Module Creation (Test Module Builder)

### Module 1: Spa Treatments (Booking Template)
**Template Used:** Booking/Appointments (like Personal Training but for treatments)

**Configuration:**
1. **Module Details:**
   - Name: "Spa Treatments"
   - Slug: `spa-treatments`
   - Icon: Spa
   - Description: "Book massages, facials, and body treatments"
   - Template: Booking with Service Duration

2. **Create Treatment Categories:**
   - Massage Therapy
   - Facial Treatments
   - Body Treatments
   - Couple's Experiences
   - Add-On Services

3. **Create Treatments (Examples):**

   **Category: Massage Therapy**
   
   Treatment 1: Swedish Relaxation Massage
   - Duration: 60 minutes
   - Price: $120
   - Therapist: Any available OR select specific
   - Description: "Classic full-body massage for deep relaxation"
   - Benefits: "Reduces stress, improves circulation"
   - Add-ons: Hot stones (+$30), Aromatherapy (+$20)
   
   Treatment 2: Deep Tissue Massage
   - Duration: 90 minutes
   - Price: $180
   - Therapist: Certified deep tissue specialist
   - Description: "Intense pressure to release chronic tension"
   - Benefits: "Pain relief, muscle recovery"
   - Add-ons: CBD oil (+$40), Extended time (+$60/30min)
   
   Treatment 3: Hot Stone Massage
   - Duration: 75 minutes
   - Price: $160
   - Description: "Heated stones melt away tension"
   - Benefits: "Ultimate relaxation, improved sleep"

   **Category: Facial Treatments**
   
   Treatment 4: Hydrating Facial
   - Duration: 60 minutes
   - Price: $100
   - Esthetician: Any certified
   - Description: "Restore moisture and glow"
   - Skin Types: Dry, mature
   - Add-ons: Eye treatment (+$25), Neck/décolleté (+$35)
   
   Treatment 5: Anti-Aging Facial
   - Duration: 90 minutes
   - Price: $180
   - Description: "Collagen boost and fine line reduction"
   - Includes: LED therapy, peptide serum
   - Add-ons: Lip treatment (+$20)

   **Category: Body Treatments**
   
   Treatment 6: Full Body Scrub & Wrap
   - Duration: 120 minutes
   - Price: $220
   - Description: "Exfoliation followed by nourishing wrap"
   - Options: Sugar scrub, salt glow, mud wrap
   
   Treatment 7: Detox Body Wrap
   - Duration: 90 minutes
   - Price: $150
   - Description: "Purify and tone with seaweed wrap"

   **Category: Couple's Experiences**
   
   Treatment 8: Couple's Massage
   - Duration: 60 minutes
   - Price: $240 (for two)
   - Description: "Side-by-side relaxation massage"
   - Includes: Champagne, chocolate-covered strawberries
   
   Treatment 9: Couple's Spa Day Package
   - Duration: 3 hours
   - Price: $600 (for two)
   - Includes: Massage, facial, body scrub, lunch

4. **Booking Rules:**
   - Book up to 60 days in advance
   - Minimum 24-hour cancellation (50% charge if late)
   - Arrive 15 minutes early
   - Late arrival may reduce treatment time
   - Gratuity: Suggested 18-20%

5. **Time Slots:**
   - Start times every 15 minutes from 9 AM - 7 PM
   - Last booking ends by 8:30 PM
   - Block lunch breaks for therapists (12-1 PM)

**Customer Testing:**
1. Browse treatments by category
2. Select "Swedish Relaxation Massage"
3. Choose duration (60 or 90 min)
4. Select preferred therapist OR "First Available"
5. Choose date and time
6. Add hot stones add-on (+$30)
7. Enter special requests (e.g., "Focus on lower back")
8. Complete payment
9. Receive confirmation with spa policies
10. Check booking in "My Appointments"

**Staff Testing (Therapist):**
1. Login as therapist "Sophia Martinez"
2. View today's schedule
3. See client name, treatment, duration
4. View client preferences/notes
5. Mark appointment as "In Progress"
6. Mark as "Completed"
7. Add post-treatment notes
8. View tips received

**Admin Testing:**
1. Create new treatment
2. Set pricing and duration
3. Assign qualified therapists
4. Create treatment packages (bundle discount)
5. View booking calendar (all therapists)
6. Handle cancellations and refunds
7. Reports: Revenue by treatment type
8. Reports: Therapist utilization
9. Block dates for holidays
10. Set special hours

**Verification Checklist:**
- [ ] Module appears in navigation
- [ ] Treatments categorized correctly
- [ ] Booking flow smooth
- [ ] Add-ons work and price correctly
- [ ] Therapist selection works
- [ ] Time slots prevent double-booking
- [ ] Special requests field saves
- [ ] Payment processes
- [ ] Confirmation email sent
- [ ] Therapist can view schedule
- [ ] Admin reports accurate
- [ ] Cancellation policy enforced
- [ ] Gratuity calculation option

---

### Module 2: Wellness Membership (Subscription/Membership Template)
**Template Used:** Custom Membership with Recurring Benefits

**Configuration:**
1. **Module Details:**
   - Name: "Wellness Membership"
   - Slug: `wellness-membership`
   - Icon: Star
   - Description: "Monthly memberships for ongoing wellness"
   - Template: Subscription Management

2. **Membership Tiers:**

   **Tier 1: Wellness Explorer**
   - Price: $99/month
   - Benefits:
     * 1 massage OR facial per month (60 min)
     * 10% off all additional services
     * 15% off retail products
     * Free sauna/steam room access
     * Priority booking
   - Commitment: Month-to-month, cancel anytime
   
   **Tier 2: Wellness Enthusiast**
   - Price: $179/month
   - Benefits:
     * 2 treatments per month (any type)
     * 15% off all additional services
     * 20% off retail products
     * Free sauna/steam room access
     * Priority booking + late booking privileges
     * 1 free add-on per visit
   - Commitment: 3-month minimum
   
   **Tier 3: Wellness VIP**
   - Price: $299/month
   - Benefits:
     * 4 treatments per month (any type)
     * 20% off all additional services
     * 25% off retail products
     * Unlimited sauna/steam room
     * Priority booking + concierge service
     * Free add-ons on all visits
     * Bring a guest once per month
     * Annual birthday massage (free)
   - Commitment: Annual contract (save 10%)

3. **Membership Features:**
   - Rollover unused treatments (max 2 months)
   - Pause membership (1 month/year allowed)
   - Share treatments with family (Enthusiast+ only)
   - Auto-renewal with saved payment
   - Cancel with 30-day notice

**Customer Testing:**
1. Browse membership tiers
2. Compare benefits
3. Select "Wellness Enthusiast"
4. Enter payment info
5. Confirm subscription
6. Receive welcome email with membership card
7. Book first treatment (shows as "included")
8. View remaining credits (1/2 used)
9. Book second treatment
10. Try booking third (should require payment with discount)
11. Test: Pause membership for 1 month

**Staff Testing:**
1. Verify member status at check-in
2. Apply member discount automatically
3. Track treatment credits used
4. Process member guest privileges

**Admin Testing:**
1. Create new membership tier
2. Set pricing and benefits
3. View active members count
4. Revenue from memberships (MRR)
5. Churn rate report
6. Upgrade/downgrade member tier
7. Handle membership cancellations
8. Send renewal reminders
9. Credit rollover management

**Verification Checklist:**
- [ ] Module in navigation
- [ ] Tiers display correctly
- [ ] Payment processes monthly
- [ ] Credits track accurately
- [ ] Discounts apply automatically
- [ ] Rollover logic works
- [ ] Pause functionality works
- [ ] Cancellation with notice works
- [ ] Member portal shows benefits
- [ ] Admin can manage members
- [ ] MRR calculations correct
- [ ] Auto-renewal works
- [ ] Welcome email sent

---

### Module 3: Wellness Boutique (E-commerce Template)
**Template Used:** Menu/Products (like Nutrition Store)

**Configuration:**
1. **Module Details:**
   - Name: "Wellness Boutique"
   - Slug: `wellness-boutique`
   - Icon: Shopping Bag
   - Description: "Premium skincare, aromatherapy, and wellness products"
   - Template: Products with Variants

2. **Create Categories:**
   - Skincare Essentials
   - Aromatherapy & Candles
   - Bath & Body
   - Wellness Supplements
   - Spa Tools & Accessories
   - Gift Sets

3. **Create Products (Examples):**

   **Category: Skincare Essentials**
   
   Product 1: Organic Moisturizing Cream
   - Price: $68
   - Description: "Hydrating daily cream with hyaluronic acid"
   - Size options: 50ml ($68), 100ml ($120)
   - Skin type: All skin types
   - Ingredients: Organic aloe, vitamin E, hyaluronic acid
   - Stock: 40 units
   
   Product 2: Vitamin C Serum
   - Price: $85
   - Description: "Brighten and even skin tone"
   - Size: 30ml
   - Stock: 25 units
   
   Product 3: Gentle Cleansing Gel
   - Price: $42
   - Description: "Sulfate-free, pH balanced"
   - Stock: 50 units

   **Category: Aromatherapy & Candles**
   
   Product 4: Essential Oil Collection
   - Price: $45
   - Description: "Set of 4: Lavender, Eucalyptus, Peppermint, Lemon"
   - Stock: 30 sets
   
   Product 5: Hand-Poured Soy Candle
   - Price: $32
   - Scent options: 
     * Lavender Dreams
     * Ocean Breeze
     * Sandalwood Vanilla
     * Eucalyptus Mint
   - Size options: 8oz ($32), 16oz ($55)
   - Stock: 60 units
   
   Product 6: Reed Diffuser
   - Price: $38
   - Description: "Continuous fragrance for 3-4 months"
   - Scent options: Same as candles
   - Stock: 35 units

   **Category: Bath & Body**
   
   Product 7: Detox Bath Salts
   - Price: $28
   - Description: "Pink Himalayan & Dead Sea salts"
   - Weight options: 500g ($28), 1kg ($50)
   - Scent: Eucalyptus & Mint
   - Stock: 45 units
   
   Product 8: Nourishing Body Butter
   - Price: $36
   - Description: "Shea butter & coconut oil blend"
   - Scent options: Unscented, Vanilla, Lavender
   - Stock: 40 units

   **Category: Wellness Supplements**
   
   Product 9: Stress Relief Gummies
   - Price: $29
   - Description: "Ashwagandha + L-Theanine"
   - Count: 60 gummies (30-day supply)
   - Stock: 50 bottles
   
   Product 10: Sleep Support Drops
   - Price: $34
   - Description: "Melatonin + chamomile tincture"
   - Size: 2oz
   - Stock: 35 units

   **Category: Spa Tools**
   
   Product 11: Jade Facial Roller
   - Price: $42
   - Description: "Reduce puffiness, improve circulation"
   - Includes: Storage pouch
   - Stock: 20 units
   
   Product 12: Silk Sleep Mask
   - Price: $28
   - Description: "100% mulberry silk"
   - Color options: Rose, Champagne, Navy
   - Stock: 30 units

   **Category: Gift Sets**
   
   Product 13: Relaxation Ritual Kit
   - Price: $120
   - Includes:
     * Lavender candle
     * Bath salts
     * Essential oil
     * Silk sleep mask
   - Gift wrapped
   - Stock: 15 sets
   
   Product 14: Skincare Starter Set
   - Price: $180
   - Includes:
     * Cleanser
     * Serum
     * Moisturizer
     * Eye cream
   - Stock: 10 sets

4. **Product Features:**
   - High-quality product images
   - Detailed ingredient lists
   - Usage instructions
   - Customer reviews
   - Related products suggestions
   - "Complete the Look" bundles

**Customer Testing:**
1. Browse "Aromatherapy & Candles"
2. Select "Hand-Poured Soy Candle"
3. Choose scent: Lavender Dreams
4. Choose size: 16oz
5. Add to cart
6. Continue shopping
7. Add "Detox Bath Salts - 1kg"
8. View cart (2 items)
9. Apply member discount (if applicable)
10. Apply coupon code "RELAX20"
11. Checkout
12. Choose: Ship or In-Store Pickup
13. Complete payment
14. Receive order confirmation

**Staff Testing:**
1. Login as boutique staff
2. View pending orders
3. Process in-store pickup
4. Process shipping order
5. Update inventory after sale
6. Handle returns/exchanges
7. Restock products

**Admin Testing:**
1. Add new product
2. Create variants (size, scent, color)
3. Set pricing tiers
4. Upload product images
5. Write descriptions
6. Set inventory levels
7. Create discount code
8. View sales reports
9. Top sellers report
10. Low stock alerts
11. Create product bundles
12. Set up "Frequently Bought Together"

**Verification Checklist:**
- [ ] Module in navigation
- [ ] Categories display
- [ ] Products show with images
- [ ] Variants work correctly
- [ ] Add to cart works
- [ ] Cart calculates total + tax
- [ ] Coupons apply
- [ ] Member discounts apply
- [ ] Shipping vs pickup options
- [ ] Payment processes
- [ ] Order confirmation sent
- [ ] Staff can fulfill orders
- [ ] Inventory deducts
- [ ] Low stock alerts work
- [ ] Reports accurate
- [ ] Product reviews work
- [ ] Bundle pricing correct

---

## Phase 3: Role & Permission Testing

### Expected Automatic Changes:

**New Roles Created:**
- `spa-treatments_admin`
- `spa-treatments_staff` (therapists)
- `wellness-membership_admin`
- `wellness-membership_staff`
- `wellness-boutique_admin`
- `wellness-boutique_staff`

**New Permissions Created:**
- `spa-treatments:view_bookings`
- `spa-treatments:create_appointment`
- `spa-treatments:access_client_notes`
- `spa-treatments:manage_schedule`
- `wellness-membership:view_members`
- `wellness-membership:manage_subscriptions`
- `wellness-boutique:view_orders`
- `wellness-boutique:manage_products`
- (etc.)

### Testing Scenarios:

**Test 1: Therapist Access**
1. Create user: "Sophia Martinez" (Therapist)
2. Assign role: `spa-treatments_staff`
3. Sophia logs in
4. Verify she can:
   - View her appointment schedule
   - See client names and treatment types
   - Add treatment notes
   - View client history
5. Verify she CANNOT:
   - Access boutique
   - View membership admin
   - Change pricing
   - Delete appointments
   - Access financial reports

**Test 2: Boutique Manager**
1. Create user: "Lisa Chen" (Boutique Manager)
2. Assign role: `wellness-boutique_admin`
3. Lisa logs in
4. Verify she can:
   - Manage all products
   - View orders
   - Update inventory
   - Create discount codes
   - View boutique sales reports
5. Verify she CANNOT:
   - Access treatment bookings
   - View membership data
   - Access spa therapist schedules

**Test 3: Membership Coordinator**
1. Create user: "Mark Wilson"
2. Assign role: `wellness-membership_admin`
3. Mark logs in
4. Verify he can:
   - View all members
   - Manage subscriptions
   - Process upgrades/downgrades
   - View MRR reports
   - Handle cancellations
5. Verify he CANNOT:
   - Book spa treatments
   - Access boutique inventory
   - View therapist schedules

**Test 4: Multi-Role Staff**
1. Create user: "Jessica Park"
2. Assign roles: `spa-treatments_staff` + `wellness-boutique_staff`
3. Jessica logs in
4. Verify she can:
   - Perform treatments
   - Help customers in boutique
   - Process boutique sales
5. Verify she CANNOT:
   - Access membership admin
   - View financial reports
   - Change system settings

**Test 5: Super Admin**
1. Login as super admin
2. Verify full access to:
   - All 3 modules
   - All admin functions
   - System settings
   - User management

**Verification Checklist:**
- [ ] All roles auto-created
- [ ] Permissions granular and enforced
- [ ] Staff see only authorized modules
- [ ] Unauthorized actions blocked (403)
- [ ] Admin panel navigation adapts
- [ ] Sidebar shows only accessible modules
- [ ] Permission system has no bypass exploits

---

## Phase 4: Customer Experience Testing

### Customer Persona: "Stressed Executive Sarah"

**Journey 1: First Visit - Book Massage**
1. Land on homepage (spa branding)
2. Click "Book Now"
3. Browse spa treatments
4. Read about "Swedish Relaxation Massage"
5. Select 60 minutes
6. Choose therapist OR first available
7. Pick date/time
8. Create account
9. Add hot stones (+$30)
10. Complete payment
11. Receive confirmation + spa policies

**Verification:**
- [ ] Booking flow intuitive
- [ ] Treatment details clear
- [ ] Time selection works
- [ ] Add-ons priced correctly
- [ ] Account creation smooth
- [ ] Confirmation email received
- [ ] Calendar invite included

**Journey 2: Become Member**
1. Browse membership page
2. Compare tiers
3. Select "Wellness Enthusiast" ($179/month)
4. Enter payment info
5. Subscribe
6. Receive welcome email
7. View member portal (2 credits available)
8. Book massage using credit
9. View updated credits (1 remaining)

**Verification:**
- [ ] Tier comparison clear
- [ ] Subscription processes
- [ ] Credits issued correctly
- [ ] Booking with credit works
- [ ] Credit tracking accurate
- [ ] Member portal accessible
- [ ] Discounts auto-apply

**Journey 3: Shop Wellness Products**
1. Navigate to "Wellness Boutique"
2. Browse "Aromatherapy & Candles"
3. Select candle
4. Choose scent + size
5. Add to cart
6. Browse "Bath & Body"
7. Add bath salts
8. View cart
9. Apply member discount (auto)
10. Checkout with shipping
11. Receive order confirmation

**Verification:**
- [ ] Product browsing smooth
- [ ] Variants work correctly
- [ ] Cart updates accurately
- [ ] Member discount applies
- [ ] Shipping options present
- [ ] Payment processes
- [ ] Order confirmation sent
- [ ] Tracking info provided

**Journey 4: Full Spa Day Experience**
1. Book multiple treatments for same day:
   - 10 AM: Facial (90 min)
   - 12 PM: Lunch break
   - 1:30 PM: Massage (60 min)
   - 3 PM: Body wrap (90 min)
2. Receive single confirmation with itinerary
3. Add calendar event
4. Arrive at spa
5. Check-in (therapist marks as arrived)
6. Complete all treatments
7. Receive post-visit email (satisfaction survey)

**Verification:**
- [ ] Multiple bookings allowed
- [ ] Schedule prevents overlaps
- [ ] Combined confirmation sent
- [ ] Therapist can check in
- [ ] Post-visit follow-up works

**Journey 5: Gift Card Purchase**
1. Go to "Gift Cards"
2. Select amount ($200)
3. Enter recipient info
4. Add personal message
5. Choose delivery: Email or Physical
6. Purchase
7. Recipient receives gift card
8. Recipient redeems for treatment

**Verification:**
- [ ] Gift card purchase works
- [ ] Delivery options functional
- [ ] Recipient receives card
- [ ] Redemption process works
- [ ] Balance tracking accurate

---

## Phase 5: Admin Dashboard Testing

### Dashboard Metrics (Spa Context)

**Expected Dashboard:**
1. **Revenue Overview:**
   - Total revenue (all modules)
   - Revenue breakdown: Treatments, Memberships, Boutique
   - Daily/weekly/monthly comparisons

2. **Treatment Metrics:**
   - Appointments today/this week
   - Most popular treatments
   - Average service value
   - Therapist utilization %

3. **Membership Metrics:**
   - Active members count
   - MRR (Monthly Recurring Revenue)
   - New memberships this month
   - Churn rate
   - Credit utilization rate

4. **Boutique Metrics:**
   - Products sold
   - Top sellers
   - Inventory value
   - Low stock alerts

5. **Customer Metrics:**
   - New customers this week
   - Returning customer rate
   - Average customer lifetime value
   - Net promoter score (if surveys)

**Testing:**
1. Complete several bookings/purchases/memberships
2. View dashboard
3. Verify all metrics accurate
4. Export reports
5. Filter by date range
6. Compare module performance
7. View trends over time

**Verification Checklist:**
- [ ] Dashboard loads quickly
- [ ] All modules represented
- [ ] Metrics mathematically correct
- [ ] Charts render properly
- [ ] Export to CSV works
- [ ] Date filters work
- [ ] No calculation errors
- [ ] Revenue totals match ledger

---

## Phase 6: Integration Testing

### Test Cross-Module Workflows

**Workflow 1: Member Books Treatment**
1. Sarah (member) books massage
2. System checks: Does she have credits?
3. If yes: Deduct credit, no charge
4. If no: Apply member discount (15%), charge difference
5. Therapist sees booking with "Member" tag
6. After treatment, credit count updates

**Verification:**
- [ ] Credit check works
- [ ] Credit deduction accurate
- [ ] Discount applies when no credits
- [ ] Therapist sees member status
- [ ] Credit balance updates post-treatment

**Workflow 2: Product Purchase with Member Discount**
1. Member shops boutique
2. Adds products to cart
3. Member discount auto-applies (20%)
4. Checkout processes
5. Purchase counts toward loyalty tier upgrade?
6. Inventory deducts

**Verification:**
- [ ] Member status detected
- [ ] Discount auto-applies
- [ ] Multiple product discounts work
- [ ] Inventory updates correctly
- [ ] Loyalty points awarded (if enabled)

**Workflow 3: Gift Card to Treatment Booking**
1. Person receives $200 gift card
2. Clicks redemption link
3. Creates account (if new)
4. Gift card balance shows in account
5. Books treatment ($120)
6. Gift card balance deducts
7. Remaining: $80

**Verification:**
- [ ] Gift card redemption works
- [ ] Balance tracking accurate
- [ ] Partial redemption works
- [ ] Remaining balance persists
- [ ] Can use rest of balance later

---

## Phase 7: Real-Time & Notification Testing

### Test Socket.io Updates

**Scenario 1: Live Booking Notifications**
1. Customer books treatment
2. Admin dashboard shows notification instantly
3. Assigned therapist gets notification
4. Calendar updates in real-time

**Verification:**
- [ ] Admin notification appears
- [ ] Therapist notification appears
- [ ] Calendar refreshes without reload
- [ ] Sound alert plays (if enabled)

**Scenario 2: Low Stock Alert**
1. Product inventory hits threshold
2. Boutique manager receives alert
3. Admin dashboard shows alert badge

**Verification:**
- [ ] Alert triggers at correct threshold
- [ ] Notification sent to right people
- [ ] Alert badge appears
- [ ] Alert dismissal works

**Scenario 3: Membership Expiration Warning**
1. Membership expiring in 7 days
2. Member receives email reminder
3. Admin sees "Expiring Soon" list
4. Auto-renewal processes (if enabled)

**Verification:**
- [ ] 7-day warning sent
- [ ] Admin list accurate
- [ ] Auto-renewal works
- [ ] Failed payment handled gracefully

---

## Phase 8: Mobile Responsiveness

### Mobile Testing Checklist

**Actions:**
1. Resize to mobile (375px)
2. Test navigation menu
3. Browse treatments on mobile
4. Complete booking flow
5. Shop boutique on mobile
6. Checkout on mobile
7. View member portal on mobile
8. Staff schedule view on mobile

**Verification:**
- [ ] Hamburger menu works
- [ ] All forms usable on mobile
- [ ] Touch interactions smooth
- [ ] Images scale correctly
- [ ] No horizontal scroll
- [ ] Checkout completes
- [ ] Portal navigable
- [ ] Staff can use on tablet

---

## Phase 9: Edge Cases & Stress Testing

### Edge Case Tests

**Test 1: Overbooking Prevention**
1. Therapist has 60-min massage at 2 PM
2. Try to book same therapist:
   - 1:30 PM - 60 min (overlaps, should fail)
   - 3:00 PM - 60 min (no overlap, should succeed)

**Verification:**
- [ ] Overlapping booking blocked
- [ ] Clear error message
- [ ] Alternative suggestions offered

**Test 2: Membership Credit Expiration**
1. Member with 2 credits
2. Credits expire after 2 months
3. Month 1: Use 1 credit (1 remaining)
4. Month 2: Don't use
5. Month 3: Try to use expired credit

**Verification:**
- [ ] Credits track expiration
- [ ] Expired credits rejected
- [ ] User notified before expiration
- [ ] Expired credits removed from count

**Test 3: Simultaneous Boutique Purchases**
1. Product stock: 1 unit
2. User A adds to cart
3. User B adds to cart
4. User A checks out (succeeds)
5. User B checks out (should fail - out of stock)

**Verification:**
- [ ] Stock reserved during checkout
- [ ] Second user gets "out of stock" error
- [ ] No overselling
- [ ] Stock updates immediately

**Test 4: Refund After Partial Membership Use**
1. Member pays $179 for month
2. Uses 1 of 2 treatments
3. Requests refund mid-month

**Expected Behavior:**
- Prorated refund OR
- Credit for unused treatments OR
- No refund per policy

**Verification:**
- [ ] Refund logic clear
- [ ] Partial use tracked
- [ ] Refund amount calculated correctly
- [ ] Policy enforced

---

## Final Verification Summary

### Complete System Check:

| Component | Status | Notes |
|-----------|--------|-------|
| CMS Rebranding | ⬜ | Homepage, footer, pages, colors |
| Module 1: Treatments | ⬜ | Bookings, therapists, add-ons |
| Module 2: Membership | ⬜ | Subscriptions, credits, MRR |
| Module 3: Boutique | ⬜ | Products, variants, shipping |
| Roles & Permissions | ⬜ | Auto-created, enforced |
| Customer Experience | ⬜ | All flows smooth |
| Admin Dashboard | ⬜ | Metrics accurate |
| Staff Interface | ⬜ | Role-based access |
| Real-Time Updates | ⬜ | Notifications work |
| Mobile Responsive | ⬜ | All devices |
| Payments | ⬜ | Stripe + subscriptions |
| Emails | ⬜ | Confirmations, reminders |
| Gift Cards | ⬜ | Purchase, redeem |
| Cross-Module Integration | ⬜ | Credits, discounts |

---

## Success Criteria

✅ **PASS** if:
- Complete spa rebrand without code changes
- All 3 modules created and working
- Subscription/membership logic works
- Gift cards functional
- Roles auto-created and enforced
- Cross-module features work (member discounts)
- Real-time notifications function
- No resort/gym references remain
- System feels like native spa platform

❌ **FAIL** if:
- Hardcoded business logic prevents spa use
- Subscription module doesn't work
- Gift card system broken
- Member credits don't track
- Cross-module integration fails
- Therapist scheduling broken
- Boutique inventory issues

---

## Documentation Required

After testing, document:

1. **Seamless Features:**
   - What worked perfectly

2. **Manual Interventions:**
   - Hardcoded values changed
   - Custom code needed

3. **Bugs Found:**
   - Issues discovered during testing

4. **Time Investment:**
   - Hours to complete rebrand

5. **Business Model Adaptability:**
   - Can system handle subscription model?
   - Can it handle appointment-based services?
   - Can it handle retail + services hybrid?

6. **Comparison to Scenario 1 (Gym):**
   - What was easier in spa vs gym?
   - What was harder?
   - Which business model fits better?

---

## Expected Outcome

If both Scenario 1 (Gym) and Scenario 2 (Spa) pass:
- ✅ System is truly modular and white-label ready
- ✅ Can serve ANY service-based business
- ✅ Module builder is production-grade
- ✅ CMS is fully flexible
- ✅ Roles/permissions scale properly
- ✅ Buyer pool increases 100x

**Market Potential:**
- Gyms/Fitness Centers
- Spas/Wellness Centers
- Salons/Barbershops
- Yoga/Pilates Studios
- Dance Studios
- Martial Arts Dojos
- Medical Spas
- Physical Therapy Clinics
- Massage Therapy Centers
- Beauty Clinics
- Pet Grooming/Boarding
- Coworking Spaces
- Event Venues
- Educational Centers
- Recreational Facilities

**This transforms from a "resort system" to a "universal service business platform" worth 10x more.**
