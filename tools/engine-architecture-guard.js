#!/usr/bin/env node
/**
 * F2.5: Engine A Architectural Source Guard
 *
 * Fails when generic Engine A frontend code introduces forbidden legacy
 * vertical vocabulary. Allow-listed narrowly per file — no blanket exclusions.
 *
 * Forbidden patterns in GENERIC Engine A code:
 *   - Legacy template_type values (menu_service, multi_day_booking, etc.)
 *     in RUNTIME code (not comments, not backend alias maps)
 *   - Legacy status vocabulary (preparing, served, delivered) as
 *     TRANSPORT values outside the canonical mapper
 *   - Hospitality-specific icons (ChefHat, UtensilsCrossed) in
 *     generic admin/staff surfaces (adapter boundary is OK)
 *
 * Usage: node tools/engine-architecture-guard.js [--ci]
 * Exit 0 = pass, Exit 1 = violation detected
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FRONTEND_SRC = path.join(ROOT, 'frontend/src');

// ============================================
// Rules
// ============================================

/**
 * Forbidden legacy template_type strings in runtime TypeScript.
 * These must never appear as string literals in frontend .ts/.tsx files
 * outside of the backend alias resolution maps (which are in backend/).
 */
const LEGACY_TEMPLATE_TYPES = [
  'menu_service',
  'multi_day_booking',
  'session_access',
  'subscription',
  'membership_access',
  'class_scheduling',
  'appointment_booking',
  'saas_subscription',
];

/**
 * Files where legacy template types ARE allowed (backward-compat fallbacks,
 * documentation, or explicit allow-listed compatibility shims).
 */
const TEMPLATE_TYPE_ALLOWLIST = new Set([
  // Settings context has a comment explaining the legacy column
  'lib/settings-context.tsx',
  // Admin orders page has a DB backward-compat filter for old rows
  'app/[property]/admin/orders/page.tsx',
  // types/index.ts has legacy TemplateType union for backward-compat wire types
  'types/index.ts',
  // Cockpit dashboard maps legacy template types to entity labels (display-only)
  'app/[property]/admin/cockpit/page.tsx',
  // Customizations page maps legacy types to entity names (display-only)
  'app/[property]/admin/customizations/page.tsx',
  // Unit page passes legacy orderType for backward-compat API calls
  'app/[property]/[slug]/[unitId]/page.tsx',
  // Coupon/PaymentDiscounts mention legacy types in JSDoc comments only
  'components/customer/CouponInput.tsx',
  'components/customer/PaymentDiscounts.tsx',
]);

/**
 * Hospitality-specific icons that should NOT appear in generic admin surfaces.
 * Allowed in adapter boundary files (KDS, kitchen components).
 */
const HOSPITALITY_ICONS = ['ChefHat', 'UtensilsCrossed'];

/**
 * Files where hospitality icons ARE allowed (adapter boundary).
 */
const ICON_ALLOWLIST = new Set([
  // === Adapter boundary (hospitality-specific surfaces) ===
  'components/staff/KitchenView.tsx',
  'components/KitchenDisplayBoard.tsx',
  // Menu admin is instant_transaction catalog management
  'app/[property]/admin/[slug]/menu/page.tsx',
  // POS templates are module-specific commerce surfaces
  'components/pos-templates/StaffPOSTemplate.tsx',
  'components/pos-templates/CustomerPOSTemplate.tsx',
  'components/pos-templates/AdminPOSTemplate.tsx',
  // Staff page has module-specific quick actions
  'app/[property]/staff/page.tsx',
  'app/[property]/staff/layout.tsx',
  // Admin navigation uses module type icons (adapter-owned mapping)
  'config/admin-navigation.ts',
  // Module utils maps engine_type to icons (adapter-owned)
  'lib/module-utils.ts',
  // === Customer-facing pages (hospitality is the primary vertical) ===
  'app/page-client.tsx',
  'app/[property]/order/page.tsx',
  'app/[property]/profile/page.tsx',
  'app/[property]/[slug]/cart/page.tsx',
  'app/[property]/[slug]/confirmation/page.tsx',
  'app/[property]/[slug]/[unitId]/page.tsx',
  'app/[property]/cancellation/page.tsx',
  // === Layout/branding (hospitality is primary vertical) ===
  'components/layout/Header.tsx',
  // === Module-specific components ===
  'components/modules/BookingService.tsx',
  // === Resort-specific ===
  'components/InteractiveResortMap.tsx',
  'app/[property]/admin/analytics/page.tsx',
  'app/[property]/admin/settings/navbar/page.tsx',
  'app/[property]/admin/[slug]/page.tsx',
]);

/**
 * Legacy status vocabulary that should not be used as transport values
 * in generic Engine A components (outside the canonical mapper).
 */
const LEGACY_STATUSES = ['preparing', 'served', 'delivered'];

/**
 * The canonical mapper in staff/types.ts is the ONLY place legacy
 * status composites are allowed.
 */
