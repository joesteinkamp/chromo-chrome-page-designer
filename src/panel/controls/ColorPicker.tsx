import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import "./controls.css";

// ── Color conversion utilities ──

interface HSLA {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
  a: number; // 0-1
}

interface RGBA {
  r: number; // 0-255
  g: number;
  b: number;
  a: number; // 0-1
}

function rgbaToHsla(rgba: RGBA): HSLA {
  const r = rgba.r / 255;
  const g = rgba.g / 255;
  const b = rgba.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
    a: rgba.a,
  };
}

function hslaToRgba(hsla: HSLA): RGBA {
  const h = hsla.h / 360;
  const s = hsla.s / 100;
  const l = hsla.l / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a: hsla.a,
  };
}

function rgbaToHex(rgba: RGBA): string {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  const hex = `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`;
  if (rgba.a < 1) {
    return hex + toHex(Math.round(rgba.a * 255));
  }
  return hex;
}

function hexToRgba(hex: string): RGBA {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length === 4)
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.substring(6, 8), 16) / 255 : 1;
  return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b, a };
}

function parseCSSColor(color: string): RGBA {
  const trimmed = color.trim().toLowerCase();

  // Hex
  if (trimmed.startsWith("#")) {
    return hexToRgba(trimmed);
  }

  // rgba(r, g, b, a) or rgb(r, g, b)
  const rgbMatch = trimmed.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  // hsla(h, s%, l%, a) or hsl(h, s%, l%)
  const hslMatch = trimmed.match(
    /hsla?\(\s*(\d+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (hslMatch) {
    return hslaToRgba({
      h: parseInt(hslMatch[1]),
      s: parseFloat(hslMatch[2]),
      l: parseFloat(hslMatch[3]),
      a: hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1,
    });
  }

  return { r: 0, g: 0, b: 0, a: 1 };
}

function hslaToCSS(hsla: HSLA): string {
  const rgba = hslaToRgba(hsla);
  return rgbaToHex(rgba);
}

// ── Component ──

interface ColorPickerProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  className?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  label,
  className,
}) => {
  const rgba = useMemo(() => parseCSSColor(value), [value]);
  const hsla = useMemo(() => rgbaToHsla(rgba), [rgba]);

  const [isOpen, setIsOpen] = useState(false);
  // Track hue independently to avoid hue jumping when s=0 or l=0/100
  const [internalHue, setInternalHue] = useState(hsla.h);
  const [hexInput, setHexInput] = useState(rgbaToHex(rgba));
  const popoverRef = useRef<HTMLDivElement>(null);
  const satAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(rgbaToHex(rgba));
  }, [rgba]);

  // Sync hue only when the actual color changes externally and is chromatic
  useEffect(() => {
    if (hsla.s > 0 && hsla.l > 0 && hsla.l < 100) {
      setInternalHue(hsla.h);
    }
  }, [hsla.h, hsla.s, hsla.l]);

  // Close popover on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Convert SV (saturation-value from HSV) to HSL for output
  // The sat area works in HSV space: x = saturation(0-1), y = value(1-0)
  const svToHsl = useCallback(
    (svS: number, svV: number): HSLA => {
      // HSV to HSL
      const l = svV * (1 - svS / 2);
      const s =
        l === 0 || l === 1 ? 0 : (svV - l) / Math.min(l, 1 - l);
      return {
        h: internalHue,
        s: Math.round(s * 100),
        l: Math.round(l * 100),
        a: hsla.a,
      };
    },
    [internalHue, hsla.a]
  );

  // HSL to HSV for positioning the cursor
  const hslToSv = useCallback((): { svS: number; svV: number } => {
    const s = hsla.s / 100;
    const l = hsla.l / 100;
    const v = l + s * Math.min(l, 1 - l);
    const svS = v === 0 ? 0 : 2 * (1 - l / v);
    return { svS, svV: v };
  }, [hsla.s, hsla.l]);

  const emitColor = useCallback(
    (newHsla: HSLA) => {
      onChange(hslaToCSS(newHsla));
    },
    [onChange]
  );

  const handleSatAreaInteraction = useCallback(
    (clientX: number, clientY: number) => {
      if (!satAreaRef.current) return;
      const rect = satAreaRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      // x = saturation (HSV), y = 1 - value (HSV)
      const newHsla = svToHsl(x, 1 - y);
      emitColor(newHsla);
    },
    [svToHsl, emitColor]
  );

  const handleSatMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleSatAreaInteraction(e.clientX, e.clientY);
      const handleMove = (ev: MouseEvent) =>
        handleSatAreaInteraction(ev.clientX, ev.clientY);
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [handleSatAreaInteraction]
  );

  const handleHueInteraction = useCallback(
    (clientX: number, trackEl: HTMLDivElement) => {
      const rect = trackEl.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newHue = Math.round(x * 360);
      setInternalHue(newHue);
      emitColor({ ...hsla, h: newHue });
    },
    [hsla, emitColor]
  );

  const handleHueMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const track = e.currentTarget;
      handleHueInteraction(e.clientX, track);
      const handleMove = (ev: MouseEvent) =>
        handleHueInteraction(ev.clientX, track);
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [handleHueInteraction]
  );

  const handleAlphaInteraction = useCallback(
    (clientX: number, trackEl: HTMLDivElement) => {
      const rect = trackEl.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      emitColor({ ...hsla, a: Math.round(x * 100) / 100 });
    },
    [hsla, emitColor]
  );

  const handleAlphaMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const track = e.currentTarget;
      handleAlphaInteraction(e.clientX, track);
      const handleMove = (ev: MouseEvent) =>
        handleAlphaInteraction(ev.clientX, track);
      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [handleAlphaInteraction]
  );

  const handleHexInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setHexInput(e.target.value);
    },
    []
  );

  const handleHexInputBlur = useCallback(() => {
    let hex = hexInput.trim();
    if (!hex.startsWith("#")) hex = "#" + hex;
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) {
      onChange(hex);
    } else {
      setHexInput(rgbaToHex(rgba));
    }
  }, [hexInput, onChange, rgba]);

  const handleHexInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
    },
    []
  );

  const { svS, svV } = hslToSv();
  const cursorLeft = `${svS * 100}%`;
  const cursorTop = `${(1 - svV) * 100}%`;
  const huePercent = (internalHue / 360) * 100;
  const alphaPercent = hsla.a * 100;
  const solidColor = hslaToCSS({ ...hsla, a: 1 });

  return (
    <div
      className={`pd-color-picker ${className || ""}`}
      ref={popoverRef}
    >
      {label && <label className="pd-color-picker__label">{label}</label>}
      <button
        className="pd-color-picker__swatch"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <div className="pd-color-picker__swatch-checkers" />
        <div
          className="pd-color-picker__swatch-color"
          style={{ background: value }}
        />
      </button>
      <input
        className="pd-color-picker__hex-input"
        type="text"
        value={hexInput}
        onChange={handleHexInputChange}
        onBlur={handleHexInputBlur}
        onKeyDown={handleHexInputKeyDown}
      />

      {isOpen && (
        <div className="pd-color-picker__popover">
          {/* Saturation / Value area */}
          <div
            ref={satAreaRef}
            className="pd-color-picker__sat-area"
            style={{ background: `hsl(${internalHue}, 100%, 50%)` }}
            onMouseDown={handleSatMouseDown}
          >
            <div className="pd-color-picker__sat-white" />
            <div className="pd-color-picker__sat-black" />
            <div
              className="pd-color-picker__sat-cursor"
              style={{ left: cursorLeft, top: cursorTop }}
            />
          </div>

          {/* Hue slider */}
          <div
            className="pd-color-picker__slider-track pd-color-picker__slider-track--hue"
            onMouseDown={handleHueMouseDown}
          >
            <div
              className="pd-color-picker__slider-thumb"
              style={{ left: `${huePercent}%` }}
            />
          </div>

          {/* Alpha slider */}
          <div
            className="pd-color-picker__slider-track pd-color-picker__slider-track--alpha"
            onMouseDown={handleAlphaMouseDown}
          >
            <div
              className="pd-color-picker__alpha-gradient"
              style={{
                background: `linear-gradient(to right, transparent, ${solidColor})`,
              }}
            />
            <div
              className="pd-color-picker__slider-thumb"
              style={{ left: `${alphaPercent}%` }}
            />
          </div>

          {/* Hex input in popover */}
          <div className="pd-color-picker__popover-hex">
            <span className="pd-color-picker__popover-hex-label">HEX</span>
            <input
              className="pd-color-picker__popover-hex-input"
              type="text"
              value={hexInput}
              onChange={handleHexInputChange}
              onBlur={handleHexInputBlur}
              onKeyDown={handleHexInputKeyDown}
            />
          </div>
        </div>
      )}
    </div>
  );
};
