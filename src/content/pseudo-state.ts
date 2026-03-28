/**
 * Force pseudo-class states (:hover, :active, :focus) on elements.
 * Finds matching CSS rules with the pseudo-class selector and applies
 * their styles as inline styles, simulating the pseudo-state.
 */

const forcedElements = new Map<Element, { states: string[]; savedStyles: Map<string, string> }>();

/** Force or clear pseudo-states on an element */
export function forcePseudoState(element: Element, states: string[]): void {
  // Clear any previously forced states on this element
  clearForcedState(element);

  if (states.length === 0) return;

  const el = element as HTMLElement;
  const savedStyles = new Map<string, string>();
  const stylesToApply = new Map<string, string>();

  // Collect styles from pseudo-class rules
  try {
    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length; i++) {
      try {
        const rules = sheets[i].cssRules;
        for (let j = 0; j < rules.length; j++) {
          const rule = rules[j];
          if (!(rule instanceof CSSStyleRule)) continue;

          for (const state of states) {
            // Check if this rule's selector includes our pseudo-class
            const selText = rule.selectorText;
            if (!selText.includes(state)) continue;

            // Try to match the element against the selector with pseudo-class removed
            const baseSelector = selText
              .split(",")
              .filter((s) => s.includes(state))
              .map((s) => s.replace(new RegExp(`${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "g"), "").trim())
              .filter(Boolean);

            for (const base of baseSelector) {
              try {
                if (base && element.matches(base)) {
                  // Collect all properties from this rule
                  for (let k = 0; k < rule.style.length; k++) {
                    const prop = rule.style[k];
                    const val = rule.style.getPropertyValue(prop);
                    if (val) stylesToApply.set(prop, val);
                  }
                }
              } catch { /* invalid selector after stripping */ }
            }
          }
        }
      } catch { /* cross-origin stylesheet */ }
    }
  } catch { /* security restriction */ }

  // Save current inline values and apply pseudo-state styles
  for (const [prop, val] of stylesToApply) {
    savedStyles.set(prop, el.style.getPropertyValue(prop));
    el.style.setProperty(prop, val, "important");
  }

  if (savedStyles.size > 0) {
    forcedElements.set(element, { states, savedStyles });
  }
}

/** Clear forced pseudo-state and restore original inline styles */
export function clearForcedState(element: Element): void {
  const saved = forcedElements.get(element);
  if (!saved) return;

  const el = element as HTMLElement;
  for (const [prop, val] of saved.savedStyles) {
    if (val) {
      el.style.setProperty(prop, val);
    } else {
      el.style.removeProperty(prop);
    }
  }

  forcedElements.delete(element);
}

/** Clear all forced states (e.g., on deactivation) */
export function clearAllForcedStates(): void {
  for (const [element] of forcedElements) {
    clearForcedState(element);
  }
}

/** Get currently forced states for an element */
export function getForcedStates(element: Element): string[] {
  return forcedElements.get(element)?.states || [];
}
