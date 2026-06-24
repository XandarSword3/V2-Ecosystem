// fix-menu-terminology.js — Replace legacy menu_items / menu_categories in migration files
//
// Dry run (shows what would change, writes nothing):
//   node fix-menu-terminology.js
//
// Apply (writes changes):
//   node fix-menu-terminology.js --apply

'use strict';

const fs   = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'supabase', 'migrations');

// These files reference old names intentionally (rename guards) — do not touch them.
const SKIP_FILES = new Set([
  '20260606000001_rename_menu_categories_to_catalog_categories.sql',
]);

// Order matters: longer/more specific terms first so they don't get
// partially matched by a shorter term on the same pass.
const REPLACEMENTS = [
  { from: 'catalog_item_id',      to: 'catalog_item_id'      },
  { from: 'menu_items',        to: 'catalog_items'         },
  { from: 'menu_categories',   to: 'catalog_categories'    },
];

const apply = process.argv.includes('--apply');

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║         FIX MENU TERMINOLOGY IN MIGRATIONS                       ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log(apply ? '  MODE: APPLY — files will be written' : '  MODE: DRY RUN — no files written (pass --apply to write)');
console.log('');

// Collect .sql files directly in MIGRATIONS_DIR (not subdirectories like _archived)
const entries = fs.readdirSync(MIGRATIONS_DIR);
const files = entries.filter(f => {
  if (!f.endsWith('.sql')) return false;
  if (SKIP_FILES.has(f)) return false;
  const fullPath = path.join(MIGRATIONS_DIR, f);
  return fs.statSync(fullPath).isFile();
}).sort();

let totalFiles        = 0;
let totalReplacements = 0;

for (const file of files) {
  const fullPath = path.join(MIGRATIONS_DIR, file);
  const original = fs.readFileSync(fullPath, 'utf8');
  let   updated  = original;
  const changes  = [];

  for (const { from, to } of REPLACEMENTS) {
    const count = (updated.split(from).length - 1);
    if (count > 0) {
      updated = updated.split(from).join(to);
      changes.push({ from, to, count });
      totalReplacements += count;
    }
  }

  if (changes.length === 0) continue;

  totalFiles++;
  console.log(`  ${file}`);
  for (const { from, to, count } of changes) {
    console.log(`    ${from.padEnd(22)} →  ${to.padEnd(22)}  ×${count}`);
  }

  if (apply) {
    fs.writeFileSync(fullPath, updated, 'utf8');
  }
}

console.log('');
console.log('─────────────────────────────────────────────────────────────────────');
if (totalFiles === 0) {
  console.log('  Nothing to change — all migration files are already clean.');
} else {
  console.log(`  ${apply ? 'Applied' : 'Would change'}: ${totalFiles} file(s), ${totalReplacements} replacement(s)`);
  if (!apply) {
    console.log('');
    console.log('  Run with --apply to write changes:');
    console.log('    node fix-menu-terminology.js --apply');
  }
}
console.log('');
