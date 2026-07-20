# Daily Repo Opportunity Scan: 2026-07-20

No prior `.ai/previous_review.md` existed, so this is a baseline scan of the full current state rather than a diff. No commits landed in the last 24h (latest commit `fa85782`, 2026-07-12) — findings below reflect the most recent merged work, primarily the "Remove Tokens and AI tabs" commit (`e39c7ac`).

## 1. Net-New Opportunities (High Priority)

1. **Orphaned AI/Tokens feature code left behind by `e39c7ac` ("Remove Tokens and AI tabs")** — `src/panel/components/AITab.tsx` (546 lines) and `src/panel/components/TokensTab.tsx` (172 lines) + `tokens.css` (125 lines) are no longer imported by `src/panel/App.tsx` (tabs are now just `"design" | "changes"`), yet remain in the tree. Their backend counterpart, `src/background/ai-service.ts` (`runDesignCritique`, `runNLEdit`) and the `AI_NL_EDIT_REQUEST`/`AI_CRITIQUE_REQUEST`/`AI_ERROR` cases in `service-worker.ts` (~lines 339-370) and `shared/messages.ts` (lines 118-122), are now unreachable dead code — nothing sends those messages anymore. That's ~1,100+ lines of dead surface area (components, CSS, background handlers, message types) shipping in the bundle. Delete the two components, their CSS, the ai-service module, and the now-unused message cases/handlers.
2. **`src/options/Options.tsx` still persists `anthropicApiKey`** (`chrome.storage.sync.get(["defaultUnit", "anthropicApiKey"])`) for a feature that no longer exists in the panel UI. Either this is genuinely deferred to a future "Phase 5" AI re-introduction (per `CLAUDE.md`), in which case it's fine as-is, or it's another remnant that should be removed alongside item 1 — worth a explicit decision so the options page doesn't silently collect an unused credential.

## 2. Design System & UI Consistency

No new deviations found. Hardcoded hex values in `src/panel/*.tsx` are limited to sane fallback defaults (e.g. `#000000` color fallback, `#4f9eff` accent seed) rather than design-system drift; sections under `src/panel/sections/` follow a consistent structure with no obvious duplicate-component candidates this pass.

## 3. Status of Previous Flags

N/A — first run, no prior report to compare against.

## 4. Suggested Action/Execution Plan

`claude -p "Delete src/panel/components/AITab.tsx, TokensTab.tsx, and tokens.css; remove runDesignCritique/runNLEdit from src/background/ai-service.ts and their call sites/message cases in service-worker.ts; drop the now-unused AI_NL_EDIT_REQUEST/AI_CRITIQUE_REQUEST/AI_CRITIQUE_RESPONSE/AI_ERROR types from src/shared/messages.ts; confirm 'npm run typecheck' and 'npm run build' still pass"`
