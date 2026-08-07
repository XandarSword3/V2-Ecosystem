/**
 * One-time backfill: populate transactions.service_location_id for
 * instant_transaction rows that still only carry a legacy metadata.table_id
 * string, from before service_location_id became the single source of truth
 * for "which table" (see ENGINE_A_STAFF_WORKFLOW_PLAN.md Phase 0/1).
 *
 * Match strategy per row, in order:
 *   1. metadata.table_id is itself a valid service_locations.id for the
 *      transaction's module -> use it directly.
 *   2. metadata.table_id matches exactly one service_locations.name
 *      (case-insensitive, trimmed) within the same module -> use that id.
 *   3. No match, or more than one name match -> left untouched and reported.
 *      Nothing is guessed.
 *
 * Run:
 *   tsx src/scripts/backfill-service-location-id.ts --dry-run   (report only)
 *   tsx src/scripts/backfill-service-location-id.ts             (applies updates)
 */
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

const DRY_RUN = process.argv.includes('--dry-run');

interface TxRow {
  id: string;
  module_id: string;
  metadata: Record<string, unknown> | null;
}

interface LocationRow {
  id: string;
  module_id: string;
  name: string;
}

async function main() {
  const supabase = getSupabase();
  console.log(`Starting service_location_id backfill${DRY_RUN ? ' (dry run — no writes)' : ''}...`);

  const { data: rows, error } = await supabase
    .from('transactions')
    .select('id, module_id, metadata')
    .eq('engine_type', 'instant_transaction')
    .is('service_location_id', null)
    .not('metadata->>table_id', 'is', null);

  if (error) throw error;

  const candidates = (rows || []) as TxRow[];
  console.log(`Found ${candidates.length} transaction(s) with metadata.table_id and no service_location_id.`);

  if (candidates.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  const moduleIds = [...new Set(candidates.map((r) => r.module_id).filter(Boolean))];
  const { data: locations, error: locError } = await supabase
    .from('service_locations')
    .select('id, module_id, name')
    .in('module_id', moduleIds);

  if (locError) throw locError;

  const locationsByModule = new Map<string, LocationRow[]>();
  for (const loc of (locations || []) as LocationRow[]) {
    const list = locationsByModule.get(loc.module_id) ?? [];
    list.push(loc);
    locationsByModule.set(loc.module_id, list);
  }

  let matchedById = 0;
  let matchedByName = 0;
  const unresolved: Array<{ id: string; moduleId: string; tableId: string; reason: string }> = [];

  for (const row of candidates) {
    const meta = row.metadata ?? {};
    const rawTableId = String((meta as Record<string, unknown>).table_id ?? '').trim();
    const moduleLocations = locationsByModule.get(row.module_id) ?? [];

    if (!rawTableId) {
      unresolved.push({ id: row.id, moduleId: row.module_id, tableId: rawTableId, reason: 'empty table_id' });
      continue;
    }

    const directIdMatch = moduleLocations.find((l) => l.id === rawTableId);
    let resolvedId: string | null = null;

    if (directIdMatch) {
      resolvedId = directIdMatch.id;
      matchedById++;
    } else {
      const nameMatches = moduleLocations.filter(
        (l) => l.name.trim().toLowerCase() === rawTableId.toLowerCase()
      );
      if (nameMatches.length === 1) {
        resolvedId = nameMatches[0].id;
        matchedByName++;
      } else {
        unresolved.push({
          id: row.id,
          moduleId: row.module_id,
          tableId: rawTableId,
          reason: nameMatches.length === 0 ? 'no matching service_location' : 'ambiguous name match',
        });
        continue;
      }
    }

    if (resolvedId && !DRY_RUN) {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ service_location_id: resolvedId })
        .eq('id', row.id);
      if (updateError) {
        logger.error(`Failed to backfill transaction ${row.id}:`, updateError.message);
        unresolved.push({
          id: row.id,
          moduleId: row.module_id,
          tableId: rawTableId,
          reason: `update failed: ${updateError.message}`,
        });
      }
    }
  }

  console.log('');
  console.log('--- Backfill summary ---');
  console.log(`Matched by direct id: ${matchedById}`);
  console.log(`Matched by name: ${matchedByName}`);
  console.log(`Unresolved: ${unresolved.length}`);
  if (unresolved.length > 0) {
    console.log('Unresolved rows (left untouched — resolve manually):');
    for (const u of unresolved) {
      console.log(`  transaction=${u.id} module=${u.moduleId} table_id="${u.tableId}" reason=${u.reason}`);
    }
  }
  if (DRY_RUN) {
    console.log('');
    console.log('Dry run — no rows were updated. Re-run without --dry-run to apply.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Backfill failed:', err);
    process.exit(1);
  });
