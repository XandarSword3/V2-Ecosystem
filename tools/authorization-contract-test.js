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

// ============================================
// Parse backend scopeToRoles
// ============================================

function parseBackendScopeToRoles() {
  const content = fs.readFileSync(BACKEND_PERMS, 'utf-8');
  const scopeMap = {};

  // Find the scopeToRoles function
  const fnStart = content.indexOf('export function scopeToRoles');
  if (fnStart === -1) return scopeMap;

  const fnBody = content.substring(fnStart, content.indexOf('}', fnStart + 200) + 100);

  // Parse each case
  const caseRegex = /case\s+'(\w+)':\s*\n\s*return\s*\[([^\]]+)\]/g;
  let match;
  while ((match = caseRegex.exec(fnBody)) !== null) {
    const scope = match[1];
    const roles = match[2].split(',').map(r => r.trim().replace(/'/g, ''));
    scopeMap[scope] = roles;
  }

  return scopeMap;
}

// ============================================
// Parse frontend SCOPE_TO_ROLES
// ============================================

function parseFrontendScopeToRoles() {
  const content = fs.readFileSync(FRONTEND_PERMS, 'utf-8');
  const scopeMap = {};

  const fnStart = content.indexOf('const SCOPE_TO_ROLES');
  if (fnStart === -1) return scopeMap;

  const fnBody = content.substring(fnStart, content.indexOf('};', fnStart) + 2);

  const entryRegex = /(\w+):\s*\[([^\]]+)\]/g;
  let match;
  while ((match = entryRegex.exec(fnBody)) !== null) {
    const scope = match[1];
    const roles = match[2].split(',').map(r => r.trim().replace(/'/g, ''));
    scopeMap[scope] = roles;
  }

  return scopeMap;
}

// ============================================
// Scope projection validation
// ============================================

function validateScopeProjection(frontendScopeRoles, frontendRolePerms) {
  console.log('\n=== Scope Projection Validation ===\n');

  let issues = 0;

  for (const [scope, roles] of Object.entries(frontendScopeRoles)) {
    // Check 1: every scope resolves to at least one role
    if (!roles || roles.length === 0) {
      console.log(`❌ [${scope}] resolves to EMPTY role list`);
      issues++;
      continue;
    }

    // Check 2: every derived role exists in ROLE_PERMISSIONS
    let hasPermissions = false;
    for (const role of roles) {
      const rolePerms = frontendRolePerms[role];
      if (!rolePerms) {
        console.log(`❌ [${scope}] → role '${role}' has no ROLE_PERMISSIONS entry`);
        issues++;
        continue;
      }
      if (rolePerms.length > 0 || role === 'admin' || role === 'super_admin') {
        hasPermissions = true;
      }
    }

    // Check 3: the scope resolves to a non-empty permission set
    if (!hasPermissions) {
      const permCount = roles.reduce((sum, r) => sum + (frontendRolePerms[r]?.length || 0), 0);
      console.log(`❌ [${scope}] → roles [${roles.join(', ')}] resolve to EMPTY permission set`);
      issues++;
    } else {
      console.log(`✅ [${scope}] → [${roles.join(', ')}] → has permissions`);
    }
  }

  return issues;
}

// ============================================
// Invalid/unknown scope behavior
// ============================================

function validateInvalidScopes(frontendScopeRoles) {
  console.log('\n=== Invalid/Unknown Scope Behavior ===\n');
  let issues = 0;

  const knownScopes = Object.keys(frontendScopeRoles);
  const testScopes = ['', 'unknown_scope', 'hacker', 'null', 'undefined'];

  for (const scope of testScopes) {
    if (frontendScopeRoles[scope] !== undefined) {
      console.log(`⚠️  Unknown scope '${scope}' has an explicit mapping (unexpected)`);
      issues++;
    } else {
      console.log(`✅ Unknown scope '${scope || '(empty)'}' → no mapping (will fall through to default)`);
    }
  }

  return issues;
}

// ============================================
// Module-scoped permission representation
// ============================================

function validateModulePermissions(frontendPermConsts) {
  console.log('\n=== Module-Scoped Permission Representation ===\n');
  let issues = 0;

  // Module-scoped permissions are DYNAMIC (generated per-module by the backend)
  // and should NOT be in the static Perm constants. They come from the
  // backend's /auth/me/permissions endpoint.
  const modulePermPattern = /^module:[^:]+:(view|order|manage|admin)$/;
  const staticModulePerms = Object.values(frontendPermConsts).filter(
    p => modulePermPattern.test(p)
  );

  if (staticModulePerms.length > 0) {
    console.log(`❌ Static Perm constants contain module-scoped permissions:`);
    staticModulePerms.forEach(p => console.log(`   ${p}`));
    console.log('   Module permissions are DYNAMIC — they come from the backend.');
    console.log('   Remove them from Perm constants and use canViewModule() etc. instead.');
    issues++;
  } else {
    console.log('✅ No module-scoped permissions in static Perm constants (correct)');
  }

  // Verify canViewModule/Order/Manage/Admin helpers exist
  const content = fs.readFileSync(FRONTEND_PERMS, 'utf-8');
  const helpers = ['canViewModule', 'canOrderModule', 'canManageModule', 'canAdminModule'];
  for (const h of helpers) {
    if (!content.includes(h)) {
      console.log(`❌ Missing helper: ${h}`);
      issues++;
    } else {
      console.log(`✅ Helper present: ${h}`);
    }
  }

  // Verify helpers check for module:{slug}:* pattern
  const modulePermRegex = /module:\$\{slug\}:view|module:\$\{slug\}:order|module:\$\{slug\}:manage|module:\$\{slug\}:admin/;
  if (!modulePermRegex.test(content)) {
    console.log('⚠️  Module permission helpers may not check module:{slug}:* pattern');
    issues++;
  } else {
    console.log('✅ Module permission helpers check module:{slug}:* pattern');
  }

  return issues;
}

// ============================================
// Platform admin semantics
// ============================================

function validatePlatformAdminSemantics(frontendScopeRoles, frontendRolePerms) {
  console.log('\n=== Platform Admin Semantics ===\n');
  let issues = 0;

  const platformRoles = frontendScopeRoles['platform_admin'] || [];
  const superAdminRoles = frontendScopeRoles['super_admin'] || [];

  // platform_admin should resolve to super_admin (or have equivalent permissions)
  if (platformRoles.includes('super_admin')) {
    console.log('✅ platform_admin → super_admin (has wildcard permissions)');
  } else if (platformRoles.includes('admin')) {
    console.log('✅ platform_admin → admin (has wildcard permissions)');
  } else {
    console.log(`❌ platform_admin → [${platformRoles}] — may have insufficient permissions`);
    // Check if any of the resolved roles have wildcard
    const hasWildcard = platformRoles.some(r => {
      const perms = frontendRolePerms[r] || [];
      return perms.includes('*');
    });
    if (!hasWildcard) {
      console.log('   None of the resolved roles have wildcard permissions');
      issues++;
    }
  }

  // Verify the platform_admin scope flag exists in useAuthorization
  const content = fs.readFileSync(FRONTEND_PERMS, 'utf-8');
  if (!content.includes('isPlatformAdmin')) {
    console.log('❌ Missing isPlatformAdmin flag in authorization context');
    issues++;
  } else {
    console.log('✅ isPlatformAdmin flag present');
  }

  return issues;
}

// ============================================
// Presentation helpers are not security authorities
// ============================================

function validatePresentationNotSecurity(frontendFile) {
  console.log('\n=== Presentation Helpers ≠ Security Authorities ===\n');
  let issues = 0;

  const content = frontendFile;

  // Check that hasPermission comments mention presentation-only
  if (!content.includes('PRESENTATION') && !content.includes('presentation')) {
    console.log('⚠️  Authorization hook may not document presentation-only semantics');
    issues++;
  } else {
    console.log('✅ Authorization hook documents presentation-only semantics');
  }

  // Check that the hook does not export anything that looks like a middleware/guard
  const guardPatterns = ['middleware', 'guard', 'intercept', 'block', 'deny', 'reject'];
  for (const pattern of guardPatterns) {
    if (content.includes(`export function ${pattern}`) || content.includes(`export const ${pattern}`)) {
      console.log(`❌ Found exported function/const matching '${pattern}' — presentation layer should not gate`);
      issues++;
    }
  }
  if (issues === 0) {
    console.log('✅ No exported middleware/guard functions (correct for presentation layer)');
  }

  return issues;
}

// ============================================
// Main comparison
// ============================================

function compare() {
  const backend = parseBackendPermissions();
  const frontend = parseFrontendPermissions();
  const backendScopeRoles = parseBackendScopeToRoles();
  const frontendScopeRoles = parseFrontendScopeToRoles();

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

  // Scope projection validation
  const scopeIssues = validateScopeProjection(frontendScopeRoles, frontend.rolePerms);
  if (scopeIssues > 0) {
    drift = true;
  }

  // Backend/frontend scope-to-role comparison
  console.log('\n=== Backend/Frontend Scope-to-Role Comparison ===\n');
  const allScopes = new Set([...Object.keys(backendScopeRoles), ...Object.keys(frontendScopeRoles)]);
  for (const scope of allScopes) {
    const bRoles = backendScopeRoles[scope] || [];
    const fRoles = frontendScopeRoles[scope] || [];
    const bSorted = [...bRoles].sort().join(',');
    const fSorted = [...fRoles].sort().join(',');
    if (bSorted !== fSorted) {
      console.log(`⚠️  [${scope}] backend=[${bRoles}] frontend=[${fRoles}]`);
    } else {
      console.log(`✅ [${scope}] → [${fRoles}]`);
    }
  }

  // Invalid/unknown scope behavior
  const invalidIssues = validateInvalidScopes(frontendScopeRoles);
  if (invalidIssues > 0) {
    drift = true;
  }

  // Module-scoped permission representation
  const moduleIssues = validateModulePermissions(frontend.permConsts);
  if (moduleIssues > 0) {
    drift = true;
  }

  // Platform admin semantics
  const platformIssues = validatePlatformAdminSemantics(frontendScopeRoles, frontend.rolePerms);
  if (platformIssues > 0) {
    drift = true;
  }

  // Presentation helpers are not security authorities
  const frontendContent = fs.readFileSync(FRONTEND_PERMS, 'utf-8');
  const presentationIssues = validatePresentationNotSecurity(frontendContent);
  if (presentationIssues > 0) {
    drift = true;
  }

  console.log('\n' + '='.repeat(40));

  if (drift) {
    console.log('\n❌ CONTRACT DRIFT DETECTED');
    console.log('   Fix the drift or explicitly document the divergence.\n');
    process.exit(1);
  } else {
    console.log('\n✅ CONTRACT VALID — no drift detected\n');
    process.exit(0);
  }
}

compare();
