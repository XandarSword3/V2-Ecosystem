// legacy-audit.js — Full-codebase legacy module terminology audit
// Complements check-migrations.js (which only covers supabase/migrations/*.sql)
// This script covers the entire codebase: TS, JS, SQL, JSON, MD files
//
// Run:
//   node legacy-audit.js                     — summary only
//   node legacy-audit.js --detail            — full line-by-line output
//   node legacy-audit.js --module=restaurant — filter to one module
//   node legacy-audit.js --module=chalet     — filter to one module
//   node legacy-audit.js --module=pool       — filter to one module
//   node legacy-audit.js --module=snack_bar  — filter to one module
//   node legacy-audit.js --dir=routes        — filter to one directory path
//   node legacy-audit.js --detail --module=chalet --dir=backend  — combine filters

'use strict';

const fs   = require('fs');
const path = require('path');

// ── CONFIGURATION ─────────────────────────────────────────────────────────────

const ROOT = __dirname;

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.sql', '.json']);

// Directory/file segments that should never be scanned
const SKIP_SEGMENTS = [
  'node_modules',
  '.git',
  'archive',            // intentionally preserved legacy code
  'legacy-audit.js',    // this script — skip self
  'check-migrations.js', // tooling that lists forbidden terms as string literals — not a violation
  'find-imports.js',     // tooling — not runtime code
  'legacy-routes.middleware.ts', // intentionally contains legacy path strings for redirect detection — not a violation
  'search_results.txt', // too large and already processed externally
  '.next',              // Next.js build output — fix source, this regenerates
  'dist',              // TypeScript compiled output — fix source, this regenerates
  '_archive',          // archived documentation — intentionally references legacy terms
  'docs',              // documentation — not runtime code; fix separately
  'messages',          // i18n translation files — legitimate use of food/venue words; reinvestigate later
  'tools',             // stress-test tooling — not runtime; fix after backend source is clean
  'scripts',           // e2e/admin scripts — not runtime; fix after backend source is clean
  'mobile',            // mobile app — runtime but separate platform; fix after tests are clean
  'test-results',      // backend test output JSON — not source code
  'coverage',          // frontend test coverage output — not source code
  'coverage-critical', // frontend critical test coverage output — not source code
  'eslint-backend.json',  // generated ESLint output dump — not source code
  'eslint-frontend.json', // generated ESLint output dump — not source code
  'tailwind.config.js',   // tailwind build configuration — contains theme color brand name mapping
];

// ── LEGACY TERM DEFINITIONS ───────────────────────────────────────────────────
//
// Structure:
//   terms[]     — exact substrings to match (case-insensitive)
//   bareWords[] — whole-word regex matches; more likely to produce false
//                 positives so flagged separately in output
//
// IMPORTANT: 'pool' as a bare word is intentionally absent from bareWords.
// pg's connection pool (new Pool, pool.query, etc.) would flood the results.
// All real business-module 'pool' violations are caught by compound terms.

