// SNW Map サービスワーカー（安全版）。
// 古いキャッシュを全削除し、以後はキャッシュせず常にネットワークから取得する。
// → デプロイ後の「古いJSを参照して真っ白」を根本回避（オフライン機能は無し）。
self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    // 画面遷移は常に最新を取得（取れなければブラウザ既定に委ねる）
    e.respondWith(fetch(req).catch(() => fetch("/index.html")));
  }
});
