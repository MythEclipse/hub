import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  // Output is dist/main.js, NOT main.mjs: apps/api/package.json sets
  // "type": "module", so tsup emits ESM with a .js extension. The systemd unit
  // (deploy/hub.service) and the `start` script must both say main.js.
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Internal .ts imports are bundled; bare package imports stay external so
  // node resolves them from node_modules at runtime.
  skipNodeModulesBundle: true,
});
