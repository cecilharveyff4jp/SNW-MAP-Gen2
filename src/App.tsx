import { useCallback, useEffect, useState } from "react";
import MapCanvas from "./components/MapCanvas";
import ObjectEditPanel, { type PanelInitial } from "./components/ObjectEditPanel";
import AccountPanel from "./components/AccountPanel";
import UserAdmin from "./components/UserAdmin";
import Telop from "./components/Telop";
import { getMe, listObjects, type Me } from "./lib/api";
import { buildTickerText } from "./lib/birthday";
import { getDefaultSize } from "./lib/sizes";
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
  const loadMe = useCallback(async () => { try { setMe(await getMe()); } catch { setMe(null); } }, []);
  useEffect(() => { loadMe(); }, [loadMe]);
  const canEdit = !!me && (me.isOwner || me.status === "approved");
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "1.5rem", maxWidth: 900, margin: "0 auto", lineHeight: 1.6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ marginBottom: 4 }}><a href="/" style={{ color: "inherit", textDecoration: "none" }}>SNW-MAP Gen2</a></h1>
          <p style={{ color: "#868e96", marginTop: 0 }}>同盟内マップ（正方形を45°回転 / X軸反転）</p>
        </div>
        <nav style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "center" }}>
          <a href="/account">編集申請</a>
          {me?.isOwner && <a href="/admin">ユーザー管理</a>}
          {me?.email ? (<><span style={{ color: "#868e96" }}>{me.email}</span><a href="/api/auth/logout">ログアウト</a></>) : (<a href="/api/auth/login">ログイン</a>)}
        </nav>
      </div>
      {path === "/account" ? (<AccountPanel me={me} onReload={loadMe} />)
        : path === "/admin" ? (<UserAdmin me={me} />)
        : (<MapView canEdit={canEdit} />)}
    </main>
  );
}

function MapView({ canEdit }: { canEdit: boolean }) {
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PanelInitial | null>(null);
  const [showTelop, setShowTelop] = useState(() => { try { return localStorage.getItem("snw_show_telop") !== "false"; } catch { return true; } });
  const toggleTelop = () => setShowTelop((v) => { const nv = !v; try { localStorage.setItem("snw_show_telop", String(nv)); } catch { /* noop */ } return nv; });

  const load = useCallback(async () => {
    try { const data = await listObjects(); setObjects(Array.isArray(data) ? data : []); }
    catch { setObjects([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const selectObject = useCallback((id: number) => { setDraft(null); setSelectedId(id); }, []);
  const clickEmpty = useCallback((gx: number, gy: number) => { const d = getDefaultSize("CITY"); setSelectedId(null); setDraft({ type: "CITY", anchorX: gx, anchorY: gy, w: d.w, h: d.h }); }, []);
  const closePanel = useCallback(() => { setDraft(null); setSelectedId(null); }, []);
  const onChanged = useCallback(() => { load(); setDraft(null); setSelectedId(null); }, [load]);
  const startNew = () => { const d = getDefaultSize("CITY"); setSelectedId(null); setDraft({ type: "CITY", anchorX: 0, anchorY: 0, w: d.w, h: d.h }); };
  const toggleEdit = () => setEditMode((v) => { const nv = !v; if (!nv) { setSelectedId(null); setDraft(null); } return nv; });

  const isEmpty = objects.length === 0;
  const editable = editMode && canEdit;
  const mapObjects = isEmpty && !editMode ? DEMO_OBJECTS : objects;
  const tickerText = buildTickerText(mapObjects);
  const selectedObj = selectedId != null ? objects.find((o) => o.id === selectedId) : undefined;
  const panelInitial: PanelInitial | null = draft
    ? draft
    : selectedObj
    ? {
        id: selectedObj.id,
        type: selectedObj.type,
        anchorX: selectedObj.anchorX,
        anchorY: selectedObj.anchorY,
        w: selectedObj.w,
        h: selectedObj.h,
        label: selectedObj.label,
        memberName: selectedObj.memberName,
        gameId: selectedObj.gameId,
        fcLevel: selectedObj.fcLevel,
        note: selectedObj.note,
        birthday: selectedObj.birthday,
      }
    : null;
  const panelKey = draft ? "new-" + draft.anchorX + "," + draft.anchorY : selectedId != null ? "obj-" + selectedId : "none";

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button onClick={toggleTelop} style={{ padding: "6px 12px", border: "1px solid #ced4da", borderRadius: 6, background: showTelop ? "#fff3bf" : "#fff", cursor: "pointer", fontSize: 13 }}>テロップ {showTelop ? "ON" : "OFF"}</button>
        {canEdit ? (
          <button onClick={toggleEdit} style={{ padding: "8px 16px", border: "1px solid #ced4da", borderRadius: 6, background: editMode ? "#e7f5ff" : "#fff", cursor: "pointer", fontWeight: 600 }}>{editMode ? "閲覧に戻る" : "編集モード"}</button>
        ) : (
          <a href="/account" style={{ padding: "8px 16px", border: "1px solid #ced4da", borderRadius: 6, background: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none", color: "#1c7ed6" }}>編集を申請する</a>
        )}
      </div>
      {loading ? (<p>読み込み中…</p>) : (
        <>
          {isEmpty && !editMode && (<p style={{ background: "#fff3bf", border: "1px solid #ffe066", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>D1 にデータが無いため、デモオブジェクトを表示しています。</p>)}
          <Telop text={showTelop ? tickerText : ""} />
          <MapCanvas objects={mapObjects} selectedId={editable ? selectedId : null} editable={editable} onSelectObject={selectObject} onClickEmpty={clickEmpty} />
          {editable && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={startNew} style={{ padding: "8px 14px", border: "none", borderRadius: 6, background: "#2f9e44", color: "#fff", fontWeight: 600, cursor: "pointer" }}>＋ 新規オブジェクト</button>
                <span style={{ fontSize: 12, color: "#868e96" }}>マップ上のオブジェクトをクリックで選択、空きをクリックでその位置に新規。</span>
              </div>
              {panelInitial && <ObjectEditPanel key={panelKey} initial={panelInitial} onChanged={onChanged} onClose={closePanel} />}
              {objects.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  {objects.map((o) => (
                    <button key={o.id} onClick={() => o.id && selectObject(o.id)} style={{ textAlign: "left", padding: "6px 8px", border: "1px solid " + (o.id === selectedId ? "#74c0fc" : "#f1f3f5"), borderRadius: 6, background: o.id === selectedId ? "#e7f5ff" : "#fff", cursor: "pointer", fontSize: 13 }}>
                      <strong>{o.label || o.type}</strong>{" "}
                      <span style={{ color: "#868e96" }}>{o.type} ({o.anchorX},{o.anchorY}) {o.w}×{o.h}</span>
                      {o.memberName ? <span style={{ color: "#1c7ed6" }}> / {o.memberName}</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
