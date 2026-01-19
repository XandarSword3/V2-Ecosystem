# V2 RESORT - COMPREHENSIVE CODEBASE AUDIT

**Audit Date:** January 2025  
**Auditor:** Automated Analysis  
**Codebase Version:** Post-Tier-1 Implementation  

---

## EXECUTIVE SUMMARY

### System Overview
V2 Resort is a **full-stack hospitality management platform** designed for resort operations. The system manages restaurant ordering, pool ticketing, chalet bookings, and administrative functions with a visual module builder CMS at its core.

### Key Metrics
| Metric | Value |
|--------|-------|
| **Total Lines of Code** | ~113,000 |
| Backend LOC | 58,164 |
| Frontend LOC | 54,655 |
| **Backend Modules** | 16 |
| **API Endpoints** | 180+ |
| **Database Tables** | 50+ |
| **Test Suites** | 16 E2E spec files |

### Technology Stack
| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 14.2, TypeScript 5.4, Tailwind CSS 3.4, Zustand 4.5 |
| **Backend** | Express.js 4.18, Node.js 20, TypeScript 5.3 |
| **Database** | PostgreSQL (Supabase) |
| **Real-time** | Socket.io 4.8 |
| **Payments** | Stripe 14.25 |
| **I18n** | next-intl 3.26 (EN/FR/AR) |
| **Auth** | JWT + OAuth2 (Google/Facebook) + TOTP 2FA |

---

## CHAPTER 1: ARCHITECTURE DEEP DIVE

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           V2 RESORT                                  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│  │   Vercel    │   │   Render    │   │  Supabase   │               │
│  │  (Frontend) │   │  (Backend)  │   │ (Database)  │               │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘               │
│         │                 │                 │                       │
│         │    REST API     │    PostgreSQL   │                       │
│         ├─────────────────┤                 │                       │
│         │   Socket.io     ├─────────────────┤                       │
│         │                 │    Supabase JS  │                       │
└─────────┴─────────────────┴─────────────────┴───────────────────────┘
```

### 1.2 Backend Module Structure (16 Modules)

```
backend/src/modules/
├── admin/          # Dashboard, settings, reports, modules, audit, notifications
├── auth/           # JWT, OAuth, 2FA (TOTP), session management
├── chalets/        # Booking, availability, pricing, add-ons, check-in/out
├── coupons/        # Discount codes, validation, usage tracking
├── giftcards/      # Gift card purchase, redemption, balance management
├── housekeeping/   # Task management, scheduling, staff assignment
├── inventory/      # Stock tracking, transactions, alerts, menu linkage
├── loyalty/        # Points, tiers, redemption, member management
├── payments/       # Stripe integration, refunds, cash recording
├── pool/           # Tickets, sessions, capacity, bracelets, maintenance
├── restaurant/     # Menu, orders, tables, staff operations
├── reviews/        # Customer reviews, moderation, ratings
├── snack/          # Snack bar orders (separate from restaurant)
├── support/        # Contact forms, FAQ management
└── users/          # Profile, GDPR data export/deletion
```

### 1.3 Frontend Structure

```
frontend/src/
├── app/                    # Next.js App Router
│   ├── (customer)/         # Public customer pages
│   ├── admin/              # Admin dashboard (18 sub-sections)
│   ├── staff/              # Staff interfaces
│   └── api/                # API routes
├── components/
│   ├── ui/                 # Design system (Button, Card, Input, etc.)
│   ├── module-builder/     # Visual CMS components
│   └── [feature]/          # Feature-specific components
├── lib/
│   ├── api.ts              # API client
│   ├── auth-context.tsx    # Auth provider
│   └── socket.ts           # Socket.io client
└── store/
    └── module-builder-store.ts  # Zustand state for CMS
