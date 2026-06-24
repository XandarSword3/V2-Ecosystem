const fs = require('fs');
const path = require('path');

const MAPPINGS = [
    // === 1. UPPER_SNAKE_CASE CONSTANTS & EVENTS ===
    { find: /\bCHALET_BOOKED\b/g, replace: 'ACCOMMODATION_UNIT_BOOKED', desc: 'Event: CHALET_BOOKED' },
    { find: /\bCHALET_CREATED\b/g, replace: 'ACCOMMODATION_UNIT_CREATED', desc: 'Event: CHALET_CREATED' },
    { find: /\bCHALET_UPDATED\b/g, replace: 'ACCOMMODATION_UNIT_UPDATED', desc: 'Event: CHALET_UPDATED' },
    { find: /\bCHALET_CHECKED_IN\b/g, replace: 'ACCOMMODATION_UNIT_CHECKED_IN', desc: 'Event: CHALET_CHECKED_IN' },
    { find: /\bCHALET_CHECKED_OUT\b/g, replace: 'ACCOMMODATION_UNIT_CHECKED_OUT', desc: 'Event: CHALET_CHECKED_OUT' },
    { find: /\bSNACK_ORDER_PLACED\b/g, replace: 'KIOSK_ORDER_PLACED', desc: 'Event: SNACK_ORDER_PLACED' },
    { find: /\bSNACK_ORDER_DELIVERED\b/g, replace: 'KIOSK_ORDER_DELIVERED', desc: 'Event: SNACK_ORDER_DELIVERED' },
    { find: /\bSNACK_ORDER_PREPARED\b/g, replace: 'KIOSK_ORDER_PREPARED', desc: 'Event: SNACK_ORDER_PREPARED' },
    { find: /\bPOOL_BRACELET_ISSUED\b/g, replace: 'CAPACITY_ACCESS_ISSUED', desc: 'Event: POOL_BRACELET_ISSUED' },
    { find: /\bPOOL_BRACELET_RETURNS\b/g, replace: 'CAPACITY_ACCESS_RETURNED', desc: 'Event: POOL_BRACELET_RETURNED' },
    { find: /\bRESTAURANT_RESERVATION_MADE\b/g, replace: 'MENU_RESERVATION_MADE', desc: 'Event: RESTAURANT_RESERVATION_MADE' },

    // === 2. PASCALCASE CLASSES, FACTORIES & TYPES ===
    { find: /\bFactoryChaletBooking\b/g, replace: 'FactoryUnitBooking', desc: 'Class: FactoryChaletBooking' },
    { find: /\bFactoryChalet\b/g, replace: 'FactoryAccommodationUnit', desc: 'Class: FactoryChalet' },
    { find: /\bFactoryPoolSession\b/g, replace: 'FactoryCapacityWindow', desc: 'Class: FactoryPoolSession' },
    { find: /\bFactoryPoolTicket\b/g, replace: 'FactoryCapacityTicket', desc: 'Class: FactoryPoolTicket' },
    { find: /\bFactoryRestaurantOrder\b/g, replace: 'FactoryMenuServiceOrder', desc: 'Class: FactoryRestaurantOrder' },
    { find: /\bRestaurantOrder\b/g, replace: 'MenuServiceOrder', desc: 'Class: RestaurantOrder' },
    { find: /\bRestaurantMenuItem\b/g, replace: 'CatalogItem', desc: 'Class: RestaurantMenuItem' },
    { find: /\bPoolController\b/g, replace: 'CapacityController', desc: 'Class: PoolController' },
    { find: /\bInMemoryPoolRepository\b/g, replace: 'InMemoryCapacityRepository', desc: 'Class: InMemoryPoolRepository' },
    { find: /\bInMemoryChaletRepository\b/g, replace: 'InMemoryAccommodationRepository', desc: 'Class: InMemoryChaletRepository' },
    { find: /\bInMemoryRestaurantRepository\b/g, replace: 'InMemoryMenuServiceRepository', desc: 'Class: InMemoryRestaurantRepository' },
    { find: /\bChaletAdminBot\b/g, replace: 'AccommodationAdminBot', desc: 'Class: ChaletAdminBot' },
    { find: /\bSnackBarAdminBot\b/g, replace: 'KioskAdminBot', desc: 'Class: SnackBarAdminBot' },
    { find: /\bChalet\b/g, replace: 'AccommodationUnit', desc: 'Type: Chalet' },
    { find: /\bChalets\b/g, replace: 'AccommodationUnits', desc: 'Type: Chalets' },
    { find: /\bRestaurant\b/g, replace: 'MenuService', desc: 'Type: Restaurant' },
    { find: /\bRestaurants\b/g, replace: 'MenuServices', desc: 'Type: Restaurants' },
    { find: /\bSnack\b/g, replace: 'KioskItem', desc: 'Type: Snack' },
    { find: /\bSnacks\b/g, replace: 'KioskItems', desc: 'Type: Snacks' },

    // === 3. SNAKE_CASE DATABASE IDENTIFIERS ===
    { find: /\bchalet_id\b/g, replace: 'unit_id', desc: 'Key: chalet_id -> unit_id' },
    { find: /\brestaurant_id\b/g, replace: 'menu_service_id', desc: 'Key: restaurant_id' },
    { find: /\bsnack_id\b/g, replace: 'kiosk_id', desc: 'Key: snack_id' },
    { find: /\bpool_ticket\b/g, replace: 'capacity_ticket', desc: 'Key: pool_ticket' },
    { find: /\brestaurant_order\b/g, replace: 'menu_service_order', desc: 'Key: restaurant_order' },
    { find: /\brestaurant_orders\b/g, replace: 'menu_service_orders', desc: 'Key: restaurant_orders' },
    { find: /\bsnack_order\b/g, replace: 'kiosk_order', desc: 'Key: snack_order' },
    { find: /\bsnack_orders\b/g, replace: 'kiosk_orders', desc: 'Key: snack_orders' },

    // === 4. camelCase VARIABLES, IDENTIFIERS & MOCKS ===
    { find: /\bchaletId\b/g, replace: 'unitId', desc: 'Var: chaletId -> unitId' },
    { find: /\bchaletAId\b/g, replace: 'unitAId', desc: 'Var: chaletAId' },
    { find: /\bchaletBId\b/g, replace: 'unitBId', desc: 'Var: chaletBId' },
    { find: /\bchaletCId\b/g, replace: 'unitCId', desc: 'Var: chaletCId' },
    { find: /\btestChaletId\b/g, replace: 'testUnitId', desc: 'Var: testChaletId' },
    { find: /\bchaletBookingId\b/g, replace: 'unitBookingId', desc: 'Var: chaletBookingId' },
    { find: /\bpoolTicketId\b/g, replace: 'capacityTicketId', desc: 'Var: poolTicketId' },
    { find: /\bsnackOrderId\b/g, replace: 'kioskOrderId', desc: 'Var: snackOrderId' },
    { find: /\brestaurantModuleId\b/g, replace: 'menuServiceModuleId', desc: 'Var: restaurantModuleId' },
    { find: /\bpoolModuleId\b/g, replace: 'capacityModuleId', desc: 'Var: poolModuleId' },
    { find: /\bsnackModuleId\b/g, replace: 'kioskModuleId', desc: 'Var: snackModuleId' },
    { find: /\bchaletsModuleId\b/g, replace: 'accommodationModuleId', desc: 'Var: chaletsModuleId' },
    { find: /\bmockPoolService\b/g, replace: 'mockCapacityService', desc: 'Mock: mockPoolService' },
    { find: /\bmockChalets\b/g, replace: 'mockAccommodationUnits', desc: 'Mock: mockChalets' },
    { find: /\bmockChaletSettings\b/g, replace: 'mockAccommodationSettings', desc: 'Mock: mockChaletSettings' },
    { find: /\bmockChaletPriceRules\b/g, replace: 'mockAccommodationPriceRules', desc: 'Mock: mockChaletPriceRules' },
    { find: /\bchaletRepository\b/g, replace: 'accommodationRepository', desc: 'Repo: chaletRepository' },
    { find: /\brestaurantRepository\b/g, replace: 'menuServiceRepository', desc: 'Repo: restaurantRepository' },

    // === 5. DESCRIPTIVE ACTIONS & LABELS ===
    { find: /\bbuildChalet\b/g, replace: 'buildAccommodationUnit', desc: 'Fn: buildChalet' },
    { find: /\bcreateChalet\b/g, replace: 'createAccommodationUnit', desc: 'Fn: createChalet' },
    { find: /\bgetChalets\b/g, replace: 'getAccommodationUnits', desc: 'Fn: getChalets' },
    { find: /\bgetChaletSettings\b/g, replace: 'getAccommodationSettings', desc: 'Fn: getChaletSettings' },
    { find: /\bupdateChaletSettings\b/g, replace: 'updateAccommodationSettings', desc: 'Fn: updateChaletSettings' },
    { find: /\bgetChaletAvailability\b/g, replace: 'getAccommodationAvailability', desc: 'Fn: getChaletAvailability' },
    { find: /\bgetPoolSessions\b/g, replace: 'getCapacityWindows', desc: 'Fn: getPoolSessions' },
    { find: /\bpurchasePoolTicket\b/g, replace: 'purchaseCapacityTicket', desc: 'Fn: purchasePoolTicket' },
    { find: /\bvalidatePoolTicket\b/g, replace: 'validateCapacityTicket', desc: 'Fn: validatePoolTicket' },
    { find: /\bexpirePoolTickets\b/g, replace: 'expireCapacityTickets', desc: 'Fn: expirePoolTickets' },
    { find: /\bgetPoolTicket\b/g, replace: 'getCapacityTicket', desc: 'Fn: getPoolTicket' },
    { find: /\bgetRestaurantOrder\b/g, replace: 'getMenuServiceOrder', desc: 'Fn: getRestaurantOrder' },
    { find: /\bchaletStaffToken\b/g, replace: 'accommodationStaffToken', desc: 'Token: chaletStaffToken' },
    { find: /\bpoolStaffToken\b/g, replace: 'capacityStaffToken', desc: 'Token: poolStaffToken' },
    { find: /\bchaletStaff\b/g, replace: 'accommodationStaff', desc: 'Object: chaletStaff' },
    { find: /\bpoolStaff\b/g, replace: 'capacityStaff', desc: 'Object: poolStaff' },
    { find: /\bchaletCard\b/g, replace: 'unitCard', desc: 'UI: chaletCard' },
    { find: /\bchaletCards\b/g, replace: 'unitCards', desc: 'UI: chaletCards' }
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
        } else if (stat.isFile() && /\.(ts|tsx|js|jsx|json)$/.test(item)) {
            processFile(fullPath);
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

(function execute() {
    console.log(`====================================================================`);
    console.log(` V2 ECOSYSTEM: TARGETED TOKEN REFACTOR PIPELINE (V2)`);
    console.log(`====================================================================`);
    console.log(`Execution Mode: ${IS_DRY_RUN ? '🔍 DRY RUN (Safe Scan)' : '⚡ APPLY MODE (Disk Writes)'}`);
    console.log(`--------------------------------------------------------------------`);

    TARGET_DIRS.forEach(dir => walkDirectory(dir));

    console.log(`\n--------------------------------------------------------------------`);
    console.log(`EXECUTION SUMMARY`);
    console.log(`--------------------------------------------------------------------`);
    console.log(`Total Files Impacted        : ${totalFilesMatched}`);
    console.log(`Total Token Realignments    : ${totalChangesCount}`);
    
    if (IS_DRY_RUN && totalChangesCount > 0) {
        console.log(`\n👉 Run with write access to execute changes:`);
        console.log(`   node scripts/refactor-tokens-v2.js --apply\n`);
    }
})();