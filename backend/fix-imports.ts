import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, 'src');

function walkDir(dir: string, callback: (file: string) => void) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const importRegex = /import\s+(?:[\w*\s{},]*\s+from\s+)?(['"]\.\.?\/[^'"]+)(['"])/g;

walkDir(srcDir, (filePath) => {
    if (!filePath.endsWith('.ts')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    const newContent = content.replace(importRegex, (match, p1, p2) => {
        // If it already ends in .js, leave it
        if (p1.endsWith('.js')) return match;

        // Check if it's a directory (might be importing index.js)
        // We can't easily check file existence without more logic, 
        // but NodeNext requires the extension.
        changed = true;
        return `${p1}.js${p2}`;
    });

    if (changed) {
        console.log(`Fixing: ${filePath}`);
        fs.writeFileSync(filePath, newContent, 'utf8');
    }
});