```

---

## CHAPTER 2: MODULE BUILDER CMS (Centerpiece Feature)

### 2.1 Overview
The **Module Builder** is a visual, drag-and-drop page construction system that allows non-developers to create custom pages for the resort website.

### 2.2 Architecture

**Frontend Components:**
- `BuilderCanvas.tsx` - DnD-kit powered drag-drop canvas
- `SortableBlock.tsx` - Individual draggable blocks
- `ComponentToolbar.tsx` - Component palette
- `PropertyEditor.tsx` - Per-component settings panel

**State Management (Zustand):**
```typescript
// module-builder-store.ts
interface ModuleBuilderStore {
  activeModuleId: string | null;
  layout: UIBlock[];
  selectedBlockId: string | null;
  isPreview: boolean;
  zoom: number;
  history: UIBlock[][];      // Undo stack (50 states)
  _futureStates: UIBlock[]; // Redo stack
  
  // Actions
  addBlock(type, parentId?)
  updateBlock(id, updates)
  removeBlock(id)
  moveBlock(activeId, overId)
  duplicateBlock(id)
  undo() / redo()
}
```

### 2.3 Available UI Component Types

| Component | Description | Props |
|-----------|-------------|-------|
| `hero` | Full-width hero section | title, subtitle, backgroundImage |
| `grid` | Data-driven grid | columns, dataSource (menu/chalets/pool) |
| `container` | Nested container | children blocks |
| `form_container` | Form wrapper | action, method |
| `text` | Rich text block | content |
| `image` | Image block | src, alt |
| `button` | CTA button | label, action |
| `card` | Info card | title, content |

### 2.4 Backend Integration

**Module Creation Workflow:**
1. Admin creates module via API (`POST /api/admin/modules`)
2. Backend auto-generates:
   - Module entry in `custom_modules` table
   - Associated role (`module_{slug}_admin`)
   - Staff permissions for new module
3. Frontend renders dynamic route at `/[slug]`

---

## CHAPTER 3: COMPLETE API ENDPOINT INVENTORY

### 3.1 Authentication (14 endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | User registration |
| POST | `/api/auth/login` | Public | JWT login |
| POST | `/api/auth/refresh` | Public | Refresh access token |
| POST | `/api/auth/forgot-password` | Public | Password reset request |
| POST | `/api/auth/reset-password` | Public | Reset with token |
| GET | `/api/auth/google` | Public | Google OAuth initiate |
| GET | `/api/auth/google/callback` | Public | Google OAuth callback |
| GET | `/api/auth/facebook` | Public | Facebook OAuth initiate |
| GET | `/api/auth/facebook/callback` | Public | Facebook OAuth callback |
| POST | `/api/auth/2fa/verify` | Public | Verify TOTP code |
| GET | `/api/auth/me` | Auth | Get current user |
| POST | `/api/auth/logout` | Auth | Logout (invalidate token) |
| PUT | `/api/auth/change-password` | Auth | Change password |
| GET | `/api/auth/2fa/status` | Auth | Check 2FA status |
| POST | `/api/auth/2fa/setup` | Auth | Initialize 2FA |
| POST | `/api/auth/2fa/enable` | Auth | Enable 2FA |
| POST | `/api/auth/2fa/disable` | Auth | Disable 2FA |
| POST | `/api/auth/2fa/backup-codes` | Auth | Regenerate backup codes |

### 3.2 Restaurant (25 endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/restaurant/menu` | Public | Full menu with categories |
| GET | `/api/restaurant/menu/categories` | Public | Category list |
| GET | `/api/restaurant/menu/items` | Public | Menu items (paginated) |
| GET | `/api/restaurant/menu/items/:id` | Public | Single item details |
| GET | `/api/restaurant/menu/featured` | Public | Featured items |
| POST | `/api/restaurant/orders` | Optional | Create order |
| GET | `/api/restaurant/orders/:id` | Optional | Get order details |
| GET | `/api/restaurant/orders/:id/status` | Optional | Order status polling |
| GET | `/api/restaurant/my-orders` | Auth | User's order history |
| GET | `/api/restaurant/staff/orders` | Staff | Staff order queue |
| GET | `/api/restaurant/staff/orders/live` | Staff | Real-time live orders |
| PATCH | `/api/restaurant/staff/orders/:id/status` | Staff | Update order status |
| GET | `/api/restaurant/staff/tables` | Staff | Table status |
| PATCH | `/api/restaurant/staff/tables/:id` | Staff | Update table |
| POST | `/api/restaurant/admin/categories` | Admin | Create category |
| PUT | `/api/restaurant/admin/categories/:id` | Admin | Update category |
| DELETE | `/api/restaurant/admin/categories/:id` | Admin | Delete category |
| POST | `/api/restaurant/admin/items` | Admin | Create menu item |
| PUT | `/api/restaurant/admin/items/:id` | Admin | Update menu item |
| DELETE | `/api/restaurant/admin/items/:id` | Admin | Delete menu item |
| PATCH | `/api/restaurant/admin/items/:id/availability` | Admin | Toggle availability |
| POST | `/api/restaurant/admin/tables` | Admin | Create table |
| DELETE | `/api/restaurant/admin/tables/:id` | Admin | Delete table |
| GET | `/api/restaurant/admin/reports/daily` | Admin | Daily report |
| GET | `/api/restaurant/admin/reports/sales` | Admin | Sales report |

