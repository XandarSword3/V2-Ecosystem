#!/usr/bin/env node
/**
 * F2.2: Authorization Contract Test
 *
 * Mechanically validates that the frontend's ROLE_PERMISSIONS matrix
 * matches the backend's RolePermissions exactly. Detects:
 *   - frontend-only permission (in frontend but not backend)
 *   - backend-only permission (in backend but not frontend)
 *   - frontend grants but backend denies (DRIFT — critical)
 *   - frontend denies but backend grants (DRIFT — critical)
 *
 * Usage: node tools/authorization-contract-test.js
 * Exit 0 = pass, Exit 1 = drift detected
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BACKEND_PERMS = path.join(ROOT, 'backend/src/security/permissions.ts');
const FRONTEND_PERMS = path.join(ROOT, 'frontend/src/lib/authorization.tsx');

// ============================================
// Parse backend RolePermissions
// ============================================

function parseBackendPermissions() {
  const content = fs.readFileSync(BACKEND_PERMS, 'utf-8');

  // Extract Permissions object values
  const permValues = {};
  const permRegex = /(\w+):\s*'([^']+)'/g;
  let match;
  const permsSection = content.substring(
    content.indexOf('export const Permissions = {'),
    content.indexOf('} as const;', content.indexOf('export const Permissions = {'))
  );
  while ((match = permRegex.exec(permsSection)) !== null) {
    permValues[match[1]] = match[2];
  }

  // Extract RolePermissions
  const rolePerms = {};
  const roleSection = content.substring(
    content.indexOf('export const RolePermissions'),
    content.indexOf('};', content.indexOf('export const RolePermissions'))
  );

  // Parse each role's permission array
  const roleRegex = /\[Roles\.(\w+)\]:\s*\[([\s\S]*?)\]/g;
  while ((match = roleRegex.exec(roleSection)) !== null) {
    const roleName = match[1].toLowerCase();
    const permsStr = match[2];
    const perms = [];

    // Extract permission references and string literals
    const permRefRegex = /Permissions\.(\w+)|'(\*|[^']+)'/g;
    let permMatch;
    while ((permMatch = permRefRegex.exec(permsStr)) !== null) {
      if (permMatch[1]) {
        // Permission.REFERENCE
        const ref = permMatch[1];
        if (permValues[ref]) {
          perms.push(permValues[ref]);
        }
      } else if (permMatch[2]) {
        // 'string literal'
        perms.push(permMatch[2]);
      }
    }

    rolePerms[roleName] = [...new Set(perms)];
  }

  return { rolePerms, permValues };
}

// ============================================
// Parse frontend ROLE_PERMISSIONS
// ============================================

function parseFrontendPermissions() {
  const content = fs.readFileSync(FRONTEND_PERMS, 'utf-8');

  // Extract Perm constants
  const permConsts = {};
  const permSection = content.substring(
    content.indexOf('export const Perm = {'),
    content.indexOf('} as const;', content.indexOf('export const Perm = {'))
  );
  const constRegex = /(\w+):\s*'([^']+)'/g;
  let match;
  while ((match = constRegex.exec(permSection)) !== null) {
    permConsts[match[1]] = match[2];
  }

  // Extract ROLE_PERMISSIONS
  const rolePerms = {};
  const roleSection = content.substring(
    content.indexOf('const ROLE_PERMISSIONS'),
    content.indexOf('};', content.indexOf('const ROLE_PERMISSIONS'))
  );

  const roleRegex = /(\w+):\s*\[([\s\S]*?)\]/g;
  while ((match = roleRegex.exec(roleSection)) !== null) {
    const roleName = match[1];
    const permsStr = match[2];
    const perms = [];

    const permRefRegex = /Perm\.(\w+)|'(\*|[^']+)'/g;
    let permMatch;
    while ((permMatch = permRefRegex.exec(permsStr)) !== null) {
      if (permMatch[1]) {
        const ref = permMatch[1];
        if (permConsts[ref]) {
          perms.push(permConsts[ref]);
        }
      } else if (permMatch[2]) {
        perms.push(permMatch[2]);
      }
    }

    rolePerms[roleName] = [...new Set(perms)];
  }

  return { rolePerms, permConsts };
}

// ============================================
// Compare
// ============================================

function compare() {
  const backend = parseBackendPermissions();
  const frontend = parseFrontendPermissions();

  let drift = false;
  const allRoles = new Set([
    ...Object.keys(backend.rolePerms),
    ...Object.keys(frontend.rolePerms),
  ]);

  console.log('=== Authorization Contract Test ===\n');

  // Check permission constant coverage
  const allBackendPerms = new Set(Object.values(backend.permValues));
  const allFrontendPerms = new Set(Object.values(frontend.permConsts));

  const frontendOnly = [...allFrontendPerms].filter(p => !allBackendPerms.has(p) && p !== '*');
  const backendOnly = [...allBackendPerms].filter(p => !allFrontendPerms.has(p));

  if (frontendOnly.length > 0) {
    console.log('⚠️  FRONTEND-ONLY PERMISSIONS (not in backend):');
    frontendOnly.forEach(p => console.log(`   ${p}`));
    console.log('   → These may be intentional frontend-only presentation capabilities.\n');
  }

  if (backendOnly.length > 0) {
    console.log('⚠️  BACKEND-ONLY PERMISSIONS (not in frontend):');
    backendOnly.forEach(p => console.log(`   ${p}`));
    console.log('   → Frontend will deny these; backend grants them.\n');
    drift = true;
  }

  // Check role-level drift
  for (const role of allRoles) {
    const bPerms = new Set(backend.rolePerms[role] || []);
    const fPerms = new Set(frontend.rolePerms[role] || []);

    const bHasWildcard = bPerms.has('*');
    const fHasWildcard = fPerms.has('*');

    // Skip wildcard comparison (admin/super_admin use wildcards)
    if (bHasWildcard && fHasWildcard) continue;

    if (bHasWildcard && !fHasWildcard) {
      console.log(`❌ DRIFT [${role}]: backend has wildcard '*' but frontend does not`);
      drift = true;
      continue;
    }
    if (!bHasWildcard && fHasWildcard) {
      console.log(`❌ DRIFT [${role}]: frontend has wildcard '*' but backend does not`);
      drift = true;
      continue;
    }

    // Compare non-wildcard permissions
    const grantsButBackendDenies = [...fPerms].filter(p => p !== '*' && !bPerms.has(p));
    const deniesButBackendGrants = [...bPerms].filter(p => p !== '*' && !fPerms.has(p));

    if (grantsButBackendDenies.length > 0) {
      console.log(`❌ DRIFT [${role}]: frontend grants but backend denies:`);
      grantsButBackendDenies.forEach(p => console.log(`   + ${p}`));
      drift = true;
    }

    if (deniesButBackendGrants.length > 0) {
      console.log(`❌ DRIFT [${role}]: frontend denies but backend grants:`);
      deniesButBackendGrants.forEach(p => console.log(`   - ${p}`));
      drift = true;
    }

    if (grantsButBackendDenies.length === 0 && deniesButBackendGrants.length === 0) {
      console.log(`✅ ${role}: OK (${bPerms.size} perms)`);
    }
  }

  console.log('\n' + '='.repeat(40));

  if (drift) {
    console.log('\n❌ CONTRACT DRIFT DETECTED');
    console.log('   Frontend ROLE_PERMISSIONS does not match backend RolePermissions.');
    console.log('   Fix the drift or explicitly document the divergence.\n');
    process.exit(1);
  } else {
    console.log('\n✅ CONTRACT VALID — no drift detected\n');
    process.exit(0);
  }
}

compare();
