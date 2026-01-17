# Pool Module

Pool session booking and management system.

## Features

- **Session Management** - Time slots, capacity, pricing
- **Booking System** - Customer reservations
- **Gender Segregation** - Male/female/mixed sessions
- **Capacity Tracking** - Real-time availability

## API Endpoints

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/pool/sessions` | List available sessions |
| `GET` | `/pool/sessions/:id` | Session details |
| `POST` | `/pool/sessions` | Create session (admin) |
| `PUT` | `/pool/sessions/:id` | Update session (admin) |
| `DELETE` | `/pool/sessions/:id` | Delete session (admin) |

### Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/pool/bookings` | Create booking |
| `GET` | `/pool/bookings` | User's bookings |
| `GET` | `/pool/bookings/:id` | Booking details |
| `PUT` | `/pool/bookings/:id/cancel` | Cancel booking |
| `PUT` | `/pool/bookings/:id/checkin` | Check in guest (staff) |

### Query Parameters

```
GET /pool/sessions?date=2026-01-15&moduleId=pool-1
GET /pool/bookings?status=confirmed&page=1&limit=10
```

## Booking Flow

```
browse sessions → select date/time → add guests → payment → confirmation
                                                          ↓
                                             check-in at pool (staff)
```

## Data Models

### PoolSession

```typescript
{
  id: UUID,
  moduleId: UUID,
  name: string,
  name_ar?: string,
  description?: string,
  startTime: string,      // "09:00"
  endTime: string,        // "12:00"
  daysOfWeek: number[],   // [0,1,2,3,4,5,6]
  capacity: number,
  adultPrice: number,
  childPrice: number,
  gender: 'mixed' | 'male' | 'female',
  isActive: boolean
}
```

### PoolBooking

```typescript
{
  id: UUID,
  userId: UUID,
  sessionId: UUID,
  date: string,           // "2026-01-15"
  adultCount: number,
  childCount: number,
  totalAmount: number,
  status: 'pending' | 'confirmed' | 'checked_in' | 'cancelled',
  guests: PoolGuest[],
  paymentId?: UUID,
  notes?: string
}
```

### PoolGuest

```typescript
{
  name: string,
  type: 'adult' | 'child',
  braceletNumber?: string   // Assigned at check-in
}
```

## Availability Calculation

```typescript
// Available spots for a session on a date
const bookings = await getBookingsForSession(sessionId, date);
const bookedCount = bookings.reduce((sum, b) => 
  sum + b.adultCount + b.childCount, 0
);
const available = session.capacity - bookedCount;
```

## Gender Restrictions

Sessions can be restricted by gender:
- `mixed` - Open to all
- `male` - Men only
- `female` - Women only

Customer gender is checked during booking for restricted sessions.

---

See [frontend/src/components/modules/pool](../../frontend/src/components/modules/pool) for UI components.
