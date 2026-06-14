/**
 * Left-aligned, in-page "Layers" pane — a Figma-like tree of the host page's
 * DOM. Injected by the content script (no React). Click a row to select that
 * element on the page; the existing selection overlay and right side panel
 * react through the normal ELEMENT_SELECTED flow.
 *
 * Everything inside the pane uses the __pd-layers- class prefix so that the
 * element picker + overlay helpers can ignore it (see overlay.ts and
 * element-picker.ts). The pane is mounted on document.documentElement using
 * position: fixed and the highest z-index (above the overlay handles).
 */

import { selectElementDirectly, suspendPicker, resumePicker } from "./element-picker";
import { showHover, hideHover } from "./overlay";
import { recordMoveChange } from "./change-tracker";
import { generateSelector } from "../shared/selector";

/** Prefix for every element we inject; used by overlay helpers to skip us. */
export const LAYERS_PANE_PREFIX = "__pd-layers-";

const ROW_HEIGHT = 22;
const INDENT_PX = 14;
const CHILDREN_RENDER_CAP = 200;

let root: HTMLDivElement | null = null;
let treeContainer: HTMLDivElement | null = null;
let onSelectCallback: ((el: Element) => void) | null = null;
let mutationObserver: MutationObserver | null = null;
let rerenderRaf: number | null = null;

/** Elements whose children are expanded in the tree. */
const expanded = new WeakSet<Element>();
/** Elements whose child-render cap has been lifted (user clicked "Show more"). */
const uncapped = new WeakSet<Element>();
/** Map from live Element -> its rendered row, used for highlight + scrollIntoView. */
const rowForElement = new WeakMap<Element, HTMLDivElement>();
/** Reverse: row DIV -> live Element, used for event delegation. */
const rowToElement = new WeakMap<HTMLDivElement, Element>();

let currentSelected: Element | null = null;

/** Active search query (lowercased), empty when not filtering. */
let searchQuery = "";
/** Elements matching the active query, or null when not searching. */
let searchMatch: Set<Element> | null = null;
/** Ancestors of matches, kept visible to preserve tree structure. */
let searchAncestor: Set<Element> = new Set();
let searchInput: HTMLInputElement | null = null;
let searchDebounce: number | null = null;

// --- CSS (inline so we don't have to plumb a new file through Vite) ---

