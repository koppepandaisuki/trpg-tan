import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri は固定ポートの dev サーバーを期待する。src-tauri 配下は監視対象外に。
// @trpg/core / @trpg/ui はワークスペースの TS ソースを直接読むため最適化対象から除外。
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // Tauri 2 の WebView は tauri://localhost/ から HTML を読む。base を
  // 既定の "/" にしておくと、絶対パス /assets/xxx.js が WebView の
  // 環境によっては解決できず、JS バンドルが読み込まれず React が
  // マウントしないままスプラッシュで止まる(v0.1.1 で発生)。
  // 相対パスにしておけば確実。
  base: "./",
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
    exclude: ["@trpg/core", "@trpg/ui"],
  },
  // @trpg/ui(ワークスペースの共有 UI)はリポジトリ直下の node_modules から react を
  // 解決しうる。アプリ側の react と別コピーになると hooks が壊れる
  // (Invalid hook call)ので、必ず 1 つに寄せる。
  resolve: {
    dedupe: ["react", "react-dom", "lucide-react"],
  },
});
