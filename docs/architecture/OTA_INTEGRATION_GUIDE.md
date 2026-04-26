# OTA Integration Guide

This project uses an adapter abstraction for OTA integrations in `backend/src/modules/channels/adapters`.

## Adapter contract

Implement `OTAAdapter` from `ota-adapter.interface.ts`:

- `getName()`
- `getAvailability()`
- `updateAvailability()`
- `getRates()`
- `updateRates()`
- `getReservations()`
- `createReservation()`
- `cancelReservation()`

## Add a new OTA adapter

1. Create a new file in `backend/src/modules/channels/adapters`, for example `booking-com.adapter.ts`.
2. Implement the `OTAAdapter` interface.
3. Register it in `ota-registry.ts`:
   - `registerOTAAdapter('direct_booking_com', new BookingComAdapter())`
4. Use the adapter key where needed in channel routing/controller flow.

## Registry behavior

- `getOTAAdapter('siteminder')` returns the SiteMinder adapter.
- Unknown adapters throw a clear error: `Adapter not registered: <name>`.

## Credentials and env vars

Each adapter should define and validate its own required credentials (API keys, client IDs, secrets, property IDs) from environment variables before making API calls.

## Current limitations

- SiteMinder remains the operational OTA path.
- The adapter layer is in place to avoid rewriting controller logic when adding direct integrations.
