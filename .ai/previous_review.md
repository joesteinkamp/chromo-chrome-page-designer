# Daily Repo Opportunity Scan: 2026-09-28

No `previous_review.md` existed yet, so this is a baseline scan (not a diff). No commits landed in the last 24h — HEAD (`fa85782`) is dated 2026-07-12 — so findings below come from a full-repo pass, filtered to the highest-value items.

## 1. Net-New Opportunities (High Priority)

1. **Dead tab code shipping in every panel build** — `src/panel/components/TokensTab.tsx` (172 lines), `AITab.tsx` (546 lines), `tokens.css` (125 lines), `ai.css` (483 lines) = 1,326 lines. Commit `e39c7ac` ("Remove Tokens and AI tabs...") stripped the imports from `App.tsx` but never deleted the files. Confirmed zero remaining references anywhere in `src/`. Pure bundle bloat and a trap for the next person who greps for "Tokens tab" and edits a file nothing renders.
2. **Duplicated drag-to-scrub logic** — `src/panel/controls/NumberInput.tsx:172-197` and `UnitInput.tsx:148-174` independently reimplement the identical label-drag scrub gesture (same `delta/2` step math, same shift-key 10x multiplier, same mousemove/mouseup lifecycle). ~25 lines duplicated verbatim across two files means every future tweak (e.g. touch support, drag-lock cursor) has to be done twice and will drift. Extract to a shared `useDragScrub(value, step, onChange)` hook in `src/panel/controls/`.
3. **Orphaned message plumbing behind the same removal** — `GET_PAGE_TOKENS` / `PAGE_TOKENS_RESPONSE` / `APPLY_TOKEN` (`src/shared/messages.ts:88-90`) still have live handlers in `src/content/main.ts:417-424`, the `collectPageTokens`/`setTokenOverride`/`getTokenValue` functions in `src/content/style-bridge.ts`, and a case block in `src/background/service-worker.ts:141-150` — but the only caller was `TokensTab.tsx`, which is itself dead (see #1). This is a full request/response round-trip (content script → background → panel) with no remaining sender. Delete alongside #1, or the next feature bolted onto "tokens" will build on plumbing nobody is exercising.

## 2. Design System & UI Consistency

- `StrokeSection.tsx:172` and `FillSection.tsx:72` both hardcode the literal `"#4f9eff"` as the seed color when switching to a gradient — but `panel.css` already defines this exact value as `--pd-accent`. Two independent hardcoded copies of a token that exists specifically to avoid this. Replace both with a shared constant (e.g. `DEFAULT_GRADIENT_SEED` importing from a small `src/panel/controls/constants.ts`, or reading the CSS var) so the seed color and the accent token can't drift apart.
- No other significant token/hardcoded-style drift found — the rest of `src/panel` consistently uses `--pd-*` CSS custom properties; remaining inline `style={{}}` usages are legitimately dynamic (color swatch fills, slider thumb position).

## 3. Status of Previous Flags

N/A — this is the first run; no prior report to diff against.

## 4. Suggested Action/Execution Plan

`claude "Delete the dead Tokens tab code (TokensTab.tsx, AITab.tsx, tokens.css, ai.css) and its now-orphaned GET_PAGE_TOKENS/PAGE_TOKENS_RESPONSE/APPLY_TOKEN message plumbing in messages.ts, content/main.ts, content/style-bridge.ts, and background/service-worker.ts, then extract the duplicated drag-scrub logic in NumberInput.tsx and UnitInput.tsx into a shared useDragScrub hook, and replace the hardcoded #4f9eff seed colors in StrokeSection.tsx and FillSection.tsx with the existing --pd-accent token"`
