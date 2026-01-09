
# V2 Resort Management Platform – Technical Overview

## Overview
V2 Resort is a modular, full-stack hospitality management platform designed for independent deployment, extensibility, and security. It provides a unified solution for restaurant, accommodation, pool, and activity management, with a focus on maintainability, scalability, and operational autonomy.

---

## Architecture

### Frontend
- **Framework:** Next.js 14 (App Router), React, TypeScript
- **Styling:** Tailwind CSS, Framer Motion
- **State/Async:** React Query, Zustand
- **i18n:** next-intl (English, Arabic RTL, French)
- **Real-time:** Socket.io client
- **Validation:** Zod
- **Payments:** Stripe integration
- **Other:** Lucide React icons, QR code generation/scanning

### Backend
- **Framework:** Node.js, Express, TypeScript
- **Database:** PostgreSQL (via Supabase)
- **Real-time:** Socket.io
- **Security:** JWT (access/refresh), Bcrypt, Helmet, CORS, rate limiting, Zod validation
- **Logging:** Winston, morgan
- **Email:** Nodemailer (SMTP)
- **Payments:** Stripe
- **Containerization:** Docker Compose (frontend, backend, PostgreSQL, Redis, nginx)

### Database
- **Engine:** PostgreSQL (ACID, row-level locking, foreign keys, indexes)
- **Schema:** Modular (users, roles, permissions, modules, menu, orders, bookings, tickets, settings, audit logs, etc.)
- **Migrations:** SQL scripts and TypeScript migration utilities

---

## Core Features

### Modular Business Units
- **Module system**: Enable/disable business units (restaurant, chalets, pool, snack bar, etc.) via admin UI
- **Templates:**
	- Menu Service (restaurant, retail, spa)
	- Multi-Day Booking (chalets, rooms, rentals)
	- Session Access (pool, events, classes)
- **Dynamic configuration:** Add new modules without code changes using templates

### Guest-Facing
- **Multi-language UI:** English, Arabic (RTL), French
- **Menu browsing:** Dietary filters, real-time availability, search, photos, allergen tags
- **Booking:** Real-time calendar, dynamic pricing, add-ons, conflict prevention, QR code confirmations
- **Pool/Activity:** Session-based ticketing, capacity enforcement, QR validation
- **Payments:** Stripe integration, secure checkout

### Staff/Admin
- **Kitchen display:** Real-time order queue, status workflow, timestamps
- **Check-in dashboard:** Daily arrivals, payment status, special requests
- **Order tracking:** Socket.io push updates, notifications
- **Menu/inventory:** CRUD for categories/items, allergen/availability, photo upload
- **Booking management:** Pricing rules, add-ons, calendar, block dates, occupancy view
- **User/role management:** RBAC, audit logs, per-module access
- **Branding:** White-label settings (logo, colors, email templates, policies)
- **Reports:** Revenue, occupancy, order volume, CSV/JSON export, time-series charts

---

## Security

### Authentication & Authorization
- JWT (access: 15min, refresh: 7d)
- RBAC (admin, staff, manager, per-module roles)
- Password reset via email (tokenized)
- Device/session tracking
- Rate limiting (auth endpoints, general API)

### Input & Data Validation
- Zod schemas for all API input
- TypeScript types throughout
- Sanitization against XSS
- Parameterized queries (SQL injection prevention)
- Module guards for business unit isolation

### Infrastructure
- Helmet.js (CSP, HSTS, XSS headers)
- CORS (configurable, origin whitelisting)
- Bcrypt password hashing (salted)
- Environment variable management for all secrets
- Dockerized deployment (isolation, reproducibility)

### Auditing & Logging
- Winston structured logs
- Audit logs (user actions, data changes)
- Request/response logging (morgan)

---

## API Overview

### Auth
- POST /api/auth/register, /login, /logout, /refresh, /forgot-password, /reset-password, /me

### Restaurant
- GET /api/restaurant/menu, /categories
- POST /api/restaurant/orders
- GET /api/restaurant/orders
- PATCH /api/restaurant/orders/:id/status

### Chalets
- GET /api/chalets, /:id, /:id/availability
- POST /api/chalets/bookings
- GET /api/chalets/bookings

### Pool
- GET /api/pool/sessions
- POST /api/pool/tickets
- GET /api/pool/tickets/:id
- POST /api/pool/tickets/validate

### Admin
- GET /api/admin/dashboard, /users, /modules, /settings
- POST /api/admin/users
- PATCH /api/admin/modules/:id, /settings

