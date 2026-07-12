# Changelog

## [Unreleased]

### Added

- Multi-shadow effects list: stack drop and inset shadows with per-layer color/X/Y/blur/spread controls and add/remove.
- Background (backdrop) blur slider beside Layer blur; blend-mode menu including plus-lighter in the section now named Appearance; italic toggle in Typography.
- Aspect-ratio lock between W and H that co-writes proportional values as one undoable batch, resets per selection, and disables on non-px values.
- Layers tree shows framework component names (Figma purple) on component-root rows and a hover eye that hides/shows elements as undoable changes.
- Design-token swatches bind var(--name) instead of baking in the resolved value, so exported changesets speak the codebase's design system.
- Marquee (rubber-band) selection: drag from empty page space to select the intersecting elements at the enclosing container's level.
- Multi-select property editing with Figma-style "Mixed" placeholders across all panel controls — numeric fields, units, colors, dropdowns, and sliders; committing a value applies to the whole selection as one undo step.
- Right-click context menu with keyboard shortcuts as labels; commands act on the full selection, and right-clicking outside the selection selects the target first.
- Figma-style selection model: click selects at container depth with level memory, double-click drills into children (inline text edit on leaves), Cmd/Ctrl+click selects the deepest element, and the hover outline previews what a click will select. On pages without sectioning tags, the first click resolves to the highest non-page-sized ancestor rather than a leaf.
- Smart alignment guides and snapping while dragging — sibling and parent edges/centers within 5px attract the dragged box, with red guide lines; holding Cmd/Ctrl temporarily disables snapping.
- Alt+hover distance measurement between the selection and any hovered element, on both axes, for separated and nested boxes.
- Alt+drag duplicates the element; selection follows the copy and the whole gesture is a single undo step.
- Element copy/paste (Cmd+C/V) — pastes into the selected container, or after non-container selections — and a style clipboard (Cmd+Alt+C/V) carrying paint/text/effect properties without touching layout.
- Numeric panel inputs: Shift+arrow and Shift+scrub step ×10, and math expressions ("100+24", "300/2") evaluate on commit.
- Expanded the panel's empty-state hint grid to teach the new gestures.

### Changed

- Hide element rebound from Cmd+H to Shift+Cmd+H — macOS reserves Cmd+H, so the old binding never reached the page.
- Esc now selects the parent element (Figma-style climb out of a deep selection), deselecting only at the top level.

### Fixed

- Undoing the hide of an SVG element no longer wedges the entire undo stack; the layers eye stays in sync with undo/redo.
- Blur sliders preserve other filter functions (e.g. saturate()) instead of overwriting the whole filter list.
- Multi-selection state no longer desyncs between the panel and the page after the first edit, and the "Mixed" sentinel can never be committed as literal CSS.
- Batched gestures undo as one step: duplicate/move changes now join undo batches, style-change coalescing respects batch boundaries, and cancelled drags no longer leak an open batch into later edits.
- Undo after an alt-drag reorder no longer removes the wrong element (duplicate changes keep live clone references).
- Redo and saved-session replay of pastes/duplicates re-insert at the recorded destination instead of next to the source; duplicates now replay at all.
- The click that ends a drag no longer re-selects whatever sits under the cursor.
- Alt-measure lines clear on scroll, window blur, and when hovering the overlay UI instead of stranding at stale positions.
- Sibling-distance and measurement overlays unified on a single measurement red with larger, legible labels.
