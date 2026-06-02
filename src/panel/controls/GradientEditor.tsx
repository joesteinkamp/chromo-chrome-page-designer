import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ColorPicker } from "./ColorPicker";
import { NumberInput } from "./NumberInput";
import { PlusIcon, DeleteIcon } from "../icons";
import {
  type Gradient,
  type GradientStop,
  parseGradient,
  buildGradient,
  buildPreview,
  defaultGradient,
} from "../../shared/gradient";
import "./controls.css";

interface GradientEditorProps {
  /** Current CSS gradient string (e.g. `linear-gradient(...)`). */
  value: string;
  onChange: (css: string) => void;
  designTokens?: Array<{ name: string; value: string }>;
  pageColors?: string[];
}

const clampPos = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const GradientEditor: React.FC<GradientEditorProps> = ({
  value,
  onChange,
  designTokens,
  pageColors,
}) => {
  // Hold the gradient locally so dragging a stop past another doesn't reorder
  // indices under us mid-interaction. Re-sync only when the value changes
  // externally (i.e. not from our own emit).
  const [gradient, setGradient] = useState<Gradient>(() => parseGradient(value) ?? defaultGradient());
  const [selected, setSelected] = useState(0);
  const lastEmitted = useRef<string>("");
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      const parsed = parseGradient(value);
      if (parsed) {
        setGradient(parsed);
        setSelected((s) => Math.min(s, parsed.stops.length - 1));
      }
    }
  }, [value]);

  const commit = useCallback(
    (next: Gradient) => {
      setGradient(next);
      const css = buildGradient(next);
      lastEmitted.current = css;
      onChange(css);
    },
    [onChange]
  );

  const stops = gradient.stops;
  const selectedStop = stops[selected] ?? stops[0];
  const previewCss = useMemo(() => buildPreview(stops), [stops]);

  const setStop = useCallback(
    (index: number, patch: Partial<GradientStop>) => {
      const next = {
        ...gradient,
        stops: gradient.stops.map((s, i) => (i === index ? { ...s, ...patch } : s)),
      };
      commit(next);
    },
    [gradient, commit]
  );

  const addStopAt = useCallback(
    (position: number) => {
      // Seed the new stop with the color of the nearest existing one.
      const nearest = gradient.stops.reduce((best, s) =>
        Math.abs(s.position - position) < Math.abs(best.position - position) ? s : best
      );
      const next = {
        ...gradient,
        stops: [...gradient.stops, { color: nearest.color, position: clampPos(position) }],
      };
      commit(next);
      setSelected(next.stops.length - 1);
    },
    [gradient, commit]
  );

  const removeStop = useCallback(
    (index: number) => {
      if (gradient.stops.length <= 2) return;
      const next = { ...gradient, stops: gradient.stops.filter((_, i) => i !== index) };
      commit(next);
      setSelected((s) => Math.max(0, Math.min(s, next.stops.length - 1)));
    },
    [gradient, commit]
  );

  const posFromClientX = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return clampPos(((clientX - rect.left) / rect.width) * 100);
  }, []);

  const handleThumbMouseDown = useCallback(
    (index: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setSelected(index);
      let latest = gradient;
      const move = (ev: MouseEvent) => {
        const position = posFromClientX(ev.clientX);
        latest = {
          ...latest,
          stops: latest.stops.map((s, i) => (i === index ? { ...s, position } : s)),
        };
        commit(latest);
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [gradient, commit, posFromClientX]
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== trackRef.current) return; // ignore clicks on thumbs
      addStopAt(posFromClientX(e.clientX));
    },
    [addStopAt, posFromClientX]
  );

  const setType = useCallback(
    (type: Gradient["type"]) => {
      if (type === gradient.type) return;
      commit({ ...gradient, type });
    },
    [gradient, commit]
  );

  return (
    <div className="pd-gradient">
      {/* Type toggle */}
      <div className="pd-gradient__types">
        <button
          type="button"
          className={`pd-gradient__type-btn${gradient.type === "linear" ? " pd-gradient__type-btn--active" : ""}`}
          onClick={() => setType("linear")}
        >
          Linear
        </button>
        <button
          type="button"
          className={`pd-gradient__type-btn${gradient.type === "radial" ? " pd-gradient__type-btn--active" : ""}`}
          onClick={() => setType("radial")}
        >
          Radial
        </button>
      </div>

      {/* Stop track */}
      <div
        ref={trackRef}
        className="pd-gradient__track"
        style={{ background: previewCss }}
        onMouseDown={handleTrackClick}
        title="Click to add a color stop"
      >
        {stops.map((s, i) => (
          <button
            key={i}
            type="button"
            className={`pd-gradient__thumb${i === selected ? " pd-gradient__thumb--active" : ""}`}
            style={{ left: `${s.position}%`, background: s.color }}
            onMouseDown={handleThumbMouseDown(i)}
            onClick={(e) => {
              e.stopPropagation();
              setSelected(i);
            }}
          />
        ))}
      </div>

      {/* Selected stop controls */}
      {selectedStop && (
        <div className="pd-gradient__stop-row">
          <ColorPicker
            value={selectedStop.color}
            onChange={(c) => setStop(selected, { color: c })}
            designTokens={designTokens}
            pageColors={pageColors}
          />
          <NumberInput
            value={Math.round(selectedStop.position)}
            onChange={(v) => setStop(selected, { position: clampPos(v) })}
            min={0}
            max={100}
            suffix="%"
            className="pd-gradient__pos-input"
          />
          <button
            type="button"
            className="pd-gradient__stop-btn"
            onClick={() => removeStop(selected)}
            disabled={stops.length <= 2}
            title={stops.length <= 2 ? "A gradient needs at least two stops" : "Remove stop"}
          >
            <DeleteIcon size={14} />
          </button>
        </div>
      )}

      {/* Angle (linear only) */}
      {gradient.type === "linear" && (
        <div className="pd-gradient__angle-row">
          <span className="pd-gradient__angle-label">Angle</span>
          <NumberInput
            value={Math.round(gradient.angle)}
            onChange={(v) => commit({ ...gradient, angle: ((v % 360) + 360) % 360 })}
            suffix="°"
            className="pd-gradient__angle-input"
          />
          <button
            type="button"
            className="pd-gradient__stop-btn"
            onClick={() => addStopAt(50)}
            title="Add color stop"
          >
            <PlusIcon size={12} />
          </button>
        </div>
      )}
      {gradient.type === "radial" && (
        <div className="pd-gradient__angle-row">
          <button
            type="button"
            className="pd-gradient__stop-btn pd-gradient__stop-btn--wide"
            onClick={() => addStopAt(50)}
            title="Add color stop"
          >
            <PlusIcon size={12} /> Add stop
          </button>
        </div>
      )}
    </div>
  );
};
