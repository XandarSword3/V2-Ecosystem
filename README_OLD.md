# V2 Resort Ecosystem

A modern, full-stack resort management platform designed for V2 Resort in Lebanon. This ecosystem integrates four key business unitsRestaurant, Snack Bar, Chalets, and Poolinto a unified experience for guests, staff, and administrators.

##  Live Demo

- **Frontend (Vercel)**: [https://v2-ecosystem.vercel.app](https://v2-ecosystem.vercel.app)
- **Backend (Render)**: [https://v2-resort-backend.onrender.com](https://v2-resort-backend.onrender.com)

##  Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Framer Motion (Animations)
- **State Management**: React Query, Context API
- **Internationalization**: next-intl (English, Arabic, French)
- **UI Components**: Lucide React, Sonner (Toasts)

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Socket.io
- **Authentication**: JWT (Access/Refresh Tokens)
- **Logging**: Winston

##  Modules

### 1.  Restaurant
- **Guest**: Browse menu (multi-language), filter by dietary needs, place orders (Dine-in/Takeaway/Delivery).
- **Staff**: Kitchen Display System (KDS) for real-time order tracking.
- **Admin**: Menu management, sales reports.

### 2.  Snack Bar
- **Guest**: Quick ordering for pool-side snacks.
- **Staff**: Simplified order queue.
- **Admin**: Category and item management.

### 3.  Chalets
- **Guest**: View chalets, check availability, book stays.
- **Admin**: Booking management, pricing rules, availability calendar.

### 4.  Pool
- **Guest**: Purchase day passes, view capacity.
- **Staff**: QR code scanner for entry validation.
- **Admin**: Capacity management, pricing settings.

##  Installation & Setup

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Supabase account

### 1. Clone the Repository
`ash
git clone https://github.com/yourusername/v2-resort.git
cd v2-resort
` 

### 2. Backend Setup
`ash
cd backend
npm install

# Create .env file
cp .env.example .env
# Update .env with your Supabase credentials and other secrets

# Run development server
npm run dev
` 

### 3. Frontend Setup
`ash
cd frontend
npm install

# Create .env.local file
cp .env.example .env.local
# Update .env.local with API URL (http://localhost:3001/api)

# Run development server
npm run dev
` 

##  Project Structure

` 
v2-resort/
 backend/                 # Express API
    src/
       config/         # App configuration
       database/       # Supabase connection & schemas
       middleware/     # Auth, Validation, Logging
       modules/        # Feature-based architecture
          admin/
          auth/
          chalets/
          pool/
          restaurant/
          snack/
          users/
       socket/         # Real-time event handlers
    ...
 frontend/                # Next.js App
    messages/           # i18n translation files
    src/
       app/            # App Router pages
          admin/      # Admin Dashboard
          staff/      # Staff Interfaces
          ...         # Public Pages
       components/     # Reusable UI components
       lib/            # Utilities & API clients
       ...
    ...
 ...
` 

##  Security Features
- **Role-Based Access Control (RBAC)**: Granular permissions for Admin, Staff (per unit), and Customers.
- **JWT Authentication**: Secure session management with refresh tokens.
- **Input Validation**: Zod schemas and middleware sanitization.
- **Rate Limiting**: Protection against brute-force attacks.

##  Contributing
1. Fork the repository
2. Create your feature branch (git checkout -b feature/AmazingFeature)
3. Commit your changes (git commit -m 'Add some AmazingFeature')
4. Push to the branch (git push origin feature/AmazingFeature)
5. Open a Pull Request

##  License
This project is proprietary software for V2 Resort.
