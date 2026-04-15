/**
 * Chromo Design SVG Icon System
 *
 * All icons use a 16x16 viewBox, currentColor, and 1.5px stroke weight.
 * Usage: <ChevronDown size={14} className="my-class" />
 */

interface IconProps {
  size?: number;
  className?: string;
}

const defaults = { size: 16, className: "" };

/* ── Navigation / Chevrons ── */

export function ChevronDown({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRight({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Directional Arrows ── */

export function ArrowRight({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M3 8h10m-4-4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowDown({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M8 3v10m-4-4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowLeft({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M13 8H3m4-4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowUp({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M8 13V3m-4 4l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowVertical({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M8 2v12m-3-3l3 3 3-3m-6-6l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowHorizontal({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M2 8h12m-3-3l3 3-3 3M5 5L2 8l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Actions ── */

export function PlusIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function UndoIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M4 6l-2-2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 4h8a4 4 0 010 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function RedoIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M12 6l2-2-2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 4H6a4 4 0 000 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DeleteIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1m1.5 0l-.5 8a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 014 12.5L3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── UI Elements ── */

export function GearIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`pd-icon ${className}`}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function EyeIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function EyeOffIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M2 2l12 12M6.5 6.5a2 2 0 002.8 2.8M1.5 8s2-3.5 5-4.3m3.5.3c2 1 3.5 4 3.5 4s-2.5 4.5-6.5 4.5c-1 0-1.9-.2-2.7-.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EyedropperIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M13.5 2.5a2 2 0 00-2.8 0L9 4.2 6.5 6.5l-3 3-.5 3.5 3.5-.5 3-3L12 7l1.8-1.7a2 2 0 000-2.8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 4.2l2.8 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LinkIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M6.5 9.5a3 3 0 004.2.3l2-2a3 3 0 00-4.2-4.3l-1.1 1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 6.5a3 3 0 00-4.2-.3l-2 2a3 3 0 004.2 4.3l1.1-1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UnlinkIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M7 4l1-1a3 3 0 014.2 4.2l-1 1M9 12l-1 1a3 3 0 01-4.2-4.2l1-1M3 3l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Change Type Icons ── */

export function PaletteIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M8 1.5a6.5 6.5 0 00-1 12.9c.8.1 1.5-.5 1.5-1.3V12a1.5 1.5 0 011.5-1.5h1.1a1.5 1.5 0 001.4-2A6.5 6.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5.5" cy="6" r="1" fill="currentColor" />
      <circle cx="8" cy="4.5" r="1" fill="currentColor" />
      <circle cx="10.5" cy="6" r="1" fill="currentColor" />
    </svg>
  );
}

export function TextIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M3 3h10M8 3v10M5.5 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CommentIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M2.5 4a1.5 1.5 0 011.5-1.5h8A1.5 1.5 0 0113.5 4v5A1.5 1.5 0 0112 10.5H7l-3 3v-3h0A1.5 1.5 0 012.5 9V4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MoveIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M8 2v12M2 8h12m-9-3L2 8l3 3m6-6l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ResizeIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M10 2h4v4M6 14H2v-4M14 2L9 7M2 14l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ImageIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1" />
      <path d="M2 11l3-3 2 2 3-3 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HideIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return <EyeOffIcon size={size} className={className} />;
}

export function WrapIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1" />
    </svg>
  );
}

export function DuplicateIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function LayersIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M8 1.5L14 4.5L8 7.5L2 4.5L8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M2 8L8 11L14 8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M2 11.5L8 14.5L14 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ── Brand / Misc ── */

export function DiamondIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <path d="M8 1.5l6.5 6.5L8 14.5 1.5 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function DiamondFilledIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={`pd-icon ${className}`}>
      <path d="M8 1.5l6.5 6.5L8 14.5 1.5 8z" fill="currentColor" />
    </svg>
  );
}

export function SearchIcon({ size = defaults.size, className = defaults.className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pd-icon ${className}`}>
      <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
