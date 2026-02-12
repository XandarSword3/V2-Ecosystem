const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get all test files
const testsDir = path.join(__dirname, '..', 'tests');
const testFiles = [];

function findTestFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findTestFiles(fullPath);
    } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
      testFiles.push(fullPath);
    }
  }
}

findTestFiles(testsDir);

console.log(`Found ${testFiles.length} test files`);

// Run coverage on batches of files
const batchSize = 20;
const batches = [];
for (let i = 0; i < testFiles.length; i += batchSize) {
  batches.push(testFiles.slice(i, i + batchSize));
}

console.log(`Split into ${batches.length} batches of ~${batchSize} files`);

// Run first batch only to get a quick coverage estimate
const batch = batches[0];
const batchPaths = batch.map(f => f.replace(/\\/g, '/')).join(' ');

console.log('\nRunning coverage on first batch...');
try {
  const result = execSync(
    `npx vitest run --coverage --coverage.provider=v8 --coverage.reporter=text-summary ${batchPaths}`,
    { 
      cwd: path.join(__dirname, '..'),
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' }
    }
  );
  console.log(result);
} catch (e) {
  console.log(e.stdout);
  console.log(e.stderr);
}