---

## Database Schema (Summary)

- **users, roles, user_roles, permissions**: Auth, RBAC
- **modules**: Business unit config
- **menu_categories, menu_items, restaurant_orders, restaurant_order_items**: Restaurant
- **chalets, chalet_bookings, chalet_add_ons, chalet_price_rules**: Accommodation
- **pool_sessions, pool_tickets**: Pool/activity
- **payments, notifications, audit_logs, site_settings, email_templates**: Cross-cutting

See `backend/src/database/migration.sql` for full schema.

---

## Environment Variables

### Backend
```
PORT=3001
NODE_ENV=production
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
SMTP_FROM_NAME=...
FRONTEND_URL=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

### Frontend
```
NEXT_PUBLIC_API_URL=...
NEXT_PUBLIC_SOCKET_URL=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
```

---

## Deployment

### Development
1. Clone repo, install dependencies in `backend/` and `frontend/`
2. Configure `.env` files (see above)
3. Run migrations: `npm run migrate` (backend)
4. Start servers: `npm run dev` (both)

### Production
- Use Docker Compose for full stack (frontend, backend, db, redis, nginx)
- Or deploy frontend (Vercel/Netlify) and backend (VPS/cloud)
- Configure environment variables for each service

---

## Performance

- Redis caching (backend)
- DB indexing, connection pooling
- Static generation (frontend)
- React Query caching
- Image optimization (Next.js)

---

## Troubleshooting

- **DB connection:** Check Supabase credentials, network, permissions
- **Frontend/backend:** Verify API URLs, CORS, server status
- **Email:** Validate SMTP config, test with email client
- **Modules:** Ensure enabled in DB, check route slugs
- **WebSocket:** Confirm Socket.io URL, firewall, CORS

---

## License

Proprietary. See LICENSE for terms.

---

## Credits

Built by the V2 Resort development team. Key dependencies: Next.js, React, PostgreSQL, Supabase, Stripe.

#### 🏊 Pool & Activity Access
Guests purchase day passes for pool access with session-based pricing. The system displays current capacity and blocks sales when the session reaches maximum occupancy, preventing overcrowding and compliance issues. Tickets generate with unique QR codes that staff scan at entry for validation. The same framework extends to any session-based activity—spa appointments, guided tours, equipment rentals—without custom development.

#### 🌍 Multi-Language Support Built In
The entire customer interface operates in **English, Arabic (with RTL layout support), and French**. Language selection persists across sessions. All dynamic content—menu items, chalet descriptions, confirmation emails—translates automatically through the content management system. This localization capability serves both local and international guests without maintaining separate sites.

### Staff Workflows: Eliminate Paper and Prevent Errors

#### 👨‍🍳 Kitchen Display System
Orders appear on kitchen screens immediately after customer confirmation, eliminating verbal communication and paper tickets. Staff see order details, special instructions, and preparation priority. They move orders through workflow stages—received, preparing, ready, completed—with single-click status updates. The system timestamps each transition for performance tracking. Orders never get lost, forgotten, or duplicated because the digital queue maintains complete order history.

#### 🎫 Reservation and Check-In Management
Staff view all bookings for the current day with check-in times, guest names, special requests, and payment status. They mark arrivals, process check-ins, and issue access credentials through the same interface. The system flags overdue check-ins and highlights VIP guests or special accommodations. Staff access the same information whether working from the front desk, a tablet, or a phone.

#### 📱 QR Code Validation
Pool staff, event coordinators, or access control personnel scan QR codes from tickets or bookings for instant validation. The scanner displays guest details, ticket type, entry time, and validity status. It prevents duplicate entries if a ticket has already been scanned and redeemed. This eliminates manual checking of paper tickets or guest lists.

#### ⚡ Real-Time Order Tracking
Staff receive instant notifications when new orders arrive, when modifications occur, or when priority changes. **Socket.io-based real-time updates** mean the kitchen display refreshes automatically without manual polling. This eliminates the refresh-and-check pattern that creates gaps in order awareness.

### Administrative Control: Full Autonomy

#### 📋 Menu and Inventory Management
Administrators create categories, add items with descriptions and photos, set pricing, mark allergens, and assign availability rules. They upload product images directly or specify image URLs. They mark items as vegetarian, vegan, gluten-free, or dairy-free for filtering. They disable items temporarily (out of stock) or permanently (discontinued) without deleting historical order data. Category ordering, featured items, and seasonal menus update through intuitive interfaces.

#### 📅 Booking and Capacity Management
Administrators set base pricing and weekend premiums for chalets or accommodations. They define minimum and maximum stay lengths, deposit requirements, and cancellation policies. They block specific dates for maintenance or private events. They manage add-on services with individual pricing and availability rules. The calendar view shows occupancy at a glance with color-coded availability states.

For pool sessions or scheduled activities, administrators create sessions with start times, duration, capacity limits, and pricing. They close sessions for weather or maintenance. They override capacity for group bookings or special events.

#### 👥 User and Permission Management
Administrators create staff accounts with **role-based permissions**. Roles include:
- **Admin**: Full access to all modules and settings
- **Staff**: Operational access to assigned modules only
- **Manager**: Reports and oversight across modules

They assign users to specific modules—restaurant staff only see restaurant orders, pool staff only manage pool sessions. They track user activity through **audit logs** showing who modified what data and when.

#### 🎨 White-Label Branding and Settings
The settings panel controls site name, logo, favicon, primary and accent colors, hero images, contact information, and policy pages. Changes apply instantly across the customer interface. Administrators customize **email templates** with variable substitution for order confirmations, booking confirmations, and password resets. They set business hours, timezone, currency, and default language.

#### 📊 Revenue and Performance Reports
The dashboard displays key metrics:
- Daily revenue by module
- Order volume and trends
- Booking counts and occupancy rates
- Top-selling menu items
- Capacity utilization by session

Administrators export transaction data in **CSV or JSON format** for accounting software integration. They view time-series charts for revenue trends, occupancy rates, and order distribution by service type. Reports filter by date range, module, or staff member for performance analysis.

---

## Technical Architecture: Modern, Maintainable, Independent

This platform uses widely-adopted, enterprise-grade technologies that ensure long-term maintainability and developer availability. Nothing proprietary. Nothing exotic. If you need to hire a developer for customization or ongoing maintenance, you can find qualified TypeScript and React developers in any major market without difficulty.

### Frontend: Next.js 14 + React + TypeScript
The customer and admin interfaces run on **Next.js 14** with the App Router architecture, providing server-side rendering for SEO, static generation for performance, and client-side interactivity where needed. **TypeScript** provides compile-time type safety that prevents entire categories of runtime bugs. **Tailwind CSS** enables rapid UI customization through utility classes without writing custom CSS. **Framer Motion** handles animations and transitions for modern, fluid user experience.

The interface is **fully responsive**—guests use phones, tablets, or desktops interchangeably without compromised functionality. Staff access kitchen displays on mounted tablets or handheld devices. Administrators manage settings from any device.

**Key libraries and frameworks:**
- **React Query** for server state management and caching
- **Socket.io client** for real-time updates
- **next-intl** for internationalization with type-safe translations
- **Zod** for runtime validation and type inference
- **Stripe integration** for payment processing
- **QR code generation** and scanning libraries
- **Lucide React** icons for consistent UI

### Backend: Node.js + Express + TypeScript
The API runs on **Express.js** with **TypeScript**, providing a straightforward request-response architecture that any experienced Node developer can understand and modify. **Socket.io** enables real-time communication for order updates and notifications without polling overhead. **Winston** handles structured logging for debugging and audit trails.

**Security and reliability features:**
- **JWT-based authentication** with access and refresh tokens
- **Role-based authorization** middleware
- **Helmet** for security headers (XSS protection, CSP, HSTS)
- **CORS** configuration for cross-origin control
- **Rate limiting** on authentication endpoints (prevents brute-force attacks)
- **Input validation** with Zod schemas on all incoming data
- **Bcrypt password hashing** with proper salt rounds
- **SQL injection prevention** through parameterized queries
- **Module guards** to enforce business unit access control

### Database: PostgreSQL via Supabase
The system uses **PostgreSQL** for data storage, accessed through **Supabase** for simplified hosting, backups, and scaling. PostgreSQL provides ACID compliance, complex query support, and proven reliability for transactional systems. The schema includes proper foreign key constraints, indexes on query-heavy columns, and triggers for audit logging.

**Core database tables:**
- Users, roles, permissions with role-based access control
- Menu categories and items with multi-language support
- Orders with status tracking and real-time updates
- Bookings with availability locking and payment tracking
- Sessions and tickets with QR code generation
- Site settings for white-label configuration
- Email templates with variable substitution
- Audit logs for compliance and debugging

The database handles concurrent access through row-level locking for high-traffic scenarios like simultaneous booking attempts. **Migration scripts** manage schema evolution as you customize the system.

### Infrastructure Independence
You deploy this system to your own infrastructure—**DigitalOcean, AWS, Google Cloud, Azure, or any VPS provider**. You control the servers, the database, the backups, and the scaling strategy. The **Docker Compose configuration** includes frontend, backend, PostgreSQL, Redis, and nginx reverse proxy for straightforward deployment. Environment variables configure all external integrations—database credentials, email SMTP, payment processor keys—without code changes.

**What you need to provide:**
- Hosting environment with Node.js 18+ support (~$50–$150/month depending on traffic)
- PostgreSQL database (included in most hosting plans or $15–$25/month standalone)
- Domain name and SSL certificate (~$15/year for domain, free SSL via Let's Encrypt)
- SMTP email service (free tier available from SendGrid/Mailgun for up to 10,000 emails/month)
- Payment processor account (Stripe standard rates, no platform fee)

**What you receive:**
- Complete source code for frontend and backend
- Database migration scripts and seed data
- Docker Compose configuration for containerized deployment
- Environment variable documentation
- Deployment guides for major cloud providers
- 90 days of technical support for deployment questions
- 12 months of security updates and dependency maintenance

---

## Module System: Built for Expansion

The platform's core innovation is its **module architecture**. Unlike monolithic systems where every feature is hardcoded, or SaaS platforms where you pay per module, V2 Resort Platform treats business units as pluggable modules. You enable or disable modules through the admin interface without touching code. When you add a new revenue stream, you deploy a new module using one of three templates.

### Three Module Templates

#### 📦 Menu Service Template
**Use cases:** Restaurant, Snack Bar, Café, Retail Shop, Spa Services

Designed for businesses that sell items from a catalog with immediate fulfillment. The template includes:
- Category management with ordering and visibility rules
- Item management with photos, descriptions, and pricing
- Allergen and dietary restriction tagging
- Shopping cart functionality
- Order processing with status workflow
- Kitchen/fulfillment display systems
- Real-time order notifications

You customize item attributes (allergens for food, sizes for retail, service duration for spa treatments), but the underlying order workflow remains consistent.

#### 🏨 Multi-Day Booking Template
**Use cases:** Chalets, Hotel Rooms, Event Spaces, Equipment Rentals

Designed for assets that guests reserve for date ranges with limited capacity. The template includes:
- Availability calendar with real-time conflict prevention
- Dynamic pricing rules (base rate, weekend premium, seasonal rates)
- Deposit and payment tracking
- Add-on services with individual pricing
- Booking modification and cancellation handling
- Email confirmations with booking details

You customize the asset type (rooms, vehicles, equipment), but the reservation engine handles conflicts, capacity, and payment tracking universally.

#### 🎟️ Session Access Template
**Use cases:** Pool, Spa, Gym, Tours, Classes, Events

Designed for time-based activities with defined capacity limits and entry validation. The template includes:
- Session scheduling with start time and duration
- Ticket sales with capacity enforcement
- QR code generation for entry validation
- Capacity management and overbooking prevention
- Staff scanner interface for ticket validation
- Real-time capacity dashboards

You customize session attributes (duration, equipment provided, age restrictions), but the ticketing and validation flow stays consistent.

### Why This Matters for Scaling
When you want to add a **wine shop** to your resort, you instantiate the Menu Service template, customize the categories and items, and enable the module. When you want to offer **paddleboard rentals**, you instantiate the Multi-Day Booking template with hourly or daily sessions. When you add **cooking classes**, you use the Session Access template with instructor capacity and materials tracking.

**This eliminates custom development for common business patterns.** Instead of hiring a developer to build a wine shop from scratch, you configure an existing template in hours rather than weeks.

---

## Comparison: Your Three Options

### Option 1: Continue With Manual Processes
**💵 Cost:** $0 software, high operational cost  
**⚙️ Capabilities:** Phone reservations, paper order tickets, manual inventory tracking, spreadsheet reports  
**⚖️ Tradeoffs:** Zero monthly fees but maximum staff time, error rates, and scaling limitations. Suitable for very small operations (under 20 bookings per week) or seasonal businesses with limited technology budget.

### Option 2: Subscribe to Comprehensive SaaS Platform
**💵 Cost:** $800–$1,500/month software + 2–3% transaction fees  
**⚙️ Capabilities:** Full digital operations, vendor support, automatic updates, integrated payment processing  
**⚖️ Tradeoffs:** Professional features and ongoing vendor support, but permanent monthly fees, vendor dependency for customization, transaction fees on every sale, per-location pricing for multiple properties.

### Option 3: Purchase V2 Resort Platform
**💵 Cost:** One-time purchase + $50–$150/month hosting  
**⚙️ Capabilities:** Equivalent to SaaS platforms with full source code ownership and unlimited customization  
**⚖️ Tradeoffs:** Same operational capabilities as SaaS with cost savings over 18-24 months, complete branding and customization control, no transaction fees, scalable to multiple properties without additional licensing. Requires technical competence to deploy and maintain, or budget to hire occasional developer support. Support limited to 90 days post-purchase with 12-month security updates included.

---

## What Happens After Purchase

### ✅ What You Receive
- Complete source code for frontend (Next.js/React/TypeScript)
- Complete source code for backend (Node.js/Express/TypeScript)
- Database migration scripts and schema documentation
- Docker Compose configuration for development and production
- Environment variable templates and setup guide
- Deployment documentation for DigitalOcean, AWS, Google Cloud
- Email template customization guide
- Admin user manual and staff workflow documentation
- White-label configuration guide

### 📝 Your Responsibilities
- Provide hosting environment (VPS or cloud provider)
- Configure domain name and SSL certificate
- Set up database and apply migrations
- Configure SMTP email service
- Configure payment processor (Stripe or alternative)
- Perform regular backups of your database
- Apply security updates during the 12-month update period
- Maintain server security and monitoring

### 📅 Support Timeline
- **Days 1-90:** Full technical support for deployment, configuration, and operational questions via email with 24-48 hour response time
- **Months 4-12:** Security patches and critical bug fixes provided as they're identified
- **After 12 months:** Optional extended support available or hire independent developers as needed

### ⚠️ Limitations and Requirements

**Technical competence required:** You or someone on your team needs basic command-line familiarity, ability to follow deployment documentation, and comfort with environment variable configuration. If you can install WordPress or set up a web server, you have sufficient technical background.

**Third-party dependencies:** 
- Email delivery requires SMTP service (free tiers available from SendGrid, Mailgun, or Amazon SES)
- Payment processing requires Stripe account (or you can integrate an alternative processor)
- SSL certificates available free via Let's Encrypt

**Scaling considerations:** The included configuration handles approximately 1,000 daily active users on a $50/month VPS. If you operate a resort with significantly higher traffic, you'll need larger hosting infrastructure. Database and application server scale independently for cost optimization.

**No phone support:** All support occurs via email and documentation. Complex debugging may require screen sharing sessions scheduled in advance.

---

## Frequently Asked Questions

**Q: Can I modify the source code?**  
A: Yes, completely. You receive full source code with unlimited modification rights. Customize features, add integrations, change workflows, or rebuild entire sections. The only restriction is you cannot resell the platform itself as a competing product.

**Q: What ongoing costs should I expect?**  
A: Hosting ($50–$150/month), domain registration (~$15/year), and optionally email delivery beyond free tiers (~$10/month for 50,000 emails). Payment processing fees are standard Stripe rates (2.9% + $0.30 per transaction) with no platform markup. Total ongoing costs typically run $75–$200/month depending on scale.

**Q: How difficult is deployment?**  
A: If you have basic Linux server experience, plan 4-8 hours for initial deployment including domain configuration and SSL setup. If you've never deployed a Node application, budget 2-3 days for learning and troubleshooting, or hire a developer for $300–$500 to handle deployment.

**Q: Can I migrate from my current reservation system?**  
A: Data migration depends on your current system's export capabilities. If you can export to CSV or JSON, you can import that data into V2 Resort Platform's database. Migration scripts are not included but can be developed during the support period if you provide sample data.

**Q: What happens if I find a critical bug after the 90-day support period?**  
A: Security vulnerabilities and data-loss bugs receive patches for the full 12-month update period. Feature bugs or enhancement requests fall outside the included support scope after 90 days.

**Q: Can I use this for multiple properties?**  
A: Yes. Each property runs its own isolated instance with separate databases and branding. The source code license permits unlimited deployments by the purchasing entity. You pay hosting costs for each instance but no additional software licensing fees.

**Q: Is there a refund policy?**  
A: Yes. If you cannot successfully deploy the system within 30 days despite following documentation and using the support period, full refund available. No refunds after successful deployment or after 30 days from purchase.

**Q: What if I want features that don't exist?**  
A: You can hire any developer to build custom features since you own the source code. Alternatively, contact us about custom development at standard consulting rates ($100–$150/hour depending on complexity).

**Q: How do updates work after the 12-month period?**  
A: You're not required to apply updates. Your version continues working indefinitely. If you want new features or ongoing security patches beyond 12 months, extended support is available at $150/month, or you can hire independent developers to maintain your instance.

**Q: What technologies should my developer know for customization?**  
A: TypeScript, React, Next.js for frontend. Node.js, Express for backend. PostgreSQL for database. These are industry-standard skills easily found in the developer market.

---

## Next Steps

### 🎯 Review the Live Demo
Experience the platform from guest, staff, and admin perspectives:  
**[https://v2-ecosystem.vercel.app](https://v2-ecosystem.vercel.app)**

Demo credentials provided on the login page for each role level.

### 📚 Examine the Technical Documentation
Review the architecture, API specifications, and deployment procedures:  
**[Technical Setup Guide](#technical-setup-guide)** (see below)

### 📧 Schedule a Consultation
Discuss your specific requirements, timeline, and customization needs:  
**Email:** contact@v2resort.com *(replace with actual contact)*  
**Response Time:** Within 24 hours on business days

### 💰 Request a Quote
Provide details about your property size, expected transaction volume, and timeline for customized pricing.

---

<br/>

# Technical Setup Guide

## Prerequisites

- **Node.js** v18.0.0 or higher
- **PostgreSQL** (via Supabase or self-hosted)
- **SMTP Email Service** (SendGrid, Mailgun, Gmail, etc.)
- **Stripe Account** (for payment processing)
- **Git** for cloning the repository

## Quick Start (Development)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/v2-resort.git
cd v2-resort
```

