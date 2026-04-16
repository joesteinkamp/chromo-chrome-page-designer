/**
 * Manages the visual overlay elements (hover highlight, selection box, badges).
 * All overlay elements use __pd- prefixed classes and !important styles.
 */

let hoverOverlay: HTMLDivElement;
let selectionOverlay: HTMLDivElement;
let badge: HTMLDivElement;
let commentButton: HTMLButtonElement;
let resizeHandles: HTMLDivElement[] = [];
let multiSelectOverlays: HTMLDivElement[] = [];

/** Comment pin markers: key is changeId, value is the DOM badge + target selector */
interface CommentPin {
  el: HTMLDivElement;
  selector: string;
}
const commentPins = new Map<string, CommentPin>();
let commentButtonClickHandler: (() => void) | null = null;
let commentPinClickHandler: ((changeId: string) => void) | null = null;
/** The currently selected element — used to hide the comment button when a pin appears. */
let currentSelectedElement: Element | null = null;

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

  // (+) button shown at the top-right of the selected element to add a comment
  commentButton = document.createElement("button");
  commentButton.type = "button";
  commentButton.className = "__pd-comment-btn";
  commentButton.setAttribute("aria-label", "Add comment");
  commentButton.innerHTML = '<svg width="12" height="12" viewBox="-1 -2 16 16" fill="currentColor" aria-hidden="true"><path d="M1.5 0C.67 0 0 .67 0 1.5v7C0 9.33.67 10 1.5 10H4v3l3-3h5.5c.83 0 1.5-.67 1.5-1.5v-7C14 .67 13.33 0 12.5 0H1.5Z"/></svg>';
  commentButton.addEventListener("mousedown", (e) => {
    // Prevent the picker's capture-phase mousedown from starting a drag
    e.stopPropagation();
  });
  commentButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    commentButtonClickHandler?.();
  });
  document.documentElement.appendChild(commentButton);
}

export function destroyOverlay(): void {
  hoverOverlay?.remove();
  selectionOverlay?.remove();
  badge?.remove();
  commentButton?.remove();
  resizeHandles.forEach((h) => h.remove());
  resizeHandles = [];
  commentPins.forEach((pin) => pin.el.remove());
  commentPins.clear();
  hideMultiEditOverlays();
  hideMultiSelectOverlays();
}

export function showHover(rect: DOMRect): void {
  positionOverlay(hoverOverlay, rect);
  hoverOverlay.classList.add("__pd-overlay--visible");
}

export function hideHover(): void {
  hoverOverlay.classList.remove("__pd-overlay--visible");
}

export function showSelection(element: Element): void {
  currentSelectedElement = element;
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

  positionCommentButton(rect);
  // Hide the comment button if the element already has a comment pin
  if (elementHasCommentPin(element)) {
    commentButton.classList.remove("__pd-comment-btn--visible");
  } else {
    commentButton.classList.add("__pd-comment-btn--visible");
  }
}

export function hideSelection(): void {
  currentSelectedElement = null;
  selectionOverlay.classList.remove("__pd-overlay--visible");
  badge.classList.remove("__pd-badge--visible");
  resizeHandles.forEach((h) => h.classList.remove("__pd-handle--visible"));
  commentButton?.classList.remove("__pd-comment-btn--visible");
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
  positionCommentButton(rect);
  updateCommentPins();
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

/** Check if an element lives inside the layers pane (any descendant). */
export function isInsideLayersPane(el: Element | null): boolean {
  let cur: Element | null = el;
  while (cur) {
    const cls = typeof cur.className === "string" ? cur.className : "";
    if (cls.includes("__pd-layers-")) return true;
    cur = cur.parentElement;
  }
  return false;
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

/** Check if the given element is the target of any existing comment pin. */
function elementHasCommentPin(element: Element): boolean {
  for (const pin of commentPins.values()) {
    try {
      const target = document.querySelector(pin.selector);
      if (target === element) return true;
    } catch {
      // invalid selector — skip
    }
  }
  return false;
}

// --- Comment button ---

export function setCommentButtonHandler(handler: () => void): void {
  commentButtonClickHandler = handler;
}

function positionCommentButton(rect: DOMRect): void {
  const size = 24;
  const offset = 4;
  // Anchor slightly outside the bottom-right corner of the element
  const left = rect.right - size / 2 + offset;
  const top = rect.bottom - size / 2 + offset;
  commentButton.style.cssText = `
    left: ${left}px !important;
    top: ${top}px !important;
  `;
}

// --- Comment pins (numbered badges that persist on commented elements) ---

export function setCommentPinClickHandler(
  handler: (changeId: string) => void
): void {
  commentPinClickHandler = handler;
}

/**
 * Sync the set of pin markers to match the given comments.
 * Creates pins for new comments, removes pins for deleted ones, and updates
 * the number displayed on any that changed.
 */
export function setCommentPins(
  comments: Array<{ id: string; number: number; selector: string }>
): void {
  const seen = new Set<string>();
  for (const c of comments) {
    seen.add(c.id);
    let pin = commentPins.get(c.id);
    if (!pin) {
      const el = document.createElement("div");
      el.className = "__pd-comment-pin";
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.dataset.pdCommentId = c.id;
      el.addEventListener("mousedown", (e) => {
        e.stopPropagation();
      });
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = el.dataset.pdCommentId;
        if (id) commentPinClickHandler?.(id);
      });
      document.documentElement.appendChild(el);
      pin = { el, selector: c.selector };
      commentPins.set(c.id, pin);
    }
    pin.selector = c.selector;
    pin.el.textContent = String(c.number);
    pin.el.setAttribute("aria-label", `Comment #${c.number}`);
  }
  // Remove pins whose comments were deleted
  for (const [id, pin] of commentPins) {
    if (!seen.has(id)) {
      pin.el.remove();
      commentPins.delete(id);
    }
  }
  updateCommentPins();

  // Hide or show the comment button based on whether the selected element now has a pin
  if (currentSelectedElement) {
    if (elementHasCommentPin(currentSelectedElement)) {
      commentButton?.classList.remove("__pd-comment-btn--visible");
    } else {
      commentButton?.classList.add("__pd-comment-btn--visible");
    }
  }
}

/** Reposition every pin to the bottom-right corner of its target element. */
export function updateCommentPins(): void {
  if (commentPins.size === 0) return;
  const size = 20;
  for (const pin of commentPins.values()) {
    let target: Element | null = null;
    try {
      target = document.querySelector(pin.selector);
    } catch {
      target = null;
    }
    if (!target) {
      pin.el.style.setProperty("display", "none", "important");
      continue;
    }
    const rect = target.getBoundingClientRect();
    // If element has no size or is off-screen far away, hide.
    if (rect.width === 0 && rect.height === 0) {
      pin.el.style.setProperty("display", "none", "important");
      continue;
    }
    const left = rect.right - size / 2;
    const top = rect.bottom - size / 2;
    pin.el.style.setProperty("left", `${left}px`, "important");
    pin.el.style.setProperty("top", `${top}px`, "important");
    pin.el.style.setProperty("display", "flex", "important");
  }
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
