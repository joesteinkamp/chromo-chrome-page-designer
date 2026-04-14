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
