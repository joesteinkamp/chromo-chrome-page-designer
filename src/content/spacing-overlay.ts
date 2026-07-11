/**
 * Spacing visualization — shows margin (pink) and padding (green) overlays
 * on the selected element, plus distance to nearest siblings.
 */

let marginOverlays: HTMLDivElement[] = [];
let paddingOverlays: HTMLDivElement[] = [];
let spacingLabels: HTMLDivElement[] = [];
let distanceElements: HTMLDivElement[] = [];
let currentSpacingElement: Element | null = null;

export function showSpacing(element: Element): void {
  currentSpacingElement = element;
  clearSpacingOverlays();

  const computed = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  const margins = {
    top: parseFloat(computed.marginTop) || 0,
    right: parseFloat(computed.marginRight) || 0,
    bottom: parseFloat(computed.marginBottom) || 0,
    left: parseFloat(computed.marginLeft) || 0,
  };

  const paddings = {
    top: parseFloat(computed.paddingTop) || 0,
    right: parseFloat(computed.paddingRight) || 0,
    bottom: parseFloat(computed.paddingBottom) || 0,
    left: parseFloat(computed.paddingLeft) || 0,
  };

  // Margin overlays (around the element)
  if (margins.top > 0) {
    createSpacingBox("margin", rect.left, rect.top - margins.top, rect.width, margins.top, `${Math.round(margins.top)}`);
  }
  if (margins.bottom > 0) {
    createSpacingBox("margin", rect.left, rect.bottom, rect.width, margins.bottom, `${Math.round(margins.bottom)}`);
  }
  if (margins.left > 0) {
    createSpacingBox("margin", rect.left - margins.left, rect.top, margins.left, rect.height, `${Math.round(margins.left)}`);
  }
  if (margins.right > 0) {
    createSpacingBox("margin", rect.right, rect.top, margins.right, rect.height, `${Math.round(margins.right)}`);
  }

  // Padding overlays (inside the element)
  if (paddings.top > 0) {
    createSpacingBox("padding", rect.left, rect.top, rect.width, paddings.top, `${Math.round(paddings.top)}`);
  }
  if (paddings.bottom > 0) {
    createSpacingBox("padding", rect.left, rect.bottom - paddings.bottom, rect.width, paddings.bottom, `${Math.round(paddings.bottom)}`);
  }
  if (paddings.left > 0) {
    createSpacingBox("padding", rect.left, rect.top, paddings.left, rect.height, `${Math.round(paddings.left)}`);
  }
  if (paddings.right > 0) {
    createSpacingBox("padding", rect.right - paddings.right, rect.top, paddings.right, rect.height, `${Math.round(paddings.right)}`);
  }

  // Distance to nearest sibling
  showDistanceToSibling(element, rect);
}

export function hideSpacing(): void {
  currentSpacingElement = null;
  clearSpacingOverlays();
}

export function updateSpacing(): void {
  if (currentSpacingElement) {
    showSpacing(currentSpacingElement);
  }
}

function clearSpacingOverlays(): void {
  marginOverlays.forEach((el) => el.remove());
  paddingOverlays.forEach((el) => el.remove());
  spacingLabels.forEach((el) => el.remove());
  distanceElements.forEach((el) => el.remove());
  marginOverlays = [];
  paddingOverlays = [];
  spacingLabels = [];
  distanceElements = [];
}

function createSpacingBox(
  type: "margin" | "padding",
  left: number,
  top: number,
  width: number,
  height: number,
  labelText: string
): void {
  const box = document.createElement("div");
  box.className = type === "margin" ? "__pd-spacing-margin __pd-spacing--visible" : "__pd-spacing-padding __pd-spacing--visible";
  box.style.cssText = `
    left: ${left}px !important;
    top: ${top}px !important;
    width: ${width}px !important;
    height: ${height}px !important;
  `;
  document.documentElement.appendChild(box);

  if (type === "margin") {
    marginOverlays.push(box);
  } else {
    paddingOverlays.push(box);
  }

  // Add label if area is big enough
  if (width > 16 && height > 10 && parseFloat(labelText) > 0) {
    const label = document.createElement("div");
    label.className = `__pd-spacing-label __pd-spacing-label--${type} __pd-spacing-label--visible`;
    label.textContent = labelText;
    label.style.cssText = `
      left: ${left + width / 2 - 8}px !important;
      top: ${top + height / 2 - 5}px !important;
    `;
    document.documentElement.appendChild(label);
    spacingLabels.push(label);
  }
}

