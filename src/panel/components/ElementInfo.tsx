import React, { useCallback } from "react";
import type { ElementData } from "../../shared/types";
import type { Message } from "../../shared/messages";

interface Props {
  data: ElementData;
  multiEdit: boolean;
  onToggleMultiEdit: () => void;
  multiSelectCount?: number;
}

export function ElementInfo({ data, multiEdit, onToggleMultiEdit, multiSelectCount }: Props) {
  const dimensions = `${Math.round(data.rect.width)} × ${Math.round(data.rect.height)}`;
  const hasMatches = data.matchCount > 0;

  const handleWrap = useCallback(() => {
    chrome.runtime.sendMessage({ type: "WRAP_ELEMENT" } satisfies Message);
  }, []);

  const handleBreadcrumbClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      const selector = e.currentTarget.dataset.selector;
      if (selector) {
        chrome.runtime.sendMessage({
          type: "SELECT_ELEMENT",
          selector,
        } satisfies Message);
      }
    },
    []
  );

  // Parse breadcrumb into clickable segments
  const breadcrumbParts = data.breadcrumb.split(" > ");

  return (
    <div className="pd-element-info">
      <div className="pd-element-info__header">
        <span className="pd-element-info__tag">{data.tag}</span>
        {data.id && <span className="pd-element-info__id">#{data.id}</span>}
        <button
          className="pd-element-info__wrap-btn"
          onClick={handleWrap}
          title="Wrap in container (⌘G)"
          type="button"
        >
          Add container
        </button>
        <span className="pd-element-info__dims">{dimensions}</span>
      </div>

      {multiSelectCount ? (
        <div className="pd-element-info__multi-badge">
          {multiSelectCount} elements selected (Shift+Click to add)
        </div>
      ) : null}

      {data.classes.length > 0 && (
        <div className="pd-element-info__classes">
          {data.classes.slice(0, 4).map((cls) => (
            <span key={cls} className="pd-element-info__class">.{cls}</span>
          ))}
          {data.classes.length > 4 && (
            <span className="pd-element-info__more">+{data.classes.length - 4}</span>
          )}
        </div>
      )}

      <div className="pd-element-info__breadcrumb">
        {breadcrumbParts.map((part, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="pd-element-info__breadcrumb-sep"> &gt; </span>}
            <span
              className="pd-element-info__breadcrumb-part"
              data-selector={part}
              onClick={i < breadcrumbParts.length - 1 ? handleBreadcrumbClick : undefined}
              role={i < breadcrumbParts.length - 1 ? "button" : undefined}
              tabIndex={i < breadcrumbParts.length - 1 ? 0 : undefined}
              title={i < breadcrumbParts.length - 1 ? `Select ${part}` : undefined}
            >
              {part}
            </span>
          </React.Fragment>
        ))}
      </div>

      <div className="pd-element-info__badges">
        {data.isFlex && (
          <span className="pd-element-info__badge pd-element-info__badge--flex">
            Auto layout
          </span>
        )}
        {data.isGrid && (
          <span className="pd-element-info__badge pd-element-info__badge--grid">
            Grid
          </span>
        )}
        {data.isImage && (
          <span className="pd-element-info__badge pd-element-info__badge--img">
            Image
          </span>
        )}
        {data.hasTextContent && (
          <span className="pd-element-info__badge pd-element-info__badge--text">
            Text
          </span>
        )}
      </div>

      {data.componentInfo?.componentName && (
        <div className="pd-element-info__component">
          <span className="pd-element-info__component-badge">
            {data.componentInfo.framework === "react" ? "React" : data.componentInfo.framework === "vue" ? "Vue" : "Svelte"}
          </span>
          <span className="pd-element-info__component-name">
            {"<"}{data.componentInfo.componentName}{">"}
          </span>
          {data.componentInfo.sourceFile && (
            <span className="pd-element-info__component-source" title={data.componentInfo.sourceFile}>
              {data.componentInfo.sourceFile.replace(/^.*[/\\]/, "")}{data.componentInfo.sourceLine ? `:${data.componentInfo.sourceLine}` : ""}
            </span>
          )}
        </div>
      )}

      {hasMatches && (
        <button
          className={`pd-element-info__multi-btn ${multiEdit ? "pd-element-info__multi-btn--active" : ""}`}
          onClick={onToggleMultiEdit}
        >
          {multiEdit
            ? `Editing all ${data.matchCount + 1} instances`
            : `Edit all ${data.matchCount + 1} matching`}
        </button>
      )}
    </div>
  );
}