### 2. Backend Setup

```bash
cd backend
npm install

# Copy environment template
cp .env.example .env
```

**Edit `.env` with your credentials:**

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@v2resort.com
SMTP_FROM_NAME=V2 Resort

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000

# Stripe (optional for development)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Run database migrations:**

```bash
npm run migrate
npm run seed  # Optional: Load sample data
```

**Start development server:**

```bash
npm run dev
```

Backend will be available at `http://localhost:3001`

### 3. Frontend Setup

```bash
cd frontend
npm install

# Copy environment template
cp .env.example .env.local
```

**Edit `.env.local`:**

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Start development server:**

```bash
npm run dev
```

Frontend will be available at `http://localhost:3000`

### 4. Access the Application

- **Customer Interface:** `http://localhost:3000`
- **Admin Dashboard:** `http://localhost:3000/admin`
- **Staff Interface:** `http://localhost:3000/staff`
- **API Documentation:** `http://localhost:3001/api/health`

**Default admin credentials (change immediately):**
- Email: `admin@v2resort.com`
- Password: `Admin123!`

---

## Production Deployment

### Option 1: Docker Compose (Recommended)

```bash
# From repository root
docker-compose up -d
```

This will start:
- PostgreSQL database
- Redis cache
- Backend API
- Frontend application
- Nginx reverse proxy

