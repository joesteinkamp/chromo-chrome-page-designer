# Daily Repo Opportunity Scan: 2026-10-05

*(No prior `.ai/previous_review.md` existed; this is the baseline. No commits since 2026-07-12.)*

## 1. Net-New Opportunities (High Priority)
- **Delete orphaned AI/Tokens tabs** — `src/panel/components/AITab.tsx` (546 LOC), `TokensTab.tsx` (172), `ai.css` (483), `tokens.css` (125) have zero importers after commit e39c7ac removed the tabs. ~1.3k LOC of dead code; confirm `ai-service.ts`/service-worker AI handlers and Options API key UI aren't also now unreachable.
- **Centralize panel→background messaging** — 42 direct `chrome.runtime.sendMessage` calls across `src/panel/**` bypass a typed layer. Add one `useBridge()`/`send<T extends Message>()` helper in `src/panel/hooks/` bound to `src/shared/messages.ts` for type safety, error handling, and mockability.
- **Split god-files in content script** — `layers-panel.ts` (1223), `main.ts` (1149), `change-tracker.ts` (1026) are the main maintenance/AI-edit-context bottleneck; extract per-feature modules.

## 2. Design System & UI Consistency
- 913 hardcoded hex colors in panel TSX/CSS vs. only 5 `var(--…)` usages in panel CSS. Define design tokens (`--pd-*` on `:root` in `panel.css`, including dark mode) and replace literals starting with `ColorPicker.tsx`, `FillSection.tsx`, `StrokeSection.tsx`, `TypographyTab.tsx`.
- No Tailwind/shadcn in the project; the shared `controls/` set (NumberInput, SelectDropdown, …) is the de facto primitive library — route sections through it rather than ad-hoc inputs.

## 3. Status of Previous Flags
No previous report found; baseline established.

## 4. Suggested Action/Execution Plan
`claude -p "Delete unused AITab.tsx, TokensTab.tsx, ai.css, tokens.css and any now-unreachable AI handlers; run npm run typecheck && npm run build"`
