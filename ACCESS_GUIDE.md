# V2 Resort Management System - Access Guide

## Overview
The V2 Resort Management System consists of three main portals:
- **Customer Portal** - Public-facing website for guests
- **Admin Portal** - Full system management for administrators
- **Staff Portal** - Operational tools for resort staff

---

## 🌐 Portal URLs

### Development Environment
- **Customer Portal**: `http://localhost:3002/`
- **Admin Portal**: `http://localhost:3002/admin`
- **Staff Portal**: `http://localhost:3002/staff`
- **Backend API**: `http://localhost:3001/`

### Production Environment
- **Customer Portal**: `https://v2resort.com/`
- **Admin Portal**: `https://v2resort.com/admin`
- **Staff Portal**: `https://v2resort.com/staff`
- **Backend API**: `https://api.v2resort.com/`

---

## 👤 Default Credentials

### Super Admin
- **Email**: `admin@v2resort.com`
- **Password**: `admin123`
- **Role**: `super_admin`
- **Access**: Full system access including user management, analytics, and settings

### Restaurant Manager
- **Email**: `restaurant@v2resort.com`
- **Password**: `admin123`
- **Role**: `restaurant_manager`
- **Access**: Menu management, order processing, table reservations

### Pool Manager
- **Email**: `pool@v2resort.com`
- **Password**: `admin123`
- **Role**: `pool_manager`
- **Access**: Pool session bookings, ticket validation

### Chalet Manager
- **Email**: `chalets@v2resort.com`
- **Password**: `admin123`
- **Role**: `chalet_manager`
- **Access**: Chalet bookings, calendar management

### Kitchen Staff
- **Email**: `kitchen@v2resort.com`
- **Password**: `Staff@2026!`
- **Role**: `kitchen_staff`
- **Access**: Kitchen display system for orders

---

## 🔐 Admin Portal Features

### Access: `/admin`
The admin portal is the central hub for resort management.

### Main Sections:

#### 1. Dashboard (`/admin`)
- Real-time statistics and KPIs
- Revenue charts and analytics
- Recent bookings and orders
- System health monitoring

#### 2. User Management (`/admin/users`)
- Create/edit/delete user accounts
- Assign roles and permissions
- View user activity logs
- Reset passwords

#### 3. Restaurant Management (`/admin/restaurant`)
- **Menu Categories**: Create and organize menu categories
- **Menu Items**: Add/edit dishes with prices, descriptions, images
- **Orders**: View and manage all restaurant orders
- **Tables**: Manage table layout and QR codes
- **Reservations**: Handle table reservations

#### 4. Chalet Management (`/admin/chalets`)
- **Chalet Listings**: Add/edit chalet properties
- **Pricing**: Set seasonal pricing and packages
- **Bookings**: Manage chalet reservations
- **Calendar**: Availability calendar view
- **Maintenance**: Schedule maintenance periods

#### 5. Pool Management (`/admin/pool`)
- **Sessions**: Configure pool session times and capacities
- **Pricing**: Set ticket prices for adults/children
- **Bookings**: View and manage pool bookings
- **Tickets**: Generate and validate tickets

#### 6. Snack Bar Management (`/admin/snack-bar`)
- **Menu**: Manage snack bar items
- **Orders**: Process quick-service orders
- **Inventory**: Track stock levels

#### 7. Analytics & Reports (`/admin/analytics`)
- Revenue reports by service
- Booking trends and patterns
- Customer analytics
- Export data to CSV/Excel

#### 8. Settings (`/admin/settings`)
- **General**: Resort name, contact info, business hours
- **Payment**: Configure Stripe/Whish integration
- **Email**: SMTP configuration for notifications
- **Languages**: Manage translations
- **Integrations**: Third-party service settings

---

## 👨‍🍳 Staff Portal Features

### Access: `/staff`
The staff portal provides role-specific operational tools.

### Main Sections:

#### 1. Kitchen Display System (`/staff/kitchen`)
**Role Required**: `kitchen_staff`, `restaurant_manager`
- Real-time incoming orders
- Order status tracking (New → Preparing → Ready → Served)
- Table number display
- Timer for each order
- Sound notifications for new orders

#### 2. Table Management (`/staff/tables`)
**Role Required**: `restaurant_staff`, `restaurant_manager`
- Table status overview (Available, Occupied, Reserved)
- Quick table assignments
- Generate QR codes for table ordering
- View current table orders

