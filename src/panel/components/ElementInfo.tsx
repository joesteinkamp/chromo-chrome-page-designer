import type { ElementData } from "../../shared/types";

interface Props {
  data: ElementData;
}

export function ElementInfo({ data }: Props) {
  const dimensions = `${Math.round(data.rect.width)} × ${Math.round(data.rect.height)}`;

  return (
    <div className="pd-element-info">
      <div className="pd-element-info__header">
        <span className="pd-element-info__tag">{data.tag}</span>
        {data.id && <span className="pd-element-info__id">#{data.id}</span>}
        <span className="pd-element-info__dims">{dimensions}</span>
      </div>

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

      <div className="pd-element-info__breadcrumb">{data.breadcrumb}</div>

      <div className="pd-element-info__badges">
        {data.isFlex && <span className="pd-element-info__badge pd-element-info__badge--flex">Auto layout</span>}
        {data.isGrid && <span className="pd-element-info__badge pd-element-info__badge--grid">Grid</span>}
        {data.isImage && <span className="pd-element-info__badge pd-element-info__badge--img">Image</span>}
        {data.hasTextContent && <span className="pd-element-info__badge pd-element-info__badge--text">Text</span>}
      </div>
    </div>
  );
}
