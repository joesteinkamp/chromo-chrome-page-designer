# Daily Repo Opportunity Scan: 2026-11-02

*Baseline run: no prior review existed. No commits in last 24h (HEAD fa85782, 2026-07-12).*

## 1. Net-New Opportunities (High Priority)
1. **Dead code after tab removal** — commit e39c7ac removed the Tokens/AI tabs, but `src/panel/components/AITab.tsx` (546 loc), `TokensTab.tsx` (172), `ai.css` (483), `tokens.css` (125) remain with no importers except `ai.css` in `src/design-system/index.tsx:51`. ~1.3k lines of unused UI + CSS to delete (or relocate if the design-system showcase needs them).
2. **Panel→background messaging is unabstracted** — 42 raw `chrome.runtime.sendMessage` calls across `src/panel/**` (hooks, App, sections, ElementInfo). Introduce a single typed `send(msg)` helper in `src/panel/hooks/` (error swallowing, tab targeting, batching) to cut boilerplate and centralize failure handling.
3. **Content-script monoliths** — `layers-panel.ts` (1223), `main.ts` (1149), `change-tracker.ts` (1026) are the main maintenance/perf risk. Split by concern (tree building vs. rendering vs. drag/drop; tracker vs. serializer/exporter).

## 2. Design System & UI Consistency
- 21 inline `style={{}}` uses and 6 hardcoded hex colors in `src/panel/**/*.tsx`; move to tokens/CSS classes in `panel.css`/`controls.css`.
- Per-feature CSS files (`agent-sync.css`, `changes.css`, `typography.css`) alongside `controls.css` — verify shared tokens are used rather than redefined.

## 3. Status of Previous Flags
No previous review on file (baseline).

## 4. Suggested Action/Execution Plan
`claude -p "Delete unused AITab.tsx, TokensTab.tsx, ai.css, tokens.css (fix the import in src/design-system/index.tsx), then run npm run typecheck && npm run build"`
