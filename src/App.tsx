import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import MapCanvas from "./components/MapCanvas";
import ObjectEditPanel, { type PanelInitial } from "./components/ObjectEditPanel";
import AccountPanel from "./components/AccountPanel";
import UserAdmin from "./components/UserAdmin";
import StatsPage from "./components/StatsPage";
import LinksPage from "./components/LinksPage";
import MusicPage from "./components/MusicPage";
import Telop from "./components/Telop";
import MobileDrawer from "./components/MobileDrawer";
import AllianceSettings from "./components/AllianceSettings";
import { getMe, getSettings, listObjects, createObject, updateObject, deleteObject, listMaps, createMap, updateMap, deleteMap, type Me, type MapInfo, type ObjectInput, type AllianceInfo } from "./lib/api";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => { const mq = window.matchMedia("(max-width: 640px)"); const on = () => setIsMobile(mq.matches); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
  const hideHeader = isMobile && path === "/";
  const [alliance, setAlliance] = useState<AllianceInfo | null>(null);
  useEffect(() => { getSettings().then(setAlliance).catch(() => { /* noop */ }); }, []);
  const brandTitle = alliance?.allianceName?.trim() || "同盟内マップ";
  const serverText = alliance?.serverNo?.trim() ? "サーバー " + alliance.serverNo.trim() : "";
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", background: "#e9eef4" }}>
      {hideHeader ? null : isMobile ? (
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "linear-gradient(90deg,#1e3a8a,#2563eb)", color: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.18)", zIndex: 10 }}>
        <a href="/" aria-label="地図へ戻る" style={{ width: 38, height: 38, borderRadius: 19, background: "rgba(255,255,255,0.16)", color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>←</a>
        <span style={{ background: "#fff", color: "#1e3a8a", padding: "3px 9px", borderRadius: 6, fontWeight: 800, letterSpacing: "0.06em", fontSize: 14, flexShrink: 0 }}>SNW</span>
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, overflow: "hidden" }}>
          <strong style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brandTitle}</strong>
          {serverText && <span style={{ fontSize: 10.5, opacity: 0.85 }}>{serverText}</span>}
        </span>
      </header>
      ) : (
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "linear-gradient(90deg,#1e3a8a,#2563eb)", color: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.18)", zIndex: 10 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#fff" }}>
          <span style={{ background: "#fff", color: "#1e3a8a", padding: "3px 10px", borderRadius: 6, fontWeight: 800, letterSpacing: "0.08em", fontSize: 15 }}>SNW</span>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}><strong style={{ fontSize: 16 }}>{brandTitle}</strong>{serverText && <span style={{ fontSize: 11, opacity: 0.85 }}>{serverText}</span>}</span>
        </a>
        <div style={{ flex: 1 }} />
        <nav style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen((v) => !v)} style={{ ...navLink, background: "rgba(255,255,255,0.15)", border: "none", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>≡ メニュー</button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 19 }} />
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", color: "#111", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", minWidth: 160, zIndex: 20, overflow: "hidden" }}>
                  {[["/", "🗺️ 地図"], ["/stats", "📊 集計"], ["/links", "🔗 リンク集"], ["/music", "🎵 音楽"], ["/settings", "⚙ 同盟情報"]].map(([href, txt]) => (
                    <a key={href} href={href} style={{ display: "block", padding: "10px 14px", textDecoration: "none", color: "#111", fontSize: 14, borderBottom: "1px solid #f1f3f5" }}>{txt}</a>
                  ))}
                </div>
              </>
            )}
          </div>
          <a href="/account" style={navLink}>編集申請</a>
          {me?.isOwner && <a href="/admin" style={navLink}>ユーザー管理</a>}
          {me?.email ? (<><span style={{ color: "#bfdbfe", fontSize: 12, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.email}</span><a href="/api/auth/logout" style={navLink}>ログアウト</a></>) : (<a href="/api/auth/login" style={navLink}>ログイン</a>)}
        </nav>
      </header>
      )}
      {path === "/account" ? (<CenteredPage><AccountPanel me={me} onReload={loadMe} /></CenteredPage>)
        : path === "/admin" ? (<CenteredPage><UserAdmin me={me} /></CenteredPage>)
        : path === "/stats" ? (<CenteredPage><StatsPage /></CenteredPage>)
        : path === "/links" ? (<CenteredPage><LinksPage canEdit={canEdit} /></CenteredPage>)
        : path === "/music" ? (<CenteredPage><MusicPage canEdit={canEdit} /></CenteredPage>)
        : path === "/settings" ? (<CenteredPage><AllianceSettings me={me} /></CenteredPage>)
        : (<MapView canEdit={canEdit} isOwner={!!me?.isOwner} me={me} alliance={alliance} />)}
    </div>
  );
}