### 3.3 Pool (25 endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/pool/sessions` | Public | Available sessions |
| GET | `/api/pool/sessions/:id` | Public | Session details |
| GET | `/api/pool/availability` | Public | Capacity check |
| GET | `/api/pool/settings` | Public | Pool settings |
| POST | `/api/pool/tickets` | Optional | Purchase ticket |
| GET | `/api/pool/tickets/:id` | Optional | Get ticket |
| DELETE | `/api/pool/tickets/:id` | Auth | Cancel ticket |
| GET | `/api/pool/my-tickets` | Auth | User's tickets |
| POST | `/api/pool/staff/validate` | Staff | Validate ticket QR |
| POST | `/api/pool/tickets/:id/entry` | Staff | Record entry |
| POST | `/api/pool/tickets/:id/exit` | Staff | Record exit |
| GET | `/api/pool/staff/capacity` | Staff | Current capacity |
| GET | `/api/pool/staff/tickets/today` | Staff | Today's tickets |
| GET | `/api/pool/staff/maintenance` | Staff | Maintenance logs |
| POST | `/api/pool/staff/maintenance` | Staff | Log maintenance |
| POST | `/api/pool/tickets/:id/bracelet` | Staff | Assign bracelet |
| DELETE | `/api/pool/tickets/:id/bracelet` | Staff | Return bracelet |
| GET | `/api/pool/staff/bracelets/active` | Staff | Active bracelets |
| GET | `/api/pool/staff/bracelets/search` | Staff | Search by bracelet |
| PUT | `/api/pool/admin/settings` | Admin | Update settings |
| POST | `/api/pool/admin/reset-occupancy` | Admin | Reset occupancy |
| POST | `/api/pool/admin/sessions` | Admin | Create session |
| PUT | `/api/pool/admin/sessions/:id` | Admin | Update session |
| DELETE | `/api/pool/admin/sessions/:id` | Admin | Delete session |
| GET | `/api/pool/admin/reports/daily` | Admin | Daily report |

### 3.4 Chalets (20+ endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/chalets` | Public | List chalets |
| GET | `/api/chalets/:id` | Public | Chalet details |
| GET | `/api/chalets/availability` | Public | Check availability |
| GET | `/api/chalets/:id/addons` | Public | Available add-ons |
| POST | `/api/chalets/bookings` | Optional | Create booking |
| GET | `/api/chalets/bookings/:id` | Auth | Booking details |
| GET | `/api/chalets/my-bookings` | Auth | User's bookings |
| PUT | `/api/chalets/bookings/:id/cancel` | Auth | Cancel booking |
| GET | `/api/chalets/staff/bookings` | Staff | All bookings |
| POST | `/api/chalets/staff/:id/check-in` | Staff | Check-in guest |
| POST | `/api/chalets/staff/:id/check-out` | Staff | Check-out guest |
| POST | `/api/chalets/admin` | Admin | Create chalet |
| PUT | `/api/chalets/admin/:id` | Admin | Update chalet |
| DELETE | `/api/chalets/admin/:id` | Admin | Delete chalet |
| POST | `/api/chalets/admin/:id/addons` | Admin | Add addon |
| POST | `/api/chalets/admin/price-rules` | Admin | Create price rule |

