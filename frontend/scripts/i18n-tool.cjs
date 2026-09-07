#!/usr/bin/env node

/**
 * Unified i18n AST Scanner, Autofix & Parity Checker
 *
 * Usage:
 *   node scripts/i18n-tool.cjs check-parity
 *   node scripts/i18n-tool.cjs scan [paths...] [--ci] [--json]
 *   node scripts/i18n-tool.cjs autofix <file|dir> [--namespace=common|checkout]
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const MESSAGES_DIR = path.join(__dirname, '../messages');
const SUPPORTED_LANGUAGES = ['en', 'ar', 'fr'];
const BASE_LANGUAGE = 'en';

const USER_FACING_ATTRS = new Set([
  'placeholder',
  'title',
  'label',
  'alt',
  'aria-label',
  'confirmText',
  'cancelText',
  'emptyMessage',
]);

const NON_USER_FACING_ATTRS = new Set([
  'className',
  'class',
  'id',
  'key',
  'href',
  'to',
  'as',
  'type',
  'name',
  'variant',
  'size',
  'style',
  'color',
  'data-testid',
  'target',
  'rel',
  'src',
  'icon',
  'method',
  'action',
  'role',
]);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color] || ''}${msg}${colors.reset}`);
}

// ─── HELPER: Dot-notation Flattening ──────────────────────────────────────────

function flattenKeys(obj, prefix = '') {
  const result = {};
  for (const [key, val] of Object.entries(obj || {})) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenKeys(val, fullKey));
    } else {
      result[fullKey] = val;
    }
  }
  return result;
}

// ─── COMMAND 1: check-parity ──────────────────────────────────────────────────

function commandCheckParity() {
  log('\n🌐 Checking Translation Key Parity across messages/*.json\n', 'bold');

  const dictionaries = {};
  const flatDicts = {};

  for (const lang of SUPPORTED_LANGUAGES) {
    const filePath = path.join(MESSAGES_DIR, `${lang}.json`);
    if (!fs.existsSync(filePath)) {
      log(`❌ File not found: ${filePath}`, 'red');
      return 1;
    }
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      dictionaries[lang] = data;
      flatDicts[lang] = flattenKeys(data);
      log(`  ✔ Loaded ${lang}.json: ${Object.keys(flatDicts[lang]).length} keys`, 'green');
    } catch (e) {
      log(`❌ Error parsing ${filePath}: ${e.message}`, 'red');
      return 1;
    }
  }

  let hasDiscrepancy = false;
  const enKeys = new Set(Object.keys(flatDicts['en']));

  for (const lang of ['ar', 'fr']) {
    const langKeys = new Set(Object.keys(flatDicts[lang]));

    const missingInLang = [...enKeys].filter((k) => !langKeys.has(k));
    const extraInLang = [...langKeys].filter((k) => !enKeys.has(k));

    if (missingInLang.length > 0) {
      hasDiscrepancy = true;
      log(`\n❌ ${missingInLang.length} keys present in en.json but MISSING in ${lang}.json:`, 'red');
      missingInLang.slice(0, 15).forEach((k) => log(`   - ${k}`, 'yellow'));
      if (missingInLang.length > 15) log(`   ... and ${missingInLang.length - 15} more`, 'dim');
    }

    if (extraInLang.length > 0) {
      hasDiscrepancy = true;
      log(`\n⚠️  ${extraInLang.length} keys present in ${lang}.json but MISSING in en.json:`, 'yellow');
      extraInLang.slice(0, 15).forEach((k) => log(`   - ${k}`, 'yellow'));
      if (extraInLang.length > 15) log(`   ... and ${extraInLang.length - 15} more`, 'dim');
    }
  }

  if (!hasDiscrepancy) {
    log(`\n🎉 100% Mutual Parity! All ${enKeys.size} keys match exactly across [en, ar, fr].\n`, 'green');
    return 0;
  } else {
    log('\n❌ Translation parity check failed.\n', 'red');
    return 1;
  }
}

// ─── COMMAND 2: scan ──────────────────────────────────────────────────────────

function isTranslatableText(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length <= 1) return false;
  // Must contain at least 2 consecutive alphabetical characters
  if (!/[a-zA-Z]{2,}/.test(trimmed)) return false;
  // Ignore pure technical artifacts / code snippets / CSS
  if (/^[{}\[\]();<>:=]+$/.test(trimmed)) return false;
  if (/^(\d+(\.\d+)?|\d+px|\d+%|\d+rem|\$\d+|\d+\/\d+)$/.test(trimmed)) return false;
  if (/^(true|false|null|undefined|NaN|auto|inherit|none)$/i.test(trimmed)) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  return true;
}

function scanSourceFile(filePath, content) {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const findings = [];

  function visit(node) {
    // 1. Check raw JSX Text
    if (ts.isJsxText(node)) {
      const rawText = node.getText(sourceFile);
      const trimmed = rawText.trim();
      if (isTranslatableText(trimmed)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        findings.push({
          type: 'jsx-text',
          text: trimmed,
          raw: rawText,
          line: line + 1,
          column: character + 1,
          start: node.getStart(),
          end: node.getEnd(),
        });
      }
    }

    // 2. Check JSX Attributes
    if (ts.isJsxAttribute(node) && node.initializer) {
      const attrName = node.name.getText();
      if (USER_FACING_ATTRS.has(attrName) && ts.isStringLiteral(node.initializer)) {
        const val = node.initializer.text.trim();
        if (isTranslatableText(val)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            node.initializer.getStart()
          );
          findings.push({
            type: 'jsx-attribute',
            attrName,
            text: val,
            raw: node.initializer.getText(sourceFile),
            line: line + 1,
            column: character + 1,
            start: node.initializer.getStart(),
            end: node.initializer.getEnd(),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function getTsxFiles(targetPath) {
  let files = [];
  if (!fs.existsSync(targetPath)) return files;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (targetPath.endsWith('.tsx') || targetPath.endsWith('.ts')) files.push(targetPath);
    return files;
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getTsxFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')))) {
      files.push(full);
    }
  }
  return files;
}

function commandScan(paths, options = {}) {
  const isCI = !!options.ci;
  const isJson = !!options.json;
  const targetPaths = paths.length > 0 ? paths : ['src/components', 'src/app'];

  let allFiles = [];
  for (const p of targetPaths) {
    allFiles = allFiles.concat(getTsxFiles(p));
  }
  // Deduplicate
  allFiles = [...new Set(allFiles)];

  const results = {};
  let totalIssues = 0;

  for (const file of allFiles) {
    try {
      const code = fs.readFileSync(file, 'utf8');
      const findings = scanSourceFile(file, code);
      if (findings.length > 0) {
        results[file] = findings;
        totalIssues += findings.length;
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  if (isJson) {
    console.log(JSON.stringify({ totalIssues, fileCount: Object.keys(results).length, results }, null, 2));
    return totalIssues > 0 && isCI ? 1 : 0;
  }

  log(`\n🔍 i18n AST Scanner Results\n`, 'bold');
  log(`Scanned ${allFiles.length} files across ${targetPaths.join(', ')}.\n`, 'cyan');

  if (totalIssues === 0) {
    log(`✨ No hardcoded JSX strings found! Everything is clean.\n`, 'green');
    return 0;
  }

  log(`⚠️  Found ${totalIssues} hardcoded string literals across ${Object.keys(results).length} files:\n`, 'yellow');

  for (const [file, items] of Object.entries(results)) {
    const relFile = path.relative(process.cwd(), file);
    log(`📄 ${relFile} (${items.length} issues):`, 'cyan');
    items.forEach((item) => {
      const badge = item.type === 'jsx-text' ? '[Text]' : `[Attr: ${item.attrName}]`;
      log(`   L${item.line}:${item.column} ${badge} "${item.text}"`, 'dim');
    });
    console.log('');
  }

  if (isCI) {
    log(`❌ Hardcoded strings detected in CI mode. Exiting with 1.\n`, 'red');
    return 1;
  }

  return 0;
}

// ─── COMMAND 3: autofix / extract ─────────────────────────────────────────────

function toCamelCase(str) {
  return str
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .split(/[\s_-]+/)
    .map((word, i) => (i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join('')
    .slice(0, 35);
}

// Built-in common translation dictionary for automatic high-quality FR & AR values
const KNOWN_TRANSLATIONS = {
  // Fulfillment & Checkout
  'fulfillment selection': { fr: 'Sélection du mode de livraison', ar: 'اختيار طريقة الاستلام والتوصيل' },
  'select how you want to receive your order.': { fr: 'Choisissez comment vous souhaitez recevoir votre commande.', ar: 'اختر الطريقة التي تفضلها لاستلام طلبك.' },
  'choose delivery mode': { fr: 'Choisir le mode de livraison', ar: 'اختر طريقة التوصيل أو الاستلام' },
  'updating delivery pricing based on your fulfillment selection...': { fr: 'Mise à jour du tarif de livraison...', ar: 'جاري تحديث تكلفة التوصيل وفقاً لاختيارك...' },
  'pricing calculation failed for this destination. please verify the destination details.': { fr: 'Le calcul du tarif a échoué pour cette destination. Veuillez vérifier les détails.', ar: 'فشل احتساب السعر لهذه الوجهة. يرجى التحقق من تفاصيل العنوان.' },
  'back to customer details': { fr: 'Retour aux coordonnées', ar: 'العودة لبيانات العميل' },
  'recalculating pricing...': { fr: 'Recalcul du tarif...', ar: 'جاري إعادة احتساب السعر...' },
  'pricing error': { fr: 'Erreur de tarification', ar: 'خطأ في السعر' },
  'continue to payment': { fr: 'Continuer vers le paiement', ar: 'المتابعة إلى الدفع' },

  // Customer Step
  'customer details': { fr: 'Coordonnées du client', ar: 'بيانات العميل' },
  'please provide your contact information for this order.': { fr: 'Veuillez renseigner vos coordonnées pour cette commande.', ar: 'يرجى تقديم معلومات الاتصال الخاصة بك لهذا الطلب.' },
  'your name': { fr: 'Votre nom', ar: 'الاسم الكامل' },
  'e.g. sarah connor': { fr: 'ex. Sarah Connor', ar: 'مثال: سارة خليل' },
  'phone number': { fr: 'Numéro de téléphone', ar: 'رقم الهاتف' },
  'e.g. +1 555 123 4567': { fr: 'ex. +33 6 12 34 56 78', ar: 'مثال: 9613123456+' },
  'email address': { fr: 'Adresse email', ar: 'البريد الإلكتروني' },
  'optional, for digital receipt': { fr: 'Optionnel, pour le reçu numérique', ar: 'اختياري، لاستلام الإيصال الرقمي' },
  'e.g. sarah@example.com': { fr: 'ex. sarah@exemple.com', ar: 'مثال: sarah@example.com' },
  'special notes / instructions': { fr: 'Instructions spéciales / Remarques', ar: 'ملاحظات أو تعليمات خاصة' },
  'any dietary restrictions, gate codes, or delivery instructions...': { fr: 'Restrictions alimentaires, code d\'accès, instructions de livraison...', ar: 'أي قيود غذائية، رموز البوابة، أو تعليمات التوصيل...' },
  'back to review': { fr: 'Retour au récapitulatif', ar: 'العودة إلى المراجعة' },
  'continue to fulfillment': { fr: 'Continuer vers la livraison', ar: 'المتابعة إلى الاستلام' },

  // Review Step
  'review your cart': { fr: 'Récapitulatif de votre panier', ar: 'مراجعة سلتك' },
  'your cart is empty.': { fr: 'Votre panier est vide.', ar: 'سلة التسوق فارغة.' },
  'clear': { fr: 'Vider', ar: 'مسح السلة' },

  // Payment Step
  'payment & discounts': { fr: 'Paiement & Réductions', ar: 'الدفع والخصومات' },
  'select your payment method and apply any discounts or rewards.': { fr: 'Sélectionnez votre mode de paiement et appliquez vos remises.', ar: 'اختر طريقة الدفع وطبّق أي خصومات أو مكافآت.' },
  'room charge requires an active room reservation. please select cash or card, or access checkout with your room booking details.': { fr: 'Le débit sur chambre nécessite une réservation active. Veuillez choisir espèces ou carte, ou vous identifier.', ar: 'التحميل على الغرفة يتطلب حجزاً نشطاً. يرجى اختيار الدفع نقداً أو بالبطاقة، أو تسجيل بيانات الغرفة.' },
  'promotions & rewards': { fr: 'Promotions & Récompenses', ar: 'العروض والمكافآت' },
  'order total': { fr: 'Total de la commande', ar: 'إجمالي الطلب' },
  'calculating authoritative pricing...': { fr: 'Calcul du prix faisant foi...', ar: 'جاري احتساب السعر الرسمي...' },
  'pricing unavailable. please try again.': { fr: 'Tarification indisponible. Veuillez réessayer.', ar: 'السعر غير متوفر حالياً. يرجى المحاولة مرة أخرى.' },
  'subtotal': { fr: 'Sous-total', ar: 'المجموع الفرعي' },
  'delivery fee': { fr: 'Frais de livraison', ar: 'رسوم التوصيل' },
  'discounts': { fr: 'Réductions', ar: 'الخصومات' },
  'total to pay': { fr: 'Total à régler', ar: 'المبلغ الإجمالي المستحق' },
  'pay with stripe': { fr: 'Payer par carte (Stripe)', ar: 'الدفع بالبطاقة (Stripe)' },
  'placing order...': { fr: 'Validation de la commande...', ar: 'جاري تسجيل الطلب...' },
  'place order': { fr: 'Confirmer la commande', ar: 'تأكيد وإتمام الطلب' },
  'payment failed. please try again or select another method.': { fr: 'Échec du paiement. Veuillez réessayer ou choisir un autre moyen.', ar: 'فشل الدفع. يرجى المحاولة مرة أخرى أو اختيار طريقة دفع بديلة.' },
  'retry payment': { fr: 'Réessayer le paiement', ar: 'إعادة محاولة الدفع' },

  // Confirmation Step
  'order confirmed!': { fr: 'Commande confirmée !', ar: 'تم تأكيد طلبك بنجاح!' },
  'reference id:': { fr: 'Référence :', ar: 'رقم المرجع:' },
  'fulfillment details': { fr: 'Détails de livraison', ar: 'تفاصيل الاستلام والتوصيل' },
  'view full order details': { fr: 'Voir tous les détails de la commande', ar: 'عرض تفاصيل الطلب كاملة' },

  // Catalog & Components
  'add to cart': { fr: 'Ajouter au panier', ar: 'أضف إلى السلة' },
  'no items available in this category': { fr: 'Aucun article disponible dans cette catégorie', ar: 'لا توجد عناصر متوفرة في هذه الفئة' },
  'cookie policy': { fr: 'Politique relative aux cookies', ar: 'سياسة ملفات تعريف الارتباط' },
  'get started': { fr: 'Commencer', ar: 'ابدأ الآن' },
  'discover our services': { fr: 'Découvrez nos services', ar: 'اكتشف خدماتنا' },
};

function resolveTranslation(text, lang) {
  const normalized = text.toLowerCase().trim();
  if (KNOWN_TRANSLATIONS[normalized] && KNOWN_TRANSLATIONS[normalized][lang]) {
    return KNOWN_TRANSLATIONS[normalized][lang];
  }
  return text;
}

function commandAutofix(targetPath, options = {}) {
  const namespace = options.namespace || 'checkout';
  const files = getTsxFiles(targetPath);

  if (files.length === 0) {
    log(`❌ No files found to autofix at ${targetPath}`, 'red');
    return 1;
  }

  log(`\n🛠️  Autofixing i18n for ${files.length} file(s) under namespace "${namespace}"...\n`, 'bold');

  // Load message files
  const enPath = path.join(MESSAGES_DIR, 'en.json');
  const arPath = path.join(MESSAGES_DIR, 'ar.json');
  const frPath = path.join(MESSAGES_DIR, 'fr.json');

  const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const arData = JSON.parse(fs.readFileSync(arPath, 'utf8'));
  const frData = JSON.parse(fs.readFileSync(frPath, 'utf8'));

  if (!enData[namespace]) enData[namespace] = {};
  if (!arData[namespace]) arData[namespace] = {};
  if (!frData[namespace]) frData[namespace] = {};

  let modifiedFilesCount = 0;
  let totalReplacements = 0;

  for (const filePath of files) {
    const originalContent = fs.readFileSync(filePath, 'utf8');
    const findings = scanSourceFile(filePath, originalContent);

    if (findings.length === 0) continue;

    log(`📄 Processing ${path.relative(process.cwd(), filePath)} (${findings.length} literals)...`, 'cyan');

    // Sort findings descending by start offset so bottom replacements don't invalidate earlier offsets
    findings.sort((a, b) => b.start - a.start);

    let updatedContent = originalContent;

    for (const f of findings) {
      const text = f.text;
      const keyName = toCamelCase(text);
      if (!keyName) continue;

      // Register key in dictionaries if not exists
      if (!enData[namespace][keyName]) {
        enData[namespace][keyName] = text;
        arData[namespace][keyName] = resolveTranslation(text, 'ar');
        frData[namespace][keyName] = resolveTranslation(text, 'fr');
      }

      // Replace in content
      const before = updatedContent.slice(0, f.start);
      const after = updatedContent.slice(f.end);

      let replacement = '';
      if (f.type === 'jsx-text') {
        replacement = `{t('${keyName}')}`;
      } else if (f.type === 'jsx-attribute') {
        replacement = `{t('${keyName}')}`;
      }

      updatedContent = before + replacement + after;
      totalReplacements++;
    }

    // Ensure import { useTranslations } from 'next-intl'; is present
    if (!updatedContent.includes("from 'next-intl'") && !updatedContent.includes('from "next-intl"')) {
      if (updatedContent.startsWith("'use client';") || updatedContent.startsWith('"use client";')) {
        const clientLineEnd = updatedContent.indexOf('\n') + 1;
        updatedContent =
          updatedContent.slice(0, clientLineEnd) +
          "import { useTranslations } from 'next-intl';\n" +
          updatedContent.slice(clientLineEnd);
      } else {
        updatedContent = "import { useTranslations } from 'next-intl';\n" + updatedContent;
      }
    }

    // Ensure const t = useTranslations('...'); is present in the main component
    if (!updatedContent.includes(`useTranslations(`)) {
      const match = updatedContent.match(/(export\s+default\s+function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)/);
      if (match) {
        const insertPos = updatedContent.indexOf(match[0]) + match[0].length;
        updatedContent =
          updatedContent.slice(0, insertPos) +
          `\n  const t = useTranslations('${namespace}');` +
          updatedContent.slice(insertPos);
      }
    }

    fs.writeFileSync(filePath, updatedContent, 'utf8');
    modifiedFilesCount++;
  }

  // Save updated dictionary files
  fs.writeFileSync(enPath, JSON.stringify(enData, null, 2) + '\n', 'utf8');
  fs.writeFileSync(arPath, JSON.stringify(arData, null, 2) + '\n', 'utf8');
  fs.writeFileSync(frPath, JSON.stringify(frData, null, 2) + '\n', 'utf8');

  log(`\n✅ Autofix complete!`, 'green');
  log(`   - Modified ${modifiedFilesCount} file(s)`);
  log(`   - Replaced ${totalReplacements} hardcoded literal(s)`);
  log(`   - Synchronized en.json, ar.json, and fr.json with namespace "${namespace}".\n`, 'green');

  return 0;
}

// ─── CLI Entrypoint ───────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'scan';

  if (command === 'check-parity') {
    const code = commandCheckParity();
    process.exit(code);
  }

  if (command === 'scan') {
    const paths = args.slice(1).filter((a) => !a.startsWith('--'));
    const isCI = args.includes('--ci');
    const isJson = args.includes('--json');
    const code = commandScan(paths, { ci: isCI, json: isJson });
    process.exit(code);
  }

  if (command === 'autofix') {
    const targetPath = args[1] && !args[1].startsWith('--') ? args[1] : null;
    if (!targetPath) {
      log('❌ Please specify a file or directory: node scripts/i18n-tool.cjs autofix <path> [--namespace=name]', 'red');
      process.exit(1);
    }
    const nsArg = args.find((a) => a.startsWith('--namespace='));
    const namespace = nsArg ? nsArg.split('=')[1] : 'checkout';
    const code = commandAutofix(targetPath, { namespace });
    process.exit(code);
  }

  log(`Unknown command: ${command}`, 'red');
  log('Available commands: scan, autofix, check-parity');
  process.exit(1);
}

main();
