#!/usr/bin/env node
/**
 * adopt-async-handler-v2.mjs
 * 
 * Robust asyncHandler mass-adoption script.
 * Converts try/catch/next(error) patterns to asyncHandler wrapping.
 * 
 * Strategy: 
 * 1. Find all functions with next(error|err|e) in catch blocks
 * 2. For each function, precisely locate function boundaries using brace counting
 * 3. Verify catch block is safe to remove (only logger + next)
 * 4. Transform function to asyncHandler form
 * 5. Validate brace balance before writing
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const BACKEND_SRC = path.resolve('src');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Stats
let totalConverted = 0;
let totalFiles = 0;
let totalSkipped = 0;
const errors = [];

/**
 * Count braces in a line (ignoring strings and comments)
 */
function countBraces(line) {
  let opens = 0;
  let closes = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;
  let inLineComment = false;
  
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : '';
    
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    
    if (inLineComment) continue;
    
    if (!inString && ch === '/' && line[i + 1] === '/') {
      inLineComment = true;
      continue;
    }
    
    if (!inString && (ch === "'" || ch === '"' || ch === '`')) {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (inString && ch === stringChar) {
      inString = false;
      continue;
    }
    
    if (!inString) {
      if (ch === '{') opens++;
      if (ch === '}') closes++;
    }
  }
  
  return { opens, closes };
}

/**
 * Find the end of a function/block starting at the opening brace.
 * Returns the line index of the closing brace.
 */
function findBlockEnd(lines, startLine) {
  let depth = 0;
  for (let i = startLine; i < lines.length; i++) {
    const { opens, closes } = countBraces(lines[i]);
    depth += opens - closes;
    if (depth === 0 && opens + closes > 0) {
      return i;
    }
  }
  return -1; // not found
}

/**
 * Check if a catch body is safe to remove.
 * Safe = only contains: logger calls, next(error/err/e), empty lines, comments
 */
