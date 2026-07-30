const fs = require('fs');
const path = require('path');

// Walk frontend/src and, for every .ts/.tsx/.js file, resolve translation
// keys to their FULLY-QUALIFIED path in the messages JSON.
//
// This used to just regex for t('key') and check `key` against the root
// of ar.json directly. That's wrong for namespaced translators — next-intl's
// `const tHome = useTranslations('home')` means `tHome('features.title')`
// resolves to `home.features.title`, not `features.title` at the root.
// Without tracking the namespace per translator variable, every namespaced
// call produced the wrong lookup key and either silently passed (false
// negative) or reported bogus missing keys (false positive) — which is how
// the home.features/home.services gap in ar.json shipped undetected.
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

      // Pass 1: map each translator variable to its namespace.
      // `const t = useTranslations()` -> namespace '' (root)
      // `const tHome = useTranslations('home')` -> namespace 'home'
      const nsMap = {};
      const declRe = /\b(?:const|let|var)\s+(\w+)\s*=\s*useTranslations\(\s*(?:['"]([^'"]*)['"])?\s*\)/g;
      let d;
      while ((d = declRe.exec(content))) {
        nsMap[d[1]] = d[2] || '';
      }

      // Pass 2: for each known translator variable, find its calls and
      // qualify the key with that variable's namespace. Skips any `t(...)`-
      // shaped call whose identifier isn't a translator declared in this
      // file (e.g. `format(...)`, `sort(...)`), since nsMap only contains
      // real useTranslations() results.
      for (const [varName, namespace] of Object.entries(nsMap)) {
        const callRe = new RegExp(
          '\\b' + varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\(([\'"])([^\'"]+)\\1',
          'g'
        );
        let m;
        while ((m = callRe.exec(content))) {
          const rawKey = m[2];
          const fullKey = namespace ? `${namespace}.${rawKey}` : rawKey;
          keys.add(fullKey);
        }
      }
    }
  }
  return keys;
}

const frontendSrc = 'frontend/src';
const allKeys = findKeys(frontendSrc);

const en = JSON.parse(fs.readFileSync('frontend/messages/en.json', 'utf8'));
const ar = JSON.parse(fs.readFileSync('frontend/messages/ar.json', 'utf8'));

function getNestedValue(obj, key) {
  return key.split('.').reduce((o, i) => (o && typeof o === 'object' ? o[i] : undefined), obj);
}

const missingAr = [];
const missingEnToo = []; // keys missing from en.json too — likely a typo'd/dead key, not a translation gap
for (const key of allKeys) {
  const inEn = getNestedValue(en, key) !== undefined;
  const inAr = getNestedValue(ar, key) !== undefined;
  if (!inAr) {
    if (inEn) missingAr.push(key);
    else missingEnToo.push(key);
  }
}

console.log('Total keys found:', allKeys.size);
console.log('Missing in Arabic (present in English):', missingAr.length);
console.log(missingAr.sort().join('\n'));
console.log('\nMissing from BOTH en and ar (likely dead/typo keys, not translation gaps):', missingEnToo.length);
console.log(missingEnToo.sort().slice(0, 30).join('\n'));
