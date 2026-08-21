/**
 * Engine A frontend architecture guard (plan F1, rule 2).
 *
 * The generic frontend cannot contain vertical fulfillment semantics:
 * legacy composites ('preparing' / 'delivered' / 'served') as ORDER-LEVEL
 * fulfillment states are forbidden outside the canonical mapper
 * (lib/engine-a/types.ts) and the hospitality adapter surfaces. This guard
 * fails if the generic layers or migrated Engine A pages regress.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalFulfillmentState } from '../../src/lib/engine-a/types';

// Order-level legacy composites. 'delivered' is the order-only discriminator:
// item-level statuses (order_items) legitimately include 'preparing'/'served',
// but 'delivered' never appears at item level — its presence means order-level
// fulfillment is being inferred from a legacy composite.
const LEGACY_ORDER_COMPOSITES = /'delivered'/;
// All three composites — the generic domain layer carries NO vertical
// vocabulary at all (not even item-level).
const ALL_LEGACY_COMPOSITES = /'preparing'|'delivered'|'served'/;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('Engine A frontend architecture (plan F1)', () => {
  it('generic layers never reference legacy fulfillment composites', () => {
    // src/lib and src/types are the generic domain layer. The ONLY place
    // legacy composites may appear is the canonical mapper in
    // lib/engine-a/types.ts (which converts them to canonical states).
    for (const file of [...walk('src/lib'), ...walk('src/types')]) {
      if (file.replace(/\\/g, '/').endsWith('engine-a/types.ts')) continue; // the mapper
      const content = readFileSync(file, 'utf8');
      expect(content, `${file} must not reference legacy fulfillment composites`).not.toMatch(ALL_LEGACY_COMPOSITES);
    }
  });

  it('migrated Engine A surfaces key off canonical states only', () => {
    // Pages migrated in F1 — they must never regress to ORDER-level legacy
    // composites ('delivered' is the order-only discriminator; item-level
    // 'preparing'/'served' in KDS files are legitimate — order_items is not
    // an engine entity).
    const migrated = [
      'src/app/[property]/admin/[slug]/orders/page.tsx',
      'src/app/[property]/admin/orders/page.tsx',
      'src/app/[property]/[slug]/confirmation/page.tsx',
      'src/components/staff/KitchenView.tsx',
      'src/components/staff/types.ts',
    ];
    for (const page of migrated) {
      const content = readFileSync(page, 'utf8');
      expect(content, `${page} must not reference the order-level legacy composite 'delivered'`).not.toMatch(LEGACY_ORDER_COMPOSITES);
    }
  });

  it('the canonical mapper resolves legacy composites to canonical states', () => {
    expect(canonicalFulfillmentState({ status: 'preparing' })).toBe('in_progress');
    expect(canonicalFulfillmentState({ status: 'delivered' })).toBe('handed_off');
    expect(canonicalFulfillmentState({ status: 'served' })).toBe('handed_off');
    expect(canonicalFulfillmentState({ status: 'ready' })).toBe('ready');
    // Canonical field wins over legacy status.
    expect(canonicalFulfillmentState({ status: 'preparing', fulfillment_status: 'ready' })).toBe('ready');
    // Transaction states pass through.
    expect(canonicalFulfillmentState({ status: 'confirmed' })).toBe('confirmed');
    expect(canonicalFulfillmentState({ status: 'completed' })).toBe('completed');
  });
});
