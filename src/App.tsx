import { useEffect, useState } from "react";

type Health = { ok: boolean; db: string; time: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json() as Promise<Health>)
      .then(setHealth)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", lineHeight: 1.6 }}>
      <h1>SNW-MAP Gen2</h1>
      <p>Cloudflare Pages + Functions + D1 構成の雛形です。</p>
      <h2>API 疎通チェック (/api/health)</h2>
      {error && <p style={{ color: "crimson" }}>エラー: {error}</p>}
      {!health && !error && <p>確認中…</p>}
      {health && (
        <pre style={{ background: "#f4f4f4", padding: "1rem", borderRadius: 8 }}>
          {JSON.stringify(health, null, 2)}
        </pre>
      )}
    </main>
  );
}
