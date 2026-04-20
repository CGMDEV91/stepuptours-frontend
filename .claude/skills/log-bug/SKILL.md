---
name: log-bug
description: >
  Log a confirmed fixed bug to BUGLOG.md. Trigger when the user confirms a bug
  is resolved, fixed, or working. Reads BUGLOG.md to assign the next BUG-NNN
  number and appends a concise structured entry using context already available
  in the conversation. Never asks for information that is already known.
---

A bug has just been confirmed as fixed. Your job is to record it in `BUGLOG.md`.

## Steps

1. **Read** `BUGLOG.md` to find the last `BUG-NNN` number. Increment by 1 for the new entry.

2. **Build the entry** using context from the current conversation. Fill in every field:

```
---

## BUG-NNN — <short title, max 8 words>

**Status:** Fixed
**Date:** <today's date YYYY-MM-DD>
**Symptom:** <one sentence — what the user saw that was wrong>
**Root cause:** <one sentence — the actual technical cause>
**Fix:** <one sentence — what was changed to solve it>
**Files:** `file1`, `file2`, ...

---
```

Rules for each field:
- **Symptom** — describe observable behaviour, not code (e.g. "The page redirected to /es even after the user manually switched to /fr").
- **Root cause** — be specific about the technical failure (e.g. "Module-level variable reset on page reload, so restore() was indistinguishable from signIn()").
- **Fix** — name the mechanism, not just "updated the code" (e.g. "Added isNewLogin flag to auth store; only signIn sets it true, restore sets it false").
- **Files** — list only files that were meaningfully modified, not every file touched.

3. **Append** the entry to the end of `BUGLOG.md` using the Edit tool (add after the last `---` separator).

4. **Confirm** by telling the user: "Logged as BUG-NNN in BUGLOG.md."

## Important

- Do NOT rewrite or reformat existing entries.
- Do NOT add extra sections or commentary outside the block.
- If the conversation does not have enough context to fill a field confidently, write a brief accurate summary rather than guessing.
- Keep every field to one sentence. Brevity is the goal — this file is a quick reference, not documentation.