**Configure production environment variables** in `.env` files before starting.

### Option 2: Manual Deployment

#### Backend Deployment (DigitalOcean/AWS/Render)

1. **Build the backend:**
```bash
cd backend
npm run build
```

2. **Upload to server** and install dependencies:
```bash
npm install --production
```

3. **Set environment variables** on your hosting platform

4. **Run migrations:**
```bash
npm run migrate
```

5. **Start the server:**
```bash
npm start
```

#### Frontend Deployment (Vercel/Netlify)

1. **Build the frontend:**
```bash
cd frontend
npm run build
```

2. **Deploy to Vercel:**
```bash
vercel deploy --prod
```

Or connect your Git repository to Vercel for automatic deployments.

3. **Configure environment variables** in Vercel dashboard

---

## Project Structure

```
v2-resort/
├── backend/                    # Express.js API
│   ├── src/
│   │   ├── config/            # Configuration files
│   │   ├── database/          # Database connection & migrations
│   │   ├── middleware/        # Auth, validation, logging
│   │   ├── modules/           # Feature-based modules
│   │   │   ├── admin/        # Admin dashboard & settings
│   │   │   ├── auth/         # Authentication & authorization
│   │   │   ├── chalets/      # Chalet booking module
│   │   │   ├── pool/         # Pool ticket module
│   │   │   ├── restaurant/   # Restaurant order module
│   │   │   ├── snack/        # Snack bar module
│   │   │   ├── payments/     # Payment processing
│   │   │   ├── reviews/      # Customer reviews
│   │   │   └── users/        # User management
│   │   ├── services/         # Shared services (email, translation)
│   │   ├── socket/           # WebSocket handlers
│   │   ├── utils/            # Utility functions
│   │   ├── validation/       # Zod validation schemas
│   │   ├── app.ts            # Express app configuration
│   │   └── index.ts          # Entry point
│   └── package.json
│
├── frontend/                   # Next.js 14 Application
│   ├── messages/              # i18n translations (en, ar, fr)
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   │   ├── admin/       # Admin dashboard pages
│   │   │   ├── staff/       # Staff interface pages
│   │   │   ├── chalets/     # Chalet booking pages
│   │   │   ├── pool/        # Pool ticket pages
│   │   │   ├── restaurant/  # Restaurant order pages
│   │   │   ├── snack-bar/   # Snack bar pages
│   │   │   ├── profile/     # User profile
│   │   │   └── [slug]/      # Dynamic module pages
│   │   ├── components/       # Reusable UI components
│   │   │   ├── layout/      # Header, footer, navigation
│   │   │   ├── ui/          # Base UI components
│   │   │   ├── effects/     # Animations & transitions
│   │   │   └── settings/    # Settings components
│   │   ├── lib/              # Utilities & contexts
│   │   │   ├── api.ts       # API client with auth
│   │   │   ├── auth-context.tsx  # Auth state management
│   │   │   ├── settings-context.tsx  # Settings management
│   │   │   └── socket.ts    # WebSocket client
│   │   └── styles/           # Global styles
│   └── package.json
│
├── shared/                     # Shared TypeScript types
│   └── types/
│       └── index.ts
│
├── nginx/                      # Nginx configuration
│   └── nginx.conf
│
├── docker-compose.yml          # Container orchestration
└── README.md
```

