# Scenario 1: Complete Rebranding to "Iron Paradise Gym"

## Mission
Transform the V2 Resort platform into a complete gym/fitness center management system. This will test:
- CMS flexibility for complete rebranding
- Module builder creating gym-specific modules
- Admin panel adapting to new business model
- Staff roles and permissions system
- Customer-facing functionality for all new modules

---

## Phase 1: CMS Rebranding (Test CMS Flexibility)

### Step 1.1: Homepage Transformation
**Goal:** Rebrand from resort to gym

**Actions:**
1. **Hero Section:**
   - Title: "Transform Your Body at Iron Paradise Gym"
   - Subtitle: "Premium Fitness Center | Personal Training | Group Classes"
   - Background Image: Replace with gym equipment/workout imagery
   - CTA Button: "Start Your Fitness Journey" → Link to membership signup

2. **Features Section:**
   - Replace resort features with gym features:
     * "State-of-the-Art Equipment" (replace chalets)
     * "Expert Personal Trainers" (replace restaurant)
     * "Group Fitness Classes" (replace pool)
   - Update icons to fitness-related icons
   - Update descriptions

3. **Stats Section:**
   - "500+ Active Members" (replace guests)
   - "50+ Classes Per Week" (replace bookings)
   - "24/7 Access Available" (replace rooms)
   - "15 Personal Trainers" (replace staff)

4. **Testimonials:**
   - Replace resort testimonials with gym member testimonials
   - Names: "Mike Johnson - Lost 30lbs", "Sarah Chen - Marathon Ready"
   - Update review content to fitness transformations

5. **Weather Widget:**
   - Remove or replace with "Gym Status: Open 24/7"

**Verification Checklist:**
- [ ] Hero section displays gym branding
- [ ] All text is fitness-related
- [ ] Images updated (or placeholders)
- [ ] CTA buttons work
- [ ] Stats show gym metrics
- [ ] Testimonials show fitness stories
- [ ] No resort references remain

---

### Step 1.2: Footer & Branding
**Goal:** Complete brand identity change

**Actions:**
1. **Footer Links:**
   - "About Iron Paradise" (replace About Resort)
   - "Membership Plans" (replace Rooms)
   - "Class Schedule" (replace Activities)
   - "Personal Training" (replace Dining)
   - "Contact Us" (keep)

2. **Social Media:**
   - Update links to gym social profiles
   - Keep Instagram, Facebook, Twitter

3. **Contact Info:**
   - Update address: "123 Fitness Boulevard, Los Angeles, CA"
   - Phone: "+1 (555) GYM-LIFT"
   - Email: "info@ironparadisegym.com"

