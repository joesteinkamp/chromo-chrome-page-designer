# Daily Repo Opportunity Scan: 2026-10-12

*(No prior `.ai/previous_review.md` existed; this is the baseline scan. No commits in the last 24h — latest is 2026-07-12.)*

## 1. Net-New Opportunities (High Priority)
- **Delete dead AI/Tokens code (~1.3k LOC).** Commit `e39c7ac` removed the tabs, but `src/panel/components/AITab.tsx` (546), `TokensTab.tsx` (172), `ai.css` (483), `tokens.css` (125) are unreferenced by `App.tsx`; only `src/design-system/index.tsx:51` still imports `ai.css`. Also check the service-worker AI API paths. Value: smaller bundle, no stale styles in the design-system page.
- **Split god-files in the content script.** `main.ts` (1149), `layers-panel.ts` (1223), `change-tracker.ts` (1026), `style-bridge.ts` (817). Extract per-concern modules (layers tree rendering vs. drag/drop vs. state) to make AI-agent edits safer and reviews smaller.
- **Centralize panel colors as tokens.** Raw hex/rgba remain in `sections/{Stroke,Fill,Shadow}Section.tsx`, `controls/ColorPicker.tsx`; move to CSS variables in `panel.css`.

## 2. Design System & UI Consistency
- 17 inline `style={{}}` uses across `src/panel` — move to classes using existing CSS variables (no Tailwind/shadcn in the panel; plain per-component CSS is the convention, so don't introduce either).
- `layers-panel.ts` builds DOM with 16 `createElement` calls plus imperative styling; extract a small `h()` helper shared with `overlay.ts` to enforce the `__pd-` prefix and `!important` rules in one place.

## 3. Status of Previous Flags
No previous review on record. Nothing to compare.

## 4. Suggested Action/Execution Plan
`claude -p "Remove unused src/panel/components/{AITab.tsx,TokensTab.tsx,ai.css,tokens.css}, fix the ai.css import in src/design-system/index.tsx, remove dead AI code in the service worker, then run npm run typecheck && npm run build"`
