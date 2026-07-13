#!/usr/bin/env python3
"""
Phase 2, item 2.3 of the tenant-isolation remediation plan.

Scans backend/src for .from('<table>') call sites on tables registered in
security/scoped-client.ts's TENANT_SCOPED_TABLES, and reports which ones are
reached through getScopedClient() (auto-scoped) vs getSupabase() / a bare
"supabase" variable (NOT auto-scoped — still relies on someone remembering
to filter by tenant_id by hand, same as before Phase 2).

This is a heuristic, not a real static analyzer: it tracks, per file, the
last variable assigned via getSupabase() vs getScopedClient(...), and
classifies each .from() call by whichever one it was called on, or by
whether getScopedClient appears inline on the same statement. It will
misclassify unusual patterns (a supabase client passed as a function
parameter, re-exported from another module, etc.) — the same limitation
the plan's own isolation_report.md-generating script had for DB schema/RLS
coverage. Treat this as a progress tracker to re-run after each module is
migrated (item 2.4), not a guarantee.

Usage: python3 scripts/tenant-scope-coverage.py
"""
import re
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src"

TENANT_SCOPED_TABLES = {
    "modules",
    "entity_customizations",
    "customization_groups",
    "customization_options",
    "order_customizations",
}

FROM_RE = re.compile(r"\.from\(\s*['\"](\w+)['\"]\s*\)")
ASSIGN_RE = re.compile(r"\b(?:const|let|var)\s+(\w+)\s*=\s*(getSupabase|getScopedClient)\s*\(")


def classify_file(path: Path):
    text = path.read_text(errors="ignore")
    lines = text.splitlines()

    # Track, per variable name, the most recent assignment source seen so far.
    var_source: dict[str, str] = {}
    findings = []

    for i, line in enumerate(lines, start=1):
        for m in ASSIGN_RE.finditer(line):
            var_source[m.group(1)] = m.group(2)

        for m in FROM_RE.finditer(line):
            table = m.group(1)
            if table not in TENANT_SCOPED_TABLES:
                continue

            prefix = line[: m.start()]
            # Multi-line chains (e.g. `getScopedClient(ctx)\n  .from('modules')`)
            # put the call on the previous line(s) with nothing on this one
            # before `.from(`. Look back a couple of lines in that case.
            lookback = prefix
            back_i = i - 1
            steps = 0
            while not lookback.strip() and back_i >= 1 and steps < 3:
                lookback = lines[back_i - 1]
                back_i -= 1
                steps += 1

            if "getScopedClient" in lookback:
                scoped = True
            else:
                recv_match = re.search(r"(\w+)\s*$", prefix)
                receiver = recv_match.group(1) if recv_match else None
                scoped = var_source.get(receiver) == "getScopedClient"

            findings.append((i, table, scoped, line.strip()))

    return findings


def main():
    rows = []  # (file, line, table, scoped)
    for path in sorted(SRC.rglob("*.ts")):
        if path.name.endswith((".spec.ts", ".test.ts")):
            continue
        for line_no, table, scoped, _snippet in classify_file(path):
            rows.append((str(path.relative_to(SRC.parent)), line_no, table, scoped))

    unscoped = [r for r in rows if not r[3]]
    scoped = [r for r in rows if r[3]]

    print(f"# Tenant-scope coverage (Phase 2, item 2.3)\n")
    print(f"Registered tables: {', '.join(sorted(TENANT_SCOPED_TABLES))}\n")
    print(f"Total call sites on registered tables: {len(rows)}")
    print(f"  Through getScopedClient(): {len(scoped)}")
    print(f"  NOT scoped (getSupabase() / bare client): {len(unscoped)}\n")

    if unscoped:
        print("## Remaining — not yet migrated\n")
        print("| File | Line | Table |")
        print("|---|---|---|")
        for file, line_no, table, _ in unscoped:
            print(f"| {file} | {line_no} | {table} |")
    else:
        print("Nothing left — every registered table is fully migrated.")


if __name__ == "__main__":
    main()
