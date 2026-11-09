# Daily Repo Opportunity Scan: 2026-11-09

*No prior review existed; no commits in last 24h (latest: fa85782, 2026-07-12). Scan is a baseline.*

## 1. Net-New Opportunities (High Priority)
1. **Dead code from "Remove Tokens and AI tabs" (e39c7ac).** Still present and unreferenced by the panel: `src/panel/components/AITab.tsx` (546 LOC), `TokensTab.tsx` (172), `ai.css` (483), `tokens.css` (125). `ai.css` is still imported by `src/design-system/index.tsx:51`. Service worker still handles `AI_CRITIQUE_REQUEST` / `AI_NL_EDIT_REQUEST` (`src/background/service-worker.ts:339+`) and `src/background/ai-service.ts` (267) is live, with no UI to invoke it. Value: ~1.6k LOC removed, smaller panel bundle, less attack surface (API-key-bearing code path with no caller). Decide: delete, or re-expose AI via the Send Changes menu.
2. **Oversized content-script modules.** `layers-panel.ts` (1223), `main.ts` (1149), `change-tracker.ts` (1026), `style-bridge.ts` (817). Split `main.ts` into per-feature controllers registered through a small module registry, so message handling is not one switch.

## 2. Design System & UI Consistency
- Hardcoded accent `#4f9eff` in `sections/FillSection.tsx:72` and `sections/StrokeSection.tsx:172`; `#000000` fallback in `components/TypographyTab.tsx:166`. Move to CSS variables/constants in `src/shared/constants.ts` (e.g. `DEFAULT_FILL_SEED`).
- 21 inline `style={{}}` usages in `src/panel`; move to classes in `sections.css`/`controls.css`.
- Per-tab CSS files (`changes.css`, `typography.css`, `agent-sync.css`) alongside `controls.css`/`sections.css`: confirm shared tokens come from `panel.css` variables only.

## 3. Status of Previous Flags
No previous review on file; nothing to compare.

## 4. Suggested Action/Execution Plan
`claude -p "Delete unused AITab/TokensTab and ai/tokens CSS, remove the ai.css import in src/design-system/index.tsx, and remove AI_* handlers plus ai-service.ts if nothing references them; run npm run typecheck && npm run build"`
