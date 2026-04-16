/**
 * Left-aligned, in-page "Layers" pane — a Figma-like tree of the host page's
 * DOM. Injected by the content script (no React). Click a row to select that
 * element on the page; the existing selection overlay and right side panel
 * react through the normal ELEMENT_SELECTED flow.
 *
 * Everything inside the pane uses the __pd-layers- class prefix so that the
 * element picker + overlay helpers can ignore it (see overlay.ts and
 * element-picker.ts). The pane is mounted on document.documentElement using
 * position: fixed and a high z-index (one below the overlay handles).
 */

import { selectElementDirectly } from "./element-picker";
import { showHover, hideHover } from "./overlay";

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
/** Map from live Element -> its rendered row, used for highlight + scrollIntoView. */
const rowForElement = new WeakMap<Element, HTMLDivElement>();

let currentSelected: Element | null = null;

// --- CSS (inline so we don't have to plumb a new file through Vite) ---

const LAYERS_CSS = `
.${LAYERS_PANE_PREFIX}root {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 260px !important;
  height: 100vh !important;
  z-index: 2147483646 !important;
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
  closeBtn.addEventListener("click", () => {
    try {
      chrome.runtime.sendMessage({
        type: "TOGGLE_LAYERS_PANE",
        enabled: false,
      });
    } catch {
      /* extension context may be gone */
    }
    unmountLayersPanel();
  });
  header.appendChild(closeBtn);
  root.appendChild(header);

  treeContainer = document.createElement("div");
  treeContainer.className = `${LAYERS_PANE_PREFIX}tree`;
  root.appendChild(treeContainer);

  document.documentElement.appendChild(root);

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
}

function renderNode(el: Element, depth: number, parentEl: HTMLElement): void {
  if (!shouldShow(el)) return;

  const row = document.createElement("div");
  row.className = `${LAYERS_PANE_PREFIX}row`;
  if (el === currentSelected) {
    row.classList.add(`${LAYERS_PANE_PREFIX}row--selected`);
  }
  row.style.setProperty("padding-left", `${depth * INDENT_PX + 4}px`, "important");

  const kids = visibleChildren(el);
  const hasKids = kids.length > 0;
  const isOpen = expanded.has(el);

  const chevron = document.createElement("span");
  chevron.className = `${LAYERS_PANE_PREFIX}chevron`;
  if (!hasKids) {
    chevron.classList.add(`${LAYERS_PANE_PREFIX}chevron--leaf`);
    chevron.textContent = "•";
  } else {
    chevron.textContent = isOpen ? "▾" : "▸";
  }
  chevron.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!hasKids) return;
    if (isOpen) expanded.delete(el);
    else expanded.add(el);
    renderTree();
  });
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

  row.addEventListener("click", (e) => {
    e.stopPropagation();
    // Selecting re-expands the node so we can see what we just selected.
    if (hasKids) expanded.add(el);
    currentSelected = el;
    renderTree();
    try {
      selectElementDirectly(el);
    } catch {
      /* picker may not be active */
    }
    onSelectCallback?.(el);
  });
  row.addEventListener("mouseenter", () => {
    try {
      showHover(el.getBoundingClientRect());
    } catch {
      /* ignore */
    }
  });
  row.addEventListener("mouseleave", () => {
    try {
      if (el !== currentSelected) hideHover();
      else hideHover();
    } catch {
      /* ignore */
    }
  });

  rowForElement.set(el, row);
  parentEl.appendChild(row);

  if (hasKids && isOpen) {
    const renderCount = Math.min(kids.length, CHILDREN_RENDER_CAP);
    for (let i = 0; i < renderCount; i++) {
      renderNode(kids[i], depth + 1, parentEl);
    }
    if (kids.length > CHILDREN_RENDER_CAP) {
      const more = document.createElement("div");
      more.className = `${LAYERS_PANE_PREFIX}more`;
      more.style.setProperty(
        "padding-left",
        `${(depth + 1) * INDENT_PX + 18}px`,
        "important"
      );
      const remaining = kids.length - CHILDREN_RENDER_CAP;
      more.textContent = `Show ${remaining} more…`;
      more.addEventListener("click", () => {
        // Simple approach: bump the cap for this parent by re-rendering all
        // children in a follow-up click. For the first pass, just render
        // everything — user asked for it explicitly.
        for (let i = CHILDREN_RENDER_CAP; i < kids.length; i++) {
          renderNode(kids[i], depth + 1, parentEl);
        }
        more.remove();
      });
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
