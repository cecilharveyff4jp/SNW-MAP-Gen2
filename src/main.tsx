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
  // 新しいSWが制御を取ったら一度だけ再読み込み（古いキャッシュ由来の真っ白を回避）
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => { reg.update().catch(() => {}); }).catch(() => { /* noop */ });
  });
}