const LAYERS_CSS = `
.${LAYERS_PANE_PREFIX}root {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 260px !important;
  height: 100vh !important;
  z-index: 2147483647 !important;
  background: #1e1e1e !important;
  color: #e6e6e6 !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  font-size: 12px !important;
  line-height: 1.4 !important;
  border-right: 1px solid #333 !important;
  box-shadow: 2px 0 8px rgba(0,0,0,0.25) !important;
  display: flex !important;
  flex-direction: column !important;
  box-sizing: border-box !important;
  pointer-events: auto !important;
  -webkit-font-smoothing: antialiased !important;
}
.${LAYERS_PANE_PREFIX}root * {
  box-sizing: border-box !important;
}
.${LAYERS_PANE_PREFIX}header {
  flex: 0 0 auto !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 8px 10px !important;
  border-bottom: 1px solid #2a2a2a !important;
  font-weight: 600 !important;
  letter-spacing: 0.02em !important;
  text-transform: uppercase !important;
  font-size: 11px !important;
  color: #b4b4b4 !important;
  user-select: none !important;
}
.${LAYERS_PANE_PREFIX}close {
  background: transparent !important;
  border: none !important;
  color: #888 !important;
  cursor: pointer !important;
  font-size: 14px !important;
  line-height: 1 !important;
  padding: 2px 6px !important;
  border-radius: 3px !important;
}
.${LAYERS_PANE_PREFIX}close:hover {
  background: #2d2d2d !important;
  color: #fff !important;
}
.${LAYERS_PANE_PREFIX}search {
  flex: 0 0 auto !important;
  margin: 6px 8px !important;
  padding: 5px 8px !important;
  background: #2a2a2a !important;
  border: 1px solid #3a3a3a !important;
  border-radius: 4px !important;
  color: #e6e6e6 !important;
  font-size: 12px !important;
  font-family: inherit !important;
  outline: none !important;
}
.${LAYERS_PANE_PREFIX}search:focus {
  border-color: #0c8ce9 !important;
}
.${LAYERS_PANE_PREFIX}search::placeholder {
  color: #777 !important;
}
.${LAYERS_PANE_PREFIX}row--match {
  background: rgba(216, 168, 45, 0.18) !important;
}
.${LAYERS_PANE_PREFIX}empty {
  padding: 12px 12px !important;
  color: #888 !important;
  font-style: italic !important;
  font-size: 11px !important;
}
.${LAYERS_PANE_PREFIX}tree {
  flex: 1 1 auto !important;
  overflow-y: auto !important;
  overflow-x: auto !important;
  padding: 4px 0 !important;
}
.${LAYERS_PANE_PREFIX}tree::-webkit-scrollbar {
  width: 10px !important;
  height: 10px !important;
}
.${LAYERS_PANE_PREFIX}tree::-webkit-scrollbar-thumb {
  background: #3a3a3a !important;
  border-radius: 5px !important;
}
.${LAYERS_PANE_PREFIX}tree::-webkit-scrollbar-track {
  background: transparent !important;
}
.${LAYERS_PANE_PREFIX}tree::-webkit-scrollbar-corner {
  background: #1e1e1e !important;
}
.${LAYERS_PANE_PREFIX}row {
  display: flex !important;
  align-items: center !important;
  height: ${ROW_HEIGHT}px !important;
  padding-right: 8px !important;
  white-space: nowrap !important;
  cursor: pointer !important;
  color: #d0d0d0 !important;
}
.${LAYERS_PANE_PREFIX}row:hover {
  background: #2a2a2a !important;
}
.${LAYERS_PANE_PREFIX}row.${LAYERS_PANE_PREFIX}row--selected {
  background: #0b5cad !important;
  color: #fff !important;
}
.${LAYERS_PANE_PREFIX}chevron {
  flex: 0 0 auto !important;
  width: 14px !important;
  text-align: center !important;
  color: #888 !important;
  font-size: 10px !important;
  user-select: none !important;
}
.${LAYERS_PANE_PREFIX}row:hover .${LAYERS_PANE_PREFIX}chevron {
  color: #bbb !important;
}
.${LAYERS_PANE_PREFIX}row--selected .${LAYERS_PANE_PREFIX}chevron {
  color: #cfe4fb !important;
}
.${LAYERS_PANE_PREFIX}chevron--leaf {
  visibility: hidden !important;
}
.${LAYERS_PANE_PREFIX}tag {
  color: #569cd6 !important;
}
.${LAYERS_PANE_PREFIX}row--selected .${LAYERS_PANE_PREFIX}tag {
  color: #fff !important;
}
.${LAYERS_PANE_PREFIX}id {
  color: #d7ba7d !important;
  margin-left: 4px !important;
}
.${LAYERS_PANE_PREFIX}cls {
  color: #4ec9b0 !important;
  margin-left: 4px !important;
}
.${LAYERS_PANE_PREFIX}count {
  margin-left: auto !important;
  padding-left: 8px !important;
  color: #6b6b6b !important;
  font-variant-numeric: tabular-nums !important;
}
.${LAYERS_PANE_PREFIX}row--selected .${LAYERS_PANE_PREFIX}count {
  color: #cfe4fb !important;
}
.${LAYERS_PANE_PREFIX}more {
  padding: 4px 0 4px 0 !important;
  color: #888 !important;
  font-style: italic !important;
  cursor: pointer !important;
  height: ${ROW_HEIGHT}px !important;
  display: flex !important;
  align-items: center !important;
}
.${LAYERS_PANE_PREFIX}more:hover {
  color: #ccc !important;
  background: #2a2a2a !important;
}
.${LAYERS_PANE_PREFIX}row--drop-before {
  box-shadow: inset 0 2px 0 #0c8ce9 !important;
}
.${LAYERS_PANE_PREFIX}row--drop-after {
  box-shadow: inset 0 -2px 0 #0c8ce9 !important;
}
.${LAYERS_PANE_PREFIX}row--drop-into {
  outline: 1px solid #0c8ce9 !important;
  outline-offset: -1px !important;
  background: rgba(12, 140, 233, 0.15) !important;
}
.${LAYERS_PANE_PREFIX}root--dragging,
.${LAYERS_PANE_PREFIX}root--dragging .${LAYERS_PANE_PREFIX}row {
  cursor: grabbing !important;
}

/* ── Light mode overrides ── */
@media (prefers-color-scheme: light) {
  .${LAYERS_PANE_PREFIX}root {
    background: #ffffff !important;
    color: #1a1a1a !important;
    border-right-color: #e5e5e5 !important;
    box-shadow: 2px 0 8px rgba(0,0,0,0.06) !important;
  }
  .${LAYERS_PANE_PREFIX}header {
    border-bottom-color: #e5e5e5 !important;
    color: #666 !important;
  }
  .${LAYERS_PANE_PREFIX}search {
    background: #f4f4f4 !important;
    border-color: #d8d8d8 !important;
    color: #1a1a1a !important;
  }
  .${LAYERS_PANE_PREFIX}row--match {
    background: rgba(216, 168, 45, 0.28) !important;
  }
  .${LAYERS_PANE_PREFIX}close {
    color: #999 !important;
  }
  .${LAYERS_PANE_PREFIX}close:hover {
    background: #ebebeb !important;
    color: #1a1a1a !important;
  }
  .${LAYERS_PANE_PREFIX}tree::-webkit-scrollbar-thumb {
    background: #ccc !important;
  }
  .${LAYERS_PANE_PREFIX}tree::-webkit-scrollbar-corner {
    background: #ffffff !important;
  }
  .${LAYERS_PANE_PREFIX}row {
    color: #333 !important;
  }
  .${LAYERS_PANE_PREFIX}row:hover {
    background: #f0f0f0 !important;
  }
  .${LAYERS_PANE_PREFIX}row.${LAYERS_PANE_PREFIX}row--selected {
    background: #0c8ce9 !important;
    color: #fff !important;
  }
  .${LAYERS_PANE_PREFIX}chevron {
    color: #999 !important;
  }
  .${LAYERS_PANE_PREFIX}row:hover .${LAYERS_PANE_PREFIX}chevron {
    color: #666 !important;
  }
  .${LAYERS_PANE_PREFIX}tag {
    color: #2563b0 !important;
  }
  .${LAYERS_PANE_PREFIX}id {
    color: #9a6e2e !important;
  }
  .${LAYERS_PANE_PREFIX}cls {
    color: #1a7a5e !important;
  }
  .${LAYERS_PANE_PREFIX}count {
    color: #aaa !important;
  }
  .${LAYERS_PANE_PREFIX}more {
    color: #999 !important;
  }
  .${LAYERS_PANE_PREFIX}more:hover {
    color: #666 !important;
    background: #f0f0f0 !important;
  }
}
`;

