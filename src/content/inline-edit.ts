/**
 * Inline text editing — double-click a selected element to edit its text content.
 * Sets contentEditable, handles blur/Escape to save.
 */

import { recordTextChange } from "./change-tracker";

let editingElement: HTMLElement | null = null;
let originalText: string = "";
let onEditComplete: (() => void) | null = null;

export function startInlineEdit(
  element: Element,
  callback: () => void
): boolean {
  if (!(element instanceof HTMLElement)) return false;

  // Only edit elements with direct text content
  if (!hasEditableText(element)) return false;

  editingElement = element;
  originalText = element.textContent || "";
  onEditComplete = callback;

  element.contentEditable = "true";
  element.classList.add("__pd-editing");
  element.focus();

  // Select all text
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  element.addEventListener("blur", onBlur);
  element.addEventListener("keydown", onKeyDown);

  return true;
}

export function stopInlineEdit(): void {
  if (!editingElement) return;
  finishEdit(false);
}

export function isEditing(): boolean {
  return editingElement !== null;
}

// --- Internal ---

function onBlur(): void {
  // Small delay to allow click-away to register
  setTimeout(() => finishEdit(true), 50);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    if (editingElement) {
      editingElement.textContent = originalText;
    }
    finishEdit(false);
  } else if (e.key === "Enter" && !e.shiftKey) {
    const tag = editingElement?.tagName.toLowerCase();
    const isBlock = tag && ["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "span", "a", "button"].includes(tag);
    if (isBlock) {
      e.preventDefault();
      finishEdit(true);
    }
  }
}

function finishEdit(save: boolean): void {
  if (!editingElement) return;

  const element = editingElement;
  const newText = element.textContent || "";

  element.contentEditable = "false";
  element.classList.remove("__pd-editing");
  element.removeEventListener("blur", onBlur);
  element.removeEventListener("keydown", onKeyDown);

  window.getSelection()?.removeAllRanges();

  if (save && newText !== originalText) {
    recordTextChange(element, originalText, newText);
  }

  editingElement = null;
  originalText = "";
  onEditComplete?.();
  onEditComplete = null;
}

function hasEditableText(element: Element): boolean {
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      return true;
    }
  }
  const children = element.children;
  if (children.length === 0 && element.textContent?.trim()) {
    return true;
  }
  return false;
}
