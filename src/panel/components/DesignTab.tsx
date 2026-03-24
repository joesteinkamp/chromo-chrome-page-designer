import {
  DimensionsSection,
  AutoLayoutSection,
  FillSection,
  StrokeSection,
  CornerRadiusSection,
  ShadowSection,
  OpacitySection,
  BlurSection,
} from "../sections";
import { TypographyTab } from "./TypographyTab";
import type { ElementData } from "../../shared/types";

interface Props {
  data: ElementData;
  onStyleChange: (property: string, value: string) => void;
}

export function DesignTab({ data, onStyleChange }: Props) {
  const { computedStyles, hasTextContent } = data;

  return (
    <div className="pd-design-tab">
      <DimensionsSection
        computedStyles={computedStyles}
        onStyleChange={onStyleChange}
      />
      <AutoLayoutSection
        computedStyles={computedStyles}
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
        onStyleChange={onStyleChange}
      />
      <StrokeSection
        computedStyles={computedStyles}
        onStyleChange={onStyleChange}
      />
      <CornerRadiusSection
        computedStyles={computedStyles}
        onStyleChange={onStyleChange}
      />
      <ShadowSection
        computedStyles={computedStyles}
        onStyleChange={onStyleChange}
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
}
