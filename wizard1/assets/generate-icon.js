#!/usr/bin/env node
// ============================================================
// Generates a minimal placeholder icon.ico for development
// In production, replace assets/icon.ico with your real icon
// ============================================================
//
// To use: node generate-icon.js
// Requires: npm install -g png2icons  (or use any ICO converter)
//
// Alternatively, drop a 256x256 icon.ico directly into ./assets/
//
// The icon should represent V2 Resort branding.
// Recommended: a hexagon shape matching the ⬡ in the titlebar.
//
// Free ICO creation tools:
//   - https://icoconvert.com
//   - https://convertico.com
//   - ImageMagick: convert icon.png -define icon:auto-resize="256,128,64,48,32,16" icon.ico

console.log('Place your 256x256 icon.ico at: wizard1/assets/icon.ico');
console.log('electron-builder will embed it into the installer automatically.');
