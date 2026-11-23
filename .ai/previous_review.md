# Daily Repo Opportunity Scan: 2026-11-23

*No commits since last scan (HEAD = master = fa85782, 2026-07-12). Codebase unchanged since the 2026-11-09 baseline; prior flags re-verified against source today.*

## 1. Net-New Opportunities (High Priority)
No significant new opportunities detected today.

## 2. Design System & UI Consistency
No new deviations. Prior flag still applies: hardcoded `#4f9eff` in `src/panel/sections/FillSection.tsx:72` and `src/panel/sections/StrokeSection.tsx:172` duplicates `--pd-accent` (`src/panel/panel.css:13`). Fix: export a `DEFAULT_FILL_SEED` constant from `src/shared/constants.ts`.

## 3. Status of Previous Flags
- **Dead AI/Tokens code** (`AITab.tsx`, `TokensTab.tsx`, `ai.css` import in `src/design-system/index.tsx`, `src/background/ai-service.ts`): **Open**, unchanged.
- **Oversized content-script modules** (`layers-panel.ts` 1223 LOC, `main.ts` 1149 LOC): **Open**, unchanged.
- **Hardcoded accent colors / inline styles in panel**: **Open**, unchanged.
- **Process note:** scan reports from the last ~10 weeks sit on unmerged `claude/funny-bell-*` branches, so each run starts without `.ai/previous_review.md` on master. Merge one scan PR (or point the routine at a fixed branch) to stop the duplication.

## 4. Suggested Action/Execution Plan
`claude -p "Delete unused AITab/TokensTab and ai/tokens CSS, remove the ai.css import in src/design-system/index.tsx, and remove AI_* handlers plus ai-service.ts if nothing references them; run npm run typecheck && npm run build"`