#### 3. Booking Calendar (`/staff/bookings`)
**Role Required**: `chalet_manager`, `pool_manager`
- Daily/weekly/monthly calendar views
- Quick booking creation
- Check-in/check-out management
- Booking status updates

#### 4. Ticket Validation (`/staff/tickets`)
**Role Required**: `pool_manager`, `reception`
- Scan QR codes for ticket validation
- Manual ticket lookup
- Entry logging
- Capacity monitoring

#### 5. Orders Dashboard (`/staff/orders`)
**Role Required**: `restaurant_staff`, `snack_bar_staff`
- Active orders overview
- Order assignment to staff
- Order completion tracking
- Print receipts

---

## 🔑 Authentication & Permissions

### Role Hierarchy
1. **super_admin** - Complete system access
2. **admin** - Most admin features except user role changes
3. **restaurant_manager** - Restaurant module full access
4. **pool_manager** - Pool module full access
5. **chalet_manager** - Chalet module full access
6. **restaurant_staff** - Restaurant operations only
7. **kitchen_staff** - Kitchen display system only
8. **reception** - Bookings and check-ins
9. **customer** - Public portal access only

### Permission System
The system uses role-based access control (RBAC):
- Each route checks for required roles via middleware
- Unauthorized access redirects to login
- API endpoints validate JWT tokens with role claims

---

## 🚀 Getting Started

### First Time Setup

#### 1. Start the Backend
```bash
cd backend
npm install
npm run dev
```
Backend runs on `http://localhost:3001`

#### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:3002`

#### 3. Database Setup
The system uses Supabase. Required tables:
- `users` - User accounts and roles
- `menu_categories` - Restaurant menu categories
- `menu_items` - Restaurant menu items
- `orders` - All orders (restaurant, snack bar)
- `chalets` - Chalet properties
- `chalet_bookings` - Chalet reservations
- `pool_sessions` - Pool session definitions
- `pool_bookings` - Pool ticket bookings

#### 4. Initial Login
1. Navigate to `/admin`
2. Log in with super admin credentials
3. Create additional staff accounts from User Management
4. Configure resort settings

---

## 📱 Mobile Access

All portals are fully responsive:
- **Admin Portal**: Best on tablet or desktop
- **Staff Portal**: Optimized for tablets (kitchen display, table management)
- **Customer Portal**: Mobile-first design

---

## 🔔 Real-Time Features

### Socket.IO Integration (Port 3001)
- Kitchen receives instant order notifications
- Live booking updates across devices
- Table status synchronization
- Admin dashboard live metrics

### Events:
- `order:new` - New order placed
- `order:update` - Order status changed
- `booking:new` - New reservation
- `table:status` - Table availability changed

---

## 🎨 Customization

### Theming
- Light/Dark mode toggle (top right corner)
- Themes persist per user via localStorage
- System preference detection

### Languages
- English (default)
- Arabic (RTL support)
- French
- Switch via language dropdown (top right)
- Translations stored in `/frontend/messages/`

---

## 🛠 Troubleshooting

### Cannot Access Admin Portal
- Ensure you're logged in with an admin/super_admin role
- Check browser console for errors
- Verify backend is running on port 3001

### Orders Not Showing in Kitchen
- Check Socket.IO connection (WebSocket status)
- Verify user has `kitchen_staff` role
- Ensure backend Socket.IO server is running

### CORS Errors
- Backend CORS is configured for `localhost:3000-3003`
- Check frontend is accessing correct API URL
- Verify `CORS_ORIGIN` environment variable

### Translation Missing
- Add key to `/frontend/messages/{locale}.json`
- Restart frontend dev server
- Clear browser cache

---

## 📞 Support

For technical support or questions:
- **Email**: dev@v2resort.com
- **Documentation**: See `Planning.txt` for detailed requirements
- **Database Schema**: Check Supabase dashboard

---

## 🔒 Security Notes

### Production Checklist:
- [ ] Change all default passwords
- [ ] Enable HTTPS for all portals
- [ ] Configure proper CORS origins
- [ ] Set up environment variables
- [ ] Enable rate limiting on API
- [ ] Configure Supabase RLS (Row Level Security)
- [ ] Set up backup schedules
- [ ] Enable audit logging

### Environment Variables Required:
```env
# Backend (.env)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_key
WHISH_API_KEY=your_whish_key
CORS_ORIGIN=https://yourdomain.com

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

**Last Updated**: January 2026  
**Version**: 1.0.0  
**System**: V2 Resort Management System
