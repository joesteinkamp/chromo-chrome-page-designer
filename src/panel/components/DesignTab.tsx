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
    display === "inline" || display === "inline-block" || display === "inline-flex";
  const tag = data.tag;
  const isReplaced = tag === "img" || tag === "video" || tag === "iframe" || tag === "canvas";

  return (
    <div className="pd-design-tab">
      <DimensionsSection
        computedStyles={computedStyles}
        authoredStyles={data.authoredStyles}
        onStyleChange={onStyleChange}
      />
      <SpacingSection
        computedStyles={computedStyles}
        authoredStyles={data.authoredStyles}
        onStyleChange={onStyleChange}
      />
      <AutoLayoutSection
        computedStyles={computedStyles}
        authoredStyles={data.authoredStyles}
        onStyleChange={onStyleChange}
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
        onStyleChange={onStyleChange}
      />
      <CornerRadiusSection
        computedStyles={computedStyles}
        authoredStyles={data.authoredStyles}
        onStyleChange={onStyleChange}
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
