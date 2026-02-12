# Customer Guide: GDPR & Privacy

> **Module:** CUS-GDPR
> **Features:** 6 features
> **Last Updated:** 2026-02-08

---

## Overview

The GDPR & privacy module gives you full control over your personal data at V2 Resort. In compliance with the General Data Protection Regulation (GDPR) and other privacy laws, you can view a privacy dashboard, manage your consent preferences, request a full export of your personal data, request account deletion, and review how your data has been processed. All actions are logged for transparency and auditing.

## Prerequisites

- Must be logged in to access the privacy dashboard and all GDPR features
- Data export requests may take up to 48 hours to process
- Account deletion is irreversible — ensure you've downloaded any desired data first
- All GDPR actions are logged and time-stamped for compliance

## Features Covered

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-GDPR-001 | View privacy dashboard | ✅ Implemented |
| CUS-GDPR-002 | Manage consent preferences | ✅ Implemented |
| CUS-GDPR-003 | Request data export | ✅ Implemented |
| CUS-GDPR-004 | Download data export | ✅ Implemented |
| CUS-GDPR-005 | Request account deletion | ✅ Implemented |
| CUS-GDPR-006 | View processing log | ✅ Implemented |

## How-To Guides

### 1. View Your Privacy Dashboard

**What it does:** Provides a centralized overview of your data privacy status, including consent summary, active data requests, and processing activity at a glance.