const LEGACY_MODULES = {

  restaurant: {
    terms: [
      'restaurant_orders',
      'restaurant_tables',
      'restaurant_settings',
      'restaurant_admin',
      'restaurant_staff',
      'RestaurantController',
      'restaurantController',
      'restaurantRoutes',
      'restaurantService',
      'restaurant.admin@',
      'restaurant.staff@',
      "service_type = 'restaurant'",
      "service_type='restaurant'",
      "service_type: 'restaurant'",
      '"restaurant"',           // enum string value
      "'restaurant'",           // enum string value
      'menu_items',
      'catalog_item_id',
      'menu_categories',
    ],
    bareWords: ['restaurant'],  // safe — no infrastructure uses this word
  },

  pool: {
    terms: [
      'pool_sessions',
      'pool_tickets',
      'pool_settings',
      'pool_admin',
      'pool_staff',
      'PoolController',
      'poolController',
      'poolRoutes',
      'poolService',
      'pool.admin@',
      'pool.staff@',
      "service_type = 'pool'",
      "service_type='pool'",
      "service_type: 'pool'",
    ],
    bareWords: [],  // intentionally empty — pg Pool false positives are too common
  },

  chalet: {
    terms: [
      'chalet_bookings',
      'chalet_add_ons',
      'chalet_settings',
      'chalet_admin',
      'chalet_staff',
      'ChaletController',
      'chaletController',
      'chaletRoutes',
      'chaletService',
      'chalet.admin@',
      "service_type = 'chalets'",
      "service_type='chalets'",
      "service_type: 'chalets'",
      "'chalets'",              // legacy slug as string
      '"chalets"',
      "Uses chalet backend as 'rooms'",
    ],
    bareWords: ['chalet', 'chalets'],  // safe — no infrastructure uses this word
  },

  snack_bar: {
    terms: [
      'snack-bar',
      'snack_bar',
      'snackBar',
      'SnackBar',
      'SNACK_BAR',
      'snack_items',
      'snack_bar_settings',
      'snack_bar_admin',
      'snack_bar_staff',
      'SnackBarController',
      'snackBarRoutes',
      'snackBarService',
      'snack.staff@',
      "service_type = 'snack_bar'",
      "service_type='snack_bar'",
      "service_type: 'snack_bar'",
    ],
    bareWords: ['snack'],  // safe — not used in any infrastructure context
  },

  // ── WHITE-LABEL VIOLATIONS ────────────────────────────────────────────────
  // The platform must be fully white-label. No hardcoded business names,
  // venue types, or branding should exist in runtime code.

  resort_branding: {
    terms: [
      'resortName',
      'resort_name',
      'ResortController',
      'resortRoutes',
      'resortService',
      'ResortTheme',          // legacy theme type name
      'resortThemes',
      'resortTheme',
      'setResortTheme',
      'Your Resort',
      'Azure Bay',
      'AzureBay',
      'azure_bay',
      'Val Thorens',
      'ValThorens',
      'val_thorens',
      'Resort Admin',
      'Resort Guest',
      'Resort Theme',
      'resort-cover.jpg',
      "'resort'",
      '"resort"',
    ],
    bareWords: ['resort'],    // catches "resort" as standalone word
  },

  gym_branding: {
    terms: [
      'Iron Paradise',
      'iron_paradise',
      'IronParadise',
      'ironParadise',
      'IRON_PARADISE',
      'Iron Paradise Gym',
      'ironparadisegym',
      "'gym'",
      '"gym"',
    ],
    bareWords: ['gym'],       // catches "gym" as standalone word
  },

  hardcoded_business: {
    terms: [
      "businessUnit: 'hotel'",
      "businessUnit: 'villa'",
      "businessUnit: 'spa'",
      "businessUnit='hotel'",
      "businessUnit='villa'",
      "businessUnit='spa'",
      "'hotel'",
      "'villa'",
      'hotelName',
      'hotel_name',
      'villaName',
      'villa_name',
      'spaName',
      'spa_name',
      "'spa'",
      '"spa"',
      'hotel_bookings',
      'villa_bookings',
      'spa_bookings',
    ],
    bareWords: [],            // too many false positives for bare "hotel", "villa", "spa"
  },

};

// ── FALSE POSITIVE FILTERS ────────────────────────────────────────────────────
//
// Lines matching any of these patterns are skipped for ALL pool-related checks.
// Also used to sanity-check bare-word 'pool' matches if we ever re-enable them.

