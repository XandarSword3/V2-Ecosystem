/**
 * Frontend Feature Verification Test
 * Tests frontend pages and components
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, 'frontend', 'src', 'app');
const COMPONENTS_DIR = path.join(__dirname, 'frontend', 'src', 'components');

const TEST_RESULTS = {
  pages: { found: [], missing: [] },
  components: { found: [], missing: [] },
  routes: { found: [], missing: [] }
};

// Expected pages
const EXPECTED_PAGES = [
  // Guest pages
  'restaurant/page.tsx',
  'snack-bar/page.tsx',
  'chalets/page.tsx',
  'pool/page.tsx',
  'cart/page.tsx',
  'restaurant/cart/page.tsx',
  'restaurant/confirmation/page.tsx',
  'chalets/[id]/page.tsx',
  'chalets/booking-confirmation/page.tsx',
  'pool/confirmation/page.tsx',
  
  // Admin pages
  'admin/page.tsx',
  'admin/dashboard/page.tsx',
  'admin/modules/page.tsx',
  'admin/users/page.tsx',
  'admin/reports/page.tsx',
  'admin/reviews/page.tsx',
  'admin/settings/appearance/page.tsx',
  'admin/settings/footer/page.tsx',
  'admin/settings/backups/page.tsx',
  'admin/restaurant/menu/page.tsx',
  'admin/restaurant/orders/page.tsx',
  
  // Staff pages
  'staff/page.tsx',
  'staff/restaurant/page.tsx',
  'staff/pool/page.tsx',
  'staff/scanner/page.tsx',
  'staff/bookings/page.tsx'
];

// Expected components
const EXPECTED_COMPONENTS = [
  'layout/Header.tsx',  // Check in layout subdirectory
  'Footer.tsx',
  'LanguageSwitcher.tsx',
  'ThemeProvider.tsx',
  'ui/Button.tsx',
  'ui/Card.tsx',
  'ui/QRCode.tsx'
];

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function findFiles(dir, pattern, results = []) {
  if (!fs.existsSync(dir)) return results;
  
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findFiles(filePath, pattern, results);
    } else if (file.match(pattern)) {
      results.push(filePath);
    }
  });
  
  return results;
}

function runFrontendTests() {
  console.log('🧪 Starting Frontend Feature Verification\n');
  
  // Check pages
  console.log('📄 Checking Pages...');
  EXPECTED_PAGES.forEach(page => {
    const pagePath = path.join(FRONTEND_DIR, page);
    if (checkFileExists(pagePath)) {
      TEST_RESULTS.pages.found.push(page);
      console.log(`  ✅ ${page}`);
    } else {
      TEST_RESULTS.pages.missing.push(page);
      console.log(`  ❌ ${page} - NOT FOUND`);
    }
  });
  
  // Check components
  console.log('\n🧩 Checking Components...');
  EXPECTED_COMPONENTS.forEach(component => {
    const componentPath = path.join(COMPONENTS_DIR, component);
    if (checkFileExists(componentPath)) {
      TEST_RESULTS.components.found.push(component);
      console.log(`  ✅ ${component}`);
    } else {
      TEST_RESULTS.components.missing.push(component);
      console.log(`  ❌ ${component} - NOT FOUND`);
    }
  });
  
  // Find all route files
  console.log('\n🛣️  Discovering Routes...');
  const routeFiles = findFiles(FRONTEND_DIR, /page\.tsx$/);
  routeFiles.forEach(file => {
    const relativePath = path.relative(FRONTEND_DIR, file);
    TEST_RESULTS.routes.found.push(relativePath);
  });
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 FRONTEND TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Pages Found: ${TEST_RESULTS.pages.found.length}/${EXPECTED_PAGES.length}`);
  console.log(`❌ Pages Missing: ${TEST_RESULTS.pages.missing.length}`);
  console.log(`✅ Components Found: ${TEST_RESULTS.components.found.length}/${EXPECTED_COMPONENTS.length}`);
  console.log(`❌ Components Missing: ${TEST_RESULTS.components.missing.length}`);
  console.log(`🛣️  Total Routes Discovered: ${TEST_RESULTS.routes.found.length}`);
  
  if (TEST_RESULTS.pages.missing.length > 0) {
    console.log('\n❌ MISSING PAGES:');
    TEST_RESULTS.pages.missing.forEach(page => {
      console.log(`   - ${page}`);
    });
  }
  
  if (TEST_RESULTS.components.missing.length > 0) {
    console.log('\n❌ MISSING COMPONENTS:');
    TEST_RESULTS.components.missing.forEach(component => {
      console.log(`   - ${component}`);
    });
  }
  
  // Save results
  const reportPath = path.join(__dirname, 'frontend-test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(TEST_RESULTS, null, 2));
  console.log(`\n📄 Detailed results saved to: ${reportPath}`);
  
  return TEST_RESULTS;
}

if (require.main === module) {
  runFrontendTests();
}

module.exports = { runFrontendTests };
