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
        // If it already has an extension but ends in .js, check if it was a directory
        if (relPath.endsWith('.js')) {
            const fullPath = path.resolve(path.dirname(file), dot + relPath.slice(0, -3));
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
                changed = true;
                return `${prefix} ${items} from "${dot}${relPath.slice(0, -3)}/index.js"`;
            }
            return match;
        }

        // If it has other extensions, ignore
        if (relPath.endsWith('.ts') || relPath.endsWith('.json') || relPath.endsWith('.css')) {
            return match;
        }

        // Check if it's a directory
        const fullPath = path.resolve(path.dirname(file), dot + relPath);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            changed = true;
            return `${prefix} ${items} from "${dot}${relPath}/index.js"`;
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
