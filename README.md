# V2 Resort Management Platform

[![CI Pipeline](https://img.shields.io/badge/CI-Passing-success)](https://github.com/XandarSword3/V2-Ecosystem)
[![Coverage](https://img.shields.io/badge/Coverage-43.16%25-informational)](https://github.com/XandarSword3/V2-Ecosystem)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

A state-of-the-art, monorepo-based resort management ecosystem designed for luxury hospitality. Featuring a dynamic module architecture, real-time staff dashboards, and a visual module builder.

## ✨ Core Pillars

- **🚀 Dynamic Architecture**: Decoupled module routing and a visual **Module Builder** for rapid feature deployment.
- **📱 Multi-Platform**: Full-featured Next.js 14 web application and an Expo-based mobile companion (in progress).
- **🛡️ Enterprise Security**: Role-Based Access Control (RBAC), 2FA, JWT with rotation, and full audit logging.
- **🌐 Global Ready**: Native i18n support (EN/AR/FR) with RTL layout handling and multi-currency formatting.
- **🔌 Offline Resilience**: Workbox-powered PWA with IndexedDB syncing, allowing critical staff operations during connectivity outages.

## 🏗️ Repository Structure

```text
v2-resort/
├── backend/          # Node.js/Express API with 30+ domain modules
├── frontend/         # Next.js 14 Customer & Admin Web Apps
├── mobile/           # React Native (Expo) Mobile App [BETA]
├── shared/           # Common TypeScript types and API contracts
├── supabase/         # PostgreSQL schema and database migrations
├── infrastructure/   # Docker, Nginx, and deployment configs
├── tests/            # Playwright E2E and Vitest unit suites
└── archive/          # [GITIGNORED] Historical reports and logs
```

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.io, Drizzle ORM, Supabase (PostgreSQL)
- **Frontend**: Next.js 14, Tailwind CSS, Framer Motion, Zustand, TanStack Query
- **Mobile**: React Native, Expo, NativeWind
- **Operations**: Docker, GitHub Actions, Sentry, Stripe, Twilio

## 🚀 Getting Started

### 1. Installation
```bash
# Install workspace dependencies
npm install
```

### 2. Environment Setup
Create `.env` files in both `backend/` and `frontend/` using the provided `.env.example` templates.

### 3. Development Mode
```bash
# Start backend and frontend simultaneously
npm run dev
```

## 🧪 Testing & Quality
```bash
# Run all unit tests
npm run test

# Run frontend coverage
npm run test:cov --prefix frontend
```

---

For detailed documentation, visit the [Documentation Index](docs/README.md).
