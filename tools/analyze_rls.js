const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

const tables = {};

for (const file of files) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  
  // Find CREATE TABLE statements
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi;
  let match;
  while ((match = createTableRegex.exec(content)) !== null) {
    const tableName = match[1];
    if (!tables[tableName]) {
      tables[tableName] = { rls: false, policies: 0, hasPropertyId: false };
    }
  }

  // Find property_id columns
  // Simple heuristic: look for property_id inside CREATE TABLE or ALTER TABLE
  const propRegex = /ALTER\s+TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?property_id/gi;
  while ((match = propRegex.exec(content)) !== null) {
    if (tables[match[1]]) tables[match[1]].hasPropertyId = true;
  }
  
  // Also check if property_id is inside CREATE TABLE block
  const createBlocks = content.split(/CREATE\s+TABLE/i);
  for (let i = 1; i < createBlocks.length; i++) {
    const block = createBlocks[i];
    const tableNameMatch = block.match(/^\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\(/i);
    if (tableNameMatch) {
      const tableName = tableNameMatch[1];
      // extract content until first semicolon or end of statement
      const blockContent = block.substring(0, block.indexOf(';'));
      if (blockContent.match(/property_id\s+uuid/i)) {
        if (tables[tableName]) tables[tableName].hasPropertyId = true;
      }
    }
  }

  // Find RLS enable
  const rlsRegex = /ALTER\s+TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  while ((match = rlsRegex.exec(content)) !== null) {
    if (tables[match[1]]) tables[match[1]].rls = true;
  }

  // Find policies
  const policyRegex = /CREATE\s+POLICY\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([a-zA-Z0-9_]+)["']?\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
  while ((match = policyRegex.exec(content)) !== null) {
    if (tables[match[2]]) tables[match[2]].policies++;
  }
}

console.log("TABLE\tRLS\tPOLICIES\tHAS_PROPERTY_ID");
for (const [name, info] of Object.entries(tables)) {
  console.log(`${name}\t${info.rls ? 'RLS ON' : 'NO RLS'}\t${info.policies}\t${info.hasPropertyId}`);
}