4. **Logo/Branding:**
   - Upload gym logo (or use text: "IRON PARADISE")
   - Primary Color: Deep Red (#C41E3A)
   - Secondary Color: Charcoal (#36454F)
   - Accent: Gold (#FFD700)

**Verification Checklist:**
- [ ] Footer links all updated
- [ ] Contact info changed
- [ ] Brand colors applied
- [ ] Logo uploaded/displayed
- [ ] Social links updated

---

### Step 1.3: Pages & Navigation
**Goal:** Create gym-specific pages

**Actions:**
1. **Create New Pages:**
   - "About Us" - Gym story, mission, values
   - "Membership Plans" - Different tier pricing
   - "Trainers" - Staff bios
   - "Class Schedule" - Weekly timetable
   - "Facilities" - Equipment list, amenities

2. **Update Navigation:**
   - Home
   - Classes (will link to Module 1)
   - Personal Training (will link to Module 2)
   - Nutrition Store (will link to Module 3)
   - Schedule
   - Membership
   - Contact

**Verification Checklist:**
- [ ] All pages created
- [ ] Navigation menu updated
- [ ] Pages are accessible
- [ ] Content is fitness-focused
- [ ] Links work correctly

---

## Phase 2: Module Creation (Test Module Builder)

### Module 1: Group Fitness Classes (Booking Template)
**Template Used:** Booking/Sessions (like Pool Management)

**Configuration:**
1. **Module Details:**
   - Name: "Group Fitness Classes"
   - Slug: `fitness-classes`
   - Icon: Dumbbell
   - Description: "Book your spot in yoga, spin, HIIT, and more"
   - Template: Booking with Sessions

2. **Create Sessions (Examples):**
   
   **Session 1: Morning Yoga**
   - Time Slot: Mon/Wed/Fri 6:00 AM - 7:00 AM
   - Capacity: 20 people
   - Instructor: "Sarah Chen"
   - Price: $15 per class
   - Type: Yoga
   - Equipment: "Bring your mat"
   
   **Session 2: Spin Class**
   - Time Slot: Tue/Thu 6:00 PM - 7:00 PM
   - Capacity: 25 people
   - Instructor: "Mike Rodriguez"
   - Price: $20 per class
   - Type: Cardio
   - Equipment: "Bikes provided"
   
   **Session 3: HIIT Training**
   - Time Slot: Mon/Wed/Fri 7:00 PM - 8:00 PM
   - Capacity: 15 people
   - Instructor: "Alex Turner"
   - Price: $25 per class
   - Type: Strength
   - Equipment: "All provided"

3. **Booking Rules:**
   - Can book up to 7 days in advance
   - Cancel up to 2 hours before class
   - No-show penalty: $5
   - Drop-in allowed (if space available)

**Customer Testing:**
1. Browse class schedule
2. Select "Morning Yoga"
3. Choose date (tomorrow)
4. Add to cart
5. Complete payment
6. Receive confirmation email
7. Check "My Bookings"

**Staff Testing:**
1. Staff logs in as instructor
2. Views assigned classes
3. Marks attendance (check-in members)
4. Closes class session
5. Views class history

**Admin Testing:**
1. Create new class type
2. Assign instructor
3. Set pricing
4. View attendance reports
5. Cancel class (test notifications)
6. Check revenue by class type

**Verification Checklist:**
- [ ] Module appears in navigation
- [ ] Classes display correctly
- [ ] Booking flow works end-to-end
- [ ] Payment processes
- [ ] Email confirmations sent
- [ ] Staff can check in members
- [ ] Admin can create/edit classes
- [ ] Reports show class revenue
- [ ] Cancellation policy enforced
- [ ] Capacity limits respected

---

### Module 2: Personal Training Sessions (Custom Booking Template)
**Template Used:** Booking/Appointments (like Chalet but for time slots)

**Configuration:**
1. **Module Details:**
   - Name: "Personal Training"
   - Slug: `personal-training`
   - Icon: User
   - Description: "One-on-one sessions with certified trainers"
   - Template: Booking with Staff Assignment

2. **Create Trainer Profiles:**
   
   **Trainer 1: Sarah Chen**
   - Specialty: Weight Loss & Nutrition
   - Rate: $80/hour
   - Available: Mon-Fri 8 AM - 6 PM
   - Bio: "10 years experience, NASM certified"
   
   **Trainer 2: Mike Rodriguez**
   - Specialty: Strength Training & Bodybuilding
   - Rate: $100/hour
   - Available: Tue-Sat 10 AM - 8 PM
   - Bio: "Former pro athlete, champion coach"
   
   **Trainer 3: Alex Turner**
   - Specialty: Athletic Performance
   - Rate: $90/hour
   - Available: Mon-Sun 6 AM - 2 PM
   - Bio: "Sports science degree, Olympic trainer"

3. **Session Types:**
   - Single Session: $80-$100 (trainer rate)
   - 5-Pack: 10% discount
   - 10-Pack: 20% discount
   - Monthly Unlimited: $600

4. **Booking Rules:**
   - 1-hour minimum
   - Book up to 30 days in advance
   - Cancel 24 hours before (full refund)
   - Late cancel (<24hr): 50% charge
   - No-show: full charge

**Customer Testing:**
1. Browse trainers
2. Select "Sarah Chen"
3. Choose date & time
4. Select session package (5-pack)
5. Complete payment
6. Receive confirmation
7. Reschedule appointment (test cancellation policy)

**Staff Testing:**
1. Trainer logs in
2. Views upcoming sessions
3. Marks client as attended
4. Adds session notes
5. Views client history
6. Sets unavailable dates

**Admin Testing:**
1. Add new trainer
2. Set rates and availability
3. Create package deals
4. View trainer utilization
5. Revenue by trainer report
6. Handle customer complaints

**Verification Checklist:**
- [ ] Module in navigation
- [ ] Trainer profiles display
- [ ] Booking calendar works
- [ ] Package discounts apply
- [ ] Payment processes
- [ ] Cancellation policy enforced
- [ ] Trainers can manage schedule
- [ ] Session notes saved
- [ ] Reports show revenue by trainer
- [ ] Scheduling conflicts prevented

---

### Module 3: Nutrition Store (Menu/E-commerce Template)
**Template Used:** Menu/Products (like Restaurant)

**Configuration:**
1. **Module Details:**
   - Name: "Nutrition Store"
   - Slug: `nutrition-store`
   - Icon: Shopping Cart
   - Description: "Supplements, protein, healthy snacks"
   - Template: Menu/Products

2. **Create Categories:**
   - Protein Supplements
   - Pre-Workout
   - Vitamins & Recovery
   - Healthy Snacks
   - Gym Gear

3. **Create Products (Examples):**

   **Category: Protein Supplements**
   
   Product 1: Whey Protein Isolate
   - Price: $49.99
   - Description: "25g protein per serving, chocolate flavor"
   - Stock: 50 units
   - Image: Protein powder container
   - Modifiers:
     * Size: 1lb ($49.99), 2lb ($89.99), 5lb ($199.99)
     * Flavor: Chocolate, Vanilla, Strawberry
   
   Product 2: Plant-Based Protein
   - Price: $54.99
   - Description: "Vegan protein, pea & rice blend"
   - Stock: 30 units
   - Modifiers:
     * Size: 1lb ($54.99), 2lb ($99.99)
     * Flavor: Chocolate, Vanilla
   
   **Category: Pre-Workout**
   
   Product 3: Extreme Energy Pre-Workout
   - Price: $39.99
   - Description: "300mg caffeine, focus blend"
   - Stock: 40 units
   - Modifiers:
     * Flavor: Fruit Punch, Blue Razz, Green Apple

   **Category: Healthy Snacks**
   
   Product 4: Protein Bar Box
   - Price: $29.99
   - Description: "12-pack, 20g protein per bar"
   - Stock: 100 units
   - Modifiers:
     * Flavor: Chocolate Chip, Peanut Butter, Cookie Dough

   **Category: Gym Gear**
   
   Product 5: Lifting Straps
   - Price: $14.99
   - Description: "Padded wrist support"
   - Stock: 25 units
   
   Product 6: Gym Bag
   - Price: $39.99
   - Description: "Water-resistant, 30L capacity"
   - Stock: 15 units

4. **Inventory Setup:**
   - Link products to inventory system
   - Set low stock alerts
   - Track cost vs sale price

**Customer Testing:**
1. Browse categories
2. Select "Whey Protein Isolate"
3. Choose size: 2lb
4. Choose flavor: Chocolate
5. Add to cart
6. Add "Protein Bar Box" (Cookie Dough)
7. View cart
8. Apply discount code (if available)
9. Checkout and pay
10. Receive order confirmation
11. Check order status

**Staff Testing:**
1. Staff logs in as store clerk
2. Views incoming orders
3. Marks order as "Picked"
4. Marks order as "Ready for Pickup"
5. Completes handoff
6. Checks inventory levels

**Admin Testing:**
1. Add new product
2. Create modifiers (size, flavor)
3. Set pricing tiers
4. Update stock levels
5. Create discount coupon
6. View sales reports
7. Check low stock alerts
8. Analyze best sellers

**Verification Checklist:**
- [ ] Module in navigation
- [ ] Categories display
- [ ] Products show correctly
- [ ] Modifiers work (size, flavor)
- [ ] Add to cart works
- [ ] Cart displays total correctly
- [ ] Checkout processes payment
- [ ] Order confirmation sent
- [ ] Staff can fulfill orders
- [ ] Inventory deducts on purchase
- [ ] Low stock alerts trigger
- [ ] Reports show sales data
- [ ] Modifiers affect price correctly
- [ ] Image upload works

---

## Phase 3: Role & Permission Testing

### Expected Automatic Changes:
When modules are created, the system should automatically:

1. **Create Roles:**
   - `fitness-classes_admin`
   - `fitness-classes_staff`
   - `personal-training_admin`
   - `personal-training_staff`
   - `nutrition-store_admin`
   - `nutrition-store_staff`

2. **Create Permissions:**
   - `fitness-classes:view_bookings`
   - `fitness-classes:create_session`
   - `fitness-classes:mark_attendance`
   - `personal-training:view_appointments`
   - `personal-training:manage_schedule`
   - `nutrition-store:view_orders`
   - `nutrition-store:manage_inventory`
   - (etc.)

### Testing Steps:

**Test 1: Create Staff User**
1. Admin creates new user: "John Trainer"
2. Assign role: `personal-training_staff`
3. John logs in
4. Verify he can ONLY:
   - View his personal training schedule
   - Mark attendance
   - Add session notes
5. Verify he CANNOT:
   - Access fitness classes
   - Access nutrition store
   - View admin reports
   - Delete modules

**Test 2: Create Multi-Module Staff**
1. Admin creates user: "Jane Manager"
2. Assign roles: `fitness-classes_admin` + `nutrition-store_admin`
3. Jane logs in
4. Verify she can:
   - Manage fitness classes fully
   - Manage nutrition store fully
5. Verify she CANNOT:
   - Access personal training module
   - Delete the gym modules
   - Change system settings

**Test 3: Super Admin**
1. Login as super admin
2. Verify access to ALL modules
3. Verify can create/delete modules
4. Verify can assign any role

**Verification Checklist:**
- [ ] New roles created automatically
- [ ] Permissions are granular per module
- [ ] Staff only sees their assigned modules
- [ ] Permission checks actually work (try unauthorized actions)
- [ ] Admin panel navigation updates based on roles
- [ ] Sidebar shows only accessible modules
- [ ] Unauthorized routes return 403

---

## Phase 4: Customer Experience Testing

### Customer Persona: "Fitness Newbie Mike"

**Journey 1: Join and Book First Class**
1. Visit homepage (see gym branding)
2. Click "Classes" in navigation
3. Browse class schedule
4. Select "Morning Yoga"
5. Create account (email signup)
6. Complete booking
7. Receive confirmation email
8. Add to calendar

**Verification:**
- [ ] Signup flow works
- [ ] Booking successful
- [ ] Email received
- [ ] Calendar link works
- [ ] Shows in "My Bookings"

**Journey 2: Book Personal Training**
1. Log in
2. Navigate to "Personal Training"
3. Compare trainers
4. Select trainer based on specialty
5. Choose 5-pack for discount
6. Book first session
7. Receive confirmation

**Verification:**
- [ ] Trainer profiles display
- [ ] 5-pack discount applied
- [ ] Session booked
- [ ] Confirmation sent
- [ ] Shows sessions remaining (4/5)

**Journey 3: Shop Nutrition Store**
1. Navigate to "Nutrition Store"
2. Browse "Protein Supplements"
3. Add "Whey Protein - 2lb - Chocolate"
4. Browse "Healthy Snacks"
5. Add "Protein Bars - Cookie Dough"
6. View cart
7. Apply coupon "NEWMEMBER10"
8. Checkout
9. Receive order confirmation

**Verification:**
- [ ] Products display with images
- [ ] Modifiers work correctly
- [ ] Cart calculates total
- [ ] Coupon applies discount
- [ ] Payment processes
- [ ] Order confirmation received
- [ ] Can track order status

**Journey 4: Manage Profile**
1. Go to "My Account"
2. Update profile picture
3. Add fitness goals
4. View booking history
5. View purchase history
6. Download invoices

**Verification:**
- [ ] Profile updates save
- [ ] Booking history shows all 3 modules
- [ ] Purchase history accurate
- [ ] Invoices downloadable

---

## Phase 5: Admin Dashboard Testing

### Dashboard Metrics (Should Update to Gym Context)

**Expected Dashboard:**
1. **Revenue Overview:**
   - Total revenue (all modules)
   - Revenue by module
   - Revenue by day/week/month

2. **Membership Stats:**
   - Active members
   - New signups this week
   - Churn rate

3. **Class Metrics:**
   - Classes this week
   - Average attendance
   - Popular classes

4. **Training Metrics:**
   - Personal training sessions booked
   - Revenue by trainer
   - Client retention

5. **Store Metrics:**
   - Products sold
   - Top sellers
   - Inventory alerts

**Testing:**
1. View dashboard after all bookings/purchases
2. Verify all metrics display correctly
3. Export reports to CSV
4. Filter by date range
5. Compare module performance

**Verification Checklist:**
- [ ] Dashboard loads
- [ ] All modules shown in revenue breakdown
- [ ] Metrics accurate (match manual count)
- [ ] Charts render correctly
- [ ] Export works
- [ ] Date filtering works
- [ ] No errors in console

---

## Phase 6: Real-Time Features Testing

### Test Socket.io / Real-Time Updates

**Scenario: Class Booking with Live Updates**
1. Customer A books "Morning Yoga" (19/20 spots)
2. Admin B (in another browser) should see:
   - Booking notification
   - Updated capacity (19/20)
3. Customer C tries to book remaining spot
4. Admin B sees capacity hit 20/20
5. Customer D tries to book → should see "Class Full"

**Verification:**
- [ ] Admin receives real-time booking notification
- [ ] Capacity updates instantly
- [ ] "Full" status prevents overbooking
- [ ] Waitlist offers to join (if enabled)

**Scenario: Store Order Status Update**
1. Customer orders protein powder
2. Staff marks as "Preparing"
3. Customer dashboard updates in real-time
4. Staff marks as "Ready for pickup"
5. Customer gets notification

**Verification:**
- [ ] Status updates in real-time
- [ ] Customer sees progress
- [ ] Notifications trigger
- [ ] No page refresh needed

---

## Phase 7: Mobile Responsiveness

### Test on Mobile Viewports

**Actions:**
1. Resize browser to mobile (375px width)
2. Test navigation (hamburger menu)
3. Book a class on mobile
4. Add product to cart on mobile
5. Checkout on mobile
6. View booking history on mobile

**Verification Checklist:**
- [ ] Navigation collapses to hamburger
- [ ] All forms work on mobile
- [ ] Touch interactions work
- [ ] Images scale appropriately
- [ ] Checkout flow completes
- [ ] No horizontal scroll

---

## Final Verification Summary

### Complete System Check:

| Component | Status | Notes |
|-----------|--------|-------|
| CMS Rebranding | ⬜ | Homepage, footer, pages |
| Module 1: Classes | ⬜ | Booking, payments, attendance |
| Module 2: Training | ⬜ | Appointments, trainer management |
| Module 3: Store | ⬜ | Products, modifiers, checkout |
| Roles & Permissions | ⬜ | Auto-created, enforced |
| Customer Experience | ⬜ | All 3 modules usable |
| Admin Dashboard | ⬜ | Metrics update correctly |
| Staff Interface | ⬜ | Role-based access works |
| Real-Time Updates | ⬜ | Socket.io notifications |
| Mobile Responsive | ⬜ | All flows work on mobile |
| Payments | ⬜ | Stripe integration works |
| Emails | ⬜ | Confirmations sent |

---

## Success Criteria

✅ **PASS** if:
- All CMS changes apply without code changes
- All 3 modules created and functional
- Roles auto-created and enforced
- Customers can book/purchase across all modules
- Staff access is properly restricted
- Admin can manage everything
- No resort references remain
- System feels like a native gym platform

❌ **FAIL** if:
- Hardcoded resort references remain
- Module builder creates broken modules
- Permissions don't work
- Customer flows break
- Staff can access unauthorized modules
- Admin dashboard doesn't update
- Payment processing fails

---

## Documentation Required

After testing, document:
1. **What Worked Seamlessly:**
   - List features that worked without issues
2. **What Required Manual Intervention:**
   - Any hardcoded values that needed changing
3. **What Broke:**
   - Bugs found during testing
4. **Time Taken:**
   - How long did complete rebranding take?
5. **Conclusion:**
   - Is the system truly modular and rebrandable?

---

**Expected Outcome:** If this test passes, it proves the V2 platform can be sold as a white-label solution for ANY service business (gyms, spas, salons, etc.), not just resorts. This 10x increases the potential buyer pool.
