# End-to-End Feature Testing Plan

## Test Execution Plan

### Phase 1: Environment Setup
- [ ] Start backend server
- [ ] Start frontend server
- [ ] Verify database connection
- [ ] Check health endpoints

### Phase 2: Guest Features Testing

#### Multi-Language & Currency
- [ ] Test language switcher (EN → AR → FR)
- [ ] Verify RTL layout in Arabic
- [ ] Test currency switcher (USD → EUR → LBP)
- [ ] Verify price conversion

#### Restaurant Module
- [ ] Browse menu
- [ ] Filter by category
- [ ] Search items
- [ ] View item details (photos, allergens)
- [ ] Add items to cart
- [ ] Adjust quantities
- [ ] Select order type (Dine-in/Takeaway/Delivery)
- [ ] Place order
- [ ] View order confirmation
- [ ] Check QR code generation

#### Snack Bar Module
- [ ] Browse snack menu
- [ ] Add items to cart
- [ ] Place order
- [ ] View confirmation

#### Chalet Module
- [ ] Browse chalets
- [ ] View chalet details
- [ ] Check availability calendar
- [ ] Select dates
- [ ] View dynamic pricing (weekday/weekend)
- [ ] Add add-ons (airport transfer, cleaning, BBQ)
- [ ] Calculate total
- [ ] Make booking
- [ ] View booking confirmation with QR code

#### Pool Module
- [ ] View pool sessions
- [ ] Check capacity
- [ ] Select session
- [ ] Purchase ticket
- [ ] View ticket with QR code

#### Cart Management
- [ ] Add items from different modules
- [ ] Remove items
- [ ] Update quantities
- [ ] View totals
- [ ] Checkout from cart

#### Reviews
- [ ] Submit review with rating
- [ ] Verify pending status
- [ ] Check review appears (after approval)

### Phase 3: Staff Features Testing

#### Restaurant Staff
- [ ] Login as restaurant staff
- [ ] View kitchen display
- [ ] See new orders appear
- [ ] Update order status (Pending → Preparing → Ready)
- [ ] Verify real-time updates
- [ ] Check order details
- [ ] View order history

#### Snack Bar Staff
- [ ] Login as snack staff
- [ ] View snack orders
- [ ] Update order status
- [ ] Verify module isolation

#### Pool Staff
- [ ] Login as pool staff
- [ ] View pool tickets
- [ ] Use QR scanner
- [ ] Validate ticket
- [ ] Check capacity updates
- [ ] View entry log

#### Chalet Staff
- [ ] Login as chalet staff
- [ ] View check-in dashboard
- [ ] See daily arrivals
- [ ] Check payment status
- [ ] View special requests
- [ ] Process check-in
- [ ] Process check-out
- [ ] Update booking status

### Phase 4: Admin Features Testing

#### Dashboard
- [ ] Login as admin
- [ ] View dashboard statistics
- [ ] Check revenue metrics
- [ ] View recent orders
- [ ] Check booking counts

#### Module Management
- [ ] View all modules
- [ ] Enable/disable modules
- [ ] Create new module (Menu Service template)
- [ ] Create new module (Multi-Day Booking template)
- [ ] Create new module (Session Access template)
- [ ] Edit module settings
- [ ] Verify module appears in navigation

#### Menu/Inventory Management
- [ ] View restaurant menu
- [ ] Add new category
- [ ] Edit category
- [ ] Delete category
- [ ] Add new menu item
- [ ] Upload item photo
- [ ] Set allergens
- [ ] Set dietary tags (vegetarian, vegan, gluten-free)
- [ ] Set pricing
- [ ] Toggle availability
- [ ] Edit item
- [ ] Delete item
- [ ] Test multi-language names

#### Booking Management
- [ ] View all bookings
- [ ] Filter bookings
- [ ] View booking details
- [ ] Update booking status
- [ ] Manage pricing rules
- [ ] Add seasonal pricing
- [ ] Block dates
- [ ] Manage add-ons

#### Reports & Analytics
- [ ] View overview report
- [ ] Check revenue by module
- [ ] View occupancy report
- [ ] Check customer analytics
- [ ] Export data (CSV/JSON)
- [ ] Change date range
- [ ] View time-series charts

#### Review Management
- [ ] View all reviews
- [ ] See pending reviews
- [ ] Approve review
- [ ] Reject review
- [ ] Check average ratings
- [ ] Filter by service type

#### Footer CMS
- [ ] Access footer settings
- [ ] Edit logo text
- [ ] Add/remove columns
- [ ] Add/remove links
- [ ] Configure social media
- [ ] Update copyright
- [ ] Save changes
- [ ] Verify changes on frontend

#### Appearance Settings
- [ ] Access appearance settings
- [ ] Change theme (Beach → Mountain → Sunset)
- [ ] Verify theme changes
- [ ] Change weather effect
- [ ] Toggle animations
- [ ] Toggle sound effects
- [ ] Change color palette
- [ ] Save changes
- [ ] Verify changes apply

#### Database Backups
- [ ] Access backup settings
- [ ] Create manual backup
- [ ] View backup history
- [ ] Check backup status
- [ ] Download backup
- [ ] Verify backup contains data

#### User Management
- [ ] View all users
- [ ] Create new user
- [ ] Assign roles
- [ ] Set permissions
- [ ] Edit user
- [ ] Deactivate user

#### Settings
- [ ] Change site name
- [ ] Update logo
- [ ] Configure email templates
- [ ] Set business hours
- [ ] Configure payment methods

### Phase 5: Real-Time Features
- [ ] Test Socket.io connection
- [ ] Place order and verify real-time update in kitchen
- [ ] Update order status and verify real-time update
- [ ] Test capacity updates in pool
- [ ] Verify notifications

### Phase 6: Payment Testing
- [ ] Test Stripe payment intent creation
- [ ] Verify payment webhook handling
- [ ] Test cash payment recording
- [ ] Check payment status updates

### Phase 7: Email Testing
- [ ] Test order confirmation email
- [ ] Test booking confirmation email
- [ ] Test password reset email
- [ ] Verify email templates

## Test Results Documentation

For each test, document:
- ✅ Pass / ❌ Fail
- Screenshot (if applicable)
- Error messages (if any)
- Actual behavior vs expected
- Notes

## Issues Found

Document any:
- Missing features
- Broken functionality
- UI/UX issues
- Performance problems
- Error messages