// --- Lifecycle ---

export function isMounted(): boolean {
  return root !== null;
}

export function mountLayersPanel(onSelect: (el: Element) => void): void {
  if (root) return;
  onSelectCallback = onSelect;

  // Inject stylesheet once per page
  const styleId = `${LAYERS_PANE_PREFIX}style`;
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = LAYERS_CSS;
    document.documentElement.appendChild(style);
  }

  root = document.createElement("div");
  root.className = `${LAYERS_PANE_PREFIX}root`;
  root.setAttribute("role", "tree");
  root.setAttribute("aria-label", "Page hierarchy");

  const header = document.createElement("div");
  header.className = `${LAYERS_PANE_PREFIX}header`;
  header.textContent = "Layers";
  const closeBtn = document.createElement("button");
  closeBtn.className = `${LAYERS_PANE_PREFIX}close`;
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.title = "Hide layers pane";
  closeBtn.setAttribute("data-pd-layers-close", "1");
  header.appendChild(closeBtn);
  root.appendChild(header);

  searchInput = document.createElement("input");
  searchInput.className = `${LAYERS_PANE_PREFIX}search`;
  searchInput.type = "text";
  searchInput.placeholder = "Search layers (tag, #id, .class)…";
  searchInput.setAttribute("data-pd-layers-search", "1");
  searchInput.setAttribute("aria-label", "Search layers");
  searchInput.addEventListener("input", () => {
    if (searchDebounce !== null) clearTimeout(searchDebounce);
    searchDebounce = window.setTimeout(() => {
      searchDebounce = null;
      setSearchQuery(searchInput!.value);
    }, 150);
  });
  root.appendChild(searchInput);

  treeContainer = document.createElement("div");
  treeContainer.className = `${LAYERS_PANE_PREFIX}tree`;
  root.appendChild(treeContainer);

  document.documentElement.appendChild(root);

  // All interaction inside the pane is dispatched from window-level CAPTURE
  // listeners — the very first stop on the capture path, ahead of host-page
  // listeners on document or any element (host pages register their document
  // capture handlers at page load, before this content script injects, so a
  // document-level dispatcher loses the race and pane clicks die on SPAs).
  // Selection is additionally driven by our own mousedown→mouseup tracking
  // (onPressUp) rather than the `click` event, which host pages can cancel.
  //
  // Order matters: press tracking is registered BEFORE the dispatcher —
  // same-phase listeners on the same target run in registration order, and
  // the dispatcher stops immediate propagation for pane-targeted events.
  // Shield typing in the search box from the extension's own keyboard
  // shortcuts (keyboard.ts / element-picker.ts listen at document capture —
  // later than window capture) so e.g. typing "p"/"r" or Backspace doesn't
  // toggle move modes or delete the selected element.
  window.addEventListener("keydown", onPaneKeyDown, true);
  window.addEventListener("mousemove", onPressMove, true);
  window.addEventListener("mouseup", onPressUp, true);
  window.addEventListener("click", onWinPaneCapture, true);
  window.addEventListener("mousedown", onWinPaneCapture, true);
  window.addEventListener("mouseup", onWinPaneCapture, true);
  window.addEventListener("mouseover", onWinPaneCapture, true);
  window.addEventListener("mouseout", onWinPaneCapture, true);

  // Start collapsed except ancestors of current selection (if any).
  // By default, expand <html> so <body> is visible.
  if (document.documentElement) expanded.add(document.documentElement);
  if (document.body) expanded.add(document.body);
  if (currentSelected) expandAncestors(currentSelected);

  renderTree();

  mutationObserver = new MutationObserver((mutations) => {
    // Ignore mutations that are entirely inside our own pane
    let relevant = false;
    for (const m of mutations) {
      if (root && root.contains(m.target as Node)) continue;
      relevant = true;
      break;
    }
    if (!relevant) return;
    scheduleRender();
  });
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["id", "class"],
  });
}

