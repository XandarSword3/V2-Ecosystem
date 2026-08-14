import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrationSql = readFileSync(
  fileURLToPath(new URL('../../../../supabase/migrations/20260814120000_repair_customization_snapshot_signature.sql', import.meta.url)),
  'utf8',
);
const routerSource = readFileSync(
  fileURLToPath(new URL('../../../src/routes/dynamic-module.router.ts', import.meta.url)),
  'utf8',
);
const customizationServiceSource = readFileSync(
  fileURLToPath(new URL('../../../src/modules/customization/services/customization.service.ts', import.meta.url)),
  'utf8',
);

describe('customization snapshot RPC contract', () => {
  it('installs the nine-argument performed_by signature and removes the legacy identity', () => {
    expect(migrationSql).toMatch(
      /CREATE OR REPLACE FUNCTION[\s\S]*create_order_customization_snapshot[\s\S]*p_execute_inventory[\s\S]*p_performed_by/s,
    );
    expect(migrationSql).toContain('process_customization_inventory_safe(');
    expect(migrationSql).toContain('p_performed_by');
    expect(migrationSql).toContain("NOTIFY pgrst, 'reload schema';");
    expect(migrationSql).toContain('legacy create_order_customization_snapshot signature still exists');
  });

  it.each([
    ['dynamic order creation', routerSource],
    ['customization service', customizationServiceSource],
  ])('passes base quantity, execution flag, and performed_by from %s', (_name, source) => {
    expect(source).toMatch(/p_base_quantity:\s*(?:orderItem\.quantity|params\.baseQuantity \|\| 1)/);
    expect(source).toMatch(/p_execute_inventory:\s*(?:true|params\.executeInventory \?\? true)/);
    expect(source).toContain('p_performed_by:');
  });
});
