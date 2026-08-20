/**
 * One-time cleanup: clock out stale "active" shifts so the one-open-shift
 * guard (clockIn/createShift) stops blocking new shifts.
 *
 * Targets:
 *   1. The explicit shift id (--shift <uuid>)
 *   2. Every open shift (status='active' AND actual_end IS NULL) whose owning
 *      user is a super_admin (users.role OR users.scope = 'super_admin')
 *
 * Mirrors POST /staff/shifts/:id/clock-out: sets actual_end=now, status
 * 'completed', preserves break minutes. early-leave reason is intentionally
 * not set here — these are stale rows, not a live early clock-out.
 *
 * Run:
 *   tsx src/scripts/clockout-stale-shifts.ts --dry-run                (report only)
 *   tsx src/scripts/clockout-stale-shifts.ts --shift <uuid> --dry-run
 *   tsx src/scripts/clockout-stale-shifts.ts                          (applies)
 */
import { getSupabase } from '../database/connection.js';

const DRY_RUN = process.argv.includes('--dry-run');
const SHIFT_ARG = process.argv.indexOf('--shift');
const TARGET_SHIFT_ID = SHIFT_ARG !== -1 ? process.argv[SHIFT_ARG + 1] : null;

async function main() {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data: openShifts, error } = await supabase
    .from('staff_shifts')
    .select('id, staff_id, shift_date, start_time, end_time, break_minutes, actual_break_minutes, status')
    .eq('status', 'active')
    .is('actual_end', null);

  if (error) throw error;
  const shifts = (openShifts || []) as Array<{
    id: string;
    staff_id: string | null;
    shift_date: string;
    start_time: string;
    end_time: string;
    break_minutes: number | null;
    actual_break_minutes: number | null;
    status: string;
  }>;

  console.log(`Found ${shifts.length} open shift(s) (status=active, actual_end IS NULL).`);
  if (TARGET_SHIFT_ID) console.log(`Explicit target: ${TARGET_SHIFT_ID}`);
  if (shifts.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  // Resolve roles for all shift owners in one query.
  const staffIds = [...new Set(shifts.map((s) => s.staff_id).filter((x): x is string => !!x))];
  const { data: staffRows } = staffIds.length > 0
    ? await supabase.from('users').select('id, scope').in('id', staffIds)
    : { data: [] };
  const staffById = new Map((staffRows || []).map((u) => [u.id, u]));

  const isSuperAdmin = (staffId: string | null) => {
    if (!staffId) return false;
    const u = staffById.get(staffId);
    return u?.scope === 'super_admin';
  };

  const targets = shifts.filter(
    (s) => (TARGET_SHIFT_ID && s.id === TARGET_SHIFT_ID) || isSuperAdmin(s.staff_id)
  );

  console.log(`\nClock-out targets: ${targets.length}`);
  for (const s of targets) {
    const why = TARGET_SHIFT_ID && s.id === TARGET_SHIFT_ID ? 'explicit --shift' : 'super_admin owner';
    console.log(`  - ${s.id} | staff=${s.staff_id} | ${s.shift_date} ${s.start_time}-${s.end_time} | ${why}`);
  }
  if (targets.length === 0) {
    console.log('No matching targets.');
    return;
  }

  if (DRY_RUN) {
    console.log('\nDry run — no writes.');
    return;
  }

  let ok = 0;
  for (const s of targets) {
    const { data: updated, error: updErr } = await supabase
      .from('staff_shifts')
      .update({
        actual_end: now,
        status: 'completed',
        actual_break_minutes: s.break_minutes ?? s.actual_break_minutes ?? 0,
      })
      .eq('id', s.id)
      .select('id, status, actual_end')
      .single();

    if (updErr) {
      console.error(`  FAILED ${s.id}: ${updErr.message}`);
    } else {
      ok += 1;
      console.log(`  Clocked out ${updated?.id} → ${updated?.status}`);
    }
  }
  console.log(`\nDone. ${ok}/${targets.length} shifts closed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
