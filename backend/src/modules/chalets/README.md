# Chalets Module

Multi-day accommodation booking system.

## Features

- **Chalet Listings** - Details, amenities, images
- **Availability Calendar** - Date range selection
- **Booking System** - Reservations with payment
- **Check-in/Check-out** - Staff management

## API Endpoints

### Chalets

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/chalets` | List all chalets |
| `GET` | `/chalets/:id` | Chalet details |
| `POST` | `/chalets` | Create chalet (admin) |
| `PUT` | `/chalets/:id` | Update chalet (admin) |
| `GET` | `/chalets/:id/availability` | Check date availability |

### Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/chalets/bookings` | Create booking |
| `GET` | `/chalets/bookings` | User's bookings |
| `GET` | `/chalets/bookings/:id` | Booking details |
| `PUT` | `/chalets/bookings/:id/cancel` | Cancel booking |
| `PUT` | `/chalets/bookings/:id/checkin` | Check in (staff) |
| `PUT` | `/chalets/bookings/:id/checkout` | Check out (staff) |

### Query Parameters

```
GET /chalets?capacity_gte=4&amenities=pool,wifi
GET /chalets/:id/availability?checkIn=2026-01-15&checkOut=2026-01-18
```

## Booking Flow

```
browse chalets → select dates → review pricing → payment → confirmation
                                                           ↓
                                             check-in (day of arrival)
                                                           ↓
                                             check-out (departure day)
```

## Data Models

### Chalet

```typescript
{
  id: UUID,
  moduleId: UUID,
  name: string,
  name_ar?: string,
  description?: string,
  capacity: number,          // Max guests
  bedrooms: number,
  bathrooms: number,
  pricePerNight: number,
  weekendPricePerNight?: number,
  amenities: string[],       // ['wifi', 'pool', 'bbq']
  images: string[],          // URLs
  isActive: boolean
}
```

### ChaletBooking

```typescript
{
  id: UUID,
  userId: UUID,
  chaletId: UUID,
  checkIn: Date,
  checkOut: Date,
  guestCount: number,
  totalAmount: number,
  status: BookingStatus,
  paymentId?: UUID,
  specialRequests?: string
}

type BookingStatus = 
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled';
```

## Pricing Calculation

```typescript
function calculatePrice(chalet: Chalet, checkIn: Date, checkOut: Date): number {
  let total = 0;
  let current = new Date(checkIn);
  
  while (current < checkOut) {
    const isWeekend = [5, 6].includes(current.getDay()); // Fri, Sat
    const rate = isWeekend 
      ? (chalet.weekendPricePerNight || chalet.pricePerNight)
      : chalet.pricePerNight;
    total += rate;
    current.setDate(current.getDate() + 1);
  }
  
  return total;
}
```

## Availability Check

```typescript
async function checkAvailability(
  chaletId: string, 
  checkIn: Date, 
  checkOut: Date
): Promise<boolean> {
  const conflicts = await db.query(`
    SELECT id FROM chalet_bookings
    WHERE chalet_id = $1
    AND status NOT IN ('cancelled')
    AND (check_in, check_out) OVERLAPS ($2, $3)
  `, [chaletId, checkIn, checkOut]);
  
  return conflicts.length === 0;
}
```

## Amenities

Standard amenity options:
- `wifi` - WiFi Internet
- `pool` - Private Pool
- `bbq` - BBQ/Grill
- `ac` - Air Conditioning
- `kitchen` - Full Kitchen
- `parking` - Private Parking
- `tv` - Smart TV
- `jacuzzi` - Jacuzzi

---

See [frontend/src/components/modules/chalets](../../frontend/src/components/modules/chalets) for UI components.