export function unmountLayersPanel(): void {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  if (rerenderRaf !== null) {
    cancelAnimationFrame(rerenderRaf);
    rerenderRaf = null;
  }
  if (searchDebounce !== null) {
    clearTimeout(searchDebounce);
    searchDebounce = null;
  }
  searchQuery = "";
  searchMatch = null;
  searchAncestor = new Set();
  searchInput = null;
  window.removeEventListener("keydown", onPaneKeyDown, true);
  window.removeEventListener("mousemove", onPressMove, true);
  window.removeEventListener("mouseup", onPressUp, true);
  window.removeEventListener("click", onWinPaneCapture, true);
  window.removeEventListener("mousedown", onWinPaneCapture, true);
  window.removeEventListener("mouseup", onWinPaneCapture, true);
  window.removeEventListener("mouseover", onWinPaneCapture, true);
  window.removeEventListener("mouseout", onWinPaneCapture, true);
  dragSource = null;
  pressTarget = null;
  pressActive = false;
  isRowDragging = false;
  consumeNextClick = false;
  dropRow = null;
  root?.remove();
  root = null;
  treeContainer = null;
  onSelectCallback = null;
}

/** Called from main.ts whenever an element is selected (by click, keyboard, or
 *  programmatically). Expands ancestors and scrolls the row into view. */
export function setSelectedInTree(element: Element | null): void {
  currentSelected = element;
  if (!root) return;
  if (element) expandAncestors(element);
  renderTree();
  if (element) {
    const row = rowForElement.get(element);
    if (row && treeContainer) {
      const rRect = row.getBoundingClientRect();
      const cRect = treeContainer.getBoundingClientRect();
      if (rRect.top < cRect.top || rRect.bottom > cRect.bottom) {
        row.scrollIntoView({ block: "nearest" });
      }
    }
  }
}

// --- Search ---

/** Max matches scanned/collected per query, to bound work on huge pages. */
const SEARCH_MATCH_CAP = 500;

/** Does an element's tag, #id, or any .class contain the (lowercased) query? */
function matchesQuery(el: Element, q: string): boolean {
  if (el.tagName.toLowerCase().includes(q)) return true;
  const id = (el as HTMLElement).id;
  if (id && `#${id}`.toLowerCase().includes(q)) return true;
  for (const c of el.classList) {
    if (c.startsWith("__pd-")) continue;
    if (`.${c}`.toLowerCase().includes(q)) return true;
  }
  return false;
}

/** Recompute the match + ancestor sets for the active query. */
function setSearchQuery(raw: string): void {
  searchQuery = raw.trim().toLowerCase();
  if (!searchQuery) {
    searchMatch = null;
    searchAncestor = new Set();
    renderTree();
    return;
  }

  const match = new Set<Element>();
  const ancestor = new Set<Element>();
  const all = document.documentElement.getElementsByTagName("*");
  for (let i = 0; i < all.length && match.size < SEARCH_MATCH_CAP; i++) {
    const el = all[i];
    if (!shouldShow(el)) continue;
    if (!matchesQuery(el, searchQuery)) continue;
    match.add(el);
    let p = el.parentElement;
    while (p && p !== document.documentElement.parentElement) {
      ancestor.add(p);
      p = p.parentElement;
    }
  }
  searchMatch = match;
  searchAncestor = ancestor;
  renderTree();
}

