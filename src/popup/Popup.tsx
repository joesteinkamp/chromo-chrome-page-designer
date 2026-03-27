import type { Message } from "../shared/messages";

export function Popup() {
  const handleActivate = () => {
    chrome.runtime.sendMessage({
      type: "OPEN_SIDE_PANEL",
    } satisfies Message);
    window.close();
  };

  return (
    <div className="pd-popup">
      <div className="pd-popup__header">
        <span className="pd-popup__icon">◆</span>
        <span className="pd-popup__title">Chromo Design</span>
      </div>
      <p className="pd-popup__desc">
        Visually edit any webpage with a Figma-like interface. Changes are
        reversible and can be exported for developer handoff.
      </p>
      <button className="pd-popup__btn" onClick={handleActivate}>
        Open Designer Panel
      </button>
      <div className="pd-popup__features">
        <div className="pd-popup__feature">
          <span className="pd-popup__feature-icon">+</span>
          Click elements to select and edit styles
        </div>
        <div className="pd-popup__feature">
          <span className="pd-popup__feature-icon">+</span>
          Double-click to edit text inline
        </div>
        <div className="pd-popup__feature">
          <span className="pd-popup__feature-icon">+</span>
          Drag handles to resize, drag to reorder
        </div>
        <div className="pd-popup__feature">
          <span className="pd-popup__feature-icon">+</span>
          Export changes as JSON for developers
        </div>
      </div>
    </div>
  );
}
