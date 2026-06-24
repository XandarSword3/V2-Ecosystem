const fs = require('fs');
const path = require('path');

// ==========================================
// REGISTRY OF CANONICAL SUBSTITUTION MAPPINGS
// ==========================================
const MAPPINGS = [
    // --- 1. Database Tables & Views ---
    { find: /\bmenu_items\b/g, replace: 'catalog_items', desc: 'Table: menu_items -> catalog_items' },
    { find: /\bmenu_categories\b/g, replace: 'catalog_categories', desc: 'Table: menu_categories -> catalog_categories' },
    { find: /\bpool_sessions\b/g, replace: 'capacity_windows', desc: 'Table: pool_sessions -> capacity_windows' },
    { find: /\bchalets\b/g, replace: 'accommodation_units', desc: 'Table: chalets -> accommodation_units' },
    { find: /\bchalet_bookings\b/g, replace: 'unit_bookings', desc: 'Table: chalet_bookings -> unit_bookings' },
    { find: /\bpool_tickets\b/g, replace: 'capacity_access_tickets', desc: 'Table: pool_tickets -> capacity_access_tickets' },

    // --- 2. String Slugs & Business Unit Values (Preserving Exact Quotes) ---
    { find: /(['"`])restaurant\1/g, replace: '$1menu_service$1', desc: 'Slug: "restaurant" -> "menu_service"' },
    { find: /(['"`])snack_bar\1/g, replace: '$1kiosk$1', desc: 'Slug: "snack_bar" -> "kiosk"' },
    { find: /(['"`])chalets\1/g, replace: '$1accommodation$1', desc: 'Slug: "chalets" -> "accommodation"' },
    { find: /(['"`])pool\1/g, replace: '$1capacity$1', desc: 'Slug: "pool" -> "capacity" (Bypasses pg Pool)' },

    // --- 3. Roles and Identity Access Groups ---
    { find: /\brestaurant_staff\b/g, replace: 'menu_service_staff', desc: 'Role: restaurant_staff' },
    { find: /\brestaurant_admin\b/g, replace: 'menu_service_admin', desc: 'Role: restaurant_admin' },
    { find: /\bsnack_bar_staff\b/g, replace: 'kiosk_staff', desc: 'Role: snack_bar_staff' },
    { find: /\bsnack_bar_admin\b/g, replace: 'kiosk_admin', desc: 'Role: snack_bar_admin' },
    { find: /\bchalet_staff\b/g, replace: 'accommodation_staff', desc: 'Role: chalet_staff' },
    { find: /\bchalet_admin\b/g, replace: 'accommodation_admin', desc: 'Role: chalet_admin' },
    { find: /\bpool_staff\b/g, replace: 'capacity_staff', desc: 'Role: pool_staff' },
    { find: /\bpool_admin\b/g, replace: 'capacity_admin', desc: 'Role: pool_admin' },
    { find: /\bbar_staff\b/g, replace: 'beverage_staff', desc: 'Role: bar_staff -> beverage_staff' },

    // --- 4. User Emails & Authentication Seeds ---
    { find: /\brestaurant\.admin@/g, replace: 'menu.service.admin@', desc: 'Email: restaurant.admin@' },
    { find: /\brestaurant\.staff@/g, replace: 'menu.service.staff@', desc: 'Email: restaurant.staff@' },

    // --- 5. Application Route Paths ---
    { find: /\/restaurant\//g, replace: '/\${slug}\/', desc: 'Route: /restaurant/ -> /${slug}/' },
    { find: /\/chalets\//g, replace: '/units/', desc: 'Route: /chalets/ -> /units/' }
];

// Determine Execution Mode via CLI arguments
const ARGS = process.argv.slice(2);
const IS_DRY_RUN = !ARGS.includes('--apply');

// MULTI-TARGET TEST DIRECTORIES
const TARGET_DIRS = [
    './tests',
    './backend/tests',
    './frontend/tests'
].map(p => path.resolve(process.cwd(), p));

let totalFilesMatched = 0;
let totalChangesCount = 0;

function walkDirectory(currentPath) {
    if (!fs.existsSync(currentPath)) {
        return; // Skip silently if backend/frontend test folders aren't present in this specific root setup
    }

    const items = fs.readdirSync(currentPath);

    for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // Guard against legacy targets or dependency blocks
            if (item === 'phase3' || item === 'node_modules' || item === '.git') {
                continue;
            }
            walkDirectory(fullPath);
        } else if (stat.isFile()) {
            // Scan TypeScript, JavaScript, and TSX files
            if (/\.(ts|tsx|js|jsx|json)$/.test(item)) {
                processFile(fullPath);
            }
        }
    }
}

function processFile(filePath) {
    const originalContent = fs.readFileSync(filePath, 'utf8');
    let updatedContent = originalContent;
    const fileChangesLog = [];

    for (const mapping of MAPPINGS) {
        if (mapping.find.test(updatedContent)) {
            const matchCount = (updatedContent.match(mapping.find) || []).length;
            updatedContent = updatedContent.replace(mapping.find, mapping.replace);
            fileChangesLog.push(`    [${matchCount} hits] ${mapping.desc}`);
            totalChangesCount += matchCount;
        }
    }

    if (updatedContent !== originalContent) {
        totalFilesMatched++;
        const relativePath = path.relative(process.cwd(), filePath);
        
        console.log(`\n[${IS_DRY_RUN ? 'DRY-RUN' : 'MUTATED'}] ${relativePath}`);
        fileChangesLog.forEach(logLine => console.log(logLine));

        if (!IS_DRY_RUN) {
            fs.writeFileSync(filePath, updatedContent, 'utf8');
        }
    }
}

// Execution initialization
(function execute() {
    console.log(`====================================================================`);
    console.log(` V2 ECOSYSTEM: MULTI-SECTOR TEST REFACTOR PIPELINE`);
    console.log(`====================================================================`);
    console.log(`Execution Mode: ${IS_DRY_RUN ? '🔍 DRY RUN (Read-Only Safety Inspection)' : '⚡ APPLY MODE (Direct Disk Writes)'}`);
    console.log(`--------------------------------------------------------------------`);

    TARGET_DIRS.forEach(dir => {
        if (fs.existsSync(dir)) {
            console.log(`Scanning target space: ${dir}`);
            walkDirectory(dir);
        }
    });

    console.log(`\n--------------------------------------------------------------------`);
    console.log(`EXECUTION SUMMARY`);
    console.log(`--------------------------------------------------------------------`);
    console.log(`Total Files Impacted        : ${totalFilesMatched}`);
    console.log(`Total System-wide Alignments: ${totalChangesCount}`);
    
    if (IS_DRY_RUN && totalChangesCount > 0) {
        console.log(`\n👉 Action Required: Inspect the adjustments above. If clean, run with write access:`);
        console.log(`   node scripts/refactor-tests.js --apply\n`);
    } else {
        console.log(`Execution complete.\n`);
    }
})();