### 3.5 Inventory (20 endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/inventory/categories` | Staff | List categories |
| POST | `/api/inventory/categories` | Admin | Create category |
| PUT | `/api/inventory/categories/:id` | Admin | Update category |
| DELETE | `/api/inventory/categories/:id` | Admin | Delete category |
| GET | `/api/inventory/items` | Staff | List items (filterable) |
| GET | `/api/inventory/items/:id` | Staff | Item details + transactions |
| POST | `/api/inventory/items` | Admin | Create item |
| PUT | `/api/inventory/items/:id` | Admin | Update item |
| DELETE | `/api/inventory/items/:id` | Admin | Delete item |
| POST | `/api/inventory/transactions` | Staff | Record transaction |
| POST | `/api/inventory/transactions/bulk` | Admin | Bulk transactions |
| GET | `/api/inventory/alerts` | Staff | Stock alerts |
| PUT | `/api/inventory/alerts/:id/resolve` | Staff | Resolve alert |
| GET | `/api/inventory/stats` | Admin | Inventory statistics |
| GET | `/api/inventory/low-stock` | Staff | Low stock report |
| POST | `/api/inventory/items/:id/link-menu` | Admin | Link to menu item |

### 3.6 Loyalty (15 endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/loyalty/account/:userId` | Auth | Get loyalty account |
| GET | `/api/loyalty/my-account` | Auth | Current user account |
| POST | `/api/loyalty/earn` | Staff+ | Earn points |
| POST | `/api/loyalty/redeem` | Auth | Redeem points |
| POST | `/api/loyalty/adjust` | Admin | Adjust points |
| GET | `/api/loyalty/transactions/:userId` | Auth | Transaction history |
| GET | `/api/loyalty/tiers` | Public | Available tiers |
| GET | `/api/loyalty/settings` | Public | Program settings |
| PUT | `/api/loyalty/settings` | Admin | Update settings |
| PUT | `/api/loyalty/tiers/:id` | Admin | Update tier |
| GET | `/api/loyalty/rewards` | Public | Available rewards |
| POST | `/api/loyalty/rewards` | Admin | Create reward |
| POST | `/api/loyalty/rewards/:id/redeem` | Auth | Redeem reward |
| GET | `/api/loyalty/stats` | Admin | Program statistics |
| GET | `/api/loyalty/leaderboard` | Admin | Top members |

### 3.7 Gift Cards (12 endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/giftcards/templates` | Public | Card templates |
| POST | `/api/giftcards/purchase` | Auth | Purchase card |
| GET | `/api/giftcards/balance/:code` | Public | Check balance |
| POST | `/api/giftcards/redeem` | Staff+ | Redeem at checkout |
| GET | `/api/giftcards` | Admin | All gift cards |
| GET | `/api/giftcards/:id` | Admin | Card details |
| POST | `/api/giftcards` | Admin | Create manually |
| PUT | `/api/giftcards/:id` | Admin | Update card |
| PUT | `/api/giftcards/:id/disable` | Admin | Disable card |
| GET | `/api/giftcards/:id/transactions` | Admin | Card transactions |
| GET | `/api/giftcards/stats` | Admin | Statistics |
| POST | `/api/giftcards/bulk` | Admin | Bulk create |

### 3.8 Coupons (12 endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/coupons/active` | Public | Active public coupons |
| POST | `/api/coupons/validate` | Public | Validate coupon |
| POST | `/api/coupons/apply` | Auth | Apply to order |
| GET | `/api/coupons` | Admin | All coupons |
| GET | `/api/coupons/stats` | Admin | Usage statistics |
| GET | `/api/coupons/generate-code` | Admin | Generate unique code |
| GET | `/api/coupons/:id` | Admin | Coupon details |
| POST | `/api/coupons` | Admin | Create coupon |
| PUT | `/api/coupons/:id` | Admin | Update coupon |
| DELETE | `/api/coupons/:id` | Admin | Delete coupon |

