# Backend Infrastructure Subsystem (`backend/src/services`)

## 🎯 Purpose
The **Infrastructure Subsystem** encapsulates all technical capabilities, external integrations, and cross-cutting functional requirements that are agnostic to the specific business domain of the resort.

## 📦 Scope
### Explicitly Owns:
*   **External Integrations**: Stripe (`stripe-platform`), SendGrid/SMTP (`email`), Twilio (`sms`).
*   **Background Jobs**: Scheduling Cron jobs (`scheduler`), retry queues (`webhook-retry`).
*   **Operations**: Database Backups (`backup`), Health Checks (`backup-verification`).
*   **Security & Safety**: Rate Limiting (`rate-limiter`), Password Policy (`password-policy`), 2FA (`two-factor`).

### Does NOT Own:
*   **Business Rules**: It sends emails, but doesn't calculate *when* to send a booking confirmation (that's `booking.service.ts`).
*   **Data Persistence**: It operates on ephemeral tasks or configuration, not core business entities.

## 🏗️ Internal Architecture
*   **Service-based**: Each capability is a standalone service (e.g., `EmailService`, `SchedulerService`).
*   **Stateless**: Most services are stateless wrappers around external APIs.
*   **Singleton Pattern**: Most services are exported as singletons or static classes.

## 🧩 Key Components

### 1. Scheduler (`scheduler.service.ts`)
*   **Engine**: `node-cron`.
*   **Responsibility**:
    *   `0 3 * * *`: Automated DB Backup.
    *   `0 */4 * * *`: Expiry of unpaid pool tickets.
    *   `0 4 * * *`: Cleanup of stale sessions.

### 2. Email Service (`email.service.ts`)
*   **Engine**: `nodemailer` with potential fallback logic.
*   **Abilities**: Templated HTML emails for Auth (Reset Password), Receipts, and Alerts.

### 3. Payment Platform (`stripe-platform.service.ts` / `payment.service.ts`)
*   **Capability**: Wraps Stripe Node.js SDK.
*   **Features**: Intent creation, Webhook signature verification, Refund processing.

## 🔄 Data Flow (Example: Scheduled Backup)
1.  **Trigger**: `node-cron` fires at 03:00.
2.  **Action**: `SchedulerService` calls `BackupService.createBackup()`.
3.  **Process**: `pg_dump` executed via child process.
4.  **Storage**: File uploaded to Supabase Storage (if configured) or local disk.
5.  **Verification**: `BackupVerificationService` checks integrity.
6.  **Notification**: `EmailService` alerts admin on failure.

## 🛡️ Security Considerations
*   **Secrets**: Handles API Keys (Stripe, SMTP). Must ensure these are never logged.
*   **Access Control**: Critical services (Backup, Refund) must only be invokable by Admin or System.

## ⚠️ Known Debt / Weaknesses
*   **In-Memory Queues**: Webhook retries might be in-memory (need to verify `webhook-retry.service.ts`). If server restarts, retries are lost.
*   **Email Templates**: Hardcoded strings vs external template files.
