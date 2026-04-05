# Backend Modules

38 feature modules, each typically containing a controller, service, and routes file. All mounted under `/api/v1/` via `app.ts`.

## Module Inventory

| Module | Route Mount | Description |
|--------|-------------|-------------|
| `accommodations/` | — | Accommodation type definitions |
| `admin/` | `/admin` | Admin dashboard, module management, settings, analytics |
| `auth/` | `/auth` | Authentication (login, register, JWT, OAuth, 2FA) |
| `bookings/` | `/bookings` | Booking creation and modification |
| `chalets/` | `/chalets` | Chalet unit management, pricing, availability |
| `channels/` | `/channels` | OTA channel management (Booking.com, Expedia sync) |
| `coupons/` | `/coupons` | Coupon creation, validation, redemption |
| `customization/` | `/customizations` | Unified customization system for all modules |
| `devices/` | `/devices` | Device registration and management |
| `finance/` | `/finance` | Financial operations and reporting |
| `gdpr/` | `/gdpr` | GDPR compliance (data export, deletion) |
| `giftcards/` | `/giftcards` | Gift card issuance and redemption |
| `groups/` | `/groups` | Group booking management |
| `housekeeping/` | `/housekeeping` | Room cleaning schedules, task assignment |
| `i18n/` | `/i18n` | Internationalization management |
| `integrations/` | — | External integrations (QuickBooks — currently disabled) |
| `inventory/` | `/inventory` | Stock tracking and management |
| `kiosk/` | `/kiosk` | Self-service kiosk endpoints |
| `loyalty/` | `/loyalty` | Loyalty program (points, tiers, redemption) |
| `manager/` | `/manager` | Manager-level operations and approvals |
| `marketing/` | `/marketing` | Marketing campaigns and email lists |
| `messaging/` | `/messaging` | Guest messaging system |
| `mobile-checkin/` | `/mobile-checkin` | Mobile check-in/check-out |
| `multi-property/` | `/multi-property` | Multi-property management |
| `parity/` | `/rate-parity` | Rate parity monitoring across channels |
| `payments/` | `/payments` | Payment processing (Stripe, platform payments) |
| `pool/` | `/pool` | Pool/amenity scheduling and sessions |
| `pos/` | `/pos` | POS hardware integration |
| `promotions/` | — | Promotion engine (used internally) |
| `public/` | `/` (root) | Public-facing API endpoints |
| `reporting/` | `/reporting` | Reporting and analytics |
| `restaurant/` | `/restaurant` | Restaurant orders, menu, modifiers, waitlist |
| `revenue/` | `/revenue` | Revenue management and forecasting |
| `reviews/` | `/reviews` | Guest review collection and management |
| `snack/` | `/snack` | Snack bar orders and menu |
| `staff/` | `/staff` | Staff management, shifts, module assignments |
| `support/` | `/support` | Support ticket system |
| `users/` | `/users` | User profile management |

## Notes

- Each module is self-contained with its own routes, controller, and service
- QuickBooks integration (`integrations/`) is disabled — it uses PrismaClient and needs Supabase refactoring
- `accommodations/` and `promotions/` do not have their own route mounts; they are used as internal services