**Steps:**
1. Navigate to `/account/privacy` from your account menu or profile page.
2. The privacy dashboard displays:
   - **Consent Summary** — A snapshot of your current consent preferences (what data processing you've agreed to and declined).
   - **Data Requests** — Status of any pending or completed export or deletion requests.
   - **Processing Activity** — A count of how many times your data has been processed, with a link to the full log.
   - **Quick Actions** — Buttons for "Manage Consent", "Request Export", "Request Deletion", and "View Log".
3. Each section is clickable/expandable for more detail.

**What you'll see:**
- A clean dashboard layout with summary cards
- Status indicators: green checkmarks for active consents, gray for declined
- Pending request badges (e.g., "Export: Processing")
- Quick-action buttons for common tasks
- Last updated timestamp showing when data was last refreshed

**Tips:**
- Review your privacy dashboard periodically, especially after making new bookings or purchases, to ensure your consent preferences match your expectations.
- The dashboard is your starting point for all privacy-related actions.

---

### 2. Manage Consent Preferences

**What it does:** Control exactly what types of data processing V2 Resort is allowed to perform on your personal information.

**Steps:**
1. From the privacy dashboard, click **Manage Consent** or navigate to the consent section.
2. A detailed consent management panel displays the following categories:
   - **Essential Processing** — Always required; covers account functionality, booking management, and payment processing. Cannot be disabled.
   - **Analytics & Improvement** — Allows V2 Resort to analyze your usage patterns to improve services. Toggle on/off.
   - **Marketing Communications** — Permits sending promotional emails, special offers, and newsletters. Toggle on/off.
   - **Personalization** — Enables personalized recommendations based on your booking and ordering history. Toggle on/off.
   - **Third-Party Sharing** — Controls whether anonymized data is shared with third-party analytics partners. Toggle on/off.
3. For each category, a description explains:
   - What data is collected
   - How it's used
   - Who has access
   - How long it's retained
4. Toggle each consent category to your preference.
5. Click **Save Consent Preferences**.
6. A confirmation message appears, and the change is logged in your processing log.

**What you'll see:**
- Toggle switches (on/off) for each consent category
- Detailed descriptions expandable under each category
- "Essential Processing" locked in the ON position with an explanation
- A "Last Updated" timestamp on each consent category
- Save button with confirmation feedback

**Tips:**
- You can change your consent preferences at any time — changes take effect immediately.
- Disabling "Marketing Communications" stops promotional emails but not transactional emails (booking confirmations, receipts, security alerts).
- Disabling "Personalization" means you'll see generic recommendations instead of tailored ones.
- Every consent change is recorded in your processing log for full transparency.

---

### 3. Request a Data Export

**What it does:** Submit a request to receive a complete copy of all personal data V2 Resort holds about you, in a portable, machine-readable format.

**Steps:**
1. From the privacy dashboard, click **Request Data Export**.
2. A confirmation dialog appears explaining:
   - What data will be included (profile info, booking history, order history, payment records, loyalty data, consent history, communication logs)
   - The format of the export (JSON and/or CSV archive)
   - The estimated processing time (up to 48 hours)
3. Click **Confirm Export Request**.
4. The request is submitted and a status card appears on your dashboard: **"Export: Processing"**.
5. You'll receive an email notification when the export is ready for download.

**What you'll see:**
- Confirmation dialog with detailed scope and timeline
- Status indicator on the dashboard changing from "Processing" to "Ready"
- Email notification with a secure download link

**Tips:**
- Export requests are processed securely — the data is compiled, encrypted, and made available via a time-limited download link.
- You can only have one active export request at a time. Wait for the current one to complete before requesting another.
- The export file can be large depending on your activity — ensure you have sufficient storage.

---

### 4. Download Your Data Export

**What it does:** Download the compiled data export file once it's ready.

**Steps:**
1. After receiving the notification that your export is ready, navigate to `/account/privacy`.
2. In the **Data Requests** section, find your completed export with status **"Ready for Download"**.
3. Click the **Download** button.
4. The export file downloads as a ZIP archive containing:
   - `profile.json` — Your account information (name, email, phone, address, preferences)
   - `bookings.json` — All chalet booking records
   - `orders.json` — All restaurant and snack bar order records
   - `pool_tickets.json` — All pool ticket purchase records
   - `payments.json` — Payment transaction history (card details are masked)
   - `loyalty.json` — Loyalty points, tier history, and transactions
   - `consents.json` — Full consent preference history with timestamps
   - `communications.json` — Email and notification log
   - `README.txt` — Explanation of the data structure and fields
5. The download link is valid for a limited time (typically 7 days). After expiry, you'll need to submit a new request.

**What you'll see:**
- Download button on the completed export card
- Browser download dialog for the ZIP file
- A countdown or expiry notice on the download link

**Tips:**
- Open the files with any JSON viewer, spreadsheet application (for CSV), or text editor.
- Store the export securely — it contains all your personal data.
- If the download link has expired, request a new export from the dashboard.
- The `README.txt` file inside the archive explains each field for your reference.

---

### 5. Request Account Deletion

**What it does:** Submit an irreversible request to permanently delete your V2 Resort account and all associated personal data.

**Steps:**
1. From the privacy dashboard, click **Request Account Deletion**.
2. A multi-step confirmation process begins:

   **Step 1 — Information:**
   - A warning explains exactly what will be deleted:
     - Your profile and personal information
     - All booking and order history
     - Loyalty points and tier status
     - Gift card balances (unredeemed amounts may be forfeited)
     - All saved preferences and wishlist items
   - Active bookings must be completed or cancelled before deletion.

   **Step 2 — Verification:**
   - Enter your **password** (or authenticate via OAuth provider) to confirm your identity.
   - If 2FA is enabled, enter your 2FA code.

   **Step 3 — Final Confirmation:**
   - Type "DELETE MY ACCOUNT" in the confirmation field.
   - Click **Permanently Delete Account**.

3. The deletion request is submitted. Your account enters a **30-day grace period**:
   - During this period, your account is deactivated (you cannot log in).
   - If you change your mind, contact support within 30 days to cancel the deletion.
   - After 30 days, the deletion is permanent and irreversible.
4. A confirmation email is sent acknowledging the deletion request.

**What you'll see:**
- Multi-step confirmation wizard with clear warnings at each stage
- Password/2FA verification step
- Text input requiring you to type "DELETE MY ACCOUNT"
- Confirmation screen with the 30-day grace period explained
- Email confirmation of the deletion request

**Tips:**
- **Download a data export BEFORE requesting deletion** — once deleted, your data cannot be recovered.
- Cancel or complete all active bookings before requesting deletion to avoid complications.
- The 30-day grace period is your safety net — contact support if you change your mind.
- After the grace period, all data is permanently purged from V2 Resort systems in compliance with GDPR Article 17 (Right to Erasure).

---

### 6. View the Processing Log

**What it does:** Provides a transparent, chronological record of every action taken on your personal data — who accessed it, when, and why.

**Steps:**
1. From the privacy dashboard, click **View Processing Log** or scroll to the **Processing Activity** section.
2. The log displays entries sorted by date (most recent first), each showing:
   - **Date and time** of the processing event
   - **Action type** — e.g., "Consent Updated", "Data Exported", "Profile Edited", "Booking Created", "Payment Processed"
   - **Description** — A brief explanation of what happened (e.g., "Marketing consent changed from Enabled to Disabled")
   - **Initiated by** — Whether the action was by you, the system, or a staff member (e.g., for support-related changes)
   - **IP address** (optional, for security audit purposes)
3. Use **filters** to narrow the log:
   - Date range
   - Action type (Consent, Export, Deletion, Access, Processing)
4. Use **pagination** to browse older entries.

**What you'll see:**
- A chronological list/table of processing events
- Color-coded action types for quick scanning
- Filter controls at the top
- A pagination bar at the bottom
- A "No activity" message if no processing events exist yet

**Tips:**
- Review the processing log if you notice unexpected changes to your account or consent preferences.
- If you see an unfamiliar action (especially initiated by someone other than you), contact support immediately.
- The log is immutable — entries cannot be edited or deleted, ensuring a trustworthy audit trail.
- This log fulfills your GDPR Article 15 (Right of Access) rights by providing transparency into data processing.

---

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Privacy dashboard not loading | Network issue or authentication problem | Refresh the page. Ensure you're logged in. Clear browser cache and try again. |
| Consent preferences not saving | Network error during save or session expired | Try again. If the issue persists, log out and back in before saving. |
| Data export stuck on "Processing" for more than 48 hours | Backend processing delay or system issue | Contact support with your export request ID. Quote the timestamp from your dashboard. |
| Download link expired | Export download links are valid for a limited time (7 days) | Request a new data export from the privacy dashboard. |
| Account deletion request not accepted — "Active bookings" error | You have upcoming bookings that must be resolved first | Cancel or complete all active bookings, then re-submit the deletion request. |
| Cannot cancel account deletion during grace period | Request may have been processed early (rare) or you're past the 30 days | Contact support immediately. If within the grace period, support can reverse the deletion. |
| Processing log shows unfamiliar activity | Possible unauthorized access or automated system processing | Review the entries carefully. System-initiated actions are normal (e.g., automated consent checks). If you suspect unauthorized access, change your password and contact support. |
| Data export file is empty or incomplete | Processing error during export generation | Contact support to investigate. Request a new export. |

## Related Modules

- [Account & Profile](account-and-profile.md) — Manage account settings and security (2FA, password)
- [Restaurant Ordering](restaurant-ordering.md) — Order data included in exports
- [Chalet Booking](chalet-booking.md) — Booking data included in exports
- [Pool Tickets](pool-tickets.md) — Ticket data included in exports
- [Loyalty Program](loyalty-program.md) — Loyalty data included in exports and affected by deletion
- [Gift Cards](gift-cards.md) — Gift card data included in exports; balances affected by deletion

## Feature Coverage Summary

| Metric | Value |
|---|---|
| Total Features | 6 |
| Implemented | 6 |
| Pending | 0 |
| Coverage | 100% |
| Key Endpoints | `GET /gdpr/dashboard`, `GET /gdpr/consents`, `PUT /gdpr/consents`, `POST /gdpr/export/request`, `GET /gdpr/export/download/:id`, `POST /gdpr/deletion/request`, `GET /gdpr/processing-log` |
| Primary URL | `/account/privacy` |
| GDPR Articles Addressed | Art. 7 (Consent), Art. 15 (Right of Access), Art. 17 (Right to Erasure), Art. 20 (Data Portability) |
