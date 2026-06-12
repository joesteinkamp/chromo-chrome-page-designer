import { useState, useEffect, useCallback } from "react";
import type { Message } from "../../shared/messages";
import type { PageToken } from "../../shared/types";
import "./tokens.css";

/**
 * Page-wide design token editor. Lists CSS custom properties declared on
 * :root and lets the designer redefine them — one edit restyles everything
 * consuming the token, and exports as "change the token definition".
 */
export function TokensTab() {
  const [tokens, setTokens] = useState<PageToken[] | null>(null);
  const [filter, setFilter] = useState("");

  const loadTokens = useCallback(() => {
    chrome.runtime.sendMessage(
      { type: "GET_PAGE_TOKENS" } satisfies Message,
      (resp: any) => {
        void chrome.runtime.lastError;
        if (resp?.type === "PAGE_TOKENS_RESPONSE") {
          setTokens(resp.tokens);
        } else {
          setTokens([]);
        }
      }
    );
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const applyToken = useCallback((name: string, value: string) => {
    chrome.runtime.sendMessage({
      type: "APPLY_TOKEN",
      name,
      value,
    } satisfies Message);
    setTokens((prev) =>
      prev?.map((t) => (t.name === name ? { ...t, value } : t)) ?? prev
    );
  }, []);

  if (tokens === null) {
    return <div className="pd-tokens__empty">Loading design tokens…</div>;
  }

  if (tokens.length === 0) {
    return (
      <div className="pd-tokens__empty">
        No design tokens found on this page.
        <br />
        Tokens are CSS variables defined on <code>:root</code>.
        <button className="pd-tokens__refresh" onClick={loadTokens} type="button">
          Refresh
        </button>
      </div>
    );
  }

  const visible = filter
    ? tokens.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()))
    : tokens;

  return (
    <div className="pd-tokens">
      <div className="pd-tokens__toolbar">
        <input
          className="pd-tokens__filter"
          type="text"
          placeholder={`Filter ${tokens.length} tokens…`}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className="pd-tokens__refresh" onClick={loadTokens} type="button" title="Re-read tokens from the page">
          ↻
        </button>
      </div>
      <div className="pd-tokens__list">
        {visible.map((token) => (
          <TokenRow key={token.name} token={token} onApply={applyToken} />
        ))}
      </div>
    </div>
  );
}

interface TokenRowProps {
  token: PageToken;
  onApply: (name: string, value: string) => void;
}

function TokenRow({ token, onApply }: TokenRowProps) {
  const [local, setLocal] = useState(token.value);
  useEffect(() => {
    setLocal(token.value);
  }, [token.value]);

  const commit = () => {
    const trimmed = local.trim();
    if (trimmed && trimmed !== token.value) {
      onApply(token.name, trimmed);
    }
  };

  const hexValue = token.isColor ? toHexColor(token.value) : null;

  return (
    <div className="pd-tokens__row">
      {token.isColor && (
        hexValue ? (
          <input
            type="color"
            className="pd-tokens__swatch-input"
            value={hexValue}
            onChange={(e) => {
              setLocal(e.target.value);
              onApply(token.name, e.target.value);
            }}
            title={token.value}
          />
        ) : (
          <span
            className="pd-tokens__swatch"
            style={{ background: token.value }}
            title={token.value}
          />
        )
      )}
      <span className="pd-tokens__name" title={token.name}>
        {token.name}
      </span>
      <input
        type="text"
        className="pd-tokens__value"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

/** Convert a color value to #rrggbb for the native color input, or null */
function toHexColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  const m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const toHex = (n: string) => parseInt(n, 10).toString(16).padStart(2, "0");
    return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
  }
  return null;
}