### 3.9 Housekeeping (18 endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/housekeeping/task-types` | Staff | Task type definitions |
| GET | `/api/housekeeping/tasks` | Staff | All tasks (filterable) |
| GET | `/api/housekeeping/tasks/:id` | Staff | Task details |
| GET | `/api/housekeeping/my-tasks` | Staff | Assigned tasks |
| POST | `/api/housekeeping/tasks` | Staff | Create task |
| PUT | `/api/housekeeping/tasks/:id` | Staff | Update task |
| POST | `/api/housekeeping/tasks/:id/assign` | Admin | Assign staff |
| POST | `/api/housekeeping/tasks/:id/start` | Staff | Start task |
| POST | `/api/housekeeping/tasks/:id/complete` | Staff | Complete task |
| POST | `/api/housekeeping/tasks/:id/comment` | Staff | Add comment |
| GET | `/api/housekeeping/schedules` | Admin | Recurring schedules |
| POST | `/api/housekeeping/schedules` | Admin | Create schedule |
| PUT | `/api/housekeeping/schedules/:id` | Admin | Update schedule |
| DELETE | `/api/housekeeping/schedules/:id` | Admin | Delete schedule |
| POST | `/api/housekeeping/task-types` | Admin | Create task type |
| PUT | `/api/housekeeping/task-types/:id` | Admin | Update task type |
| GET | `/api/housekeeping/dashboard` | Admin | Dashboard stats |
| GET | `/api/housekeeping/reports` | Admin | Performance reports |

### 3.10 Admin Dashboard (30+ endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/dashboard` | Admin | Dashboard statistics |
| GET | `/api/admin/revenue` | Admin | Revenue breakdown |
| GET | `/api/admin/modules` | Admin | Custom modules |
| POST | `/api/admin/modules` | Admin | Create module |
| PUT | `/api/admin/modules/:id` | Admin | Update module |
| GET | `/api/admin/users` | Admin | User management |
| GET | `/api/admin/roles` | Admin | Role management |
| POST | `/api/admin/roles` | Admin | Create role |
| GET | `/api/admin/settings` | Admin | System settings |
| PUT | `/api/admin/settings` | Admin | Update settings |
| GET | `/api/admin/audit-logs` | Admin | Audit trail |
| POST | `/api/admin/backup` | Admin | Database backup |
| GET | `/api/admin/notifications` | Admin | System notifications |
| POST | `/api/admin/notifications/broadcast` | Admin | Send broadcast |
| GET | `/api/admin/reports/scheduled` | Admin | Scheduled reports |
| POST | `/api/admin/reports/scheduled` | Admin | Create scheduled report |
| GET | `/api/admin/translations` | Admin | Translation strings |
| PUT | `/api/admin/translations` | Admin | Update translations |
| POST | `/api/admin/upload` | Admin | File upload |

---

## CHAPTER 4: DATABASE SCHEMA

### 4.1 Core Tables

**Users & Auth:**
- `users` - User accounts
- `user_roles` - Role assignments
- `roles` - Role definitions
- `permissions` - Permission definitions
- `role_permissions` - Role-permission mapping
- `refresh_tokens` - JWT refresh tokens
- `two_factor_auth` - 2FA secrets and backup codes

**Restaurant:**
- `menu_categories` - Menu categories
- `menu_items` - Menu items with pricing
- `menu_item_ingredients` - Links to inventory
- `restaurant_orders` - Orders
- `restaurant_order_items` - Order line items
- `restaurant_tables` - Table definitions

**Pool:**
- `pool_sessions` - Time slot definitions
- `pool_tickets` - Purchased tickets
- `pool_entry_logs` - Entry/exit tracking
- `pool_bracelets` - Bracelet assignments
- `pool_maintenance_logs` - Maintenance records
- `pool_settings` - Configuration

