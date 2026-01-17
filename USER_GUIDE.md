# V2 Resort Management System - Complete User Guide

## 🚀 Quick Start

### System Overview
The V2 Resort system consists of:
- **Customer Website** (Main application)
- **Staff Portal** (Operational dashboards)
- **Admin Dashboard** (Management interface)

### Access URLs

#### Development Environment
- **Customer Website**: http://localhost:3002
- **Staff Portal**: http://localhost:3002/staff
- **Admin Dashboard**: http://localhost:3002/admin
- **Backend API**: http://localhost:3001

#### Production Environment
- **Customer Website**: https://v2resort.com
- **Staff Portal**: https://v2resort.com/staff
- **Admin Dashboard**: https://v2resort.com/admin

---

## 👥 User Roles & Access

### 1. Public Users (No Login Required)
**What they can do:**
- Browse restaurant menu
- View chalet listings
- Check pool schedule
- Read about the resort
- Create an account

**Access:** Visit http://localhost:3002

---

### 2. Registered Customers
**What they can do:**
- All public user features, plus:
- Place restaurant and snack bar orders
- Book chalets
- Purchase pool tickets
- View order/booking history
- Save payment methods
- Manage profile
- Receive notifications

**How to access:**
1. Go to http://localhost:3002
2. Click "Login" or "Register" in the top right
3. After registration, confirm your email
4. Login with your credentials

**Test Account:**
- Email: `customer@test.com`
- Password: `password123`

---

### 3. Restaurant Staff
**What they can do:**
- View all restaurant orders
- Update order status (pending → preparing → ready → served)
- Print kitchen tickets
- Manage table status
- Toggle menu item availability
- View daily reports for restaurant

**How to access:**
1. Go to http://localhost:3002/staff
2. Login with staff credentials
3. Dashboard shows kitchen display board automatically

**Test Account:**
- Email: `restaurant.staff@v2resort.com`
- Password: `staff123`
- Role: `restaurant_staff`

**Main Features:**
- **Kitchen Display**: Real-time order board with color-coded wait times
  - Green: < 10 minutes
  - Yellow: 10-20 minutes
  - Red: > 20 minutes
- **Order Management**: Update status with one click
- **Table Status**: Mark tables as occupied/available/needs cleaning
- **Quick Actions**: Print tickets, contact customers

---

### 4. Snack Bar Staff
**What they can do:**
- View snack bar orders
- Update order status
- Mark items as available/unavailable
- View daily reports for snack bar

**How to access:**
1. Go to http://localhost:3002/staff
2. Login with snack staff credentials
3. Access snack bar dashboard

**Test Account:**
- Email: `snack.staff@v2resort.com`
- Password: `staff123`
- Role: `snack_staff`

---

### 5. Chalet Staff
**What they can do:**
- View all chalet bookings
- Check-in / check-out guests
- Create maintenance requests
- View chalet schedule/calendar
- Update booking details
- Add internal notes
- View reports for chalets

**How to access:**
1. Go to http://localhost:3002/staff
2. Login with chalet staff credentials
3. Access chalet management dashboard

**Test Account:**
- Email: `chalet.staff@v2resort.com`
- Password: `staff123`
- Role: `chalet_staff`

**Main Features:**
- **Calendar View**: See all bookings at a glance
- **Check-in Process**: Scan QR code or manual entry
- **Maintenance**: Log cleaning and repairs
- **Booking Details**: Full customer and payment info

---

### 6. Pool Staff
**What they can do:**
- Scan pool tickets at entrance
- View current capacity
- Log manual occupancy counts
- View ticket bookings
- Check session schedules

**How to access:**
1. Go to http://localhost:3002/staff
2. Login with pool staff credentials
3. Access pool management dashboard

**Test Account:**
- Email: `pool.staff@v2resort.com`
- Password: `staff123`
- Role: `pool_staff`

**Main Features:**
- **QR Scanner**: Camera-based ticket validation
- **Capacity Dashboard**: Live occupancy tracking
- **Session Management**: View and manage pool sessions

---

### 7. Business Unit Admins
Each business unit (Restaurant, Chalets, Pool) can have an admin with full control over their unit.

