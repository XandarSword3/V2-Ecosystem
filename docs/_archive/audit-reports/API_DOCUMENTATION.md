# V2 Hospitality Platform - API Documentation

**Audit Date:** February 2, 2026  
**Backend URL:** http://localhost:3005  
**Status:** ✅ Operational

---

## Summary

| Category | Working | Total | Status |
|----------|---------|-------|--------|
| Public Endpoints | 16 | 16 | ✅ 100% |
| Protected Endpoints | 19 | 28 | ⚠️ 68% |
| **Total** | **35** | **44** | **80%** |

---

## Authentication

### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@v2resort.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id", "email", "fullName", "roles" },
    "tokens": { "accessToken", "refreshToken", "expiresIn" }
  }
}
```

**Usage:** Include `Authorization: Bearer <accessToken>` header for protected endpoints.

---

## Public Endpoints (16/16 ✅)

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/health` | GET | ✅ 200 | Health check |
| `/api/health` | GET | ✅ 200 | API health status |
| `/api/settings` | GET | ✅ 200 | Site configuration (branding, modules) |
| `/api/modules` | GET | ✅ 200 | Available modules list |
| `/api/weather` | GET | ✅ 200 | Weather data (demo or live) |
| `/api/v1/units` | GET | ✅ 200 | Generic units (white-label chalets) |
| `/api/v1/facilities/sessions` | GET | ✅ 200 | Facility sessions (white-label pool) |
| `/api/v1/dining/menu` | GET | ✅ 200 | Dining menu (white-label restaurant) |
| `/api/v1/terminology` | GET | ✅ 200 | Custom terminology mappings |
| `/api/v1/restaurant/menu` | GET | ✅ 200 | Full restaurant menu |
| `/api/v1/restaurant/menu/categories` | GET | ✅ 200 | Menu categories |
| `/api/v1/pool/sessions` | GET | ✅ 200 | Pool/fitness sessions |
| `/api/v1/chalets` | GET | ✅ 200 | Chalets/accommodations list |
| `/api/v1/loyalty/settings` | GET | ✅ 200 | Loyalty program configuration |
| `/api/v1/loyalty/tiers` | GET | ✅ 200 | Loyalty tier definitions |
| `/api/v1/reviews` | GET | ✅ 200 | Approved public reviews |

---

## Protected Endpoints (19/28)

### Authentication (1/1 ✅)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/auth/me` | GET | ✅ 200 | Current user profile |

### User Management (0/1)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/users` | GET | ❌ 500 | List users - **Database query error** |

### Admin Module (2/2 ✅)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/admin/settings` | GET | ✅ 200 | Admin settings |
| `/api/v1/admin/modules` | GET | ✅ 200 | Module management |

### Manager Module (4/4 ✅)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/manager/approvals` | GET | ✅ 200 | All approvals |
| `/api/v1/manager/approvals/pending` | GET | ✅ 200 | Pending approvals |
| `/api/v1/manager/approvals/stats` | GET | ✅ 200 | Approval statistics |
| `/api/v1/manager/shifts` | GET | ✅ 200 | Managed shifts |

### Inventory Module (4/4 ✅)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/inventory/categories` | GET | ✅ 200 | Inventory categories |
| `/api/v1/inventory/items` | GET | ✅ 200 | Inventory items |
| `/api/v1/inventory/transactions` | GET | ✅ 200 | Stock transactions |
| `/api/v1/inventory/alerts` | GET | ✅ 200 | Low stock alerts |

### Coupons & Gift Cards (2/2 ✅)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/coupons` | GET | ✅ 200 | Coupons list |
| `/api/v1/giftcards` | GET | ✅ 200 | Gift cards list |

### Loyalty Program (2/2 ✅)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/loyalty/accounts` | GET | ✅ 200 | Loyalty accounts |
| `/api/v1/loyalty/stats` | GET | ✅ 200 | Loyalty statistics |

### Reviews (1/1 ✅)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/reviews/admin` | GET | ✅ 200 | All reviews (including pending) |

### Housekeeping (1/1 ✅)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/housekeeping/tasks` | GET | ✅ 200 | Housekeeping tasks |

### Payments (1/1 ✅)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/payments/methods` | GET | ✅ 200 | Payment methods |

### Restaurant (1/2)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/restaurant/waitlist` | GET | ✅ 200 | Waitlist management |
| `/api/v1/restaurant/orders` | GET | ❌ 404 | **Route not registered** |

### Devices (0/1)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/devices` | GET | ❌ 500 | **Database query error** |

### Pool Module (0/2)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/pool/tickets` | GET | ❌ 404 | **Route not registered** |
| `/api/v1/pool/bookings` | GET | ❌ 404 | **Route not registered** |

### Snack Module (0/2)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/snack/menu` | GET | ❌ 404 | **Module guard blocking** |
| `/api/v1/snack/orders` | GET | ❌ 404 | **Module guard blocking** |

### Reports & Promotions (0/2)
| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/v1/promotions` | GET | ❌ 404 | **Route not registered** |
| `/api/v1/reports` | GET | ❌ 404 | **Route not registered** |

---

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## User Roles

| Role | Access Level |
|------|--------------|
| `super_admin` | Full system access |
| `admin` | Administrative access |
| `manager` | Department management |
| `restaurant_manager` | Restaurant specific |
| `chalet_manager` | Accommodation specific |
| `pool_manager` | Pool/fitness specific |
| `hotel_staff` | General staff |
| `restaurant_staff` | Restaurant staff |
| `pool_staff` | Pool staff |
| `housekeeping` | Housekeeping staff |
| `guest` | Customer access |

---

## Issues Requiring Attention

### 500 Errors (2)
| Endpoint | Issue |
|----------|-------|
| `/api/v1/users` | Database query fails - check user controller |
| `/api/v1/devices` | Database query fails - check devices module |

### 404 Routes (7)
| Endpoint | Reason |
|----------|--------|
| `/api/v1/promotions` | Route not registered in v1.routes.ts |
| `/api/v1/reports` | Route not registered in v1.routes.ts |
| `/api/v1/restaurant/orders` | Missing endpoint in restaurant routes |
| `/api/v1/pool/tickets` | Missing endpoint in pool routes |
| `/api/v1/pool/bookings` | Missing endpoint in pool routes |
| `/api/v1/snack/menu` | Module guard blocking - check snack module config |
| `/api/v1/snack/orders` | Module guard blocking - check snack module config |

---

*Generated by comprehensive system audit on February 2, 2026*
