import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";
import { readFileSync, mkdirSync, writeFileSync } from "fs";

/** Copies content.css to dist/content/ since it's referenced by manifest.json */
function copyContentCss(): Plugin {
  return {
    name: "copy-content-css",
    closeBundle() {
      const css = readFileSync(
        resolve(__dirname, "src/content/content.css"),
        "utf-8"
      );
      mkdirSync(resolve(__dirname, "dist/content"), { recursive: true });
      writeFileSync(resolve(__dirname, "dist/content/content.css"), css);
    },
  };
}

/** Strip crossorigin attributes from HTML — they can break Chrome extension CSP */
function stripCrossorigin(): Plugin {
  return {
    name: "strip-crossorigin",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, "");
    },
  };
}

// Chrome extension multi-entry build.
// HTML entries (panel, popup, options) are at project root.
// Content script and service worker are JS-only entries.
// publicDir copies manifest.json and icons into dist/.
export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  plugins: [copyContentCss(), stripCrossorigin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Disable module preload — the polyfill can interfere with Chrome extensions
    modulePreload: false,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, "panel.html"),
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
        "content/main": resolve(__dirname, "src/content/main.ts"),
        "content/main-world-bridge": resolve(
          __dirname,
          "src/content/main-world-bridge.ts"
        ),
        "background/service-worker": resolve(
          __dirname,
          "src/background/service-worker.ts"
        ),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (
            chunkInfo.name === "content/main" ||
            chunkInfo.name === "content/main-world-bridge" ||
            chunkInfo.name === "background/service-worker"
          ) {
            return "[name].js";
          }
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
    target: "chrome120",
    minify: false,
    sourcemap: true,
  },
  publicDir: "public",
  base: "",
});
