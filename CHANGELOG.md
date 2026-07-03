# Changelog

## [Unreleased]

### Added

- Figma-style selection model: click selects at container depth with level memory, double-click drills into children (inline text edit on leaves), Cmd/Ctrl+click selects the deepest element, and the hover outline previews what a click will select. On pages without sectioning tags, the first click resolves to the highest non-page-sized ancestor rather than a leaf.
- Smart alignment guides and snapping while dragging — sibling and parent edges/centers within 5px attract the dragged box, with red guide lines; holding Cmd/Ctrl temporarily disables snapping.
- Alt+hover distance measurement between the selection and any hovered element, on both axes, for separated and nested boxes.
- Alt+drag duplicates the element; selection follows the copy and the whole gesture is a single undo step.
- Element copy/paste (Cmd+C/V) — pastes into the selected container, or after non-container selections — and a style clipboard (Cmd+Alt+C/V) carrying paint/text/effect properties without touching layout.
- Numeric panel inputs: Shift+arrow and Shift+scrub step ×10, and math expressions ("100+24", "300/2") evaluate on commit.
- Expanded the panel's empty-state hint grid to teach the new gestures.

### Changed

- Esc now selects the parent element (Figma-style climb out of a deep selection), deselecting only at the top level.

### Fixed

- Batched gestures undo as one step: duplicate/move changes now join undo batches, style-change coalescing respects batch boundaries, and cancelled drags no longer leak an open batch into later edits.
- Undo after an alt-drag reorder no longer removes the wrong element (duplicate changes keep live clone references).
- Redo and saved-session replay of pastes/duplicates re-insert at the recorded destination instead of next to the source; duplicates now replay at all.
- The click that ends a drag no longer re-selects whatever sits under the cursor.
- Alt-measure lines clear on scroll, window blur, and when hovering the overlay UI instead of stranding at stale positions.
- Sibling-distance and measurement overlays unified on a single measurement red with larger, legible labels.