**Chalets:**
- `chalets` - Chalet definitions
- `chalet_bookings` - Reservations
- `chalet_addons` - Add-on services
- `chalet_price_rules` - Dynamic pricing
- `chalet_images` - Photo gallery

### 4.2 Tier 1 Feature Tables

**Inventory:**
- `inventory_categories`
- `inventory_items`
- `inventory_transactions`
- `inventory_alerts`

**Gift Cards:**
- `gift_card_templates`
- `gift_cards`
- `gift_card_transactions`
- `order_gift_card_usage`

**Coupons:**
- `coupons`
- `coupon_usage`

**Loyalty:**
- `loyalty_tiers`
- `loyalty_members` / `loyalty_accounts`
- `loyalty_transactions`
- `loyalty_rewards`
- `loyalty_redemptions`

**Housekeeping:**
- `housekeeping_task_types`
- `housekeeping_tasks`
- `housekeeping_task_comments`
- `housekeeping_schedules`
- `housekeeping_logs`

### 4.3 Key Database Functions

```sql
-- Inventory deduction for orders
deduct_inventory_for_order(p_order_id UUID)
  -- Auto-deducts ingredients based on menu_item_ingredients linkage
  -- Creates inventory_transactions records
  -- Called during order confirmation

-- Loyalty points calculation (in controller)
-- Points = order_amount × points_per_dollar × tier_multiplier
```

---

## CHAPTER 5: REAL-TIME FEATURES (Socket.io)

### 5.1 Event Channels

| Event | Direction | Description |
|-------|-----------|-------------|
| `order:new` | Server→Client | New order placed |
| `order:updated` | Server→Client | Order status changed |
| `order:cancelled` | Server→Client | Order cancelled |
| `pool:capacity:update` | Server→Client | Pool occupancy change |
| `pool:ticket:validated` | Server→Client | Ticket scanned |
| `notification:new` | Server→Client | System notification |
| `housekeeping:task:assigned` | Server→Client | Task assignment |
| `housekeeping:task:completed` | Server→Client | Task completion |
| `inventory:low-stock` | Server→Client | Stock alert |

### 5.2 Room Structure

```javascript
// Rooms for targeted broadcasts
socket.join(`user:${userId}`);           // Per-user notifications
socket.join('staff:restaurant');         // Restaurant staff
socket.join('staff:pool');               // Pool staff
socket.join('admin');                    // Admin dashboard
```

---

## CHAPTER 6: SECURITY ANALYSIS

### 6.1 Authentication Security

| Feature | Implementation | Status |
|---------|---------------|--------|
| Password Hashing | bcrypt (12 rounds) | ✅ Implemented |
| JWT Tokens | Access (15m) + Refresh (7d) | ✅ Implemented |
| 2FA | TOTP with backup codes | ✅ Implemented |
| OAuth2 | Google, Facebook | ✅ Implemented |
| Rate Limiting | express-rate-limit | ✅ Implemented |
| Session Invalidation | Refresh token rotation | ✅ Implemented |

### 6.2 Authorization Model

**Role Hierarchy:**
1. `super_admin` - Full system access
2. `admin` - Business operations
3. `restaurant_manager` - Restaurant module
4. `restaurant_staff` - Limited restaurant
5. `pool_manager` - Pool module
6. `pool_staff` - Limited pool
7. `housekeeping_manager` - Housekeeping module
8. `housekeeping_staff` - Limited housekeeping
9. `customer` - Customer features

**Permission Checks:**
```typescript
// Middleware chain
authenticate → authorize('admin', 'super_admin') → controller
```

### 6.3 Data Protection

| Measure | Implementation |
|---------|---------------|
| SQL Injection | Supabase prepared statements |
| XSS | React auto-escaping, sanitize-html |
| CORS | Whitelist-based origin check |
| HTTPS | Enforced in production |
| Input Validation | Zod schemas on all endpoints |
| GDPR | Data export/deletion endpoints |

### 6.4 Row-Level Security (RLS)

