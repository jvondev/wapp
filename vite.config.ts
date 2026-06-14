import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

const host = process.env.TAURI_DEV_HOST;
const isDev = !!host;

export default defineConfig(async () => ({
  plugins: [solid()],
  clearScreen: false,
  root: "ui",
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: isDev ? "esnext" : "chrome105",
    minify: !isDev,
    sourcemap: isDev,
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/core/**"] },
  },
}));
