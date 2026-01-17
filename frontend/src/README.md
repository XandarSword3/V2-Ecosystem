# Frontend Source Code Architecture

This directory contains the Next.js 14 frontend application for the V2 Resort Management Platform.

## Directory Structure

```
src/
├── app/                # Next.js App Router pages and layouts
├── components/         # Reusable React components
├── hooks/              # Custom React hooks
├── i18n/               # Internationalization configuration
├── lib/                # Core libraries and utilities
├── store/              # State management (Zustand stores)
├── styles/             # Global CSS and Tailwind utilities
└── types/              # TypeScript type definitions
```

## App Router Structure (`app/`)

```
app/
├── [locale]/                    # Locale-prefixed routes (en, ar, fr)
│   ├── (public)/               # Public pages (landing, auth)
│   │   ├── page.tsx            # Landing page
│   │   ├── login/              # Authentication
│   │   └── register/
│   ├── (customer)/             # Customer portal
│   │   ├── dashboard/          # Customer dashboard
│   │   ├── orders/             # Order history
│   │   ├── cart/               # Shopping cart
│   │   └── [module]/           # Dynamic module pages
│   ├── (staff)/                # Staff interfaces
│   │   ├── kitchen/            # Kitchen display system
│   │   ├── pool/               # Pool management
│   │   └── chalets/            # Chalet check-in
│   └── admin/                  # Admin dashboard
│       ├── dashboard/          # Analytics & overview
│       ├── modules/            # Module management
│       ├── users/              # User administration
│       ├── settings/           # System settings
│       └── reports/            # Business reports
├── api/                        # Next.js API routes (minimal)
└── globals.css                 # Global styles
```

## Components Library (`components/`)

```
components/
├── admin/              # Admin-specific components
├── effects/            # Visual effects (particles, parallax)
├── layout/             # Layout components (Header, Sidebar, Footer)
├── module-builder/     # Visual UI builder for modules
├── modules/            # Module-specific components
├── settings/           # Settings UI components
└── ui/                 # Base UI components (Button, Input, Modal, etc.)
```

## State Management (`store/`)

Zustand stores for global state:

| Store | Purpose |
|-------|---------|
| `authStore` | Authentication state & tokens |
| `cartStore` | Shopping cart items |
| `settingsStore` | User preferences (theme, currency) |
| `moduleBuilderStore` | Visual builder state |

## Libraries (`lib/`)

Core utilities and integrations:

| File | Purpose |
|------|---------|
| `api.ts` | Axios instance with auth interceptors |
| `socket.ts` | Socket.io client hooks |
| `settings-context.tsx` | Settings provider |
| `translate.ts` | Content translation helpers |
| `utils.ts` | Common utilities (formatCurrency, cn) |
| `logger.ts` | Client-side logging |

## Internationalization (`i18n/`)

Three language support:
- **English** (`en`) - Default
- **Arabic** (`ar`) - RTL support
- **French** (`fr`)

Translation files in `messages/`:
```
messages/
├── en.json
├── ar.json
└── fr.json
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` | React framework |
| `react` | UI library |
| `tailwindcss` | Utility-first CSS |
| `@tanstack/react-query` | Server state management |
| `zustand` | Client state management |
| `framer-motion` | Animations |
| `next-intl` | Internationalization |
| `socket.io-client` | Real-time communication |
| `lucide-react` | Icons |
| `sonner` | Toast notifications |

## Styling

- **Tailwind CSS** for utility classes
- **CSS Variables** for theming (colors, fonts)
- **Dark Mode** support via `next-themes`
- **RTL Support** for Arabic language

## Running the Frontend

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Run tests (264 tests)
npm test

# Lint & format
npm run lint
npm run format
```

## Environment Variables

```env
# API
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# Sentry (optional)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

---

See component-specific READMEs for detailed documentation.
