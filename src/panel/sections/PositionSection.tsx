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
  onStyleChange: (property: string, value: string) => void;
  rect: { x: number; y: number; width: number; height: number };
  parentRect: { x: number; y: number; width: number; height: number };
}

type HAlign = "left" | "center" | "right" | null;
type VAlign = "top" | "middle" | "bottom" | null;

function pxOrZero(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

/**
 * Detect alignment from the visual offset within the parent. Tolerates a
 * 1px rounding gap so subpixel layouts still highlight the active button.
 */
function detectHAlign(offsetX: number, elementWidth: number, parentWidth: number): HAlign {
  if (Math.abs(offsetX) <= 1) return "left";
  if (Math.abs(offsetX + elementWidth - parentWidth) <= 1) return "right";
  if (Math.abs(offsetX - (parentWidth - elementWidth) / 2) <= 1) return "center";
  return null;
}

function detectVAlign(offsetY: number, elementHeight: number, parentHeight: number): VAlign {
  if (Math.abs(offsetY) <= 1) return "top";
  if (Math.abs(offsetY + elementHeight - parentHeight) <= 1) return "bottom";
  if (Math.abs(offsetY - (parentHeight - elementHeight) / 2) <= 1) return "middle";
  return null;
}

/**
 * Treat absolute/fixed/sticky as "directly positioned" — `left/top` are
 * measured from the positioned ancestor, so we can write them as-is.
 * Static and relative both place the element via flow; we promote static
 * to relative and translate the desired in-parent offset into a shift
 * from the element's natural flow position.
 */
function isDirectlyPositioned(position: string | undefined): boolean {
  return position === "absolute" || position === "fixed" || position === "sticky";
}

export const PositionSection: React.FC<PositionSectionProps> = ({
  computedStyles,
  onStyleChange,
  rect,
  parentRect,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const offsetX = Math.round(rect.x - parentRect.x);
  const offsetY = Math.round(rect.y - parentRect.y);

  const hAlign = detectHAlign(offsetX, rect.width, parentRect.width);
  const vAlign = detectVAlign(offsetY, rect.height, parentRect.height);

  const currentPosition = computedStyles["position"] || "static";
  const directlyPositioned = isDirectlyPositioned(currentPosition);

  /**
   * Translate a desired in-parent offset into the `left` value to write.
   * For absolute/fixed/sticky, `left` is measured from the positioned
   * ancestor, so the offset can be written directly. For static/relative
   * the element is laid out by flow, so we shift it from its natural
   * position by the delta between desired and current visual offsets.
   */
  const computeLeft = useCallback(
    (desiredOffsetX: number): number => {
      if (directlyPositioned) return desiredOffsetX;
      const currentLeft = pxOrZero(computedStyles["left"]);
      return desiredOffsetX - offsetX + currentLeft;
    },
    [directlyPositioned, computedStyles, offsetX]
  );

  const computeTop = useCallback(
    (desiredOffsetY: number): number => {
      if (directlyPositioned) return desiredOffsetY;
      const currentTop = pxOrZero(computedStyles["top"]);
      return desiredOffsetY - offsetY + currentTop;
    },
    [directlyPositioned, computedStyles, offsetY]
  );

  /**
   * Make sure the element is positioned before writing left/top — otherwise
   * the values have no visual effect. Static promotes to relative.
   */
  const ensurePositioned = useCallback(() => {
    if (currentPosition === "static") {
      onStyleChange("position", "relative");
    }
  }, [currentPosition, onStyleChange]);

  const setX = useCallback(
    (desired: number) => {
      ensurePositioned();
      onStyleChange("left", `${Math.round(computeLeft(desired))}px`);
      onStyleChange("right", "auto");
    },
    [ensurePositioned, onStyleChange, computeLeft]
  );

  const setY = useCallback(
    (desired: number) => {
      ensurePositioned();
      onStyleChange("top", `${Math.round(computeTop(desired))}px`);
      onStyleChange("bottom", "auto");
    },
    [ensurePositioned, onStyleChange, computeTop]
  );

  const handleXChange = useCallback((v: number) => setX(v), [setX]);
  const handleYChange = useCallback((v: number) => setY(v), [setY]);

  const alignLeft = useCallback(() => setX(0), [setX]);
  const alignRight = useCallback(
    () => setX(parentRect.width - rect.width),
    [setX, parentRect.width, rect.width]
  );
  const alignCenterH = useCallback(
    () => setX(Math.round((parentRect.width - rect.width) / 2)),
    [setX, parentRect.width, rect.width]
  );

  const alignTop = useCallback(() => setY(0), [setY]);
  const alignBottom = useCallback(
    () => setY(parentRect.height - rect.height),
    [setY, parentRect.height, rect.height]
  );
  const alignCenterV = useCallback(
    () => setY(Math.round((parentRect.height - rect.height) / 2)),
    [setY, parentRect.height, rect.height]
  );

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
