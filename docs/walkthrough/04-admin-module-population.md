# 4. Admin: Module Population

## Objective

Populate each newly created module with content as an admin, testing all admin CRUD operations.

---

## 4.1 Beach Bar (`menu_service`)

### Categories Created

| Category | Items | Status |
|----------|-------|--------|
| Cocktails & Drinks | 1 | ✅ |
| Seafood Bites | 1 | ✅ |

### Menu Items Created

| Item | Category | Price | Status |
|------|----------|-------|--------|
| Mediterranean Sunset Spritz | Cocktails & Drinks | $14.50 | ✅ |
| Grilled Octopus Skewers | Seafood Bites | $18.75 | ✅ |

### Checklist

- [x] Navigate to Beach Bar admin section
- [x] Create "Cocktails & Drinks" category
- [x] Create "Seafood Bites" category
- [x] Add "Mediterranean Sunset Spritz" menu item ($14.50)
- [x] Add "Grilled Octopus Skewers" menu item ($18.75)
- [x] Both items display correctly in admin menu list

---

## 4.2 Seaside Villas (`multi_day_booking`)

### Units Created (via API)

> **Note:** No frontend UI exists for creating booking units — only backend API endpoints (`POST /api/v1/chalets/admin/chalets`).

| Villa | Base Price | Weekend Price | Bedrooms | Bathrooms | Capacity |
|-------|-----------|---------------|----------|-----------|----------|
| Azure Cove Villa | $320/night | $420/night | 2 | 1 | 4 guests |
| Poseidon Grand Villa | $580/night | $720/night | 3 | 2 | 8 guests |
| Aphrodite Suite Villa | $450/night | $550/night | 1 | 1 | 2 guests |

**Unit IDs:**
- Azure Cove: `785d72da`
- Poseidon Grand: `62c6ee42`
- Aphrodite Suite: `d592dcc5`

### Pricing Rules

| Rule | Details | Status |
|------|---------|--------|
| Mediterranean Summer | Created via admin UI | ✅ |

### Add-ons Created

| Add-on | Price | Status |
|--------|-------|--------|
| Private Chef Service | $150 | ✅ |
| Sunset Boat Tour | $95 | ✅ |

### Checklist

- [x] Create 3 villa units via API (no frontend UI available)
- [x] Verify units appear in admin listings
- [x] Create "Mediterranean Summer" pricing rule
- [x] Create "Private Chef Service" add-on ($150)
- [x] Create "Sunset Boat Tour" add-on ($95)
- [x] All units active and bookable

---

## 4.3 Wellness Spa (`session_access`)

### Sessions Created

| Session | Time | Price | Capacity | Status |
|---------|------|-------|----------|--------|
| Morning Aromatherapy | 8:00 AM – 10:00 AM | $75 | Default | ✅ |
| Hot Stone Massage | 2:00 PM – 4:00 PM | $120 | Default | ✅ |

### Checklist

- [x] Navigate to Wellness Spa admin section
- [x] Create "Morning Aromatherapy" session (8–10 AM, $75)
- [x] Create "Hot Stone Massage" session (2–4 PM, $120)
- [x] Both sessions display in admin session list

---

## Issues Found

| Issue | Severity | Description |
|-------|----------|-------------|
| No UI for unit creation | Medium | Booking units (`multi_day_booking`) can only be created via API, not admin UI |
| Capacity page i18n | Low | Untranslated i18n keys on capacity management page |
| Price multiplier schema | Low | `PGRST204` error for `price_multiplier` column via API — worked around with admin UI |
