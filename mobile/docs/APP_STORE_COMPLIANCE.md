# App Store Compliance Artifacts

This document outlines all compliance requirements for iOS App Store and Google Play Store submissions.

## Table of Contents

1. [Privacy Policy Data Mapping](#privacy-policy-data-mapping)
2. [Push Notification Purpose Strings](#push-notification-purpose-strings)
3. [App Tracking Transparency (iOS 14.5+)](#app-tracking-transparency)
4. [Play Store Data Safety Form](#play-store-data-safety-form)
5. [App Store Review Guidelines Checklist](#app-store-review-guidelines)
6. [Required Screenshots & Metadata](#screenshots-metadata)

---

## Privacy Policy Data Mapping

### Data We Collect

| Data Type | Purpose | Collected | Shared | Retention |
|-----------|---------|-----------|--------|-----------|
| **Contact Info** |
| Email Address | Account creation, communication | Yes | No | Account lifetime |
| Phone Number | Optional profile, SMS notifications | Optional | No | Account lifetime |
| Name | Profile, personalization | Yes | No | Account lifetime |
| **Identifiers** |
| User ID | Account management | Yes | No | Account lifetime |
| Device ID | Push notifications, analytics | Yes | No | Until device unregistered |
| **Location** |
| Coarse Location | Show nearby amenities (if implemented) | Optional | No | Session only |
| **Purchases** |
| Purchase History | Order tracking, loyalty program | Yes | Stripe (payment processor) | 7 years (legal) |
| Payment Info | Process payments | Yes | Stripe only | Not stored locally |
| **Usage Data** |
| Product Interaction | Improve recommendations | Yes | No | 2 years |
| Crash Data | Fix bugs | Yes | Sentry (if enabled) | 90 days |
| **Diagnostics** |
| Performance Data | App optimization | Yes | No | 90 days |

### Data NOT Collected

- Precise location (GPS)
- Health & fitness data
- Financial information (beyond payments)
- Sensitive information
- Contacts
- Browsing history
- Search history

---

## Push Notification Purpose Strings

### iOS Info.plist Strings

```xml
<!-- Push Notifications -->
<key>NSUserTrackingUsageDescription</key>
<string>This identifier will be used to deliver personalized promotions and offers based on your preferences.</string>

<!-- Camera (QR Scanning) -->
<key>NSCameraUsageDescription</key>
<string>V2 Resort uses your camera to scan QR codes for quick check-in at pool entries and restaurant tables.</string>

<!-- Photo Library (Profile Picture) -->
<key>NSPhotoLibraryUsageDescription</key>
<string>V2 Resort needs access to your photos to let you set a profile picture.</string>

<!-- Background Refresh -->
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>
```

### Push Notification Categories

| Category | Purpose | User Benefit |
|----------|---------|--------------|
| `order_update` | Order status changes | Know when order is ready |
| `booking_confirmation` | Booking confirmations | Confirmation receipt |
| `payment_success` | Payment confirmations | Transaction receipts |
| `payment_failed` | Payment failures | Retry immediately |
| `loyalty_points` | Points earned/redeemed | Track rewards |
| `promotion` | Special offers (opt-in) | Save money |

---

## App Tracking Transparency

### ATT Decision

**Decision: Request ATT permission ONLY if implementing personalized ads.**

Current implementation: NO tracking that requires ATT.

### If ATT is Needed Later

```typescript
// expo-tracking-transparency usage
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

async function requestTracking() {
  const { status } = await requestTrackingPermissionsAsync();
  
  if (status === 'granted') {
    // Enable personalized ads
  } else {
    // Use contextual ads only
  }
}
```

### ATT String (if needed)

```
This identifier will be used to deliver personalized promotions and offers based on your browsing preferences. You can change this in Settings at any time.
```

---

## Play Store Data Safety Form

### Questionnaire Responses

#### Does your app collect or share any of the required user data types?
**Yes**

#### Is all of the user data collected by your app encrypted in transit?
**Yes** - All API communication uses HTTPS/TLS 1.3

#### Do you provide a way for users to request that their data is deleted?
**Yes** - Account deletion available in app and via support

### Data Types Declaration

| Data Type | Collected | Shared | Purpose | Required |
|-----------|-----------|--------|---------|----------|
| Email address | Yes | No | Account management | Yes |
| Name | Yes | No | App functionality | Yes |
| Phone number | Yes | No | App functionality | No |
| Purchase history | Yes | No | App functionality | Yes |
| App interactions | Yes | No | Analytics | Yes |
| Crash logs | Yes | No | Analytics | Yes |
| Device identifiers | Yes | No | App functionality | Yes |

### Security Practices

- [x] Data is encrypted in transit
- [x] Data can be deleted by user request
- [x] Committed to Play Families Policy (if targeting children - N/A)

---

## App Store Review Guidelines

### Pre-Submission Checklist

#### 1. Safety
- [ ] No objectionable content
- [ ] User-generated content moderation (reviews)
- [ ] No harmful functionality

#### 2. Performance
- [ ] App is complete and functional
- [ ] No placeholder content
- [ ] No hidden features
- [ ] Works on all supported devices

#### 3. Business
- [ ] Accurate app description
- [ ] In-app purchases clearly described
- [ ] No fake reviews/ratings manipulation

#### 4. Design
- [ ] Follows Human Interface Guidelines
- [ ] No web view wrapping
- [ ] Native navigation patterns

#### 5. Legal
- [ ] Privacy policy link valid
- [ ] Terms of service available
- [ ] GDPR compliant (if serving EU)
- [ ] All licenses properly attributed

### Common Rejection Reasons to Avoid

1. **Crashes/Bugs**: Test thoroughly on physical devices
2. **Incomplete metadata**: Fill all fields
3. **Placeholder content**: Replace all "Lorem ipsum"
4. **Guideline 4.2 (Minimum Functionality)**: Ensure app provides real value
5. **Missing login credentials**: Provide demo account for review

### Demo Account for Review

```
Email: appreview@v2resort.com
Password: [Secure password here]
Notes: This account has sample order history and loyalty points.
```

---

## Screenshots & Metadata

### iOS Screenshots Required

| Device | Size | Count |
|--------|------|-------|
| iPhone 6.7" (14 Pro Max) | 1290 x 2796 | 5-10 |
| iPhone 6.5" (11 Pro Max) | 1284 x 2778 | 5-10 |
| iPhone 5.5" (8 Plus) | 1242 x 2208 | 5-10 |
| iPad Pro 12.9" | 2048 x 2732 | 5-10 |

### Android Screenshots Required

| Device | Size | Count |
|--------|------|-------|
| Phone | 1080 x 1920 | 4-8 |
| 7" Tablet | 1200 x 1920 | 4-8 |
| 10" Tablet | 1920 x 1200 | 4-8 |

### Screenshot Checklist

- [ ] Home screen with welcome message
- [ ] Restaurant menu browsing
- [ ] Order placement flow
- [ ] Pool booking interface
- [ ] Chalet booking interface
- [ ] Payment with Apple Pay/Google Pay
- [ ] Loyalty points display
- [ ] Push notification example
- [ ] Account/profile screen

### App Store Metadata

**App Name**: V2 Resort
**Subtitle**: Your Resort Experience (max 30 chars)
**Category**: Travel (primary), Food & Drink (secondary)

**Keywords** (100 chars max):
```
resort,booking,restaurant,pool,chalet,vacation,holiday,dining,reservations,loyalty
```

**Short Description** (80 chars - Play Store):
```
Book pool passes, reserve chalets, order food & earn loyalty rewards at V2 Resort.
```

**Full Description** (4000 chars max):

```
V2 Resort - Your Complete Resort Experience

Experience seamless resort services at your fingertips. Whether you're booking a poolside chalet, ordering from our restaurant, or checking your loyalty rewards, the V2 Resort app makes your stay unforgettable.

KEY FEATURES:

🏊 POOL & CHALETS
• Book pool session passes instantly
• Reserve private chalets for the day
• View real-time availability
• Receive booking confirmations

🍽️ RESTAURANT
• Browse our full menu with photos
• Place orders from anywhere in the resort
• Customize items to your preference
• Track your order in real-time
• Pay securely with Apple Pay or Google Pay

🎁 LOYALTY REWARDS
• Earn points on every purchase
• Track your rewards balance
• Redeem points for discounts
• Exclusive member promotions

📱 CONVENIENT
• Push notifications for order updates
• Digital receipts
• Order history at a glance
• Secure payment storage

Download now and elevate your V2 Resort experience!
```

### Age Rating

- **iOS**: 4+ (No objectionable content)
- **Android**: Everyone

### Pricing

- Free to download
- In-app purchases for services

---

## Compliance Timeline

### Pre-Launch (T-4 weeks)
- [ ] Privacy policy published and linked
- [ ] Terms of service published
- [ ] All Info.plist strings finalized
- [ ] Data safety form drafted

### Launch Week (T-1 week)
- [ ] Final screenshots captured
- [ ] App metadata finalized
- [ ] Demo account created
- [ ] TestFlight beta tested
- [ ] Play Store internal testing completed

### Submission Day
- [ ] All metadata entered
- [ ] Screenshots uploaded
- [ ] Build uploaded
- [ ] Review notes prepared
- [ ] Contact info verified

---

## Contact Information

**App Support Email**: support@v2resort.com
**Privacy Policy URL**: https://v2resort.com/privacy
**Terms of Service URL**: https://v2resort.com/terms
**Marketing Website**: https://v2resort.com

---

*Last Updated: [Date]*
*Version: 1.0.0*