**What they can do:**
- All staff permissions for their unit
- Manage menu/inventory/pricing
- Configure business rules
- View detailed analytics
- Manage staff within their unit
- Approve refunds
- Export reports

**How to access:**
1. Go to http://localhost:3002/admin
2. Login with unit admin credentials
3. Access shows only their business unit

**Test Accounts:**
- Restaurant Admin: `restaurant.admin@v2resort.com` / `admin123`
- Chalet Admin: `chalet.admin@v2resort.com` / `admin123`
- Pool Admin: `pool.admin@v2resort.com` / `admin123`

---

### 8. Super Admin
**What they can do:**
- **EVERYTHING** - full system access
- Manage all users and roles
- System-wide settings
- Global analytics across all units
- Audit logs
- Database backups
- Create/modify staff accounts

**How to access:**
1. Go to http://localhost:3002/admin
2. Login with super admin credentials
3. Full dashboard with all units visible

**Test Account:**
- Email: `admin@v2resort.com`
- Password: `admin123`
- Role: `super_admin`

**Main Features:**
- **Global Dashboard**: Revenue, orders, bookings across all units
- **User Management**: Create staff, assign roles, manage permissions
- **Reports**: Export data, financial reports, analytics
- **Settings**: Configure payment methods, notifications, system behavior
- **Audit Logs**: Track all system changes

---

## 🌍 Multi-Language Support

The system supports 3 languages:
- **English** 🇬🇧 (Default)
- **Arabic** 🇱🇧 (with RTL layout)
- **French** 🇫🇷

**How to change language:**
1. Look for the language switcher in the top navigation (globe icon)
2. Click and select your preferred language
3. The entire interface updates immediately
4. Language preference is saved in cookies

**For Arabic:**
- Layout automatically flips to Right-to-Left
- Arabic font (Noto Sans Arabic) loads
- All text, buttons, and forms display in Arabic

---

## 🎨 Theme Support

The system supports Light, Dark, and System themes.

**How to change theme:**
1. Look for the theme toggle in the top navigation (sun/moon icon)
2. Click to cycle through:
   - ☀️ Light Mode
   - 🌙 Dark Mode
   - 💻 System (follows your OS preference)
3. Theme preference is saved

**Dark Mode includes:**
- All pages and components
- Forms and inputs
- Cards and tables
- Charts and graphs
- Proper contrast for accessibility

---

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (or Supabase account)
- npm or yarn

### Backend Setup
```bash
cd v2-resort/backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run dev
```

Backend runs on: http://localhost:3001

### Frontend Setup
```bash
cd v2-resort/frontend
npm install
npm run dev
```

Frontend runs on: http://localhost:3002 (or next available port)

### Database Setup
1. Create Supabase project or local PostgreSQL database
2. Run migration SQL from `backend/migrations/migration.sql`
3. Seed data will create:
   - 9 default roles
   - Sample menu items
   - Test user accounts

---

## 📱 Customer Workflows

### Ordering Food (Restaurant)
1. Go to http://localhost:3002/restaurant
2. Browse menu by category
3. Click items to add to cart
4. Review cart (shows in top right)
5. Click "Checkout"
6. Enter table number (for dine-in) or contact info
7. Add special instructions if needed
8. Select payment method
9. Place order
10. Track order status in real-time

### Booking a Chalet
1. Go to http://localhost:3002/chalets
2. Browse available chalets
3. Select check-in and check-out dates
4. Choose number of guests
5. Add any extras (breakfast, cleaning, etc.)
6. Enter contact information
7. Review booking summary
8. Complete payment
9. Receive booking confirmation with QR code
10. Show QR code at check-in

### Buying Pool Tickets
1. Go to http://localhost:3002/pool
2. Select session date
3. Choose time slot
4. Enter number of people
5. Provide contact info
6. Complete payment
7. Receive digital ticket with QR code
8. Show QR code at pool entrance

---

## 👨‍💼 Staff Workflows

### Kitchen Staff - Processing Orders
1. Login at http://localhost:3002/staff
2. Kitchen board shows all active orders
3. New orders flash and play sound alert
4. Click "Confirm" when you see the order
5. Click "Preparing" when you start cooking
6. Click "Ready" when order is complete
7. Customer receives automatic notification
8. Order moves to completed

