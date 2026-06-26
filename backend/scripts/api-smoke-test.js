#!/usr/bin/env node

/**
 * Automated API Smoke Test
 *
 * This script automatically discovers all GET endpoints in your Express app
 * and tests them to ensure they don't return 500 errors (server crashes).
 *
 * Usage:
 *   node scripts/api-smoke-test.js
 */

console.log('🚀 Starting API Smoke Test...\n');

// Load environment variables
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.CSRF_BYPASS_IN_TESTS = 'true';

// Disable Morgan logging for the test
process.env.NODE_ENV = 'test';

console.log('📦 Loading Express app...\n');

// Import dependencies
const listEndpoints = require('express-list-endpoints');
const request = require('supertest');

// Import our app
const { createApp } = require('../dist/app.js');

async function runSmokeTest() {
  try {
    // Create the app
    const app = await createApp();
    
    // Get all endpoints
    const allEndpoints = listEndpoints(app);
    console.log(`✅ Found ${allEndpoints.length} total endpoints\n`);
    
    // Filter for only GET endpoints
    const getEndpoints = allEndpoints.filter(endpoint =>
      endpoint.methods.includes('GET')
    );
    console.log(`🤖 Testing ${getEndpoints.length} GET endpoints...\n`);
    
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const crashEndpoints = [];
    
    // Test each endpoint
    for (const endpoint of getEndpoints) {
      const rawPath = endpoint.path;
      
      // Skip dynamic parameterized routes for now
      if (rawPath.includes(':')) {
        console.log(`⏭️  Skipping dynamic route: GET ${rawPath}`);
        skipped++;
        continue;
      }
      
      console.log(`🧪 Testing: GET ${rawPath}`);
      
      try {
        const response = await request(app).get(rawPath);
        
        if (response.status === 500) {
          console.error(`❌ CRASH DETECTED! GET ${rawPath} returned 500`);
          console.error(`   Response:`, JSON.stringify(response.body || response.text, null, 2));
          crashEndpoints.push({ path: rawPath, status: 500, response: response.body || response.text });
          failed++;
        } else {
          console.log(`✅ GET ${rawPath} returned ${response.status} (ok)`);
          passed++;
        }
      } catch (error) {
        console.error(`❌ Error testing GET ${rawPath}:`, error.message);
        crashEndpoints.push({ path: rawPath, error: error.message });
        failed++;
      }
      
      console.log('');
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 Smoke Test Summary:');
    console.log(`   Total GET endpoints: ${getEndpoints.length}`);
    console.log(`   Passed (no 500):    ${passed}`);
    console.log(`   Failed (500 crash):  ${failed}`);
    console.log(`   Skipped (dynamic):   ${skipped}`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (crashEndpoints.length > 0) {
      console.log('\n❌ Endpoints that crashed (500 errors):');
      crashEndpoints.forEach((ep, i) => {
        console.log(`   ${i + 1}. GET ${ep.path}`);
        if (ep.response) {
          console.log(`      Details:`, JSON.stringify(ep.response, null, 6));
        }
        if (ep.error) {
          console.log(`      Error:`, ep.error);
        }
      });
      process.exit(1);
    } else {
      console.log('\n✅ All safe endpoints passed! No crashes detected.');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Failed to run smoke test:', error);
    process.exit(1);
  }
}

// Check if we need to build first
const fs = require('fs');
if (!fs.existsSync(path.resolve(__dirname, '../dist/app.js'))) {
  console.log('⚠️  dist/app.js not found. Building first...\n');
  
  const { execSync } = require('child_process');
  try {
    execSync('npm run build', { 
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit'
    });
    console.log('\n✅ Build complete! Running smoke test...\n');
  } catch (buildError) {
    console.error('❌ Build failed:', buildError);
    process.exit(1);
  }
}

// Run the test
runSmokeTest();