const STATUS_ALLOWLIST = new Set([
  'components/staff/types.ts',
  'lib/engine-a/types.ts', // canonicalFulfillmentState() maps them
  // Nexus simulation is a demo/playground, not production code
  'app/nexus/simulationStore.ts',
  // Messaging 'delivered' is email/message delivery, not fulfillment
  'app/[property]/admin/messaging/page.tsx',
  // Orders pages reference 'delivered' as a digital fulfillment state
  'app/[property]/admin/orders/page.tsx',
  'app/[property]/admin/[slug]/orders/page.tsx',
  // POS templates handle legacy status for backward-compat display
  'components/pos-templates/CustomerPOSTemplate.tsx',
  'components/pos-templates/StaffPOSTemplate.tsx',
  // Dispatch/KDS handle legacy 'served' for backward-compat display
  'components/staff/DispatchBoard.tsx',
  'components/staff/KitchenView.tsx',
]);

// ============================================
// Scanner
// ============================================

function findFiles(dir, exts) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'archive') continue;
      results.push(...findFiles(fullPath, exts));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function relativePath(fullPath) {
  return path.relative(ROOT, fullPath).replace(/\\/g, '/');
}

function checkLegacyTemplateTypes(files) {
  const violations = [];

  for (const file of files) {
    const rel = relativePath(file);
    const frontendRel = rel.replace('frontend/src/', '');

    // Skip allowlisted files
    if (TEMPLATE_TYPE_ALLOWLIST.has(frontendRel)) continue;

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments and type annotations in backend alias maps
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

      for (const legacy of LEGACY_TEMPLATE_TYPES) {
        // Check for string literals containing the legacy type
        const regex = new RegExp(`['"\`]${legacy}['"\`]`, 'g');
        if (regex.test(line)) {
          violations.push({
            file: rel,
            line: i + 1,
            pattern: legacy,
            content: line.trim().substring(0, 100),
          });
        }
      }
    }
  }

  return violations;
}

function checkHospitalityIcons(files) {
  const violations = [];

  for (const file of files) {
    const rel = relativePath(file);
    const frontendRel = rel.replace('frontend/src/', '');

    // Skip allowlisted files
    if (ICON_ALLOWLIST.has(frontendRel)) continue;

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const icon of HOSPITALITY_ICONS) {
        if (line.includes(icon) && !line.trim().startsWith('//')) {
          violations.push({
            file: rel,
            line: i + 1,
            pattern: icon,
            content: line.trim().substring(0, 100),
          });
        }
      }
    }
  }

  return violations;
}

function checkLegacyStatuses(files) {
  const violations = [];

  for (const file of files) {
    const rel = relativePath(file);
    const frontendRel = rel.replace('frontend/src/', '');

    // Skip allowlisted files (canonical mapper)
    if (STATUS_ALLOWLIST.has(frontendRel)) continue;

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

      for (const status of LEGACY_STATUSES) {
        // Check for string comparisons using legacy status
        const regex = new RegExp(`['"\`]${status}['"\`]|===\\s*['"\`]${status}['"\`]|!==\\s*['"\`]${status}['"\`]`, 'g');
        if (regex.test(line)) {
          violations.push({
            file: rel,
            line: i + 1,
            pattern: status,
            content: line.trim().substring(0, 100),
          });
        }
      }
    }
  }

  return violations;
}

// ============================================
// Main
// ============================================

function main() {
  const isCI = process.argv.includes('--ci');
  const files = findFiles(FRONTEND_SRC, ['.ts', '.tsx']);

  console.log(`Engine A Architectural Source Guard`);
  console.log(`Scanning ${files.length} files in frontend/src/\n`);

  let totalViolations = 0;

  // Check 1: Legacy template types
  const templateViolations = checkLegacyTemplateTypes(files);
  if (templateViolations.length > 0) {
    console.log(`❌ LEGACY TEMPLATE TYPE VIOLATIONS (${templateViolations.length}):`);
    for (const v of templateViolations) {
      console.log(`   ${v.file}:${v.line} — "${v.pattern}"`);
      console.log(`     ${v.content}`);
    }
    console.log();
    totalViolations += templateViolations.length;
  } else {
    console.log('✅ No legacy template type violations\n');
  }

  // Check 2: Hospitality icons in generic surfaces
  const iconViolations = checkHospitalityIcons(files);
  if (iconViolations.length > 0) {
    console.log(`❌ HOSPITALITY ICON VIOLATIONS (${iconViolations.length}):`);
    for (const v of iconViolations) {
      console.log(`   ${v.file}:${v.line} — ${v.pattern}`);
      console.log(`     ${v.content}`);
    }
    console.log();
    totalViolations += iconViolations.length;
  } else {
    console.log('✅ No hospitality icon violations in generic surfaces\n');
  }

  // Check 3: Legacy status vocabulary
  const statusViolations = checkLegacyStatuses(files);
  if (statusViolations.length > 0) {
    console.log(`❌ LEGACY STATUS VOCABULARY VIOLATIONS (${statusViolations.length}):`);
    for (const v of statusViolations) {
      console.log(`   ${v.file}:${v.line} — "${v.pattern}"`);
      console.log(`     ${v.content}`);
    }
    console.log();
    totalViolations += statusViolations.length;
  } else {
    console.log('✅ No legacy status vocabulary violations\n');
  }

  console.log('='.repeat(50));

  if (totalViolations > 0) {
    console.log(`\n❌ ${totalViolations} ARCHITECTURAL VIOLATION(S) DETECTED`);
    console.log('   Fix the violations or add explicit allow-list entries.\n');
    process.exit(1);
  } else {
    console.log('\n✅ ALL CHECKS PASSED\n');
    process.exit(0);
  }
}

main();
