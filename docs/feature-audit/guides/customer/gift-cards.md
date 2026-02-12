# Customer Guide: Gift Cards

> **Module:** CUS-GFT
> **Features:** 8 features
> **Last Updated:** 2026-02-08

---

## Overview

V2 Resort gift cards are digital cards that can be purchased, sent to friends and family, and redeemed across resort services including restaurant dining, chalet bookings, pool tickets, and the snack bar. You can choose from pre-designed templates, set your own amount, add a personal message, and deliver the card via email. Purchased gift cards are managed from your account, and anyone with a gift card code can check their remaining balance.

## Prerequisites

- Must be logged in to purchase gift cards
- Valid payment method (Stripe card) required for purchase
- Recipient needs a valid email address to receive the gift card

## Features Covered

| Feature ID | Feature Name | Status |
|---|---|---|
| CUS-GFT-001 | Browse gift card templates | ✅ Implemented |
| CUS-GFT-002 | Select preset amount | ✅ Implemented |
| CUS-GFT-003 | Enter custom amount | ✅ Implemented |
| CUS-GFT-004 | Enter recipient details | ✅ Implemented |
| CUS-GFT-005 | Add personal message | ✅ Implemented |
| CUS-GFT-006 | Purchase gift card | ✅ Implemented |
| CUS-GFT-007 | View my gift cards | ✅ Implemented |
| CUS-GFT-008 | Check gift card balance | ✅ Implemented |

## How-To Guides

### 1. Browse Gift Card Templates

**What it does:** Displays a selection of pre-designed gift card templates themed for different occasions — birthdays, holidays, thank-you, romance, and general resort experiences.

**Steps:**
1. Navigate to `/giftcards` from the main navigation bar or resort homepage.
2. The gift card page displays a gallery of templates in a grid layout.
3. Each template shows:
   - A visual design (e.g., "Happy Birthday" with balloons, "Romantic Getaway" with sunset imagery, "Resort Experience" with pool/mountain art)
   - Template name
4. Click on a template to select it — it highlights with a border or checkmark.
5. A preview of the selected template appears, showing how the recipient will see it.

**What you'll see:** A curated gallery of 6–12 beautifully designed card templates. The selected template highlights, and a live preview updates as you customize the card.

**Tips:**
- Templates are purely visual — they don't affect the card's monetary value or usability.
- A "Generic" or "Classic" template is available if none of the themed options suit your needs.
- Templates are designed to look great in email and on mobile screens.

**API Reference:**
- `GET /giftcards/templates` — returns all available gift card templates with their images and names

---

### 2. Select Amount or Enter Custom Amount

**What it does:** Set the monetary value of the gift card by choosing a preset amount or entering any custom value within the allowed range.

**Steps:**
1. After selecting a template, the **Amount** section presents preset options:
   - Common presets: $25, $50, $75, $100, $150, $200, $500
   - Amounts display in your selected currency
2. Click a preset button to select that amount.
3. **Or** click **Custom Amount** and type any value in the text field.
   - Minimum amount: Typically $10 (or equivalent in your currency)
   - Maximum amount: Typically $1,000 (or equivalent)
4. The selected amount displays prominently on the card preview.

**What you'll see:** Preset amount buttons laid out in a row. The selected amount highlights. If you choose custom, a text input appears with currency symbol and validation.

**Tips:**
- Custom amounts must be whole numbers in most currencies (no cents/pence).
- The currency on the gift card matches your current currency setting at the time of purchase. The recipient can use it regardless of their own currency preference — the system handles conversion.
- Larger amounts may trigger additional verification from your payment provider.

---

### 3. Enter Recipient Details and Personal Message

**What it does:** Specify who the gift card is for by entering their name and email address, and optionally add a heartfelt personal message that accompanies the card.

**Steps:**
1. In the **Recipient Details** section, fill in the following fields:
   - **Recipient Name** (required): The name of the person receiving the gift card.
   - **Recipient Email** (required): Their email address where the gift card will be delivered.
   - **Your Name** (auto-filled from your profile, editable): How you want to be identified as the sender.
2. In the **Personal Message** section:
   - Enter a message of up to 250 characters.
   - Example: "Happy birthday, Sarah! Enjoy a wonderful day at the resort. 🎉"
3. The live preview updates to show the recipient name, message, and card amount.

**What you'll see:** A form with clearly labeled fields and character count for the message. The card preview on the right (desktop) or above (mobile) updates in real time as you type.

**Tips:**
- Double-check the recipient's email address — the gift card code is delivered there and cannot be resent to a different address without contacting support.
- The personal message is optional but adds a nice touch. It appears in the email alongside the card design.
- You can send a gift card to yourself — just enter your own email address.

---

### 4. Purchase Gift Card

**What it does:** Completes the gift card purchase, charges your payment method, and triggers delivery of the gift card to the recipient's email.

