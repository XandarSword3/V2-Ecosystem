# Backend Services

Cross-cutting services that provide shared functionality across all modules.

## Service Overview

| Service | Purpose |
|---------|---------|
| `backup.service.ts` | Database backup automation |
| `email.service.ts` | Email sending (SMTP/SendGrid) |
| `scheduled-reports.service.ts` | Automated report generation |
| `scheduler.service.ts` | Cron job management |
| `translation.service.ts` | Content translation (AI-powered) |
| `two-factor.service.ts` | 2FA TOTP implementation |
| `webhookIdempotency.service.ts` | Stripe webhook deduplication |

## Email Service

Handles all outbound email communications.

### Configuration

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-key
EMAIL_FROM=noreply@v2resort.com
```

### Usage

```typescript
import { emailService } from '@/services/email.service';

// Send welcome email
await emailService.sendWelcome(user);

// Send password reset
await emailService.sendPasswordReset(email, resetToken);

// Send order confirmation
await emailService.sendOrderConfirmation(order);

// Send booking confirmation
await emailService.sendBookingConfirmation(booking);
```

### Email Templates

Templates are stored as HTML with handlebars-style variables:

- `welcome.html` - New user registration
- `password-reset.html` - Password reset link
- `order-confirmation.html` - Order receipt
- `booking-confirmation.html` - Booking details

## Two-Factor Authentication Service

Implements TOTP (Time-based One-Time Password) for 2FA.

### Usage

```typescript
import { twoFactorService } from '@/services/two-factor.service';

// Generate secret for user
const { secret, qrCodeUrl } = await twoFactorService.generateSecret(userId);

// Verify code during login
const isValid = twoFactorService.verifyCode(secret, userInputCode);
```

### Flow

1. User enables 2FA in settings
2. Generate secret and display QR code
3. User scans with authenticator app
4. User verifies with first code
5. Secret saved to database (encrypted)
6. On login, prompt for TOTP code

## Scheduler Service

Manages scheduled background tasks using node-cron.

### Scheduled Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| Session cleanup | Daily 3 AM | Remove expired sessions |
| Report generation | Daily 6 AM | Generate daily reports |
| Backup | Daily 2 AM | Database backup |
| Cache cleanup | Hourly | Clear expired cache |

### Adding New Task

```typescript
import { schedulerService } from '@/services/scheduler.service';

schedulerService.addJob('my-task', '0 0 * * *', async () => {
  // Runs daily at midnight
  await performTask();
});
```

## Backup Service

Automated database backup to cloud storage.

### Configuration

```env
BACKUP_ENABLED=true
BACKUP_STORAGE=s3
AWS_S3_BUCKET=v2resort-backups
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

### Manual Backup

```typescript
import { backupService } from '@/services/backup.service';

// Create backup
const backupUrl = await backupService.createBackup();

// List backups
const backups = await backupService.listBackups();

// Restore from backup
await backupService.restore(backupId);
```

## Translation Service

AI-powered content translation for multilingual support.

### Usage

```typescript
import { translationService } from '@/services/translation.service';

// Translate menu item
const translated = await translationService.translate({
  text: 'Grilled Salmon with Vegetables',
  from: 'en',
  to: ['ar', 'fr']
});

// Result: { ar: 'سلمون مشوي مع خضروات', fr: 'Saumon grillé avec légumes' }
```

### Caching

Translations are cached to reduce API calls:

```typescript
// Check cache first
const cached = await translationService.getCached(text, targetLang);
if (cached) return cached;

// Translate and cache
const translation = await translationService.translate(...);
await translationService.cache(text, targetLang, translation);
```

## Webhook Idempotency Service

Prevents duplicate processing of Stripe webhooks.

### How It Works

1. Extract idempotency key from webhook
2. Check if key already processed
3. If new, process and mark as handled
4. If duplicate, skip processing

### Usage

```typescript
import { webhookIdempotencyService } from '@/services/webhookIdempotency.service';

app.post('/webhook', async (req, res) => {
  const eventId = req.body.id;
  
  if (await webhookIdempotencyService.isDuplicate(eventId)) {
    return res.status(200).json({ received: true, duplicate: true });
  }
  
  // Process webhook...
  
  await webhookIdempotencyService.markProcessed(eventId);
  res.status(200).json({ received: true });
});
```

## Scheduled Reports Service

Generates and delivers automated business reports.

### Report Types

- Daily sales summary
- Weekly booking report
- Monthly revenue analysis
- User activity report

### Configuration

```typescript
// Schedule weekly report for Mondays at 8 AM
scheduledReportsService.schedule('weekly-sales', {
  cron: '0 8 * * 1',
  recipients: ['manager@v2resort.com'],
  format: 'pdf'
});
```

---

See individual service files for detailed implementation and configuration options.
