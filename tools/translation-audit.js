/**
 * Translation Audit Script
 * 
 * This script scans all React components in the frontend and:
 * 1. Identifies hardcoded text strings
 * 2. Checks if translation keys exist in all language files
 * 3. Reports missing translations
 * 4. Suggests translation keys for hardcoded text
 * 
 * Usage: node --loader ts-node/esm tools/translation-audit.ts
 */

const fs = require('fs');
const path = require('path');

interface AuditResult {
  file: string;
  line: number;
  type: 'hardcoded' | 'missing-translation' | 'inconsistent';
  text: string;
  suggestion?: string;
}

interface TranslationFile {
  [key: string]: string | TranslationFile;
}

const MESSAGES_DIR = path.join(__dirname, '..', 'frontend', 'messages');
const APP_DIR = path.join(__dirname, '..', 'frontend', 'src', 'app');
const COMPONENTS_DIR = path.join(__dirname, '..', 'frontend', 'src', 'components');

const SUPPORTED_LANGUAGES = ['en', 'ar', 'fr'];

// Words to ignore (not needing translation)
const IGNORE_WORDS = [
  'React', 'Next', 'TypeScript', 'JavaScript', 'CSS', 'HTML',
  'API', 'JSON', 'URL', 'HTTP', 'HTTPS', 'GET', 'POST',
  'V2', 'Resort', 'V2 Resort',
  // Technical terms
  'onClick', 'onChange', 'className', 'useState', 'useEffect',
  'motion', 'div', 'span', 'button', 'Link', 'href',
];

