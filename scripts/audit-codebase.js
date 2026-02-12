const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'docs', 'meta');
const EXCLUDES = ['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.vscode', '.idea', 'android', 'ios']; // Excluding android/ios native folders to focus on JS/TS code as requested usually, but wait, the mobile folder might have native code. User said "100% of codebase". I should keep native but exclude build artifacts.
// Revised excludes:
const IGNORE_DIRS = ['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.vscode', '.idea', '.gradle', 'app/build', 'app/build/outputs'];

// File Types for classification
const CLASSIFICATION = {
    LEGACY: /(_archive|legacy|old|deprecated)/i,
    TEST: /(\.test\.|\.spec\.|__tests__|tests\/)/i,
    CONFIG: /(\.json$|\.yml$|\.yaml$|\.config\.|Dockerfile|docker-compose|\.env)/i,
    INFRA: /(docker|nginx|k8s|terraform|infrastructure)/i,
    API: /(controllers|routes|api\/|graphql|trpc)/i,
    DOMAIN: /(services|modules\/[a-z]+\/|business|logic)/i,
    DATA: /(models|entities|migrations|schemas|types|interfaces|database)/i,
    UI: /(components|pages|views|styles|app\/[a-z]+|layout\.|page\.)/i,
    UTILS: /(utils|helpers|lib|common|shared|hooks)/i,
    CORE: /(app\.ts|index\.ts|server\.ts|main\.ts)/i
};

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        // Skip ignored directories/files
        if (IGNORE_DIRS.includes(file)) return;
        
        const fullPath = path.join(dirPath, file);
        
        try {
            if (fs.statSync(fullPath).isDirectory()) {
                arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
            } else {
                arrayOfFiles.push(fullPath);
            }
        } catch (e) {
            // Ignore access errors
        }
    });

    return arrayOfFiles;
}

function countLines(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n').length;
    } catch (e) {
        return 0;
    }
}

function classifyFile(filePath) {
    const relative = path.relative(ROOT_DIR, filePath);
    for (const [type, regex] of Object.entries(CLASSIFICATION)) {
        if (regex.test(relative)) return type;
    }
    // Fallback based on extension
    if (filePath.match(/\.(ts|js|tsx|jsx)$/)) return 'LOGIC';
    if (filePath.match(/\.(css|scss|less)$/)) return 'STYLE';
    if (filePath.match(/\.(md|txt)$/)) return 'DOCS';
    return 'OTHER';
}

function generateReport() {
    console.log('Starting full codebase audit...');
    
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const allFiles = getAllFiles(ROOT_DIR);
    console.log(`Found ${allFiles.length} files. Analyzing...`);

    const inventory = [];
    const dirStats = {};

    allFiles.forEach(file => {
        // Skip binary and media files roughly
        if (file.match(/\.(png|jpg|jpeg|ico|svg|woff|woff2|ttf|eot|pdf|zip|gz)$/i)) return;

        const loc = countLines(file);
        const type = classifyFile(file);
        const relPath = path.relative(ROOT_DIR, file);
        const dir = path.dirname(relPath);

        inventory.push({ path: relPath, loc, type, dir });

        if (!dirStats[dir]) {
            dirStats[dir] = { count: 0, loc: 0, types: {} };
        }
        dirStats[dir].count++;
        dirStats[dir].loc += loc;
        dirStats[dir].types[type] = (dirStats[dir].types[type] || 0) + 1;
    });

    // 1. Generate codebase-map.md
    const totalLOC = inventory.reduce((sum, item) => sum + item.loc, 0);
    const totalFilesIndex = inventory.length;

    let mapMd = `# 🗺️ Codebase Map & Structural Inventory\n\n`;
    mapMd += `> **Generated:** ${new Date().toISOString()}\n`;
    mapMd += `> **Total Files:** ${totalFilesIndex}\n`;
    mapMd += `> **Total LOC:** ${totalLOC}\n\n`;

    mapMd += `## 📁 Directory Breakdown\n\n`;
    mapMd += `| Directory | Files | LOC | Primary Type |\n`;
    mapMd += `|-----------|-------|-----|--------------|\n`;

    const sortedDirs = Object.entries(dirStats).sort((a,b) => b[1].loc - a[1].loc);
    
    sortedDirs.forEach(([dir, stats]) => {
        const primaryType = Object.entries(stats.types).sort((a,b) => b[1] - a[1])[0][0];
        mapMd += `| \`${dir}\` | ${stats.count} | ${stats.loc} | ${primaryType} |\n`;
    });

    mapMd += `\n## File List\n`;
    mapMd += `| Path | LOC | Ext |\n`;
    mapMd += `|---|---|---|\n`;
    
    // Add file list for the identification script to consume
    inventory.forEach(item => {
        mapMd += `| ${item.path} | ${item.loc} | ${path.extname(item.path)} |\n`;
    });

    fs.writeFileSync(path.join(OUTPUT_DIR, 'codebase-map.md'), mapMd);

    // 2. Generate file-index.md
    let indexMd = `# 🗂️ File-Level Semantic Index\n\n`;
    indexMd += `> Classification logic applied. Review for accuracy.\n\n`;
    indexMd += `| Path | LOC | Type | Classification |\n`;
    indexMd += `|------|-----|------|----------------|\n`;

    // Sort by Type then Path
    inventory.sort((a,b) => a.type.localeCompare(b.type) || a.path.localeCompare(b.path));

    inventory.forEach(item => {
        indexMd += `| \`${item.path}\` | ${item.loc} | ${path.extname(item.path)} | **${item.type}** |\n`;
    });

    fs.writeFileSync(path.join(OUTPUT_DIR, 'file-index.md'), indexMd);

    console.log(`Audit complete. Docs generated in ${OUTPUT_DIR}`);
}

generateReport();
