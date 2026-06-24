const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
const IS_DRY_RUN = !ARGS.includes('--apply');

// ============================================================================
// MIGRATION CONFIGURATIONS
// ============================================================================

// 1. Live Source Code: Convert structural menu items to unified catalog items
const SOURCE_REPLACEMENTS = [
    { find: /\bcatalog_item_id\b/g, replace: 'catalog_item_id' },
    { find: /\bmenuItemId\b/g, replace: 'catalogItemId' },
    { find: /'catalog_item_id'/g, replace: "'catalog_item_id'" }
];

// 2. Backend Tests: Realign Chalet enums, cache keys, and settings blocks
const TEST_CODE_REPLACEMENTS = [
    { find: /ModuleSlug\.CHALETS/g, replace: 'ModuleSlug.ACCOMMODATION_UNITS' },
    { find: /CacheKeys\.CHALET/g, replace: 'CacheKeys.ACCOMMODATION_UNIT' },
    { find: /'chalet_add_ons'/g, replace: "'accommodation_unit_add_ons'" },
    { find: /'chalet_settings'/g, replace: "'accommodation_unit_settings'" },
    { find: /businessUnit: 'resort'/g, replace: "businessUnit: 'property'" }
];

// 3. Global Tests: Generalize physical resort branding to multi-tenant definitions
const BRANDING_REPLACEMENTS = [
    { find: /Resort Beach/g, replace: 'Property Beach' },
    { find: /@resort\.test/g, replace: '@v2-hub.test' },
    { find: /@resort\.com/g, replace: '@v2-hub.com' },
    { find: /admin@resort\.com/g, replace: 'admin@v2-hub.com' },
    { find: /business_type=resort/g, replace: 'business_type=property' },
    { find: /type: 'resort'/g, replace: "type: 'property'" },
    { find: /Azure Bay Resort/g, replace: 'Azure Bay Property' },
    { find: /Paradise Resort/g, replace: 'Paradise Property' },
    { find: /Acme Resort LLC/g, replace: 'Acme Property LLC' },
    { find: /Summit Resort/g, replace: 'Summit Property' },
    { find: /Enter your resort name/g, replace: 'Enter your property name' },
    { find: /Welcome to your resort launchpad/g, replace: 'Welcome to your property launchpad' },
    { find: /Resort Profile Info/g, replace: 'Property Profile Info' },
    { find: /Premier Resort Experience/g, replace: 'Premier Property Experience' },
    { find: /A beautiful resort/g, replace: 'A beautiful property' },
    { find: /wonderful time at your resort/g, replace: 'wonderful time at your property' },
    { find: /fully configured resort/g, replace: 'fully configured property' },
    { find: /Resort swimming pool/g, replace: 'Property swimming pool' },
    { find: /Resort Manager/g, replace: 'Property Manager' },
    { find: /My Resort/g, replace: 'My Property' },
    { find: /New Resort/g, replace: 'New Property' },
    { find: /Resort A/g, replace: 'Property A' },
    { find: /Test Resort/g, replace: 'Test Property' },
    { find: /Beach Resort/g, replace: 'Beach Property' },
    { find: /Rome Resort/g, replace: 'Rome Property' },
    { find: /Welcome to our resort/g, replace: 'Welcome to our property' },
    { find: /resortName/g, replace: 'propertyName' }
];

// ============================================================================
// CORE PROCESSING ENGINE
// ============================================================================

let totalFilesModified = 0;
let totalChangesCount = 0;

function processFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return;
    
    const originalContent = fs.readFileSync(filePath, 'utf8');
    let updatedContent = originalContent;
    let fileHits = 0;

    for (const mapping of replacements) {
        if (mapping.find.test(updatedContent)) {
            const matchCount = (updatedContent.match(mapping.find) || []).length;
            updatedContent = updatedContent.replace(mapping.find, mapping.replace);
            fileHits += matchCount;
        }
    }

    if (updatedContent !== originalContent) {
        totalFilesModified++;
        totalChangesCount += fileHits;
        const relativePath = path.relative(process.cwd(), filePath);
        
        console.log(`[${IS_DRY_RUN ? 'DRY-RUN' : 'MUTATED'}] ${relativePath} (${fileHits} changes)`);

        if (!IS_DRY_RUN) {
            fs.writeFileSync(filePath, updatedContent, 'utf8');
        }
    }
}

function walkAndApplyBranding(currentPath) {
    if (!fs.existsSync(currentPath)) return;
    const items = fs.readdirSync(currentPath);

    for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (item === 'node_modules' || item === '.git' || item === 'dist') continue;
            walkAndApplyBranding(fullPath);
        } else if (stat.isFile() && /\.(ts|tsx|js|jsx|json)$/.test(item)) {
            processFile(fullPath, BRANDING_REPLACEMENTS);
            // If it's a test file, apply chalet code corrections too
            if (fullPath.includes('test') || fullPath.includes('spec')) {
                processFile(fullPath, TEST_CODE_REPLACEMENTS);
            }
        }
    }
}

// ============================================================================
// EXECUTION FLOW
// ============================================================================

console.log(`====================================================================`);
console.log(`                 V2 ECOSYSTEM: FINAL ARCHITECTURE REFIT              `);
console.log(`====================================================================`);
console.log(`Execution Mode: ${IS_DRY_RUN ? '🔍 DRY RUN (Safe Scan)' : '⚡ APPLY MODE (Writing Files)'}\n`);

// Phase 1: Target live backend source files surfaced in audit
console.log(`Checking backend source files...`);
const targetSourceFiles = [
    './backend/src/database/schema/inventory.ts',
    './backend/src/engines/inventory-side-effects.ts',
    './backend/src/modules/admin/controllers/reports.controller.ts',
    './backend/src/modules/inventory/inventory-advanced.controller.ts',
    './backend/src/modules/inventory/inventory.controller.ts',
    './backend/src/modules/inventory/inventory.service.ts'
].map(p => path.resolve(process.cwd(), p));

targetSourceFiles.forEach(file => processFile(file, SOURCE_REPLACEMENTS));

// Phase 2: Sweep test suites for loose code tokens and legacy resort branding strings
console.log(`\nSweeping test suites for enums, mock domains, and copy branding text...`);
walkAndApplyBranding(path.resolve(process.cwd(), './tests'));
walkAndApplyBranding(path.resolve(process.cwd(), './backend/tests'));
walkAndApplyBranding(path.resolve(process.cwd(), './frontend/tests'));

console.log(`\n--------------------------------------------------------------------`);
console.log(`Refit Summary: Found ${totalChangesCount} modifications across ${totalFilesModified} targeted components.`);

if (IS_DRY_RUN && totalChangesCount > 0) {
    console.log(`\nTo execute these changes directly across your workspace, run:`);
    console.log(`   node scripts/finalize-v2-migration.js --apply`);
}