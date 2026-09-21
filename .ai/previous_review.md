# Daily Repo Opportunity Scan: 2026-09-21

*No prior `.ai/previous_review.md` was found — this is the baseline scan. No commits landed in the last 24h (repo's most recent commit is Jul 12 2026), so this scan covers the current tree as a whole rather than a diff of new activity.*

## 1. Net-New Opportunities (High Priority)

- **Orphaned "Tokens"/"AI" tab code was never deleted.** `CHANGELOG.md` records the tabs being removed from `App.tsx` ("Tokens and AI tabs from the panel and design system preview as they are no longer valuable enough"), and `src/panel/App.tsx` no longer imports `TokensTab`/`AITab`. But `src/panel/components/AITab.tsx` (546 lines), `TokensTab.tsx` (172 lines), and their stylesheets `ai.css` (483 lines) and `tokens.css` (125 lines) are still in the tree — ~1,326 lines of unreferenced code. Delete all four files.
- **Design-system showcase still imports the dead `ai.css`.** `src/design-system/index.tsx:51` imports `../panel/components/ai.css` for the showcase page, but not `tokens.css`, and neither the AI tab nor tokens UI is rendered anywhere in the showcase. This is a leftover import from the same removal that should be dropped along with the AITab cleanup above.
- **Duplicated "default accent color" magic value.** `#4f9eff` is hardcoded independently in both `StrokeSection.tsx:172` and `FillSection.tsx:72` as the fallback seed color for the color picker. Promote it to a named constant in `src/shared/constants.ts` (e.g. `DEFAULT_ACCENT_COLOR`) so the two sections can't drift apart.

## 2. Design System & UI Consistency

- No new component duplication or Figma-terminology violations found in the current tree beyond the dead-code import above — the panel sections (`FillSection`, `StrokeSection`, `ShadowSection`, etc.) consistently route through the shared `controls/` primitives and `css-mapping.ts`.
- Minor: `src/panel/index.tsx:19` inlines a raw `style={{ padding: 16, color: "#ff6b6b", ... }}` for its top-level error boundary fallback rather than using a token/class — low priority since it's a single, rarely-hit error state, but worth folding into `panel.css` next time that file is touched.

## 3. Status of Previous Flags

N/A — first run, nothing to carry forward.

## 4. Suggested Action/Execution Plan

`claude -p "Delete src/panel/components/AITab.tsx, TokensTab.tsx, ai.css, and tokens.css; remove the now-dead 'import \"../panel/components/ai.css\"' line from src/design-system/index.tsx; verify with npm run typecheck and npm run build" --permission-mode acceptEdits`
