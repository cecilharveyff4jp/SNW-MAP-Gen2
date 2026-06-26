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
import { getMe, listObjects, updateObject, listMaps, createMap, updateMap, deleteMap, type Me, type MapInfo } from "./lib/api";
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
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", background: "#e9eef4" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "linear-gradient(90deg,#1e3a8a,#2563eb)", color: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.18)", zIndex: 10 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#fff" }}>
          <span style={{ background: "#fff", color: "#1e3a8a", padding: "3px 10px", borderRadius: 6, fontWeight: 800, letterSpacing: "0.08em", fontSize: 15 }}>SNW</span>
          <strong style={{ fontSize: 16 }}>同盟内マップ</strong>
        </a>
        <div style={{ flex: 1 }} />
        <nav style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen((v) => !v)} style={{ ...navLink, background: "rgba(255,255,255,0.15)", border: "none", padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>≡ メニュー</button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 19 }} />
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", color: "#111", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", minWidth: 160, zIndex: 20, overflow: "hidden" }}>
                  {[["/", "🗺️ 地図"], ["/stats", "📊 集計"], ["/links", "🔗 リンク集"], ["/music", "🎵 音楽"]].map(([href, txt]) => (
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
      {path === "/account" ? (<CenteredPage><AccountPanel me={me} onReload={loadMe} /></CenteredPage>)
        : path === "/admin" ? (<CenteredPage><UserAdmin me={me} /></CenteredPage>)
        : path === "/stats" ? (<CenteredPage><StatsPage /></CenteredPage>)
        : path === "/links" ? (<CenteredPage><LinksPage canEdit={canEdit} /></CenteredPage>)
        : path === "/music" ? (<CenteredPage><MusicPage canEdit={canEdit} /></CenteredPage>)
        : (<MapView canEdit={canEdit} isOwner={!!me?.isOwner} />)}
    </div>
  );
}

function CenteredPage({ children }: { children: ReactNode }) {
  return (<div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", justifyContent: "center", padding: 24 }}><div style={{ width: "100%", maxWidth: 560 }}>{children}</div></div>);
}

const fabBtn: CSSProperties = { padding: "7px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" };
const dpadBtn: CSSProperties = { width: 44, height: 44, borderRadius: 10, border: "1px solid #ced4da", background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.15)", cursor: "pointer", fontSize: 20, fontWeight: 700, color: "#1971c2", display: "flex", alignItems: "center", justifyContent: "center" };

function MapView({ canEdit, isOwner }: { canEdit: boolean; isOwner: boolean }) {
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [mapId, setMapId] = useState<number | null>(null);
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PanelInitial | null>(null);
  type Move = { id: number; fromX: number; fromY: number; toX: number; toY: number };
  const [undoStack, setUndoStack] = useState<Move[]>([]);
  const [redoStack, setRedoStack] = useState<Move[]>([]);
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
  const onChanged = useCallback(() => { load(); setDraft(null); setSelectedId(null); }, [load]);
  const applyMove = useCallback(async (id: number, x: number, y: number) => {
    let o: MapObject | undefined;
    setObjects((prev) => { o = prev.find((obj) => obj.id === id); return prev.map((obj) => (obj.id === id ? { ...obj, anchorX: x, anchorY: y } : obj)); });
    if (!o) return;
    try { await updateObject(id, { type: o.type, anchorX: x, anchorY: y, w: o.w, h: o.h, label: o.label, gameId: o.gameId, fcLevel: o.fcLevel, note: o.note, birthday: o.birthday, musicIds: o.musicIds }); }
    catch (e) { alert(String((e as Error).message || e)); load(); }
  }, [load]);
  const moveObject = useCallback(async (id: number, x: number, y: number) => {
    const o = objects.find((obj) => obj.id === id); if (!o) return;
    if (o.anchorX === x && o.anchorY === y) return;
    setUndoStack((s) => [...s, { id, fromX: o.anchorX, fromY: o.anchorY, toX: x, toY: y }].slice(-50));
    setRedoStack([]);
    applyMove(id, x, y);
  }, [objects, applyMove]);
  const undo = useCallback(() => {
    setUndoStack((s) => { if (!s.length) return s; const a = s[s.length - 1]; applyMove(a.id, a.fromX, a.fromY); setRedoStack((r) => [...r, a]); return s.slice(0, -1); });
  }, [applyMove]);
  const redo = useCallback(() => {
    setRedoStack((r) => { if (!r.length) return r; const a = r[r.length - 1]; applyMove(a.id, a.toX, a.toY); setUndoStack((u) => [...u, a]); return r.slice(0, -1); });
  }, [applyMove]);
  const nudge = (dx: number, dy: number) => { if (selectedId == null) return; const o = objects.find((obj) => obj.id === selectedId); if (!o) return; moveObject(selectedId, o.anchorX + dx, o.anchorY + dy); };
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
  const mapObjects = isEmpty && !editMode ? DEMO_OBJECTS : objects;
  const tickerText = buildTickerText(mapObjects);
  const selectedObj = selectedId != null ? objects.find((o) => o.id === selectedId) : undefined;
  const panelInitial: PanelInitial | null = draft ? draft : selectedObj ? { id: selectedObj.id, type: selectedObj.type, anchorX: selectedObj.anchorX, anchorY: selectedObj.anchorY, w: selectedObj.w, h: selectedObj.h, label: selectedObj.label, memberName: selectedObj.memberName, gameId: selectedObj.gameId, fcLevel: selectedObj.fcLevel, note: selectedObj.note, birthday: selectedObj.birthday } : null;
  const panelKey = draft ? "new-" + draft.anchorX + "," + draft.anchorY : selectedId != null ? "obj-" + selectedId + ":" + selectedObj?.anchorX + "," + selectedObj?.anchorY : "none";

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* マップ切替タブ */}
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

      {/* 地図エリア */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <MapCanvas objects={mapObjects} selectedId={editable ? selectedId : null} editable={editable} pending={editable && draft && draft.id == null ? { x: draft.anchorX, y: draft.anchorY } : null} onSelectObject={selectObject} onClickEmpty={clickEmpty} onMoveObject={moveObject} />
        {showTelop && tickerText && (<div style={{ position: "absolute", top: 0, left: 0, right: 0 }}><Telop text={tickerText} /></div>)}
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={toggleTelop} style={{ ...fabBtn, background: showTelop ? "#fff3bf" : "#fff" }}>テロップ {showTelop ? "ON" : "OFF"}</button>
          {canEdit ? (<button onClick={toggleEdit} style={{ ...fabBtn, background: editMode ? "#1971c2" : "#fff", color: editMode ? "#fff" : "#111" }}>{editMode ? "✏️ 編集中" : "✏️ 編集"}</button>) : (<a href="/account" style={{ ...fabBtn, color: "#1c7ed6", textDecoration: "none" }}>✏️ 編集を申請</a>)}
          {editable && <button onClick={startNew} style={{ ...fabBtn, background: "#2f9e44", color: "#fff", border: "none" }}>＋ 新規</button>}
          {editable && <button onClick={undo} disabled={!undoStack.length} style={{ ...fabBtn, opacity: undoStack.length ? 1 : 0.45 }}>↩ 戻る</button>}
          {editable && <button onClick={redo} disabled={!redoStack.length} style={{ ...fabBtn, opacity: redoStack.length ? 1 : 0.45 }}>↪ 進む</button>}
        </div>
        {editable && selectedId != null && (
          <div style={{ position: "absolute", bottom: 16, right: 16, display: "grid", gridTemplateColumns: "44px 44px 44px", gridTemplateRows: "44px 44px 44px", gap: 5, zIndex: 5 }}>
            <span /><button onClick={() => nudge(1, 1)} style={dpadBtn}>↑</button><span />
            <button onClick={() => nudge(-1, 1)} style={dpadBtn}>←</button><span style={{ ...dpadBtn, background: "rgba(255,255,255,0.5)", cursor: "default", fontSize: 11, color: "#868e96" }}>移動</span><button onClick={() => nudge(1, -1)} style={dpadBtn}>→</button>
            <span /><button onClick={() => nudge(-1, -1)} style={dpadBtn}>↓</button><span />
          </div>
        )}
        <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 11, color: "#64748b", background: "rgba(255,255,255,0.7)", padding: "3px 8px", borderRadius: 6 }}>ドラッグで移動 / ホイールで拡大縮小{editable ? " / クリックで選択・空きで新規" : ""}</div>
        {loading && <div style={{ position: "absolute", top: 12, right: 12, fontSize: 13, color: "#64748b" }}>読み込み中…</div>}
        {isEmpty && !editMode && !loading && (<div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 12, color: "#92400e", background: "#fff3bf", border: "1px solid #ffe066", borderRadius: 6, padding: "6px 10px" }}>データ未登録のためデモ表示中</div>)}
        {editable && panelInitial && (<div style={{ position: "absolute", top: 12, right: 12, width: 340, maxWidth: "calc(100% - 24px)", maxHeight: "calc(100% - 24px)", overflow: "auto", boxShadow: "0 8px 28px rgba(0,0,0,0.22)", borderRadius: 10 }}><ObjectEditPanel key={panelKey} initial={panelInitial} mapId={mapId ?? 1} onChanged={onChanged} onClose={closePanel} /></div>)}
      </div>
    </div>
  );
}