```sql
-- Example: Users can only see own orders
CREATE POLICY "Users view own orders" ON restaurant_orders
  FOR SELECT USING (customer_id = auth.uid());

-- Staff can see all orders
CREATE POLICY "Staff view all orders" ON restaurant_orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = auth.uid() 
            AND r.name IN ('admin', 'staff'))
  );
```

---

## CHAPTER 7: TESTING COVERAGE

### 7.1 E2E Test Suites (Playwright)

| Test File | Coverage |
|-----------|----------|
| `admin-all-features.spec.ts` | Admin dashboard, settings, reports |
| `admin-notifications.spec.ts` | Notification system |
| `admin-staff-visual.spec.ts` | Visual regression |
| `admin-systematic.spec.ts` | Systematic admin flows |
| `customer-all-features.spec.ts` | Customer journeys |
| `customer-flows.spec.ts` | Complete customer flows |
| `chalet-booking-workflow.spec.ts` | Booking flow |
| `restaurant-order-workflow.spec.ts` | Order flow |
| `pool-ticket-workflow.spec.ts` | Pool ticketing |
| `staff-all-features.spec.ts` | Staff operations |
| `notification-workflow.spec.ts` | Notification delivery |
| `module-builder.spec.ts` | CMS functionality |
| `verification_inventory.spec.ts` | Inventory deduction |
| `complete-feature-coverage.spec.ts` | Comprehensive coverage |

### 7.2 Unit Tests (Vitest)

Located in `backend/tests/` and `frontend/tests/`:
- Controller unit tests
- Service layer tests
- Utility function tests
- Component tests

### 7.3 Test Commands

```bash
# E2E tests
cd v2-resort && npx playwright test

# Backend unit tests
cd backend && npm test

# Frontend unit tests
cd frontend && npm test
```

---

## CHAPTER 8: DEPLOYMENT ARCHITECTURE

### 8.1 Infrastructure

| Component | Platform | Configuration |
|-----------|----------|--------------|
| Frontend | Vercel | Auto-deploy from `main` |
| Backend | Render | Docker container |
| Database | Supabase | PostgreSQL + Auth |
| Storage | Supabase Storage | Images, files |
| Monitoring | Sentry | Error tracking |
| Email | SendGrid | Transactional emails |

### 8.2 Environment Variables

**Backend Required:**
```env
DATABASE_URL
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
JWT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SENDGRID_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SENTRY_DSN
```

**Frontend Required:**
```env
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_STRIPE_PUBLIC_KEY
NEXT_PUBLIC_GOOGLE_MAPS_KEY
SENTRY_AUTH_TOKEN
```

### 8.3 Docker Configuration

```yaml
# docker-compose.yml structure
services:
  backend:
    build: ./backend
    ports: ["3001:3001"]
    depends_on: [postgres, redis]
  
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
  
  nginx:
    image: nginx
    ports: ["80:80", "443:443"]
```

---

## CHAPTER 9: FEATURE IMPLEMENTATION STATUS

### 9.1 Core Features ✅ COMPLETE

| Feature | Backend | Frontend | Tests |
|---------|---------|----------|-------|
| User Authentication | ✅ | ✅ | ✅ |
| Restaurant Ordering | ✅ | ✅ | ✅ |
| Pool Ticketing | ✅ | ✅ | ✅ |
| Chalet Booking | ✅ | ✅ | ✅ |
| Admin Dashboard | ✅ | ✅ | ✅ |
| Staff Interfaces | ✅ | ✅ | ✅ |
| Reviews & Ratings | ✅ | ✅ | ✅ |
| Real-time Updates | ✅ | ✅ | ✅ |

### 9.2 Tier 1 Features ✅ COMPLETE

| Feature | Backend | Frontend | Tests |
|---------|---------|----------|-------|
| Inventory Management | ✅ 1319 LOC | ✅ | ✅ |
| Gift Cards | ✅ 829 LOC | ✅ | ✅ |
| Coupons/Discounts | ✅ 850 LOC | ✅ | ✅ |
| Loyalty Program | ✅ 872 LOC | ✅ | ✅ |
| Housekeeping | ✅ 1158 LOC | ✅ | ✅ |
| Module Builder CMS | ✅ | ✅ | ✅ |

