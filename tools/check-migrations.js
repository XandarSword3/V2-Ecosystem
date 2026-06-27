// check-migrations.js
// Run from v2-resort root: node check-migrations.js
// Reports every migration file that references a forbidden legacy table.
// Forbidden list is derived strictly from ARCHITECTURE_LAW.md.

const fs   = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'supabase', 'migrations');

// Tables that must not exist per ARCHITECTURE_LAW.md.
// These are the four dead module tables and three generic aliases.
// Support tables (restaurant_tables, kitchen_orders, pool_memberships, etc.)
// are NOT forbidden — they don't replace the transactions engine.
//
// Matching rules:
//   - Bare table names: flag any reference that is NOT a DROP statement
//     (DROP is acceptable — it means we are cleaning up the regression)
//   - Generic aliases (tickets/bookings/orders): only flag CREATE TABLE,
//     INSERT INTO, SELECT FROM — not DROP TABLE which is the cleanup action

const FORBIDDEN_TABLES = [
  'restaurant_orders',
  'pool_tickets',
  'chalet_bookings',
  'snack_orders',
  'restaurant',
  'chalet',
  'pool',
  'snack',
  'bar',
];

// These generic names are only forbidden when being created/queried,
// not when being dropped.
const FORBIDDEN_GENERIC_PATTERNS = [
  /\bfrom\s+tickets\b/i,
  /\bfrom\s+bookings\b/i,
  /\bfrom\s+orders\b/i,
  /\bcreate\s+table\s+(if\s+not\s+exists\s+)?tickets\b/i,
  /\bcreate\s+table\s+(if\s+not\s+exists\s+)?bookings\b/i,
  /\bcreate\s+table\s+(if\s+not\s+exists\s+)?orders\b/i,
  /\binsert\s+into\s+tickets\b/i,
  /\binsert\s+into\s+bookings\b/i,
  /\binsert\s+into\s+orders\b/i,
];

// Strip SQL comments before violation checking.
// Block comments /* ... */ and single-line comments -- ... are purely
// documentary and must not trigger false positives.
function stripSQLComments(content) {
  // Remove block comments /* ... */ (replace with spaces to preserve line count)
  const noBlock = content.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  // Remove single-line comments -- ...
  return noBlock.replace(/--[^\n]*/g, '');
}

// For the four main forbidden tables, flag any mention EXCEPT DROP statements.
// A line is a DROP line if it matches /^\s*drop\s+(table|view)/i
function isDropLine(line) {
  return /^\s*drop\s+(table|view)/i.test(line);
}

const files = fs.readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

const violations = {};
const clean = [];

for (const file of files) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const raw      = fs.readFileSync(filePath, 'utf8');
  // Use comment-stripped content for violation detection
  const content  = stripSQLComments(raw);
  const lines    = content.split('\n');
  const lower    = content.toLowerCase();

  const hits = new Set();

  // Check forbidden tables — flag unless the mention is on a DROP line
  for (const table of FORBIDDEN_TABLES) {
    if (lower.includes(table)) {
      // Check if every occurrence is on a DROP line
      const hasNonDropMention = lines.some(line => {
        return line.toLowerCase().includes(table) && !isDropLine(line);
      });
      if (hasNonDropMention) {
        hits.add(table);
      }
    }
  }

  // Check generic forbidden patterns
  for (const pattern of FORBIDDEN_GENERIC_PATTERNS) {
    if (pattern.test(content)) {
      hits.add(pattern.toString());
    }
  }

  if (hits.size > 0) {
    violations[file] = [...hits];
  } else {
    clean.push(file);
  }
}

const violationFiles = Object.keys(violations);

console.log('');
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║         MIGRATION LEGACY VIOLATION REPORT            ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log('');
console.log(`  Total migrations : ${files.length}`);
console.log(`  With violations  : ${violationFiles.length}`);
console.log(`  Clean            : ${clean.length}`);
console.log('');
console.log('─────────────────────────────────────────────────────────');
console.log('  VIOLATIONS');
console.log('─────────────────────────────────────────────────────────');

for (const [file, hits] of Object.entries(violations)) {
  console.log('');
  console.log(`  ❌  ${file}`);
  for (const t of hits) {
    console.log(`       └─ ${t}`);
  }
}

console.log('');
console.log('─────────────────────────────────────────────────────────');
console.log('  CLEAN FILES');
console.log('─────────────────────────────────────────────────────────');
console.log('');
for (const f of clean) {
  console.log(`  ✓  ${f}`);
}
console.log('');
