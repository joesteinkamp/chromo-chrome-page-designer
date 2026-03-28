/**
 * Manages the visual overlay elements (hover highlight, selection box, badges).
 * All overlay elements use __pd- prefixed classes and !important styles.
 */

let hoverOverlay: HTMLDivElement;
let selectionOverlay: HTMLDivElement;
let badge: HTMLDivElement;
let resizeHandles: HTMLDivElement[] = [];
let multiSelectOverlays: HTMLDivElement[] = [];

const HANDLE_POSITIONS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

export function initOverlay(): void {
  hoverOverlay = createDiv("__pd-overlay __pd-overlay--hover");
  selectionOverlay = createDiv("__pd-overlay __pd-overlay--selected");
  badge = createDiv("__pd-badge");

  // Create 8 resize handles
  const HANDLE_LABELS: Record<string, string> = {
    nw: "Resize from top-left",
    n: "Resize from top",
    ne: "Resize from top-right",
    e: "Resize from right",
    se: "Resize from bottom-right",
    s: "Resize from bottom",
    sw: "Resize from bottom-left",
    w: "Resize from left",
  };
  for (const pos of HANDLE_POSITIONS) {
    const handle = createDiv(`__pd-handle __pd-handle--${pos}`);
    handle.dataset.pdHandle = pos;
    handle.setAttribute("role", "slider");
    handle.setAttribute("aria-label", HANDLE_LABELS[pos] || `Resize ${pos}`);
    handle.setAttribute("tabindex", "0");
    resizeHandles.push(handle);
    document.documentElement.appendChild(handle);
  }

  hoverOverlay.setAttribute("role", "presentation");
  hoverOverlay.setAttribute("aria-hidden", "true");
  selectionOverlay.setAttribute("role", "presentation");
  selectionOverlay.setAttribute("aria-label", "Selected element outline");
  badge.setAttribute("role", "status");
  badge.setAttribute("aria-live", "polite");

  document.documentElement.appendChild(hoverOverlay);
  document.documentElement.appendChild(selectionOverlay);
  document.documentElement.appendChild(badge);
}

export function destroyOverlay(): void {
  hoverOverlay?.remove();
  selectionOverlay?.remove();
  badge?.remove();
  resizeHandles.forEach((h) => h.remove());
  resizeHandles = [];
}

export function showHover(rect: DOMRect): void {
  positionOverlay(hoverOverlay, rect);
  hoverOverlay.classList.add("__pd-overlay--visible");
}

export function hideHover(): void {
  hoverOverlay.classList.remove("__pd-overlay--visible");
}

export function showSelection(element: Element): void {
  const rect = element.getBoundingClientRect();
  positionOverlay(selectionOverlay, rect);
  selectionOverlay.classList.add("__pd-overlay--visible");

  // Badge with tag and dimensions
  const tag = element.tagName.toLowerCase();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  badge.textContent = `${tag}  ${w} × ${h}`;
  badge.style.cssText = `
    left: ${rect.left}px !important;
    top: ${Math.max(0, rect.top - 22)}px !important;
  `;
  badge.classList.add("__pd-badge--visible");

  // Position resize handles
  positionHandles(rect);
  resizeHandles.forEach((h) => h.classList.add("__pd-handle--visible"));
}

export function hideSelection(): void {
  selectionOverlay.classList.remove("__pd-overlay--visible");
  badge.classList.remove("__pd-badge--visible");
  resizeHandles.forEach((h) => h.classList.remove("__pd-handle--visible"));
}

export function updateSelection(element: Element): void {
  const rect = element.getBoundingClientRect();
  positionOverlay(selectionOverlay, rect);

  const tag = element.tagName.toLowerCase();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  badge.textContent = `${tag}  ${w} × ${h}`;
  badge.style.cssText = `
    left: ${rect.left}px !important;
    top: ${Math.max(0, rect.top - 22)}px !important;
  `;

  positionHandles(rect);
}

