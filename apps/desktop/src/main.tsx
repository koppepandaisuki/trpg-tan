import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { DetachedWidget } from "./DetachedWidget";
import "./styles.css";

// ?widget=<id> 付きで開かれた窓は、その 1 ウィジェットだけを描画する
// 「切り離しウィンドウ」(別モニターへ持ち出せる)。それ以外は通常のアプリ。
const widgetId = new URLSearchParams(window.location.search).get("widget");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {widgetId ? <DetachedWidget widgetId={widgetId} /> : <App />}
  </React.StrictMode>,
);
