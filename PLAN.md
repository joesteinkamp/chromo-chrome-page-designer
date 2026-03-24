# Page Designer — Chrome Extension Plan

## Context

Build a Chrome extension that lets **non-technical designers** (familiar with Figma, not DevTools) visually edit any live webpage. The interaction model mirrors Figma's inspect panel — hover to highlight, click to select, see and edit properties in a clean side panel using visual controls (not raw CSS). All edits are tracked and exportable as structured changesets for developer handoff via Claude Code, Codex, or GitHub issues.

**Reference extensions:**
- **UI Inspector** — closest reference. Uses Chrome Side Panel API, Figma-like property groups, hover/click selection, visual controls, presets, export to CSS/Tailwind/SCSS. Tagline: "Edit web pages like Figma."
- **Page Editable** — simple toggle for `contentEditable` text editing.
- **Amino** — code-first CSS editor with persistence. Too developer-oriented, but good persistence model.
- **Cursor Visual Editor** — drag/drop, AI point-and-prompt, property inspector, code sync.

**Key differentiators from UI Inspector:**
1. AI-powered edits (select element + natural language prompt)
2. Structured changeset export for codebase integration (not just CSS copy)
3. Drag-and-drop element rearrangement + resize handles
4. Designed for eventual two-way sync with source code via Claude Code/Codex

**Tech stack:** React 18 + TypeScript, Manifest V3, Vite multi-entry build, Chrome Side Panel API.

---

## Architecture

```
┌─────────────────┐    messages     ┌──────────────────────┐
│  Content Script  │◄──────────────►│  Background Worker   │
│  (per tab)       │                │  (service-worker.ts) │
│                  │                │                      │
│  - Selection     │                │  - chrome.storage    │
│    overlay       │                │  - AI API proxy      │
│  - Hover/click   │                │  - Screenshot capture│
│    interaction   │                │  - Message broker    │
│  - Inline edit   │                └──────────┬───────────┘
│  - Drag/resize   │                           │
│  - Change tracker│                           │ messages
└────────┬─────────┘                           │
         │ postMessage                ┌────────▼──────────┐
         │                            │   Side Panel       │
         ▼                            │   (React app)      │
   ┌───────────┐                      │                    │
   │  Host Page │                      │  - Design tab      │
   │  (DOM)     │                      │  - Layout tab      │
   └───────────┘                      │  - Typography tab  │
                                      │  - Fill & Stroke   │
                                      │  - AI prompt       │
                                      │  - Changes log     │
                                      └────────────────────┘
```

### Execution Contexts

| Context | Entry | Role |
|---|---|---|
| **Content Script** | `src/content/main.ts` | Injected into pages. Manages selection overlay, hover highlighting, drag/drop, resize handles, inline text editing, change tracking. Lightweight — no React, just DOM manipulation. |
| **Side Panel** | `src/panel/index.tsx` | React app in Chrome's Side Panel. Figma-like property inspector. Communicates with content script via `chrome.tabs.sendMessage`. |
| **Background Worker** | `src/background/service-worker.ts` | Message broker, chrome.storage, AI API proxy, screenshot capture. |
| **Popup** | `src/popup/index.tsx` | Minimal — just activates the side panel + shows status. |
| **Options** | `src/options/index.tsx` | API key config, preferences. |

### Key Architectural Decisions

1. **Chrome Side Panel API** (not Shadow DOM sidebar) — native browser chrome, no CSS isolation issues, consistent Figma-like feel, resizable by user, persists across navigation.
2. **Content script is vanilla TS** (no React) — the overlay/interaction layer should be as lightweight as possible to avoid interfering with the host page. React lives only in the side panel.
3. **Content ↔ Side Panel communication** — content script sends element data (computed styles, rect, tag, classes) to side panel via `chrome.runtime.sendMessage`. Side panel sends property changes back. Background worker relays between them.
4. **Figma-native terminology** — "Fill" not "background-color", "Stroke" not "border", "Auto layout" not "flexbox". Property names map internally to CSS but surface designer-friendly labels.
5. **CSS selector-based change tracking** — every edit records a CSS selector + change, exportable as JSON for Claude Code/Codex consumption.

