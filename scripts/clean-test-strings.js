const fs = require('fs');
const path = require('path');

// Target natural language phrases and loose words inside test blocks/comments
const BARE_WORD_MAPPINGS = [
    { find: /\bchalets\b/g, replace: 'accommodation units' },
    { find: /\bchalet\b/g, replace: 'accommodation unit' },
    { find: /\bChalets\b/g, replace: 'Accommodation Units' },
    { find: /\bChalet\b/g, replace: 'Accommodation Unit' },
    
    { find: /\brestaurants\b/g, replace: 'menu services' },
    { find: /\brestaurant\b/g, replace: 'menu service' },
    { find: /\bRestaurants\b/g, replace: 'Menu Services' },
    { find: /\bRestaurant\b/g, replace: 'Menu Service' },
    
    { find: /\bsnack[ _-]bars\b/gi, replace: 'kiosks' },
    { find: /\bsnack[ _-]bar\b/gi, replace: 'kiosk' },
    { find: /\bsnacks\b/g, replace: 'kiosk items' },
    { find: /\bsnack\b/g, replace: 'kiosk item' },
    { find: /\bSnacks\b/g, replace: 'Kiosk Items' },
    { find: /\bSnack\b/g, replace: 'Kiosk Item' }
];

const ARGS = process.argv.slice(2);
const IS_DRY_RUN = !ARGS.includes('--apply');

const TARGET_DIRS = [
    './tests',
    './backend/tests',
    './frontend/tests'
].map(p => path.resolve(process.cwd(), p));

let totalFilesMatched = 0;
let totalChangesCount = 0;

function walkDirectory(currentPath) {
    if (!fs.existsSync(currentPath)) return;
    const items = fs.readdirSync(currentPath);

    for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (item === 'phase3' || item === 'node_modules' || item === '.git') continue;
            walkDirectory(fullPath);
        } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(item)) {
            processFile(fullPath);
        }
    }
}

function processFile(filePath) {
    const originalContent = fs.readFileSync(filePath, 'utf8');
    let updatedContent = originalContent;
    let fileHits = 0;

    for (const mapping of BARE_WORD_MAPPINGS) {
        if (mapping.find.test(updatedContent)) {
            const matchCount = (updatedContent.match(mapping.find) || []).length;
            updatedContent = updatedContent.replace(mapping.find, mapping.replace);
            fileHits += matchCount;
        }
    }

    if (updatedContent !== originalContent) {
        totalFilesMatched++;
        totalChangesCount += fileHits;
        const relativePath = path.relative(process.cwd(), filePath);
        
        console.log(`[${IS_DRY_RUN ? 'DRY-RUN' : 'CLEANED'}] ${relativePath} (${fileHits} text hits)`);

        if (!IS_DRY_RUN) {
            fs.writeFileSync(filePath, updatedContent, 'utf8');
        }
    }
}

console.log(`================════════════════════════════════════════════════════`);
console.log(`               V2 ECOSYSTEM: BARE-WORD STRING PURGE                 `);
console.log(`================════════════════════════════════════════════════════`);
console.log(`Execution Mode: ${IS_DRY_RUN ? '🔍 DRY RUN' : '⚡ APPLY MODE'}\n`);

TARGET_DIRS.forEach(dir => walkDirectory(dir));

console.log(`\n--------------------------------------------------------------------`);
console.log(`Scan Summary: Found ${totalChangesCount} bare words across ${totalFilesMatched} test files.`);
if (IS_DRY_RUN && totalChangesCount > 0) {
    console.log(`\nExecute the following command to apply the string updates directly:`);
    console.log(`   node scripts/clean-test-strings.js --apply`);
}