// --- Rendering ---

function scheduleRender(): void {
  if (rerenderRaf !== null) return;
  rerenderRaf = requestAnimationFrame(() => {
    rerenderRaf = null;
    renderTree();
  });
}

function renderTree(): void {
  if (!treeContainer) return;
  treeContainer.textContent = "";
  const rootEl = document.documentElement;
  if (!rootEl) return;
  renderNode(rootEl, 0, treeContainer);
  if (searchMatch !== null && searchMatch.size === 0) {
    const empty = document.createElement("div");
    empty.className = `${LAYERS_PANE_PREFIX}empty`;
    empty.textContent = `No layers match “${searchQuery}”`;
    treeContainer.appendChild(empty);
  }
}

function renderNode(el: Element, depth: number, parentEl: HTMLElement): void {
  if (!shouldShow(el)) return;

  // While searching, render only matches and their ancestors.
  const searching = searchMatch !== null;
  const isMatch = searching && searchMatch!.has(el);
  if (searching && !isMatch && !searchAncestor.has(el)) return;

  const row = document.createElement("div");
  row.className = `${LAYERS_PANE_PREFIX}row`;
  row.setAttribute("data-pd-layers-row", "1");
  if (el === currentSelected) {
    row.classList.add(`${LAYERS_PANE_PREFIX}row--selected`);
  }
  if (isMatch) {
    row.classList.add(`${LAYERS_PANE_PREFIX}row--match`);
  }
  row.style.setProperty("padding-left", `${depth * INDENT_PX + 4}px`, "important");

  const kids = visibleChildren(el);
  const hasKids = kids.length > 0;
  // Force ancestors open while searching so matches are reachable.
  const isOpen = searching ? true : expanded.has(el);

  const chevron = document.createElement("span");
  chevron.className = `${LAYERS_PANE_PREFIX}chevron`;
  if (hasKids) {
    chevron.setAttribute("data-pd-layers-chevron", "1");
  }
  if (!hasKids) {
    chevron.classList.add(`${LAYERS_PANE_PREFIX}chevron--leaf`);
    chevron.textContent = "•";
  } else {
    chevron.textContent = isOpen ? "▾" : "▸";
  }
  row.appendChild(chevron);

  const tag = document.createElement("span");
  tag.className = `${LAYERS_PANE_PREFIX}tag`;
  tag.textContent = el.tagName.toLowerCase();
  row.appendChild(tag);

  if (el.id) {
    const id = document.createElement("span");
    id.className = `${LAYERS_PANE_PREFIX}id`;
    id.textContent = `#${el.id}`;
    row.appendChild(id);
  }

  const classes = Array.from(el.classList).filter(
    (c) => !c.startsWith("__pd-")
  );
  if (classes.length > 0) {
    const cls = document.createElement("span");
    cls.className = `${LAYERS_PANE_PREFIX}cls`;
    const shown = classes.slice(0, 2).map((c) => `.${c}`).join("");
    const overflow = classes.length > 2 ? ` +${classes.length - 2}` : "";
    cls.textContent = shown + overflow;
    row.appendChild(cls);
  }

  if (kids.length > 0) {
    const count = document.createElement("span");
    count.className = `${LAYERS_PANE_PREFIX}count`;
    count.textContent = String(kids.length);
    row.appendChild(count);
  }

  rowForElement.set(el, row);
  rowToElement.set(row, el);
  parentEl.appendChild(row);

  if (hasKids && isOpen) {
    // The render cap doesn't apply while searching — the match/ancestor filter
    // in renderNode already bounds how many children actually render, and a
    // match could otherwise sit past the cap and vanish.
    const cap = searching || uncapped.has(el) ? kids.length : CHILDREN_RENDER_CAP;
    const renderCount = Math.min(kids.length, cap);
    for (let i = 0; i < renderCount; i++) {
      renderNode(kids[i], depth + 1, parentEl);
    }
    if (kids.length > renderCount) {
      const more = document.createElement("div");
      more.className = `${LAYERS_PANE_PREFIX}more`;
      more.setAttribute("data-pd-layers-more", "1");
      rowToElement.set(more as unknown as HTMLDivElement, el);
      more.style.setProperty(
        "padding-left",
        `${(depth + 1) * INDENT_PX + 18}px`,
        "important"
      );
      const remaining = kids.length - renderCount;
      more.textContent = `Show ${remaining} more…`;
      parentEl.appendChild(more);
    }
  }
}