// --- Multi-edit overlays (dotted borders on matching elements) ---

let multiEditOverlays: HTMLDivElement[] = [];

export function showMultiEditOverlays(elements: Element[]): void {
  hideMultiEditOverlays();
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    const overlay = createDiv("__pd-overlay __pd-overlay--multi");
    positionOverlay(overlay, rect);
    overlay.classList.add("__pd-overlay--visible");
    document.documentElement.appendChild(overlay);
    multiEditOverlays.push(overlay);
  }
}

export function updateMultiEditOverlays(elements: Element[]): void {
  // Reposition existing overlays or recreate if count changed
  if (multiEditOverlays.length !== elements.length) {
    showMultiEditOverlays(elements);
    return;
  }
  for (let i = 0; i < elements.length; i++) {
    const rect = elements[i].getBoundingClientRect();
    positionOverlay(multiEditOverlays[i], rect);
  }
}

export function hideMultiEditOverlays(): void {
  multiEditOverlays.forEach((o) => o.remove());
  multiEditOverlays = [];
}

export function showMultiSelectOverlays(elements: Element[]): void {
  hideMultiSelectOverlays();
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    const overlay = createDiv("__pd-overlay __pd-overlay--multi-select");
    positionOverlay(overlay, rect);
    overlay.classList.add("__pd-overlay--visible");
    document.documentElement.appendChild(overlay);
    multiSelectOverlays.push(overlay);
  }
}

export function updateMultiSelectOverlays(elements: Element[]): void {
  if (multiSelectOverlays.length !== elements.length) {
    showMultiSelectOverlays(elements);
    return;
  }
  for (let i = 0; i < elements.length; i++) {
    const rect = elements[i].getBoundingClientRect();
    positionOverlay(multiSelectOverlays[i], rect);
  }
}

export function hideMultiSelectOverlays(): void {
  multiSelectOverlays.forEach((o) => o.remove());
  multiSelectOverlays = [];
}

/** Check if an element is part of our overlay */
export function isOverlayElement(el: Element): boolean {
  if (!el || !el.className || typeof el.className !== "string") return false;
  return el.className.includes("__pd-");
}

/** Get the resize handle direction from a mousedown target, or null */
export function getHandleDirection(
  target: Element
): (typeof HANDLE_POSITIONS)[number] | null {
  if (target instanceof HTMLDivElement && target.dataset.pdHandle) {
    return target.dataset.pdHandle as (typeof HANDLE_POSITIONS)[number];
  }
  return null;
}

// --- Helpers ---

function createDiv(className: string): HTMLDivElement {
  const div = document.createElement("div");
  div.className = className;
  return div;
}

function positionOverlay(el: HTMLDivElement, rect: DOMRect): void {
  el.style.cssText = `
    left: ${rect.left}px !important;
    top: ${rect.top}px !important;
    width: ${rect.width}px !important;
    height: ${rect.height}px !important;
  `;
}

function positionHandles(rect: DOMRect): void {
  const hs = 8; // handle size
  const ho = hs / 2; // handle offset

  const positions: Record<string, { left: number; top: number }> = {
    nw: { left: rect.left - ho, top: rect.top - ho },
    n: { left: rect.left + rect.width / 2 - ho, top: rect.top - ho },
    ne: { left: rect.right - ho, top: rect.top - ho },
    e: { left: rect.right - ho, top: rect.top + rect.height / 2 - ho },
    se: { left: rect.right - ho, top: rect.bottom - ho },
    s: { left: rect.left + rect.width / 2 - ho, top: rect.bottom - ho },
    sw: { left: rect.left - ho, top: rect.bottom - ho },
    w: { left: rect.left - ho, top: rect.top + rect.height / 2 - ho },
  };

  resizeHandles.forEach((handle) => {
    const pos = handle.dataset.pdHandle!;
    const p = positions[pos];
    handle.style.cssText = `
      left: ${p.left}px !important;
      top: ${p.top}px !important;
    `;
  });
}
