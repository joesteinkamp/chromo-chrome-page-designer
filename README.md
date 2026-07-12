# Page Designer

A Chrome extension that lets you visually edit any live webpage using a Figma-like interface. Select elements, adjust styles with visual controls, drag to rearrange, resize, edit text inline, and export structured changesets for developer handoff.

## Quick Start

### Install from a Release (no build required)

For users whose IT blocks the Chrome Web Store:

1. Go to [Releases](https://github.com/joesteinkamp/chromo-chrome-page-designer/releases) and download `chromo-design-<version>.zip` from the latest release.
2. Unzip it somewhere permanent (e.g. `~/chromo-design/`). Chrome loads the folder by reference — if you delete or move it, the extension breaks.
3. Open `chrome://extensions` and enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the unzipped folder.

To update: download the new zip, replace the folder contents, then click the refresh icon on the extension's card in `chrome://extensions`.

### Build from source

Prerequisites: [Node.js](https://nodejs.org/) v18+, Google Chrome v120+.

```bash
git clone https://github.com/joesteinkamp/chromo-chrome-page-designer.git
cd chromo-chrome-page-designer
npm install
npm run build
```

Then load `dist/` as an unpacked extension (steps 3–4 above).

### Publishing a new release (maintainers)

```bash
# bump public/manifest.json "version" to match
git tag v0.2.1
git push origin v0.2.1
```

The `Release` GitHub Action builds `dist/`, zips it, and attaches the zip to a new GitHub Release. You can also trigger it manually from the Actions tab for an unreleased build artifact.

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

All changes apply instantly to the page.

### AI Editing

1. Select an element and switch to the **AI** tab
2. Describe what you want to change in natural language (e.g., "make this red and bigger", "add a subtle shadow")
3. Click **Apply** — the AI generates and applies CSS changes
4. Requires an API key configured in Settings (Claude or OpenAI)

### Change Tracking & Export

The **Changes** tab records every edit made during a session:
- View a timestamped log of all changes with per-change undo
- **Copy JSON** — structured changeset for Claude Code / Codex (selector + property + old/new values)
- **Copy Summary** — human-readable markdown for GitHub issues or Slack

### Persistence & Screenshots

- **Save** — save edits for the current URL (persists in chrome.storage)
- **Restore** — replay saved edits when revisiting a page
- **Screenshot** (📷) — download a PNG of the current viewport

## Agent Sync (MCP)

Page Designer features **Agent Sync**, a real-time bridge that connects your visual browser workspace to AI coding agents (such as Claude Code) using the **Model Context Protocol (MCP)**. This enables a powerful two-way workflow:
1. **Developer Handoff**: Visual edits you make in Chrome are synced to the agent, allowing it to inspect changes and apply them directly to your source files.
2. **Interactive Design**: The AI agent can push real-time style and text changes back to the browser window.

---

### How it Works

```
┌─────────────────┐       WebSocket       ┌──────────────┐
│  Chrome Extension │ ───────────────────> │ Relay Server │
└─────────────────┘                      └──────────────┘
                                                 ▲
                                                 │ HTTP / SSE (MCP)
                                                 ▼
                                         ┌──────────────┐
                                         │   AI Agent   │
                                         │ (Claude Code)│
                                         └──────────────┘
```

1. **State Synchronization**: When Agent Sync is enabled, the extension connects to a Relay Server via WebSockets and sends updates on the active tab (URL, title, selected element computed styles, and the tracked changelog).
2. **MCP Host**: The Relay Server caches this workspace state and exposes it as an MCP server.
3. **Two-Way Control**: When the AI agent calls editing tools (like `apply_style` or `apply_text`), the Relay Server relays the commands to the browser extension to apply them instantly to the active tab DOM.

---

### Connecting to an AI Agent

#### 1. Enable Sync in Chrome
1. Click the **Page Designer** extension icon to open the side panel.
2. Scroll to the bottom and locate the **Agent Sync** section.
3. Toggle the switch to **ON**.
4. The status indicator should turn green (**Connected**) indicating it has successfully connected to the relay.

#### 2. Configure the MCP Client (e.g. Claude Code)
1. In the **Agent Sync** panel, click **Copy MCP Config**. This copies the registration command to your clipboard:
   ```bash
   claude mcp add --transport http chromo-designer https://chromo-relay.designknowledgebase.com/mcp/<userId>
   ```
2. Paste and run this command in your terminal. This registers the extension's MCP server with your AI agent.
3. Restart or reload your AI agent to activate the new tools.

---

### Available MCP Tools

Once connected, your AI agent has access to the following tools:

| Tool | Parameters | Description |
|---|---|---|
| `get_page_info` | None | Returns the current page URL and title. |
| `get_selected_element` | None | Returns the tag, CSS selector, classes, computed styles, and component context of the selected element. |
| `get_changes` | None | Returns a structured list of all tracked modifications. |
| `get_change_summary` | None | Returns a human-readable markdown summary of the changes. |
| `apply_style` | `selector`, `property`, `value` | Applies a CSS style change live in the browser. |
| `apply_text` | `selector`, `text` | Updates the text content of an element live. |
| `get_element_styles` | `selector` | Requests computed styles for any element on the page. |
| `resolve_change` | `changeId` | Marks a tracked change as resolved/implemented. |

---

### Running the Relay Locally (Development)

If you are developing Page Designer or want to self-host the relay server:

1. **Start the local Relay Server**:
   ```bash
   cd relay
   npm install
   npm run dev
   ```
   This starts the server on port `3847`.

2. **Configure the Extension to use the Local Relay**:
   Since the extension defaults to the production relay, you need to set a local override. Open the extension's Options/Popup page developer console and run:
   ```javascript
   chrome.storage.sync.set({ relayUrlOverride: "ws://localhost:3847" });
   ```
   Reload the extension to apply the change. The **Agent Sync** section in the side panel will now show and generate config paths targeting `http://localhost:3847/mcp/<userId>`.

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

### AI Setup

1. Click the extension icon → **Open Designer Panel**
2. Right-click the extension icon → **Options** (or go to `chrome://extensions` → Page Designer → Details → Extension options)
3. Enter your API key (Claude or OpenAI)
4. Select a model and click **Save**

## JSON Changeset Format

The export format is designed for consumption by AI coding tools:

```json
{
  "url": "https://example.com/page",
  "timestamp": "2026-03-24T10:30:00Z",
  "description": "2 style changes, 1 text edit",
  "changes": [
    {
      "type": "style",
      "selector": "#hero > h1",
      "property": "font-size",
      "from": "32px",
      "to": "48px"
    }
  ]
}
```

## License

MIT
