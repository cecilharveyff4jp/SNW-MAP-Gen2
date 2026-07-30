import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DialogProvider } from "./components/Dialog";
import { loadSavedTheme } from "./lib/theme";

loadSavedTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </StrictMode>
);

// PWA: サービスワーカー登録（ホーム画面に追加）
if ("serviceWorker" in navigator) {
  // 初回オープンはページが未制御で読み込まれ、SWのclaimでcontrollerchangeが発火する。
  // それでリロードすると毎回の初回オープンで勝手にリフレッシュ（開いていた埋め込み等が閉じる）ので、
  // 「読み込み時点で既にSW制御下＝本当のSW更新」の時だけ一度だけリロードする（古いキャッシュ由来の真っ白回避）。
  let refreshing = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => { reg.update().catch(() => {}); }).catch(() => { /* noop */ });
  });
}
