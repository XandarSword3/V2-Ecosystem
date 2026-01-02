#!/usr/bin/env node

/**
 * Translation Checker Script
 * 
 * This script checks that all translation keys are present in all language files.
 * It helps identify missing translations across en.json, ar.json, and fr.json.
 * 
 * Usage:
 *   node scripts/check-translations.js
 *   npm run check:translations
 * 
 * Exit codes:
 *   0 - All translations are complete
 *   1 - Missing translations found
 */

const fs = require('fs');
const path = require('path');

// Configuration
const LOCALES_DIR = path.join(__dirname, '../src/locales');
const SUPPORTED_LANGUAGES = ['en', 'ar', 'fr'];
const BASE_LANGUAGE = 'en'; // English is the source of truth

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadTranslations(language) {
  const filePath = path.join(LOCALES_DIR, `${language}.json`);
  
  if (!fs.existsSync(filePath)) {
    log(`❌ Translation file not found: ${filePath}`, 'red');
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    log(`❌ Failed to parse ${language}.json: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Recursively get all keys from a nested object
 * Returns keys in dot notation (e.g., "common.buttons.submit")
 */
function getAllKeys(obj, prefix = '') {
  const keys = [];
  
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

/**
 * Get value from nested object using dot notation key
 */
function getValueByKey(obj, key) {
  return key.split('.').reduce((current, part) => {
    return current && current[part] !== undefined ? current[part] : undefined;
  }, obj);
}

/**
 * Check if a value is empty or a placeholder
 */
function isEmptyOrPlaceholder(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Check for common placeholder patterns
    return trimmed === '' || 
           trimmed === 'TODO' || 
           trimmed === 'TRANSLATE' ||
           trimmed.startsWith('TODO:') ||
           trimmed.startsWith('[');
  }
  return false;
}

function main() {
  log('\n🌐 Translation Checker\n', 'bold');
  log(`Checking translations in: ${LOCALES_DIR}\n`, 'cyan');
  
  // Load all translation files
  const translations = {};
  let hasLoadError = false;
  
  for (const lang of SUPPORTED_LANGUAGES) {
    translations[lang] = loadTranslations(lang);
    if (translations[lang] === null) {
      hasLoadError = true;
    }
  }
  
  if (hasLoadError) {
    log('\n❌ Some translation files could not be loaded. Please fix the errors above.\n', 'red');
    process.exit(1);
  }
  
  // Get all keys from the base language (English)
  const baseKeys = getAllKeys(translations[BASE_LANGUAGE]);
  log(`📝 Found ${baseKeys.length} translation keys in ${BASE_LANGUAGE}.json\n`, 'blue');
  
  // Track issues
  const issues = {
    missing: {},
    empty: {},
    extra: {},
  };
  
  // Check each language against the base
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === BASE_LANGUAGE) continue;
    
    issues.missing[lang] = [];
    issues.empty[lang] = [];
    issues.extra[lang] = [];
    
    const langKeys = getAllKeys(translations[lang]);
    
    // Find missing keys
    for (const key of baseKeys) {
      const value = getValueByKey(translations[lang], key);
      
      if (value === undefined) {
        issues.missing[lang].push(key);
      } else if (isEmptyOrPlaceholder(value)) {
        issues.empty[lang].push({ key, value });
      }
    }
    
    // Find extra keys (keys in other language but not in base)
    for (const key of langKeys) {
      if (!baseKeys.includes(key)) {
        issues.extra[lang].push(key);
      }
    }
  }
  
  // Print results
  let hasIssues = false;
  
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === BASE_LANGUAGE) continue;
    
    const missing = issues.missing[lang].length;
    const empty = issues.empty[lang].length;
    const extra = issues.extra[lang].length;
    
    log(`\n${'─'.repeat(50)}`, 'cyan');
    log(`📁 ${lang.toUpperCase()}.json`, 'bold');
    log(`${'─'.repeat(50)}`, 'cyan');
    
    if (missing === 0 && empty === 0) {
      log(`✅ All ${baseKeys.length} keys are translated!`, 'green');
    } else {
      hasIssues = true;
      
      if (missing > 0) {
        log(`\n❌ Missing keys (${missing}):`, 'red');
        issues.missing[lang].slice(0, 20).forEach((key) => {
          const baseValue = getValueByKey(translations[BASE_LANGUAGE], key);
          log(`   • ${key}`, 'yellow');
          log(`     EN: "${baseValue}"`, 'reset');
        });
        if (missing > 20) {
          log(`   ... and ${missing - 20} more`, 'yellow');
        }
      }
      
      if (empty > 0) {
        log(`\n⚠️  Empty/Placeholder values (${empty}):`, 'yellow');
        issues.empty[lang].slice(0, 10).forEach(({ key, value }) => {
          log(`   • ${key}`, 'yellow');
          log(`     Current: "${value}"`, 'reset');
        });
        if (empty > 10) {
          log(`   ... and ${empty - 10} more`, 'yellow');
        }
      }
    }
    
    if (extra > 0) {
      log(`\n📋 Extra keys not in base (${extra}):`, 'magenta');
      issues.extra[lang].slice(0, 5).forEach((key) => {
        log(`   • ${key}`, 'magenta');
      });
      if (extra > 5) {
        log(`   ... and ${extra - 5} more`, 'magenta');
      }
    }
  }
  
  // Summary
  log(`\n${'═'.repeat(50)}`, 'cyan');
  log('📊 SUMMARY', 'bold');
  log(`${'═'.repeat(50)}`, 'cyan');
  
  const totalMissing = SUPPORTED_LANGUAGES
    .filter(l => l !== BASE_LANGUAGE)
    .reduce((sum, lang) => sum + (issues.missing[lang]?.length || 0), 0);
  
  const totalEmpty = SUPPORTED_LANGUAGES
    .filter(l => l !== BASE_LANGUAGE)
    .reduce((sum, lang) => sum + (issues.empty[lang]?.length || 0), 0);
  
  log(`\nBase language (${BASE_LANGUAGE}): ${baseKeys.length} keys`);
  
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === BASE_LANGUAGE) continue;
    const langKeys = getAllKeys(translations[lang]);
    const coverage = ((langKeys.length - (issues.missing[lang]?.length || 0)) / baseKeys.length * 100).toFixed(1);
    log(`${lang.toUpperCase()}: ${coverage}% coverage (${issues.missing[lang]?.length || 0} missing, ${issues.empty[lang]?.length || 0} empty)`);
  }
  
  if (hasIssues) {
    log(`\n❌ Found ${totalMissing} missing translations and ${totalEmpty} empty/placeholder values`, 'red');
    log('\nTo fix:', 'cyan');
    log('  1. Add the missing keys to the respective language files');
    log('  2. Replace placeholder values with actual translations');
    log('  3. Run this script again to verify\n');
    process.exit(1);
  } else {
    log(`\n✅ All translations are complete!`, 'green');
    process.exit(0);
  }
}

// Generate missing translations template
function generateMissingTemplate() {
  log('\n📝 Generating missing translations template...\n', 'cyan');
  
  const translations = {};
  for (const lang of SUPPORTED_LANGUAGES) {
    translations[lang] = loadTranslations(lang);
  }
  
  const baseKeys = getAllKeys(translations[BASE_LANGUAGE]);
  
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === BASE_LANGUAGE) continue;
    
    const missingKeys = [];
    for (const key of baseKeys) {
      if (getValueByKey(translations[lang], key) === undefined) {
        missingKeys.push({
          key,
          en: getValueByKey(translations[BASE_LANGUAGE], key),
        });
      }
    }
    
    if (missingKeys.length > 0) {
      const outputPath = path.join(LOCALES_DIR, `missing-${lang}.json`);
      const template = {};
      
      missingKeys.forEach(({ key, en }) => {
        template[key] = {
          en,
          [lang]: `TODO: Translate to ${lang.toUpperCase()}`,
        };
      });
      
      fs.writeFileSync(outputPath, JSON.stringify(template, null, 2));
      log(`📄 Generated ${outputPath} with ${missingKeys.length} missing keys`, 'green');
    }
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--generate') || args.includes('-g')) {
  generateMissingTemplate();
} else if (args.includes('--help') || args.includes('-h')) {
  log('\nTranslation Checker - Check for missing translations\n', 'bold');
  log('Usage:', 'cyan');
  log('  node check-translations.js           Check for missing translations');
  log('  node check-translations.js --generate Generate template for missing keys');
  log('  node check-translations.js --help     Show this help\n');
} else {
  main();
}
