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
  // controllerchange での自動リロードは行わない。
  // iOSで埋め込み再生中に勝手にリフレッシュ（曲が閉じる）する不具合の防止・切り分けのため、
  // アプリ側からの window.location.reload() を全廃した。SWのfetchはネットワーク優先なので更新は自然な再訪で反映される。
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => { reg.update().catch(() => {}); }).catch(() => { /* noop */ });
  });
}