---

## Design Language: Figma-Inspired Property Panels

The side panel organizes properties into sections matching Figma's right panel:

### Design Tab
| Section | Figma Label | CSS Properties | Controls |
|---|---|---|---|
| **Alignment & Position** | Frame alignment | `position`, `top/right/bottom/left` | Visual alignment buttons, position inputs |
| **Dimensions** | W / H | `width`, `height`, `min-*`, `max-*` | Number inputs with unit picker (px/rem/%) |
| **Auto Layout** | Auto layout | `display:flex`, `flex-direction`, `gap`, `justify-content`, `align-items`, `flex-wrap` | Direction buttons, visual alignment grid, gap input |
| **Grid** | Layout grid | `display:grid`, `grid-template-*`, `gap` | Column/row count, gap inputs |
| **Fill** | Fill | `background-color`, `background-image`, gradients | Color swatch → picker, gradient editor, opacity slider |
| **Stroke** | Stroke | `border-*`, `outline` | Color swatch, width input, style dropdown, per-side toggles |
| **Corner Radius** | Corner radius | `border-radius` | 4-corner input (linked/unlinked like Figma) |
| **Shadows** | Drop shadow / Inner shadow | `box-shadow` | X/Y/blur/spread inputs, color picker, type toggle |
| **Blur** | Layer blur | `filter: blur()`, `backdrop-filter: blur()` | Slider input |
| **Opacity** | Opacity | `opacity` | Slider (0–100%) |

### Typography Tab (shown when text element selected)
| Section | Controls |
|---|---|
| **Font** | Family dropdown (with preview), weight dropdown |
| **Size & Spacing** | Font size, line height, letter spacing — number inputs |
| **Alignment** | Horizontal align buttons (L/C/R/J), vertical align |
| **Transform** | Uppercase / lowercase / capitalize buttons |
| **Color** | Text color swatch → picker |

### Element Info (always visible at top)
- Tag name + truncated class list
- Dimensions badge (W × H)
- Element breadcrumb path (e.g., `body > main > .hero > h1`)

---

## Project Structure

