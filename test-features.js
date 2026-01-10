/**
 * Feature Verification Test Script
 * Tests actual functionality of V2 Resort features
 */

// Use built-in fetch or require axios from backend
let axios;
try {
  axios = require('axios');
} catch (e) {
  // Fallback to fetch if axios not available
  axios = null;
}
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_RESULTS = {
  passed: [],
  failed: [],
  skipped: []
};

// Test result logger
function logTest(name, passed, details = '') {
  if (passed) {
    TEST_RESULTS.passed.push({ name, details });
    console.log(`✅ PASS: ${name}`);
  } else {
    TEST_RESULTS.failed.push({ name, details });
    console.log(`❌ FAIL: ${name} - ${details}`);
  }
}

function logSkip(name, reason) {
  TEST_RESULTS.skipped.push({ name, reason });
  console.log(`⏭️  SKIP: ${name} - ${reason}`);
}

// Test helper
async function testEndpoint(method, endpoint, data = null, expectedStatus = 200) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on any status
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return {
      success: response.status === expectedStatus,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status || 0
    };
  }
}

async function runTests() {
  console.log('🧪 Starting Feature Verification Tests\n');
  console.log(`Testing API at: ${API_URL}\n`);
  
  // Test 1: Health Check
  console.log('1. Testing Health Check Endpoint...');
  const healthCheck = await testEndpoint('GET', '/health');
  logTest('Health Check', healthCheck.success && healthCheck.status === 200, 
    `Status: ${healthCheck.status}`);
  
  // Test 2: API Health Check
  console.log('\n2. Testing API Health Check...');
  const apiHealth = await testEndpoint('GET', '/api/health');
  logTest('API Health Check', apiHealth.success && apiHealth.status === 200,
    `Status: ${apiHealth.status}`);
  
  // Test 3: Get Modules (Public)
  console.log('\n3. Testing Module Listing...');
  const modules = await testEndpoint('GET', '/api/admin/modules?activeOnly=true');
  logTest('Get Active Modules', modules.success, 
    `Status: ${modules.status}, Found: ${modules.data?.data?.length || 0} modules`);
  
  // Test 4: Get Restaurant Menu
  console.log('\n4. Testing Restaurant Menu Endpoint...');
  const menu = await testEndpoint('GET', '/api/restaurant/menu');
  logTest('Get Restaurant Menu', menu.success,
    `Status: ${menu.status}, Categories: ${menu.data?.data?.categories?.length || 0}`);
  
  // Test 5: Get Chalets
  console.log('\n5. Testing Chalets Endpoint...');
  const chalets = await testEndpoint('GET', '/api/chalets');
  logTest('Get Chalets', chalets.success,
    `Status: ${chalets.status}, Found: ${chalets.data?.data?.length || 0} chalets`);
  
  // Test 6: Get Pool Sessions
  console.log('\n6. Testing Pool Sessions Endpoint...');
  const poolSessions = await testEndpoint('GET', '/api/pool/sessions');
  logTest('Get Pool Sessions', poolSessions.success,
    `Status: ${poolSessions.status}, Found: ${poolSessions.data?.data?.length || 0} sessions`);
  
  // Test 7: Get Approved Reviews
  console.log('\n7. Testing Reviews Endpoint...');
  const reviews = await testEndpoint('GET', '/api/reviews');
  logTest('Get Approved Reviews', reviews.success,
    `Status: ${reviews.status}, Found: ${reviews.data?.data?.reviews?.length || 0} reviews`);
  
  // Test 8: Authentication (without credentials - should fail gracefully)
  console.log('\n8. Testing Authentication Protection...');
  const protectedEndpoint = await testEndpoint('GET', '/api/admin/dashboard');
  logTest('Protected Endpoint Requires Auth', protectedEndpoint.status === 401 || protectedEndpoint.status === 403,
    `Status: ${protectedEndpoint.status} (should be 401/403)`);
  
  // Test 9: CORS Headers
  console.log('\n9. Testing CORS Configuration...');
  try {
    const corsTest = await axios.options(`${API_URL}/api/health`, {
      headers: { 'Origin': 'http://localhost:3000' }
    });
    const hasCors = corsTest.headers['access-control-allow-origin'] !== undefined;
    logTest('CORS Headers Present', hasCors, 
      hasCors ? 'CORS configured' : 'CORS headers missing');
  } catch (error) {
    logTest('CORS Configuration', false, error.message);
  }
  
  // Test 10: Rate Limiting (if applicable)
  console.log('\n10. Testing Rate Limiting...');
  logSkip('Rate Limiting', 'Requires multiple rapid requests - manual test needed');
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${TEST_RESULTS.passed.length}`);
  console.log(`❌ Failed: ${TEST_RESULTS.failed.length}`);
  console.log(`⏭️  Skipped: ${TEST_RESULTS.skipped.length}`);
  
  if (TEST_RESULTS.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    TEST_RESULTS.failed.forEach(test => {
      console.log(`   - ${test.name}: ${test.details}`);
    });
  }
  
  // Save results
  const reportPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(TEST_RESULTS, null, 2));
  console.log(`\n📄 Detailed results saved to: ${reportPath}`);
  
  return TEST_RESULTS;
}

// Run if called directly
if (require.main === module) {
  runTests()
    .then(results => {
      process.exit(results.failed.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runTests, testEndpoint };
