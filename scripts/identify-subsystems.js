const fs = require('fs');
const path = require('path');

const CODEBASE_MAP_PATH = path.join(__dirname, '../docs/meta/codebase-map.md');
const REGISTRY_PATH = path.join(__dirname, '../docs/meta/subsystem-registry.md');

// Define known structural patterns for subsystems
const SUBSYSTEM_PATTERNS = [
    { name: 'Backend Module', regex: /backend[\\/]src[\\/]modules[\\/]([^\\/]+)/ },
    { name: 'Backend Service', regex: /backend[\\/]src[\\/]services[\\/]([^\\/]+)/ },
    { name: 'Backend Lib', regex: /backend[\\/]src[\\/]lib[\\/]([^\\/]+)/ },
    { name: 'Frontend Feature', regex: /frontend[\\/]src[\\/]app[\\/]([^\\/]+)/ },
    { name: 'Frontend Component', regex: /frontend[\\/]src[\\/]components[\\/]([^\\/]+)/ },
    { name: 'Frontend Lib', regex: /frontend[\\/]src[\\/]lib[\\/]([^\\/]+)/ },
    { name: 'Frontend Store', regex: /frontend[\\/]src[\\/]store/ },
    { name: 'Mobile Feature', regex: /mobile[\\/]src[\\/]([^\\/]+)/ },
    { name: 'Shared Type', regex: /shared[\\/]types[\\/]([^\\/]+)/ },
    { name: 'Infrastructure', regex: /infrastructure[\\/]([^\\/]+)/ },
    { name: 'Tooling', regex: /tools[\\/]([^\\/]+)/ }
];

function parseCodebaseMap() {
    if (!fs.existsSync(CODEBASE_MAP_PATH)) {
        console.error("Codebase map not found.");
        return [];
    }
    
    const content = fs.readFileSync(CODEBASE_MAP_PATH, 'utf8');
    const lines = content.split('\n');
    const files = [];
    
    // Skip header
    let inTable = false;
    for (const line of lines) {
        if (line.trim().startsWith('| Path | LOC')) {
            inTable = true;
            continue;
        }
        if (inTable && line.trim().startsWith('|---')) continue;
        if (inTable && line.trim().startsWith('|')) {
            const parts = line.split('|').map(s => s.trim()).filter(s => s);
            if (parts.length >= 2) {
                // parts[0] is path (relative), parts[1] is LOC
                files.push({
                    path: parts[0],
                    loc: parseInt(parts[1], 10) || 0,
                    ext: parts[2]
                });
            }
        }
    }
    return files;
}

function groupIntoSubsystems(files) {
    const subsystems = {};

    files.forEach(file => {
        let matched = false;
        
        // Try to match against patterns
        for (const pattern of SUBSYSTEM_PATTERNS) {
            const match = file.path.match(pattern.regex);
            if (match) {
                const key = `${pattern.name}: ${match[1]}`; // e.g., "Backend Module: auth"
                if (!subsystems[key]) {
                    subsystems[key] = {
                        name: match[1],
                        type: pattern.name,
                        rootPath: match[0],
                        files: 0,
                        loc: 0,
                        filePaths: []
                    };
                }
                subsystems[key].files++;
                subsystems[key].loc += file.loc;
                subsystems[key].filePaths.push(file.path);
                matched = true;
                break;
            }
        }

        // Catch-all for significant directories that didn't match specific patterns
        if (!matched) {
            // Group by top-level directory if not matched
            // CHANGE: Split path to see if it's deeper than just root
            const parts = file.path.split(/[\\/]/);
            let key = `Other: ${parts[0]}`;
            let rootPath = parts[0];

            // If it's inside backend, frontend, mobile but didn't match a module, group deeper
            if (['backend', 'frontend', 'mobile'].includes(parts[0]) && parts.length > 2) {
                 // Group by level 2 (e.g., backend/tests, frontend/tests)
                 key = `Other: ${parts[0]}/${parts[1]}`;
                 rootPath = `${parts[0]}/${parts[1]}`;
            }

             if (!subsystems[key]) {
                    subsystems[key] = {
                        name: rootPath,
                        type: 'Other',
                        rootPath: rootPath,
                        files: 0,
                        loc: 0,
                        filePaths: []
                    };
                }
            subsystems[key].files++;
            subsystems[key].loc += file.loc;
            subsystems[key].filePaths.push(file.path);
        }
    });

    return subsystems;
}

function generateRegistry(subsystems) {
    let md = `# 📦 Subsystem Registry & Inventory\n\n`;
    md += `> **Generated:** ${new Date().toISOString()}\n`;
    md += `> **Constraint:** No READMEs to be written until this registry is approved.\n\n`;
    
    md += `## 🚨 Critical Subsystems (>1000 LOC or Architectural Impact)\n\n`;
    md += `| Subsystem | LOC | Files | Category | Path |\n`;
    md += `|-----------|-----|-------|----------|------|\n`;

    const sorted = Object.values(subsystems).sort((a, b) => b.loc - a.loc);
    
    // Sort and filter
    const critical = sorted.filter(s => s.loc >= 500 && !s.type.includes('Other')); // Adjust threshold as needed
    const others = sorted.filter(s => !critical.includes(s));

    critical.forEach(sys => {
        md += `| **${sys.name}** | ${sys.loc} | ${sys.files} | ${sys.type} | \`${sys.rootPath}\` |\n`;
    });

    md += `\n## 🧩 Other Components / Support\n\n`;
    md += `| Component | LOC | Files | Path |\n`;
    md += `|-----------|-----|-------|------|\n`;
    
    others.forEach(sys => {
        md += `| ${sys.name} | ${sys.loc} | ${sys.files} | \`${sys.rootPath}\` |\n`;
    });

    fs.writeFileSync(REGISTRY_PATH, md);
    console.log(`Registry generated at ${REGISTRY_PATH}`);
}

const files = parseCodebaseMap();
const subsystems = groupIntoSubsystems(files);
generateRegistry(subsystems);
