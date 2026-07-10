import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { PlayWidget } from "./PlayWidget";
import { ReportButton } from "./ReportButton";
import { installDiag } from "./diag";
import { checkForUpdatesOnLaunch } from "./updater";
// Noto Sans JP(バンドル同梱。オフラインでも確実に効く)。
import "@fontsource/noto-sans-jp/400.css";
import "@fontsource/noto-sans-jp/500.css";
import "@fontsource/noto-sans-jp/700.css";
import "@fontsource/noto-sans-jp/900.css";
import "./styles.css";

// 描画前に console / 未捕捉エラーの取り込みを開始(net.* の計測ログも拾える)。
installDiag();

// ?widget=chat 等で開かれたウィンドウは、PLAY サイドバーの切り離しビューとして
// 動く(メイン卓と play-bus で同期)。通常起動はフルアプリ。
const widgetId = new URLSearchParams(window.location.search).get("widget");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {widgetId ? (
      <PlayWidget widgetId={widgetId} />
    ) : (
      <>
        <App />
        <ReportButton />
      </>
    )}
  </React.StrictMode>,
);

// インストール版(本番ビルド)でのみ、起動時に自動更新をチェックする。
// dev(vite)・ブラウザ/PWA では走らせない(updater は Tauri 専用)。
// 切り離しウィンドウでは走らせない(メインが担当)。
if (
  import.meta.env.PROD &&
  !widgetId &&
  "__TAURI_INTERNALS__" in window
) {
  void checkForUpdatesOnLaunch();
}
