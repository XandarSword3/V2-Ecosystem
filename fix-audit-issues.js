#!/usr/bin/env node

/**
 * Audit Report Fix Script
 * Automatically fixes P1, P2, and P3 issues identified in the audit report
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, 'backend', 'src');

// Fix patterns for each priority
const FIXES = {
  P1: [
    // Fix flat column reads in transactions queries - should use metadata
    {
      description: 'Fix booking_number flat column read',
      pattern: /\.select\([^)]*booking_number[^)]*\)/g,
      replacement: (match) => match.replace(/booking_number/g, 'metadata').replace(/booking_number/g, 'metadata')
    },
    {
      description: 'Fix booking_number reference to use metadata',
      pattern: /(\w+)\.booking_number/g,
      replacement: '(\\1.metadata as any)?.booking_number || \\1.id'
    },
    {
      description: 'Fix order_number reference to use metadata',
      pattern: /(\w+)\.order_number/g,
      replacement: '(\\1.metadata as any)?.order_number'
    },
    {
      description: 'Fix ticket_number reference to use metadata',
      pattern: /(\w+)\.ticket_number/g,
      replacement: '(\\1.metadata as any)?.ticket_number'
    },
    {
      description: 'Fix room_rate flat column read',
      pattern: /\.select\([^)]*room_rate[^)]*\)/g,
      replacement: (match) => match.replace(/room_rate/g, 'metadata')
    },
    {
      description: 'Fix room_rate reference to use metadata',
      pattern: /(\w+)\.room_rate/g,
      replacement: '(\\1.metadata as any)?.room_rate'
    },
    {
      description: 'Fix nights flat column read',
      pattern: /\.select\([^)]*nights[^)]*\)/g,
      replacement: (match) => match.replace(/nights/g, 'metadata')
    },
    {
      description: 'Fix nights reference to use metadata',
      pattern: /(\w+)\.nights/g,
      replacement: '(\\1.metadata as any)?.number_of_nights'
    },
    {
      description: 'Fix check_in flat column filter',
      pattern: /\.lte\('check_in'/g,
      replacement: ".filter('metadata->>check_in_date', 'lte'"
    },
    {
      description: 'Fix check_in flat column filter',
      pattern: /\.gt\('check_out'/g,
      replacement: ".filter('metadata->>check_out_date', 'gt'"
    },
    {
      description: 'Fix check_in flat column order',
      pattern: /\.order\('check_in'/g,
      replacement: ".order('metadata->>check_in_date'"
    },
    {
      description: 'Fix check_in reference to use metadata',
      pattern: /(\w+)\.check_in/g,
      replacement: '(\\1.metadata as any)?.check_in_date'
    },
    {
      description: 'Fix check_out reference to use metadata',
      pattern: /(\w+)\.check_out/g,
      replacement: '(\\1.metadata as any)?.check_out_date'
    },
    {
      description: 'Fix room_type flat column read',
      pattern: /\.select\([^)]*room_type[^)]*\)/g,
      replacement: (match) => match.replace(/room_type/g, 'metadata')
    },
    {
      description: 'Fix room_type reference to use metadata',
      pattern: /(\w+)\.room_type/g,
      replacement: '(\\1.metadata as any)?.room_type'
    },
    {
      description: 'Fix source flat column read',
      pattern: /\.select\([^)]*source[^)]*\)/g,
      replacement: (match) => match.replace(/source/g, 'metadata')
    },
    {
      description: 'Fix source reference to use metadata',
      pattern: /(\w+)\.source/g,
      replacement: '(\\1.metadata as any)?.source'
    },
    {
      description: 'Fix payment_status flat column update',
      pattern: /\.update\(\{[^}]*payment_status:[^}]*\}\)/g,
      replacement: (match) => {
        // Replace flat update with metadata update
        return match.replace(/payment_status:\s*([^,}]+)/g, 'metadata: { ...(existingTx?.metadata || {}), payment_status: $1 }');
      }
    },
    {
      description: 'Fix payment_status flat column read',
      pattern: /\.select\([^)]*payment_status[^)]*\)/g,
      replacement: (match) => match.replace(/payment_status/g, 'metadata')
    },
    {
      description: 'Fix total_amount to amount',
      pattern: /(\w+)\.total_amount/g,
      replacement: '\\1.amount'
    }
  ],
  P2: [
    // Fix reviews table column renames
    {
      description: 'Fix user_id - customer_id in reviews queries',
      pattern: /\.from\('reviews'\)[^;]*?\.eq\('user_id'/g,
      replacement: (match) => match.replace(".eq('user_id'", ".eq('customer_id'")
    },
    {
      description: 'Fix user_id - customer_id in reviews inserts',
      pattern: /\.from\('reviews'\)[^;]*?\.insert\(\{[^}]*user_id:/g,
      replacement: (match) => match.replace('user_id:', 'customer_id:')
    },
    {
      description: 'Fix comment - content in reviews',
      pattern: /comment:\s*data\.text/g,
      replacement: 'content: data.text'
    },
    {
      description: 'Fix comment - content in reviews select',
      pattern: /\.select\([^)]*comment[^)]*\)/g,
      replacement: (match) => match.replace(/comment/g, 'content')
    },
    {
      description: 'Fix comment reference in mapped data',
      pattern: /text:\s*r\.comment/g,
      replacement: 'text: r.content'
    },
    {
      description: 'Fix user_id reference in reviews mapped data',
      pattern: /usersMap\[r\.user_id\]/g,
      replacement: 'usersMap[r.customer_id]'
    },
    {
      description: 'Fix user_id in userIds mapping for reviews',
      pattern: /\.map\(\(r:\s*any\)\s*=>\s*r\.user_id\)/g,
      replacement: '.map((r: any) => r.customer_id)'
    }
  ],
  P4: [
    // Fix users table legacy column names (first_name/last_name -> full_name)
    {
      description: 'Fix first_name/last_name select to full_name',
      pattern: /\.select\([^)]*first_name[^)]*\)/g,
      replacement: (match) => match.replace(/first_name,\s*last_name/g, 'full_name').replace(/first_name/g, 'full_name')
    },
    {
      description: 'Fix first_name/last_name reference to full_name',
      pattern: /(\w+)\.first_name\s*\+\s*['"`]\s*\+\s*(\1|guest)\.last_name/g,
      replacement: '$1.full_name'
    },
    {
      description: 'Fix first_name/last_name template literal to full_name',
      pattern: /\$\{(\w+)\.first_name\}\s+\$\{(\1)\.last_name\}/g,
      replacement: '${$1.full_name}'
    },
    {
      description: 'Fix first_name/last_name concat to full_name',
      pattern: /first_name:\s*nameParts\[0\][^,]*,\s*last_name:\s*nameParts\.slice\(1\)\.join\(['"`]\s*['"`]\)/g,
      replacement: 'full_name: nameParts.join(" ")'
    },
    {
      description: 'Fix first_name update to full_name',
      pattern: /first_name:\s*['"`]Deleted['"`]/g,
      replacement: 'full_name: "Deleted User"'
    }
  ]
};

function findFiles(dir, extensions = ['.ts', '.js']) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('.git')) {
        traverse(fullPath);
      } else if (stat.isFile() && extensions.includes(path.extname(item))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function applyFixes(filePath, fixes, dryRun = false) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const appliedFixes = [];
  const changes = [];
  
  for (const fix of fixes) {
    const matches = content.match(fix.pattern);
    if (matches) {
      const newContent = content.replace(fix.pattern, fix.replacement);
      if (newContent !== content) {
        modified = true;
        appliedFixes.push(fix.description);
        changes.push({
          fix: fix.description,
          matches: matches.length,
          pattern: fix.pattern.toString()
        });
        content = newContent;
      }
    }
  }
  
  if (modified && !dryRun) {
    fs.writeFileSync(filePath, content);
  }
  
  return { modified, appliedFixes, changes, content: modified ? content : null };
}

function main() {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
  
  console.log('🔧 Audit Report Fix Script\n');
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be applied\n');
  }
  
  const files = findFiles(ROOT_DIR);
  console.log(`📁 Found ${files.length} TypeScript/JavaScript files\n`);
  
  let totalModified = 0;
  const fixSummary = {};
  const fileChanges = {};
  
  // Apply P1 fixes
  console.log('🔴 Applying P1 fixes (transactions.metadata)...');
  for (const file of files) {
    const result = applyFixes(file, FIXES.P1, dryRun);
    if (result.modified) {
      totalModified++;
      const relativePath = path.relative(ROOT_DIR, file);
      console.log(`  ✏️  ${relativePath}`);
      fileChanges[relativePath] = result.changes;
      result.appliedFixes.forEach(fix => {
        fixSummary[fix] = (fixSummary[fix] || 0) + 1;
      });
    }
  }
  
  // Apply P2 fixes
  console.log('\n🟠 Applying P2 fixes (reviews column renames)...');
  for (const file of files) {
    const result = applyFixes(file, FIXES.P2, dryRun);
    if (result.modified) {
      totalModified++;
      const relativePath = path.relative(ROOT_DIR, file);
      console.log(`  ✏️  ${relativePath}`);
      fileChanges[relativePath] = result.changes;
      result.appliedFixes.forEach(fix => {
        fixSummary[fix] = (fixSummary[fix] || 0) + 1;
      });
    }
  }
  
  // Apply P4 fixes
  console.log('\n🟡 Applying P4 fixes (users table legacy columns)...');
  for (const file of files) {
    const result = applyFixes(file, FIXES.P4, dryRun);
    if (result.modified) {
      totalModified++;
      const relativePath = path.relative(ROOT_DIR, file);
      console.log(`  ✏️  ${relativePath}`);
      if (!fileChanges[relativePath]) fileChanges[relativePath] = [];
      fileChanges[relativePath].push(...result.changes);
      result.appliedFixes.forEach(fix => {
        fixSummary[fix] = (fixSummary[fix] || 0) + 1;
      });
    }
  }
  
  console.log(`\n${dryRun ? '🔍 DRY RUN - ' : '✅ '}Would modify ${totalModified} files\n`);
  console.log('📊 Fix Summary:');
  for (const [fix, count] of Object.entries(fixSummary)) {
    console.log(`  • ${fix}: ${count} times`);
  }
  
  if (dryRun && totalModified > 0) {
    console.log('\n📝 Detailed Changes Preview:');
    for (const [filePath, changes] of Object.entries(fileChanges)) {
      console.log(`\n  📄 ${filePath}:`);
      changes.forEach(change => {
        console.log(`    • ${change.fix} (${change.matches} matches)`);
        console.log(`      Pattern: ${change.pattern}`);
      });
    }
    console.log('\n💡 To apply these changes, run without --dry-run flag');
  } else if (!dryRun) {
    console.log('\n⚠️  Please review the changes and run tests before committing.');
    console.log('📝 Some fixes may require manual adjustment (e.g., complex metadata updates).');
  }
}

if (require.main === module) {
  main();
}

module.exports = { FIXES, findFiles, applyFixes };
