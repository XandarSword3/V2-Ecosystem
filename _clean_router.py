import subprocess, re, sys

FILE = "backend/src/routes/dynamic-module.router.ts"

# Original (HEAD) content, split into lines (no trailing newline chars)
orig = subprocess.run(["git", "show", f"HEAD:{FILE}"], capture_output=True, text=True, encoding="utf-8").stdout
orig_lines = orig.split("\n")
if orig_lines and orig_lines[-1] == "":
    orig_lines.pop()  # drop trailing empty from final newline

diff = subprocess.run(["git", "diff", "-U0", "--", FILE], capture_output=True, text=True, encoding="utf-8").stdout
diff_lines = diff.split("\n")

hunk_re = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")

out = []
cursor = 0  # 0-indexed position in orig_lines already copied
i = 0
n = len(diff_lines)
while i < n:
    line = diff_lines[i]
    m = hunk_re.match(line)
    if not m:
        i += 1
        continue
    old_start = int(m.group(1))
    old_start_0 = old_start - 1
    out.extend(orig_lines[cursor:old_start_0])
    cursor = old_start_0
    i += 1
    while i < n and not diff_lines[i].startswith("@@"):
        hl = diff_lines[i]
        if hl.startswith("---") or hl.startswith("+++"):
            i += 1
            continue
        if hl.startswith("-"):
            cursor += 1  # consume one original line (deleted)
        elif hl.startswith("+"):
            content = hl[1:]
            if content.strip() != "":
                out.append(content)
            # if content is blank -> spurious insertion, drop it
        elif hl.startswith("\\"):
            pass  # "\ No newline at end of file"
        else:
            content = hl[1:] if hl.startswith(" ") else hl
            out.append(content)
            cursor += 1
        i += 1

out.extend(orig_lines[cursor:])

with open(FILE, "w", encoding="utf-8", newline="\n") as f:
    f.write("\n".join(out) + "\n")

print(f"orig_lines={len(orig_lines)} new_lines={len(out)}")