function shouldShow(el: Element): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (!tag) return false;
  // Skip our own overlays / pane / handles
  const cls = typeof el.className === "string" ? el.className : "";
  if (cls.includes("__pd-")) return false;
  if ((el as HTMLElement).id && (el as HTMLElement).id.startsWith("__pd-")) {
    return false;
  }
  // Skip <script>, <style>, <link>, <meta>, <noscript>, <template>
  if (
    tag === "SCRIPT" ||
    tag === "STYLE" ||
    tag === "LINK" ||
    tag === "META" ||
    tag === "NOSCRIPT" ||
    tag === "TEMPLATE"
  ) {
    return false;
  }
  return true;
}

function visibleChildren(el: Element): Element[] {
  const out: Element[] = [];
  for (const child of Array.from(el.children)) {
    if (shouldShow(child)) out.push(child);
  }
  return out;
}

function expandAncestors(el: Element): void {
  let p: Element | null = el.parentElement;
  while (p) {
    expanded.add(p);
    p = p.parentElement;
  }
}

/** Whether a given DOM node is part of the layers pane (for event filtering). */
export function isLayersPaneElement(el: Element | null): boolean {
  if (!el || !root) return false;
  return root === el || root.contains(el);
}

// --- Delegated event handling ---------------------------------------------

/**
 * Single window-level capture dispatcher. The window is the first target on
 * the capture path, so this runs before host-page capture listeners on
 * document/elements no matter when the host registered them. If the event
 * target is not inside the pane we do nothing and let other handlers run.
 * Otherwise we dispatch the pane's own logic and then stop propagation so
 * the host app never sees pane events.
 *
 * Row selection itself happens in onPressUp (mousedown→mouseup tracking),
 * NOT here — the `click` event is unreliable on pages that cancel it. The
 * click branch below only consumes the trailing click, with a direct-handle
 * fallback for clicks that arrive without tracked presses (synthetic events).
 */
function onWinPaneCapture(e: Event): void {
  if (!root) return;
  const path = e.composedPath();
  if (!path.includes(root)) return;

  const evt = e as MouseEvent;
  const tgt = evt.target as Element | null;

  if (evt.type === "click" && tgt) {
    if (consumeNextClick) {
      consumeNextClick = false;
    } else {
      handlePaneClick(tgt);
    }
  }
  else if (evt.type === "mousedown" && tgt) handlePaneMouseDown(tgt, evt);
  else if (evt.type === "mouseover" && tgt) handlePaneMouseOver(tgt);
  else if (evt.type === "mouseout" && tgt) handlePaneMouseOut(tgt, evt);

  // Shield the host app and any other listeners from pane-targeted pointer
  // events, whether or not we acted on them. stopImmediatePropagation
  // prevents every later listener (host capture handlers anywhere on the
  // path, the element picker's document listeners) from firing.
  e.stopImmediatePropagation();
  if (evt.type === "click" || evt.type === "mousedown") {
    // Don't preventDefault on the search box — that would block it from
    // receiving focus and the caret.
    if (!(tgt && tgt.closest("[data-pd-layers-search]"))) {
      evt.preventDefault();
    }
  }
}

/**
 * Keep keystrokes typed in the search box from reaching the extension's
 * document-capture keyboard handlers (move-mode toggles, delete, undo). Runs
 * at window capture, before those handlers, and stops propagation only for
 * search-targeted events so normal page/extension shortcuts are unaffected.
 */
function onPaneKeyDown(e: KeyboardEvent): void {
  if (!root) return;
  const tgt = e.target as Element | null;
  if (!tgt || !tgt.closest("[data-pd-layers-search]")) return;
  e.stopImmediatePropagation();
  if (e.key === "Escape") {
    if (searchInput) {
      searchInput.value = "";
      searchInput.blur();
    }
    setSearchQuery("");
  }
}

// --- Row drag-reorder ---------------------------------------------------
//
// Dragging a row moves the element in the live DOM: drop on the top/bottom
// quarter of a row inserts before/after that element (same- or cross-parent),
// drop on the middle appends it as the row element's last child. The move is
// recorded through the change tracker like a canvas reorder.

type DropZone = "before" | "after" | "into";

const DRAG_START_THRESHOLD = 4;

