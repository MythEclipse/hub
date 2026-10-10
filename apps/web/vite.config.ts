import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_PORT = process.env.API_PORT ?? "4003";

export default defineConfig({
  plugins: [
    // ORDER MATTERS: tanstackRouter must come before react() so the generated
    // route tree is in place before the React plugin transforms modules.
    tanstackRouter({
      target: "react",
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      // Dev only: Vite serves the SPA and proxies RPC to the Hono process, so
      // the browser stays same-origin and no CORS config is needed.
      "/rpc": {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    // Production ships this bundle to the public internet, and .map files embed
    // the original TypeScript in sourcesContent (~2.7 MB of maps vs ~540 KB of
    // JS). The previous next.config.ts never set productionBrowserSourceMaps,
    // so this would be a regression.
    sourcemap: false,
    rollupOptions: {
      output: {
        // Vite 8 uses rolldown, which requires manualChunks to be a function
        // (the object form from rollup is rejected).
        manualChunks(id: string) {
          if (
            id.includes("node_modules/motion") ||
            id.includes("node_modules/framer-motion")
          ) {
            return "motion";
          }
          if (id.includes("node_modules/@tanstack")) return "tanstack";
          return undefined;
        },
      },
    },
  },
});
