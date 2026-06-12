import React, { useState } from "react";
import { ChevronDown } from "../icons";
import { CSS_TO_FIGMA } from "../../shared/css-mapping";
import type { ElementData } from "../../shared/types";
import "./sections.css";

interface StyleSourcesSectionProps {
  styleSources: NonNullable<ElementData["styleSources"]>;
}

/**
 * Cascade visibility: shows which CSS rule supplies each property's current
 * value, so designers know what they're overriding and the handoff targets
 * the right rule.
 */
export const StyleSourcesSection: React.FC<StyleSourcesSectionProps> = ({
  styleSources,
}) => {
  const [collapsed, setCollapsed] = useState(true);

  const entries = Object.entries(styleSources);
  if (entries.length === 0) return null;

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Style sources</span>
        <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}>
          <ChevronDown size={12} />
        </span>
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          {entries.map(([prop, source]) => {
            const label = CSS_TO_FIGMA[prop] || prop;
            let from: string;
            let title: string;
            if (source.inline) {
              from = source.important ? "Page Designer edit" : "inline style";
              title = from;
            } else {
              from = source.selector;
              title = source.sheet ? `${source.selector} — ${source.sheet}` : source.selector;
            }
            return (
              <div className="pd-sources__row" key={prop}>
                <span className="pd-sources__prop" title={prop}>{label}</span>
                <span
                  className={`pd-sources__rule${source.inline ? " pd-sources__rule--inline" : ""}`}
                  title={title}
                >
                  {from}
                  {!source.inline && source.sheet && (
                    <span className="pd-sources__sheet"> · {source.sheet}</span>
                  )}
                  {source.important && !source.inline && (
                    <span className="pd-sources__important"> !important</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
