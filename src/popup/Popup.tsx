import type { Message } from "../shared/messages";

export function Popup() {
  const handleActivate = () => {
    chrome.runtime.sendMessage({
      type: "OPEN_SIDE_PANEL",
    } satisfies Message);
    // Close popup after activating
    window.close();
  };

  return (
    <div className="pd-popup">
      <div className="pd-popup__header">
        <span className="pd-popup__icon">◆</span>
        <span className="pd-popup__title">Page Designer</span>
      </div>
      <button className="pd-popup__btn" onClick={handleActivate}>
        Open Designer Panel
      </button>
      <p className="pd-popup__hint">
        Click to open the side panel and start editing
      </p>
    </div>
  );
}
