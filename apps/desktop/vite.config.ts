import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri は固定ポートの dev サーバーを期待する。src-tauri 配下は監視対象外に。
// @trpg/core はワークスペースの TS ソースを直接読むため最適化対象から除外。
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // ルート(Web)の postcss/tailwind 設定を継承しないよう、空の postcss を明示。
  // デスクトップは素の CSS で完結させる。
  css: {
    postcss: { plugins: [] },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  optimizeDeps: {
    exclude: ["@trpg/core"],
  },
});
