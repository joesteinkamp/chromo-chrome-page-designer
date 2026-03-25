/** Maps Figma-friendly labels to CSS property names */
export const FIGMA_LABELS: Record<string, string> = {
  // Dimensions
  W: "width",
  H: "height",
  "Min W": "min-width",
  "Min H": "min-height",
  "Max W": "max-width",
  "Max H": "max-height",

  // Auto Layout (Flex)
  Direction: "flex-direction",
  Wrap: "flex-wrap",
  "Justify content": "justify-content",
  "Align items": "align-items",
  Gap: "gap",

  // Spacing
  "Margin top": "margin-top",
  "Margin right": "margin-right",
  "Margin bottom": "margin-bottom",
  "Margin left": "margin-left",
  "Padding top": "padding-top",
  "Padding right": "padding-right",
  "Padding bottom": "padding-bottom",
  "Padding left": "padding-left",

  // Typography
  "Font family": "font-family",
  "Font size": "font-size",
  "Font weight": "font-weight",
  "Line height": "line-height",
  "Letter spacing": "letter-spacing",
  "Text align": "text-align",
  "Text transform": "text-transform",

  // Fill
  Fill: "background-color",
  "Text color": "color",

  // Stroke
  "Stroke color": "border-color",
  "Stroke width": "border-width",
  "Stroke top width": "border-top-width",
  "Stroke right width": "border-right-width",
  "Stroke bottom width": "border-bottom-width",
  "Stroke left width": "border-left-width",
  "Stroke style": "border-style",

  // Corner Radius
  "Top left radius": "border-top-left-radius",
  "Top right radius": "border-top-right-radius",
  "Bottom right radius": "border-bottom-right-radius",
  "Bottom left radius": "border-bottom-left-radius",

  // Effects
  Opacity: "opacity",
  Shadow: "box-shadow",
  Blur: "filter",
  "Backdrop blur": "backdrop-filter",
};

/** Reverse mapping: CSS property → Figma label */
export const CSS_TO_FIGMA: Record<string, string> = Object.fromEntries(
  Object.entries(FIGMA_LABELS).map(([label, prop]) => [prop, label])
);
