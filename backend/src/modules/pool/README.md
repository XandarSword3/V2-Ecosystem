# Pool Module

Pool and amenity session management.

## Route Mount

`/api/v1/pool`

## Contents (9 files)

Largest module directory — includes controllers and services for:
- Pool session booking and check-in/out
- Amenity scheduling
- Pool membership management (via `pool-membership.service.ts`)
- Capacity tracking
- Session time slots

## Key Endpoints

- `GET /api/v1/pool/sessions` — List sessions
- `POST /api/v1/pool/sessions` — Book a session
- `PUT /api/v1/pool/sessions/:id/checkin` — Check in
- `PUT /api/v1/pool/sessions/:id/checkout` — Check out
- `GET /api/v1/pool/memberships` — List memberships
