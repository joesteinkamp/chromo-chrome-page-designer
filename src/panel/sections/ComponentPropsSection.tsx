import React, { useState, useCallback } from "react";
import { NumberInput } from "../controls";
import { ChevronDown } from "../icons";
import type { ElementData } from "../../shared/types";
import type { Message } from "../../shared/messages";
import "./sections.css";

interface ComponentPropsSectionProps {
  componentInfo: NonNullable<ElementData["componentInfo"]>;
  selector: string;
}

export const ComponentPropsSection: React.FC<ComponentPropsSectionProps> = ({
  componentInfo,
  selector,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const props = componentInfo.props;
  if (!props || props.length === 0) return null;

  const handlePropChange = useCallback(
    (propName: string, propValue: string | number | boolean | null, propType: "string" | "number" | "boolean" | "null") => {
      if (!componentInfo.framework) return;
      chrome.runtime.sendMessage({
        type: "APPLY_PROP",
        framework: componentInfo.framework,
        componentName: componentInfo.componentName!,
        propName,
        propValue,
        propType,
      } satisfies Message);
    },
    [componentInfo.componentName, componentInfo.framework, selector],
  );

  return (
    <div className="pd-section">
      <div className="pd-section__header" onClick={() => setCollapsed((c) => !c)}>
        <span className="pd-section__title">
          Component Props
        </span>
        <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}><ChevronDown size={12} /></span>
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          <div className="pd-props__component-label">
            {"<"}{componentInfo.componentName}{">"}
          </div>
          {props.map((prop) => (
            <PropRow
              key={prop.name}
              prop={prop}
              enumValues={componentInfo.enumValues?.[prop.name]}
              onChange={handlePropChange}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface PropRowProps {
  prop: { name: string; value: string | number | boolean | null; type: "string" | "number" | "boolean" | "null" };
  enumValues?: string[];
  onChange: (name: string, value: string | number | boolean | null, type: "string" | "number" | "boolean" | "null") => void;
}

function PropRow({ prop, enumValues, onChange }: PropRowProps) {
  const [localValue, setLocalValue] = useState(String(prop.value ?? ""));

  // Sync when prop changes externally
  React.useEffect(() => {
    setLocalValue(String(prop.value ?? ""));
  }, [prop.value]);

  const handleStringCommit = useCallback(() => {
    if (localValue !== String(prop.value ?? "")) {
      onChange(prop.name, localValue, "string");
    }
  }, [localValue, prop.name, prop.value, onChange]);

  if (prop.type === "boolean") {
    return (
      <div className="pd-section__row pd-props__row">
        <span className="pd-props__name">{prop.name}</span>
        <label className="pd-props__toggle">
          <input
            type="checkbox"
            checked={!!prop.value}
            onChange={(e) => onChange(prop.name, e.target.checked, "boolean")}
          />
          <span className="pd-props__toggle-label">{prop.value ? "true" : "false"}</span>
        </label>
      </div>
    );
  }

  if (prop.type === "number") {
    return (
      <div className="pd-section__row pd-props__row">
        <span className="pd-props__name">{prop.name}</span>
        <NumberInput
          value={typeof prop.value === "number" ? prop.value : 0}
          onChange={(v) => onChange(prop.name, v, "number")}
        />
      </div>
    );
  }

  if (prop.type === "null") {
    return (
      <div className="pd-section__row pd-props__row">
        <span className="pd-props__name">{prop.name}</span>
        <span className="pd-props__null">null</span>
      </div>
    );
  }

  // String type — use dropdown if enum values are available
  if (enumValues && enumValues.length > 0) {
    // Ensure current value is in the list
    const options = [...enumValues];
    const currentStr = String(prop.value ?? "");
    if (currentStr && !options.includes(currentStr)) {
      options.unshift(currentStr);
    }

    return (
      <div className="pd-section__row pd-props__row">
        <span className="pd-props__name">{prop.name}</span>
        <select
          className="pd-props__select"
          value={currentStr}
          onChange={(e) => onChange(prop.name, e.target.value, "string")}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  // Fallback: text input
  return (
    <div className="pd-section__row pd-props__row">
      <span className="pd-props__name">{prop.name}</span>
      <input
        className="pd-props__input"
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleStringCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleStringCommit();
        }}
      />
    </div>
  );
}
