const fs = require('fs');
const path = require('path');

const TARGET_DIRS = [
    './tests',
    './backend/tests',
    './frontend/tests'
].map(p => path.resolve(process.cwd(), p));

// Regex to capture any whole word/token containing legacy substrings
const LEGACY_TOKEN_REGEX = /\b[a-zA-Z0-9_]*(?:chalet|restaurant|pool|snack)[a-zA-Z0-9_]*\b/gi;

// Infrastructure terms to ignore to prevent noise
const IGNORE_LIST = new Set([
    'pool', 'Pool', 'PoolClient', 'pg.Pool', 'pg.PoolClient', 'pools'
]);

const tokenCounts = {};

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
            const content = fs.readFileSync(fullPath, 'utf8');
            let match;
            
            while ((match = LEGACY_TOKEN_REGEX.exec(content)) !== null) {
                const token = match[0];
                if (IGNORE_LIST.has(token)) continue;
                
                tokenCounts[token] = (tokenCounts[token] || 0) + 1;
            }
        }
    }
}

console.log('Scanning testing trees for unique legacy code tokens...');
TARGET_DIRS.forEach(dir => walkDirectory(dir));

// Group into categories for clean analysis
const sortedTokens = Object.entries(tokenCounts).sort((a, b) => b[1] - a[1]);

console.log('\n======================================================');
console.log('        DETECTED LEGACY TOKENS & PERMUTATIONS        ');
console.log('======================================================');
console.log(`Found ${Object.keys(tokenCounts).length} unique legacy code patterns:\n`);

sortedTokens.forEach(([token, count]) => {
    console.log(`  ${count.toString().padEnd(6)} x  ${token}`);
});