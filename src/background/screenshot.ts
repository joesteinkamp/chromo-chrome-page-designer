/**
 * Screenshot capture — uses chrome.tabs.captureVisibleTab for pixel-perfect
 * viewport screenshots without CSP issues.
 */

/** Capture the visible viewport as a data URL (PNG by default; JPEG for
 *  captures that get stored, where size matters more than losslessness) */
export async function captureScreenshot(format: "png" | "jpeg" = "png"): Promise<string> {
  // Get the current window to capture
  const window = await chrome.windows.getCurrent();
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      window.id!,
      format === "jpeg" ? { format: "jpeg", quality: 85 } : { format: "png" },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (dataUrl) {
          resolve(dataUrl);
        } else {
          reject(new Error("Failed to capture screenshot"));
        }
      }
    );
  });
}
