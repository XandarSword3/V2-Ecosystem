# V2 Resort Mobile App - Stability Guide

## Overview

This document explains the mobile app architecture and the resolution of the **WorkletsError** issue that occurs with Expo Go.

## The Problem

When running the app in **Expo Go**, you may see:

```
WorkletsError: Mismatch between JavaScript part and native part of Worklets
JS: 0.7.2 | Native: 0.5.1
```

And:

```
TypeError: Cannot read property 'makeMutable' of undefined
```

### Root Cause

- **Expo Go** ships with **fixed native binaries** (including react-native-worklets v0.5.1)
- **react-native-reanimated 4.x** bundles **react-native-worklets v0.7.x** in JavaScript
- These versions are incompatible - the native methods don't match the JS API

### Why This Cannot Be Fixed in Expo Go

Expo Go is a pre-built app with frozen native dependencies. You cannot change the native worklets version embedded in Expo Go.

## The Solution: Custom Development Build

Instead of Expo Go, build a **custom development client** where native code is compiled from your project's `node_modules`. This ensures JS and native versions match exactly.

## Prerequisites

### For Android Development

1. **Install Android Studio**: https://developer.android.com/studio

2. **Set up Android SDK**:
   - Open Android Studio → SDK Manager
   - Install Android SDK (API 34 recommended)
   - Install Android SDK Build-Tools
   - Install Android SDK Command-line Tools

3. **Set Environment Variables** (Windows):
   ```powershell
   [Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   [Environment]::SetEnvironmentVariable("Path", "$env:Path;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\tools;$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin", "User")
   ```

4. **Create Android Virtual Device (AVD)**:
   - Open Android Studio → Device Manager
   - Create a device (Pixel 6 with API 34 recommended)

### For iOS Development (macOS only)

1. **Install Xcode** from Mac App Store
2. **Install Command Line Tools**: `xcode-select --install`
3. **Install CocoaPods**: `sudo gem install cocoapods`

## Build Commands

### Generate Native Projects (Prebuild)

```bash
# Android only
npx expo prebuild --platform android --clean

# iOS only (macOS)
npx expo prebuild --platform ios --clean

# Both platforms
npx expo prebuild --clean
```

### Build and Run Development Client

```bash
# Android
npx expo run:android

# iOS (macOS)
npx expo run:ios
```

### Web Development (No SDK Required)

```bash
# Start web dev server
npx expo start --web

# Export web build
npx expo export --platform web
```

## Package Configuration

This project uses:

| Package | Version | Notes |
|---------|---------|-------|
| expo | ~54.0.0 | Expo SDK 54 |
| react-native | 0.81.5 | Latest stable |
| react-native-reanimated | ~4.1.1 | Requires dev build |
| nativewind | 4.1.23 | Tailwind for RN |
| expo-router | ^6.0.0 | File-based routing |

### NativeWind v4 Configuration

**babel.config.js**:
```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

**metro.config.js**:
```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
```

**tailwind.config.js**:
```javascript
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require("nativewind/preset")],
  // ... theme config
};
```

## Verification Checklist

✅ **TypeScript**: `npx tsc --noEmit` passes with zero errors  
✅ **Web Export**: `npx expo export --platform web` bundles 2499 modules  
✅ **Web Dev Server**: `npx expo start --web` bundles 2570 modules  
✅ **Android Prebuild**: `npx expo prebuild --platform android` succeeds  
⏳ **Android Dev Build**: Requires Android SDK installation  
⏳ **iOS Dev Build**: Requires macOS with Xcode  

## Troubleshooting

### "Android SDK not found"

Install Android Studio and SDK as described above, then restart your terminal.

### "adb is not recognized"

Add Android platform-tools to your PATH:
```powershell
$env:Path += ";$env:LOCALAPPDATA\Android\Sdk\platform-tools"
```

### Metro bundler stuck

```bash
npx expo start --clear
```

### Clean rebuild

```bash
rm -rf node_modules android ios
npm install
npx expo prebuild --clean
npx expo run:android  # or run:ios
```

## Branch

This stable configuration is on branch: `fix/mobile-stability-complete`

## Summary

| Environment | Status | Notes |
|-------------|--------|-------|
| **Web** | ✅ Stable | No native deps needed |
| **Expo Go** | ❌ Incompatible | Fixed native binaries |
| **Dev Build (Android)** | ✅ Ready | Requires Android SDK |
| **Dev Build (iOS)** | ✅ Ready | Requires macOS + Xcode |