const PG_POOL_LINE_PATTERNS = [
  /from\s+['"]pg['"]/,
  /require\s*\(\s*['"]pg['"]\s*\)/,
  /new\s+Pool\s*\(/i,
  /const\s+\w*[Pp]ool\w*\s*=\s*new/,
  /\bpool\.query\s*\(/i,
  /\bpool\.connect\s*\(/i,
  /\bpool\.end\s*\(/i,
  /\bpool\.release\s*\(/i,
  /\bPool\s*\{/,
  /\bPoolConfig\b/,
  /\bPoolClient\b/,
  /sharedInventoryPool/i,
  /connectionPool/i,
  /pgPool/i,
  /import.*Pool.*from/,
];

const LINE_EXCLUSIONS = [
  // DB field/column reads or JSON field references
  /\b(settings|formSettings|s\.value|result|general)\.resortName\b|\bresortName\s*:/,
  // TypeScript types / schemas / constant enums (type LocationType = 'gym' etc)
  /export\s+type\s+\w+\s*=\s*[^;]*\b(gym|spa|hotel|resort|villa)\b/,
  // Switch case statements matching enums (case 'resort':, case 'hotel':, case 'gym':, case 'spa':)
  /case\s+['"](resort|hotel|gym|spa|villa)['"]\s*:/,
  // Select options or HTML dropdown markup (<option value="resort">, etc)
  /<option\s+[^>]*value=['"](resort|hotel|gym|spa|villa)['"]/,
  // Select labels/options containing Gym/Spa/Resort/Hotel inside markup
  />(Resort|Hotel|Gym|Spa|Dumbbell \(Gym\))<\/option>/,
  // Shared Capacity Access options text
  /Shared Capacity Access — Pool \/ Gym \/ Spa/,
  // Icon key/value mappings or config maps ('gym': Dumbbell, 'spa': Sparkles, 'hotel': Building2, etc)
  /['"](gym|spa|hotel|resort)['"]\s*:\s*(['"]?\w+['"]?|\[[^\]]*\])/,
  // Zod enum validation lists
  /z\.enum\(\[[^\]]*\b(spa|hotel|resort)\b[^\]]*\]\)/,
  // Schema enum arrays: ['resort', 'hotel', ...]
  /['"]resort['"]\s*,\s*['"]hotel['"]\s*,\s*['"]boutique['"]/,
  // Drizzle column default values (.default('resort'), etc)
  /\.default\(['"](resort|hotel|gym|spa|villa)['"]\)/,
  // Variable / key initialization to valid default string literal ('hotel', etc)
  /\bproperty_type\s*:\s*.*?['"]hotel['"]|property_type\s*\?\?\s*['"]hotel['"]/,
  /business_type\s*as\s*string\)\s*\|\|\s*['"]hotel['"]/,
  /businessType\s*=\s*(storedType\s*\|\|\s*['"]hotel['"]|useState\(['"]hotel['"]\))/,
  /useState\(['"]hotel['"]\)/,
  // External API integration fields (hotel_name)
  /\bhotel_name\b/,
  // Module configuration items / templates
  /id:\s*['"](gym|hotel|spa)['"]/,
  /\{[^}]*\b(value|label):\s*['"](spa|hotel|gym|resort)['"][^}]*\}/,
  // Legitimate comment explaining business-types warning
  /\/\/\s*No\s+hardcoded\s+business-type\s+names/,
  // Legend example descriptions (e.g. Pool, Gym, Spa)
  /description:\s*['"]e\.g\.\s+Pool,\s+Gym,\s+Spa['"]/,
  // Location/Package lists
  /\bVALID_LOCATION_TYPES\b/,
  /\bPACKAGE_TYPES\b/,
  /\bLocationType\b.*=.*'gym'/,
  // Get business type comments
  /\/\/\s*Get\s+business\s+type\s+from\s+storage/,
  // Middleware/comments examples
  /e\.g\.,\s*['"]bar['"]\s*,\s*['"]spa['"]/,
];

// ── FILE WALKER ───────────────────────────────────────────────────────────────

function shouldSkipPath(relPath) {
  const normalised = relPath.replace(/\\/g, '/');
  return SKIP_SEGMENTS.some(seg => {
    // Match as a path segment (not a substring of a longer word)
    return normalised.split('/').includes(seg) || normalised.includes('/' + seg + '/');
  });
}

function walkDir(dir, collected = []) {
  let entries;
  try { entries = fs.readdirSync(dir); } catch { return collected; }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const relPath  = path.relative(ROOT, fullPath).replace(/\\/g, '/');

    if (shouldSkipPath(relPath)) continue;

    let stat;
    try { stat = fs.statSync(fullPath); } catch { continue; }

    if (stat.isDirectory()) {
      walkDir(fullPath, collected);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry).toLowerCase())) {
      collected.push({ full: fullPath, rel: relPath });
    }
  }
  return collected;
}

// ── SCANNER ───────────────────────────────────────────────────────────────────

// Strip SQL single-line (--) and block (/* */) comments before scanning.
// Block comments: non-newline chars replaced with spaces — preserves line count.
// Single-line comments: comment content replaced with empty string — line preserved.
// Mirrors the logic in check-migrations.js so .sql file results are consistent.
function stripSQLComments(content) {
  const noBlock = content.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  return noBlock.replace(/--[^\n]*/g, '');
}

function scanFile(fullPath, relPath) {
  let content;
  try { content = fs.readFileSync(fullPath, 'utf8'); } catch { return []; }

  // For .sql files, strip comments before scanning so that legacy terms inside
  // -- single-line or /* block */ comments don't generate false positives.
  // Line numbers in output still correspond to the original file because the
  // stripping preserves newlines (block comment chars → spaces; -- lines → empty).
  const isSql = path.extname(fullPath).toLowerCase() === '.sql';
  const scanContent = isSql ? stripSQLComments(content) : content;

  const lines = scanContent.split('\n');
  const hits  = [];

  // Mark migration files — fixable per Alex's directive (DB has no live data, can be reset).
  // Caller uses this to separate counts.
  const isMigrationFile = relPath.startsWith('supabase/migrations/') || relPath.startsWith('backend/supabase/migrations/');

  // Mark test files — violations are fixable; tracked as sub-count of active violations.
  const isTestFile = relPath.split('/').includes('tests');

  for (const [moduleName, config] of Object.entries(LEGACY_MODULES)) {

    // ── Exact-term matching ────────────────────────────────────────────────
    for (const term of config.terms) {
      const termLower = term.toLowerCase();
      lines.forEach((line, idx) => {
        if (!line.toLowerCase().includes(termLower)) return;

        // Skip known false positive patterns
        if (LINE_EXCLUSIONS.some(p => p.test(line))) return;

        // Apply pg Pool filter for all pool-module checks
        if (moduleName === 'pool') {
          if (PG_POOL_LINE_PATTERNS.some(p => p.test(line))) return;
        }

        // Avoid duplicate hits on the same line for the same module
        const alreadyHit = hits.some(h => h.lineNum === idx + 1 && h.module === moduleName);
        if (alreadyHit) return;

        hits.push({
          module:       moduleName,
          term,
          lineNum:      idx + 1,
          lineText:     line.trim(),
          isBareWord:   false,
          isMigration:  isMigrationFile,
          isTestFile:   isTestFile,
        });
      });
    }

    // ── Bare-word matching ─────────────────────────────────────────────────
    for (const word of (config.bareWords || [])) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      lines.forEach((line, idx) => {
        if (!regex.test(line)) return;

        // Skip known false positive patterns
        if (LINE_EXCLUSIONS.some(p => p.test(line))) return;

        // Skip if this line already has a more specific hit for this module
        const alreadyHit = hits.some(h => h.lineNum === idx + 1 && h.module === moduleName && !h.isBareWord);
        if (alreadyHit) return;

        hits.push({
          module:      moduleName,
          term:        word,
          lineNum:     idx + 1,
          lineText:    line.trim(),
          isBareWord:  true,
          isMigration: isMigrationFile,
          isTestFile:  isTestFile,
        });
      });
    }
  }

  return hits;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

const args          = process.argv.slice(2);
const showDetail    = args.includes('--detail');
const moduleFilter  = (args.find(a => a.startsWith('--module=')) || '').replace('--module=', '') || null;
const dirFilter     = (args.find(a => a.startsWith('--dir='))    || '').replace('--dir=', '')    || null;

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║           LEGACY MODULE TERMINOLOGY AUDIT                        ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');

const allFiles      = walkDir(ROOT);
const filteredFiles = allFiles.filter(f => {
  if (dirFilter && !f.rel.includes(dirFilter)) return false;
  return true;
});

if (moduleFilter && !Object.keys(LEGACY_MODULES).includes(moduleFilter)) {
  console.error(`  ERROR: Unknown module "${moduleFilter}". Valid: ${Object.keys(LEGACY_MODULES).join(', ')}`);
  process.exit(1);
}

console.log(`  Scanning ${filteredFiles.length} files${dirFilter ? ` in paths matching "${dirFilter}"` : ''}...`);
console.log('');

// Collect all results
const fileResults = {};
let totalActive     = 0;   // fixable violations (non-migration)
let totalMigration  = 0;   // migration-file hits (fixable — DB has no live data, can reset)
let totalTest       = 0;   // test-file violations (sub-count of active)
let totalBareWord   = 0;   // bare-word hits (lower confidence)

for (const { full, rel } of filteredFiles) {
  let hits = scanFile(full, rel);
  if (moduleFilter) hits = hits.filter(h => h.module === moduleFilter);
  if (hits.length === 0) continue;

  fileResults[rel] = hits;
  hits.forEach(h => {
    if (h.isMigration)    totalMigration++;
    else {
      totalActive++;
      if (h.isTestFile)   totalTest++;
      if (h.isBareWord)   totalBareWord++;
    }
  });
}

// Violations by module (active only)
const byModule = {};
for (const hits of Object.values(fileResults)) {
  for (const h of hits) {
    if (h.isMigration) continue;
    byModule[h.module] = (byModule[h.module] || 0) + 1;
  }
}

// Top files by active violation count
const topFiles = Object.entries(fileResults)
  .map(([f, hits]) => ({ file: f, count: hits.filter(h => !h.isMigration).length }))
  .filter(f => f.count > 0)
  .sort((a, b) => b.count - a.count)
  .slice(0, 25);

// ── OUTPUT ────────────────────────────────────────────────────────────────────

console.log('─────────────────────────────────────────────────────────────────────');
console.log('  SUMMARY');
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
console.log(`  Active violations (fixable)       : ${totalActive}`);
console.log(`    of which in test files           : ${totalTest}  (Step 11 — fix in tests/)`);
console.log(`    of which bare-word matches       : ${totalBareWord}  (lower confidence — review manually)`);
console.log(`  Migration-file hits               : ${totalMigration}  (fixable — DB has no live data, can reset)`);
console.log('');

if (Object.keys(byModule).length > 0) {
  console.log('  By module:');
  for (const [mod, count] of Object.entries(byModule).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.round(count / Math.max(...Object.values(byModule)) * 20));
    console.log(`    ${mod.padEnd(15)} ${String(count).padStart(5)}  ${bar}`);
  }
  console.log('');
}

console.log('─────────────────────────────────────────────────────────────────────');
console.log('  TOP FILES  (worst first, migration files excluded)');
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
for (const { file, count } of topFiles) {
  console.log(`  ${String(count).padStart(5)}  ${file}`);
}

if (showDetail) {
  console.log('');
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('  DETAIL  (migration-file hits shown separately at bottom)');
  console.log('─────────────────────────────────────────────────────────────────────');

  // Active violations first
  const activeEntries = Object.entries(fileResults)
    .filter(([, hits]) => hits.some(h => !h.isMigration))
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [file, hits] of activeEntries) {
    const active = hits.filter(h => !h.isMigration);
    console.log('');
    console.log(`  📄  ${file}  (${active.length})`);
    for (const h of active) {
      const tag  = h.isBareWord ? ' [bare-word]' : '';
      const text = h.lineText.length > 130 ? h.lineText.substring(0, 127) + '...' : h.lineText;
      console.log(`       L${String(h.lineNum).padStart(5)}  [${h.module}]${tag}`);
      console.log(`              ${text}`);
    }
  }

  // Migration hits at the bottom, clearly separated
  const migrationEntries = Object.entries(fileResults)
    .filter(([, hits]) => hits.some(h => h.isMigration))
    .sort(([a], [b]) => a.localeCompare(b));

  if (migrationEntries.length > 0) {
    console.log('');
    console.log('─────────────────────────────────────────────────────────────────────');
    console.log('  MIGRATION FILES  (historical record — do NOT edit applied migrations)');
    console.log('─────────────────────────────────────────────────────────────────────');
    for (const [file, hits] of migrationEntries) {
      const mHits = hits.filter(h => h.isMigration);
      console.log('');
      console.log(`  📋  ${file}  (${mHits.length})`);
      for (const h of mHits) {
        console.log(`       L${String(h.lineNum).padStart(5)}  [${h.module}]  ${h.lineText.substring(0, 120)}`);
      }
    }
  }
}

console.log('');
console.log('─────────────────────────────────────────────────────────────────────');
console.log('  Usage:');
console.log('    node legacy-audit.js                        summary only');
console.log('    node legacy-audit.js --detail               full line-by-line');
console.log('    node legacy-audit.js --module=restaurant    one module only');
console.log('    node legacy-audit.js --module=pool          one module only');
console.log('    node legacy-audit.js --module=chalet        one module only');
console.log('    node legacy-audit.js --module=snack_bar     one module only');
console.log('    node legacy-audit.js --dir=routes           one directory');
console.log('    node legacy-audit.js --detail --module=chalet --dir=backend');
console.log('─────────────────────────────────────────────────────────────────────');
console.log('');
