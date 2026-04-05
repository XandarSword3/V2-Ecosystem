# Backend Services

33 shared services in `src/services/` providing cross-cutting functionality used by multiple modules.

## Service Inventory

| Service | Purpose |
|---------|---------|
| `backup.service.ts` | Database backup creation and retention management |
| `backup-verification.service.ts` | Backup integrity verification |
| `booking-modification.service.ts` | Booking change/cancel logic |
| `booking-reminders.service.ts` | Automated booking reminder emails |
| `bounce-handler.service.ts` | Email bounce processing |
| `business-config.service.ts` | Business-level configuration |
| `business-metrics.service.ts` | KPI and metrics calculation |
| `chargeback.service.ts` | Payment chargeback handling |
| `currency.service.ts` | Multi-currency conversion |
| `dynamic-translation.service.ts` | Runtime translation management |
| `email.service.ts` | Email sending via Nodemailer |
| `email-analytics.service.ts` | Email open/click tracking |
| `email-rate-limiter.service.ts` | Email send rate limiting |
| `notification-preferences.service.ts` | User notification preferences |
| `order-config.service.ts` | Order system configuration |
| `password-policy.service.ts` | Password strength and policy enforcement |
| `performance-monitoring.service.ts` | Application performance monitoring |
| `pool-membership.service.ts` | Pool/amenity membership management |
| `pushNotification.service.ts` | Push notification delivery |
| `rate-limiter.service.ts` | API rate limiting |
| `restaurant-table.service.ts` | Restaurant table management |
| `scheduler.service.ts` | Cron job scheduling (node-cron) |
| `seasonal-pricing.service.ts` | Season-based price adjustments |
| `security-audit.service.ts` | Security event logging |
| `sms.service.ts` | SMS sending via Twilio |
| `stripe-platform.service.ts` | Stripe payment processing |
| `tax.service.ts` | Tax calculation |
| `terminology.service.ts` | White-label terminology management |
| `tracing.service.ts` | Distributed tracing (OpenTelemetry) |
| `translation.service.ts` | Translation file management |
| `two-factor.service.ts` | 2FA setup and verification |
| `webhook-retry.service.ts` | Webhook delivery with retries |
| `webhookIdempotency.service.ts` | Webhook deduplication |
