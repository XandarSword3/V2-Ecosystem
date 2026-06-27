const fs = require('fs');
const path = require('path');
const { Client } = require('pg'); 
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 1. Configuration
const DIRECTORIES_TO_SCAN = [
    path.join(__dirname, 'backend', 'src'),
    path.join(__dirname, 'frontend', 'src')
];

async function tryConnect(connectionString) {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        return client;
    } catch (err) {
        console.warn(`⚠️ Connection failed for URL: ${connectionString.replace(/:([^:@]+)@/, ':****@')}. Error: ${err.message}`);
        return null;
    }
}

async function getDatabaseSchema() {
    const urlFromEnv = process.env.DATABASE_URL;
    const dbPassword = process.env.SUPABASE_DB_PASSWORD;

    if (!urlFromEnv) {
        console.error("❌ Error: DATABASE_URL is not set in environment.");
        process.exit(1);
    }

    let client = null;

    console.log("📡 Attempting connection using DATABASE_URL...");
    client = await tryConnect(urlFromEnv);

    if (!client && urlFromEnv.includes('%')) {
        console.log("📡 Attempting connection with decoded DATABASE_URL...");
        try {
            const decodedUrl = decodeURIComponent(urlFromEnv);
            client = await tryConnect(decodedUrl);
        } catch (e) {
            console.warn("⚠️ Failed to decode DATABASE_URL:", e.message);
        }
    }

    if (!client && dbPassword) {
        console.log("📡 Attempting connection using DATABASE_URL with SUPABASE_DB_PASSWORD replaced...");
        try {
            const newUrl = urlFromEnv.replace(/:([^:@]+)@/, `:${dbPassword}@`);
            client = await tryConnect(newUrl);
        } catch (e) {
            console.warn("⚠️ Failed to construct URL with replaced password:", e.message);
        }
    }

    if (!client) {
        console.error("❌ Error: All connection attempts failed. Cannot perform database audit.");
        process.exit(1);
    }

    console.log("⚡ Connected to Supabase PostgreSQL. Fetching schema...");
    const schemaMap = new Map(); 

    try {
        const res = await client.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public';
        `);

        for (const row of res.rows) {
            if (!schemaMap.has(row.table_name)) {
                schemaMap.set(row.table_name, new Set());
            }
            schemaMap.get(row.table_name).add(row.column_name);
        }
    } catch (err) {
        console.error("❌ Database query error:", err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
    return schemaMap;
}

function walkDirectory(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walkDirectory(filePath, fileList);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

function removeCommentsOnly(code) {
    return code
        .replace(/\/\/.*$/gm, '') 
        .replace(/\/\*[\s\S]*?\*\//g, ''); 
}

function removeStringLiterals(code) {
    return removeCommentsOnly(code)
        .replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, ''); 
}

function auditCodebase(schemaMap) {
    console.log("🔍 Scanning codebase files and aggregating results...");
    
    // Data structure to hold grouped issues: { tableName: { columnName: Set<FilePaths> } }
    const reportData = {};

    function recordIssue(table, column, file, type) {
        if (!column) return;

        if (!reportData[table]) reportData[table] = {};
        if (!reportData[table][column]) reportData[table][column] = new Set();
        
        const relativePath = path.relative(__dirname, file);
        const entry = `[${type}] ${relativePath}`;
        
        if (!reportData[table][column].has(entry)) {
            reportData[table][column].add(entry);
        }
    }

    const knownTables = Array.from(schemaMap.keys());

    for (const dir of DIRECTORIES_TO_SCAN) {
        if (!fs.existsSync(dir)) continue;
        
        const files = walkDirectory(dir);

        for (const file of files) {
            const rawContent = fs.readFileSync(file, 'utf8');
            const contentWithoutComments = removeCommentsOnly(rawContent);
            const contentWithoutStrings = removeStringLiterals(rawContent);

            // --- Pattern 1: Supabase client calls syntax ---
            const supabaseFromRegex = /\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)\s*\.\s*select\(\s*['"`]([^'"`]+)['"`]/g;
            let match;
            
            while ((match = supabaseFromRegex.exec(contentWithoutComments)) !== null) {
                const tableName = match[1];
                const selectColumnsString = match[2];

                if (schemaMap.has(tableName)) {
                    const validColumns = schemaMap.get(tableName);
                    
                    // Split and process each requested column
                    const columnsRequested = selectColumnsString
                        .split(',')
                        .map(c => {
                            let col = c.trim();
                            // Remove any leading/trailing whitespace and newlines
                            col = col.replace(/[\s\n\r]+/g, ' ').trim();
                            // Remove relation references like table(col), table!inner(col), or table!fk_name(col)
                            col = col.replace(/^[a-zA-Z0-9_!]+?\(/, '');
                            col = col.replace(/\).*$/, ''); // Remove anything after closing parenthesis
                            // Remove aliases like col:alias
                            col = col.split(':')[0];
                            // Remove json operators like col->json or col->>json
                            col = col.split('->')[0];
                            col = col.split('->>')[0];
                            return col.trim();
                        })
                        .filter(c => {
                            const trimmed = c.trim();
                            return trimmed && trimmed !== '*' && !trimmed.includes('(') && !trimmed.includes(')');
                        });

                    for (const col of columnsRequested) {
                        if (col && !validColumns.has(col)) {
                            recordIssue(tableName, col, file, 'SUPABASE SELECT');
                        }
                    }
                }
            }

            // --- Pattern 2: Drizzle ORM column definitions ---
            const drizzleColumnRegex = /(?:text|varchar|integer|serial|uuid|boolean|timestamp|jsonb)\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g;
            let drizzleMatch;
            let detectedTableInFile = null;
            
            for (const table of knownTables) {
                if (contentWithoutComments.includes(`pgTable('${table}')`) || contentWithoutComments.includes(`pgTable("${table}")`)) {
                    detectedTableInFile = table;
                    break;
                }
            }

            if (detectedTableInFile) {
                const validColumns = schemaMap.get(detectedTableInFile);
                while ((drizzleMatch = drizzleColumnRegex.exec(contentWithoutComments)) !== null) {
                    const colName = drizzleMatch[1];
                    if (colName && !validColumns.has(colName)) {
                        recordIssue(detectedTableInFile, colName, file, 'DRIZZLE SCHEMA');
                    }
                }
            }

            // --- Pattern 3: Key-Value interaction checks (.update / .insert objects) ---
            for (const table of knownTables) {
                if (schemaMap.has(table)) {
                    const validColumns = schemaMap.get(table);
                    const tableCrudRegex = new RegExp(
                        `\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)\\s*\\.\\s*(insert|upsert|update)\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)`,
                        'g'
                    );
                    let crudMatch;
                    
                    while ((crudMatch = tableCrudRegex.exec(contentWithoutStrings)) !== null) {
                        const blockContent = crudMatch[2];
                        const keyRegex = /(?:\b([a-zA-Z0-9_]+)\s*:|['"`]([a-zA-Z0-9_]+)['"`]\s*:)/g;
                        let keyMatch;
                        
                        while ((keyMatch = keyRegex.exec(blockContent)) !== null) {
                            const colName = keyMatch[1] || keyMatch[2];
                            if (colName && !validColumns.has(colName)) {
                                recordIssue(table, colName, file, 'MUTATION OBJECT');
                            }
                        }
                    }
                }
            }
        }
    }

    // --- Generate the Markdown Report ---
    let reportOutput = `# V2 Ecosystem - Database Column Audit Report\n*Generated: ${new Date().toLocaleString()}*\n\n`;
    
    const tables = Object.keys(reportData).sort();
    let totalUniqueIssues = 0;
    
    if (tables.length === 0) {
        reportOutput += "✅ All scanned application references perfectly match the database schema.\n";
        console.log("✅ Audit completed! No mismatches found.");
    } else {
        for (const table of tables) {
            reportOutput += `## 🗄️ Table: \`${table}\`\n`;
            const missingColumns = Object.keys(reportData[table]).sort();
            
            for (const col of missingColumns) {
                totalUniqueIssues++;
                reportOutput += `### ❌ Missing Column: \`${col}\`\n`;
                const files = Array.from(reportData[table][col]).sort();
                
                for (const file of files) {
                    reportOutput += `- Referenced in: \`${file}\`\n`;
                }
                reportOutput += `\n`;
            }
            reportOutput += `---\n\n`;
        }
        console.log(`⚠️ Audit complete. Found ${totalUniqueIssues} unique missing column scenarios.`);
    }

    const outputPath = path.join(__dirname, 'audit-report.md');
    fs.writeFileSync(outputPath, reportOutput);
    console.log(`📄 Saved clean report to: ${outputPath}`);
}

async function run() {
    const schemaMap = await getDatabaseSchema();
    auditCodebase(schemaMap);
}

run();
