import { useEffect, useState } from "react";
import MapCanvas from "./components/MapCanvas";
import type { MapObject } from "./lib/types";

// D1 が空のとき表示するデモ（座標モデル検証用の例）
const DEMO_OBJECTS: MapObject[] = [
  { type: "DEPOT", anchorX: 381, anchorY: 416, w: 2, h: 2, label: "デポ" },
  { type: "HQ", anchorX: 381, anchorY: 418, w: 3, h: 3, label: "本部" },
  { type: "CITY", anchorX: 380, anchorY: 420, w: 1, h: 1, label: "都市A" },
  { type: "BEAR_TRAP", anchorX: 384, anchorY: 418, w: 3, h: 3, label: "熊罠" },
  { type: "LAKE", anchorX: 378, anchorY: 416, w: 2, h: 2, label: "湖" },
  { type: "FLAG", anchorX: 383, anchorY: 421, w: 1, h: 1, label: "旗" },
];

export default function App() {
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/objects");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as MapObject[];
        if (!active) return;
        if (Array.isArray(data) && data.length > 0) {
          setObjects(data);
          setIsDemo(false);
        } else {
          setObjects(DEMO_OBJECTS);
          setIsDemo(true);
        }
      } catch {
        if (!active) return;
        setObjects(DEMO_OBJECTS);
        setIsDemo(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "1.5rem",
        maxWidth: 900,
        margin: "0 auto",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ marginBottom: 4 }}>SNW-MAP Gen2</h1>
      <p style={{ color: "#868e96", marginTop: 0 }}>
        同盟内マップ（正方形を45°回転 / X軸反転）
      </p>

      {loading ? (
        <p>読み込み中…</p>
      ) : (
        <>
          {isDemo && (
            <p
              style={{
                background: "#fff3bf",
                border: "1px solid #ffe066",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 13,
              }}
            >
              D1 にデータが無いため、デモオブジェクトを表示しています。
            </p>
          )}
          <MapCanvas objects={objects} />
        </>
      )}
    </main>
  );
}