function CenteredPage({ children }: { children: ReactNode }) {
  return (<div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", justifyContent: "center", padding: 24 }}><div style={{ width: "100%", maxWidth: 560 }}>{children}</div></div>);
}

const fabBtn: CSSProperties = { padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" };
const roundBtn: CSSProperties = { width: 46, height: 46, borderRadius: 23, border: "none", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.22)", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto", flexShrink: 0 };
const pillBtn: CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "none", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", fontSize: 15, fontWeight: 700, color: "#1971c2", cursor: "pointer", pointerEvents: "auto" };

function MapView({ canEdit, isOwner, me, alliance }: { canEdit: boolean; isOwner: boolean; me: Me | null; alliance: AllianceInfo | null }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [mapId, setMapId] = useState<number | null>(null);
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PanelInitial | null>(null);
  type Action =
    | { kind: "create"; id: number; data: ObjectInput }
    | { kind: "delete"; id: number; data: ObjectInput }
    | { kind: "update"; id: number; before: ObjectInput; after: ObjectInput };
  const [undoStack, setUndoStack] = useState<Action[]>([]);
  const [redoStack, setRedoStack] = useState<Action[]>([]);
  const [busyHist, setBusyHist] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => { const mq = window.matchMedia("(max-width: 640px)"); const on = () => setIsMobile(mq.matches); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
  const [showTelop, setShowTelop] = useState(() => { try { return localStorage.getItem("snw_show_telop") !== "false"; } catch { return true; } });
  const toggleTelop = () => setShowTelop((v) => { const nv = !v; try { localStorage.setItem("snw_show_telop", String(nv)); } catch { /* noop */ } return nv; });

  const loadMaps = useCallback(async () => {
    try {
      const ms = await listMaps();
      setMaps(ms);
      setMapId((prev) => prev ?? (ms.find((m) => m.isBase)?.id ?? ms[0]?.id ?? null));
    } catch { /* noop */ }
  }, []);
  useEffect(() => { loadMaps(); }, [loadMaps]);

  const load = useCallback(async () => {
    if (mapId == null) return;
    try { const data = await listObjects(mapId); setObjects(Array.isArray(data) ? data : []); }
    catch { setObjects([]); } finally { setLoading(false); }
  }, [mapId]);
  useEffect(() => { load(); }, [load]);

  const selectObject = useCallback((id: number) => { setDraft(null); setSelectedId(id); }, []);
  const clickEmpty = useCallback((gx: number, gy: number) => { const d = getDefaultSize("CITY"); setSelectedId(null); setDraft({ type: "CITY", anchorX: gx, anchorY: gy, w: d.w, h: d.h }); }, []);
  const closePanel = useCallback(() => { setDraft(null); setSelectedId(null); }, []);
  const toData = (o: MapObject): ObjectInput => ({ type: o.type, anchorX: o.anchorX, anchorY: o.anchorY, w: o.w, h: o.h, label: o.label, memberName: o.memberName, gameId: o.gameId, fcLevel: o.fcLevel, note: o.note, birthday: o.birthday, musicIds: o.musicIds });
  const record = (a: Action) => { setUndoStack((s) => [...s, a].slice(-100)); setRedoStack([]); };
  const remapId = (oldId: number, newId: number) => { const fix = (a: Action): Action => (a.id === oldId ? { ...a, id: newId } : a); setUndoStack((s) => s.map(fix)); setRedoStack((r) => r.map(fix)); };

  const saveObject = useCallback(async (payload: ObjectInput, id?: number) => {
    if (id == null) { const r = await createObject(payload, mapId ?? 1); record({ kind: "create", id: r.id, data: payload }); }
    else { const cur = objects.find((o) => o.id === id); await updateObject(id, payload); if (cur) record({ kind: "update", id, before: toData(cur), after: payload }); }
    setDraft(null); setSelectedId(null); await load();
  }, [mapId, objects, load]);
  const removeObject = useCallback(async (id: number) => {
    const cur = objects.find((o) => o.id === id); await deleteObject(id);
    if (cur) record({ kind: "delete", id, data: toData(cur) });
    setDraft(null); setSelectedId(null); await load();
  }, [objects, load]);

  const moveObject = useCallback(async (id: number, x: number, y: number) => {
    const o = objects.find((obj) => obj.id === id); if (!o) return;
    if (o.anchorX === x && o.anchorY === y) return;
    const before = toData(o), after = { ...before, anchorX: x, anchorY: y };
    record({ kind: "update", id, before, after });
    setObjects((prev) => prev.map((obj) => (obj.id === id ? { ...obj, anchorX: x, anchorY: y } : obj)));
    try { await updateObject(id, after); } catch (e) { alert(String((e as Error).message || e)); load(); }
  }, [objects, load]);

  const undo = async () => {
    if (busyHist) return; const a = undoStack[undoStack.length - 1]; if (!a) return;
    setBusyHist(true);
    try {
      let done: Action = a;
      if (a.kind === "update") await updateObject(a.id, a.before);
      else if (a.kind === "create") await deleteObject(a.id);
      else { const r = await createObject(a.data, mapId ?? 1); remapId(a.id, r.id); done = { ...a, id: r.id }; }
      setUndoStack((s) => s.slice(0, -1));
      setRedoStack((r) => [...r, done]);
      setDraft(null); setSelectedId(null); await load();
    } catch (e) { alert(String((e as Error).message || e)); } finally { setBusyHist(false); }
  };
  const redo = async () => {
    if (busyHist) return; const a = redoStack[redoStack.length - 1]; if (!a) return;
    setBusyHist(true);
    try {
      let done: Action = a;
      if (a.kind === "update") await updateObject(a.id, a.after);
      else if (a.kind === "delete") await deleteObject(a.id);
      else { const r = await createObject(a.data, mapId ?? 1); remapId(a.id, r.id); done = { ...a, id: r.id }; }
      setRedoStack((r) => r.slice(0, -1));
      setUndoStack((s) => [...s, done]);
      setDraft(null); setSelectedId(null); await load();
    } catch (e) { alert(String((e as Error).message || e)); } finally { setBusyHist(false); }
  };
  useEffect(() => {
    if (!(editMode && canEdit) || selectedId == null) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const m: Record<string, [number, number]> = { ArrowUp: [1, 1], ArrowDown: [-1, -1], ArrowRight: [1, -1], ArrowLeft: [-1, 1] };
      const d = m[e.key]; if (!d) return;
      e.preventDefault();
      const o = objects.find((obj) => obj.id === selectedId); if (!o) return;
      moveObject(selectedId, o.anchorX + d[0], o.anchorY + d[1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode, canEdit, selectedId, objects, moveObject]);
  const startNew = () => { const d = getDefaultSize("CITY"); setSelectedId(null); setDraft({ type: "CITY", anchorX: 0, anchorY: 0, w: d.w, h: d.h }); };
  const toggleEdit = () => setEditMode((v) => { const nv = !v; if (!nv) { setSelectedId(null); setDraft(null); } return nv; });
  const switchMap = (id: number) => { if (id === mapId) return; setMapId(id); setSelectedId(null); setDraft(null); setUndoStack([]); setRedoStack([]); setLoading(true); };

  const addMap = async () => { const name = prompt("新しいマップの名前"); if (!name) return; try { const r = await createMap(name.trim()); await loadMaps(); setMapId(r.id); setLoading(true); } catch (e) { alert(String((e as Error).message || e)); } };
  const renameMap = async () => { const cur = maps.find((m) => m.id === mapId); const name = prompt("マップ名を変更", cur?.name ?? ""); if (name == null) return; try { await updateMap(mapId as number, { name: name.trim() }); loadMaps(); } catch (e) { alert(String((e as Error).message || e)); } };
  const removeMap = async () => { if (!confirm("このマップを削除しますか？（中のオブジェクトも消えます）")) return; try { await deleteMap(mapId as number); setMapId(null); await loadMaps(); setLoading(true); } catch (e) { alert(String((e as Error).message || e)); } };

  const isEmpty = objects.length === 0;
  const editable = editMode && canEdit;
  const mapObjects = !loading && isEmpty && !editMode ? DEMO_OBJECTS : objects;
  const tickerText = buildTickerText(mapObjects);
  const selectedObj = selectedId != null ? objects.find((o) => o.id === selectedId) : undefined;
  const panelInitial: PanelInitial | null = draft ? draft : selectedObj ? { id: selectedObj.id, type: selectedObj.type, anchorX: selectedObj.anchorX, anchorY: selectedObj.anchorY, w: selectedObj.w, h: selectedObj.h, label: selectedObj.label, memberName: selectedObj.memberName, gameId: selectedObj.gameId, fcLevel: selectedObj.fcLevel, note: selectedObj.note, birthday: selectedObj.birthday, musicIds: selectedObj.musicIds } : null;
  const panelKey = draft ? "new-" + draft.anchorX + "," + draft.anchorY : selectedId != null ? "obj-" + selectedId : "none";

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* マップ切替タブ（PCのみ。スマホはハンバーガー内） */}
      {!isMobile && (
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#fff", borderBottom: "1px solid #dde3ea", overflowX: "auto", whiteSpace: "nowrap" }}>
        {maps.map((m) => (
          <button key={m.id} onClick={() => switchMap(m.id)} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid " + (m.id === mapId ? "#2563eb" : "#ced4da"), background: m.id === mapId ? "#2563eb" : "#fff", color: m.id === mapId ? "#fff" : "#333", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{m.name}</button>
        ))}
        {isOwner && (
          <>
            <button onClick={addMap} style={{ padding: "6px 10px", borderRadius: 7, border: "1px dashed #adb5bd", background: "#fff", color: "#495057", cursor: "pointer", fontSize: 13 }}>＋ マップ</button>
            {mapId != null && <button onClick={renameMap} style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid #e9ecef", background: "#fff", color: "#868e96", cursor: "pointer", fontSize: 12 }}>名前変更</button>}
            {mapId != null && !maps.find((m) => m.id === mapId)?.isBase && <button onClick={removeMap} style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid #ffc9c9", background: "#fff", color: "#e03131", cursor: "pointer", fontSize: 12 }}>削除</button>}
          </>
        )}
      </div>
      )}

      {/* 地図エリア */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <MapCanvas objects={mapObjects} selectedId={editable ? selectedId : null} editable={editable} pending={editable && draft && draft.id == null ? { x: draft.anchorX, y: draft.anchorY } : null} onSelectObject={selectObject} onClickEmpty={clickEmpty} onMoveObject={moveObject} />
        {showTelop && tickerText && (<div style={{ position: "absolute", top: isMobile ? 64 : 0, left: 0, right: 0, zIndex: 3 }}><Telop text={tickerText} /></div>)}
        {/* PC用ツールバー */}
        {!isMobile && (
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={toggleTelop} style={{ ...fabBtn, background: showTelop ? "#fff3bf" : "#fff" }}>テロップ {showTelop ? "ON" : "OFF"}</button>
          {canEdit ? (<button onClick={toggleEdit} style={{ ...fabBtn, background: editMode ? "#1971c2" : "#fff", color: editMode ? "#fff" : "#111" }}>{editMode ? "✏️ 編集中" : "✏️ 編集"}</button>) : (<a href="/account" style={{ ...fabBtn, color: "#1c7ed6", textDecoration: "none" }}>✏️ 編集を申請</a>)}
          {editable && <button onClick={startNew} style={{ ...fabBtn, background: "#2f9e44", color: "#fff", border: "none" }}>＋ 新規</button>}
          {editable && <button onClick={undo} disabled={!undoStack.length || busyHist} style={{ ...fabBtn, opacity: undoStack.length && !busyHist ? 1 : 0.45 }}>↩ 戻る</button>}
          {editable && <button onClick={redo} disabled={!redoStack.length || busyHist} style={{ ...fabBtn, opacity: redoStack.length && !busyHist ? 1 : 0.45 }}>↪ 進む</button>}
        </div>
        )}
        {/* スマホ用フローティングUI */}
        {isMobile && (
          <>
            <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", alignItems: "center", gap: 8, zIndex: 7, pointerEvents: "none" }}>
              <button onClick={() => setDrawerOpen(true)} style={roundBtn} aria-label="メニュー">☰</button>
              <button onClick={() => setDrawerOpen(true)} style={{ pointerEvents: "auto", flex: 1, minWidth: 0, overflow: "hidden", border: "none", background: "rgba(255,255,255,0.94)", boxShadow: "0 2px 10px rgba(0,0,0,0.18)", borderRadius: 999, padding: "7px 16px", color: "#1e293b", textAlign: "center", lineHeight: 1.1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(alliance?.allianceName?.trim() || "同盟内マップ")}{alliance?.serverNo?.trim() ? " #" + alliance.serverNo.trim() : ""}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{maps.find((m) => m.id === mapId)?.name ?? ""}</div>
              </button>
              {canEdit ? (
                <button onClick={toggleEdit} style={{ ...roundBtn, background: editMode ? "#1971c2" : "#fff", color: editMode ? "#fff" : "#1971c2" }} aria-label={editMode ? "編集中" : "編集"}>✏️</button>
              ) : (
                <a href="/account" style={{ ...roundBtn, textDecoration: "none", color: "#1971c2" }} aria-label="編集を申請">✏️</a>
              )}
            </div>
            {editable && (
              <div style={{ position: "absolute", top: showTelop ? 96 : 66, left: 10, display: "flex", gap: 8, zIndex: 7 }}>
                <button onClick={startNew} style={{ ...pillBtn, background: "#2f9e44", color: "#fff" }}>＋ 新規</button>
                <button onClick={undo} disabled={!undoStack.length || busyHist} style={{ ...pillBtn, width: 46, padding: "10px 0", textAlign: "center", opacity: undoStack.length && !busyHist ? 1 : 0.4 }} aria-label="戻る">↩</button>
                <button onClick={redo} disabled={!redoStack.length || busyHist} style={{ ...pillBtn, width: 46, padding: "10px 0", textAlign: "center", opacity: redoStack.length && !busyHist ? 1 : 0.4 }} aria-label="進む">↪</button>
              </div>
            )}
          </>
        )}
        {!isMobile && <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 11, color: "#64748b", background: "rgba(255,255,255,0.7)", padding: "3px 8px", borderRadius: 6 }}>ドラッグで移動 / ホイールで拡大縮小{editable ? " / クリックで選択・空きで新規" : ""}</div>}
        {loading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "linear-gradient(160deg, #eaf2fb 0%, #f4f8fc 55%, #eef4ee 100%)" }}>
            <div style={{ position: "relative", width: 64, height: 64 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "5px solid #d3e2f5", borderTopColor: "#1e3a8a", animation: "snwspin 0.85s linear infinite" }} />
              <img src="/favicon-32x32.png" alt="" style={{ position: "absolute", top: "50%", left: "50%", width: 28, height: 28, transform: "translate(-50%,-50%)", animation: "snwpulse 1.4s ease-in-out infinite" }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e3a8a", letterSpacing: "0.12em" }}>読み込み中…</div>
          </div>
        )}
        {!loading && isEmpty && !editMode && (<div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 12, color: "#92400e", background: "#fff3bf", border: "1px solid #ffe066", borderRadius: 6, padding: "6px 10px" }}>データ未登録のためデモ表示中</div>)}
        {editable && panelInitial && (<div style={isMobile ? { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "84vh", overflow: "auto", boxShadow: "0 -8px 28px rgba(0,0,0,0.28)", borderTopLeftRadius: 16, borderTopRightRadius: 16, animation: "snwsheet 0.22s ease-out", zIndex: 9 } : { position: "absolute", top: 12, right: 12, width: 340, maxWidth: "calc(100% - 24px)", maxHeight: "calc(100% - 24px)", overflow: "auto", boxShadow: "0 8px 28px rgba(0,0,0,0.22)", borderRadius: 10, zIndex: 9 }}><ObjectEditPanel key={panelKey} initial={panelInitial} onSave={saveObject} onDelete={removeObject} onClose={closePanel} /></div>)}
        {isMobile && <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} path="/" me={me} maps={maps} mapId={mapId} isOwner={isOwner} onSwitchMap={switchMap} onAddMap={addMap} onRenameMap={renameMap} onRemoveMap={removeMap} showTelop={showTelop} onToggleTelop={toggleTelop} />}
      </div>
      <style>{"@keyframes snwspin{to{transform:rotate(360deg)}}@keyframes snwpulse{0%,100%{opacity:.55;transform:translate(-50%,-50%) scale(.92)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}}@keyframes snwsheet{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes snwfade{from{opacity:0}to{opacity:1}}@keyframes snwdrawer{from{transform:translateX(-100%)}to{transform:translateX(0)}}"}</style>
    </div>
  );
}
