import React from "react";
import {
  DimensionsSection,
  AutoLayoutSection,
  FillSection,
  StrokeSection,
  CornerRadiusSection,
  ShadowSection,
  OpacitySection,
  BlurSection,
  SpacingSection,
  ComponentPropsSection,
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

  return (
    <div className="pd-design-tab">
      {data.componentInfo?.props && data.componentInfo.props.length > 0 && (
        <ComponentPropsSection
          componentInfo={data.componentInfo}
          selector={data.selector}
        />
      )}
      <DimensionsSection
        computedStyles={computedStyles}
        authoredStyles={data.authoredStyles}
        onStyleChange={onStyleChange}
      />
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
