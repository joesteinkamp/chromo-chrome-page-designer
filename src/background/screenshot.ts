/**
 * Screenshot capture — uses chrome.tabs.captureVisibleTab for pixel-perfect
 * viewport screenshots without CSP issues.
 */

/** Capture the visible viewport as a PNG data URL */
export async function captureScreenshot(): Promise<string> {
  // Get the current window to capture
  const window = await chrome.windows.getCurrent();
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      window.id!,
      { format: "png" },
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