---

## Core Technologies

### Frontend Stack
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **React Query** - Server state management
- **next-intl** - Internationalization (i18n)
- **Socket.io Client** - Real-time communication
- **Zod** - Schema validation
- **Stripe React** - Payment UI components

### Backend Stack
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Type-safe JavaScript
- **Supabase** - PostgreSQL database hosting
- **Socket.io** - Real-time WebSocket server
- **JWT** - Authentication tokens
- **Bcrypt** - Password hashing
- **Nodemailer** - Email delivery
- **Winston** - Logging framework
- **Zod** - Input validation
- **Stripe** - Payment processing
- **Helmet** - Security headers
- **express-rate-limit** - Rate limiting

---

## Security Features

### Authentication & Authorization
- **JWT-based authentication** with access tokens (15min) and refresh tokens (7days)
- **Role-based access control (RBAC)** with granular permissions
- **Password reset** via email with secure token expiration
- **Session management** with device tracking
- **Rate limiting** on authentication endpoints (5 attempts per 15 minutes)

### Input Validation
- **Zod schemas** validate all incoming data
- **Sanitization** removes XSS vulnerabilities
- **Type checking** at runtime and compile-time
- **Module guards** enforce business unit access

### Infrastructure Security
- **Helmet.js** sets security headers (XSS, CSP, HSTS)
- **CORS** restricts cross-origin requests
- **SQL injection prevention** via parameterized queries
- **Bcrypt** password hashing with salt rounds
- **Environment variable** protection for secrets

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user

