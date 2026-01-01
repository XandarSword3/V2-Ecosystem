# V2 Resort Management System

A comprehensive full-stack resort management system for a Lebanese resort with 4 business units: Restaurant, Snack Bar, Chalets, and Pool.

## 🏗️ Architecture

```
v2-resort/
├── backend/          # Node.js + Express + TypeScript API
├── frontend/         # Next.js 14 + React + Tailwind CSS
├── shared/           # Shared TypeScript types
├── nginx/            # Nginx reverse proxy config
└── docker-compose.yml
```

## 🚀 Features

### Customer-Facing
- **Restaurant**: Browse menu, place orders (dine-in/takeaway), track order status
- **Snack Bar**: Quick ordering for poolside refreshments
- **Chalets**: Browse, check availability, book with add-ons
- **Pool**: View sessions, purchase tickets with QR codes

### Staff Portal
- **Kitchen Display**: Real-time order management (Kanban-style)
- **Chalet Management**: Check-in/check-out, booking management
- **Pool Operations**: Ticket validation, capacity tracking

### Admin Dashboard
- **Analytics**: Revenue reports, order statistics by unit
- **User Management**: Staff accounts, role assignments
- **Content Management**: Menu items, chalets, pool sessions
- **Settings**: Business hours, pricing rules, notifications

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL 15
- **Auth**: JWT + Refresh Tokens, bcrypt
- **Real-time**: Socket.IO
- **Payments**: Stripe
- **Validation**: Zod
- **Logging**: Winston

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI**: React 18 + Tailwind CSS
- **State**: Zustand + React Query
- **Forms**: React Hook Form + Zod
- **Real-time**: Socket.IO Client

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Cache**: Redis (optional)

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or yarn
- Docker (optional, for containerized deployment)

## 🏃‍♂️ Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/v2-resort.git
cd v2-resort

# Install all dependencies
npm install
```

### 2. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials and secrets

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with API URLs
```

### 3. Setup Database

```bash
# Create PostgreSQL database
createdb v2resort

# Run migrations
cd backend
npm run migrate

# Seed initial data
npm run seed
```

### 4. Start Development

```bash
# From root directory - starts both backend and frontend
npm run dev

# Or separately:
cd backend && npm run dev  # Backend on http://localhost:3001
cd frontend && npm run dev # Frontend on http://localhost:3000
```

### 5. Access the Application

- **Customer Portal**: http://localhost:3000
- **Staff Portal**: http://localhost:3000/staff
- **Admin Dashboard**: http://localhost:3000/admin
- **API**: http://localhost:3001/api

**Default Admin Credentials:**
- Email: admin@v2resort.com
- Password: admin123

## 🐳 Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📁 Project Structure

### Backend

```
backend/src/
├── config/           # Environment configuration
├── database/
│   ├── connection.ts # Database connection
│   ├── schema/       # Drizzle ORM schemas
│   ├── migrate.ts    # Migration script
│   └── seed.ts       # Seed data
├── middleware/       # Express middleware
├── modules/
│   ├── auth/         # Authentication
│   ├── restaurant/   # Restaurant orders & menu
│   ├── snack/        # Snack bar
│   ├── chalets/      # Chalet bookings
│   ├── pool/         # Pool tickets
│   ├── payments/     # Stripe integration
│   └── admin/        # Admin dashboard
├── socket/           # Socket.IO events
├── utils/            # Helpers & logger
├── app.ts            # Express app setup
└── index.ts          # Entry point
```

### Frontend

```
frontend/src/
├── app/              # Next.js App Router pages
│   ├── (auth)/       # Login, register
│   ├── restaurant/   # Restaurant menu & ordering
│   ├── chalets/      # Chalet listings & booking
│   ├── pool/         # Pool tickets
│   ├── snack-bar/    # Snack bar menu
│   ├── staff/        # Staff portals
│   └── admin/        # Admin dashboard
├── components/       # Reusable components
├── lib/
│   ├── api.ts        # API client
│   ├── auth-context.tsx # Auth provider
│   ├── socket.ts     # Socket.IO hooks
│   └── utils.ts      # Utilities
└── styles/           # Global CSS
```

## 🔐 Authentication

The system uses JWT-based authentication with refresh tokens:

- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Tokens are stored in localStorage
- Automatic token refresh on 401 responses

### Roles

- `customer` - Regular users
- `restaurant_staff` - Kitchen/serving staff
- `snack_bar_staff` - Snack bar operations
- `chalet_staff` - Chalet check-in/out
- `pool_staff` - Pool ticket validation
- `super_admin` - Full system access

## 💳 Payments

Integrated with Stripe for online payments:

- PaymentIntent flow for secure payments
- Webhook handling for payment confirmation
- Cash payment recording for staff
- Support for partial payments (deposits)

## 🔔 Real-time Features

Socket.IO rooms for targeted updates:

- `restaurant-kitchen` - New orders for kitchen staff
- `order-{id}` - Status updates for specific orders
- `chalets-staff` - New bookings
- `pool-staff` - Ticket validations

## 📊 API Endpoints

### Public
- `GET /api/restaurant/menu` - Menu items
- `GET /api/chalets` - Available chalets
- `GET /api/pool/sessions` - Pool sessions

### Authenticated
- `POST /api/restaurant/orders` - Create order
- `POST /api/chalets/bookings` - Create booking
- `POST /api/pool/tickets` - Purchase ticket

### Staff
- `GET /api/restaurant/staff/orders` - All orders
- `PATCH /api/restaurant/staff/orders/:id/status` - Update status
- `POST /api/chalets/staff/bookings/:id/check-in` - Check-in

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/reports/revenue` - Revenue reports
- `POST /api/admin/users` - Create staff user

## 🧪 Testing

```bash
# Run backend tests
cd backend && npm test

# Run frontend tests
cd frontend && npm test
```

## 📝 Lebanese Context

This system is designed for the Lebanese market:

- **Currency**: USD (default, common in Lebanon)
- **Weekend**: Friday-Saturday pricing for chalets
- **Languages**: English, Arabic (RTL support), French
- **Payments**: Cash-first with optional card/online
- **VAT**: 11% tax calculation

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ for V2 Resort
