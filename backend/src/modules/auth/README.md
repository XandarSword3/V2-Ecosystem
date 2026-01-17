# Auth Module

Authentication and authorization system.

## Features

- **Email/Password Login** - Traditional authentication
- **JWT Tokens** - Access and refresh tokens
- **Password Reset** - Email-based recovery
- **Two-Factor Auth** - TOTP-based 2FA
- **OAuth** - Google/Apple sign-in (optional)
- **Session Management** - Active session tracking

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Login (get tokens) |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/logout` | Invalidate session |

### Password

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/forgot-password` | Request reset email |
| `POST` | `/auth/reset-password` | Reset with token |
| `PUT` | `/auth/change-password` | Change password (logged in) |

### Email Verification

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/verify-email` | Verify email token |
| `POST` | `/auth/resend-verification` | Resend email |

### Two-Factor Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/2fa/setup` | Generate 2FA secret |
| `POST` | `/auth/2fa/verify` | Verify and enable |
| `POST` | `/auth/2fa/disable` | Disable 2FA |
| `POST` | `/auth/2fa/validate` | Validate code (login) |

## Token Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Login Flow                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. POST /auth/login                                        │
│     { email, password }                                      │
│                                                              │
│  2. If 2FA enabled:                                         │
│     Response: { requires2FA: true, tempToken }              │
│     POST /auth/2fa/validate { tempToken, code }             │
│                                                              │
│  3. Success Response:                                        │
│     {                                                        │
│       accessToken: "eyJ...",   // 15 min expiry             │
│       refreshToken: "eyJ...",  // 7 day expiry              │
│       expiresIn: 900,                                        │
│       user: { id, email, fullName, roles }                  │
│     }                                                        │
│                                                              │
│  4. Token Refresh:                                          │
│     POST /auth/refresh { refreshToken }                     │
│     → New accessToken                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Request Types

### Register

```typescript
interface RegisterRequest {
  email: string;
  password: string;           // Min 8 chars, 1 uppercase, 1 number
  fullName: string;
  phone?: string;
  preferredLanguage?: 'en' | 'ar' | 'fr';
}
```

### Login

```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

### Password Reset

```typescript
interface ForgotPasswordRequest {
  email: string;
}

interface ResetPasswordRequest {
  token: string;
  password: string;
}
```

## Token Configuration

```env
JWT_SECRET=your-256-bit-secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=different-256-bit-secret
REFRESH_TOKEN_EXPIRES_IN=7d
```

## Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- No common passwords (checked against list)

## Security Measures

1. **Rate Limiting** - 5 attempts per minute for login
2. **Password Hashing** - bcrypt with cost 12
3. **Token Rotation** - Refresh tokens are single-use
4. **Session Tracking** - Multiple sessions allowed, can revoke
5. **IP Logging** - Login attempts logged with IP

## Middleware

```typescript
import { authenticate, authorize, optionalAuth } from '@/middleware/auth';

// Require authentication
router.get('/profile', authenticate, profileController);

// Require specific permission
router.delete('/users/:id', 
  authenticate, 
  authorize('admin.users.manage'),
  deleteUser
);

// Optional auth (for public pages with user features)
router.get('/menu', optionalAuth, menuController);
```

## Error Responses

| Code | Message |
|------|---------|
| `AUTH_INVALID_CREDENTIALS` | Email or password incorrect |
| `AUTH_EMAIL_NOT_VERIFIED` | Email verification required |
| `AUTH_ACCOUNT_DISABLED` | Account has been disabled |
| `AUTH_2FA_REQUIRED` | Two-factor code required |
| `AUTH_TOKEN_EXPIRED` | Access token expired |
| `AUTH_TOKEN_INVALID` | Token is malformed |

---

See [frontend/src/app/[locale]/(public)/login](../../frontend/src/app/[locale]/(public)/login) for login UI.
