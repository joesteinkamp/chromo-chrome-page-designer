import React from "react";
import {
  DimensionsSection,
  PositionSection,
  AutoLayoutSection,
  FillSection,
  StrokeSection,
  CornerRadiusSection,
  ShadowSection,
  OpacitySection,
  BlurSection,
  SpacingSection,
} from "../sections";
import { TypographyTab } from "./TypographyTab";
import type { ElementData } from "../../shared/types";

interface Props {
  data: ElementData;
  onStyleChange: (property: string, value: string) => void;
}

export const DesignTab = React.memo(function DesignTab({
  data,
  onStyleChange,
}: Props) {
  const { computedStyles, hasTextContent } = data;
  const display = computedStyles["display"] || "";
  const isInline =
    display === "inline" || display === "inline-block" || display === "inline-flex" || display === "inline-grid";
  const tag = data.tag;
  const isReplaced = tag === "img" || tag === "video" || tag === "iframe" || tag === "canvas";

  // Show position controls only when the element is NOT inside an auto-layout
  // (flex/grid) parent — auto-layout parents handle child placement themselves.
  const parentDisplay = data.parentLayout?.display || "";
  const parentIsAutoLayout =
    parentDisplay === "flex" ||
    parentDisplay === "inline-flex" ||
    parentDisplay === "grid" ||
    parentDisplay === "inline-grid";
  const showPosition = Boolean(data.parentLayout) && !parentIsAutoLayout;

  return (
    <div className="pd-design-tab">
      <DimensionsSection
        computedStyles={computedStyles}
        authoredStyles={data.authoredStyles}
        onStyleChange={onStyleChange}
      />
      {showPosition && data.parentLayout && (
        <PositionSection
          computedStyles={computedStyles}
          onStyleChange={onStyleChange}
          rect={data.rect}
          parentRect={data.parentLayout.rect}
        />
      )}
      <SpacingSection
        computedStyles={computedStyles}
        authoredStyles={data.authoredStyles}
        onStyleChange={onStyleChange}
        pageValues={data.pageValues.spacing}
      />
      <AutoLayoutSection
        computedStyles={computedStyles}
        authoredStyles={data.authoredStyles}
        onStyleChange={onStyleChange}
        pageValues={data.pageValues.spacing}
      />
      {hasTextContent && (
        <TypographyTab
          computedStyles={computedStyles}
          onStyleChange={onStyleChange}
        />
      )}
      <FillSection
        computedStyles={computedStyles}
        authoredStyles={data.authoredStyles}
        onStyleChange={onStyleChange}
        disabled={isReplaced}
        isSvg={data.isSvg}
        designTokens={data.designTokens}
        pageColors={data.pageColors}
      />
      <StrokeSection
        computedStyles={computedStyles}
        authoredStyles={data.authoredStyles}
        pageColors={data.pageColors}
        pageStrokeWidths={data.pageValues.strokeWidth}
        onStyleChange={onStyleChange}
      />
      <CornerRadiusSection
        computedStyles={computedStyles}
        authoredStyles={data.authoredStyles}
        onStyleChange={onStyleChange}
        pageValues={data.pageValues.radius}
      />
      <ShadowSection
        computedStyles={computedStyles}
        onStyleChange={onStyleChange}
        disabled={isInline}
      />
      <OpacitySection
        computedStyles={computedStyles}
        onStyleChange={onStyleChange}
      />
      <BlurSection
        computedStyles={computedStyles}
        onStyleChange={onStyleChange}
      />
    </div>
  );
});
