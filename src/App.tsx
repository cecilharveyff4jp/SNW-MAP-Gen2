import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, TouchEvent as RTouchEvent } from "react";
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
import Icon from "./components/Icon";
import { useDialog } from "./components/Dialog";
import { getMe, getSettings, listObjects, createObject, updateObject, deleteObject, listMaps, createMap, updateMap, deleteMap, listMusic, type Me, type MapInfo, type ObjectInput, type AllianceInfo, type MusicItem } from "./lib/api";
import MusicPlayerModal from "./components/MusicPlayerModal";
import ObjectInfoSheet from "./components/ObjectInfoSheet";
import FcBadge from "./components/FcBadge";
import SuggestModal from "./components/SuggestModal";
import SuggestionsPage from "./components/SuggestionsPage";
import CitySelect from "./components/CitySelect";
import Sidebar from "./components/Sidebar";
import { buildTickerText } from "./lib/birthday";
import { getDefaultSize, overlapsAny, findFreeAnchor } from "./lib/sizes";
import type { MapObject } from "./lib/types";

const navLink: CSSProperties = { color: "#5a6477", textDecoration: "none", fontSize: 13, fontWeight: 600 };

export default function App() {
  const path = window.location.pathname;
  const [me, setMe] = useState<Me | null>(null);
  const loadMe = useCallback(async () => { try { setMe(await getMe()); } catch { setMe(null); } }, []);
  useEffect(() => { loadMe(); }, [loadMe]);
  const canEdit = !!me && (me.isOwner || me.status === "approved");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => { const mq = window.matchMedia("(max-width: 640px)"); const on = () => setIsMobile(mq.matches); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
  const hideHeader = isMobile && path === "/";
  const [alliance, setAlliance] = useState<AllianceInfo | null>(null);
  useEffect(() => { getSettings().then(setAlliance).catch(() => { /* noop */ }); }, []);
  const aName = alliance?.allianceName?.trim() || "";
  const aServer = alliance?.serverNo?.trim() || "";
  const aAbbr = alliance?.abbr?.trim() || "SNW";
  const brandTitle = (aName ? "/" + aName : "同盟内マップ") + (aServer ? " #" + aServer : "");

  const content = path === "/account" ? (<CenteredPage><AccountPanel me={me} onReload={loadMe} /></CenteredPage>)
    : path === "/admin" ? (<CenteredPage><UserAdmin me={me} /></CenteredPage>)
    : path === "/stats" ? (<CenteredPage><StatsPage /></CenteredPage>)
    : path === "/links" ? (<CenteredPage><LinksPage canEdit={canEdit} /></CenteredPage>)
    : path === "/music" ? (<CenteredPage><MusicPage canEdit={canEdit} /></CenteredPage>)
    : path === "/suggestions" ? (<CenteredPage><SuggestionsPage canEdit={canEdit} /></CenteredPage>)
    : path === "/settings" ? (<CenteredPage><AllianceSettings me={me} /></CenteredPage>)
    : (<MapView canEdit={canEdit} isOwner={!!me?.isOwner} me={me} alliance={alliance} />);

  if (isMobile) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif", background: "var(--app-bg, #e9eef4)" }}>
        {hideHeader ? null : (
          <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 12px", height: 52, background: "var(--surface, #fff)", borderBottom: "1px solid var(--border, #e9ebf1)", flexShrink: 0, zIndex: 10 }}>
            <a href="/" aria-label="地図へ戻る" style={{ width: 36, height: 36, borderRadius: 18, background: "#f1f2f7", color: "#5a6477", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>←</a>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--accent, #5b5bd6)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}>{aAbbr.slice(0, 3)}</span>
            <strong style={{ fontSize: 15, fontWeight: 600, color: "#1a1f2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brandTitle}</strong>
          </header>
        )}
        {content}
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "row", fontFamily: "system-ui, sans-serif", background: "var(--app-bg, #e9eef4)" }}>
      <Sidebar path={path} canEdit={canEdit} abbr={aAbbr} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 18px", height: 54, background: "var(--surface, #fff)", borderBottom: "1px solid var(--border, #e9ebf1)", flexShrink: 0, zIndex: 10 }}>
          <strong style={{ fontSize: 15, fontWeight: 600, color: "#1a1f2e" }}>{brandTitle}</strong>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            {me?.isOwner && <a href="/admin" style={navLink}>ユーザー管理</a>}
            <a href="/account" style={navLink}>編集申請</a>
            {me?.email ? (<><span style={{ display: "inline-flex", alignItems: "center", background: "#f1f2f7", color: "#5a6477", fontSize: 12, padding: "5px 11px", borderRadius: 999, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.email}</span><a href="/api/auth/logout" style={navLink}>ログアウト</a></>) : (<a href="/api/auth/login" style={{ display: "inline-flex", alignItems: "center", padding: "7px 16px", borderRadius: 999, background: "var(--accent, #5b5bd6)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>ログイン</a>)}
          </div>
        </header>
        {content}
      </div>
    </div>
  );
}

function CenteredPage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const startY = useRef(0);
  const active = useRef(false);
  const onStart = (e: RTouchEvent<HTMLDivElement>) => { const el = ref.current; if (el && el.scrollTop <= 0) { startY.current = e.touches[0].clientY; active.current = true; } else { active.current = false; } };
  const onMove = (e: RTouchEvent<HTMLDivElement>) => { if (!active.current) return; const el = ref.current; const dy = e.touches[0].clientY - startY.current; if (dy > 0 && el && el.scrollTop <= 0) { setPull(Math.min(dy * 0.5, 90)); } else { active.current = false; setPull(0); } };
  const onEnd = () => { if (pull > 60) window.location.reload(); else { setPull(0); active.current = false; } };
  return (
    <div ref={ref} onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", justifyContent: "center", padding: "22px 18px 56px", position: "relative" }}>
      {pull > 0 && (<div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", fontSize: 12, fontWeight: 700, color: pull > 60 ? "var(--accent, #1971c2)" : "#868e96", opacity: Math.min(pull / 45, 1), zIndex: 2 }}>{pull > 60 ? "↑ 離して更新" : "↓ 引っ張って更新"}</div>)}
      <div style={{ width: "100%", maxWidth: 600, transform: "translateY(" + pull + "px)", transition: active.current ? "none" : "transform 0.25s ease" }}>{children}</div>
    </div>
  );
}

const fabBtn: CSSProperties = { padding: "8px 13px", borderRadius: 10, border: "1px solid var(--border, #e3e8ef)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#33404f", background: "#fff", boxShadow: "0 2px 10px rgba(15,23,42,0.10)" };
const trayBtn = (dk: boolean): CSSProperties => ({ padding: "7px 12px", borderRadius: 9, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: dk ? "#dfe7f1" : "#33404f", display: "inline-flex", alignItems: "center", gap: 5 });
const roundBtn: CSSProperties = { width: 44, height: 44, borderRadius: 22, border: "1px solid var(--border, #e9edf2)", background: "#fff", boxShadow: "0 3px 12px rgba(15,23,42,0.16)", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto", flexShrink: 0, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" };
const pillBtn: CSSProperties = { padding: "10px 14px", borderRadius: 999, border: "1px solid var(--border, #e9edf2)", background: "#fff", boxShadow: "0 3px 12px rgba(15,23,42,0.16)", fontSize: 15, fontWeight: 700, color: "var(--accent, #1971c2)", cursor: "pointer", pointerEvents: "auto", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" };

function MapView({ canEdit, isOwner, me, alliance }: { canEdit: boolean; isOwner: boolean; me: Me | null; alliance: AllianceInfo | null }) {
  const dlg = useDialog();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [maps, setMaps] = useState<MapInfo[]>([]);
  const [mapId, setMapId] = useState<number | null>(null);
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PanelInitial | null>(null);
  const [draftSeq, setDraftSeq] = useState(0);
  const [pendingSpot, setPendingSpot] = useState<{ x: number; y: number } | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [zoom, setZoom] = useState(1);
  const [music, setMusic] = useState<MusicItem[]>([]);
  useEffect(() => { listMusic().then(setMusic).catch(() => { /* noop */ }); }, []);
  const [playerItem, setPlayerItem] = useState<MusicItem | null>(null);
  const [suggestObj, setSuggestObj] = useState<{ id?: number | null; label?: string | null; mapId?: number | null } | null>(null);
  const [myCityId, setMyCityId] = useState<number | null>(() => { try { const v = localStorage.getItem("snw_my_city"); return v ? Number(v) : null; } catch { return null; } });
  const setMyCity = (id: number | null) => { setMyCityId(id); try { if (id == null) localStorage.removeItem("snw_my_city"); else localStorage.setItem("snw_my_city", String(id)); } catch { /* noop */ } setFocusId(id); setFocusNonce((n) => n + 1); };
  type Action =
    | { kind: "create"; id: number; data: ObjectInput }
    | { kind: "delete"; id: number; data: ObjectInput }
    | { kind: "update"; id: number; before: ObjectInput; after: ObjectInput };
  const [undoStack, setUndoStack] = useState<Action[]>([]);
  const [redoStack, setRedoStack] = useState<Action[]>([]);
  const [busyHist, setBusyHist] = useState(false);
  const [overlapMsg, setOverlapMsg] = useState<string | null>(null);
  useEffect(() => { if (!overlapMsg) return; const t = setTimeout(() => setOverlapMsg(null), 2600); return () => clearTimeout(t); }, [overlapMsg]);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 1800); return () => clearTimeout(t); }, [toast]);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => { const mq = window.matchMedia("(max-width: 640px)"); const on = () => setIsMobile(mq.matches); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);
  const [showTelop, setShowTelop] = useState(() => { try { return localStorage.getItem("snw_show_telop") !== "false"; } catch { return true; } });
  const [mapDark, setMapDark] = useState(() => { try { return localStorage.getItem("snw_map_mode") === "dark"; } catch { return false; } });
  const toggleMapDark = () => setMapDark((v) => { const nv = !v; try { localStorage.setItem("snw_map_mode", nv ? "dark" : "light"); } catch { /* noop */ } return nv; });
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
  // マップ表示・更新（読み込み完了）時に自分の都市を中央へ
  useEffect(() => { if (!loading) { setFocusId(null); setFocusNonce((n) => n + 1); } }, [loading, mapId]);
  const doSearchSelect = (id: number) => { setDraft(null); setSelectedId(id); setFocusId(id); setFocusNonce((n) => n + 1); setSearchOpen(false); setSearchQ(""); };

  const selectObject = useCallback((id: number) => { setDraft(null); setPendingSpot(null); setPanelCollapsed(false); setSelectedId(id); }, []);
  const clickEmpty = useCallback((gx: number, gy: number) => { if (!(editMode && canEdit)) { setSelectedId(null); setDraft(null); setPendingSpot(null); return; } const d = getDefaultSize("CITY"); const free = findFreeAnchor(gx, gy, d.w, d.h, objects); setSelectedId(null); setDraft(null); setPanelCollapsed(false); setPendingSpot(free); }, [editMode, canEdit, objects]);
  const moveDraft = useCallback((x: number, y: number) => { setDraft((dft) => (dft && dft.id == null ? { ...dft, anchorX: x, anchorY: y } : dft)); }, []);
  const closePanel = useCallback(() => { setDraft(null); setSelectedId(null); setPendingSpot(null); setPanelCollapsed(false); }, []);
  const toData = (o: MapObject): ObjectInput => ({ type: o.type, anchorX: o.anchorX, anchorY: o.anchorY, w: o.w, h: o.h, label: o.label, memberName: o.memberName, gameId: o.gameId, fcLevel: o.fcLevel, note: o.note, birthday: o.birthday, musicIds: o.musicIds });
  const record = (a: Action) => { setUndoStack((s) => [...s, a].slice(-100)); setRedoStack([]); };
  const remapId = (oldId: number, newId: number) => { const fix = (a: Action): Action => (a.id === oldId ? { ...a, id: newId } : a); setUndoStack((s) => s.map(fix)); setRedoStack((r) => r.map(fix)); };

  const saveObject = useCallback(async (payload: ObjectInput, id?: number) => {
    if (overlapsAny({ anchorX: payload.anchorX, anchorY: payload.anchorY, w: payload.w, h: payload.h }, objects, id)) {
      throw new Error("他のオブジェクトと重なっているため保存できません。位置をずらしてください。");
    }
    if (id == null) { const r = await createObject(payload, mapId ?? 1); record({ kind: "create", id: r.id, data: payload }); }
    else { const cur = objects.find((o) => o.id === id); await updateObject(id, payload); if (cur) record({ kind: "update", id, before: toData(cur), after: payload }); }
    setDraft(null); setSelectedId(null); await load(); setToast(id == null ? "追加しました" : "保存しました");
  }, [mapId, objects, load]);
  const removeObject = useCallback(async (id: number) => {
    const cur = objects.find((o) => o.id === id); await deleteObject(id);
    if (cur) record({ kind: "delete", id, data: toData(cur) });
    setDraft(null); setSelectedId(null); await load(); setToast("削除しました");
  }, [objects, load]);

  const moveObject = useCallback(async (id: number, x: number, y: number) => {
    const o = objects.find((obj) => obj.id === id); if (!o) return;
    if (o.anchorX === x && o.anchorY === y) return;
    if (overlapsAny({ anchorX: x, anchorY: y, w: o.w, h: o.h }, objects, id)) { setOverlapMsg("他のオブジェクトと重なるため、その場所には移動できません"); return; }
    const before = toData(o), after = { ...before, anchorX: x, anchorY: y };
    record({ kind: "update", id, before, after });
    setObjects((prev) => prev.map((obj) => (obj.id === id ? { ...obj, anchorX: x, anchorY: y } : obj)));
    try { await updateObject(id, after); } catch (e) { dlg.alert({ title: "エラー", message: String((e as Error).message || e) }); load(); }
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
    } catch (e) { dlg.alert({ title: "エラー", message: String((e as Error).message || e) }); } finally { setBusyHist(false); }
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
    } catch (e) { dlg.alert({ title: "エラー", message: String((e as Error).message || e) }); } finally { setBusyHist(false); }
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
  const startNew = () => { const d = getDefaultSize("CITY"); let spot = pendingSpot; if (!spot) { const base = (myCityId != null ? objects.find((o) => o.id === myCityId) : undefined) ?? objects[0]; spot = findFreeAnchor(base ? base.anchorX : 0, base ? base.anchorY : 0, d.w, d.h, objects); } setPanelCollapsed(false); setSelectedId(null); setPendingSpot(null); setDraft({ type: "CITY", anchorX: spot.x, anchorY: spot.y, w: d.w, h: d.h }); setDraftSeq((s) => s + 1); };
  const duplicateObject = (src: ObjectInput) => { const free = findFreeAnchor(src.anchorX, src.anchorY, src.w, src.h, objects); setSelectedId(null); setPendingSpot(null); setPanelCollapsed(false); setDraft({ type: src.type, anchorX: free.x, anchorY: free.y, w: src.w, h: src.h, fcLevel: src.fcLevel }); setDraftSeq((s) => s + 1); };
  const recenter = () => { if (myCityId != null) { setFocusId(myCityId); setFocusNonce((n) => n + 1); } };
  const requestSuggest = () => { if (!me?.email) { dlg.alert({ title: "ログインが必要です", message: "変更の提案にはGoogleログインが必要です。" }); return; } if (!selectedObj) return; setSuggestObj({ id: selectedObj.id, label: selectedObj.label || selectedObj.memberName || null, mapId }); };
  const toggleEdit = () => setEditMode((v) => { const nv = !v; if (!nv) { setSelectedId(null); setDraft(null); setPendingSpot(null); } return nv; });
  const switchMap = (id: number) => { if (id === mapId) return; setMapId(id); setSelectedId(null); setDraft(null); setPendingSpot(null); setPanelCollapsed(false); setUndoStack([]); setRedoStack([]); setLoading(true); };

  const addMap = async () => {
    const mode = await dlg.choose({ title: "マップを追加", message: "作成方法を選んでください", options: [{ label: "最初から作る", value: "blank" }, { label: "既存マップをコピーして作成", value: "copy" }] });
    if (!mode) return;
    if (mode === "blank") {
      const name = await dlg.prompt({ title: "新しいマップを作成", placeholder: "マップ名（例: 第2エリア）", okLabel: "作成" });
      if (!name || !name.trim()) return;
      try { const r = await createMap(name.trim()); await loadMaps(); setMapId(r.id); setLoading(true); } catch (e) { dlg.alert({ title: "エラー", message: String((e as Error).message || e) }); }
      return;
    }
    const srcVal = await dlg.choose({ title: "コピー元のマップを選択", message: "選んだマップの内容をすべて複製します", options: maps.map((m) => ({ label: m.name, value: String(m.id) })) });
    if (!srcVal) return;
    const srcId = Number(srcVal); const src = maps.find((m) => m.id === srcId);
    try {
      setLoading(true);
      const r = await createMap((src?.name ?? "マップ") + "のコピー");
      const objs = await listObjects(srcId);
      for (const o of objs) { await createObject(toData(o), r.id); }
      await loadMaps(); setMapId(r.id); setLoading(true);
    } catch (e) { dlg.alert({ title: "エラー", message: String((e as Error).message || e) }); load(); }
  };
  const renameMap = async (id: number) => { const cur = maps.find((m) => m.id === id); if (cur?.isBase) return; const name = await dlg.prompt({ title: "マップ名を変更", defaultValue: cur?.name ?? "", okLabel: "変更" }); if (name == null || !name.trim()) return; try { await updateMap(id, { name: name.trim() }); loadMaps(); } catch (e) { dlg.alert({ title: "エラー", message: String((e as Error).message || e) }); } };
  const removeMap = async (id: number) => { const cur = maps.find((m) => m.id === id); if (cur?.isBase) return; if (!(await dlg.confirm({ title: "マップを削除", message: "「" + (cur?.name ?? "") + "」を削除します。\n中のオブジェクトもすべて消えます。よろしいですか？", okLabel: "削除する", danger: true }))) return; try { await deleteMap(id); if (id === mapId) setMapId(null); await loadMaps(); setLoading(true); } catch (e) { dlg.alert({ title: "エラー", message: String((e as Error).message || e) }); } };

  const editable = editMode && canEdit;
  const cityDef = getDefaultSize("CITY");
  const cityKey = (fc?: string) => (fc ? (/^FC/.test(fc) ? 100 + (parseInt(fc.replace("FC", ""), 10) || 0) : (parseInt(fc, 10) || 0)) : -1);
  const cityChoices = objects.filter((o) => o.id != null && o.type === "CITY" && (o.label || o.memberName)).map((o) => ({ id: o.id as number, name: (o.label || o.memberName) as string, fcLevel: o.fcLevel })).sort((a, b) => cityKey(b.fcLevel) - cityKey(a.fcLevel) || a.name.localeCompare(b.name));
  const aName = alliance?.allianceName?.trim() || "";
  const aServer = alliance?.serverNo?.trim() || "";
  const aAbbr = alliance?.abbr?.trim() || "SNW";
  const pillMain = (aName ? aAbbr + "/" + aName : "同盟内マップ") + (aServer ? " #" + aServer : "");
  const fuzzy = (q: string, name: string) => { const a = q.toLowerCase().trim(); if (!a) return true; const b = name.toLowerCase(); let i = 0; for (const ch of b) { if (ch === a[i]) i++; if (i >= a.length) return true; } return b.includes(a); };
  const searchResults = cityChoices.filter((c) => fuzzy(searchQ, c.name)).slice(0, 40);
  const mapObjects = objects;
  const tickerText = buildTickerText(mapObjects);
  const selectedObj = selectedId != null ? objects.find((o) => o.id === selectedId) : undefined;
  const panelInitial: PanelInitial | null = draft ? draft : selectedObj ? { id: selectedObj.id, type: selectedObj.type, anchorX: selectedObj.anchorX, anchorY: selectedObj.anchorY, w: selectedObj.w, h: selectedObj.h, label: selectedObj.label, memberName: selectedObj.memberName, gameId: selectedObj.gameId, fcLevel: selectedObj.fcLevel, note: selectedObj.note, birthday: selectedObj.birthday, musicIds: selectedObj.musicIds } : null;
  const panelKey = draft ? "new-" + draftSeq : selectedId != null ? "obj-" + selectedId : "none";

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* マップ切替タブ（PCのみ。スマホはハンバーガー内） */}
      {!isMobile && (
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "var(--surface, #fff)", borderBottom: "1px solid var(--border, #dde3ea)", overflowX: "auto", whiteSpace: "nowrap" }}>
        {maps.map((m) => (
          <button key={m.id} onClick={() => switchMap(m.id)} style={{ padding: "6px 13px", borderRadius: 8, border: "1px solid " + (m.id === mapId ? "var(--accent, #5b5bd6)" : "var(--border, #e3e8ef)"), background: m.id === mapId ? "var(--accent-soft, #ededfc)" : "#fff", color: m.id === mapId ? "var(--accent-strong, #4b3fc4)" : "#5a6477", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{m.name}</button>
        ))}
        {canEdit && <button onClick={addMap} style={{ padding: "6px 10px", borderRadius: 7, border: "1px dashed #adb5bd", background: "#fff", color: "#495057", cursor: "pointer", fontSize: 13 }}>＋ マップ</button>}
        {canEdit && mapId != null && !maps.find((m) => m.id === mapId)?.isBase && <button onClick={() => renameMap(mapId)} style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid #e9ecef", background: "#fff", color: "#868e96", cursor: "pointer", fontSize: 12 }}>名前変更</button>}
        {isOwner && mapId != null && !maps.find((m) => m.id === mapId)?.isBase && <button onClick={() => removeMap(mapId)} style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid #ffc9c9", background: "#fff", color: "#e03131", cursor: "pointer", fontSize: 12 }}>削除</button>}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "#868e96", display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="star" size={13} />自分の都市</span>
          <CitySelect cities={cityChoices} value={myCityId} onSelect={setMyCity} compact />
        </div>
      </div>
      )}

      {/* 誕生日テロップ（PCは通常フローのバー、スマホは地図上にフロート） */}
      {!isMobile && showTelop && tickerText && (<div style={{ flexShrink: 0, borderBottom: "1px solid var(--border, #dde3ea)" }}><Telop text={tickerText} /></div>)}

      {/* 地図エリア */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <MapCanvas objects={mapObjects} selectedId={selectedId} editable={editable} pending={editable ? (draft && draft.id == null ? { x: draft.anchorX, y: draft.anchorY, w: draft.w, h: draft.h } : (pendingSpot ? { x: pendingSpot.x, y: pendingSpot.y, w: cityDef.w, h: cityDef.h } : null)) : null} myCityId={myCityId} focusId={focusId} focusNonce={focusNonce} onSelectObject={selectObject} onClickEmpty={clickEmpty} onMoveObject={moveObject} onMovePending={(x, y) => { if (draft && draft.id == null) moveDraft(x, y); else setPendingSpot({ x, y }); }} onZoom={setZoom} dark={mapDark} />
        {isMobile && showTelop && tickerText && (<div style={{ position: "absolute", top: 64, left: 0, right: 0, zIndex: 3 }}><Telop text={tickerText} /></div>)}
        {/* PC用ツールバー */}
        {!isMobile && (
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", padding: 6, borderRadius: 13, background: mapDark ? "rgba(18,24,34,0.62)" : "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid " + (mapDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.9)"), boxShadow: "0 10px 26px -8px rgba(20,28,54,0.30)" }}>
          <button onClick={toggleTelop} style={{ ...trayBtn(mapDark), background: showTelop ? (mapDark ? "rgba(255,214,102,0.18)" : "#fff3bf") : "transparent", color: showTelop ? (mapDark ? "#ffd86b" : "#8a6d00") : (mapDark ? "#dfe7f1" : "#33404f") }}>テロップ {showTelop ? "ON" : "OFF"}</button>
          <button onClick={toggleMapDark} style={trayBtn(mapDark)}><Icon name={mapDark ? "star" : "settings"} size={15} />{mapDark ? "ライト盤面" : "ダーク盤面"}</button>
          <button onClick={() => setSearchOpen((v) => !v)} style={{ ...trayBtn(mapDark), background: searchOpen ? "var(--accent-soft, #ededfc)" : "transparent", color: searchOpen ? "var(--accent-strong, #4b3fc4)" : (mapDark ? "#dfe7f1" : "#33404f") }}><Icon name="search" size={16} />検索</button>
          {canEdit ? (<button onClick={toggleEdit} style={{ ...trayBtn(mapDark), background: editMode ? "var(--accent, #5b5bd6)" : "transparent", color: editMode ? "#fff" : (mapDark ? "#dfe7f1" : "#33404f") }}><Icon name="edit" size={16} />{editMode ? "編集中" : "編集"}</button>) : (<a href="/account" style={{ ...trayBtn(mapDark), color: "var(--accent, #5b5bd6)", textDecoration: "none" }}><Icon name="edit" size={16} />編集を申請</a>)}
          {editable && <button onClick={startNew} style={{ ...trayBtn(mapDark), background: "#2f9e44", color: "#fff" }}><Icon name="plus" size={16} />新規</button>}
          {editable && <button onClick={undo} disabled={!undoStack.length || busyHist} style={{ ...trayBtn(mapDark), opacity: undoStack.length && !busyHist ? 1 : 0.4 }}><Icon name="undo" size={16} />戻る</button>}
          {editable && <button onClick={redo} disabled={!redoStack.length || busyHist} style={{ ...trayBtn(mapDark), opacity: redoStack.length && !busyHist ? 1 : 0.4 }}><Icon name="redo" size={16} />進む</button>}
        </div>
        )}
        {/* スマホ用フローティングUI */}
        {isMobile && (
          <>
            <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", alignItems: "center", gap: 8, zIndex: 7, pointerEvents: "none" }}>
              <button onClick={() => setDrawerOpen(true)} style={{ ...roundBtn, background: mapDark ? "rgba(20,26,36,0.8)" : "#fff", color: mapDark ? "#dfe7f1" : "#1e293b", border: "1px solid " + (mapDark ? "rgba(255,255,255,0.12)" : "var(--border, #e9edf2)") }} aria-label="メニュー"><Icon name="menu" /></button>
              <button onClick={() => window.location.reload()} aria-label="再読み込み" style={{ pointerEvents: "auto", flex: 1, minWidth: 0, overflow: "hidden", border: "1px solid " + (mapDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.05)"), background: mapDark ? "rgba(20,26,36,0.8)" : "rgba(255,255,255,0.94)", boxShadow: "0 2px 10px rgba(0,0,0,0.18)", borderRadius: 999, padding: "7px 16px", color: mapDark ? "#eef2f8" : "#1e293b", textAlign: "center", lineHeight: 1.1, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                <div style={{ fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pillMain}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, fontSize: 10.5, fontWeight: 600, color: mapDark ? "#9fb0c4" : "#64748b", overflow: "hidden" }}><Icon name="refresh" size={11} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{maps.find((m) => m.id === mapId)?.name ?? ""}</span></div>
              </button>
              {canEdit ? (
                <button onClick={toggleEdit} style={{ ...roundBtn, background: editMode ? "var(--accent, #5b5bd6)" : (mapDark ? "rgba(20,26,36,0.8)" : "#fff"), color: editMode ? "#fff" : "var(--accent, #5b5bd6)", border: "1px solid " + (mapDark ? "rgba(255,255,255,0.12)" : "var(--border, #e9edf2)") }} aria-label={editMode ? "編集中" : "編集"}><Icon name="edit" /></button>
              ) : (
                <button onClick={() => setSearchOpen((v) => !v)} style={{ ...roundBtn, background: searchOpen ? "var(--accent, #5b5bd6)" : (mapDark ? "rgba(20,26,36,0.8)" : "#fff"), color: searchOpen ? "#fff" : "var(--accent, #5b5bd6)", border: "1px solid " + (mapDark ? "rgba(255,255,255,0.12)" : "var(--border, #e9edf2)") }} aria-label="検索"><Icon name="search" /></button>
              )}
            </div>
            {canEdit && <button onClick={() => setSearchOpen((v) => !v)} style={{ ...roundBtn, position: "absolute", top: 64, right: 10, zIndex: 7, background: searchOpen ? "var(--accent, #5b5bd6)" : (mapDark ? "rgba(20,26,36,0.8)" : "#fff"), color: searchOpen ? "#fff" : "var(--accent, #5b5bd6)", border: "1px solid " + (mapDark ? "rgba(255,255,255,0.12)" : "var(--border, #e9edf2)") }} aria-label="検索"><Icon name="search" /></button>}
            {editable && (
              <div style={{ position: "absolute", top: showTelop ? 96 : 66, left: 10, display: "flex", gap: 8, zIndex: 7 }}>
                <button onClick={startNew} style={{ ...pillBtn, display: "inline-flex", alignItems: "center", gap: 5, background: "#2f9e44", color: "#fff" }}><Icon name="plus" size={18} />新規</button>
                <button onClick={undo} disabled={!undoStack.length || busyHist} style={{ ...pillBtn, width: 46, padding: "10px 0", display: "inline-flex", alignItems: "center", justifyContent: "center", background: mapDark ? "rgba(20,26,36,0.82)" : "#fff", color: "var(--accent, #5b5bd6)", opacity: undoStack.length && !busyHist ? 1 : 0.4 }} aria-label="戻る"><Icon name="undo" size={18} /></button>
                <button onClick={redo} disabled={!redoStack.length || busyHist} style={{ ...pillBtn, width: 46, padding: "10px 0", display: "inline-flex", alignItems: "center", justifyContent: "center", background: mapDark ? "rgba(20,26,36,0.82)" : "#fff", color: "var(--accent, #5b5bd6)", opacity: redoStack.length && !busyHist ? 1 : 0.4 }} aria-label="進む"><Icon name="redo" size={18} /></button>
              </div>
            )}
          </>
        )}
        {!isMobile && <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 11, color: mapDark ? "#aeb8c8" : "#64748b", background: mapDark ? "rgba(18,24,34,0.6)" : "rgba(255,255,255,0.85)", border: "1px solid " + (mapDark ? "rgba(255,255,255,0.10)" : "var(--border, #e9edf2)"), padding: "4px 10px", borderRadius: 999, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>ドラッグで移動 / ホイールで拡大縮小{editable ? " / クリックで選択・空きで新規" : ""}</div>}
        <div style={{ position: "absolute", bottom: 10, right: 12, fontSize: 11, fontWeight: 700, color: mapDark ? "#cdd6e3" : "#475063", background: mapDark ? "rgba(18,24,34,0.7)" : "rgba(255,255,255,0.9)", border: "1px solid " + (mapDark ? "rgba(255,255,255,0.12)" : "var(--border, #e9edf2)"), padding: "4px 10px", borderRadius: 999, zIndex: 4, pointerEvents: "none", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", boxShadow: "0 1px 4px rgba(15,23,42,0.08)" }}>ズーム {Math.round(zoom * 100)}%</div>
        {myCityId != null && <button onClick={recenter} aria-label="自分の都市へ" style={{ position: "absolute", right: 12, bottom: 40, zIndex: 7, width: 42, height: 42, borderRadius: 21, border: "1px solid " + (mapDark ? "rgba(255,255,255,0.12)" : "var(--border, #e9edf2)"), background: mapDark ? "rgba(20,26,36,0.78)" : "#fff", boxShadow: "0 3px 12px rgba(15,23,42,0.18)", color: "var(--accent, #5b5bd6)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}><Icon name="star" size={18} /></button>}
        {loading && (
          <div style={{ position: "absolute", inset: 0, zIndex: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, background: "radial-gradient(120% 120% at 50% 0%, #f3f8ff 0%, #eef3fb 45%, #e9eef6 100%)" }}>
            <div style={{ position: "relative", width: 76, height: 76 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 90deg, #2563eb, #60a5fa, #bfdbfe, #2563eb)", WebkitMask: "radial-gradient(farthest-side, #0000 calc(100% - 8px), #000 0)", mask: "radial-gradient(farthest-side, #0000 calc(100% - 8px), #000 0)", animation: "snwspin 0.9s linear infinite" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ background: "linear-gradient(135deg,#1e3a8a,#2563eb)", color: "#fff", padding: "5px 10px", borderRadius: 9, fontWeight: 800, fontSize: 13, letterSpacing: "0.08em", boxShadow: "0 4px 12px rgba(37,99,235,0.35)" }}>{aAbbr}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#334155", letterSpacing: "0.14em" }}>読み込み中</span>
              <span style={{ display: "flex", gap: 5 }}>
                {[0, 1, 2].map((i) => (<span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#2563eb", animation: "snwbounce 1s ease-in-out infinite", animationDelay: i * 0.16 + "s" }} />))}
              </span>
            </div>
          </div>
        )}
        {editable && panelInitial && !panelCollapsed && (<div style={isMobile ? { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "84vh", overflow: "auto", boxShadow: "0 -8px 28px rgba(0,0,0,0.28)", borderTopLeftRadius: 16, borderTopRightRadius: 16, animation: "snwsheet 0.22s ease-out", zIndex: 9 } : { position: "absolute", top: 12, right: 12, width: 340, maxWidth: "calc(100% - 24px)", maxHeight: "calc(100% - 24px)", overflow: "auto", boxShadow: "0 8px 28px rgba(0,0,0,0.22)", borderRadius: 10, zIndex: 9 }}><ObjectEditPanel key={panelKey} initial={panelInitial} others={objects} onSave={saveObject} onDelete={removeObject} onClose={closePanel} onDraftMove={draft && draft.id == null ? moveDraft : undefined} onCollapse={() => setPanelCollapsed(true)} onDuplicate={duplicateObject} /></div>)}
        {editable && panelInitial && panelCollapsed && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "#fff", boxShadow: "0 -4px 18px rgba(0,0,0,0.2)", padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, zIndex: 9 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{panelInitial.label || panelInitial.memberName || (panelInitial.id == null ? "新規オブジェクト" : "オブジェクト")}</div>
              <div style={{ fontSize: 11.5, color: "#868e96" }}>X:{panelInitial.anchorX} Y:{panelInitial.anchorY}　矢印/ドラッグで調整</div>
            </div>
            <button onClick={() => setPanelCollapsed(false)} style={{ ...fabBtn, background: "var(--accent, #1971c2)", color: "#fff", border: "none" }}>▲ 詳細を編集</button>
            <button onClick={closePanel} style={{ ...fabBtn, background: "#2f9e44", color: "#fff", border: "none" }}>✓ 完了</button>
          </div>
        )}
        {overlapMsg && (<div style={{ position: "absolute", left: "50%", top: "42%", transform: "translate(-50%,-50%)", background: "#d6336c", color: "#fff", padding: "12px 18px", borderRadius: 12, fontSize: 13.5, fontWeight: 700, boxShadow: "0 6px 22px rgba(0,0,0,0.32)", zIndex: 11, maxWidth: "88%", textAlign: "center", lineHeight: 1.4 }}>⚠ {overlapMsg}</div>)}
        {toast && (<div style={{ position: "absolute", left: "50%", top: isMobile ? 70 : 14, transform: "translateX(-50%)", background: "#2f9e44", color: "#fff", padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 12, boxShadow: "0 4px 14px rgba(0,0,0,0.22)", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="check" size={15} />{toast}</div>)}
        {editable && pendingSpot && !draft && (<button onClick={startNew} style={{ position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)", background: "#2f9e44", color: "#fff", padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 8, boxShadow: "0 4px 14px rgba(0,0,0,0.25)", textAlign: "center", maxWidth: "90%", border: "none", cursor: "pointer" }}>＋ ここをタップ、または「新規」で追加</button>)}
        {!editable && selectedObj && (<ObjectInfoSheet key={selectedObj.id} obj={selectedObj} music={music} onClose={() => setSelectedId(null)} onPlay={setPlayerItem} onSuggest={requestSuggest} dock={!isMobile} dark={mapDark} isMyCity={myCityId === selectedObj.id} onSetMyCity={() => setMyCity(myCityId === selectedObj.id ? null : (selectedObj.id ?? null))} canEdit={canEdit} onEdit={() => setEditMode(true)} />)}
        {playerItem && <MusicPlayerModal item={playerItem} onClose={() => setPlayerItem(null)} />}
        {suggestObj && <SuggestModal obj={suggestObj} onClose={() => setSuggestObj(null)} onDone={() => { setSuggestObj(null); setToast("提案を送信しました"); }} />}
        {searchOpen && (
          <div style={{ position: "absolute", top: isMobile ? 64 : 56, left: "50%", transform: "translateX(-50%)", width: "min(92%, 360px)", background: "#fff", borderRadius: 12, boxShadow: "0 8px 28px rgba(0,0,0,0.28)", zIndex: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 8, padding: 10, borderBottom: "1px solid #eee" }}>
              <input autoFocus value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="都市名で検索（あいまい可）" style={{ flex: 1, padding: "9px 11px", border: "1px solid #ced4da", borderRadius: 8, fontSize: 15, boxSizing: "border-box" }} />
              <button onClick={() => { setSearchOpen(false); setSearchQ(""); }} aria-label="閉じる" style={{ border: "none", background: "#f1f3f5", borderRadius: 8, padding: "0 12px", cursor: "pointer", color: "#868e96", display: "inline-flex", alignItems: "center" }}><Icon name="close" size={16} /></button>
            </div>
            <div style={{ maxHeight: 280, overflow: "auto" }}>
              {searchResults.length === 0 ? <div style={{ padding: 14, color: "#868e96", fontSize: 13 }}>該当する都市がありません</div> : searchResults.map((c) => (
                <button key={c.id} onClick={() => doSearchSelect(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "10px 14px", border: "none", borderBottom: "1px solid #f1f3f5", background: "#fff", fontSize: 14, cursor: "pointer" }}><FcBadge fc={c.fcLevel} fallback={<span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: "50%", background: "#e9ecef", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#adb5bd" }}>-</span>} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span></button>
              ))}
            </div>
          </div>
        )}
        {isMobile && <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} path="/" me={me} abbr={aAbbr} maps={maps} mapId={mapId} isOwner={isOwner} canEdit={canEdit} cityChoices={cityChoices} myCityId={myCityId} onSelectMyCity={setMyCity} onSwitchMap={switchMap} onAddMap={addMap} onRenameMap={renameMap} onRemoveMap={removeMap} showTelop={showTelop} onToggleTelop={toggleTelop} mapDark={mapDark} onToggleMapDark={toggleMapDark} />}
      </div>
      <style>{"@keyframes snwspin{to{transform:rotate(360deg)}}@keyframes snwpulse{0%,100%{opacity:.55;transform:translate(-50%,-50%) scale(.92)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}}@keyframes snwsheet{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes snwfade{from{opacity:0}to{opacity:1}}@keyframes snwdrawer{from{transform:translateX(-100%)}to{transform:translateX(0)}}@keyframes snwbounce{0%,80%,100%{transform:translateY(0);opacity:.45}40%{transform:translateY(-7px);opacity:1}}"}</style>
    </div>
  );
}