function isSafeCatchBody(catchBodyLines) {
  for (const line of catchBodyLines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (trimmed.startsWith('//')) continue;
    if (/^next\((error|err|e)\);?$/.test(trimmed)) continue;
    if (/^logger\.\w+\(/.test(trimmed)) continue;
    // Multi-line logger continuation
    if (/^\);?$/.test(trimmed)) continue;
    if (/^['"`]/.test(trimmed)) continue; // string continuation
    if (/^(error|err|e),?\s*$/.test(trimmed)) continue; // logger arg
    if (/^\{.*\}/.test(trimmed)) continue; // inline object in logger
    // Allow: `{ error: err }` etc
    if (/^\w+:/.test(trimmed)) continue;
    return false;
  }
  return true;
}

/**
 * Find the try block within a function.
 * Uses character-by-character depth tracking to handle } catch (error) { on same line.
 * Returns { tryLine, catchLine, catchOpenLine, catchEnd, catchVar, catchBody }
 */
function findTryCatch(lines, funcStart, funcEnd) {
  // Find the try { line (should be near the start of function)
  let tryLine = -1;
  for (let i = funcStart + 1; i < funcEnd && i < funcStart + 5; i++) {
    if (/^\s*try\s*\{/.test(lines[i])) {
      tryLine = i;
      break;
    }
  }
  if (tryLine === -1) return null;
  
  // Track depth character by character to find when try block's { is closed
  let depth = 0;
  let catchLine = -1;
  let catchVar = 'error';
  
  for (let i = tryLine; i <= funcEnd; i++) {
    const line = lines[i];
    let inString = false;
    let stringChar = '';
    let escaped = false;
    let inLineComment = false;
    
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (inLineComment) continue;
      if (!inString && ch === '/' && line[c + 1] === '/') { inLineComment = true; continue; }
      
      if (!inString && (ch === "'" || ch === '"' || ch === '`')) {
        inString = true; stringChar = ch; continue;
      }
      if (inString && ch === stringChar) {
        inString = false; continue;
      }
      
      if (!inString) {
        if (ch === '{') depth++;
        if (ch === '}') {
          depth--;
          if (depth === 0 && i > tryLine) {
            // The try block's brace just closed! Check if rest of line has 'catch'
            const restOfLine = line.substring(c + 1);
            const catchMatch = restOfLine.match(/\s*catch\s*\((error|err|e)\)\s*\{/);
            if (catchMatch) {
              catchLine = i;
              catchVar = catchMatch[1];
              // The { in catch reopens depth, which we've already processed
              // (depth is now 1 after the { in catch)
            }
            // Also check if catch is on the NEXT line
            if (!catchMatch && i + 1 <= funcEnd) {
              const nextLineText = lines[i + 1].trim();
              const catchMatch2 = nextLineText.match(/^catch\s*\((error|err|e)\)\s*\{/);
              if (catchMatch2) {
                catchLine = i;
                catchVar = catchMatch2[1];
              }
            }
            break; // Found where try block closes, done searching
          }
        }
      }
    }
    
    if (catchLine !== -1) break;
    if (depth === 0 && i > tryLine) break; // try closed but no catch
  }
  
  if (catchLine === -1) return null;
  
  // Find catch body and catch end
  // Determine which line has the catch's opening {
  let catchOpenLine = catchLine;
  if (!lines[catchLine].includes('catch')) {
    catchOpenLine = catchLine + 1; // catch is on next line
  }
  
  const catchEnd = findCatchEnd(lines, catchOpenLine, funcEnd);
  if (catchEnd === -1) return null;
  
  // Catch body is between catch open { and catch close }
  const catchBody = lines.slice(catchOpenLine + 1, catchEnd);
  
  return {
    tryLine,
    catchLine,
    catchOpenLine,
    catchEnd,
    catchVar,
    catchBody,
    catchBodyStartLine: catchOpenLine + 1,
  };
}

/**
 * Find the end of a catch block
 */
function findCatchEnd(lines, catchOpenLine, maxLine) {
  let depth = 0;
  let started = false;
  for (let i = catchOpenLine; i <= maxLine; i++) {
    const { opens, closes } = countBraces(lines[i]);
    depth += opens - closes;
    if (opens > 0) started = true;
    
    // For } catch (error) { ... } patterns, the catch's { opens at depth and closes 
    // We need to track from the catch's opening brace
    // If the line is: } catch (error) { next(error); }
    // opens=1 ({) closes=2 (} from try and } from catch)... no that's not right
    // Actually: } catch (error) { has opens=1 closes=1, depth stays same
    // But we start counting from the line with catch's {
    
    // Let me re-think: on the catch open line, there's a { that opens the catch block
    // We need to find when THAT specific brace closes
    // If the line is `} catch (error) {`, the } closes try, { opens catch
    // After this line, depth relative to before the line = 0 (one close, one open)
    // But we want depth of the catch block specifically
    
    // Simpler approach: count only from the catch's { forward
    if (i === catchOpenLine) {
      // Reset depth to just count the catch block
      const textFromCatch = lines[i].substring(lines[i].indexOf('catch'));
      const { opens: co, closes: cc } = countBraces(textFromCatch);
      depth = co - cc;
      if (depth === 0 && co > 0) return i; // single-line catch
      continue;
    }
    
    // Once started, when depth reaches 0, we found the end
    if (started && depth <= 0) {
      return i;
    }
  }
  return -1;
}

/**
 * Detect function pattern and extract info.
 * Handles multi-line signatures by joining up to 4 lines.
 */
function detectFunctionPattern(lines, startIdx) {
  // Join up to 4 lines to handle multi-line signatures
  const line = lines[startIdx];
  let combined = line;
  let endIdx = startIdx;
  
  // If line looks like start of a function but doesn't have {, extend
  if (/(?:export\s+)?async\s+function\s+\w+\s*\(/.test(line) && !line.includes('{')) {
    for (let j = startIdx + 1; j < Math.min(startIdx + 4, lines.length); j++) {
      combined += ' ' + lines[j].trim();
      endIdx = j;
      if (combined.includes('{')) break;
    }
  }
  
  // Also handle class methods
  if (/^\s+async\s+\w+\s*\(/.test(line) && !line.includes('{')) {
    combined = line;
    endIdx = startIdx;
    for (let j = startIdx + 1; j < Math.min(startIdx + 4, lines.length); j++) {
      combined += ' ' + lines[j].trim();
      endIdx = j;
      if (combined.includes('{')) break;
    }
  }
  
  // Also handle inline handlers
  if (/router\.\w+\(/.test(line) && line.includes('async') && !line.includes('{')) {
    combined = line;
    endIdx = startIdx;
    for (let j = startIdx + 1; j < Math.min(startIdx + 4, lines.length); j++) {
      combined += ' ' + lines[j].trim();
      endIdx = j;
      if (combined.includes('{')) break;
    }
  }
  
  // Pattern 1: export async function X(req: Request, res: Response, next: NextFunction) {
  const exportFuncMatch = combined.match(
    /^(export\s+)?async\s+function\s+(\w+)\s*\([^)]*(?:next|_next)\s*:\s*NextFunction[^)]*\)\s*(?::\s*Promise<\w+>)?\s*\{/
  );
  if (exportFuncMatch) {
    return {
      type: 'export-function',
      name: exportFuncMatch[2],
      isExported: !!exportFuncMatch[1],
      startLine: startIdx,
      sigEndLine: endIdx,
      combined,
    };
  }
  
  // Pattern 2: router.METHOD('path', ..., async (req, res, next) => {
  const routerMatch = combined.match(
    /^(\s*)(router\.\w+\([^,]+(?:,[^,]+)*),\s*async\s*\([^)]*(?:next|_next)\s*:\s*NextFunction[^)]*\)\s*(?::\s*Promise<\w+>)?\s*=>\s*\{/
  );
  if (routerMatch) {
    return {
      type: 'inline-handler',
      indent: routerMatch[1],
      routerPrefix: routerMatch[2],
      startLine: startIdx,
      sigEndLine: endIdx,
      combined,
    };
  }
  
  // Pattern 3: class method: async methodName(req: Request, res: Response, next: NextFunction) {
  const classMethodMatch = combined.match(
    /^(\s+)async\s+(\w+)\s*\([^)]*(?:next|_next)\s*:\s*NextFunction[^)]*\)\s*(?::\s*Promise<\w+>)?\s*\{/
  );
  if (classMethodMatch) {
    return {
      type: 'class-method',
      indent: classMethodMatch[1],
      name: classMethodMatch[2],
      startLine: startIdx,
      sigEndLine: endIdx,
      combined,
    };
  }
  
  return null;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  // Normalize line endings
  const hasCRLF = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');
  let lines = content.split('\n');
  
  // Find all functions with next(error) pattern
  const handlers = [];
  
  for (let i = 0; i < lines.length; i++) {
    const pattern = detectFunctionPattern(lines, i);
    if (!pattern) continue;
    
    if (VERBOSE) {
      console.log(`  [DEBUG] Found ${pattern.type} "${pattern.name || 'inline'}" at lines ${pattern.startLine + 1}-${pattern.sigEndLine + 1}`);
    }
    
    // Find the end of this function by counting braces from where { appears
    const funcEnd = findBlockEnd(lines, pattern.startLine);
    if (funcEnd === -1) {
      if (VERBOSE) console.log(`  [DEBUG]   funcEnd not found, skipping`);
      continue;
    }
    
    if (VERBOSE) {
      console.log(`  [DEBUG]   funcEnd at line ${funcEnd + 1}`);
    }
    
    // Check if this function has next(error/err/e) in a catch block
    const funcBody = lines.slice(pattern.startLine, funcEnd + 1).join('\n');
    if (!/next\((error|err|e)\)/.test(funcBody)) continue;
    
    // Find try/catch structure
    const tryCatch = findTryCatch(lines, pattern.sigEndLine, funcEnd);
    if (!tryCatch) {
      if (VERBOSE) console.log(`  [DEBUG]   no try/catch found`);
      continue;
    }
    
    if (VERBOSE) {
      console.log(`  [DEBUG]   try at line ${tryCatch.tryLine + 1}, catch at line ${tryCatch.catchLine + 1}, catchEnd at line ${tryCatch.catchEnd + 1}`);
    }
    
    // Check if catch body is safe to remove
    if (!isSafeCatchBody(tryCatch.catchBody)) {
      if (VERBOSE) {
        console.log(`  SKIP (complex catch): ${pattern.name || 'inline'} at line ${pattern.startLine + 1}`);
      }
      totalSkipped++;
      continue;
    }
    
    handlers.push({
      pattern,
      funcStart: pattern.startLine,
      funcEnd,
      tryCatch,
    });
  }
  
  if (handlers.length === 0) return false;
  
  // Ensure asyncHandler import exists
  const hasImport = lines.some(l => /import\s*\{[^}]*asyncHandler[^}]*\}\s*from/.test(l));
  
  // Determine import path based on file location
  let importPath;
  const relPath = path.relative(BACKEND_SRC, filePath);
  const depth = relPath.split(path.sep).length - 1;
  const prefix = '../'.repeat(depth);
  importPath = `${prefix}middleware/async-handler.js`;
  
  // Process handlers in REVERSE order to preserve line numbers
  for (let h = handlers.length - 1; h >= 0; h--) {
    const { pattern, funcStart, funcEnd, tryCatch } = handlers[h];
    
    // Extract try body (between try { and } catch)
    const tryBodyLines = lines.slice(tryCatch.tryLine + 1, tryCatch.catchLine);
    
    // Build replacement lines
    const replacement = [];
    const indent = lines[funcStart].match(/^(\s*)/)[1];
    
    if (pattern.type === 'export-function') {
      const exportPrefix = pattern.isExported ? 'export ' : '';
      replacement.push(`${indent}${exportPrefix}const ${pattern.name} = asyncHandler(async (req: Request, res: Response) => {`);
      replacement.push(...tryBodyLines);
      replacement.push(`${indent}});`);
    } else if (pattern.type === 'inline-handler') {
      replacement.push(`${indent}${pattern.routerPrefix}, asyncHandler(async (req: Request, res: Response) => {`);
      replacement.push(...tryBodyLines);
      replacement.push(`${indent}}));`);
    } else if (pattern.type === 'class-method') {
      // Class methods can't be easily wrapped in asyncHandler
      // Skip for now - they need different treatment
      if (VERBOSE) {
        console.log(`  SKIP (class method): ${pattern.name} at line ${funcStart + 1}`);
      }
      totalSkipped++;
      continue;
    }
    
    // Replace the lines
    lines.splice(funcStart, funcEnd - funcStart + 1, ...replacement);
    totalConverted++;
  }
  
  // Add import if needed and we converted something
  if (!hasImport && handlers.some(h => h.pattern.type !== 'class-method')) {
    // Find the right place to insert import
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ') || lines[i].startsWith('import{')) {
        insertIndex = i + 1;
      }
    }
    // Check if we already have the express import line
    const expressImportLine = lines.findIndex(l => /from\s+['"]express['"]/.test(l));
    if (expressImportLine >= 0) {
      lines.splice(expressImportLine + 1, 0, `import { asyncHandler } from '${importPath}';`);
    } else {
      lines.splice(insertIndex, 0, `import { asyncHandler } from '${importPath}';`);
    }
  }
  
  // Validate brace balance
  let totalOpens = 0;
  let totalCloses = 0;
  for (const line of lines) {
    const { opens, closes } = countBraces(line);
    totalOpens += opens;
    totalCloses += closes;
  }
  
  if (totalOpens !== totalCloses) {
    errors.push(`${filePath}: brace mismatch after conversion (opens=${totalOpens}, closes=${totalCloses})`);
    return false; // Don't write!
  }
  
  let newContent = lines.join('\n');
  // Restore original line ending style
  if (hasCRLF) {
    newContent = newContent.replace(/\n/g, '\r\n');
  }
  
  if (!DRY_RUN) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }
  
  return true;
}

/**
 * Main
 */
function main() {
  console.log(`asyncHandler Adoption Script v2`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Scanning: ${BACKEND_SRC}`);
  console.log('');
  
  // Find all .ts files with next(error) pattern
  const allFiles = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'test') continue;
        walk(fullPath);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.spec.ts')) {
        allFiles.push(fullPath);
      }
    }
  }
  walk(path.join(BACKEND_SRC, 'modules'));
  
  // Also scan routes and controllers at top level
  const routesDir = path.join(BACKEND_SRC, 'routes');
  const controllersDir = path.join(BACKEND_SRC, 'controllers');
  if (fs.existsSync(routesDir)) walk(routesDir);
  if (fs.existsSync(controllersDir)) walk(controllersDir);
  
  // Filter to files that have next(error|err|e)
  const targetFiles = allFiles.filter(f => {
    const content = fs.readFileSync(f, 'utf-8');
    return /next\((error|err|e)\)/.test(content);
  });
  
  console.log(`Found ${targetFiles.length} files with next(error) patterns\n`);
  
  for (const file of targetFiles) {
    const relPath = path.relative(process.cwd(), file);
    const beforeContent = fs.readFileSync(file, 'utf-8');
    const beforeCount = totalConverted;
    
    const success = processFile(file);
    
    const converted = totalConverted - beforeCount;
    if (converted > 0) {
      console.log(`  ✓ ${relPath}: ${converted} handler(s) converted`);
      totalFiles++;
    } else if (success === false && errors.length > 0) {
      console.log(`  ✗ ${relPath}: ${errors[errors.length - 1]}`);
    } else {
      if (VERBOSE) console.log(`  - ${relPath}: no convertible patterns`);
    }
  }
  
  console.log('');
  console.log(`Summary:`);
  console.log(`  Files modified: ${totalFiles}`);
  console.log(`  Handlers converted: ${totalConverted}`);
  console.log(`  Handlers skipped (complex): ${totalSkipped}`);
  console.log(`  Errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  ${e}`));
  }
}

main();