```
chrome-page-designer/
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── PLAN.md
├── public/
│   ├── icons/                        # Extension icons (16/48/128)
│   ├── panel.html                    # Side panel shell
│   ├── popup.html
│   └── options.html
├── src/
│   ├── shared/
│   │   ├── types.ts                  # ElementData, Change types, EditorState
│   │   ├── messages.ts               # Discriminated union message types
│   │   ├── constants.ts
│   │   ├── css-mapping.ts            # Figma label ↔ CSS property mapping
│   │   └── selector.ts              # CSS selector generation for elements
│   ├── content/
│   │   ├── main.ts                   # Entry: bootstraps overlay, listens for messages
│   │   ├── overlay.ts                # Hover highlight + selection box (4 border divs)
│   │   ├── element-picker.ts         # mousemove/click handlers, elementFromPoint
│   │   ├── inline-edit.ts            # Double-click → contentEditable for text
│   │   ├── drag-drop.ts             # Drag elements to rearrange
│   │   ├── resize.ts                # 8-handle resize on selected element
│   │   ├── image-replace.ts         # Click image → file picker / URL input
│   │   ├── style-bridge.ts          # Reads computed styles, sends to panel; applies changes from panel
│   │   ├── change-tracker.ts        # Records all mutations with CSS selectors
│   │   └── content.css              # Minimal styles for overlay/handles (injected via manifest)
│   ├── panel/
│   │   ├── index.tsx                 # Entry: renders React app
│   │   ├── App.tsx                   # Root: manages selected element state
│   │   ├── hooks/
│   │   │   └── useElementData.ts     # Subscribes to element selection messages
│   │   ├── components/
│   │   │   ├── ElementInfo.tsx        # Tag, classes, dimensions, breadcrumb
│   │   │   ├── DesignTab.tsx          # Container for all design sections
│   │   │   ├── TypographyTab.tsx      # Typography controls
│   │   │   ├── ChangesTab.tsx         # Change log + export buttons
│   │   │   └── AITab.tsx             # Natural language prompt
│   │   ├── sections/
│   │   │   ├── AutoLayoutSection.tsx  # Flex controls with visual alignment grid
│   │   │   ├── DimensionsSection.tsx  # W/H inputs
│   │   │   ├── FillSection.tsx        # Background color/gradient
│   │   │   ├── StrokeSection.tsx      # Border controls
│   │   │   ├── CornerRadiusSection.tsx# 4-corner radius (linked/unlinked)
│   │   │   ├── ShadowSection.tsx      # Box shadow editor
│   │   │   ├── OpacitySection.tsx     # Opacity slider
│   │   │   └── BlurSection.tsx        # Filter blur
│   │   ├── controls/
│   │   │   ├── ColorPicker.tsx        # HSL picker + hex input + eyedropper
│   │   │   ├── NumberInput.tsx        # Scrubable number input (drag to adjust, like Figma)
│   │   │   ├── UnitInput.tsx          # Number + unit selector
│   │   │   ├── AlignmentGrid.tsx      # 3×3 grid for justify/align (like Figma)
│   │   │   ├── DirectionToggle.tsx    # Row/column/wrap toggle buttons
│   │   │   ├── SliderInput.tsx        # Range slider + number
│   │   │   └── CornerRadiusInput.tsx  # 4-value linked/unlinked input
│   │   └── panel.css                 # Side panel styles (Figma-dark aesthetic)
│   ├── background/
│   │   ├── service-worker.ts         # Message relay, storage, screenshot
│   │   ├── ai-client.ts             # Claude/OpenAI API calls
│   │   ├── storage.ts               # chrome.storage helpers (save/load edits per URL)
│   │   └── screenshot.ts            # chrome.tabs.captureVisibleTab
│   ├── popup/
│   │   ├── index.tsx
│   │   ├── Popup.tsx                 # Activate side panel button, status indicator
│   │   └── popup.css
│   └── options/
│       ├── index.tsx
│       ├── Options.tsx               # API key, provider, preferences
│       └── options.css
```

---

## Phase 1: Extension Scaffold + Element Selection + Side Panel Shell

**Goal:** Loadable extension. Click icon → side panel opens. Hover highlights elements. Click selects. Side panel shows element info.

### Build & Config
- `package.json` — deps: `react`, `react-dom`, `typescript`, `vite`, `@types/react`, `@types/react-dom`
- `tsconfig.json` — strict, `jsx: "react-jsx"`, path aliases
- `vite.config.ts` — multi-entry:
  - Content script → IIFE bundle (no code splitting)
  - Side panel, popup, options → separate ES module entries
- `manifest.json`:
  ```json
  {
    "manifest_version": 3,
    "name": "Page Designer",
    "version": "0.1.0",
    "permissions": ["activeTab", "storage", "scripting", "sidePanel"],
    "side_panel": { "default_path": "panel.html" },
    "action": { "default_popup": "popup.html" },
    "background": { "service_worker": "background/service-worker.js", "type": "module" },
    "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content/main.js"], "css": ["content/content.css"], "run_at": "document_idle" }]
  }
  ```

### Content Script (`src/content/`)
- `main.ts` — listens for `ACTIVATE` message from background. When active, enables element picker.
- `element-picker.ts` — capture-phase `mousemove`/`click` on `document`. `elementFromPoint()` for hover. Click selects and sends `ELEMENT_SELECTED` message with:
  ```ts
  { tag, id, classes, rect, computedStyles: Record<string, string>, innerHTML (truncated), breadcrumb }
  ```
