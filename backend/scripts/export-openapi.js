/**
 * OpenAPI Export Script
 * 
 * Exports the TypeScript OpenAPI spec to machine-readable JSON.
 * Run: node backend/scripts/export-openapi.js
 */

import { openApiV1Spec } from '../src/docs/openapi.v1.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.resolve(__dirname, '../docs');
const outputPath = path.resolve(outputDir, 'openapi.v1.json');

// Ensure docs directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Export spec to JSON
const specJson = JSON.stringify(openApiV1Spec, null, 2);
fs.writeFileSync(outputPath, specJson, 'utf-8');

console.log(`✅ OpenAPI v1 spec exported to: ${outputPath}`);
console.log(`   Paths: ${Object.keys(openApiV1Spec.paths || {}).length}`);
console.log(`   Schemas: ${Object.keys(openApiV1Spec.components?.schemas || {}).length}`);

// Also export a summary for validation
const summary = {
  title: openApiV1Spec.info?.title,
  version: openApiV1Spec.info?.version,
  pathCount: Object.keys(openApiV1Spec.paths || {}).length,
  schemaCount: Object.keys(openApiV1Spec.components?.schemas || {}).length,
  tags: (openApiV1Spec.tags || []).map(t => t.name),
  servers: openApiV1Spec.servers || [],
  exportedAt: new Date().toISOString(),
};

console.log('\nSpec Summary:');
console.log(JSON.stringify(summary, null, 2));
