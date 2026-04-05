# 5. Customer Journeys

## Objective

Test the full customer experience for each engine type, from browsing to completed transaction.

---

## 5.1 Restaurant Order (`menu_service` / Instant Transaction)

**Module Used:** Restaurant (pre-existing, established data)  
**Customer:** Maria Rossi

### Order Details

| Field | Value |
|-------|-------|
| Order ID | `8ce9a211-8541-47dd-ae29-4bd3b4b23063` |
| Order Number | #R-260309-9466917q6o |
| Item | Bruschetta |
| Item Price | $12.50 |
| Tax (21%) | $2.63 |
| Subtotal | $15.13 |
| Loyalty Points Applied | 779 points ($7.79 discount) |
| **Final Total** | **$7.34** |
| Special Instructions | "Extra crispy please, no onions" |
| Service Type | Dine In |
| Table | Table 12 |

### Customer Details Entered

| Field | Value |
|-------|-------|
| Name | Maria Rossi |
| Phone | +39 333 456 7890 |
| Table Number | 12 |
| Special Requests | "Gluten-free bread if available" |

### Checkout Flow

1. **Browse Menu** → 82+ dishes across 13 categories loaded
2. **Add to Cart** → Bruschetta $12.50 with special instructions
3. **Step 1: Review Order** → Cart summary with item, quantity, price
4. **Step 2: Your Details** → Customer name, phone, table, requests, service type
5. **Step 3: Payment** → Loyalty points slider, total calculation
6. **Confirmation** → QR code, order number, status PENDING

### Checklist

- [x] Menu page loads with all categories and items
- [x] Item detail modal with special instructions field
- [x] Add to cart functionality
- [x] Cart badge updates in header
- [x] 3-step checkout flow works (Review → Details → Payment)
- [x] Customer detail form validation
- [x] Loyalty points can be applied
- [x] Loyalty discount reduces total correctly ($15.13 - $7.79 = $7.34)
- [x] Order confirmation page displays
- [x] QR code generated on confirmation
- [x] Order number assigned (#R-260309-9466917q6o)
- [x] Order status shows PENDING
- [x] Order ID returned from API

---

## 5.2 Chalet Booking (`multi_day_booking` / Time-Exclusive Reservation)

**Module Used:** Chalets (pre-existing, established data)  
**Unit:** Family Suite

### Booking Details

| Field | Value |
|-------|-------|
| Booking ID | `a870176a-f88e-420b-b089-6c3df91c423e` |
| Booking Number | #C-260309-125 |
| Unit | Family Suite |
| Check-in | March 15, 2026 (Sunday) |
| Check-out | March 19, 2026 (Thursday) |
| Duration | 4 nights |
| Nightly Rate | $180 (weekday) / $240 (weekend) |
| Base Cost | $720 (4 × $180) |
| Guests | 4 |
| Add-on: Breakfast Package | $60 |
| Add-on: Airport Transfer | $50 |
| **Total** | **$830.00** |

### Booking Flow

1. **Browse Chalets** → Listing page with 52 chalets, filters, search
2. **Select Unit** → Family Suite detail page with gallery, amenities, pricing
3. **Select Dates** → Calendar date picker, check-in/check-out selection
4. **Configure** → Guest count (4), add-ons selection
5. **Price Calculation** → 4 nights × $180 + $110 add-ons = $830
6. **Confirm Booking** → Booking reference #C-260309-125

### Checklist

- [x] Chalets listing page loads with all available units
- [x] Unit detail page shows photos, amenities, pricing
- [x] Date selection calendar works correctly
- [x] Guest count selector functional (set to 4)
- [x] Add-ons can be selected and priced
- [x] Total price calculated correctly
- [x] Booking confirmation successful
- [x] Booking number assigned (#C-260309-125)
- [x] Booking ID returned from API

---

## 5.3 Pool Ticket (`session_access` / Shared Capacity Access)

**Module Used:** Pool (pre-existing, established data)  

### Ticket Details

| Field | Value |
|-------|-------|
| Ticket ID | `e8a60afa-61b7-4799-ae98-0cd92dc7219d` |
| Ticket Number | #P-260309-6070 |
| Session | Morning Session |
| Adults | 2 |
| Children | 1 |
| Adult Price | $15 each |
| Child Price | $10 each |
| **Total** | **$40.00** (2×$15 + 1×$10) |

### Purchase Flow

1. **Pool Page** → Pool Tickets page shows 54 sessions today, 2,700 available spots
2. **Select Session** → Morning Session chosen
3. **Configure** → 2 adults + 1 child
4. **Purchase** → Ticket confirmed with reference number

### Checklist

- [x] Pool page loads with session overview
- [x] Available sessions displayed with capacity info
- [x] Session selection works
- [x] Adult/child quantity selectors functional
- [x] Price calculates correctly ($40 = 2×$15 + 1×$10)
- [x] Purchase completes successfully
- [x] Ticket number assigned (#P-260309-6070)
- [x] Ticket ID returned from API

---

## Issues Found During Customer Testing

| Issue | Severity | Description |
|-------|----------|-------------|
| New module customer pages | Info | Dynamically-created modules use generic templates — tested with established modules instead |
| Pool "Purchase" button | Low | Button outside viewport; resolved via JS scroll/click |
