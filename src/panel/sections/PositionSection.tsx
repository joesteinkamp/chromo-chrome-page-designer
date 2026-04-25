import React, { useState, useCallback } from "react";
import { NumberInput } from "../controls";
import {
  ChevronDown,
  PositionLeftIcon,
  PositionCenterHIcon,
  PositionRightIcon,
  PositionTopIcon,
  PositionCenterVIcon,
  PositionBottomIcon,
} from "../icons";
import "./sections.css";

interface PositionSectionProps {
  computedStyles: Record<string, string>;
  authoredStyles?: Record<string, string>;
  onStyleChange: (property: string, value: string) => void;
  rect: { x: number; y: number; width: number; height: number };
  parentRect: { x: number; y: number; width: number; height: number };
}

type HAlign = "left" | "center" | "right" | null;
type VAlign = "top" | "middle" | "bottom" | null;

function px(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function isAuto(val: string | undefined): boolean {
  return !val || val.trim() === "" || val.trim() === "auto";
}

/**
 * Detect which horizontal alignment the current authored top/right/left/bottom
 * matches. Used to highlight the active alignment button.
 */
function detectHAlign(left: string | undefined, right: string | undefined): HAlign {
  if (!isAuto(right) && isAuto(left) && px(right) === 0) return "right";
  if (!isAuto(left) && isAuto(right) && px(left) === 0) return "left";
  return null;
}

function detectVAlign(top: string | undefined, bottom: string | undefined): VAlign {
  if (!isAuto(bottom) && isAuto(top) && px(bottom) === 0) return "bottom";
  if (!isAuto(top) && isAuto(bottom) && px(top) === 0) return "top";
  return null;
}

export const PositionSection: React.FC<PositionSectionProps> = ({
  computedStyles,
  authoredStyles,
  onStyleChange,
  rect,
  parentRect,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const offsetX = Math.round(rect.x - parentRect.x);
  const offsetY = Math.round(rect.y - parentRect.y);

  const hAlign = detectHAlign(authoredStyles?.["left"], authoredStyles?.["right"]);
  const vAlign = detectVAlign(authoredStyles?.["top"], authoredStyles?.["bottom"]);

  /**
   * Make sure the element is positioned (relative/absolute/fixed/sticky)
   * before writing left/top/right/bottom — otherwise the values have no
   * visual effect.
   */
  const ensurePositioned = useCallback(() => {
    const current = computedStyles["position"] || "static";
    if (current === "static") {
      onStyleChange("position", "relative");
    }
  }, [computedStyles, onStyleChange]);

  const handleXChange = useCallback(
    (v: number) => {
      ensurePositioned();
      onStyleChange("left", `${v}px`);
      onStyleChange("right", "auto");
    },
    [ensurePositioned, onStyleChange]
  );

  const handleYChange = useCallback(
    (v: number) => {
      ensurePositioned();
      onStyleChange("top", `${v}px`);
      onStyleChange("bottom", "auto");
    },
    [ensurePositioned, onStyleChange]
  );

  const alignLeft = useCallback(() => {
    ensurePositioned();
    onStyleChange("left", "0px");
    onStyleChange("right", "auto");
  }, [ensurePositioned, onStyleChange]);

  const alignRight = useCallback(() => {
    ensurePositioned();
    onStyleChange("left", "auto");
    onStyleChange("right", "0px");
  }, [ensurePositioned, onStyleChange]);

  const alignCenterH = useCallback(() => {
    ensurePositioned();
    const offset = Math.round((parentRect.width - rect.width) / 2);
    onStyleChange("left", `${offset}px`);
    onStyleChange("right", "auto");
  }, [ensurePositioned, onStyleChange, parentRect.width, rect.width]);

  const alignTop = useCallback(() => {
    ensurePositioned();
    onStyleChange("top", "0px");
    onStyleChange("bottom", "auto");
  }, [ensurePositioned, onStyleChange]);

  const alignBottom = useCallback(() => {
    ensurePositioned();
    onStyleChange("top", "auto");
    onStyleChange("bottom", "0px");
  }, [ensurePositioned, onStyleChange]);

  const alignCenterV = useCallback(() => {
    ensurePositioned();
    const offset = Math.round((parentRect.height - rect.height) / 2);
    onStyleChange("top", `${offset}px`);
    onStyleChange("bottom", "auto");
  }, [ensurePositioned, onStyleChange, parentRect.height, rect.height]);

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">Position</span>
        <span
          className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}
        >
          <ChevronDown size={12} />
        </span>
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          <div className="pd-section__row pd-section__row--half">
            <div className="pd-position__align-group" role="group" aria-label="Horizontal alignment">
              <button
                className={`pd-position__align-btn${hAlign === "left" ? " pd-position__align-btn--active" : ""}`}
                onClick={alignLeft}
                type="button"
                title="Align left"
              >
                <PositionLeftIcon size={14} />
              </button>
              <button
                className={`pd-position__align-btn${hAlign === "center" ? " pd-position__align-btn--active" : ""}`}
                onClick={alignCenterH}
                type="button"
                title="Center horizontally"
              >
                <PositionCenterHIcon size={14} />
              </button>
              <button
                className={`pd-position__align-btn${hAlign === "right" ? " pd-position__align-btn--active" : ""}`}
                onClick={alignRight}
                type="button"
                title="Align right"
              >
                <PositionRightIcon size={14} />
              </button>
            </div>
            <div className="pd-position__align-group" role="group" aria-label="Vertical alignment">
              <button
                className={`pd-position__align-btn${vAlign === "top" ? " pd-position__align-btn--active" : ""}`}
                onClick={alignTop}
                type="button"
                title="Align top"
              >
                <PositionTopIcon size={14} />
              </button>
              <button
                className={`pd-position__align-btn${vAlign === "middle" ? " pd-position__align-btn--active" : ""}`}
                onClick={alignCenterV}
                type="button"
                title="Center vertically"
              >
                <PositionCenterVIcon size={14} />
              </button>
              <button
                className={`pd-position__align-btn${vAlign === "bottom" ? " pd-position__align-btn--active" : ""}`}
                onClick={alignBottom}
                type="button"
                title="Align bottom"
              >
                <PositionBottomIcon size={14} />
              </button>
            </div>
          </div>
          <div className="pd-section__row pd-section__row--half">
            <NumberInput value={offsetX} onChange={handleXChange} label="X" suffix="px" />
            <NumberInput value={offsetY} onChange={handleYChange} label="Y" suffix="px" />
          </div>
        </div>
      )}
    </div>
  );
};
