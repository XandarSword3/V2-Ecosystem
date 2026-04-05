# 8. Offline Mode Testing

## Objective

Verify the PWA offline capabilities work correctly: service worker caching, offline page display, cached page serving, and recovery when going back online.

---

## Architecture Overview

### Service Worker (`frontend/public/sw.js`)

| Strategy | Used For | Behavior |
|----------|----------|----------|
| Cache-first | Static assets (.js, .css, .png, etc.) | Serve from cache, fallback to network |
| Network-first | API routes (`/api/`) | Try network, fallback to cache |
| Navigation handler | Page navigations | Try network, then cached same-URL, then offline page |

### Cache Name: `v2-resort-v1`

### Pre-cached Assets
- `/` (homepage)
- `/offline`
- `/manifest.json`
- `/favicon.svg`
- `/icons/icon-192x192.png`
- `/icons/icon-512x512.png`

### Offline Storage (`frontend/src/lib/offline/`)

| Component | Purpose |
|-----------|---------|
| `offline-storage.ts` | IndexedDB schema (menu items, orders, sync queue, customers, etc.) |
| `offline-sync.ts` | Background sync manager, conflict resolution, cache refresh |
| `offline-status-indicator.tsx` | Visual indicator component (synced/pending/offline) |

### Development Mode Note

> The service worker is **disabled in development** (`pwa.ts` line 26). In dev mode, it explicitly unregisters all service workers and clears caches to prevent stale JS. For testing purposes, this check was temporarily bypassed, then reverted.

---

## Test Setup

1. Temporarily disabled the dev-mode service worker bypass in `pwa.ts`
2. Loaded key pages to populate service worker cache:
   - Homepage (`/`)
   - Restaurant (`/restaurant`)
   - Chalets (`/chalets`)
   - Pool (`/pool`)
3. Verified service worker registration: `scope: http://localhost:3000/`, state: `activated`, controller: `true`

### Cached URLs After Setup

```
/
/_next/static/chunks/app-pages-internals.js
/_next/static/chunks/app/chalets/page.js
/_next/static/chunks/app/pool/page.js
/_next/static/chunks/app/restaurant/page.js
/_next/static/chunks/main-app.js
/_next/static/chunks/webpack.js
/_next/static/css/app/layout.css
/chalets
/favicon.svg
/icons/icon-192x192.png
/icons/icon-512x512.png
/manifest.json
/offline
/pool
/restaurant
```

---

## Test Results

### Test 1: Cached Homepage Offline

| Aspect | Result | Status |
|--------|--------|--------|
| Set browser offline | `navigator.onLine: false` | ✅ |
| Navigate to `/` | Page loads from cache | ✅ |
| Page title | "Mediterranean Grand Resort \| Luxury Experience" | ✅ |
| HTML content | Full page structure in accessibility tree | ✅ |
| CSS/JS loading | Some versioned assets fail (dev-mode cache busting) | ⚠️ Expected |

> **Note:** In dev mode, Next.js appends `?v=timestamp` to CSS/JS URLs, causing cache misses for versioned assets. In production with hashed filenames, this would not occur.

### Test 2: Dedicated Offline Page

| Aspect | Result | Status |
|--------|--------|--------|
| Navigate to `/offline` | Page loads from cache | ✅ |
| "You're Offline" heading | Displayed correctly | ✅ |
| Message | "It looks like you've lost your internet connection" | ✅ |
| "Try Again" button | Present and functional | ✅ |
| Auto-sync notice | "Your pending actions will sync automatically" | ✅ |
| Available Offline list | ✓ View cached bookings, ✓ Browse saved menus, ✓ Access your profile | ✅ |

### Test 3: Cached Module Pages Offline

| Page | URL | Loads Offline | Status |
|------|-----|--------------|--------|
| Restaurant | `/restaurant` | ✅ Full content | ✅ |
| Chalets | `/chalets` | ✅ Full content | ✅ |
| Pool | `/pool` | ✅ Full content | ✅ |

### Test 4: Recovery (Back Online)

| Aspect | Result | Status |
|--------|--------|--------|
| Set browser online | `navigator.onLine: true` | ✅ |
| Socket reconnection | "[Socket] Reconnected" / "[Socket] Connected" | ✅ |
| "Try Again" button | Reloads page successfully | ✅ |
| Homepage navigation | Loads normally from network | ✅ |
| API requests | Resume with retry logic (3 retries) | ✅ |

---

## Offline Infrastructure Checklist

- [x] Service worker file exists (`public/sw.js`)
- [x] Service worker registers on page load
- [x] Service worker activates and claims clients
- [x] Pre-cache assets installed on SW install
- [x] Navigation requests cached on successful response
- [x] Cache-first strategy for static assets
- [x] Network-first strategy for API routes
- [x] Offline page exists and is pre-cached
- [x] Offline page shows user-friendly message
- [x] Offline page has "Try Again" button (calls `window.location.reload()`)
- [x] Offline page lists available offline features
- [x] Auto-sync message present
- [x] IndexedDB offline storage schema defined
- [x] Sync queue for offline mutations
- [x] Offline status indicator component exists
- [x] Online/offline event listeners for sync triggers
- [x] Cached pages serve correctly when offline
- [x] Recovery works when reconnecting (sockets reconnect, APIs resume)
- [x] Dev mode correctly disables SW to prevent stale cache (reverted after test)

---

## Issues & Observations

| Issue | Severity | Description |
|-------|----------|-------------|
| Dev mode cache busting | Info | Next.js appends `?v=timestamp` to assets in dev, causing cache misses. Production uses hashed filenames which would cache correctly. |
| SW disabled in dev | By Design | `pwa.ts` intentionally disables SW in development to prevent stale JS caching. Required temporary bypass for testing. |
| `self.navigator?.onLine` in SW | Info | The service worker's `navigator.onLine` may not reflect Playwright's simulated offline, but actual network failures trigger the catch block correctly. |