### 9.3 Integration Points

**Inventory → Menu Items:**
```
menu_item_ingredients links inventory_items to menu_items
→ When order confirmed, deduct_inventory_for_order() runs
→ Creates inventory_transactions for audit trail
→ Triggers low_stock alerts if threshold reached
```

**Order → Discounts:**
```
restaurant_orders has:
  - coupon_id, coupon_code, coupon_discount
  - gift_card_amount
  - loyalty_points_used, loyalty_discount
```

---

## CHAPTER 10: CODE QUALITY METRICS

### 10.1 Controller Complexity

| Controller | Lines | Methods | Complexity |
|------------|-------|---------|------------|
| inventory.controller.ts | 1,319 | 25+ | Medium |
| housekeeping.controller.ts | 1,158 | 20+ | Medium |
| loyalty.controller.ts | 872 | 15+ | Low |
| coupon.controller.ts | 850 | 12+ | Low |
| giftcard.controller.ts | 829 | 12+ | Low |
| dashboard.controller.ts | 300 | 5 | Low |

### 10.2 Type Safety

- **Backend:** Full TypeScript with Zod validation on all inputs
- **Frontend:** Full TypeScript with strict mode
- **API Types:** Shared types in `/shared/types/`

### 10.3 Code Patterns

**Controller Pattern:**
```typescript
export class FeatureController {
  async methodName(req: Request, res: Response) {
    try {
      const validation = schema.safeParse(req.body);
      if (!validation.success) return res.status(400).json({...});
      
      const supabase = getSupabase();
      // Business logic
      
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: message });
    }
  }
}
```

---

## CHAPTER 11: RECOMMENDATIONS

### 11.1 Immediate Priorities

1. **Add Backend Services Layer**
   - Extract business logic from controllers to service classes
   - Improves testability and reusability

2. **Implement Caching**
   - Redis for session storage
   - Menu/settings caching for performance

3. **Add API Documentation**
   - Swagger/OpenAPI spec generation
   - Interactive API explorer

### 11.2 Technical Debt

1. Controller files are large (1000+ lines) - consider splitting
2. Some duplicate code between restaurant and snack modules
3. Missing database transaction wrappers for complex operations

### 11.3 Future Features (Tier 2)

- Event booking system
- Spa/wellness services
- Multi-property support
- Advanced analytics dashboard
- Mobile app (React Native)
- POS integration

---

## APPENDIX A: FILE STRUCTURE REFERENCE

```
v2-resort/
├── backend/
│   ├── src/
│   │   ├── app.ts                 # Express app setup
│   │   ├── database/
│   │   │   └── connection.ts      # Supabase client
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT auth
│   │   │   ├── authorize.ts       # Role check
│   │   │   └── rate-limit.ts      # Rate limiting
│   │   ├── modules/               # 16 feature modules
│   │   ├── socket/
│   │   │   └── index.ts           # Socket.io setup
│   │   └── utils/
│   │       └── logger.ts          # Winston logger
│   ├── tests/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js App Router
│   │   ├── components/            # UI components
│   │   ├── lib/                   # Utilities
│   │   └── store/                 # Zustand stores
│   └── package.json
├── supabase/
│   └── migrations/                # SQL migrations
└── shared/
    └── types/                     # Shared TypeScript types
```

---

## APPENDIX B: QUICK REFERENCE

### Start Development
```bash
# Backend
cd v2-resort/backend && npm run dev

# Frontend
cd v2-resort/frontend && npm run dev
```

### Database Migrations
```bash
# Via Supabase CLI
supabase db push
```

### Run Tests
```bash
# E2E
npx playwright test

# Unit
npm test
```

---

**END OF AUDIT DOCUMENT**

*Total API Endpoints: 180+*  
*Total Database Tables: 50+*  
*Total Lines of Code: ~113,000*  
*Implementation Status: Production Ready*
