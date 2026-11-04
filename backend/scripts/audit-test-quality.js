const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat && stat.isDirectory()) {
        results = results.concat(walk(full));
      } else if (file.endsWith('.test.ts')) {
        results.push(full);
      }
    }
  } catch (e) {}
  return results;
}

const files = walk('tests/unit');
const suspicious = [];

for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  const importsSrc = /from\s+['"][^'"]*src\//.test(code);
  const testCount = (code.match(/\bit\s*\(|\btest\s*\(/g) || []).length;
  
  // Check for dummy tests like expect(x).toBe(x) or expect(constant).toBe(constant)
  const dummyAssertions = (code.match(/expect\s*\(\s*(['"][^'"]*['"]|\d+|true|false)\s*\)\s*\.\s*(toBe|toEqual)\s*\(\s*\1\s*\)/g) || []).length;
  
  if (!importsSrc) {
    suspicious.push({ file: f, reason: 'No src/ import', testCount });
  } else if (dummyAssertions > 0) {
    suspicious.push({ file: f, reason: `Has ${dummyAssertions} dummy self-assertions`, testCount });
  }
}

console.log(`Audited ${files.length} unit test files.`);
console.log(`Found ${suspicious.length} suspicious files:`);
console.log(JSON.stringify(suspicious, null, 2));