### Restaurant Module
- `GET /api/restaurant/menu` - Get menu items
- `GET /api/restaurant/categories` - Get categories
- `POST /api/restaurant/orders` - Create order
- `GET /api/restaurant/orders` - Get user orders
- `PATCH /api/restaurant/orders/:id/status` - Update order status

### Chalet Module
- `GET /api/chalets` - List chalets
- `GET /api/chalets/:id` - Get chalet details
- `GET /api/chalets/:id/availability` - Check availability
- `POST /api/chalets/bookings` - Create booking
- `GET /api/chalets/bookings` - Get user bookings

### Pool Module
- `GET /api/pool/sessions` - List pool sessions
- `POST /api/pool/tickets` - Purchase ticket
- `GET /api/pool/tickets/:id` - Get ticket details
- `POST /api/pool/tickets/validate` - Validate QR code

### Admin Module
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `GET /api/admin/modules` - List modules
- `PATCH /api/admin/modules/:id` - Update module settings
- `GET /api/admin/settings` - Get site settings
- `PATCH /api/admin/settings` - Update settings

---

## Environment Variables Reference

### Backend Required Variables

```bash
# Server
PORT=3001                        # API server port
NODE_ENV=production              # Environment (development/production)

# Database
SUPABASE_URL=                    # Supabase project URL
SUPABASE_ANON_KEY=               # Supabase anonymous key
SUPABASE_SERVICE_KEY=            # Supabase service role key (admin access)

# Authentication
JWT_SECRET=                      # Secret for access tokens (use strong random string)
JWT_REFRESH_SECRET=              # Secret for refresh tokens (different from JWT_SECRET)

# Email
SMTP_HOST=                       # SMTP server hostname
SMTP_PORT=587                    # SMTP port (587 for TLS, 465 for SSL)
SMTP_USER=                       # SMTP username
SMTP_PASS=                       # SMTP password
SMTP_FROM=                       # From email address
SMTP_FROM_NAME=                  # From name

# Frontend
FRONTEND_URL=                    # Frontend URL (for email links)

# Payment
STRIPE_SECRET_KEY=               # Stripe secret key
STRIPE_WEBHOOK_SECRET=           # Stripe webhook signing secret
```

