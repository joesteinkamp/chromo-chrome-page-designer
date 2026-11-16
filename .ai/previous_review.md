# Daily Repo Opportunity Scan: 2026-11-16

*No commits since last scan (HEAD = master = fa85782, 2026-07-12). Codebase unchanged since the 2026-11-09 baseline.*

## 1. Net-New Opportunities (High Priority)
No significant new opportunities detected today.

## 2. Design System & UI Consistency
No new deviations. Prior flags still apply: hardcoded `#4f9eff` in `src/panel/sections/FillSection.tsx:72` and `src/panel/sections/StrokeSection.tsx:172` duplicates `--pd-accent` (`src/panel/panel.css:13`). Fix: export a `DEFAULT_FILL_SEED` constant from `src/shared/constants.ts`.

## 3. Status of Previous Flags
- **Dead AI/Tokens code** (`AITab.tsx`, `TokensTab.tsx`, `ai.css` import at `src/design-system/index.tsx:51`, `src/background/ai-service.ts`): **Open**, unchanged.
- **Oversized content-script modules** (`layers-panel.ts` 1223 LOC, `main.ts` 1149 LOC): **Open**, unchanged.
- **Hardcoded accent colors / inline styles in panel**: **Open**, unchanged.

## 4. Suggested Action/Execution Plan
`claude -p "Delete unused AITab/TokensTab and ai/tokens CSS, remove the ai.css import in src/design-system/index.tsx, and remove AI_* handlers plus ai-service.ts if nothing references them; run npm run typecheck && npm run build"`
