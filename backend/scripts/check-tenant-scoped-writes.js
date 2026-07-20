#!/usr/bin/env node
/**
 * Stage 4 of the tenant-isolation contract freeze
 * (docs/architecture/DATA_OWNERSHIP_CONTRACT.md).
 *
 * This is the check that would have caught the July 6 bug before it
 * shipped: purchase_shared_capacity_atomic() inserted into `transactions`
 * (tenant_id NOT NULL, no default) without ever setting tenant_id, so
 * every real call failed at the database -- in production, not in CI.
 *
 * Scans for writes into tenant-scoped tables (per
 * backend/scripts/tenant-scope-schema.json) that don't tag the row with
 * tenant_id:
 *   - SQL: `INSERT INTO <table> (col, col, ...)` in any migration file,
 *     including inside CREATE FUNCTION bodies -- this is what would have
 *     caught July 6.
 *   - TypeScript/JS: `.from('<table>')....insert(...)` /
 *     `.upsert(...)` chains in backend/src, when the object literal has
 *     no `tenant_id` key.
 *
 * This is regex/heuristic-based, not a real SQL or TS parser -- same
 * class of tool as the existing tools/analyze_rls.js and
 * tools/audit_isolation.js in this repo. It will miss dynamically-built
 * SQL (the same blind spot documented in DATA_OWNERSHIP_CONTRACT.md) and
 * won't understand control flow. What it catches is exactly the shape of
 * bug that shipped on July 6: a literal INSERT into a known tenant-scoped
 * table with no tenant_id in sight.
 *
 * KNOWN LEGACY DEBT: Phase 2 of the security remediation (the
 * scoped-query wrapper migration) is still in progress -- roughly 75
 * call sites across ~20 files haven't been migrated to the wrapper yet
 * (see backend/tenant_scope_coverage_report.md). Those are pre-existing
 * violations, not new ones. Rather than fail the whole build on debt this
 * check didn't create, violations are ratcheted against a checked-in
 * baseline (tenant-write-baseline.json): anything already in the
 * baseline is tolerated, anything NEW fails the build.
 *
 * Usage:
 *   node backend/scripts/check-tenant-scoped-writes.js
 *   node backend/scripts/check-tenant-scoped-writes.js --update-baseline
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCHEMA_PATH = path.join(__dirname, 'tenant-scope-schema.json');
const BASELINE_PATH = path.join(__dirname, 'tenant-write-baseline.json');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');
const BACKEND_SRC_DIR = path.join(REPO_ROOT, 'backend', 'src');

// Tables that legitimately have unscoped writes and should never be
// flagged, even though they carry a tenant_id column.
const EXCLUDE_TABLES = new Set(['users']); // deliberately nullable -- see contract doc

function loadTenantScopedTables() {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const tables = new Set(schema.tenant_scoped_not_null_enforced_tables || []);
  tables.add('property_groups'); // closed in Stage 4, may predate a schema.json regen
  for (const t of EXCLUDE_TABLES) tables.delete(t);
  return tables;
}

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, exts, out);
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function relPath(p) {
  return path.relative(REPO_ROOT, p).replace(/\\/g, '/');
}

/** Find INSERT INTO <table> (<cols>) in SQL text, return violations missing tenant_id in the column list. */
function scanSqlFile(file, tenantTables) {
  const violations = [];
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const insertRe = /INSERT\s+INTO\s+"?([a-zA-Z0-9_]+)"?\s*\(([^)]*)\)/gi;
  let m;
  while ((m = insertRe.exec(text)) !== null) {
    const table = m[1].toLowerCase();
    if (!tenantTables.has(table)) continue;
    const cols = m[2].toLowerCase();
    if (/\btenant_id\b/.test(cols)) continue;
    const upto = text.slice(0, m.index);
    const line = upto.split('\n').length;
    violations.push({ file: relPath(file), line, table, kind: 'sql-insert' });
  }
  return violations;
}

