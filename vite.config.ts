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
//
// Build modes:
//   - default: HTML entries + service worker, ES module format
//   - "content-main" / "content-bridge": a single content script built as IIFE
//     so module-level declarations don't leak into the host page's global
//     scope (would cause "Identifier 'X' has already been declared" on
//     re-injection). Rollup requires one input per IIFE bundle, so each
//     content entry is its own pass.
// `npm run build` runs all passes sequentially.
const CONTENT_ENTRIES: Record<string, { name: string; input: string }> = {
  "content-main": {
    name: "content/main",
    input: "src/content/main.ts",
  },
  "content-bridge": {
    name: "content/main-world-bridge",
    input: "src/content/main-world-bridge.ts",
  },
};

export default defineConfig(({ mode }) => {
  const contentEntry = CONTENT_ENTRIES[mode ?? ""];

  if (contentEntry) {
    return {
      resolve: {
        alias: {
          "@shared": resolve(__dirname, "src/shared"),
        },
      },
      // No copyContentCss here — it's already copied by the default build pass.
      build: {
        outDir: "dist",
        // Don't wipe the default pass's output.
        emptyOutDir: false,
        modulePreload: false,
        rollupOptions: {
          input: resolve(__dirname, contentEntry.input),
          output: {
            format: "iife",
            // IIFE must be a single chunk per entry.
            inlineDynamicImports: true,
            entryFileNames: `${contentEntry.name}.js`,
            assetFileNames: "assets/[name]-[hash][extname]",
          },
        },
        target: "chrome120",
        minify: false,
        sourcemap: true,
      },
      // publicDir already copied by the default pass.
      publicDir: false,
      base: "",
    };
  }

  return {
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
          "design-system": resolve(__dirname, "design-system.html"),
          "background/service-worker": resolve(
            __dirname,
            "src/background/service-worker.ts"
          ),
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === "background/service-worker") {
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
  };
});
