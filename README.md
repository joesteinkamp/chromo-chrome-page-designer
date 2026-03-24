# Page Designer

A Chrome extension that lets you visually edit any live webpage using a Figma-like interface. Select elements, adjust styles with visual controls, drag to rearrange, resize, edit text inline, and export structured changesets for developer handoff.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- Google Chrome (v120+)

### Build

```bash
git clone https://github.com/joesteinkamp/chrome-page-designer.git
cd chrome-page-designer
npm install
npm run build
```

### Install in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `dist/` folder from this project

### Development

```bash
npm run dev        # Build in watch mode — rebuilds on file changes
npm run build      # Production build to dist/
npm run typecheck  # TypeScript type checking
```

After making changes, go to `chrome://extensions` and click the refresh icon on the Page Designer card to reload.

## How to Use

1. Navigate to any webpage
2. Click the **Page Designer** extension icon in the toolbar
3. The side panel opens and the editor activates

### Selecting Elements
- **Hover** over the page — elements highlight with a blue dashed border
- **Click** an element to select it — shows a solid blue border with resize handles and a dimension badge
- The side panel populates with the element's properties

### Editing

| Action | How |
|---|---|
| **Edit text** | Double-click a selected text element |
| **Move elements** | Click and drag a selected element to a new position |
| **Resize** | Drag the white corner/edge handles (Shift toggles aspect ratio lock; locked by default for images) |
| **Replace image** | Select an `<img>` — a toolbar appears with Replace (file picker) and URL buttons |
| **Change styles** | Use the Design or Typography tabs in the side panel |

### Side Panel Tabs

**Design** — Visual controls organized like Figma's inspect panel:
- **Dimensions** — Width and height with unit selector (px/rem/em/%)
- **Auto Layout** — Flex direction, alignment grid, gap, wrap (appears for flex containers; "Add auto layout" button for others)
- **Fill** — Background color picker with opacity slider
- **Stroke** — Border color, width, and style
- **Corner Radius** — Linked or per-corner radius controls
- **Shadow** — Drop/inset shadow with x/y/blur/spread/color
- **Opacity** — Element opacity slider
- **Blur** — Filter blur slider

**Typography** — Text-specific controls:
- Font family and weight
- Font size, line height, letter spacing
- Text alignment, transform, decoration
- Text color

All changes apply instantly to the page. Changes are ephemeral (lost on page refresh) — persistence and export are coming in future phases.

## Architecture

```
Content Script ←→ Background Worker ←→ Side Panel
     ↕
  Host Page DOM
```

| Context | Tech | Role |
|---|---|---|
| Content Script | Vanilla TypeScript | Injected into pages. Overlay, element picker, drag/drop, resize, inline editing. |
| Side Panel | React + TypeScript | Figma-like property inspector with visual controls. |
| Background Worker | TypeScript | Message relay between content script and side panel. |

The content script uses no frameworks to stay lightweight and avoid interfering with host pages. All extension UI injected into pages uses `__pd-` prefixed classes with `!important` styles to prevent CSS collisions.

## Project Structure

```
src/
├── shared/          # Types, messages, constants shared across contexts
├── content/         # Content script — overlay, picker, drag, resize, edit
├── panel/           # Side panel React app
│   ├── controls/    # Reusable Figma-style controls (NumberInput, ColorPicker, etc.)
│   ├── sections/    # Design tab sections (Fill, Stroke, Shadow, etc.)
│   ├── components/  # Tab components (DesignTab, TypographyTab, ElementInfo)
│   └── hooks/       # React hooks (useElementData, useStyleChange)
├── background/      # Service worker
├── popup/           # Extension popup (opens side panel)
└── options/         # Settings page
```

## Roadmap

- [ ] **Phase 4** — Change tracking and export (JSON changesets for Claude Code / Codex, human-readable summaries)
- [ ] **Phase 5** — AI-powered edits (natural language prompts), persistence per URL, screenshot export

## License

MIT
