/**
 * Extract admin page -> backend API endpoint wiring.
 *
 * Reads:
 * - docs/admin/admin-page-inventory.json
 * - admin page files listed there
 *
 * Writes:
 * - docs/admin/admin-wiring-map.json
 *
 * Notes:
 * - This is intentionally heuristic (regex-based), but scoped to:
 *   api.(get|post|put|patch|delete)( <firstArg> )
 * - For template literals containing ${...}, we normalize to OpenAPI-style
 *   params: /path/{param}
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..'); // v2-resort/
const INVENTORY_PATH = path.join(ROOT_DIR, 'docs', 'admin', 'admin-page-inventory.json');
const OUTPUT_PATH = path.join(ROOT_DIR, 'docs', 'admin', 'admin-wiring-map.json');

const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.git']);

function loadInventory() {
  if (!fs.existsSync(INVENTORY_PATH)) {
    throw new Error(`Inventory JSON not found: ${INVENTORY_PATH}`);
  }
  const raw = fs.readFileSync(INVENTORY_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return parsed.inventory || parsed;
}

function normalizeOpenApiPath(rawPath) {
  const withoutQuery = rawPath.split('?')[0];

  // Convert `${expr}` to `{param}`
  const openApi = withoutQuery.replace(/\$\{([^}]+)\}/g, (_m, expr) => {
    const cleaned = String(expr).trim();
    const afterDot = cleaned.split('.').pop() || cleaned;
    const matchIdent = afterDot.match(/[A-Za-z_][A-Za-z0-9_]*/);
    const paramName = (matchIdent && matchIdent[0]) || 'param';
    return `{${paramName}}`;
  });

  return openApi;
}

function normalizeFrontendTemplatePath(rawPath) {
  const withoutQuery = rawPath.split('?')[0];
  return withoutQuery.replace(/\$\{([^}]+)\}/g, (_m, expr) => {
    const cleaned = String(expr).trim();
    const afterDot = cleaned.split('.').pop() || cleaned;
    const matchIdent = afterDot.match(/[A-Za-z_][A-Za-z0-9_]*/);
    const paramName = (matchIdent && matchIdent[0]) || 'param';
    return `:${paramName}`;
  });
}

function extractEndpointsFromContent(content) {
  // Template literals: api.get(`...`)
  const templateRe = /api\.(get|post|put|patch|delete)\(\s*`([^`]+)`/g;
  // String literals: api.get('/...') or api.get("/...")
  const stringRe = /api\.(get|post|put|patch|delete)\(\s*(['"])([^'"]+)\2/g;

  const endpoints = [];
  const seen = new Set();

  function addEndpoint(method, raw, matchIndex) {
    const rawPath = raw;
    const openApiPath = normalizeOpenApiPath(rawPath);
    const frontendTemplatePath = normalizeFrontendTemplatePath(rawPath);
    const key = `${method}:${openApiPath}`;
    if (seen.has(key)) return;
    seen.add(key);

    const line = matchIndex ? content.slice(0, matchIndex).split('\n').length : null;

    endpoints.push({
      method: method.toUpperCase(),
      rawEndpoint: rawPath,
      frontendTemplatePath,
      openApiPath,
      line,
    });
  }

  let m = null;
  while ((m = templateRe.exec(content)) !== null) {
    const method = m[1];
    const raw = m[2];
    addEndpoint(method, raw, m.index);
  }

  while ((m = stringRe.exec(content)) !== null) {
    const method = m[1];
    const raw = m[3];
    addEndpoint(method, raw, m.index);
  }

  return endpoints.sort((a, b) => (a.openApiPath || '').localeCompare(b.openApiPath || ''));
}

function main() {
  const inventory = loadInventory();
  const results = [];

  for (const page of inventory) {
    const absFile = path.join(ROOT_DIR, page.file);
    if (!fs.existsSync(absFile)) {
      throw new Error(`Admin page file missing: ${absFile} (${page.route})`);
    }

    const content = fs.readFileSync(absFile, 'utf8');
    const endpoints = extractEndpointsFromContent(content);

    results.push({
      route: page.route,
      sector: page.sector,
      templateType: page.templateType || null,
      file: page.file,
      endpoints,
    });
  }

  const out = {
    generatedAt: new Date().toISOString(),
    inventoryCount: inventory.length,
    pages: results,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Admin wiring map generated: ${OUTPUT_PATH}`);
  console.log(`- Pages: ${results.length}`);
}

main();

