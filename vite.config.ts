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
  plugins: [copyContentCss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, "panel.html"),
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
        "content/main": resolve(__dirname, "src/content/main.ts"),
        "background/service-worker": resolve(
          __dirname,
          "src/background/service-worker.ts"
        ),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (
            chunkInfo.name === "content/main" ||
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
