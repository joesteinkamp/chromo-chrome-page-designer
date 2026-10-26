# Daily Repo Opportunity Scan: 2026-10-26

## 1. Net-New Opportunities (High Priority)
- **Dead AI/Tokens surface after e39c7ac.** `src/panel/components/AITab.tsx` (546 LOC), `ai.css` (483), `TokensTab.tsx` (172), `tokens.css` (125) are unreferenced by the panel. The worker still handles `AI_CRITIQUE_*` / `AI_NL_EDIT_*` (`src/background/service-worker.ts:339+`), and `design-system/index.tsx:51` still imports `ai.css`. ~1.3k LOC of dead code plus a live, unused API-key code path. Delete or feature-flag it, and trim the message union in `src/shared/messages.ts`.
- **Monolithic content-script modules.** `layers-panel.ts` (1223), `main.ts` (1149), `change-tracker.ts` (1026). Recent feature PRs (#133–#135) all landed here. Split along responsibility (selection model / clipboard / context menu out of `main.ts`) before the next feature to keep AI-agent edits scoped and diffs reviewable.

## 2. Design System & UI Consistency
- CSS is hand-written per area (`controls.css` 1167, `panel.css` 904, `sections.css` 577) with ~913 `var(--…)` uses, which is good tokenization. Residual drift: 5 hardcoded hex values in `src/panel/**/*.tsx` and 21 inline `style={{}}` usages. Move them to tokens/classes. Not urgent.
- No React/Tailwind/shadcn in the repo; the panel uses its own `src/design-system` preview. Standardize on that catalog and don't introduce a second pattern.

## 3. Status of Previous Flags
No previous review existed (`.ai/previous_review.md` was missing); this is the baseline. No commits in the last 24h (latest: 2026-07-12).

## 4. Suggested Action/Execution Plan
`claude -p "Remove unused AITab/TokensTab components, ai.css/tokens.css, the AI_* handlers in service-worker.ts and their message types; run npm run typecheck && npm run build"`