/**
 * Find `.from('table')` chains followed (within a small window) by
 * `.insert(...)` / `.upsert(...)`, and flag when the call's argument
 * text has no `tenant_id` key. Purely textual/windowed, not AST-based.
 */
function scanTsFile(file, tenantTables) {
  const violations = [];
  const text = fs.readFileSync(file, 'utf8');
  const fromRe = /\.from\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g;
  let m;
  while ((m = fromRe.exec(text)) !== null) {
    const table = m[1].toLowerCase();
    if (!tenantTables.has(table)) continue;

    // Look at the next ~400 chars after .from(...) for a chained
    // .insert(/.upsert( call -- covers the common one-liner and
    // short multi-line chains without trying to be a real parser.
    const windowStart = m.index + m[0].length;
    const window = text.slice(windowStart, windowStart + 400);
    const callMatch = window.match(/\.(insert|upsert)\s*\(/);
    if (!callMatch || callMatch.index > 120) continue; // not a direct chain

    // Grab the argument text up to a reasonable close-paren depth match.
    const argStart = windowStart + callMatch.index + callMatch[0].length;
    let depth = 1;
    let i = argStart;
    while (i < text.length && depth > 0) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') depth--;
      i++;
    }
    const argText = text.slice(argStart, i - 1);
    if (/\btenant_id\b/.test(argText)) continue;

    // Skip calls that clearly go through the scoped-query wrapper --
    // those inject tenant_id internally (see security/scoped-client.ts).
    const precedingWindow = text.slice(Math.max(0, m.index - 60), m.index);
    if (/getScopedClient|scopedClient|withTenantScope/.test(precedingWindow)) continue;

    const upto = text.slice(0, m.index);
    const line = upto.split('\n').length;
    violations.push({ file: relPath(file), line, table, kind: `ts-${callMatch[1]}` });
  }
  return violations;
}

function key(v) {
  return `${v.file}:${v.line}:${v.table}:${v.kind}`;
}

function main() {
  const updateBaseline = process.argv.includes('--update-baseline');
  const tenantTables = loadTenantScopedTables();

  const sqlFiles = walk(MIGRATIONS_DIR, ['.sql']);
  const tsFiles = walk(BACKEND_SRC_DIR, ['.ts']);

  let violations = [];
  for (const f of sqlFiles) violations = violations.concat(scanSqlFile(f, tenantTables));
  for (const f of tsFiles) violations = violations.concat(scanTsFile(f, tenantTables));

  const current = new Set(violations.map(key));

  if (updateBaseline) {
    const sorted = [...current].sort();
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`Baseline updated: ${sorted.length} known violation(s) recorded.`);
    return;
  }

  let baseline = new Set();
  if (fs.existsSync(BASELINE_PATH)) {
    baseline = new Set(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')));
  }

  const newViolations = violations.filter((v) => !baseline.has(key(v)));

  if (newViolations.length > 0) {
    console.error(`\n✗ ${newViolations.length} new tenant-scoped write(s) without a tenant_id tag:\n`);
    for (const v of newViolations) {
      console.error(`  ${v.file}:${v.line}  [${v.table}]  (${v.kind})`);
    }
    console.error(
      `\nEvery write to a tenant-scoped table must set tenant_id explicitly.\n` +
      `See docs/architecture/DATA_OWNERSHIP_CONTRACT.md.\n` +
      `If this is a false positive, fix the detection logic rather than the baseline --\n` +
      `the baseline is for pre-existing debt (Phase 2, in progress), not new escapes.\n`
    );
    process.exit(1);
  }

  const resolvedCount = baseline.size - [...baseline].filter((k) => current.has(k)).length;
  console.log(
    `✓ No new unscoped tenant writes. ${current.size} pre-existing (baselined) call site(s) remain` +
    (resolvedCount > 0 ? `, ${resolvedCount} resolved since the baseline was last updated (run --update-baseline to shrink it).` : '.')
  );
}

main();