function showDistanceToSibling(element: Element, rect: DOMRect): void {
  const parent = element.parentElement;
  if (!parent) return;

  const siblings = Array.from(parent.children).filter(
    (c) => c !== element && !c.className?.toString().includes("__pd-")
  );

  // Find nearest sibling above/below
  let nearestAbove: Element | null = null;
  let nearestBelow: Element | null = null;
  let minDistAbove = Infinity;
  let minDistBelow = Infinity;

  for (const sib of siblings) {
    const sibRect = sib.getBoundingClientRect();
    if (sibRect.bottom <= rect.top) {
      const dist = rect.top - sibRect.bottom;
      if (dist < minDistAbove) {
        minDistAbove = dist;
        nearestAbove = sib;
      }
    }
    if (sibRect.top >= rect.bottom) {
      const dist = sibRect.top - rect.bottom;
      if (dist < minDistBelow) {
        minDistBelow = dist;
        nearestBelow = sib;
      }
    }
  }

  if (nearestAbove && minDistAbove > 0 && minDistAbove < 500) {
    const sibRect = nearestAbove.getBoundingClientRect();
    createDistanceLine(
      Math.max(rect.left, sibRect.left),
      sibRect.bottom,
      Math.min(rect.width, sibRect.width),
      minDistAbove,
      Math.round(minDistAbove)
    );
  }

  if (nearestBelow && minDistBelow > 0 && minDistBelow < 500) {
    const sibRect = nearestBelow.getBoundingClientRect();
    createDistanceLine(
      Math.max(rect.left, sibRect.left),
      rect.bottom,
      Math.min(rect.width, sibRect.width),
      minDistBelow,
      Math.round(minDistBelow)
    );
  }
}

// --- Alt-hover measurement (Figma-style) ---
// While an element is selected and Alt is held, hovering any other element
// draws red distance lines between the two boxes: a single gap line per axis
// when the boxes are disjoint, or edge-to-edge inset distances when they
// overlap (e.g. measuring against a containing section).

let measureElements: HTMLDivElement[] = [];

export function showMeasureTo(selected: Element, target: Element): void {
  hideMeasure();
  const a = selected.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if ((a.width === 0 && a.height === 0) || (b.width === 0 && b.height === 0)) return;

  // Horizontal distances, drawn at the midpoint of the boxes' vertical overlap
  const yMid = overlapMid(a.top, a.bottom, b.top, b.bottom);
  if (b.right <= a.left) {
    createMeasure("h", b.right, yMid, a.left - b.right);
  } else if (b.left >= a.right) {
    createMeasure("h", a.right, yMid, b.left - a.right);
  } else {
    createMeasure("h", Math.min(a.left, b.left), yMid, Math.abs(a.left - b.left));
    createMeasure("h", Math.min(a.right, b.right), yMid, Math.abs(a.right - b.right));
  }

  // Vertical distances, drawn at the midpoint of the horizontal overlap
  const xMid = overlapMid(a.left, a.right, b.left, b.right);
  if (b.bottom <= a.top) {
    createMeasure("v", xMid, b.bottom, a.top - b.bottom);
  } else if (b.top >= a.bottom) {
    createMeasure("v", xMid, a.bottom, b.top - a.bottom);
  } else {
    createMeasure("v", xMid, Math.min(a.top, b.top), Math.abs(a.top - b.top));
    createMeasure("v", xMid, Math.min(a.bottom, b.bottom), Math.abs(a.bottom - b.bottom));
  }
}

export function hideMeasure(): void {
  measureElements.forEach((el) => el.remove());
  measureElements = [];
}

/** Midpoint of the overlap of two 1D ranges; falls back to the first range's center. */
function overlapMid(a1: number, a2: number, b1: number, b2: number): number {
  const lo = Math.max(a1, b1);
  const hi = Math.min(a2, b2);
  return lo < hi ? (lo + hi) / 2 : (a1 + a2) / 2;
}

function createMeasure(
  orientation: "h" | "v",
  x: number,
  y: number,
  length: number
): void {
  if (length < 1) return;

  const line = document.createElement("div");
  line.className = "__pd-measure-line";
  line.style.cssText =
    orientation === "h"
      ? `left: ${x}px !important; top: ${y}px !important; width: ${length}px !important; height: 1px !important;`
      : `left: ${x}px !important; top: ${y}px !important; width: 1px !important; height: ${length}px !important;`;
  document.documentElement.appendChild(line);
  measureElements.push(line);

  const label = document.createElement("div");
  label.className = "__pd-measure-label";
  label.textContent = `${Math.round(length)}`;
  const labelX = orientation === "h" ? x + length / 2 - 8 : x + 4;
  const labelY = orientation === "h" ? y + 4 : y + length / 2 - 6;
  label.style.cssText = `left: ${labelX}px !important; top: ${labelY}px !important;`;
  document.documentElement.appendChild(label);
  measureElements.push(label);
}

function createDistanceLine(
  left: number,
  top: number,
  width: number,
  height: number,
  distance: number
): void {
  // Vertical line
  const line = document.createElement("div");
  line.className = "__pd-distance-line __pd-distance-line--visible";
  const midX = left + width / 2;
  line.style.cssText = `
    left: ${midX}px !important;
    top: ${top}px !important;
    width: 1px !important;
    height: ${height}px !important;
  `;
  document.documentElement.appendChild(line);
  distanceElements.push(line);

  // Label
  const label = document.createElement("div");
  label.className = "__pd-distance-label __pd-distance-label--visible";
  label.textContent = `${distance}`;
  label.style.cssText = `
    left: ${midX + 4}px !important;
    top: ${top + height / 2 - 6}px !important;
  `;
  document.documentElement.appendChild(label);
  distanceElements.push(label);
}
