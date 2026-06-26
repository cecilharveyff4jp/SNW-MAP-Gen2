import { useCallback, useEffect, useState } from "react";
import MapCanvas from "./components/MapCanvas";
import ObjectEditor from "./components/ObjectEditor";
import { listObjects } from "./lib/api";
import type { MapObject } from "./lib/types";

// D1 が空のとき、閲覧モードで表示するデモ（座標モデル検証用の例）
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
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listObjects();
      setObjects(Array.isArray(data) ? data : []);
    } catch {
      setObjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isEmpty = objects.length === 0;
  // 閲覧モードかつ空ならデモを表示。編集モードでは実データ（空なら空）を表示。
  const mapObjects = isEmpty && !editMode ? DEMO_OBJECTS : objects;

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
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>SNW-MAP Gen2</h1>
          <p style={{ color: "#868e96", marginTop: 0 }}>
            同盟内マップ（正方形を45°回転 / X軸反転）
          </p>
        </div>
        <button
          onClick={() => setEditMode((v) => !v)}
          style={{
            padding: "8px 16px",
            border: "1px solid #ced4da",
            borderRadius: 6,
            background: editMode ? "#e7f5ff" : "#fff",
            cursor: "pointer",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {editMode ? "閲覧に戻る" : "編集モード"}
        </button>
      </div>

      {loading ? (
        <p>読み込み中…</p>
      ) : (
        <>
          {isEmpty && !editMode && (
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
              「編集モード」から登録できます。
            </p>
          )}
          <MapCanvas objects={mapObjects} />
          {editMode && <ObjectEditor objects={objects} onChanged={load} />}
        </>
      )}
    </main>
  );
}
