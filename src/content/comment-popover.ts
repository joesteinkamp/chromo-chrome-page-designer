/**
 * Comment popover — the Agentation-style floating card that lets the user
 * attach a freeform instruction to an element ("use a dropdown instead",
 * "should be a Button component", etc.).
 *
 * Opened by clicking the (+) button shown on the selection overlay, or by
 * clicking an existing numbered pin (to edit/delete the comment).
 */

import type { CommentChange } from "../shared/types";

interface OpenOptions {
  /** Anchoring rect in viewport coordinates (top-right corner is preferred) */
  anchorRect: DOMRect;
  /** Breadcrumb / context header, e.g. `<App> button "How they are measured"` */
  contextLabel: string;
  /** Existing comment to edit (omit to create a new one) */
  existing?: CommentChange;
  /** Called when saving a new comment (not used when editing) */
  onSave?: (text: string) => void;
  /** Called when updating an existing comment */
  onUpdate?: (text: string) => void;
  /** Called from the Delete button when editing */
  onDelete?: () => void;
  onClose: () => void;
}

let popoverEl: HTMLDivElement | null = null;
let currentOptions: OpenOptions | null = null;
let outsideClickHandler: ((e: MouseEvent) => void) | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

export function isPopoverOpen(): boolean {
  return popoverEl !== null;
}

/** True if the given node is inside (or is) the popover — used to bypass
 *  keyboard shortcuts so typing in the textarea doesn't trigger Delete/Hide. */
export function isInsidePopover(node: EventTarget | null): boolean {
  if (!popoverEl || !(node instanceof Node)) return false;
  return popoverEl.contains(node);
}

export function openCommentPopover(options: OpenOptions): void {
  closeCommentPopover();
  currentOptions = options;

  const el = document.createElement("div");
  el.className = "__pd-comment-popover";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Add comment");

  const header = document.createElement("div");
  header.className = "__pd-comment-popover__header";
  const chevron = document.createElement("span");
  chevron.className = "__pd-comment-popover__chevron";
  chevron.textContent = ">";
  const contextSpan = document.createElement("span");
  contextSpan.className = "__pd-comment-popover__context";
  contextSpan.textContent = options.contextLabel;
  header.appendChild(chevron);
  header.appendChild(contextSpan);

  const textarea = document.createElement("textarea");
  textarea.className = "__pd-comment-popover__textarea";
  textarea.placeholder = "What should change?";
  textarea.rows = 3;
  textarea.value = options.existing?.text ?? "";

  const actions = document.createElement("div");
  actions.className = "__pd-comment-popover__actions";

  // Left side: Delete (only when editing)
  if (options.existing && options.onDelete) {
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "__pd-comment-popover__btn __pd-comment-popover__btn--danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => {
      options.onDelete?.();
      closeCommentPopover();
    });
    actions.appendChild(delBtn);
  }

  const spacer = document.createElement("div");
  spacer.className = "__pd-comment-popover__actions-spacer";
  actions.appendChild(spacer);

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "__pd-comment-popover__btn";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => {
    closeCommentPopover();
  });

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "__pd-comment-popover__btn __pd-comment-popover__btn--primary";
  saveBtn.textContent = options.existing ? "Save" : "Add";
  saveBtn.addEventListener("click", () => {
    commit();
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  el.appendChild(header);
  el.appendChild(textarea);
  el.appendChild(actions);

  // Keep clicks inside the popover from reaching the page or picker
  el.addEventListener("mousedown", (e) => e.stopPropagation());
  el.addEventListener("click", (e) => e.stopPropagation());

  // Pre-set width before measuring so layout is stable.
  el.style.setProperty("width", "300px", "important");
  // Render off-screen briefly so we can measure height without a flash.
  el.style.setProperty("left", "-9999px", "important");
  el.style.setProperty("top", "-9999px", "important");

  document.documentElement.appendChild(el);
  popoverEl = el;

  positionPopover(el, options.anchorRect);

  // Focus the textarea and place cursor at end
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });

  // Outside-click cancels
  outsideClickHandler = (e: MouseEvent) => {
    if (!popoverEl) return;
    if (!popoverEl.contains(e.target as Node)) {
      closeCommentPopover();
    }
  };
  // Use capture so we see the click before the picker's capture-phase listener
  document.addEventListener("mousedown", outsideClickHandler, true);

  // Esc cancels, Cmd/Ctrl+Enter saves
  keydownHandler = (e: KeyboardEvent) => {
    if (!popoverEl) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeCommentPopover();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      commit();
    }
  };
  document.addEventListener("keydown", keydownHandler, true);

  function commit(): void {
    const text = textarea.value.trim();
    if (!text) {
      textarea.focus();
      return;
    }
    if (options.existing && options.onUpdate) {
      options.onUpdate(text);
    } else if (options.onSave) {
      options.onSave(text);
    }
    closeCommentPopover();
  }
}

export function closeCommentPopover(): void {
  if (!popoverEl) return;
  popoverEl.remove();
  popoverEl = null;
  if (outsideClickHandler) {
    document.removeEventListener("mousedown", outsideClickHandler, true);
    outsideClickHandler = null;
  }
  if (keydownHandler) {
    document.removeEventListener("keydown", keydownHandler, true);
    keydownHandler = null;
  }
  const opts = currentOptions;
  currentOptions = null;
  opts?.onClose();
}

function positionPopover(el: HTMLDivElement, anchor: DOMRect): void {
  // The (+) button sits at the top-right of the selection (see overlay.ts
  // positionCommentButton). Anchor the popover to that point so it always
  // opens adjacent to the button — not at the far corner of a huge element.
  const btnSize = 24;
  const btnCenterX = anchor.right + 4;
  const btnCenterY = anchor.top - 4;
  const btnRight = btnCenterX + btnSize / 2;
  const btnBottom = btnCenterY + btnSize / 2;
  const btnTop = btnCenterY - btnSize / 2;

  const width = 300;
  const margin = 8;
  const gap = 8;

  // Measure actual height after the popover is in the DOM so the flip logic
  // knows the real size (the popover has variable content height).
  const height = el.offsetHeight || 140;

  // Default: below the button, right-aligned so the (+) feels attached to
  // the popover's top-right corner.
  let left = btnRight - width;
  let top = btnBottom + gap;

  // Flip above if it would overflow the viewport bottom
  if (top + height > window.innerHeight - margin) {
    top = btnTop - height - gap;
  }

  // Clamp horizontally
  if (left + width > window.innerWidth - margin) {
    left = window.innerWidth - width - margin;
  }
  if (left < margin) left = margin;

  // Clamp vertically (in case both above and below would overflow)
  if (top < margin) top = margin;
  if (top + height > window.innerHeight - margin) {
    top = Math.max(margin, window.innerHeight - height - margin);
  }

  el.style.setProperty("left", `${left}px`, "important");
  el.style.setProperty("top", `${top}px`, "important");
  el.style.setProperty("width", `${width}px`, "important");
}
