# Payments Module

Stripe-based payment processing for orders and bookings.

## Features

- **Stripe Checkout** - Hosted payment page
- **Webhook Handling** - Async payment confirmation
- **Multi-currency** - USD, SAR, EUR support
- **Refunds** - Full and partial refunds
- **Payment History** - Transaction records

## API Endpoints

### Checkout

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/payments/checkout` | Create checkout session |
| `GET` | `/payments/checkout/:id` | Session status |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/payments/webhook` | Stripe webhook handler |

### History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/payments/history` | User's payments |
| `GET` | `/payments/:id` | Payment details |

### Refunds (Admin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/payments/:id/refund` | Process refund |

## Checkout Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Payment Flow                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Client: POST /payments/checkout                         │
│     { orderId, successUrl, cancelUrl }                      │
│                                                              │
│  2. Server: Create Stripe Checkout Session                  │
│     Response: { checkoutUrl }                                │
│                                                              │
│  3. Client: Redirect to checkoutUrl                         │
│     (Stripe hosted page)                                     │
│                                                              │
│  4. Customer completes payment                              │
│                                                              │
│  5. Stripe: POST /payments/webhook                          │
│     Event: checkout.session.completed                        │
│                                                              │
│  6. Server: Update order status → 'confirmed'               │
│     Send confirmation email                                  │
│                                                              │
│  7. Stripe: Redirect to successUrl                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Checkout Request

```typescript
interface CheckoutRequest {
  type: 'order' | 'booking';
  referenceId: string;        // Order or booking ID
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}
```

## Checkout Response

```typescript
interface CheckoutResponse {
  sessionId: string;
  checkoutUrl: string;
}
```

## Webhook Events

Handled Stripe events:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Confirm order/booking |
| `payment_intent.succeeded` | Log successful payment |
| `payment_intent.failed` | Log failure, notify user |
| `charge.refunded` | Update refund status |

## Webhook Security

```typescript
// Verify Stripe signature
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(
  req.body,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

## Idempotency

Webhooks are deduplicated:

```typescript
if (await webhookService.isDuplicate(event.id)) {
  return res.status(200).json({ received: true, duplicate: true });
}
// Process...
await webhookService.markProcessed(event.id);
```

## Data Models

### Payment

```typescript
{
  id: UUID,
  userId: UUID,
  type: 'order' | 'booking',
  referenceId: UUID,
  amount: number,
  currency: string,
  stripeSessionId: string,
  stripePaymentIntentId: string,
  status: PaymentStatus,
  metadata: Record<string, string>,
  createdAt: Date
}

type PaymentStatus = 
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';
```

### Refund

```typescript
{
  id: UUID,
  paymentId: UUID,
  amount: number,
  reason?: string,
  stripeRefundId: string,
  status: 'pending' | 'succeeded' | 'failed',
  processedBy: UUID,
  createdAt: Date
}
```

## Configuration

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=usd
```

## Testing

Use Stripe test mode:

```env
STRIPE_SECRET_KEY=sk_test_...
```

Test cards:
- `4242424242424242` - Succeeds
- `4000000000000002` - Declines
- `4000002500003155` - Requires 3D Secure

---

See Stripe documentation for complete API reference.
