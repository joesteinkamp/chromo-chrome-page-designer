# Daily Repo Opportunity Scan: 2026-09-14

_First run — no `.ai/previous_review.md` existed. Baseline established below; future scans will diff against this._

## 1. Net-New Opportunities (High Priority)

1. **Dead tab components never deleted (718 lines).** `src/panel/components/TokensTab.tsx` (172 lines) and `src/panel/components/AITab.tsx` (546 lines) are unimported anywhere in `src/` — confirmed via repo-wide grep. Commit `e39c7ac` ("Remove Tokens and AI tabs...") ripped out the `App.tsx` wiring and `SidebarPreview.tsx` references but left the component files on disk. They carry no tests, ship no value, and will actively mislead the next contributor who "fixes" one thinking it's live. Delete both files.
2. **`App.tsx` is a 664-line monolith.** It's the largest file in `src/panel` by a wide margin (next is `ColorPicker.tsx` at 695, which is itself a control, not a screen). App.tsx mixes routing/tab-state, message-listener wiring, and multi-select "Mixed" logic in one component. As more sections get added (Effects, Layers, Style Presets all landed in the last few PRs), this file will keep absorbing state. Extracting tab-switch/message-handling into a `usePanelMessages` hook (pattern already exists — see `src/panel/hooks/`) would cut it under 400 lines with no behavior change.
3. **`CHANGELOG.md` "Removed" entry is stale/misleading.** It says "Tokens and AI tabs from the panel... as they are no longer valuable enough" but the files remain in the tree — the changelog documents intent, not actual state. Low effort, but worth fixing alongside item 1 so the changelog stays trustworthy.

## 2. Design System & UI Consistency

- `src/design-system/` has only 2 files (`index.tsx`, `SidebarPreview.tsx`) — it's not a real component library, it's a preview harness. Meanwhile `src/panel/controls/` (10 files) holds the actual reusable primitives (NumberInput, SliderInput, ColorPicker, UnitInput, SelectDropdown, etc.) with no shared export surface or naming convention documented. Nothing broken today, but as sections keep growing (Shadow, Stroke, AutoLayout, CornerRadius all reimplement similar input-row layouts), a `src/panel/controls/index.ts` barrel plus a short "when to use which input" note would reduce the risk of a new section hand-rolling another one-off number field.
- Color parsing logic (`hexToRgba`, `parseCSSColor`, `hexToHsl`) lives entirely inside `ColorPicker.tsx` (695 lines) rather than `src/shared/`. `GradientEditor.tsx` (253 lines) almost certainly needs the same conversions for its stops — worth confirming it doesn't already duplicate a parser before it grows further. Not urgent, but flagging before a second gradient-adjacent feature forks the logic.

## 3. Status of Previous Flags

N/A — this is the first scan.

## 4. Suggested Action/Execution Plan

```bash
claude -p "Delete src/panel/components/TokensTab.tsx and src/panel/components/AITab.tsx (confirmed unused, orphaned by commit e39c7ac), update the CHANGELOG.md Removed entry to reflect the actual deletion, then run npm run typecheck to confirm nothing references them."
```