### Frontend Required Variables

```bash
NEXT_PUBLIC_API_URL=             # Backend API URL
NEXT_PUBLIC_SOCKET_URL=          # WebSocket server URL (usually same as API)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  # Stripe publishable key
```

---

## Database Schema

### Core Tables

**users**
- Authentication and profile information
- Relationships: roles, bookings, orders, tickets

**roles**
- Role definitions (admin, staff, customer)
- Permissions for module access

**modules**
- Dynamic business unit configuration
- Template type, enabled status, settings

**site_settings**
- White-label configuration
- Logo, colors, contact info, policies

**email_templates**
- Customizable email content
- Variable substitution support

### Module Tables

**menu_categories** → **menu_items**
- Restaurant and snack bar inventory
- Multi-language support, allergen tags

**restaurant_orders** → **restaurant_order_items**
- Order processing and tracking
- Status workflow, payment tracking

**chalets** → **chalet_bookings** → **chalet_add_ons**
- Accommodation management
- Availability tracking, pricing rules

**pool_sessions** → **pool_tickets**
- Session-based access control
- Capacity management, QR validation

**reviews**
- Customer feedback
- Rating and comments

See `backend/src/database/migration.sql` for complete schema.

---

## Troubleshooting

### Common Issues

**Database connection fails**
- Verify Supabase credentials in `.env`
- Check if database is accessible from your network
- Ensure service key has proper permissions

