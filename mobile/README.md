# V2 Resort Mobile App

React Native / Expo mobile app for V2 Resort.

## Architecture

This is a **minimal app shell** following the correct mobile development approach:

1. ✅ **Authentication Flow** - Login, register, token refresh
2. ✅ **API Client** - Platform-aware with automatic token refresh
3. ✅ **Push Notifications** - Registration, handling, deep links
4. ✅ **Deep Linking** - URL scheme and universal links

Feature UI is intentionally NOT implemented yet - that comes after backend hardening is complete.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
cd mobile
npm install
```

### Running

```bash
# Start Expo dev server
npm start

# iOS
npm run ios

# Android
npm run android
```

### Environment Configuration

Edit `src/config/env.ts` or set via EAS:

```typescript
// Development
API_BASE_URL: 'http://localhost:3005'

// Production
API_BASE_URL: 'https://api.v2resort.com'
```

## Project Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Auth screens (login, register)
│   ├── (tabs)/            # Main tab navigation
│   └── _layout.tsx        # Root layout
├── src/
│   ├── api/               # API client with token refresh
│   ├── config/            # Environment configuration
│   ├── services/          # Push notifications, deep linking
│   └── store/             # Zustand state management
├── assets/                # Images, fonts, sounds
├── docs/                  # App Store compliance docs
└── app.json               # Expo configuration
```

## Key Features

### Authentication

- JWT with 15min access / 7day refresh tokens
- Automatic token refresh on 401
- Multi-device support
- Logout all devices option

### Push Notifications

```typescript
// Register device
await registerDevice();

// Handle notification tap
setupNotificationListeners();
```

### Deep Linking

Supports:
- Custom scheme: `v2resort://`
- Universal links: `https://v2resort.com/app/*`

### Stripe Payments (Configured)

Apple Pay and Google Pay ready via `@stripe/stripe-react-native`.

## Building for Production

### EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build for app stores
eas build --platform ios
eas build --platform android
```

### Required Files

- `google-services.json` (Android - Firebase)
- `GoogleService-Info.plist` (iOS - Firebase)
- Apple Developer certificates
- Play Store signing key

## App Store Compliance

See `docs/APP_STORE_COMPLIANCE.md` for:

- Privacy policy data mapping
- Push notification purpose strings
- ATT decisions (iOS 14.5+)
- Play Store data safety form
- Screenshot requirements

## Next Steps

1. Complete backend hardening (auth tests, permission enforcement)
2. Test push notifications with real FCM project
3. Implement feature UI (restaurant, pool, chalets)
4. Add Stripe payment flow UI
5. Submit to app stores

## Dependencies

| Package | Purpose |
|---------|---------|
| expo | Framework |
| expo-router | Navigation |
| expo-secure-store | Token storage |
| expo-notifications | Push notifications |
| @stripe/stripe-react-native | Payments |
| zustand | State management |
| axios | HTTP client |