/** A left-button press started inside the pane is being tracked */
let pressActive = false;
/** Mousedown target of the tracked press, for click handling on mouseup */
let pressTarget: Element | null = null;
/** Swallow the browser's trailing click after we handled the press ourselves */
let consumeNextClick = false;
let dragSource: Element | null = null;
let dragStartX = 0;
let dragStartY = 0;
let isRowDragging = false;
let dropRow: HTMLDivElement | null = null;
let dropZone: DropZone = "before";

function handlePaneMouseDown(tgt: Element, evt: MouseEvent): void {
  if (evt.button !== 0) return;
  pressActive = true;
  pressTarget = tgt;
  dragStartX = evt.clientX;
  dragStartY = evt.clientY;
  isRowDragging = false;
  dragSource = null;

  // Arm drag-reorder only for draggable rows; chevron/close presses are
  // click-only. html/body can't be reparented.
  if (tgt.closest("[data-pd-layers-chevron]") || tgt.closest("[data-pd-layers-close]")) return;
  const rowEl = tgt.closest<HTMLDivElement>("[data-pd-layers-row]");
  if (!rowEl) return;
  const el = rowToElement.get(rowEl);
  if (!el || el === document.documentElement || el === document.body) return;
  dragSource = el;
}

function onPressMove(e: MouseEvent): void {
  if (!pressActive || !dragSource || !root) return;
  if (!isRowDragging) {
    if (
      Math.abs(e.clientX - dragStartX) < DRAG_START_THRESHOLD &&
      Math.abs(e.clientY - dragStartY) < DRAG_START_THRESHOLD
    ) {
      return;
    }
    isRowDragging = true;
    root.classList.add(`${LAYERS_PANE_PREFIX}root--dragging`);
    // Keep the element picker from reacting to the drag's mouse events —
    // releasing over the host page would otherwise select/deselect whatever
    // is under the cursor.
    try { suspendPicker(); } catch { /* picker may not be active */ }
  }
  e.preventDefault();
  e.stopImmediatePropagation();

  clearDropIndicator();
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const rowEl = under?.closest<HTMLDivElement>("[data-pd-layers-row]") ?? null;
  if (!rowEl) return;
  const targetEl = rowToElement.get(rowEl);
  if (!targetEl || targetEl === dragSource || dragSource.contains(targetEl)) return;

  // Nothing can be dropped relative to <html>, and "into" it would place the
  // element as a sibling of <head>/<body>.
  if (targetEl === document.documentElement) return;

  const rect = rowEl.getBoundingClientRect();
  const ratio = (e.clientY - rect.top) / rect.height;
  if (ratio < 0.25) dropZone = "before";
  else if (ratio > 0.75) dropZone = "after";
  else dropZone = "into";
  // Inserting before/after requires a parent; parentless rows only accept "into"
  if (dropZone !== "into" && !targetEl.parentElement) dropZone = "into";

  dropRow = rowEl;
  rowEl.classList.add(`${LAYERS_PANE_PREFIX}row--drop-${dropZone}`);
}

function onPressUp(e: MouseEvent): void {
  if (!pressActive) return;
  pressActive = false;
  root?.classList.remove(`${LAYERS_PANE_PREFIX}root--dragging`);

  const source = dragSource;
  const targetRow = dropRow;
  const zone = dropZone;
  const press = pressTarget;
  clearDropIndicator();
  dragSource = null;
  pressTarget = null;

  if (!isRowDragging) {
    // Simple press-release: handle the "click" right here on mouseup, so the
    // pane works even on pages that cancel or swallow click events. Only
    // counts when the release also lands inside the pane.
    const upTgt = e.target as Element | null;
    if (press && upTgt && root && (root === upTgt || root.contains(upTgt))) {
      e.preventDefault();
      e.stopImmediatePropagation();
      // Swallow the browser's trailing click — the interaction is done.
      consumeNextClick = true;
      setTimeout(() => { consumeNextClick = false; }, 0);
      handlePaneClick(upTgt);
    }
    return;
  }

  isRowDragging = false;
  consumeNextClick = true;
  setTimeout(() => { consumeNextClick = false; }, 0);
  // Resume the picker after the trailing click has been dispatched, so it
  // never sees the drag-release click.
  setTimeout(() => { try { resumePicker(); } catch { /* */ } }, 0);
  e.preventDefault();
  e.stopImmediatePropagation();

  if (!source || !targetRow) return;
  const target = rowToElement.get(targetRow);
  if (!target || target === source || source.contains(target)) return;

  const fromParent = source.parentElement;
  if (!fromParent) return;
  const fromParentSelector = generateSelector(fromParent);
  const fromIndex = Array.from(fromParent.children).indexOf(source);

  try {
    if (zone === "into") {
      target.appendChild(source);
      expanded.add(target);
    } else if (zone === "before") {
      target.parentElement!.insertBefore(source, target);
    } else {
      target.parentElement!.insertBefore(source, target.nextElementSibling);
    }
  } catch {
    return; // host page may forbid the move (e.g. table semantics)
  }

  const toParent = source.parentElement;
  if (!toParent) return;
  const toIndex = Array.from(toParent.children).indexOf(source);
  // Dropping "after" the previous sibling (or "before" the next) is a DOM
  // no-op — don't record a move that changes nothing.
  if (toParent === fromParent && toIndex === fromIndex) return;
  recordMoveChange(source, fromParentSelector, fromIndex, generateSelector(toParent), toIndex);

  // Re-select the moved element so the overlay and side panel follow it
  selectFromTree(source);
}

