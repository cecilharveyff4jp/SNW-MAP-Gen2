import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
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
  { type: "CITY", anchorX: 380, anchorY: 420, w: 1, h: 1, label: "都市A", memberName: "たろう" },
  { type: "BEAR_TRAP", anchorX: 384, anchorY: 418, w: 3, h: 3, label: "熊罠" },
  { type: "LAKE", anchorX: 378, anchorY: 416, w: 2, h: 2, label: "湖" },
  { type: "FLAG", anchorX: 383, anchorY: 421, w: 1, h: 1, label: "旗" },
];

const navLink: CSSProperties = { color: "#dbeafe", textDecoration: "none", fontSize: 13, fontWeight: 600 };

export default function App() {
  const path = window.location.pathname;
  const [me, setMe] = useState<Me | null>(null);
  const loadMe = useCallback(async () => { try { setMe(await getMe()); } catch { setMe(null); } }, []);
  useEffect(() => { loadMe(); }, [loadMe]);
  const canEdit = !!me && (me.isOwner || me.status === "approved");

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", background: "#e9eef4" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "linear-gradient(90deg,#1e3a8a,#2563eb)", color: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.18)", zIndex: 10 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#fff" }}>
          <span style={{ background: "#fff", color: "#1e3a8a", padding: "3px 10px", borderRadius: 6, fontWeight: 800, letterSpacing: "0.08em", fontSize: 15 }}>SNW</span>
          <strong style={{ fontSize: 16 }}>同盟内マップ</strong>
        </a>
        <div style={{ flex: 1 }} />
        <nav style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <a href="/account" style={navLink}>編集申請</a>
          {me?.isOwner && <a href="/admin" style={navLink}>ユーザー管理</a>}
          {me?.email ? (
            <>
              <span style={{ color: "#bfdbfe", fontSize: 12, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.email}</span>
              <a href="/api/auth/logout" style={navLink}>ログアウト</a>
            </>
          ) : (
            <a href="/api/auth/login" style={navLink}>ログイン</a>
          )}
        </nav>
      </header>

      {path === "/account" ? (
        <CenteredPage><AccountPanel me={me} onReload={loadMe} /></CenteredPage>
      ) : path === "/admin" ? (
        <CenteredPage><UserAdmin me={me} /></CenteredPage>
      ) : (
        <MapView canEdit={canEdit} />
      )}
    </div>
  );
}

function CenteredPage({ children }: { children: ReactNode }) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>{children}</div>
    </div>
  );
}

const fabBtn: CSSProperties = { padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" };

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
    ? { id: selectedObj.id, type: selectedObj.type, anchorX: selectedObj.anchorX, anchorY: selectedObj.anchorY, w: selectedObj.w, h: selectedObj.h, label: selectedObj.label, memberName: selectedObj.memberName, gameId: selectedObj.gameId, fcLevel: selectedObj.fcLevel, note: selectedObj.note, birthday: selectedObj.birthday }
    : null;
  const panelKey = draft ? "new-" + draft.anchorX + "," + draft.anchorY : selectedId != null ? "obj-" + selectedId : "none";

  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
      <MapCanvas objects={mapObjects} selectedId={editable ? selectedId : null} editable={editable} onSelectObject={selectObject} onClickEmpty={clickEmpty} />

      {/* テロップ */}
      {showTelop && tickerText && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
          <Telop text={tickerText} />
        </div>
      )}

      {/* フローティングツールバー */}
      <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={toggleTelop} style={{ ...fabBtn, background: showTelop ? "#fff3bf" : "#fff" }}>テロップ {showTelop ? "ON" : "OFF"}</button>
        {canEdit ? (
          <button onClick={toggleEdit} style={{ ...fabBtn, background: editMode ? "#1971c2" : "#fff", color: editMode ? "#fff" : "#111" }}>{editMode ? "✏️ 編集中" : "✏️ 編集"}</button>
        ) : (
          <a href="/account" style={{ ...fabBtn, color: "#1c7ed6", textDecoration: "none" }}>✏️ 編集を申請</a>
        )}
        {editable && <button onClick={startNew} style={{ ...fabBtn, background: "#2f9e44", color: "#fff", border: "none" }}>＋ 新規</button>}
      </div>

      {/* ズーム操作ヒント */}
      <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 11, color: "#64748b", background: "rgba(255,255,255,0.7)", padding: "3px 8px", borderRadius: 6 }}>
        ドラッグで移動 / ホイールで拡大縮小{editable ? " / クリックで選択・空きで新規" : ""}
      </div>

      {loading && <div style={{ position: "absolute", top: 12, right: 12, fontSize: 13, color: "#64748b" }}>読み込み中…</div>}
      {isEmpty && !editMode && !loading && (
        <div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 12, color: "#92400e", background: "#fff3bf", border: "1px solid #ffe066", borderRadius: 6, padding: "6px 10px" }}>データ未登録のためデモ表示中</div>
      )}

      {/* 編集パネル（右に重ねる） */}
      {editable && panelInitial && (
        <div style={{ position: "absolute", top: 12, right: 12, width: 340, maxWidth: "calc(100% - 24px)", maxHeight: "calc(100% - 24px)", overflow: "auto", boxShadow: "0 8px 28px rgba(0,0,0,0.22)", borderRadius: 10 }}>
          <ObjectEditPanel key={panelKey} initial={panelInitial} onChanged={onChanged} onClose={closePanel} />
        </div>
      )}
    </div>
  );
}