**Steps:**
1. Review the gift card summary:
   - Template design
   - Amount
   - Recipient name and email
   - Personal message
2. Select your **payment method**:
   - Choose a saved card or enter new card details via the Stripe secure form.
3. Review the total (gift card amount + any applicable fees, though most resorts don't charge extra for gift cards).
4. Click **Purchase Gift Card**.
5. Stripe processes the payment (2-5 seconds).
6. On success, a confirmation screen displays:
   - "Gift card purchased successfully!"
   - Gift card code (for your records)
   - Confirmation that the email will be sent to the recipient
   - A link to **View My Gift Cards** in your account

**What you'll see:** A loading spinner during payment, then a success confirmation with the gift card code and delivery status.

**Tips:**
- The gift card email is sent within minutes. If the recipient doesn't receive it, check their spam/junk folder.
- Save or screenshot the gift card code as a backup.
- Gift cards do not expire unless specified by local regulations.
- You'll receive a purchase receipt at your own email address.

**API Reference:**
- `POST /giftcards/purchase` — creates the gift card with template, amount, recipient details, message, and payment intent

---

### 5. View My Gift Cards

**What it does:** Shows all gift cards you've purchased and any gift cards you've received, with their current balances and transaction history.

**Steps:**
1. Navigate to `/account/giftcards` from the profile dropdown or account navigation.
2. The page displays two sections:
   - **Purchased Gift Cards**: Cards you've bought for others or yourself
   - **My Gift Cards**: Cards you've received from others (added to your account by code)
3. Each gift card entry shows:
   - Card code (partially masked for security, e.g., "GC-XXXX-7890")
   - Original amount
   - Current balance
   - Date purchased / received
   - Recipient name (for purchased cards)
   - Status: Active, Partially Used, Fully Redeemed, Expired
4. Click on a gift card to view its full details and transaction history (every redemption event).

**What you'll see:** A dashboard-style view of your gift cards with balance indicators. Active cards with remaining balance are highlighted; fully used cards are greyed out.

**Tips:**
- To add a received gift card to your account, enter the code you received by email in the "Add Gift Card" field.
- Gift card balances update in real time after each use.
- You can use a gift card during checkout at the restaurant, chalet booking, pool tickets, or snack bar.

---

### 6. Check Gift Card Balance

**What it does:** Allows anyone with a gift card code to check the current remaining balance without logging in.

**Steps:**
1. Navigate to `/giftcards` and scroll to the **Check Balance** section at the bottom of the page (or find it in the page's secondary navigation).
2. Enter the full gift card code (e.g., "GC-ABCD-1234-EFGH-5678").
3. Click **Check Balance**.
4. The system displays:
   - Original card amount
   - Current remaining balance
   - Last used date (if any)

**What you'll see:** A simple balance lookup result showing the card's remaining value. If the code is invalid, an error message appears: "Gift card not found. Please check the code and try again."

**Tips:**
- You don't need to be logged in to check a balance — this is useful for recipients who haven't created an account yet.
- The balance check is read-only — no modifications can be made from this interface.
- Balance is displayed in the currency the card was originally purchased in.

**API Reference:**
- `GET /giftcards/check/:code` — returns the balance and status for the given gift card code

---

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Recipient didn't receive the gift card email | Email delay, spam filter, or wrong address | Check recipient's spam/junk folder. Verify the email address was correct. Contact resort support to resend. |
| Gift card code not recognized | Typo in the code | Double-check the code character by character. Codes are case-insensitive but must be exact. |
| Balance shows $0 but I haven't used it | Card was used by someone else with the code | Gift card codes should be kept private. Contact resort support for investigation. |
| Payment failed during purchase | Card declined | Try a different card or verify card details. |
| Can't enter custom amount | Amount outside allowed range | Ensure your amount is between the minimum ($10) and maximum ($1,000) limits. |
| Gift card not appearing in my account | Haven't added it yet | Go to `/account/giftcards` and enter the code in the "Add Gift Card" field. |
| Can't apply gift card at checkout | Code already fully redeemed or expired | Check the balance first. If expired, contact support for possible reissue. |

## Related Modules

- [Restaurant Ordering](restaurant-ordering.md) — Redeem gift cards at restaurant checkout
- [Chalet Booking](chalet-booking.md) — Apply gift cards to chalet booking payments
- [Pool Tickets](pool-tickets.md) — Use gift card balance for pool ticket purchases
- [Snack Bar](snack-bar.md) — Redeem gift cards for snack bar orders
- [Account & Profile](account-and-profile.md) — Manage gift cards from your profile

## Feature Coverage Summary

| Metric | Value |
|---|---|
| Total Features | 8 |
| Implemented | 8 |
| Documented in Guide | 8 |
| Coverage | 100% |
| Primary URL | `/giftcards` |
| Account URL | `/account/giftcards` |
