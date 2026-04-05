import fs from 'fs';
import path from 'path';

const srcDir = 'c:/Alessandro/Work/Attempts to Code/V2 Ecosystem/v2-resort/backend/src';

function walk(dir: string, callback: (file: string) => void) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walk(filePath, callback);
        } else if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
            callback(filePath);
        }
    });
}

const importRegex = /(import|export)\s+(.+?)\s+from\s+['"](\.\/|\.\.\/)(.+?)['"]/g;

walk(srcDir, (file) => {
    const content = fs.readFileSync(file, 'utf8');
    let changed = false;

    const newContent = content.replace(importRegex, (match, prefix, items, dot, relPath) => {
        // If it already has an extension, don't touch it
        if (relPath.endsWith('.js') || relPath.endsWith('.ts') || relPath.endsWith('.json') || relPath.endsWith('.css')) {
            return match;
        }

        changed = true;
        return `${prefix} ${items} from "${dot}${relPath}.js"`;
    });

    if (changed) {
        console.log(`Fixing ${file}`);
        fs.writeFileSync(file, newContent);
    }
});

console.log('Finished fixing imports.');
