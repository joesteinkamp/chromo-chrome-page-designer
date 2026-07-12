/**
 * Right-click context menu — Figma-style command surface for the selection.
 * Rendered as a __pd- overlay so the element picker ignores it; every item
 * shows its keyboard shortcut, making the menu double as shortcut discovery.
 * Commands themselves live in main.ts and are passed in as entries.
 */

import { suppressNextClick } from "./element-picker";

export interface MenuItem {
  label: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
}

export type MenuEntry = MenuItem | "separator";

let menuEl: HTMLDivElement | null = null;

export function isContextMenuOpen(): boolean {
  return menuEl !== null;
}

export function hideContextMenu(): void {
  if (!menuEl) return;
  menuEl.remove();
  menuEl = null;
  window.removeEventListener("mousedown", onGlobalMouseDown, true);
  window.removeEventListener("keydown", onGlobalKeyDown, true);
  window.removeEventListener("scroll", onGlobalScroll, true);
  window.removeEventListener("blur", hideContextMenu);
}

export function showContextMenu(x: number, y: number, entries: MenuEntry[]): void {
  hideContextMenu();

  menuEl = document.createElement("div");
  menuEl.className = "__pd-context-menu";

  for (const entry of entries) {
    if (entry === "separator") {
      const sep = document.createElement("div");
      sep.className = "__pd-context-menu-sep";
      menuEl.appendChild(sep);
      continue;
    }
    const item = document.createElement("button");
    item.type = "button";
    item.className = "__pd-context-menu-item";
    item.disabled = Boolean(entry.disabled);

    const label = document.createElement("span");
    label.className = "__pd-context-menu-item-label";
    label.textContent = entry.label;
    item.appendChild(label);

    if (entry.shortcut) {
      const shortcut = document.createElement("span");
      shortcut.className = "__pd-context-menu-item-shortcut";
      shortcut.textContent = entry.shortcut;
      item.appendChild(shortcut);
    }

    // Keep the page (and picker) from reacting to interaction with the menu
    item.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
    item.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      hideContextMenu();
      entry.action();
    });

    menuEl.appendChild(item);
  }

  document.documentElement.appendChild(menuEl);

  // Clamp into the viewport (menu size known only after mount)
  const rect = menuEl.getBoundingClientRect();
  const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
  menuEl.style.setProperty("left", `${left}px`, "important");
  menuEl.style.setProperty("top", `${top}px`, "important");

  // window-level capture fires before the picker/keyboard document listeners,
  // so Esc and outside clicks dismiss the menu without side effects.
  window.addEventListener("mousedown", onGlobalMouseDown, true);
  window.addEventListener("keydown", onGlobalKeyDown, true);
  window.addEventListener("scroll", onGlobalScroll, true);
  window.addEventListener("blur", hideContextMenu);
}

function onGlobalMouseDown(e: MouseEvent): void {
  if (menuEl && !menuEl.contains(e.target as Node)) {
    hideContextMenu();
    // Swallow the dismissing gesture (native-menu convention) — it should
    // close the menu, not also change the selection underneath.
    e.preventDefault();
    e.stopPropagation();
    suppressNextClick();
  }
}

function onGlobalKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopImmediatePropagation();
    hideContextMenu();
  }
}

function onGlobalScroll(): void {
  hideContextMenu();
}
