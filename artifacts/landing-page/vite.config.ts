import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

/**
 * Prevents HTTP 206 Partial Content responses.
 *
 * Some reverse proxies (including Replit's) forward Range / If-Range headers
 * from the client to the upstream app. Vite's static file server honours those
 * headers and responds with 206, which confuses crawlers (Meta, Google, etc.)
 * that expect the full HTML document in a single 200 response.
 *
 * This plugin:
 *  1. Strips Range / If-Range from every incoming request before Vite sees them.
 *  2. Intercepts outgoing responses to remove Accept-Ranges and downgrade any
 *     accidental 206 status to 200 for HTML documents.
 */
function noRangeRequests(): Plugin {
  function applyMiddleware(server: import("vite").PreviewServerForHook | import("vite").ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      // Strip range headers so Vite never generates a 206
      delete req.headers["range"];
      delete req.headers["if-range"];

      // Intercept writeHead to patch status + headers before they are sent
      const origWriteHead = res.writeHead.bind(res) as typeof res.writeHead;
      res.writeHead = function patchedWriteHead(statusCode: number, ...rest: unknown[]) {
        // Downgrade 206 → 200 for HTML responses
        const ct = res.getHeader("content-type");
        const isHtml = typeof ct === "string" && ct.includes("text/html");
        const effectiveStatus = statusCode === 206 && isHtml ? 200 : statusCode;

        // Remove Accept-Ranges so clients know partial content is not supported
        res.removeHeader("Accept-Ranges");

        return (origWriteHead as (...a: unknown[]) => unknown)(effectiveStatus, ...rest) as ReturnType<typeof res.writeHead>;
      };

      next();
    });
  }

  return {
    name: "no-range-requests",
    configureServer: applyMiddleware,
    configurePreviewServer: applyMiddleware,
  };
}

// During `vite build` (production static build), PORT is unused — vite never
// starts a server. We fall back to a harmless default so the build succeeds
// even when the deployment runner doesn't inject PORT/BASE_PATH.
const rawPort = process.env.PORT ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// BASE_PATH defaults to "/" for standard deployments where the app is
// served from the root. Can be overridden via the env var for sub-path setups.
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    noRangeRequests(),
    react(),
    tailwindcss(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          runtimeErrorOverlay(),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    target: "es2020",
    minify: "esbuild",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          motion: ["framer-motion"],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
