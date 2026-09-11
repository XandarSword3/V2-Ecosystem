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

  // Coupons & Discounts
  '% off': { fr: '% de réduction', ar: 'خصم %' },
  'off': { fr: 'de réduction', ar: 'خصم' },
  'you save': { fr: 'Vous économisez', ar: 'توفر' },
  'enter coupon code': { fr: 'Entrez le code promo', ar: 'أدخل رمز الكوبون' },
  'did you mean:': { fr: 'Vouliez-vous dire :', ar: 'هل تقصد:' },
  'available coupons': { fr: 'Coupons disponibles', ar: 'الكوبونات المتاحة' },

  // Gift Cards
  'send a gift card': { fr: 'Offrir une carte-cadeau', ar: 'إرسال بطاقة هدية' },
  'choose an amount or create a custom gift': { fr: 'Choisissez un montant ou personnalisez votre cadeau', ar: 'اختر مبلغاً أو حدد هدية مخصصة' },
  'or enter a custom amount': { fr: 'Ou entrez un montant personnalisé', ar: 'أو أدخل مبلغاً مخصصاً' },
  'continue': { fr: 'Continuer', ar: 'متابعة' },
  'minimum': { fr: 'Minimum', ar: 'الحد الأدنى' },
  ', maximum': { fr: ', Maximum', ar: '، الحد الأقصى' },
  'gift card': { fr: 'Carte-cadeau', ar: 'بطاقة هدية' },
  'your name *': { fr: 'Votre nom *', ar: 'اسمك *' },
  'your name (will appear on card)': { fr: 'Votre nom (apparaîtra sur la carte)', ar: 'اسمك (سيظهر على البطاقة)' },
  "recipient's name": { fr: 'Nom du destinataire', ar: 'اسم المستلم' },
  'who is this gift for?': { fr: 'À qui est destiné ce cadeau ?', ar: 'لمن هذه الهدية؟' },
  "recipient's email *": { fr: 'Email du destinataire *', ar: 'البريد الإلكتروني للمستلم *' },
  'where should we send the gift card?': { fr: 'Où devons-nous envoyer la carte-cadeau ?', ar: 'أين نرسل بطاقة الهدية؟' },
  'personal message (optional)': { fr: 'Message personnalisé (optionnel)', ar: 'رسالة شخصية (اختياري)' },
  'add a personal message...': { fr: 'Ajoutez un message personnel...', ar: 'أضف رسالة شخصية...' },
  'back': { fr: 'Retour', ar: 'رجوع' },
  'processing...': { fr: 'Traitement en cours...', ar: 'جاري المعالجة...' },
  'purchase': { fr: 'Acheter', ar: 'شراء' },
  'check gift card balance': { fr: 'Consulter le solde de la carte', ar: 'التحقق من رصيد بطاقة الهدية' },
  'enter gift card code': { fr: 'Entrez le code de la carte-cadeau', ar: 'أدخل رمز بطاقة الهدية' },
  'available balance': { fr: 'Solde disponible', ar: 'الرصيد المتاح' },
  'expires:': { fr: 'Expire le :', ar: 'تاريخ الانتهاء:' },

  // Loyalty
  'pts': { fr: 'pts', ar: 'نقطة' },
  'loyalty program': { fr: 'Programme de fidélité', ar: 'برنامج الولاء' },
  'available points': { fr: 'Points disponibles', ar: 'النقاط المتاحة' },
  'x points on all purchases': { fr: 'x points sur tous les achats', ar: 'ضعف النقاط على جميع المشتريات' },
  'progress to': { fr: 'Progression vers', ar: 'التقدم نحو' },
  'pts needed': { fr: 'pts requis', ar: 'نقطة متبقية' },
  'total earned': { fr: 'Total cumulé', ar: 'إجمالي المكتسب' },
  'total redeemed': { fr: 'Total utilisé', ar: 'إجمالي المستبدل' },
  'your benefits': { fr: 'Vos avantages', ar: 'مزاياك' },
  'view full details': { fr: 'Voir tous les détails', ar: 'عرض كافة التفاصيل' },
  'earn': { fr: 'Gagnez', ar: 'اكسب' },
  'loyalty points': { fr: 'points de fidélité', ar: 'نقاط ولاء' },

  // Auth & Security
  'login required': { fr: 'Connexion requise', ar: 'تسجيل الدخول مطلوب' },
  'please log in to place your order. your cart will be preserved.': { fr: 'Veuillez vous connecter pour finaliser votre commande. Votre panier sera conservé.', ar: 'يرجى تسجيل الدخول لإتمام طلبك. سيتم حفظ سلتك.' },
  'email': { fr: 'Email', ar: 'البريد الإلكتروني' },
  'enter your email': { fr: 'Entrez votre email', ar: 'أدخل بريدك الإلكتروني' },
  'password': { fr: 'Mot de passe', ar: 'كلمة المرور' },
  'enter your password': { fr: 'Entrez votre mot de passe', ar: 'أدخل كلمة المرور' },
  'logging in...': { fr: 'Connexion en cours...', ar: 'جاري تسجيل الدخول...' },
  'log in': { fr: 'Se connecter', ar: 'تسجيل الدخول' },
  "don't have an account?": { fr: "Vous n'avez pas de compte ?", ar: 'ليس لديك حساب؟' },
  'sign up': { fr: 'Créer un compte', ar: 'إنشاء حساب' },
  'security verification': { fr: 'Vérification de sécurité', ar: 'التحقق الأمني' },
  'protected by turnstile': { fr: 'Protégé par Turnstile', ar: 'محمي بواسطة Turnstile' },
  'security verification is unavailable. check the turnstile site key and network access.': { fr: 'Vérification de sécurité indisponible. Vérifiez la clé du site et la connexion.', ar: 'التحقق الأمني غير متوفر. يرجى التحقق من المفتاح والاتصال بالشبكة.' },
  'loading security challenge...': { fr: 'Chargement du défi de sécurité...', ar: 'جاري تحميل التحقق الأمني...' },

  // Settings & 2FA
  'backup codes remaining': { fr: 'codes de secours restants', ar: 'رموز أمان متبقية' },
  '2fa qr code': { fr: 'Code QR 2FA', ar: 'رمز QR للتحقق بخطوتين' },
  'cancel': { fr: 'Annuler', ar: 'إلغاء' },
  'verify & enable': { fr: 'Vérifier et activer', ar: 'تأكيد وتفعيل' },
  "i've saved my codes": { fr: "J'ai enregistré mes codes", ar: 'لقد حفظت الرموز' },
  'disable 2fa': { fr: 'Désactiver la 2FA', ar: 'تعطيل التحقق بخطوتين' },
  'user preferences': { fr: 'Préférences utilisateur', ar: 'تفضيلات المستخدم' },
  'close preferences': { fr: 'Fermer les préférences', ar: 'إغلاق التفضيلات' },

  // PWA
  'a new version is available!': { fr: 'Une nouvelle version est disponible !', ar: 'تحديث جديد متوفر!' },
  'update now': { fr: 'Mettre à jour maintenant', ar: 'تحديث الآن' },
  'install this app': { fr: 'Installer cette application', ar: 'تثبيت هذا التطبيق' },
  'add to your home screen for faster access and offline support.': { fr: "Ajoutez à votre écran d'accueil pour un accès rapide et hors-ligne.", ar: 'أضف إلى الشاشة الرئيسية لسرعة الوصول والعمل دون اتصال.' },
  'install app': { fr: "Installer l'application", ar: 'تثبيت التطبيق' },
  'not now': { fr: 'Pas maintenant', ar: 'ليس الآن' },
  'enable notifications for booking updates': { fr: 'Activer les notifications pour les mises à jour', ar: 'تفعيل الإشعارات لتحديثات الحجز' },

  // Waitlist & Unit Booking
  'module not found': { fr: 'Module introuvable', ar: 'الخدمة غير موجودة' },
  'return home': { fr: "Retour à l'accueil", ar: 'العودة للرئيسية' },
  'waitlist status': { fr: "Statut de la liste d'attente", ar: 'حالة قائمة الانتظار' },
  'name': { fr: 'Nom', ar: 'الاسم' },
  'party size': { fr: 'Nombre de personnes', ar: 'عدد الأفراد' },
  'guests': { fr: 'personnes', ar: 'ضيوف' },
  'position': { fr: 'Position', ar: 'الترتيب' },
  'est. wait': { fr: 'Attente estimée', ar: 'الانتظار المتوقع' },
  'min': { fr: 'min', ar: 'دقيقة' },
  'status': { fr: 'Statut', ar: 'الحالة' },
  'refresh status': { fr: 'Actualiser le statut', ar: 'تحديث الحالة' },
  'join the waitlist': { fr: "Rejoindre la liste d'attente", ar: 'الانضمام لقائمة الانتظار' },
  'no reservation? join the waitlist for': { fr: 'Pas de réservation ? Rejoignez la liste pour', ar: 'لا يوجد حجز؟ انضم لقائمة الانتظار لـ' },
  'joining...': { fr: 'Inscription en cours...', ar: 'جاري الانضمام...' },
  'back to': { fr: 'Retour à', ar: 'العودة إلى' },
  'unit not found': { fr: 'Hébergement introuvable', ar: 'الوحدة غير موجودة' },
  'bedrooms': { fr: 'Chambres', ar: 'غرف النوم' },
  'bathrooms': { fr: 'Salles de bain', ar: 'دورات المياه' },
  'amenities': { fr: 'Équipements', ar: 'المرافق والمزايا' },
  'pricing': { fr: 'Tarifs', ar: 'الأسعار' },
  'weekday': { fr: 'En semaine', ar: 'أيام الأسبوع' },
  '/night': { fr: '/nuit', ar: '/ليلة' },
  'weekend': { fr: 'Week-end', ar: 'عطلة نهاية الأسبوع' },
  'book': { fr: 'Réserver', ar: 'حجز' },
  'check-in': { fr: 'Arrivée', ar: 'تسجيل الوصول' },
  'check-out': { fr: 'Départ', ar: 'تسجيل المغادرة' },
  'max': { fr: 'max', ar: 'الحد الأقصى' },
  'full name *': { fr: 'Nom complet *', ar: 'الاسم الكامل *' },
  'add-ons': { fr: 'Suppléments', ar: 'إضافات' },
  'night': { fr: 'nuit', ar: 'ليلة' },
  'total': { fr: 'Total', ar: 'الإجمالي' },
  'deposit:': { fr: 'Acompte :', ar: 'العربون:' },
  'payment method': { fr: 'Moyen de paiement', ar: 'طريقة الدفع' },
  'pay with cash': { fr: 'Payer en espèces', ar: 'الدفع نقداً' },
  'pay with card': { fr: 'Payer par carte', ar: 'الدفع بالبطاقة' },
  'submitting...': { fr: 'Envoi en cours...', ar: 'جاري الإرسال...' },
  'book now •': { fr: 'Réserver maintenant •', ar: 'احجز الآن •' },
  'complete payment': { fr: 'Finaliser le paiement', ar: 'إتمام الدفع' },
  'enter your card details to complete your booking': { fr: 'Entrez vos coordonnées bancaires pour finaliser votre réservation', ar: 'أدخل بيانات بطاقتك لإتمام الحجز' },

  // Staff Operations
  'dispatch': { fr: 'Expédition', ar: 'إرسال وتوزيع' },
  'waiting for hand-off, grouped by destination': { fr: 'En attente de remise, groupé par destination', ar: 'في انتظار التسليم، مجمعة حسب الوجهة' },
  'nothing waiting on dispatch': { fr: "Aucune commande en attente d'expédition", ar: 'لا توجد طلبات في انتظار التوزيع' },
  'order #': { fr: 'Commande n°', ar: 'طلب رقم' },
  'split bill': { fr: "Diviser l'addition", ar: 'تقسيم الفاتورة' },
  'no split': { fr: 'Sans division', ar: 'بدون تقسيم' },
  'equal split': { fr: 'Parts égales', ar: 'تقسيم متساوٍ' },
  'itemized': { fr: 'Par article', ar: 'حسب العناصر' },
  'split into:': { fr: 'Diviser en :', ar: 'تقسيم إلى:' },
  'parts': { fr: 'parts', ar: 'أجزاء' },
  'payment shares': { fr: 'Quotes-parts de paiement', ar: 'حصص الدفع' },
  'paid': { fr: 'Payé', ar: 'تم الدفع' },
  'pay': { fr: 'Payer', ar: 'دفع' },
  'cash': { fr: 'Espèces', ar: 'نقداً' },
  'card': { fr: 'Carte', ar: 'بطاقة' },
  'room charge': { fr: 'Facturation sur chambre', ar: 'تحميل على الغرفة' },
  'select checked-in guest / room': { fr: 'Sélectionnez un client enregistré / une chambre', ar: 'اختر نزيلاً مسجلاً / غرفة' },
  'search room number or guest name...': { fr: 'Rechercher par numéro de chambre ou nom...', ar: 'ابحث برقم الغرفة أو اسم النزيل...' },
  'searching checked-in rooms...': { fr: 'Recherche des chambres occupées...', ar: 'جاري البحث عن الغرف المسجلة...' },
  'no active checked-in rooms found': { fr: 'Aucune chambre occupée trouvée', ar: 'لم يتم العثور على غرف مشغولة' },
  'folio balance': { fr: 'Solde du compte', ar: 'رصيد الفاتورة' },
  'selected:': { fr: 'Sélectionné :', ar: 'المحدد:' },
  'total paid': { fr: 'Total réglé', ar: 'إجمالي المدفوع' },
  'remaining': { fr: 'Reste à payer', ar: 'المتبقي' },
  'complete order': { fr: 'Finaliser la commande', ar: 'إتمام الطلب' },
  'floor map': { fr: 'Plan de salle', ar: 'مخطط الصالة' },
  'manage seating, reservations, and staff assignments': { fr: 'Gérez le placement, les réservations et les affectations du personnel', ar: 'إدارة الجلوس والحجوزات وتعيينات الموظفين' },
  'walk-in': { fr: 'Client sans réservation', ar: 'نزيل بدون حجز' },
  'assigned staff': { fr: 'Personnel assigné', ar: 'الموظف المسؤول' },
  'party:': { fr: 'Groupe :', ar: 'العدد:' },
  'time:': { fr: 'Heure :', ar: 'الوقت:' },
  'check in': { fr: "Enregistrer l'arrivée", ar: 'تسجيل الحضور' },
  'reassign staff': { fr: 'Réassigner le serveur', ar: 'إعادة تعيين الموظف' },
  'free table': { fr: 'Libérer la table', ar: 'إخلاء الطاولة' },
  'select a location to view details': { fr: 'Sélectionnez un emplacement pour afficher les détails', ar: 'اختر موقعاً لعرض التفاصيل' },
  'seat walk-in': { fr: 'Installer le client', ar: 'إجلاس ضيف مباشر' },
  'select table': { fr: 'Choisir la table', ar: 'تحديد الطاولة' },
  'guest name': { fr: 'Nom du client', ar: 'اسم الضيف' },
  'guest name (e.g. john)': { fr: 'Nom du client (ex. Jean)', ar: 'اسم الضيف (مثال: أحمد)' },
  'seat': { fr: 'Installer', ar: 'إجلاس' },
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
    if (!updatedContent.includes('useTranslations')) {
      if (updatedContent.includes("from 'next-intl'") || updatedContent.includes('from "next-intl"')) {
        updatedContent = updatedContent.replace(/(import\s*\{)([^}]+)(\}\s*from\s*['"]next-intl['"])/, '$1 useTranslations, $2$3');
      } else if (updatedContent.startsWith("'use client';") || updatedContent.startsWith('"use client";')) {
        const clientLineEnd = updatedContent.indexOf('\n') + 1;
        updatedContent =
          updatedContent.slice(0, clientLineEnd) +
          "import { useTranslations } from 'next-intl';\n" +
          updatedContent.slice(clientLineEnd);
      } else {
        updatedContent = "import { useTranslations } from 'next-intl';\n" + updatedContent;
      }
    }

    // Ensure const t = useTranslations('...'); is present in any component function using t(
    const compRegex = /(export\s+(?:default\s+)?function\s+[A-Za-z0-9_]+\s*(?:<[^>]+>)?\s*\([^)]*\)\s*(?::\s*[^{]+)?\{|export\s+const\s+[A-Za-z0-9_]+\s*=\s*(?:React\.memo\()?\(?[^)]*\)?\s*(?:=>)?\s*\{)/g;
    let compMatch;
    const matches = [];
    while ((compMatch = compRegex.exec(updatedContent)) !== null) {
      matches.push({ index: compMatch.index + compMatch[0].length });
    }
    for (let i = matches.length - 1; i >= 0; i--) {
      const pos = matches[i].index;
      const sample = updatedContent.slice(pos, pos + 250);
      if (!sample.includes('useTranslations(')) {
        updatedContent =
          updatedContent.slice(0, pos) +
          `\n  const t = useTranslations('${namespace}');` +
          updatedContent.slice(pos);
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