**Frontend can't connect to backend**
- Check `NEXT_PUBLIC_API_URL` points to correct backend URL
- Verify backend is running and accessible
- Check CORS configuration in `backend/src/app.ts`

**Email not sending**
- Verify SMTP credentials are correct
- Check if SMTP port is not blocked by firewall
- Test with a simple email client first

**Module not appearing**
- Check if module is enabled in database `modules` table
- Verify module slug matches route configuration
- Clear browser cache and reload

**WebSocket connection fails**
- Ensure Socket.io URL is correct
- Check if WebSocket traffic is allowed through firewall
- Verify CORS allows your frontend domain

---

## Performance Optimization

### Backend
- **Redis caching** for frequently accessed data
- **Database indexing** on query-heavy columns
- **Connection pooling** for database connections
- **Compression middleware** for API responses
- **Rate limiting** prevents abuse

### Frontend
- **Static generation** for public pages
- **Incremental static regeneration** for dynamic content
- **Image optimization** with Next.js Image component
- **Code splitting** reduces initial bundle size
- **React Query caching** minimizes redundant requests

---

## License

This project is proprietary software. See LICENSE file for terms.

---

## Support

### During Support Period (90 days)
**Email:** support@v2resort.com *(replace with actual support email)*  
**Response Time:** 24-48 hours on business days  
**Coverage:** Deployment, configuration, operational questions

### After Support Period
- Security updates provided for 12 months
- Extended support available at $150/month
- Community documentation and guides
- Hire independent developers for customization

---

## Credits

Built with modern web technologies by the V2 Resort development team.

**Key Dependencies:**
- Next.js by Vercel
- React by Meta
- PostgreSQL by PostgreSQL Global Development Group
- Supabase by Supabase Inc.
- Stripe by Stripe Inc.

---

**Ready to own your hospitality software?** [Contact us for pricing →](#next-steps)