// Load translation files
function loadTranslations(): Map<string, TranslationFile> {
  const translations = new Map<string, TranslationFile>();
  
  for (const lang of SUPPORTED_LANGUAGES) {
    const filePath = path.join(MESSAGES_DIR, `${lang}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      translations.set(lang, JSON.parse(content));
    }
  }
  
  return translations;
}

// Get all keys from a translation object (flattened)
function getAllKeys(obj: TranslationFile, prefix = ''): string[] {
  const keys: string[] = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      const nestedKeys = getAllKeys(value as TranslationFile, fullKey);
      keys.push(...nestedKeys);
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

// Find all TSX/JSX files
function findSourceFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...findSourceFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx'))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Find potential hardcoded strings
function findHardcodedStrings(content: string, filePath: string): AuditResult[] {
  const results: AuditResult[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Skip imports, comments, and type definitions
    if (line.trim().startsWith('import ') || 
        line.trim().startsWith('//') ||
        line.trim().startsWith('*') ||
        line.trim().startsWith('type ') ||
        line.trim().startsWith('interface ')) {
      continue;
    }
    
    // Look for text content in JSX
    const jsxTextMatch = line.match(/>([A-Z][a-zA-Z0-9\s]+)(?:<|$)/);
    if (jsxTextMatch) {
      const text = jsxTextMatch[1].trim();
      if (text.length > 2 && 
          !IGNORE_WORDS.some(w => text.includes(w)) &&
          !text.match(/^\{.*\}$/) &&
          !line.includes('t(') &&
          !line.includes('translateContent')) {
        results.push({
          file: filePath,
          line: lineNum,
          type: 'hardcoded',
          text,
          suggestion: suggestTranslationKey(text),
        });
      }
    }
    
    // Look for hardcoded strings in props
    const propTextMatch = line.match(/(?:title|label|placeholder|alt|aria-label)=["']([A-Z][^"']+)["']/);
    if (propTextMatch && !line.includes('t(') && !line.includes('{')) {
      const text = propTextMatch[1];
      if (!IGNORE_WORDS.some(w => text.includes(w))) {
        results.push({
          file: filePath,
          line: lineNum,
          type: 'hardcoded',
          text,
          suggestion: suggestTranslationKey(text),
        });
      }
    }
  }
  
  return results;
}

// Suggest a translation key based on text
function suggestTranslationKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 40);
}

// Compare translations across languages
function findMissingTranslations(translations: Map<string, TranslationFile>): AuditResult[] {
  const results: AuditResult[] = [];
  const enTranslations = translations.get('en');
  
  if (!enTranslations) {
    console.error('English translation file not found!');
    return results;
  }
  
  const enKeys = getAllKeys(enTranslations);
  const enKeySet = new Set(enKeys);
  
  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang === 'en') continue;
    
    const langTranslations = translations.get(lang);
    if (!langTranslations) continue;
    
    const langKeys = getAllKeys(langTranslations);
    const langKeySet = new Set(langKeys);
    
    // Find keys in English that are missing in this language
    for (const key of enKeys) {
      if (!langKeySet.has(key)) {
        results.push({
          file: `messages/${lang}.json`,
          line: 0,
          type: 'missing-translation',
          text: `Key "${key}" exists in English but not in ${lang}`,
        });
      }
    }
    
    // Find keys in this language that are missing in English
    for (const key of langKeys) {
      if (!enKeySet.has(key)) {
        results.push({
          file: `messages/${lang}.json`,
          line: 0,
          type: 'inconsistent',
          text: `Key "${key}" exists in ${lang} but not in English (orphaned)`,
        });
      }
    }
  }
  
  return results;
}

// Generate report
function generateReport(results: AuditResult[]): void {
  console.log('\n========================================');
  console.log('   TRANSLATION AUDIT REPORT');
  console.log('========================================\n');
  
  const hardcoded = results.filter(r => r.type === 'hardcoded');
  const missing = results.filter(r => r.type === 'missing-translation');
  const inconsistent = results.filter(r => r.type === 'inconsistent');
  
  console.log(`📊 Summary:`);
  console.log(`   - Hardcoded strings found: ${hardcoded.length}`);
  console.log(`   - Missing translations: ${missing.length}`);
  console.log(`   - Inconsistent keys: ${inconsistent.length}`);
  console.log('');
  
  if (hardcoded.length > 0) {
    console.log('⚠️  HARDCODED STRINGS:');
    console.log('─'.repeat(50));
    for (const result of hardcoded.slice(0, 20)) {
      const relativePath = path.relative(process.cwd(), result.file);
      console.log(`  📄 ${relativePath}:${result.line}`);
      console.log(`     Text: "${result.text}"`);
      if (result.suggestion) {
        console.log(`     Suggested key: ${result.suggestion}`);
      }
      console.log('');
    }
    if (hardcoded.length > 20) {
      console.log(`   ... and ${hardcoded.length - 20} more\n`);
    }
  }
  
  if (missing.length > 0) {
    console.log('❌ MISSING TRANSLATIONS:');
    console.log('─'.repeat(50));
    for (const result of missing.slice(0, 20)) {
      console.log(`  📄 ${result.file}`);
      console.log(`     ${result.text}`);
      console.log('');
    }
    if (missing.length > 20) {
      console.log(`   ... and ${missing.length - 20} more\n`);
    }
  }
  
  console.log('========================================');
  console.log('   RECOMMENDATIONS');
  console.log('========================================\n');
  
  if (hardcoded.length > 0) {
    console.log('1. Replace hardcoded strings with t() calls:');
    console.log('   - Add keys to messages/en.json');
    console.log('   - Add translations to ar.json and fr.json');
    console.log('   - Use t("key") or tCommon("key") in components\n');
  }
  
  if (missing.length > 0) {
    console.log('2. Add missing translations:');
    console.log('   - Check messages/*.json files');
    console.log('   - Ensure all keys exist in all languages\n');
  }
  
  console.log('✅ Audit complete!\n');
}

// Main function
async function main() {
  console.log('🔍 Starting Translation Audit...\n');
  
  // Load translations
  console.log('📂 Loading translation files...');
  const translations = loadTranslations();
  console.log(`   Found ${translations.size} language files\n`);
  
  // Find source files
  console.log('📁 Scanning source files...');
  const appFiles = findSourceFiles(APP_DIR);
  const componentFiles = findSourceFiles(COMPONENTS_DIR);
  const allFiles = [...appFiles, ...componentFiles];
  console.log(`   Found ${allFiles.length} source files\n`);
  
  const results: AuditResult[] = [];
  
  // Scan for hardcoded strings
  console.log('🔎 Scanning for hardcoded strings...');
  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const fileResults = findHardcodedStrings(content, file);
    results.push(...fileResults);
  }
  
  // Check for missing translations
  console.log('🔎 Checking translation consistency...');
  const missingResults = findMissingTranslations(translations);
  results.push(...missingResults);
  
  // Generate report
  generateReport(results);
}

main().catch(console.error);
