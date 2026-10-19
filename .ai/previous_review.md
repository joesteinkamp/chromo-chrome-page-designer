# Daily Repo Opportunity Scan: 2026-10-19

*Baseline run: no prior `.ai/previous_review.md` existed. No commits in the last 24h (HEAD `fa85782`, 2026-07-12).*

## 1. Net-New Opportunities (High Priority)
1. **Dead code after tab removal (e39c7ac).** `src/panel/components/AITab.tsx` (546 lines) and `TokensTab.tsx` are imported nowhere. Only `src/design-system/index.tsx:51` still pulls in `ai.css`. The service worker still handles `AI_CRITIQUE_REQUEST` / `AI_NL_EDIT_REQUEST` (`src/background/service-worker.ts:339,355`) plus matching message types in `shared/messages.ts`. Either delete all of it or re-wire it. Removing it cuts about 700 lines and dead message surface.
2. **God files in the content script.** `layers-panel.ts` (1223), `main.ts` (1149), `change-tracker.ts` (1026), `style-bridge.ts` (817). Split `main.ts` into per-interaction modules (drag, resize, inline-edit, context menu) so the next feature doesn't grow it further.

## 2. Design System & UI Consistency
- Hardcoded hex colors in CSS: `panel.css` (56), `sections.css` (17), `tokens.css` (15), `controls.css` (12), `ai.css` (7). `controls.css` has 262 `var(--)` uses, so the token layer exists. Sweep the hex literals into panel-level CSS variables.
- 21 inline `style={{}}` usages in `src/panel/**/*.tsx`. Move them to classes.
- `tokens.css` and `ai.css` belong to the dead tabs, so delete them with item 1.

## 3. Status of Previous Flags
No previous report. Baseline established.

## 4. Suggested Action/Execution Plan
`claude -p "Delete unused AITab.tsx, TokensTab.tsx, ai.css, tokens.css, the AI_* handlers in service-worker.ts and the matching message types; fix the design-system import; run npm run typecheck && npm run build"`
