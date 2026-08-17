#!/usr/bin/env node
/**
 * CI Guard: Enforce Zero Mocks in Integration Tests
 *
 * Verifies that no test file in backend/tests/integration/ uses `vi.mock()`
 * or `jest.mock()`.
 *
 * Law: Integration tests test real database and real service interactions.
 * Mocks belong exclusively in backend/tests/unit/.
 *
 * Usage:
 *   node scripts/check-no-mock-integration.js
 */

const fs = require('fs');
const path = require('path');

const INTEGRATION_DIR = path.resolve(__dirname, '..', 'tests', 'integration');

function findFiles(dir, filter) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath, filter));
    } else if (filter(filePath)) {
      results.push(filePath);
    }
  }
  return results;
}

const testFiles = findFiles(INTEGRATION_DIR, (f) => /\.(test|spec)\.ts$/.test(f));
const violations = [];

const MOCK_PATTERN = /\b(vi|jest)\.mock\s*\(/;

for (const file of testFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Ignore lines that are comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      return;
    }
    if (MOCK_PATTERN.test(line)) {
      violations.push({
        file: path.relative(path.resolve(__dirname, '..'), file),
        line: idx + 1,
        content: trimmed,
      });
    }
  });
}

if (violations.length > 0) {
  console.error('\n❌ CI CHECK FAILED: Found mock calls in integration test directory (tests/integration/).');
  console.error('Integration tests must test real database and service paths without vi.mock / jest.mock.\n');
  violations.forEach((v) => {
    console.error(`  ${v.file}:${v.line} -> ${v.content}`);
  });
  console.error('\nFix: Move mocked tests to backend/tests/unit/ or rewrite them with real database assertions.\n');
  process.exit(1);
} else {
  console.log(`\n✅ CI check passed: All ${testFiles.length} integration test files use real dependencies (0 mock calls found).\n`);
  process.exit(0);
}