### Chalet Staff - Check-in Process
1. Login at http://localhost:3002/staff
2. Go to chalet bookings
3. Find today's check-ins
4. Click on booking
5. Verify customer identity
6. Review booking details with guest
7. Hand over keys
8. Click "Check-In" button
9. Guest is checked in, cleaning scheduled for checkout

### Pool Staff - Scanning Tickets
1. Login at http://localhost:3002/staff
2. Go to QR Scanner
3. Point camera at customer's ticket
4. Green screen = valid ticket, entry granted
5. Red screen = invalid, see reason
6. Capacity updates automatically

---

## 🔐 Security Features

### Authentication
- JWT tokens with 15-minute expiry
- Refresh tokens for 7 days
- Secure password hashing (bcrypt)
- Email verification required
- Password reset via email

### Authorization
- Role-based access control (RBAC)
- Permission-based actions
- API endpoint protection
- Frontend route guards

### Data Protection
- All passwords hashed
- Payment info tokenized
- Audit logs for changes
- Soft deletes (no permanent data loss)

---

## 📊 Reports & Analytics

### Available Reports

#### For Staff
- Daily summary (orders, revenue)
- Most popular items
- Average preparation time
- Peak hours analysis

#### For Admins
- Revenue reports by date range
- Business unit breakdown
- Occupancy rates
- Customer analytics
- Export to Excel/PDF

**How to access reports:**
1. Login to admin dashboard
2. Navigate to "Reports" section
3. Select report type
4. Choose date range
5. Click "Generate"
6. View or export

---

## 🐛 Troubleshooting

### Frontend won't load
- Check if backend is running on port 3001
- Check browser console for errors
- Try clearing cookies and cache
- Verify .env.local has correct API_URL

### Can't login
- Verify email is confirmed
- Check password is correct
- Ensure user has correct roles
- Check backend logs for auth errors

### Orders not appearing
- Verify backend database connection
- Check WebSocket connection
- Refresh the page
- Check if order was placed successfully

### Payment not working
- Verify Stripe keys in backend .env
- Check payment method is configured
- Ensure test mode is enabled for testing
- Check browser console for errors

---

## 📞 Support

### For Customers
- Email: support@v2resort.com
- Phone: +961 XX XXX XXX
- Live chat on website

### For Staff
- Contact your manager
- Check internal staff portal help section
- Report bugs via admin panel

### For Admins
- Technical support: tech@v2resort.com
- Documentation: Check ACCESS_GUIDE.md
- Emergency: Call IT hotline

---

## 🔄 Common Tasks

### Creating a Staff Account (Super Admin)
1. Login to admin dashboard
2. Go to "Users" → "Create User"
3. Enter email, name, phone
4. Select role (restaurant_staff, chalet_staff, etc.)
5. System sends email with temporary password
6. Staff member logs in and changes password

### Adding Menu Items (Restaurant Admin)
1. Login to admin dashboard
2. Go to "Restaurant" → "Menu Management"
3. Click "Add Item"
4. Upload image
5. Enter name (in all languages)
6. Set price, category, description
7. Mark dietary info (vegetarian, vegan, etc.)
8. Click "Save"
9. Item appears on customer menu immediately

### Handling Refunds (Admin)
1. Find the order/booking
2. Click "Refund"
3. Enter refund amount
4. Provide reason
5. Confirm refund
6. System processes refund
7. Customer notified automatically

---

## 📝 Notes

- All times are in UTC timezone
- Prices are in USD and LBP
- Tax (11% VAT) automatically calculated
- Booking changes require approval
- Cancellation policies vary by business unit
- Data is backed up daily automatically

---

## 🎯 Quick Reference Card

| I want to... | Go to... | Login as... |
|-------------|----------|-------------|
| Order food | /restaurant | Customer or Guest |
| Book chalet | /chalets | Customer or Guest |
| Buy pool ticket | /pool | Customer or Guest |
| Manage kitchen | /staff | Restaurant Staff |
| Check-in guest | /staff | Chalet Staff |
| Scan tickets | /staff | Pool Staff |
| View all reports | /admin | Super Admin |
| Manage users | /admin | Super Admin |
| Configure system | /admin | Super Admin |

---

**Version:** 1.0.0  
**Last Updated:** January 1, 2026  
**System Status:** ✅ Operational
