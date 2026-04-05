# Auth Module — Detailed Service Specification

## Overview
The Authentication module provides robust user lifecycle management via JWT tokens, OAuth 2.0 integrations, and 2FA.

## API Endpoints & Payload Contracts

### `POST /api/v1/auth/register`
- **Request**: `{ email, password, fullName, phone (optional), role (optional) }`
- **Business Logic**: 
  - Validates payload via Zod schemas (`registerSchema`).
  - Implements anti-enumeration protection (returns success even if email exists but triggers an internal "account exists" email notification).
  - Creates the user in Supabase and logs the `REGISTER` action.

### `POST /api/v1/auth/login`
- **Request**: `{ email, password }`
- **Business Logic**:
  - Validates credentials and checks for `requiresTwoFactor` flags.
  - Returns `requiresTwoFactor: true` if 2FA is mandated for the account before issuing the JWT.
  - Returns `{ accessToken, refreshToken }` inside `data` property.
  - **Security**: Rotates the CSRF token on successful login to prevent session fixation headers.
  - Returns `EMAIL_NOT_VERIFIED` error with a `resendUrl` if the user has not confirmed their email.

### `POST /api/v1/auth/refresh`
- **Request**: `{ refreshToken }`
- **Business Logic**: Exchanges a valid `refreshToken` (valid for 30d as per `.env`) for a fresh `accessToken` (valid for 7d).

### `POST /api/v1/auth/logout`
- **Request**: `{ refreshToken (optional) }`
- **Business Logic**: Invalidates tokens and logs the user out. Logs `LOGOUT` to activity streams.

### `GET /api/v1/auth/oauth/google` & `.../apple`
- **Business Logic**: Integrates social login. Handled via `oauth.controller.ts`.

### Additional Endpoints
- `POST /api/v1/auth/forgot-password` — Fire-and-forget password reset link. Anti-enumeration applied.
- `POST /api/v1/auth/reset-password` — `{ token, newPassword }` payload accepted to reset.
- `GET /api/v1/auth/verify-email?token=...` — Verifies email.
- `POST /api/v1/auth/resend-verification` — Validates user state before re-sending verify payload.

## Core Middleware Usage
- **CSRF Token Generation**: Applied dynamically in `login`.
- **Zod Validation**: Applied globally on auth body payloads before service execution.

## Status in Browser (Local Simulation)
- Tested Flow: *Pending verification via subagent*
