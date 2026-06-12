import React, { useCallback, useState, useEffect } from "react";
import { NumberInput, SelectDropdown } from "../controls";
import { ChevronDown } from "../icons";
import type { ElementData } from "../../shared/types";
import type { Message } from "../../shared/messages";
import "./sections.css";

interface ComponentSectionProps {
  componentInfo: NonNullable<ElementData["componentInfo"]>;
}

/**
 * Figma-style "Component" section: shows the detected framework component and
 * lets the designer edit its primitive props directly (variant, size, label…).
 * Prop edits map 1:1 to source code changes, so the exported changeset can say
 * "change variant to primary" instead of a pile of CSS overrides.
 */
export const ComponentSection: React.FC<ComponentSectionProps> = ({
  componentInfo,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const props = componentInfo.props || [];
  const framework = componentInfo.framework;
  const componentName = componentInfo.componentName;

  const sendProp = useCallback(
    (
      propName: string,
      propValue: string | number | boolean | null,
      propType: "string" | "number" | "boolean" | "null"
    ) => {
      if (!framework || !componentName) return;
      chrome.runtime.sendMessage({
        type: "APPLY_PROP",
        framework,
        componentName,
        propName,
        propValue,
        propType,
      } satisfies Message);
    },
    [framework, componentName]
  );

  if (!framework || !componentName || props.length === 0) return null;

  return (
    <div className="pd-section">
      <div
        className="pd-section__header"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="pd-section__title">
          Component · {componentName}
        </span>
        <span className={`pd-section__arrow${collapsed ? " pd-section__arrow--collapsed" : ""}`}>
          <ChevronDown size={12} />
        </span>
      </div>
      {!collapsed && (
        <div className="pd-section__content">
          {componentInfo.sourceFile && (
            <div className="pd-section__hint" title={componentInfo.sourceFile}>
              {componentInfo.sourceFile}
              {componentInfo.sourceLine ? `:${componentInfo.sourceLine}` : ""}
            </div>
          )}
          {props.map((prop) => (
            <div className="pd-section__row" key={prop.name}>
              <span className="pd-section__label" title={prop.name}>
                {prop.name}
              </span>
              <PropControl
                prop={prop}
                enumValues={componentInfo.enumValues?.[prop.name]}
                onCommit={sendProp}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface PropControlProps {
  prop: { name: string; value: string | number | boolean | null; type: "string" | "number" | "boolean" | "null" };
  enumValues?: string[];
  onCommit: (
    propName: string,
    propValue: string | number | boolean | null,
    propType: "string" | "number" | "boolean" | "null"
  ) => void;
}

const PropControl: React.FC<PropControlProps> = ({ prop, enumValues, onCommit }) => {
  if (prop.type === "boolean") {
    return (
      <input
        type="checkbox"
        className="pd-section__checkbox"
        checked={Boolean(prop.value)}
        onChange={(e) => onCommit(prop.name, e.target.checked, "boolean")}
      />
    );
  }

  if (prop.type === "number") {
    return (
      <NumberInput
        value={typeof prop.value === "number" ? prop.value : 0}
        onChange={(v) => onCommit(prop.name, v, "number")}
      />
    );
  }

  if (prop.type === "string" && enumValues && enumValues.length > 0) {
    return (
      <SelectDropdown
        value={String(prop.value ?? "")}
        options={enumValues.map((v) => ({ value: v, label: v }))}
        onChange={(v) => onCommit(prop.name, v, "string")}
      />
    );
  }

  return <StringPropInput prop={prop} onCommit={onCommit} />;
};

const StringPropInput: React.FC<Omit<PropControlProps, "enumValues">> = ({ prop, onCommit }) => {
  const [local, setLocal] = useState(String(prop.value ?? ""));
  useEffect(() => {
    setLocal(String(prop.value ?? ""));
  }, [prop.value]);

  const commit = () => {
    if (local !== String(prop.value ?? "")) {
      onCommit(prop.name, local, "string");
    }
  };

  return (
    <input
      type="text"
      className="pd-section__text-input"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
};
