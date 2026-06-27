// find-imports.js — Locate every file that imports/exports a given module
//
// Usage:
//   node find-imports.js business-types
//   node find-imports.js template-permission-presets
//   node find-imports.js modules.controller
//
// The argument is matched as a substring against import/export/require lines.
// Case-insensitive. Covers .ts, .tsx, .js, .jsx files.
// Skips: node_modules, .next, dist, archive, _legacy-sql-archive, .git

import fs   from 'fs';
import path from 'path';

const ROOT = path.resolve('.');

const SKIP_DIRS = new Set([
  'node_modules', '.next', 'dist', 'archive',
  '_legacy-sql-archive', '.git', '.aider.tags.cache.v4',
]);

const FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// Lines that are imports, exports, or require() calls
const IMPORT_RE = /^\s*(import|export)\s+.*from\s+['"]([^'"]+)['"]/;
const REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/;

// ─── args ───────────────────────────────────────────────────────────────────

const target = process.argv[2];

if (!target) {
  console.error('\nUsage: node find-imports.js <module-name-fragment>\n');
  console.error('Examples:');
  console.error('  node find-imports.js business-types');
  console.error('  node find-imports.js modules.controller');
  process.exit(1);
}

const needle = target.toLowerCase();

// ─── walk ────────────────────────────────────────────────────────────────────

const hits = []; // { file, line, text }

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (_) { return; }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
      continue;
    }
    if (!FILE_EXTS.has(path.extname(entry.name))) continue;

    const full = path.join(dir, entry.name);
    let lines;
    try { lines = fs.readFileSync(full, 'utf8').split('\n'); }
    catch (_) { continue; }

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const lower = raw.toLowerCase();

      // Must be an import / export / require line
      if (!IMPORT_RE.test(raw) && !REQUIRE_RE.test(raw)) continue;

      // Must reference our target
      if (!lower.includes(needle)) continue;

      hits.push({
        file: path.relative(ROOT, full),
        line: i + 1,
        text: raw.trim(),
      });
    }
  }
}

walk(ROOT);

// ─── output ──────────────────────────────────────────────────────────────────

const BAR  = '─'.repeat(68);
const BOLD = s => s; // plain terminal — no ANSI needed for Claude to read

console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log(`║  IMPORT FINDER — searching for: "${target}"`);
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

if (hits.length === 0) {
  console.log(`  No import/export/require lines reference "${target}".\n`);
  console.log('  Either the file is unused, or it is only referenced by non-JS/TS files.\n');
  process.exit(0);
}

// Group by file
const byFile = new Map();
for (const h of hits) {
  if (!byFile.has(h.file)) byFile.set(h.file, []);
  byFile.get(h.file).push(h);
}

console.log(`  Found ${hits.length} reference(s) across ${byFile.size} file(s).\n`);
console.log(BAR);

for (const [file, refs] of byFile) {
  console.log(`\n  ${file}`);
  for (const r of refs) {
    console.log(`    line ${String(r.line).padEnd(5)}  ${r.text}`);
  }
}

console.log('\n' + BAR + '\n');
