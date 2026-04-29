/**
 * Validate extracted frontend admin wiring against backend *registered routes*.
 *
 * Why:
 * - `backend/src/docs/openapi-spec.ts` may be incomplete for /admin endpoints.
 * - This validator avoids false positives by scanning backend route registration.
 *
 * Reads:
 * - docs/admin/admin-wiring-map.json
 * - backend/src/app.ts (mount prefixes)
 * - backend/src/<module>/routes.ts and similar (router method/path literals)
 *
 * Writes:
 * - docs/admin/admin-wiring-validation-backend-routes.json
 * - docs/admin/admin-wiring-validation-backend-routes.md
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..'); // v2-resort/
const WIRING_MAP_PATH = path.join(ROOT_DIR, 'docs', 'admin', 'admin-wiring-map.json');
const APP_TS_PATH = path.join(ROOT_DIR, 'backend', 'src', 'app.ts');
const OUTPUT_JSON = path.join(ROOT_DIR, 'docs', 'admin', 'admin-wiring-validation-backend-routes.json');
const OUTPUT_MD = path.join(ROOT_DIR, 'docs', 'admin', 'admin-wiring-validation-backend-routes.md');

const VISITED = new Set();

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function shapePath(p) {
  // Normalize params:
  // - frontend template placeholders: {id} -> {}
  // - backend express params: :id -> {}
  let s = String(p)
    .replace(/\{[^}]+\}/g, '{}')
    .replace(/:[A-Za-z0-9_]+\(\*\)/g, '{}')
    .replace(/:[A-Za-z0-9_]+/g, '{}');
  // Normalize slashes/trailing slashes for matching.
  s = s.replace(/\/+/g, '/');
  if (s.length > 1) s = s.replace(/\/$/, '');
  return s;
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function parseBackendMounts(appTsSource) {
  // Capture: apiRouter.use('/prefix', someRoutesVar);
  const mountRe = /apiRouter\.use\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_]+)\s*\)/g;
  const mounts = [];
  let m = null;
  while ((m = mountRe.exec(appTsSource)) !== null) {
    mounts.push({ prefix: m[1], routerVar: m[2] });
  }
  return mounts;
}

function parseImportsFromSource(source) {
  // Map routerVar -> importSpecifierPath
  const imports = new Map();

  // Named imports: import { x, y as z } from '...';
  const namedImportRe = /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/g;
  let m = null;
  while ((m = namedImportRe.exec(source)) !== null) {
    const list = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const importPath = m[2];
    for (const item of list) {
      const asMatch = item.match(/^([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)$/);
      if (asMatch) {
        imports.set(asMatch[2], importPath);
      } else {
        imports.set(item, importPath);
      }
    }
  }

  // Namespace import: import * as x from '...'
  const nsImportRe = /import\s+\*\s+as\s+([A-Za-z0-9_]+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = nsImportRe.exec(source)) !== null) {
    imports.set(m[1], m[2]);
  }

  // Mixed default + named imports:
  //   import someVar, { x as y } from '...'
  //   We at least need to capture the default binding (someVar -> importPath).
  const mixedDefaultNamedRe = /import\s+([A-Za-z0-9_]+)\s*,\s*\{\s*[^}]+\s*\}\s*from\s+['"]([^'"]+)['"]/g;
  while ((m = mixedDefaultNamedRe.exec(source)) !== null) {
    const defaultVarName = m[1];
    const importPath = m[2];
    if (!imports.has(defaultVarName)) imports.set(defaultVarName, importPath);
  }

  // Default import: import x from '...'
  const defaultImportRe = /import\s+([A-Za-z0-9_]+)\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = defaultImportRe.exec(source)) !== null) {
    const varName = m[1];
    // Avoid overwriting named import hits.
    if (!imports.has(varName)) imports.set(varName, m[2]);
  }

  return imports;
}

function resolveImportToFile(fromDir, importPath) {
  // app.ts imports often end with .js even though the source file is .ts.
  const abs = path.resolve(fromDir, importPath);
  if (fs.existsSync(abs)) return abs;

  // Handle extensionless imports that themselves contain dots, e.g. `./pricing.controller`.
  // In that case `abs` has no real extension, and the actual file is often `abs + '.ts'`.
  if (fs.existsSync(`${abs}.ts`)) return `${abs}.ts`;
  if (fs.existsSync(`${abs}.tsx`)) return `${abs}.tsx`;
  if (fs.existsSync(`${abs}.js`)) return `${abs}.js`;

  if (abs.endsWith('.js')) {
    const tsCandidate = abs.slice(0, -3) + '.ts';
    if (fs.existsSync(tsCandidate)) return tsCandidate;
    const tsxCandidate = abs.slice(0, -3) + '.tsx';
    if (fs.existsSync(tsxCandidate)) return tsxCandidate;
  }
  // As a fallback try stripping extension
  const noExt = abs.replace(/\.(ts|tsx|js|jsx)$/i, '');
  if (fs.existsSync(noExt + '.ts')) return noExt + '.ts';
  if (fs.existsSync(noExt + '.tsx')) return noExt + '.tsx';
  throw new Error(`Unable to resolve import ${importPath} from ${fromDir}`);
}

function extractDirectRouterMethodsAndPaths(routerFileSource) {
  const routes = []; // { method, routePath }

  // router.get('/x', ...)
  const strRe = /router\.(get|post|put|patch|delete)\(\s*(['"`])([^'\"`]+)\2/g;
  let m = null;
  while ((m = strRe.exec(routerFileSource)) !== null) {
    routes.push({ method: m[1].toUpperCase(), routePath: m[3] });
  }

  // router.post(`/x/${id}`, ...)
  const tmplRe = /router\.(get|post|put|patch|delete)\(\s*`([^`]+)`/g;
  while ((m = tmplRe.exec(routerFileSource)) !== null) {
    const raw = m[2];
    const converted = raw.replace(/\$\{[^}]+\}/g, '{}');
    routes.push({ method: m[1].toUpperCase(), routePath: converted });
  }

  return routes;
}

function extractRouterUses(routerFileSource) {
  // router.use('/subprefix', subRouterVar);
  const useRe = /router\.use\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_]+)\s*\)/g;
  const uses = [];
  let m = null;
  while ((m = useRe.exec(routerFileSource)) !== null) {
    uses.push({ subPrefix: m[1], routerVar: m[2] });
  }
  return uses;
}

function fileLooksLikeRouterDefinition(routerFileSource) {
  // Heuristic: router.* calls with literal paths appear in actual routes files.
  return /router\.(get|post|put|patch|delete)\(\s*['"`]/m.test(routerFileSource);
}

function resolveRouterVarToRouteFile(startFileAbs, routerVarName) {
  // Some app.ts mounts pull routers from an "index" module that re-exports
  // the real router instance from nested route files.
  // Example:
  //   app.ts: apiRouter.use('/integrations/quickbooks', quickbooksRoutes)
  //   app.ts import: quickbooksRoutes from './modules/integrations/index.js'
  //   index.js exports quickbooksRoutes from './quickbooks/quickbooks.routes.js'
  //
  // This walks those re-exports by following imports that map `routerVarName`
  // to another file.
  let currentAbs = startFileAbs;
  for (let i = 0; i < 6; i++) {
    const src = fs.readFileSync(currentAbs, 'utf8');
    if (fileLooksLikeRouterDefinition(src)) return currentAbs;

    const importMap = parseImportsFromSource(src);
    const nextImportPath = importMap.get(routerVarName);
    if (nextImportPath) {
      const currentDir = path.dirname(currentAbs);
      currentAbs = resolveImportToFile(currentDir, nextImportPath);
      continue;
    }

    // Handle re-exports: export { quickbooksRoutes, ... } from './x';
    // Handle default aliases: export { default as quickbooksRoutes } from './x';
    const exportRe = /export\s*\{\s*([^}]+?)\s*\}\s*from\s*['"]([^'"]+)['"]/g;
    let exportMatched = false;
    let em = null;
    while ((em = exportRe.exec(src)) !== null) {
      const itemsRaw = em[1];
      const fromPath = em[2];
      const items = itemsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const item of items) {
        // default as X
        const defAs = item.match(/^default\s+as\s+([A-Za-z0-9_]+)$/);
        if (defAs && defAs[1] === routerVarName) {
          const currentDir = path.dirname(currentAbs);
          currentAbs = resolveImportToFile(currentDir, fromPath);
          exportMatched = true;
          break;
        }

        // X as Y
        const asMatch = item.match(/^([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)$/);
        if (asMatch && asMatch[2] === routerVarName) {
          const currentDir = path.dirname(currentAbs);
          currentAbs = resolveImportToFile(currentDir, fromPath);
          exportMatched = true;
          break;
        }

        // Just X
        if (!defAs && !asMatch && item === routerVarName) {
          const currentDir = path.dirname(currentAbs);
          currentAbs = resolveImportToFile(currentDir, fromPath);
          exportMatched = true;
          break;
        }
      }

      if (exportMatched) break;
    }

    if (!exportMatched) return currentAbs;

  }
  return currentAbs;
}

function extractRoutesRecursively(routerFileAbs, mountPrefix, byMethod, visitedFiles) {
  if (visitedFiles.has(routerFileAbs)) return;
  visitedFiles.add(routerFileAbs);

  const routerSrc = fs.readFileSync(routerFileAbs, 'utf8');

  // Direct `router.METHOD('/literal', ...)`
  const directRoutes = extractDirectRouterMethodsAndPaths(routerSrc);
  for (const r of directRoutes) {
    const prefix = mountPrefix.endsWith('/') ? mountPrefix.slice(0, -1) : mountPrefix;
    const suffix = r.routePath.startsWith('/') ? r.routePath : `/${r.routePath}`;
    const fullPath = `${prefix}${suffix}`.replace(/\/+/g, '/');
    byMethod[r.method]?.add(shapePath(fullPath));
  }

  // Nested `router.use('/subprefix', otherRouterVar)`
  const importMap = parseImportsFromSource(routerSrc);
  const uses = extractRouterUses(routerSrc);
  const routerDir = path.dirname(routerFileAbs);
  for (const u of uses) {
    const importPath = importMap.get(u.routerVar);
    if (!importPath) continue;
    const childFileAbs = resolveImportToFile(routerDir, importPath);
    const nextPrefix = `${mountPrefix}${u.subPrefix}`.replace(/\/+/g, '/');
    extractRoutesRecursively(childFileAbs, nextPrefix, byMethod, visitedFiles);
  }
}

function buildBackendRouteIndex() {
  if (!fs.existsSync(APP_TS_PATH)) throw new Error(`Missing backend app.ts: ${APP_TS_PATH}`);
  const appSource = fs.readFileSync(APP_TS_PATH, 'utf8');
  const mounts = parseBackendMounts(appSource);
  const appImports = parseImportsFromSource(appSource);

  const appDir = path.dirname(APP_TS_PATH);

  const byMethod = {
    GET: new Set(),
    POST: new Set(),
    PUT: new Set(),
    PATCH: new Set(),
    DELETE: new Set(),
  };

  for (const mount of mounts) {
    const importPath = appImports.get(mount.routerVar);
    if (!importPath) continue;

    const routerFileAbs = resolveImportToFile(appDir, importPath);
    const resolvedRouterFileAbs = resolveRouterVarToRouteFile(routerFileAbs, mount.routerVar);
    const mountPrefix = mount.prefix.startsWith('/') ? mount.prefix : `/${mount.prefix}`;
    extractRoutesRecursively(resolvedRouterFileAbs, mountPrefix, byMethod, new Set());
  }

  return byMethod;
}

function main() {
  if (!fs.existsSync(WIRING_MAP_PATH)) throw new Error(`Missing wiring map: ${WIRING_MAP_PATH}`);

  const wiring = loadJson(WIRING_MAP_PATH);
  const pages = wiring.pages || [];

  const backendByMethod = buildBackendRouteIndex();

  const sectorStats = {};
  const issues = [];

  function ensureSector(sector) {
    if (!sectorStats[sector]) {
      sectorStats[sector] = {
        totalEndpoints: 0,
        missingPaths: 0,
        missingMethods: 0,
      };
    }
    return sectorStats[sector];
  }

  for (const page of pages) {
    const sector = page.sector || 'Unknown';
    const stat = ensureSector(sector);

    const endpoints = page.endpoints || [];
    stat.totalEndpoints += endpoints.length;

    for (const ep of endpoints) {
      const method = String(ep.method).toUpperCase();
      const openApiPath = ep.openApiPath;
      const desiredShape = shapePath(openApiPath);

      const methodSet = backendByMethod[method];
      if (!methodSet) continue;

      const has = methodSet.has(desiredShape);
      if (!has) {
        // Could be that the path exists for a different method; check quickly.
        let pathExistsAnyMethod = false;
        for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
          if (backendByMethod[m]?.has(desiredShape)) pathExistsAnyMethod = true;
        }

        if (pathExistsAnyMethod) stat.missingMethods += 1;
        else stat.missingPaths += 1;

        issues.push({
          type: pathExistsAnyMethod ? 'MISSING_METHOD' : 'MISSING_PATH',
          sector,
          pageRoute: page.route,
          pageFile: page.file,
          endpoint: {
            method,
            openApiPath,
          },
        });
      }
    }
  }

  const issueRank = (t) => (t === 'MISSING_PATH' ? 1 : t === 'MISSING_METHOD' ? 2 : 99);
  issues.sort((a, b) => issueRank(a.type) - issueRank(b.type) || a.sector.localeCompare(b.sector));

  const report = {
    generatedAt: new Date().toISOString(),
    wiringMap: { path: WIRING_MAP_PATH, inventoryCount: pages.length },
    validation: {
      backendRouteScan: {
        appTs: APP_TS_PATH,
        matching: 'shapeNormalization: {id} and :id -> {}',
      },
    },
    sectorStats,
    issues,
  };

  ensureDir(path.dirname(OUTPUT_JSON));
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), 'utf8');

  let md = `# Admin Wiring Validation (Backend Routes)\n\nGenerated: ${report.generatedAt}\n\n`;
  md += `## Sector Summary\n\n| Sector | Total Endpoints | Missing Paths | Missing Methods |\n|---|---:|---:|---:|\n`;
  const sectorKeys = Object.keys(sectorStats).sort((a, b) => a.localeCompare(b));
  for (const key of sectorKeys) {
    const s = sectorStats[key];
    md += `| ${key} | ${s.totalEndpoints} | ${s.missingPaths} | ${s.missingMethods} |\n`;
  }

  md += `\n## Issues (${issues.length})\n\n`;
  if (issues.length === 0) {
    md += `No issues found.\n`;
  } else {
    for (const issue of issues) {
      md += `- **${issue.type}** \`${issue.endpoint.method} ${issue.endpoint.openApiPath}\` at ${issue.pageRoute} (${issue.sector})\n`;
    }
  }

  ensureDir(path.dirname(OUTPUT_MD));
  fs.writeFileSync(OUTPUT_MD, md, 'utf8');

  console.log(`Backend-route validation generated: ${OUTPUT_JSON}`);
  console.log(`- Issues: ${issues.length}`);
}

main();

