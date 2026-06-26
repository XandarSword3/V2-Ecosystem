const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, 'backend', 'src');

function findFiles(dir, extensions = ['.ts', '.js']) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (stat.isFile() && extensions.includes(path.extname(item))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function fixRegexErrors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix broken regex patterns from the automated script
  const fixes = [
    // Fix (\1.metadata as any) -> (data.metadata as any) or (booking.metadata as any) etc.
    {
      pattern: /\(\\1\.metadata as any\)\?\.(\w+)/g,
      replacement: (match, field) => {
        // Try to infer the variable name from context or use a generic one
        modified = true;
        return `(metadata as any)?.${field}`;
      }
    },
    // Fix (\1.amount) -> amount
    {
      pattern: /\\1\.amount/g,
      replacement: () => {
        modified = true;
        return 'amount';
      }
    },
    // Fix (\1.id) -> id
    {
      pattern: /\\1\.id/g,
      replacement: () => {
        modified = true;
        return 'id';
      }
    },
    // Fix standalone \1. patterns
    {
      pattern: /\\1\.(\w+)/g,
      replacement: (match, field) => {
        modified = true;
        return field;
      }
    }
  ];
  
  for (const fix of fixes) {
    const newContent = content.replace(fix.pattern, fix.replacement);
    if (newContent !== content) {
      content = newContent;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
  }
  
  return modified;
}

function main() {
  console.log('🔧 Fixing broken regex patterns from automated script\n');
  
  const files = findFiles(ROOT_DIR);
  console.log(`📁 Found ${files.length} TypeScript/JavaScript files\n`);
  
  let totalFixed = 0;
  
  for (const file of files) {
    if (fixRegexErrors(file)) {
      totalFixed++;
      console.log(`  ✅ ${path.relative(ROOT_DIR, file)}`);
    }
  }
  
  console.log(`\n✅ Fixed ${totalFixed} files\n`);
}

if (require.main === module) {
  main();
}

module.exports = { fixRegexErrors, findFiles };
