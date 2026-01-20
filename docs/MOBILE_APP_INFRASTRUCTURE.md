# Mobile App Infrastructure - Implementation Summary

## Overview
This document summarizes the mobile app infrastructure implemented to support native iOS/Android apps and enhanced PWA functionality for V2 Resort.

## Changes Made

### 1. Database Schema (`20260119150000_add_device_tokens.sql`)

#### `device_tokens` Table
Stores device registration information for push notifications:
- `id` - UUID primary key
- `user_id` - Foreign key to users table
- `device_token` - Unique FCM/APNS token
- `platform` - ENUM: 'ios', 'android', 'web'
- `device_name` - User-friendly device name
- `device_model` - Device hardware model
- `os_version` - Operating system version
- `app_version` - App version for targeting
- `notifications_enabled` - User preference flag
- `is_active` - Soft delete flag
- `last_used_at` - Last activity timestamp
- Indexes on user_id, device_token, and platform

#### `notification_logs` Table
Audit trail for all push notifications sent:
- Title, body, data payload
- Status tracking (queued, sent, delivered, failed)
- Provider information (FCM, APNS, mock)
- Error logging for failed notifications
- Reference to originating entity (order, booking, etc.)

### 2. Push Notification Service (`backend/src/services/pushNotification.service.ts`)

Features:
- **Firebase Cloud Messaging (FCM)** integration for Android/iOS
- **Graceful degradation** - works in mock mode when Firebase not configured
- **Notification templates** for common scenarios:
  - Order placed/ready/status update
  - Booking confirmed/reminder
  - Payment received
  - Loyalty points earned
  - Promotional messages

API:
```typescript
sendToUser(userId, payload, options)      // Send to all user devices
sendToUsers(userIds, payload, options)    // Bulk send to multiple users
sendToTokens(tokens, payload, options)    // Send to specific tokens
sendToTopic(topic, payload, options)      // Topic-based broadcasting
```

### 3. Device Management Module (`backend/src/modules/devices/`)

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/devices/register` | Register device for push notifications |
| DELETE | `/api/devices/unregister` | Soft delete device registration |
| GET | `/api/devices` | List user's registered devices |
| PATCH | `/api/devices/:id/preferences` | Update notification preferences |
| DELETE | `/api/devices/:id` | Hard delete device |
| POST | `/api/devices/logout-all` | Invalidate all device tokens |

### 4. API Versioning (`backend/src/routes/v1.routes.ts`)

- All existing endpoints now available at `/api/v1/*`
- Original `/api/*` endpoints preserved for backward compatibility
- Version info endpoint at `/api/v1` returns:
  - API version
  - Status (stable/deprecated)
  - List of available endpoints

### 5. Configuration Updates (`backend/src/config/index.ts`)

New configuration sections:
```typescript
firebase: {
  serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  projectId: process.env.FIREBASE_PROJECT_ID,
}

mobile: {
  bundleId: {
    ios: process.env.IOS_BUNDLE_ID || 'com.v2resort.app',
    android: process.env.ANDROID_BUNDLE_ID || 'com.v2resort.app',
  },
  appleTeamId: process.env.APPLE_TEAM_ID,
  deepLinkScheme: process.env.DEEP_LINK_SCHEME || 'v2resort',
}
```

## Environment Variables (New)

Add these to your `.env` file when deploying mobile app support:

```env
# Firebase Push Notifications
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
# OR provide as JSON string:
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
FIREBASE_PROJECT_ID=your-project-id

# Mobile App IDs
IOS_BUNDLE_ID=com.v2resort.app
ANDROID_BUNDLE_ID=com.v2resort.app
APPLE_TEAM_ID=XXXXXXXXXX
DEEP_LINK_SCHEME=v2resort
```

## Next Steps

### Phase 2: Apple/Google Pay Integration
1. Add Apple Pay to Stripe payment controller
2. Add Google Pay to Stripe payment controller
3. Update frontend payment forms

### Phase 3: React Native App
1. Set up React Native project with Expo
2. Implement authentication flow
3. Integrate push notification handling
4. Build core features (bookings, orders, etc.)

### Phase 4: App Store Preparation
1. App icons and splash screens
2. Privacy policy updates
3. Terms of service updates
4. App Store listing content
5. TestFlight/Play Console beta testing

## Testing

### Device Registration Test
```bash
# Get auth token first
TOKEN=$(curl -s -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.accessToken')

# Register device
curl -X POST http://localhost:3005/api/devices/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceToken": "test-fcm-token-123",
    "platform": "ios",
    "deviceName": "iPhone 15",
    "appVersion": "1.0.0"
  }'

# List devices
curl http://localhost:3005/api/devices \
  -H "Authorization: Bearer $TOKEN"
```

## Architecture Notes

### Security
- All device endpoints require authentication
- Device tokens are unique per device
- Tokens automatically reassigned when user logs in on same device
- Invalid tokens are automatically deactivated

### Scalability
- Batch processing for bulk notifications (10 users at a time)
- Failed token cleanup to maintain clean database
- Notification logging for audit and debugging

### Compatibility
- Works without Firebase (mock mode for development)
- Supports existing PWA web push alongside mobile
- API versioning ensures mobile apps continue working during updates
