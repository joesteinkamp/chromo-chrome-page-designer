# Daily Repo Opportunity Scan: 2026-07-13

## 1. Net-New Opportunities (High Priority)

1. **Orphaned Tokens/AI tab code — 1,326 dead lines.** Commit `e39c7ac` ("Remove Tokens and AI tabs...") removed the tabs from `src/panel/App.tsx` but left the components behind: `src/panel/components/AITab.tsx` (546 lines), `TokensTab.tsx` (172), `tokens.css` (125), `ai.css` (483). None are imported by the live panel — `TokensTab` has zero importers anywhere, `AITab`/`ai.css` are only pulled in by the `design-system` showcase (`src/design-system/index.tsx`), which itself no longer renders them into any tab. Value unlock: delete all four files and their showcase import; shrinks the panel bundle and removes a trap for future edits to dead UI.

## 2. Design System & UI Consistency

- `src/design-system/SidebarPreview.tsx` hand-copies the Send-menu markup from `App.tsx` as static JSX (raw `pd-panel__*` classNames, hardcoded button labels) instead of rendering the real menu component. Today's menu rework (`fa85782`) had to edit the same three button labels in both files to keep the showcase in sync — a manual-sync tax that will silently drift the next time someone forgets the second file. Refactor: extract the Send menu (and ideally the surrounding sidebar chrome) into a shared component that takes action handlers as props; `App.tsx` passes real handlers, the showcase passes no-ops.

## 3. Status of Previous Flags

No previous review exists (`.ai/previous_review.md` was absent) — this is the baseline scan.

## 4. Suggested Action/Execution Plan

`claude -p "Delete src/panel/components/AITab.tsx, TokensTab.tsx, tokens.css, ai.css and remove the now-dangling ai.css import in src/design-system/index.tsx; verify with npm run typecheck && npm run build"`
