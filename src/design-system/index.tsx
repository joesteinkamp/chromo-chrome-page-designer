/**
 * Design System Showcase — React entry point.
 * Mounts interactive control demos into design-system.html.
 */

// Mock the chrome extension APIs so panel components render without errors.
// Handlers that call sendMessage will no-op silently.
if (typeof (window as any).chrome === "undefined") {
  (window as any).chrome = {
    runtime: {
      sendMessage: () => Promise.resolve({}),
      onMessage: { addListener: () => {}, removeListener: () => {} },
    },
    tabs: {
      query: (_: unknown, cb: (tabs: { url: string }[]) => void) =>
        cb([{ url: "https://example.com" }]),
      onActivated: { addListener: () => {}, removeListener: () => {} },
      onUpdated: { addListener: () => {}, removeListener: () => {} },
    },
    storage: {
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
      },
      sync: {
        get: (_: unknown, cb: (result: Record<string, unknown>) => void) => cb({}),
        set: () => Promise.resolve(),
      },
    },
  };
}

import { createRoot } from "react-dom/client";
import { useState, useCallback } from "react";
import {
  NumberInput,
  UnitInput,
  SliderInput,
  SelectDropdown,
  DirectionToggle,
  AlignmentGrid,
  ColorPicker,
  CornerRadiusInput,
} from "../panel/controls";
import * as Icons from "../panel/icons";
import { SidebarSelected, SidebarEmpty } from "./SidebarPreview";
import "../panel/panel.css";
import "../panel/controls/controls.css";
import "../panel/sections/sections.css";
import "../panel/components/changes.css";
import "../panel/components/ai.css";
import "../panel/components/typography.css";
import "../panel/components/agent-sync.css";

function IconsGallery() {
  // Render every exported icon from the icons module
  const entries = Object.entries(Icons).filter(
    ([, value]) => typeof value === "function"
  ) as Array<[string, React.FC<{ size?: number; className?: string }>]>;

  return (
    <div className="ds-icons-grid">
      {entries.map(([name, IconComponent]) => (
        <div key={name} className="ds-icon-card">
          <IconComponent size={24} />
          <span className="ds-icon-card__name">{name}</span>
        </div>
      ))}
    </div>
  );
}

function ControlsGallery() {
  const [numVal, setNumVal] = useState(16);
  const [sliderVal, setSliderVal] = useState(50);
  const [direction, setDirection] = useState("row");
  const [justify, setJustify] = useState("flex-start");
  const [align, setAlign] = useState("flex-start");
  const [color, setColor] = useState("#4f9eff");
  const [selectVal, setSelectVal] = useState("solid");
  const [unitVal, setUnitVal] = useState("320px");
  const [radiusVals, setRadiusVals] = useState<[string, string, string, string]>(["4px", "4px", "4px", "4px"]);

  const handleAlignChange = useCallback((j: string, a: string) => {
    setJustify(j);
    setAlign(a);
  }, []);

  return (
    <div className="ds-controls-grid">
      {/* NumberInput */}
      <div className="ds-control-card">
        <div className="ds-control-card__label">NumberInput</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <NumberInput value={numVal} onChange={setNumVal} label="W" suffix="px" min={0} />
          <NumberInput value={100} onChange={() => {}} label="H" suffix="px" min={0} />
        </div>
      </div>

      {/* UnitInput */}
      <div className="ds-control-card">
        <div className="ds-control-card__label">UnitInput</div>
        <UnitInput
          value={unitVal}
          onChange={setUnitVal}
          label="Width"
        />
      </div>

      {/* SliderInput */}
      <div className="ds-control-card">
        <div className="ds-control-card__label">SliderInput</div>
        <SliderInput
          value={sliderVal}
          onChange={setSliderVal}
          label="Opacity"
          min={0}
          max={100}
          suffix="%"
        />
      </div>

      {/* SelectDropdown */}
      <div className="ds-control-card">
        <div className="ds-control-card__label">SelectDropdown</div>
        <SelectDropdown
          value={selectVal}
          onChange={setSelectVal}
          label="Border"
          options={[
            { value: "none", label: "None" },
            { value: "solid", label: "Solid" },
            { value: "dashed", label: "Dashed" },
            { value: "dotted", label: "Dotted" },
          ]}
        />
      </div>

      {/* DirectionToggle */}
      <div className="ds-control-card">
        <div className="ds-control-card__label">DirectionToggle</div>
        <DirectionToggle value={direction} onChange={setDirection} />
      </div>

      {/* AlignmentGrid */}
      <div className="ds-control-card">
        <div className="ds-control-card__label">AlignmentGrid</div>
        <AlignmentGrid
          justifyContent={justify}
          alignItems={align}
          onChange={handleAlignChange}
        />
      </div>

      {/* ColorPicker */}
      <div className="ds-control-card">
        <div className="ds-control-card__label">ColorPicker</div>
        <ColorPicker
          value={color}
          onChange={setColor}
          designTokens={[
            { name: "--pd-accent", value: "#4f9eff" },
            { name: "--pd-green", value: "#34c759" },
            { name: "--pd-danger", value: "#ff453a" },
          ]}
          pageColors={["#4f9eff", "#34c759", "#ff453a", "#a78bfa", "#f59e0b"]}
        />
      </div>

      {/* CornerRadiusInput */}
      <div className="ds-control-card">
        <div className="ds-control-card__label">CornerRadiusInput</div>
        <CornerRadiusInput
          values={radiusVals}
          onChange={setRadiusVals}
        />
      </div>
    </div>
  );
}

const iconsRoot = document.getElementById("icons-root");
if (iconsRoot) {
  createRoot(iconsRoot).render(<IconsGallery />);
}

const controlsRoot = document.getElementById("controls-root");
if (controlsRoot) {
  createRoot(controlsRoot).render(<ControlsGallery />);
}

const sidebarSelectedRoot = document.getElementById("sidebar-selected-root");
if (sidebarSelectedRoot) {
  createRoot(sidebarSelectedRoot).render(<SidebarSelected />);
}

const sidebarEmptyRoot = document.getElementById("sidebar-empty-root");
if (sidebarEmptyRoot) {
  createRoot(sidebarEmptyRoot).render(<SidebarEmpty />);
}