function clearDropIndicator(): void {
  if (!dropRow) return;
  dropRow.classList.remove(
    `${LAYERS_PANE_PREFIX}row--drop-before`,
    `${LAYERS_PANE_PREFIX}row--drop-after`,
    `${LAYERS_PANE_PREFIX}row--drop-into`
  );
  dropRow = null;
}

function handlePaneClick(tgt: Element): void {
  // Close button
  if (tgt.closest("[data-pd-layers-close]")) {
    try {
      chrome.runtime.sendMessage({
        type: "TOGGLE_LAYERS_PANE",
        enabled: false,
      });
    } catch {
      /* extension context may be gone */
    }
    unmountLayersPanel();
    return;
  }

  // "Show more" sibling expander
  const moreEl = tgt.closest<HTMLDivElement>("[data-pd-layers-more]");
  if (moreEl) {
    const parentNode = rowToElement.get(moreEl);
    if (parentNode) {
      uncapped.add(parentNode);
      renderTree();
    }
    return;
  }

  const rowEl = tgt.closest<HTMLDivElement>("[data-pd-layers-row]");
  if (!rowEl) return;
  const el = rowToElement.get(rowEl);
  if (!el) return;

  // Chevron → toggle expand. Anywhere else on the row → select.
  const chevron = tgt.closest("[data-pd-layers-chevron]");
  if (chevron) {
    if (expanded.has(el)) expanded.delete(el);
    else expanded.add(el);
    renderTree();
    return;
  }

  selectFromTree(el);
}

function selectFromTree(el: Element): void {
  // Ensure the selected node is expanded so its children are visible.
  const hadChildren = visibleChildren(el).length > 0;
  if (hadChildren) expanded.add(el);

  // 1. Update row highlight in place first — this has no external deps.
  setSelectedRow(el);

  // 2. Drive the picker + page overlay. Wrapped so that if the extension
  //    hasn't been activated (initOverlay never ran), a throw inside
  //    showSelection doesn't abort the rest of the selection flow.
  try {
    selectElementDirectly(el);
  } catch (err) {
    console.warn("[layers-panel] selectElementDirectly failed", err);
  }

  // 3. Scroll the page element into view if off-screen.
  try {
    const rect = el.getBoundingClientRect();
    const inView =
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth;
    if (!inView) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  } catch {
    /* element may not support scrollIntoView options */
  }

  // 4. Notify main.ts so the side panel updates, even if the page overlay
  //    couldn't render.
  onSelectCallback?.(el);
}

function setSelectedRow(el: Element | null): void {
  if (!treeContainer) return;
  const prev = treeContainer.querySelector(
    `.${LAYERS_PANE_PREFIX}row--selected`
  );
  prev?.classList.remove(`${LAYERS_PANE_PREFIX}row--selected`);
  currentSelected = el;
  if (!el) return;
  const row = rowForElement.get(el);
  row?.classList.add(`${LAYERS_PANE_PREFIX}row--selected`);
}

function handlePaneMouseOver(tgt: Element): void {
  const rowEl = tgt.closest<HTMLDivElement>("[data-pd-layers-row]");
  if (!rowEl) return;
  const el = rowToElement.get(rowEl);
  if (!el) return;
  try {
    showHover(el.getBoundingClientRect());
  } catch {
    /* ignore */
  }
}

function handlePaneMouseOut(tgt: Element, evt: MouseEvent): void {
  const rowEl = tgt.closest<HTMLDivElement>("[data-pd-layers-row]");
  if (!rowEl) return;
  const related = evt.relatedTarget as Element | null;
  // If the mouse is still inside some row, don't hide the page hover.
  if (related && related.closest?.("[data-pd-layers-row]")) return;
  hideHover();
}
