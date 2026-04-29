/**
 * Inventory admin pages and group them into sectors.
 *
 * Output:
 * - docs/admin/admin-page-inventory.json (machine-readable)
 * - docs/admin/admin-sectors.md (human-readable)
 *
 * This is intentionally read-only: it only scans the repository.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..'); // v2-resort/
const FRONTEND_APP_ROOT = path.join(ROOT_DIR, 'frontend', 'src', 'app');
const ADMIN_APP_ROOT = path.join(FRONTEND_APP_ROOT, 'admin');
const ADMIN_NAVIGATION_PATH = path.join(
  ROOT_DIR,
  'frontend',
  'src',
  'config',
  'admin-navigation.ts',
);
const OUTPUT_DIR = path.join(ROOT_DIR, 'docs', 'admin');

const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.git']);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function getAllFilesRecursively(dirPath, fileList) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      getAllFilesRecursively(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function normalizeToPosix(p) {
  return p.replace(/\\/g, '/');
}

function routeFromPageFile(pageFilePath) {
  const rel = normalizeToPosix(path.relative(FRONTEND_APP_ROOT, pageFilePath));
  // rel example: admin/[slug]/menu/page.tsx
  if (!rel.endsWith('/page.tsx')) return null;

  const withoutPage = rel.slice(0, -'/page.tsx'.length); // admin/[slug]/menu
  return '/' + withoutPage;
}

function parseTemplateRoutesFromAdminNavigation() {
  if (!fs.existsSync(ADMIN_NAVIGATION_PATH)) return {};
  const src = fs.readFileSync(ADMIN_NAVIGATION_PATH, 'utf8');

  const templateTypes = ['menu_service', 'multi_day_booking', 'session_access'];
  const mapping = {};

  // Extract each switch-case block in getModuleChildren
  for (let i = 0; i < templateTypes.length; i++) {
    const tType = templateTypes[i];
    const startToken = `case '${tType}':`;
    const startIdx = src.indexOf(startToken);
    if (startIdx === -1) continue;

    // Find the next switch-case *after* the startIdx.
    const allCaseIdxs = templateTypes
      .map((t) => ({ t, idx: src.indexOf(`case '${t}':`) }))
      .filter((x) => x.idx !== -1)
      .sort((a, b) => a.idx - b.idx);

    const next = allCaseIdxs.find((x) => x.idx > startIdx);
    const endIdx = next ? next.idx : -1;

    const block = endIdx === -1 ? src.slice(startIdx) : src.slice(startIdx, endIdx);
    const hrefMatches = [];
    // Match `href: `/admin/${safeSlug}/menu`` pattern
    const hrefRegex = /href:\s*`([^`]+)`/g;
    let m = null;
    while ((m = hrefRegex.exec(block)) !== null) {
      hrefMatches.push(m[1]);
    }

    // Convert /admin/${safeSlug}/foo -> /admin/[slug]/foo
    const converted = hrefMatches
      .map((href) => href.replace('${safeSlug}', '[slug]'))
      .map((href) => (href.startsWith('/') ? href : `/${href}`));

    mapping[tType] = Array.from(new Set(converted));
  }

  return mapping;
}

function sectorForRoute(route) {
  if (route === '/admin') return 'Core Shell';
  if (route.startsWith('/admin/[slug]')) return 'Dynamic Module Admin';

  if (route.startsWith('/admin/users')) return 'Users';
  if (route.startsWith('/admin/settings')) return 'Settings';
  if (
    route.startsWith('/admin/loyalty') ||
    route.startsWith('/admin/coupons') ||
    route.startsWith('/admin/giftcards')
  ) return 'Marketing & Loyalty & Codes';
  if (route.startsWith('/admin/inventory') || route.startsWith('/admin/housekeeping')) return 'Operations';
  if (route.startsWith('/admin/reviews')) return 'Reviews';
  if (route.startsWith('/admin/reports')) return 'Reports & Finance';
  if (route.startsWith('/admin/audit')) return 'Audit Logs';
  if (route.startsWith('/admin/integrations')) return 'Integrations';

  // Core shells
  if (route.startsWith('/admin/modules') || route.startsWith('/admin/orders')) return 'Core Shell';

  // Misc operational pages
  if (
    route.startsWith('/admin/customizations') ||
    route.startsWith('/admin/terminology') ||
    route.startsWith('/admin/properties') ||
    route.startsWith('/admin/kiosk') ||
    route.startsWith('/admin/channels')
  ) return 'Misc';

  return 'Misc';
}

function templateTypeForDynamicRoute(route, templateRoutesByType) {
  const entries = Object.entries(templateRoutesByType || {});
  for (const [templateType, routes] of entries) {
    if (routes.includes(route)) return templateType;
  }
  return 'unmapped';
}

function main() {
  ensureDir(OUTPUT_DIR);

  if (!fs.existsSync(ADMIN_APP_ROOT)) {
    throw new Error(`Admin app root not found: ${ADMIN_APP_ROOT}`);
  }

  const templateRoutesByType = parseTemplateRoutesFromAdminNavigation();

  const files = getAllFilesRecursively(ADMIN_APP_ROOT, []);
  const pageFiles = files.filter((f) => normalizeToPosix(f).endsWith('/page.tsx'));

  const inventory = pageFiles
    .map((pageFilePath) => {
      const route = routeFromPageFile(pageFilePath);
      if (!route) return null;
      const sector = sectorForRoute(route);
      const isDynamic = route.startsWith('/admin/[slug]');
      const templateType = isDynamic
        ? templateTypeForDynamicRoute(route, templateRoutesByType)
        : null;

      return {
        route,
        file: normalizeToPosix(path.relative(ROOT_DIR, pageFilePath)),
        sector,
        isDynamic,
        templateType,
      };
    })
    .filter(Boolean);

  inventory.sort((a, b) => a.route.localeCompare(b.route));

  const inventoryPath = path.join(OUTPUT_DIR, 'admin-page-inventory.json');
  fs.writeFileSync(inventoryPath, JSON.stringify({ generatedAt: new Date().toISOString(), inventory }, null, 2), 'utf8');

  // Render markdown by sectors
  const sectors = {};
  for (const item of inventory) {
    if (!sectors[item.sector]) sectors[item.sector] = [];
    sectors[item.sector].push(item);
  }

  const sectorOrder = [
    'Core Shell',
    'Users',
    'Settings',
    'Marketing & Loyalty & Codes',
    'Operations',
    'Reviews',
    'Reports & Finance',
    'Audit Logs',
    'Integrations',
    'Misc',
    'Dynamic Module Admin',
  ];

  const sectorKeys = Object.keys(sectors).sort((a, b) => sectorOrder.indexOf(a) - sectorOrder.indexOf(b));

  // Special render for dynamic templates
  const dynamic = sectors['Dynamic Module Admin'] || [];
  const dynamicByTemplate = {};
  for (const d of dynamic) {
    const key = d.templateType || 'unmapped';
    if (!dynamicByTemplate[key]) dynamicByTemplate[key] = [];
    dynamicByTemplate[key].push(d);
  }
  for (const key of Object.keys(dynamicByTemplate)) {
    dynamicByTemplate[key].sort((a, b) => a.route.localeCompare(b.route));
  }

  let md = `# Admin Pages Sector Map\n\n`;
  md += `> Generated: ${new Date().toISOString()}\n\n`;

  for (const sectorKey of sectorKeys) {
    if (sectorKey === 'Dynamic Module Admin') continue;
    md += `## ${sectorKey}\n\n`;
    const items = sectors[sectorKey] || [];
    for (const item of items.sort((a, b) => a.route.localeCompare(b.route))) {
      md += `- \`${item.route}\` (${item.file})\n`;
    }
    md += `\n`;
  }

  // Dynamic section at end
  md += `## Dynamic Module Admin\n\n`;
  const templateOrder = ['menu_service', 'multi_day_booking', 'session_access', 'unmapped'];
  for (const templateType of templateOrder) {
    const items = dynamicByTemplate[templateType] || [];
    if (!items.length) continue;
    md += `### ${templateType}\n\n`;
    for (const item of items) {
      md += `- \`${item.route}\` (${item.file})\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'admin-sectors.md'), md, 'utf8');

  // Console summary
  console.log(`Admin page inventory generated.`);
  console.log(`- Pages: ${inventory.length}`);
  console.log(`- Inventory JSON: ${inventoryPath}`);
  console.log(`- Sector map MD: ${path.join(OUTPUT_DIR, 'admin-sectors.md')}`);
}

main();

