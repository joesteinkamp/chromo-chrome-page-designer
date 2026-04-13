/**
 * Move-mode — centralized state for element movement mode.
 *
 * Two modes:
 *   "position" — pixel movement via CSS top/left
 *   "reorder"  — DOM sibling reordering (works for any parent, not just
 *               flex/grid — e.g. swapping two <div>s in normal block flow)
 *
 * Reorder is the default whenever reordering is possible. The user's most
 * recent explicit choice (via the toolbar buttons or P/R shortcuts) is
 * remembered and reapplied to subsequent selections, so clicking a new
 * element doesn't revert their preferred mode.
 *
 * Renders a floating toolbar at the bottom center of the viewport
 * (like Figma's toolbar) showing the current mode with a toggle.
 */

export type MoveMode = "position" | "reorder";

let currentMode: MoveMode = "position";
let toolbar: HTMLDivElement | null = null;
let posBtn: HTMLButtonElement | null = null;
let reorderBtn: HTMLButtonElement | null = null;
let hintSpan: HTMLSpanElement | null = null;
let currentElement: HTMLElement | null = null;
let canReorder = false;
let onModeChangeCb: ((mode: MoveMode) => void) | null = null;
// Sticky preference — tracks the user's last explicit mode choice so it
// persists across element selections. Null until the user picks a mode.
let preferredMode: MoveMode | null = null;

// --- Public API ---

export function getMode(): MoveMode {
  return currentMode;
}

export function setMode(mode: MoveMode): void {
  if (mode === "reorder" && !canReorder) return;
  preferredMode = mode;
  if (mode === currentMode) return;
  currentMode = mode;
  updateToolbarState();
  onModeChangeCb?.(mode);
}

export function isAutoLayoutParent(element: Element): boolean {
  const parent = element.parentElement;
  if (!parent) return false;
  const d = window.getComputedStyle(parent).display;
  return d === "flex" || d === "inline-flex" || d === "grid" || d === "inline-grid";
}

/**
 * Whether reorder mode is meaningful for this element.
 *
 * Reorder works on any element that has a parent and isn't a top-level
 * structural node (body/html). This is broader than isAutoLayoutParent —
 * swapping two sibling <div>s in normal block flow is a valid reorder.
 */
export function canReorderElement(element: Element): boolean {
  const parent = element.parentElement;
  if (!parent) return false;
  if (element === document.body || element === document.documentElement) return false;
  return true;
}

export function showMoveToolbar(
  element: HTMLElement,
  onModeChange: (mode: MoveMode) => void
): void {
  hideMoveToolbar();

  currentElement = element;
  onModeChangeCb = onModeChange;
  canReorder = canReorderElement(element);
  // Honor the user's last explicit mode choice when it's valid for this
  // element; otherwise default to reorder whenever possible.
  if (preferredMode === "reorder" && canReorder) {
    currentMode = "reorder";
  } else if (preferredMode === "position") {
    currentMode = "position";
  } else {
    currentMode = canReorder ? "reorder" : "position";
  }

  toolbar = document.createElement("div");
  toolbar.className = "__pd-move-toolbar";

  // Position button
  posBtn = makeBtn("Position", () => setMode("position"));
  toolbar.appendChild(posBtn);

  // Reorder button
  reorderBtn = makeBtn("Reorder", () => setMode("reorder"));
  toolbar.appendChild(reorderBtn);

  // Hint
  hintSpan = document.createElement("span");
  hintSpan.className = "__pd-move-toolbar__hint";
  toolbar.appendChild(hintSpan);

  updateToolbarState();
  document.documentElement.appendChild(toolbar);
}

export function hideMoveToolbar(): void {
  toolbar?.remove();
  toolbar = null;
  posBtn = null;
  reorderBtn = null;
  hintSpan = null;
  currentElement = null;
  onModeChangeCb = null;
}

export function hasMoveToolbar(): boolean {
  return toolbar !== null;
}

// --- Internal ---

function makeBtn(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.className = "__pd-move-toolbar__btn";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  });
  btn.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });
  return btn;
}

function updateToolbarState(): void {
  if (!posBtn || !reorderBtn || !hintSpan) return;

  // Position button
  posBtn.classList.toggle("__pd-move-toolbar__btn--active", currentMode === "position");

  // Reorder button
  reorderBtn.classList.toggle("__pd-move-toolbar__btn--active", currentMode === "reorder");
  reorderBtn.classList.toggle("__pd-move-toolbar__btn--disabled", !canReorder);

  // Hint text
  if (currentMode === "position") {
    hintSpan.textContent = canReorder ? "R" : "";
  } else {
    hintSpan.textContent = "P";
  }
}
