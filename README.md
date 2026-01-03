# V2 Resort Management System

<p align="center">
  <img src="frontend/public/v2-logo.png" alt="V2 Resort Logo" width="200"/>
</p>

A comprehensive full-stack resort management system for V2 Resort in Lebanon, featuring 4 integrated business units: Restaurant, Snack Bar, Chalets, and Pool.

## 🌟 Project Overview

This project was built using **AI-assisted development with GitHub Copilot** and **Claude** to create a production-ready resort management ecosystem. The system handles everything from customer-facing bookings to staff operations and administrative analytics.

### Live Deployments
- **Frontend**: [https://v2-ecosystem.vercel.app](https://v2-ecosystem.vercel.app)
- **Backend API**: [https://v2-resort-backend.onrender.com](https://v2-resort-backend.onrender.com)

## 🏗️ Architecture

```
v2-resort/
├── backend/                    # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── config/            # Environment configuration
│   │   ├── database/          # Database connection & migrations
│   │   ├── middleware/        # Auth, logging, error handling
│   │   ├── modules/           # Feature modules (auth, restaurant, chalets, etc.)
│   │   └── utils/             # Helpers, logger, translations
│   └── package.json
├── frontend/                   # Next.js 14 + React + Tailwind CSS
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   ├── components/        # Reusable UI components
│   │   └── lib/               # API client, auth, utilities
│   └── package.json
├── Planning.txt               # Project planning document
└── README.md
```

## 🚀 Features

### 🍽️ Restaurant Module
- Multi-language menu browsing (English, Arabic, French)
- Category-based menu organization
- Real-time order placement (dine-in/takeaway/delivery)
- Kitchen display system with Kanban-style order management
- Auto-translation of menu items using Google Translate API
- Dietary filters (vegetarian, vegan, gluten-free)

### 🏕️ Chalets Module
- Chalet listings with amenities and image galleries
- Real-time availability calendar
- Online booking with add-ons (BBQ, extra beds, etc.)
- Weekend/weekday pricing differentiation
- Booking management for staff (check-in/check-out)

### 🏊 Pool Module
- Session-based pool access
- QR code ticket generation
- Capacity management and real-time tracking
- Family/group ticket support
- Staff ticket validation via scanner

### 🍿 Snack Bar Module
- Quick-order menu for poolside service
- Simplified checkout flow
- Order tracking and notifications

### 👔 Staff Portal
- Role-based dashboards for each business unit
- Kitchen display with real-time order updates
- **Detailed Order Views**: Modal-based deep dive into order specifics (items, notes, customer info)
- QR code scanner for ticket validation
- Booking management interface

### 👤 Admin Dashboard
- **Real-time Analytics**: Live counter of online users and active sessions
- **Business Intelligence**: Revenue reports, booking statistics, order trends
- **User Management**: Staff accounts, role assignments, permissions
- **Content Management**: Menu items, chalets, pool sessions, add-ons
- **Settings**: Site configuration, testimonials, business hours
- **Audit Logs**: Track all administrative actions
- **Security**: Failed login monitoring, session management

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js 20+ | Runtime environment |
| Express.js | Web framework |
| TypeScript | Type safety |
| Supabase | PostgreSQL database hosting |
| Socket.io | Real-time bi-directional communication |
| JWT + bcrypt | Authentication & password hashing |
| Winston | Logging with file & console output |
| Zod | Request validation |
| Google Translate API | Auto-translation service |

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 14 | React framework with App Router |
| React 18 | UI library |
| Tailwind CSS | Utility-first styling |
| Framer Motion | Animations |
| next-intl | Internationalization (i18n) |
| Sonner | Toast notifications |
| Lucide React | Icon library |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Vercel | Frontend hosting (auto-deploy from GitHub) |
| Render | Backend hosting (auto-deploy from GitHub) |
| Supabase | PostgreSQL database + auth |
| GitHub | Source control |

## 🔐 Security Features

- **JWT Authentication** with short-lived access tokens (15 min) and refresh tokens (7 days)
- **Separate Secrets** for access and refresh tokens
- **Password Hashing** with bcrypt (10 salt rounds)
- **Rate Limiting** on all API endpoints (100 requests/15 min general, 10/15 min for auth)
- **CORS Protection** with whitelisted origins
- **Helmet.js** for security headers
- **Input Validation** with Zod schemas
- **XSS Protection** built into React
- **Audit Logging** for admin actions
- **Owner Verification** for sensitive operations

## 📋 Environment Variables

### Backend (.env)
```env
# Server
PORT=3001
NODE_ENV=production

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Auth
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=https://your-frontend.vercel.app

# Google Translate (optional)
GOOGLE_API_KEY=your-google-api-key
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api
```

## 🏃‍♂️ Local Development

### Prerequisites
- Node.js 20+
- npm or yarn
- Supabase account (or local PostgreSQL)

### Setup

```bash
# Clone the repository
git clone https://github.com/AlessandroFare/V2-Ecosystem.git
cd V2-Ecosystem/v2-resort

# Install backend dependencies
cd backend
npm install
cp .env.example .env  # Configure your environment variables

# Install frontend dependencies
cd ../frontend
npm install
cp .env.example .env.local  # Configure your environment variables

# Run migrations (if needed)
cd ../backend
# Run the SQL migration in Supabase SQL Editor: src/database/migration.sql

# Start development servers
cd ..
npm run dev  # Runs both backend and frontend concurrently
```

### Development URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001/api
- **Admin Dashboard**: http://localhost:3000/admin
- **Staff Portal**: http://localhost:3000/staff

## 📊 API Endpoints

### Authentication
```
POST /api/auth/register     - Register new user
POST /api/auth/login        - Login and get tokens
POST /api/auth/refresh      - Refresh access token
POST /api/auth/logout       - Logout and invalidate refresh token
GET  /api/auth/me           - Get current user profile
```

### Restaurant
```
GET  /api/restaurant/menu/categories  - Get menu categories
GET  /api/restaurant/menu/items       - Get menu items
POST /api/restaurant/orders           - Create order
GET  /api/restaurant/orders/:id       - Get order details
```

### Chalets
```
GET  /api/chalets                     - List all chalets
GET  /api/chalets/:id                 - Get chalet details
GET  /api/chalets/:id/availability    - Check availability
POST /api/chalets/bookings            - Create booking
GET  /api/chalets/add-ons             - Get available add-ons
```

### Pool
```
GET  /api/pool/sessions               - Get pool sessions
POST /api/pool/tickets                - Purchase ticket
GET  /api/pool/tickets/:id            - Get ticket details
```

### Admin (Protected)
```
GET  /api/admin/dashboard             - Dashboard statistics
GET  /api/admin/users                 - List all users
POST /api/admin/users                 - Create user
PUT  /api/admin/roles/:id             - Update user roles
GET  /api/admin/settings              - Get site settings
PUT  /api/admin/settings              - Update site settings
GET  /api/admin/audit-logs            - View audit logs
```

## 📁 Database Schema

The database uses PostgreSQL with the following main tables:

- **users** - User accounts and profiles
- **roles** / **user_roles** - Role-based access control
- **menu_categories** / **menu_items** - Restaurant menu
- **restaurant_orders** / **order_items** - Order management
- **chalets** / **chalet_bookings** - Chalet management
- **chalet_add_ons** / **booking_add_ons** - Booking extras
- **pool_sessions** / **pool_tickets** - Pool management
- **snack_items** / **snack_orders** - Snack bar
- **testimonials** - Customer reviews
- **site_settings** - Dynamic configuration
- **audit_logs** - Admin action tracking

## 🌐 Internationalization

The system supports three languages:
- **English (en)** - Default
- **Arabic (ar)** - RTL support
- **French (fr)**

Translation files are located in `frontend/messages/` and use the `next-intl` library.

## 📝 Logging System

The backend uses Winston for comprehensive logging:

```
logs/
├── error.log    # Error-level logs only
└── all.log      # All log levels
```

Log levels: `error` > `warn` > `info` > `http` > `debug`

Request logging includes:
- Request ID for tracking
- Request body (sensitive fields redacted)
- Response status and timing
- Error stack traces

## 🚢 Deployment

### Frontend (Vercel)
1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Auto-deploys on push to `main` branch

### Backend (Render)
1. Connect GitHub repository to Render
2. Set build command: `npm install && npm run build`
3. Set start command: `npm start`
4. Configure environment variables
5. Auto-deploys on push to `main` branch

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ for V2 Resort, Lebanon
- AI-assisted development with GitHub Copilot & Claude
- UI components inspired by shadcn/ui

---

**V2 Resort Management System** - *Making resort management seamless*
