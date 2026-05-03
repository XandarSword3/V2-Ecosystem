const fs = require('fs');
const path = require('path');

function findKeys(dir) {
  let keys = new Set();
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        const subKeys = findKeys(fullPath);
        subKeys.forEach(k => keys.add(k));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.matchAll(/t\(['"]([^'"]+)['"]\)/g);
      for (const match of matches) {
        keys.add(match[1]);
      }
    }
  }
  return keys;
}

const frontendSrc = 'frontend/src';
const allKeys = findKeys(frontendSrc);

const ar = JSON.parse(fs.readFileSync('frontend/messages/ar.json', 'utf8'));

function getNestedValue(obj, key) {
  return key.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
}

const missingAr = [];
for (const key of allKeys) {
  if (!getNestedValue(ar, key)) {
    missingAr.push(key);
  }
}

console.log('Total keys found:', allKeys.size);
console.log('Missing in Arabic:', missingAr.length);
console.log('First 100 missing:', missingAr.slice(0, 100));
