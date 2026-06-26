import { useCallback, useEffect, useState } from "react";
import MapCanvas from "./components/MapCanvas";
import ObjectEditor from "./components/ObjectEditor";
import AccountPanel from "./components/AccountPanel";
import UserAdmin from "./components/UserAdmin";
import { getMe, listObjects, type Me } from "./lib/api";
import type { MapObject } from "./lib/types";

const DEMO_OBJECTS: MapObject[] = [
  { type: "DEPOT", anchorX: 381, anchorY: 416, w: 2, h: 2, label: "デポ" },
  { type: "HQ", anchorX: 381, anchorY: 418, w: 3, h: 3, label: "本部" },
  { type: "CITY", anchorX: 380, anchorY: 420, w: 1, h: 1, label: "都市A" },
  { type: "BEAR_TRAP", anchorX: 384, anchorY: 418, w: 3, h: 3, label: "熊罠" },
  { type: "LAKE", anchorX: 378, anchorY: 416, w: 2, h: 2, label: "湖" },
  { type: "FLAG", anchorX: 383, anchorY: 421, w: 1, h: 1, label: "旗" },
];

export default function App() {
  const path = window.location.pathname;
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = useCallback(async () => {
    try {
      setMe(await getMe());
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const canEdit = !!me && (me.isOwner || me.status === "approved");

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
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>
            <a href="/" style={{ color: "inherit", textDecoration: "none" }}>
              SNW-MAP Gen2
            </a>
          </h1>
          <p style={{ color: "#868e96", marginTop: 0 }}>
            同盟内マップ（正方形を45°回転 / X軸反転）
          </p>
        </div>
        <nav style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "center" }}>
          <a href="/account">編集申請</a>
          {me?.isOwner && <a href="/admin">ユーザー管理</a>}
          {me?.email ? (
            <>
              <span style={{ color: "#868e96" }}>{me.email}</span>
              <a href="/api/auth/logout">ログアウト</a>
            </>
          ) : (
            <a href="/api/auth/login">ログイン</a>
          )}
        </nav>
      </div>

      {path === "/account" ? (
        <AccountPanel me={me} onReload={loadMe} />
      ) : path === "/admin" ? (
        <UserAdmin me={me} />
      ) : (
        <MapView canEdit={canEdit} />
      )}
    </main>
  );
}

function MapView({ canEdit }: { canEdit: boolean }) {
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
  const mapObjects = isEmpty && !editMode ? DEMO_OBJECTS : objects;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        {canEdit ? (
          <button
            onClick={() => setEditMode((v) => !v)}
            style={{
              padding: "8px 16px",
              border: "1px solid #ced4da",
              borderRadius: 6,
              background: editMode ? "#e7f5ff" : "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {editMode ? "閲覧に戻る" : "編集モード"}
          </button>
        ) : (
          <a
            href="/account"
            style={{
              padding: "8px 16px",
              border: "1px solid #ced4da",
              borderRadius: 6,
              background: "#fff",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              color: "#1c7ed6",
            }}
          >
            編集を申請する
          </a>
        )}
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
            </p>
          )}
          <MapCanvas objects={mapObjects} />
          {editMode && canEdit && <ObjectEditor objects={objects} onChanged={load} />}
        </>
      )}
    </>
  );
}
