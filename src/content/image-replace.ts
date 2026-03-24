/**
 * Image replacement — when an image element is selected, show a floating
 * toolbar with a "Replace" button. Opens file picker or URL input.
 */

import { recordImageChange } from "./change-tracker";

let toolbar: HTMLDivElement | null = null;
let currentImage: HTMLImageElement | null = null;
let fileInput: HTMLInputElement | null = null;

export function showImageToolbar(element: Element): void {
  hideImageToolbar();

  if (element.tagName.toLowerCase() !== "img") return;

  currentImage = element as HTMLImageElement;
  const rect = element.getBoundingClientRect();

  toolbar = document.createElement("div");
  toolbar.className = "__pd-image-toolbar";
  toolbar.style.cssText = `
    position: fixed !important;
    z-index: 2147483647 !important;
    left: ${rect.left}px !important;
    top: ${Math.max(0, rect.top - 36)}px !important;
    display: flex !important;
    gap: 4px !important;
    background: #2c2c2c !important;
    border: 1px solid #3e3e3e !important;
    border-radius: 6px !important;
    padding: 4px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
  `;

  const replaceBtn = createButton("Replace", () => openFilePicker());
  const urlBtn = createButton("URL", () => promptUrl());

  toolbar.appendChild(replaceBtn);
  toolbar.appendChild(urlBtn);
  document.documentElement.appendChild(toolbar);

  fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  fileInput.addEventListener("change", onFileSelected);
  document.body.appendChild(fileInput);
}

export function hideImageToolbar(): void {
  toolbar?.remove();
  toolbar = null;
  fileInput?.remove();
  fileInput = null;
  currentImage = null;
}

export function hasImageToolbar(): boolean {
  return toolbar !== null;
}

// --- Internal ---

function createButton(text: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = text;
  btn.style.cssText = `
    border: none !important;
    background: #4f9eff !important;
    color: #fff !important;
    padding: 4px 10px !important;
    border-radius: 4px !important;
    font-size: 11px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    font-family: inherit !important;
  `;
  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#3a8fee !important";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#4f9eff !important";
  });
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  });
  return btn;
}

function openFilePicker(): void {
  fileInput?.click();
}

function onFileSelected(): void {
  if (!fileInput || !currentImage || !fileInput.files?.length) return;

  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    if (!currentImage || typeof reader.result !== "string") return;
    replaceImage(reader.result);
  };
  reader.readAsDataURL(file);
}

function promptUrl(): void {
  if (!toolbar || !currentImage) return;

  toolbar.innerHTML = "";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Paste image URL...";
  input.style.cssText = `
    border: 1px solid #3e3e3e !important;
    background: #1e1e1e !important;
    color: #e0e0e0 !important;
    padding: 4px 8px !important;
    border-radius: 4px !important;
    font-size: 11px !important;
    font-family: inherit !important;
    width: 200px !important;
    outline: none !important;
  `;

  const goBtn = createButton("Go", () => {
    const url = input.value.trim();
    if (url) replaceImage(url);
  });

  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      const url = input.value.trim();
      if (url) replaceImage(url);
    } else if (e.key === "Escape") {
      hideImageToolbar();
    }
  });

  toolbar.appendChild(input);
  toolbar.appendChild(goBtn);
  input.focus();
}

function replaceImage(newSrc: string): void {
  if (!currentImage) return;

  const oldSrc = currentImage.src;
  currentImage.src = newSrc;

  recordImageChange(currentImage, oldSrc, newSrc);

  hideImageToolbar();
}
