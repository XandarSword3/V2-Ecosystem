# Payments Module

Payment processing via Stripe.

## Route Mounts

- `/api/v1/payments` — Core payment routes
- `/api/v1/payments/platform` — Platform-specific (Apple Pay, Google Pay)

## Contents (5 files)

- `payment.controller.ts` — Payment request handlers
- `payment.service.ts` — Core payment logic
- `payment.routes.ts` — Standard routes
- `payment.v1.routes.ts` — Platform-aware routes
- Additional payment method handlers

## Features

- Stripe payment intents
- Apple Pay / Google Pay via Stripe
- Chargeback handling (via `chargeback.service.ts`)
- Webhook processing
- Idempotency for duplicate prevention
