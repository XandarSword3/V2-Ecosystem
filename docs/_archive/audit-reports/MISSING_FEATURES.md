# V2 Resort - Missing Features List

> **Purpose:** Quick reference of what's NOT implemented
> **Last Updated:** February 2, 2026
> **NOTE:** This was updated after deeper code review - several features previously marked missing ARE implemented!

---

## ✅ CORRECTIONS - Features Previously Thought Missing But EXIST

| Feature | Location | Notes |
|---------|----------|-------|
| **Self-Service Kiosk** | `backend/src/modules/kiosk/` (1226 lines) | Full device management, sessions, check-in/out |
| **Waitlist Management** | `backend/src/modules/restaurant/waitlist/` | Join, notify, seat, cancel workflow |
| **Table Reservations** | `backend/src/services/restaurant-table.service.ts` | Full reservation system with conflict detection |
| **SMS Schema** | `notifications_system.sql` | notification_channel enum includes 'sms' |

---

## 🔴 CRITICAL MISSING (Deal-Breakers)

### POS & Checkout
- [ ] **Configurable tax rates** - Currently hardcoded 11% VAT
- [ ] **Multiple tax rates** - Can't handle different tax categories
- [ ] **Tax-exempt orders** - No exemption flag
- [ ] **Comp/void workflow** - No manager approval, no reason tracking
- [ ] **Catering order type** - Only dine-in, takeaway, delivery, room_service

### Hardware Integration
- [ ] **Receipt printers** - No ESC/POS or Star printer support
- [ ] **Cash drawers** - No hardware trigger
- [ ] **Barcode scanners** - Data model ready but no scanning UI
- [ ] **Kitchen bump bars** - No hardware integration
- [ ] **Customer-facing displays** - No dedicated CFD mode

### Booking & Reservations
- [x] ~~**Table reservations**~~ - ✅ IMPLEMENTED in restaurant-table.service.ts
- [x] ~~**Waitlist management**~~ - ✅ IMPLEMENTED in waitlist.controller.ts
- [ ] **OTA integration** - No Booking.com, Airbnb, Expedia
- [ ] **PMS integration** - No Opera, Mews, StayNTouch
- [ ] **Google Calendar sync** - No external calendar integration
- [ ] **iCal export** - Not available

### Enterprise
- [ ] **Multi-location support** - Single-property architecture
- [ ] **Central menu management** - N/A without multi-location
- [ ] **Inventory transfers** - N/A without multi-location
- [ ] **Consolidated reporting** - N/A without multi-location
- [ ] **Franchise management** - Not implemented

---

## 🟡 HIGH PRIORITY MISSING (Competitive Disadvantage)

### POS
- [ ] **BOGO promotions** - Only percentage/fixed discounts
- [ ] **Happy hour auto-pricing** - Manual price rules only
- [ ] **Multiple floor plans** - Single floor only
- [ ] **Percentage split bills** - Not confirmed working

### CRM & Marketing
- [ ] **Customer segmentation engine** - Basic tiers only
- [ ] **RFM analysis** - Not implemented
- [ ] **Merge duplicate customers** - No merge functionality
- [ ] **Staff notes per visit** - Basic notes only
- [ ] **Allergy/preference flagging UI** - Data stored but no dedicated UI
- [ ] **Communication history log** - Emails sent but not logged
- [x] ~~**SMS notifications**~~ - Schema supports 'sms' channel, needs Twilio service
- [ ] **Marketing automation** - No drip campaigns, no triggers
- [ ] **Email campaign integration** - No Mailchimp/Klaviyo

### Integrations
- [ ] **Delivery apps** - No UberEats, DoorDash, Grubhub
- [ ] **Payroll systems** - No ADP, Gusto integration
- [ ] **Complete API documentation** - Partial OpenAPI only

### Self-Service
- [ ] **QR code menu ordering** - QR only for pool tickets
- [x] ~~**Self-service kiosks**~~ - ✅ IMPLEMENTED in kiosk.service.ts (1226 lines)
- [ ] **Digital menu boards** - Not implemented
- [ ] **Apple/Google Wallet passes** - No wallet integration
- [ ] **Dedicated tablet POS app** - Browser-based only

### Staff & Workforce
- [ ] **Training mode** - No sandbox for new staff
- [ ] **Tip pooling configuration** - Manual tip handling only
- [ ] **Auto tip distribution** - Not implemented
- [ ] **Labor cost % reports** - Basic hours only
- [ ] **Overtime calculations** - Not implemented

### Analytics
- [ ] **Real-time dashboard updates** - Static refresh required
- [ ] **Forecasting/predictions** - Not implemented
- [ ] **Scheduled report emails** - Manual exports only
- [ ] **Anomaly detection** - Not implemented

---

## 🟢 NICE-TO-HAVE MISSING (Lower Priority)

### Advanced Features
- [ ] **AI-powered recommendations** - Not implemented
- [ ] **Demand forecasting** - Not implemented
- [ ] **BI tool integration** - No Tableau/Power BI connector
- [ ] **IoT device integration** - No smart locks/thermostats
- [ ] **SOC 2 compliance** - Not certified
- [ ] **Bug bounty program** - Not established

### Booking Enhancements
- [ ] **Package bundling** - Add-ons only, no true packages
- [ ] **Scheduled maintenance calendar** - Manual blocking only

### CRM Enhancements
- [ ] **Right to be forgotten automation** - Manual GDPR compliance
- [ ] **Consent tracking UI** - Not implemented

---

## QUICK REFERENCE: Features That DO Exist

✅ Order types: dine_in, takeaway, delivery, room_service
✅ Split bills: equal, by item, by amount, by seat
✅ Discounts: percentage, fixed amount, max cap via coupons
✅ Tips & service charge: tip_amount field, 10% auto service
✅ Offline mode: IndexedDB caching with sync queue
✅ KDS: Real-time kitchen display with Socket.IO
✅ Floor plan: Interactive drag-drop table management
✅ Payments: Cash, card, Apple/Google Pay, room charge, gift card, loyalty
✅ Inventory: Real-time stock, FIFO, recipes/BOM, purchase orders
✅ Loyalty: Points, tiers, signup bonus, birthday bonus
✅ Gift cards: Purchase, redeem, templates, email delivery
✅ Staff: Clock in/out, shifts, assignments, break tracking
✅ Reports: Sales, revenue, export CSV/PDF, custom templates
✅ QuickBooks: OAuth2 integration for accounting
✅ Multi-language: English, Arabic (RTL), French
✅ White-label: Full branding customization

---

## ESTIMATED FIX EFFORT

| Missing Feature | Hours | Value Add |
|-----------------|-------|-----------|
| Configurable tax | 15 | +$5,000 |
| ~~Table reservations~~ | ~~40~~ | ✅ EXISTS |
| Comp/void workflow | 20 | +$4,000 |
| SMS Twilio service | 10 | +$3,000 | (schema ready)
| Scheduled reports | 15 | +$3,000 |
| Training mode | 15 | +$2,000 |
| QR menu ordering | 30 | +$5,000 |
| Receipt printer support | 40 | +$8,000 |
| Single delivery app | 60 | +$10,000 |
| ~~Kiosk~~ | ~~40~~ | ✅ EXISTS |
| **Total Quick Wins** | **205 hrs** | **+$40,000** |
