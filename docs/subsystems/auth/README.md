# Authentication Subsystem (`modules/auth`)

## 🎯 Purpose
The **Authentication Subsystem** is the gatekeeper of the V2 Ecosystem. It manages identity verification, session lifecycle, and secure access to protected resources. It implements a dual-token architecture (Access + Refresh) and enforced 2FA.

## 🔑 Responsibilities
*   **Registration**: Onboarding new users with duplicate email checks and bcrypt password hashing.
*   **Login**: Credentials verification and session initiation.
*   **Session Management**: Issuing, rotating, and revoking JWTs.
*   **Two-Factor Authentication (2FA)**: TOTP-based second factor (Google Authenticator).
*   **Password Management**: Reset flows via email tokens.
*   **Activity Auditing**: Logging sensitive actions (`LOGIN`, `REGISTER`, `PASSWORD_CHANGE`).

## 🏗️ Internal Architecture

### Controller Layer (`auth.controller.ts`)
*   **Role**: Request handlers, HTTP status code mapping, and Activity Logging trigger points.
*   **Validation**: Uses `zod` schemas (`loginSchema`, `registerSchema`) before processing.

### Service Layer (`auth.service.ts`)
*   **Role**: Core business logic.
*   **Logic**:
    *   Hashes passwords with `bcryptjs` (Cost factor 12).
    *   Interacts with `users` table via Supabase client.
    *   Generates Tokens via `auth.utils.ts`.
    *   Sends emails via `emailService`.

### Data Flow
1.  **Client Request** (`POST /api/auth/login`)
2.  **Middleware**: `json()` parser, `App` level security.
3.  **Controller**: Validates Zod Schema.
4.  **Service**:
    *   Look up user by email.
    *   `bcrypt.compare(password, hash)`.
    *   Check 2FA status.
5.  **Output**: Returns `accessToken` (Short-lived) + `refreshToken` (Long-lived, stored in DB).

## 🛡️ Security Implementation
*   **Password Storage**: Bcrypt (never plain text).
*   **Token Strategy**:
    *   Access Token: 15 minutes (Memory/Header).
    *   Refresh Token: 7 days (Database-backed for revocation).
*   **Brute Force Protection**: Rate limiting applied at the route level.

## 💾 Data Model Dependencies
*   Table `users`: Stores core identity & password hash.
*   Table `sessions`: Stores active refresh tokens (for "Logout All" capability).

## ⚠️ Known Debt / Weaknesses
*   **Token Storage**: In-memory tokens on client side (safe from XSS but lost on reload if not handled carefully).
*   **Password Policy**: Hardcoded in Zod schema, not configurable via DB.
