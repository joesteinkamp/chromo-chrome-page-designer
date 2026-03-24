# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Chrome extension (Manifest V3) called **Page Designer** that lets non-technical designers visually edit any live webpage using a Figma-like interface. Users hover to select elements, edit properties in a side panel, and export structured changesets for developer handoff via Claude Code or Codex.

## Commands

```bash
npm run build      # Build extension to dist/
npm run dev        # Build in watch mode
npm run typecheck  # TypeScript type checking (no emit)
```

To test: load `dist/` as an unpacked extension in `chrome://extensions` (enable Developer Mode).

## Architecture

Five execution contexts, each a separate Vite entry point:

| Context | Entry | Runtime | Notes |
|---|---|---|---|
| **Content Script** | `src/content/main.ts` | Injected into every page | Vanilla TS only (no React). Manages overlay, element picker, drag/resize, inline edit. Bundled as IIFE. |
| **Side Panel** | `src/panel/index.tsx` | Chrome Side Panel API | React app. Figma-like property inspector. Communicates with content script via `chrome.runtime.sendMessage`. |
| **Background Worker** | `src/background/service-worker.ts` | Service worker | Message relay between content script and side panel. Handles storage, AI API calls, screenshots. |
| **Popup** | `src/popup/index.tsx` | Browser action popup | Minimal — just opens side panel. |
| **Options** | `src/options/index.tsx` | Options page | API key and preferences (Phase 5). |

### Communication Flow

```
Content Script ←→ Background Worker ←→ Side Panel
     ↕
  Host Page DOM
```

All cross-context messages use the discriminated union type in `src/shared/messages.ts`. Content script sends `ELEMENT_SELECTED` with computed styles; side panel sends `APPLY_STYLE` back.

### Key Design Decisions

- **Chrome Side Panel API** (not Shadow DOM sidebar) — native, resizable, persists across navigation
- **Content script is vanilla TS** — no React, no framework. Keeps overlay lightweight and avoids interfering with the host page
- **Figma-native terminology** in the UI — "Fill" not "background-color", "Stroke" not "border", "Auto layout" not "flexbox" (see `src/shared/css-mapping.ts`)
- **`__pd-` prefix** on all injected DOM elements/classes to avoid collisions with host page
- Overlay elements use `position: fixed` + `z-index: 2147483647` + `!important` styles
- Element picker intercepts events in capture phase (`{ capture: true }`) and calls `stopPropagation()` to prevent page interaction
- CSS selector generation (`src/shared/selector.ts`) produces stable, readable selectors for change tracking and developer handoff

### Build Notes

- Vite multi-entry config in `vite.config.ts`
- Content script output must be IIFE (no ES module imports) — Vite handles this automatically since it's a JS-only entry
- `content.css` is copied to `dist/content/` via a custom Vite plugin (not imported by HTML)
- HTML files (`panel.html`, `popup.html`, `options.html`) are at project root (not in `public/`) to avoid publicDir duplication
- `public/` contains only static assets copied as-is: `manifest.json`, `icons/`
- `base: ""` in Vite config ensures relative asset paths (`./assets/...`) for extension compatibility

## Project Structure

```
src/shared/          # Types, messages, constants shared across all contexts
src/content/         # Content script (vanilla TS) — overlay, picker, interactions
src/panel/           # Side panel React app — property inspector, change log
src/background/      # Service worker — message relay, storage, AI, screenshots
src/popup/           # Popup (React) — opens side panel
src/options/         # Options page (React) — API key config
```
