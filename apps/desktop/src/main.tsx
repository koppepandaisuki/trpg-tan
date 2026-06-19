import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ReportButton } from "./ReportButton";
import { installDiag } from "./diag";
// Noto Sans JP(バンドル同梱。オフラインでも確実に効く)。
import "@fontsource/noto-sans-jp/400.css";
import "@fontsource/noto-sans-jp/500.css";
import "@fontsource/noto-sans-jp/700.css";
import "@fontsource/noto-sans-jp/900.css";
import "./styles.css";

// 描画前に console / 未捕捉エラーの取り込みを開始(net.* の計測ログも拾える)。
installDiag();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    <ReportButton />
  </React.StrictMode>,
);