- `overlay.ts` — 4 absolutely-positioned divs forming a highlight border around hovered/selected element. Blue border for hover (#4F9EFF), solid blue for selected. Dimension badge at top-right of selection. Updated via `requestAnimationFrame` on scroll/resize.
- `content.css` — styles for overlay divs, injected via manifest (not Shadow DOM — overlay divs are minimal and use unique prefixed class names like `.__pd-overlay-*` to avoid collisions).

### Side Panel (`src/panel/`)
- `panel.html` — shell HTML
- `App.tsx` — dark theme (Figma-like `#2c2c2c` background, `#fff` text). Shows "Select an element to inspect" when nothing selected. When element data received, shows `<ElementInfo />` header.
- `ElementInfo.tsx` — tag badge, class list, `W × H` dimensions, breadcrumb path.
- `useElementData.ts` — hook that listens for `ELEMENT_SELECTED` messages via `chrome.runtime.onMessage`.

### Background
- `service-worker.ts` — relays messages between content script and side panel. On popup click, opens side panel via `chrome.sidePanel.open()`.

### Popup
- `Popup.tsx` — single button "Open Page Designer" that triggers `chrome.sidePanel.open()` and sends `ACTIVATE` to content script.

### Implementation Notes
- Content script overlay avoids Shadow DOM — uses minimal absolutely-positioned divs with `__pd-` prefixed classes and `!important` styles to avoid page CSS conflicts. This keeps the content script lightweight.
- Element picker stops event propagation in capture phase only when extension is active.
- `getComputedStyle()` extracts ~40 key properties (not all 300+) relevant to the design panels.

---

## Phase 2: Direct Manipulation (Text, Drag, Resize, Image Replace)

**Goal:** Figma-like direct manipulation on the canvas — double-click to edit text, drag to rearrange, resize handles, image replacement.

### Content Script Additions
- `inline-edit.ts` — double-click selected element → `contentEditable = 'true'`, blue focus ring. Blur/Escape → save, send `TEXT_CHANGED` message. Only activates on elements with direct text content.
- `drag-drop.ts` — mousedown on selected element (not on resize handle) → enter drag mode:
  - Semi-transparent clone follows cursor
  - Blue insertion line shows drop position
  - `elementFromPoint()` (hiding dragged element) to find drop target
  - Top/bottom half of target determines before/after insertion
  - mouseup → `parentNode.insertBefore()`, send `ELEMENT_MOVED` message
- `resize.ts` — 8 white square handles (Figma-style) around selected element. Drag corner → resize. Shift constrains aspect ratio (default for images). Send `ELEMENT_RESIZED` message.
- `image-replace.ts` — when selected element is `<img>` or has `background-image`, show small floating toolbar with "Replace" button. Opens file input → reads as data URL → sets `src` or `background-image`. Send `IMAGE_REPLACED` message.

### Side Panel Updates
- `DimensionsSection.tsx` — live-updates W/H when element is resized on canvas
- Two-way binding: editing W/H in panel also resizes element (sends `APPLY_STYLE` to content script)

### Interaction Mode State Machine (in `main.ts`)
```
idle → picking (hover/click) → selected
selected → dragging (mousedown + move)
selected → resizing (mousedown on handle)
selected → editing (double-click text)
selected → picking (click elsewhere)
```

---

## Phase 3: Design Property Panels (Figma-Style Inspector)

**Goal:** Side panel populated with full design controls. Editing any value live-updates the page element.

### Side Panel — Sections to Build

**`DesignTab.tsx`** — scrollable container with collapsible sections:

1. **`AutoLayoutSection.tsx`** — shown when element is `display: flex`:
   - Direction: 4-button toggle (→ ↓ ← ↑) for `flex-direction`
   - Alignment: 3×3 visual grid (`AlignmentGrid.tsx`) mapping to `justify-content` × `align-items`
   - Gap: `NumberInput` for `gap`
   - Wrap toggle for `flex-wrap`
   - "Add auto layout" button when element isn't flex (applies `display: flex`)

2. **`DimensionsSection.tsx`** — W/H as scrubable `NumberInput` with unit dropdown

3. **`FillSection.tsx`**:
   - Color swatch showing current `background-color`
   - Click swatch → `ColorPicker` popover
   - Opacity slider for fill alpha
   - "+" button to add fill (for elements with `none`)
   - Eye icon to toggle visibility (`background: none` / restore)

4. **`StrokeSection.tsx`**:
   - Color swatch for `border-color`
   - Width input for `border-width`
   - Style dropdown (solid/dashed/dotted/none)
   - Per-side toggles (top/right/bottom/left)

5. **`CornerRadiusSection.tsx`**:
   - Single input (all corners linked)
   - Unlink icon → 4 individual corner inputs
   - Mirrors Figma's corner radius UX exactly

6. **`ShadowSection.tsx`**:
   - X/Y/blur/spread number inputs
   - Color swatch
   - Toggle drop shadow vs inner shadow (`inset`)
   - Multiple shadows support (add/remove)

7. **`OpacitySection.tsx`** — slider 0–100%

8. **`BlurSection.tsx`** — slider for `filter: blur()`

**`TypographyTab.tsx`** — shown when element contains text:
- Font family searchable dropdown (populated from `document.fonts` + Google Fonts list)
- Weight dropdown
- Size, line-height, letter-spacing as `NumberInput`
- Alignment buttons (L/C/R/J)
- Color swatch

### Controls to Build

- **`NumberInput.tsx`** — Figma's scrubable input: drag left/right to decrement/increment, click to type directly. Shows unit label. This is the core input used everywhere.
- **`ColorPicker.tsx`** — saturation/lightness square, hue bar, alpha bar, hex input. Uses `EyeDropper` API for page color sampling.
- **`AlignmentGrid.tsx`** — 3×3 clickable grid (like Figma) showing all justify × align combinations. Highlights current state.
- **`CornerRadiusInput.tsx`** — 4 inputs with link/unlink toggle.

### Communication Flow
1. User changes value in panel section
2. Section calls `sendStyleChange(property, value)` → `chrome.runtime.sendMessage({ type: 'APPLY_STYLE', property, value })`
3. Background relays to content script
4. Content script applies `element.style[property] = value` and records in change tracker
5. Content script sends updated element data back to panel (so other sections stay in sync)

---

## Phase 4: Change Tracking + Export

**Goal:** Every edit recorded. Undo per-change. Export as structured JSON (for Claude Code) or human-readable summary (for GitHub issues / Slack).

### Content Script
- `change-tracker.ts` — maintains ordered `Change[]` array:
  ```ts
  type Change =
    | { type: 'style'; selector: string; property: string; from: string; to: string }
    | { type: 'text'; selector: string; from: string; to: string }
    | { type: 'move'; selector: string; fromParent: string; fromIndex: number; toParent: string; toIndex: number }
    | { type: 'resize'; selector: string; from: { w: string; h: string }; to: { w: string; h: string } }
    | { type: 'image'; selector: string; from: string; to: string }
  ```
  Each change gets a unique ID and timestamp.

- `selector.ts` (shared) — generates stable CSS selectors:
  1. `#id` if unique
  2. Walk up DOM: `tag.class:nth-of-type(n)` at each level
  3. Stop at `body` or unique `#id` ancestor
  4. Validate with `document.querySelector()`

### Side Panel
- `ChangesTab.tsx`:
  - Scrollable list of changes with icons per type
  - Human-readable description (e.g., "Changed fill on `.hero-title` from #333 to #FF5733")
  - Per-change undo button (sends `UNDO_CHANGE` to content script)
  - "Undo All" button
  - **Export buttons:**
    - "Copy JSON" — structured changeset to clipboard
    - "Copy Summary" — human-readable markdown
    - "Download JSON" — file download
    - "Create GitHub Issue" — opens pre-filled GitHub issue URL (stretch goal)

### Export Formats

**JSON Changeset** (for Claude Code / Codex):
```json
{
  "url": "https://example.com/page",
  "timestamp": "2026-03-24T10:30:00Z",
  "description": "Updated hero section styling and text",
  "changes": [
    {
      "type": "style",
      "selector": "#hero > h1",
      "property": "font-size",
      "from": "32px",
      "to": "48px"
    },
    {
      "type": "text",
      "selector": "#hero > p.subtitle",
      "from": "Old tagline",
      "to": "New tagline here"
    }
  ]
}
```

**Human-Readable Summary:**
```markdown
## Page Designer Changes
**URL:** https://example.com/page

1. Changed **font size** on `#hero > h1` from 32px → 48px
2. Changed **text** on `#hero > p.subtitle`: "Old tagline" → "New tagline here"
3. Moved `.feature-card` from position 3 → position 1 in `.features-grid`
```

---

## Phase 5: AI Integration + Persistence + Screenshot

### AI Integration (`AITab.tsx` + `ai-client.ts`)
- User selects element, switches to AI tab, types natural language prompt
- Sends to background: `{ prompt, elementHTML, computedStyles, selector }`
- Background calls Claude API with system prompt:
  ```
  You are a CSS expert. Given an HTML element and its current styles,
  return a JSON object with the changes needed to fulfill the user's request.
  Format: { "styleChanges": [{ "property": "...", "value": "..." }],
            "textContent": "..." (optional), "explanation": "..." }
  ```
- Response parsed, applied to element, recorded in change tracker
- AI tab shows the explanation and applied changes

### Persistence (`storage.ts`)
- "Save to this page" button in changes tab → saves `Change[]` to `chrome.storage.local` keyed by URL
- On page load, content script asks background if saved edits exist → badge indicator
- User can choose "Restore saved edits" → replays changes via selectors
- Failed replays reported (selector not found)

### Screenshot (`screenshot.ts`)
- "Download Screenshot" button in panel toolbar
- `chrome.tabs.captureVisibleTab(null, { format: 'png' })` → data URL → trigger download
- Option to capture just the selected element (crop from full screenshot using element rect)

### Options Page
- API provider: Claude / OpenAI
- API key (stored in `chrome.storage.sync`)
- Model selector
- Default unit preference (px/rem)

---

## Phase Dependency Graph

```
Phase 1 (scaffold + selection + panel shell)
    │
    ├── Phase 2 (direct manipulation) ──┐
    │                                    │
    └── Phase 3 (design panels) ────────┤
                                         │
                              Phase 4 (change tracking + export)
                                         │
                              Phase 5 (AI + persistence + screenshot)
```

Phases 2 and 3 are independent and can be built in parallel.

---

## Verification Plan

| Phase | Test |
|---|---|
| 1 | Load extension → click icon → side panel opens → hover any page → blue highlight follows cursor → click element → panel shows tag, classes, W×H, breadcrumb |
| 2 | Double-click text → edit inline → click away → text saved. Drag element → insertion line → drop → element moved. Drag resize handle → element resizes. Click image → replace. |
| 3 | Select element → Design tab shows fill/stroke/radius/shadow/opacity with current values → change fill color → page updates live → change font size → page updates live. Auto Layout section appears for flex containers. |
| 4 | Make several edits → Changes tab shows log → click undo on one → reverted → "Copy JSON" → paste → valid structured changeset → "Copy Summary" → readable markdown |
| 5 | Select element → AI tab → "make this red and bigger" → element updates → changes recorded. Save edits → reload → restore → edits reappear. Download screenshot. |
