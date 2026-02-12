import fs from 'fs';
import path from 'path';

const MODULES_DIR = path.resolve('backend/src/modules');
let totalFiles = 0, totalConverted = 0, totalHandlers = 0, errorFiles = [];

function findFiles(dir, pattern) {
  let r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) r = r.concat(findFiles(p, pattern));
    else if (pattern.test(e.name)) r.push(p);
  }
  return r;
}

function countBrace(str, ch) {
  let n = 0, inS = false, sc = '', inLC = false, inBC = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i], nx = str[i+1];
    if (inLC) { if (c === '\n') inLC = false; continue; }
    if (inBC) { if (c === '*' && nx === '/') { inBC = false; i++; } continue; }
    if (c === '/' && nx === '/') { inLC = true; i++; continue; }
    if (c === '/' && nx === '*') { inBC = true; i++; continue; }
    if (inS) { if (c === '\\') { i++; continue; } if (c === sc) inS = false; continue; }
    if ("'\"`".includes(c)) { inS = true; sc = c; continue; }
    if (c === ch) n++;
  }
  return n;
}

function indent(line) { return (line.match(/^(\s*)/) || ['',''])[1]; }

function safeCatch(bodyLines) {
  const m = bodyLines.map(l => l.trim()).filter(l => l);
  if (!m.length) return false;
  if (!m[m.length-1].match(/^next\(\s*(error|err|e)\s*\)\s*;?\s*$/)) return false;
  for (let i = 0; i < m.length-1; i++)
    if (!m[i].match(/^(logger|console)\.\s*(error|warn|info|debug|log)\s*\(/)) return false;
  return true;
}

function findCatch(lines, start) {
  let bc = 1;
  for (let j = start; j < lines.length; j++) {
    if (bc === 1 && lines[j].trim().match(/^\}\s*catch\s*\(/)) return j;
    bc += countBrace(lines[j], '{') - countBrace(lines[j], '}');
    if (bc <= 0) break;
  }
  return -1;
}

function checkCatch(lines, ci) {
  let bc = 1, body = [];
  for (let j = ci+1; j < lines.length; j++) {
    bc += countBrace(lines[j], '{') - countBrace(lines[j], '}');
    if (bc === 0) {
      if (safeCatch(body)) {
        let fi = j+1;
        while (fi < lines.length && lines[fi].trim() === '') fi++;
        return { ok: true, end: j, fc: fi };
      }
      return { ok: false };
    }
    body.push(lines[j]);
  }
  return { ok: false };
}

function processFile(fp) {
  totalFiles++;
  const raw = fs.readFileSync(fp, 'utf-8');
  if (!raw.includes('next(error)') && !raw.includes('next(err)') && !raw.includes('next(e)')) return;
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const crlf = raw.includes('\r\n');
  const L = text.split('\n');
  let R = [], mod = false, hc = 0, i = 0;

  while (i < L.length) {
    const ln = L[i], tr = ln.trim(), ind = indent(ln);
    let ok = false;

    // P1: export async function NAME(req[: Request], res[: Response], next[: NextFunction])[: Promise<X>] {
    const m1 = tr.match(/^(export\s+)?async\s+function\s+(\w+)\s*\(\s*req\s*(?::\s*Request)?\s*,\s*res\s*(?::\s*Response)?\s*,\s*next\s*(?::\s*NextFunction)?\s*\)(?:\s*:\s*Promise<[^>]*>)?\s*\{\s*$/);
    if (m1) {
      const ex = m1[1] ? m1[1].trim()+' ' : '', nm = m1[2];
      let ti = i+1;
      while (ti < L.length && L[ti].trim() === '') ti++;
      if (L[ti]?.trim() === 'try {') {
        const ci = findCatch(L, ti+1);
        if (ci > 0) { const v = checkCatch(L, ci);
          if (v.ok && L[v.fc]?.trim() === '}') {
            R.push(ind+ex+'const '+nm+' = asyncHandler(async (req: Request, res: Response) => {');
            for (let k = ti+1; k < ci; k++) R.push(L[k]);
            R.push(ind+'});');
            i = v.fc+1; mod = true; hc++; ok = true;
          }
        }
      }
    }

    // P1b: async methodName(req, res, next) {  (class/object method)
    if (!ok && !m1) {
      const m1b = tr.match(/^async\s+(\w+)\s*\(\s*req\s*(?::\s*Request)?\s*,\s*res\s*(?::\s*Response)?\s*,\s*next\s*(?::\s*NextFunction)?\s*\)(?:\s*:\s*Promise<[^>]*>)?\s*\{\s*$/);
      if (m1b) {
        const nm = m1b[1];
        let ti = i+1;
        while (ti < L.length && L[ti].trim() === '') ti++;
        if (L[ti]?.trim() === 'try {') {
          const ci = findCatch(L, ti+1);
          if (ci > 0) { const v = checkCatch(L, ci);
            const fcTrimmed = L[v.fc]?.trim();
            // Accept `}` or `},` (object method with trailing comma)
            if (v.ok && (fcTrimmed === '}' || fcTrimmed === '},')) {
              const comma = fcTrimmed === '},' ? ',' : '';
              R.push(ind+nm+' = asyncHandler(async (req: Request, res: Response) => {');
              for (let k = ti+1; k < ci; k++) R.push(L[k]);
              R.push(ind+'})' + comma);
              i = v.fc+1; mod = true; hc++; ok = true;
            }
          }
        }
      }
    }

    // P2: ...async (req, res, next) => {  (inline route handler)
    if (!ok) {
      const m2 = tr.match(/^(.*?)async\s*\(\s*req\s*(?::\s*Request)?\s*,\s*res\s*(?::\s*Response)?\s*,\s*next\s*(?::\s*NextFunction)?\s*\)\s*=>\s*\{\s*$/);
      if (m2) {
        const pfx = m2[1];
        let ti = i+1;
        while (ti < L.length && L[ti].trim() === '') ti++;
        if (L[ti]?.trim() === 'try {') {
          const ci = findCatch(L, ti+1);
          if (ci > 0) { const v = checkCatch(L, ci);
            if (v.ok) {
              const cl = L[v.fc]?.trim();
              // Handle `});` on one line or `}` then `);` on separate lines
              if (cl?.match(/^\}\s*\)\s*;?\s*$/)) {
                R.push(ind+pfx+'asyncHandler(async (req: Request, res: Response) => {');
                for (let k = ti+1; k < ci; k++) R.push(L[k]);
                R.push(indent(L[v.fc])+'})' + (cl.includes(';') ? ';' : ''));
                i = v.fc+1; mod = true; hc++; ok = true;
              } else if (cl === '}') {
                // Check if next non-blank line is `);`
                let nextIdx = v.fc + 1;
                while (nextIdx < L.length && L[nextIdx].trim() === '') nextIdx++;
                const nextLine = L[nextIdx]?.trim();
                if (nextLine?.match(/^\)\s*;?\s*$/)) {
                  R.push(ind+pfx+'asyncHandler(async (req: Request, res: Response) => {');
                  for (let k = ti+1; k < ci; k++) R.push(L[k]);
                  R.push(indent(L[v.fc])+'})'+(nextLine.includes(';')?';':''));
                  i = nextIdx+1; mod = true; hc++; ok = true;
                }
              }
            }
          }
        }
      }
    }

    if (!ok) { R.push(ln); i++; }
  }

  if (mod) {
    let out = R.join('\n');
    if (!out.includes('asyncHandler')) {
      const rel = path.relative(path.dirname(fp), path.join(MODULES_DIR, '..', 'middleware')).replace(/\\/g, '/');
      const imp = "import { asyncHandler } from '"+rel+"/async-handler.js';";
      const ei = out.indexOf("from 'express'");
      if (ei > 0) { const le = out.indexOf('\n', ei); out = out.slice(0, le+1)+imp+'\n'+out.slice(le+1); }
      else out = imp + '\n' + out;
    }
    if ((out.match(/NextFunction/g)||[]).length <= 1) {
      out = out.replace(/import\s*\{\s*Request\s*,\s*Response\s*,\s*NextFunction\s*\}\s*from\s*'express'/, "import { Request, Response } from 'express'");
      out = out.replace(/import\s*\{\s*Router\s*,\s*Request\s*,\s*Response\s*,\s*NextFunction\s*\}\s*from\s*'express'/, "import { Router, Request, Response } from 'express'");
    }
    fs.writeFileSync(fp, crlf ? out.replace(/\n/g, '\r\n') : out, 'utf-8');
    totalConverted++; totalHandlers += hc;
    console.log('  > '+path.relative(MODULES_DIR, fp)+' ('+hc+')');
  }
}

console.log('=== asyncHandler Mass Adoption ===\n');
const files = findFiles(MODULES_DIR, /\.(controller|routes)\.ts$/);
console.log('Found '+files.length+' files\n');
for (const f of files) {
  try { processFile(f); }
  catch(e) { errorFiles.push(path.relative(MODULES_DIR, f)); console.error('  X '+path.relative(MODULES_DIR, f)+': '+e.message); }
}
console.log('\nScanned:'+totalFiles+' Converted:'+totalConverted+' Handlers:'+totalHandlers+' Errors:'+errorFiles.length);
if (errorFiles.length) console.log('Errors:', errorFiles);
