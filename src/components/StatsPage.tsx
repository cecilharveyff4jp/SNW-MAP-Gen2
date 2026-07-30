import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listObjects, listMaps, listMusic, updateObject, deleteObject, listPowerHistory, updatePowerHistory, deletePowerHistory, notifyBulkPower, type MusicItem, type ObjectInput, type PowerPoint } from "../lib/api";
import { card, btnGhost } from "../lib/styles";
import { confirmDelete } from "../lib/confirm";
import { useDialog } from "./Dialog";
import FcBadge from "./FcBadge";
import Icon from "./Icon";
import LineChart from "./LineChart";
import ObjectInfoSheet from "./ObjectInfoSheet";
import PowerTrendSheet from "./PowerTrendSheet";
import ObjectEditPanel, { type PanelInitial } from "./ObjectEditPanel";
import MusicPlayerModal from "./MusicPlayerModal";
import { fcDisplay, FC_LEVELS } from "../lib/sizes";
import { birthdayMonth, parseBirthday } from "../lib/birthday";
import type { MapObject, ObjectType } from "../lib/types";

const TYPE_LABEL: Record<ObjectType, string> = { HQ: "本部", CITY: "都市", STATUE: "同盟建造物", DEPOT: "同盟資材", BEAR_TRAP: "熊罠", MOUNTAIN: "山", LAKE: "湖", FLAG: "旗", OTHER: "その他" };
const TYPE_ORDER: ObjectType[] = ["HQ", "CITY", "STATUE", "DEPOT", "BEAR_TRAP", "MOUNTAIN", "LAKE", "FLAG", "OTHER"];
const BLANK = new Set(["空き", "空白", "空", "-", "ー", "―", "なし"]);

// 戦力など大きな数を K / M / B に短縮（例: 1234567 → 1.23M）。列幅を取らず名前スペースを確保。
function compactNum(n: number): string {
  if (n < 1000) return String(n);
  const [v, u] = n >= 1e9 ? [1e9, "B"] : n >= 1e6 ? [1e6, "M"] : [1e3, "K"];
  const x = n / v;
  const d = x >= 100 ? 0 : x >= 10 ? 1 : 2;
  return parseFloat(x.toFixed(d)) + u;
}

// ランキング行の極小スパークライン（一覧のままでも勢いが分かるように・依存なしSVG）。
function Spark({ points }: { points: { t: number; v: number }[] }) {
  if (points.length < 2) return <svg width={34} height={16} style={{ flexShrink: 0 }} />;
  const xs = points.map((p) => p.t), ys = points.map((p) => p.v);
  const mnT = Math.min(...xs), mxT = Math.max(...xs), mn = Math.min(...ys), mx = Math.max(...ys);
  const sx = (t: number) => 2 + (mxT === mnT ? 0.5 : (t - mnT) / (mxT - mnT)) * 30;
  const sy = (v: number) => 14 - ((v - mn) / ((mx - mn) || 1)) * 12;
  const d = points.map((p, i) => (i ? "L" : "M") + sx(p.t).toFixed(1) + " " + sy(p.v).toFixed(1)).join(" ");
  const up = ys[ys.length - 1] >= ys[0];
  return (<svg width={34} height={16} viewBox="0 0 34 16" style={{ flexShrink: 0, opacity: 0.85 }}><path d={d} fill="none" stroke={up ? "var(--accent, #5b5bd6)" : "#e8590c"} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" /></svg>);
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border, #e3e8ef)", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ fontSize: 12, color: "#7a8699", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--accent-strong, #4b3fc4)", lineHeight: 1.1, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function StatsPage({ canEdit }: { canEdit: boolean }) {
  const dlg = useDialog();
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [mapCount, setMapCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openLv, setOpenLv] = useState<string | null>(null);
  const [fcShowLow, setFcShowLow] = useState(false);
  const [sortMode, setSortMode] = useState<"pd" | "pa" | "dn" | "do">("pd"); // 総力↓/総力↑/更新新しい/更新古い
  const [editPower, setEditPower] = useState(false);
  const bulkCountRef = useRef(0); // この編集セッションで総力を更新した都市数
  const [vals, setVals] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [editOrder, setEditOrder] = useState<number[]>([]);
  const [perr, setPerr] = useState<string | null>(null);
  const [music, setMusic] = useState<MusicItem[]>([]);
  const [infoObj, setInfoObj] = useState<MapObject | null>(null);
  const [trendCity, setTrendCity] = useState<number | null>(null); // 総力ランキング行タップで開く推移シート
  const [fcDrag, setFcDrag] = useState<{ fromLv: string } | null>(null); // 大溶鉱炉レベルのチップをドラッグ中（編集者）
  const [dropLv, setDropLv] = useState<string | null>(null); // ドラッグ中にホバーしているレベル
  const fcPressRef = useRef<{ id: number; name: string; fromLv: string; x: number; y: number; lastX: number; lastY: number; active: boolean; timer: number; onMove: (e: PointerEvent) => void; onUp: () => void } | null>(null);
  const fcCloneRef = useRef<HTMLDivElement | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [playerItem, setPlayerItem] = useState<MusicItem | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calY, setCalY] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calSelDay, setCalSelDay] = useState<number | null>(null);
  const [history, setHistory] = useState<PowerPoint[]>([]);
  const [histCity, setHistCity] = useState<number | null>(() => { try { const v = localStorage.getItem("snw_hist_city") ?? localStorage.getItem("snw_my_city"); return v ? Number(v) : null; } catch { return null; } }); // 既定は前回選択→自分の都市
  const [histShowAll, setHistShowAll] = useState(false); // 履歴一覧を全件表示するか
  const [swOpen, setSwOpen] = useState<{ id: number; side: "edit" | "del" } | null>(null); // スワイプで開いている行
  const [touch] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches); // スマホ等
  const swipeRef = useRef<{ id: number; x: number; y: number; done: boolean } | null>(null);

  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 1800); return () => window.clearTimeout(t); }, [toast]);
  // アンマウント時にドラッグのwindowリスナー/フロートを後片付け
  useEffect(() => () => { const p = fcPressRef.current; if (p) { window.removeEventListener("pointermove", p.onMove); window.removeEventListener("pointerup", p.onUp); window.clearTimeout(p.timer); } if (fcCloneRef.current) { fcCloneRef.current.remove(); fcCloneRef.current = null; } }, []);

  const reloadHistory = () => { listPowerHistory().then((h) => setHistory(Array.isArray(h) ? h : [])).catch(() => { /* noop */ }); };

  useEffect(() => {
    (async () => {
      try {
        const [objs, maps, mus, hist] = await Promise.all([listObjects(), listMaps(), listMusic(), listPowerHistory().catch(() => [])]);
        setObjects(Array.isArray(objs) ? objs : []);
        setMapCount(maps.length);
        setMusic(Array.isArray(mus) ? mus : []);
        setHistory(Array.isArray(hist) ? hist : []);
      } catch { /* noop */ } finally { setLoading(false); }
    })();
  }, []);

  // 編集モードに入る/並び替えを変えた時だけ並び順を固定（保存中に行が動かないように）。
  useEffect(() => {
    if (!editPower) { setVals({}); return; }
    const rows = objects.filter((o) => o.type === "CITY" && o.id != null).map((o) => ({ id: o.id as number, power: o.power ?? 0 }));
    rows.sort((a, b) => (sortMode === "pa" ? a.power - b.power : b.power - a.power));
    setEditOrder(rows.map((r) => r.id));
    // objects への依存は意図的に外す（保存で並びが動かないように固定）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPower, sortMode]);

  if (loading) return <div style={card}>読み込み中…</div>;

  const goToObject = (id?: number) => { if (id == null) return; const o = objects.find((x) => x.id === id); if (o) { setInfoObj(o); setEditMode(false); } };
  const clickable = { cursor: "pointer" } as const;

  // チップをタップ → 参照シート（マップと同じ）。編集者はシート内「編集」から編集パネルへ。
  const placedObjects = objects.filter((o) => o.placed !== 0);
  const toInitial = (o: MapObject): PanelInitial => ({ id: o.id, type: o.type, anchorX: o.anchorX, anchorY: o.anchorY, w: o.w, h: o.h, label: o.label, memberName: o.memberName, gameId: o.gameId, fcLevel: o.fcLevel, power: o.power, placed: o.placed, note: o.note, birthday: o.birthday, musicIds: o.musicIds });
  const closeOverlay = () => { setInfoObj(null); setEditMode(false); };
  const reload = async () => { const objs = await listObjects(); setObjects(Array.isArray(objs) ? objs : []); };
  const saveFromStats = async (payload: ObjectInput, id?: number) => { if (id == null) return; await updateObject(id, { ...payload, placed: infoObj?.placed }); await reload(); closeOverlay(); setToast("保存しました"); };
  const delFromStats = async (id: number) => { await deleteObject(id); await reload(); closeOverlay(); setToast("削除しました"); };

  const cities = objects.filter((o) => o.type === "CITY");
  const byType = TYPE_ORDER.map((t) => ({ t, n: objects.filter((o) => o.type === t).length })).filter((x) => x.n > 0);

  const levelNames = new Map<string, { id?: number; name: string }[]>();
  for (const c of cities) {
    if (!c.fcLevel) continue;
    const nm = (c.label || c.memberName || "").trim();
    const arr = levelNames.get(c.fcLevel) ?? [];
    arr.push({ id: c.id, name: nm && !BLANK.has(nm) ? nm : "（無名）" });
    levelNames.set(c.fcLevel, arr);
  }
  const lvKey = (lv: string) => (/^\d+$/.test(lv) ? parseInt(lv, 10) : 100 + parseInt(lv.replace("FC", ""), 10));
  const fcSorted = [...levelNames.entries()].map(([lv, names]) => ({ lv, names, n: names.length })).sort((a, b) => lvKey(b.lv) - lvKey(a.lv));
  const maxN = Math.max(1, ...fcSorted.map((x) => x.n));
  const fcTotal = fcSorted.reduce((s, x) => s + x.n, 0);
  const fcHigh = fcSorted.filter((x) => lvKey(x.lv) >= 101); // FC1以上
  const fcLow = fcSorted.filter((x) => lvKey(x.lv) < 101);   // FC未満（Lv1〜30）
  // ---- 大溶鉱炉レベル: チップ長押し→別レベル行へドラッグして変更（編集者のみ） ----
  // 現在レベルの前後2段のうち「まだ0人」のレベル（ドラッグ中だけ点線行で出す）。
  const neighborEmpties = (lv: string): string[] => {
    const i = FC_LEVELS.indexOf(lv);
    if (i < 0) return [];
    const out: string[] = [];
    for (let d = -2; d <= 2; d++) { if (d === 0) continue; const j = i + d; if (j < 0 || j >= FC_LEVELS.length) continue; const nlv = FC_LEVELS[j]; if (!levelNames.has(nlv)) out.push(nlv); }
    return out;
  };
  const moveFcClone = (x: number, y: number) => { const el = fcCloneRef.current; if (el) { el.style.left = x + "px"; el.style.top = y + "px"; } };
  const fcLevelAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const row = el?.closest?.("[data-fclv]") as HTMLElement | null;
    return row ? row.getAttribute("data-fclv") : null;
  };
  const endFcDrag = () => { if (fcCloneRef.current) { fcCloneRef.current.remove(); fcCloneRef.current = null; } setFcDrag(null); setDropLv(null); };
  const applyFcChange = async (id: number, name: string, fromLv: string, toLv: string) => {
    const ok = await dlg.confirm({ title: "溶鉱炉レベルの変更", message: name + " のレベルを " + fcDisplay(fromLv) + " → " + fcDisplay(toLv) + " に変更します。よろしいですか？\n（この変更は操作履歴にも記録されます）", okLabel: "変更する" });
    if (!ok) return;
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    try {
      await updateObject(id, { ...obj, fcLevel: toLv });
      setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, fcLevel: toLv } : o)));
      setOpenLv(toLv);
      setToast(name + " を " + fcDisplay(toLv) + " に変更しました");
    } catch (e) { await dlg.alert({ title: "変更に失敗しました", message: String((e as Error).message || e) }); }
  };
  const startFcDrag = (e: { clientX: number; clientY: number }, id: number, name: string, fromLv: string) => {
    if (!canEdit) return;
    const press = { id, name, fromLv, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, active: false, timer: 0, onMove: (() => {}) as (ev: PointerEvent) => void, onUp: (() => {}) };
    const onMove = (ev: PointerEvent) => {
      press.lastX = ev.clientX; press.lastY = ev.clientY;
      if (!press.active) { if (Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > 12) { window.clearTimeout(press.timer); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); fcPressRef.current = null; } return; }
      moveFcClone(ev.clientX, ev.clientY);
      setDropLv(fcLevelAt(ev.clientX, ev.clientY));
    };
    const onUp = () => {
      window.clearTimeout(press.timer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const wasActive = press.active; const tx = press.lastX, ty = press.lastY;
      fcPressRef.current = null;
      if (!wasActive) { goToObject(id); return; } // タップ＝カードを開く
      const target = fcLevelAt(tx, ty);
      endFcDrag();
      if (target && target !== fromLv) applyFcChange(id, name, fromLv, target);
    };
    press.onMove = onMove; press.onUp = onUp;
    fcPressRef.current = press;
    press.timer = window.setTimeout(() => {
      if (fcPressRef.current !== press) return;
      press.active = true;
      setFcDrag({ fromLv });
      const el = document.createElement("div");
      el.textContent = name;
      el.style.cssText = "position:fixed;left:-999px;top:-999px;z-index:3000;pointer-events:none;transform:translate(-50%,-50%) scale(1.06) rotate(-2deg);background:#fff;border:1px solid #5b5bd6;color:#4b3fc4;border-radius:20px;padding:6px 12px;font-size:13px;font-weight:700;box-shadow:0 10px 24px rgba(0,0,0,0.28)";
      document.body.appendChild(el); fcCloneRef.current = el;
      moveFcClone(press.lastX, press.lastY);
      try { navigator.vibrate?.(10); } catch { /* noop */ }
    }, 320);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const fcRow = ({ lv, names, n, temp = false }: { lv: string; names: { id?: number; name: string }[]; n: number; temp?: boolean }) => {
    const open = openLv === lv && !temp;
    const dragging = fcDrag != null;
    const isCur = dragging && fcDrag!.fromLv === lv;
    const isDrop = dragging && dropLv === lv && !isCur;
    const bColor = isDrop ? "var(--accent, #5b5bd6)" : temp ? "#d7d9ee" : open ? "var(--accent, #5b5bd6)" : "var(--border, #eceff3)";
    return (
      <div key={lv} data-fclv={lv} style={{ border: (temp ? "1px dashed " : "1px solid ") + bColor, borderRadius: 12, overflow: "hidden", boxShadow: isDrop ? "0 0 0 3px rgba(91,91,214,0.22)" : undefined, background: isDrop ? "var(--accent-soft, #ededfc)" : temp ? "#fbfbfe" : undefined, opacity: isCur ? 0.5 : 1, transition: "border-color .12s, box-shadow .12s, background .12s, opacity .12s" }}>
        {temp ? (
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px" }}>
            <FcBadge fc={lv} imgSize={26} circleSize={22} />
            <span style={{ flex: 1, fontSize: 12.5, color: "#9aa2b1", fontWeight: 600 }}>まだ0人</span>
            <span style={{ color: "var(--accent, #5b5bd6)", fontWeight: 800, fontSize: 15 }}>＋</span>
          </div>
        ) : (
          <button onClick={() => { if (!dragging) setOpenLv(open ? null : lv); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", border: "none", background: isDrop ? "transparent" : open ? "var(--accent-soft, #ededfc)" : "#fff", cursor: dragging ? "default" : "pointer" }}>
            <FcBadge fc={lv} imgSize={26} circleSize={22} />
            <div style={{ flex: 1, height: 9, background: "#f1f3f5", borderRadius: 5, overflow: "hidden" }}><div style={{ width: Math.round((n / maxN) * 100) + "%", height: "100%", background: "linear-gradient(90deg, var(--accent, #5b5bd6), var(--accent-strong, #4b3fc4))" }} /></div>
            <span style={{ fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: "right", color: "var(--accent-strong, #4b3fc4)" }}>{n}</span>
            {isCur ? <span style={{ fontSize: 10.5, fontWeight: 800, color: "#adb5bd", background: "#eef0f4", padding: "2px 8px", borderRadius: 999 }}>現在</span> : <span style={{ color: "#adb5bd", fontSize: 11 }}>{open ? "▲" : "▼"}</span>}
          </button>
        )}
        {open && (
          <div style={{ padding: "4px 14px 13px", display: "flex", flexWrap: "wrap", gap: 6, background: "var(--accent-soft, #ededfc)" }}>
            {[...names].sort((a, b) => a.name.localeCompare(b.name)).map((nm, i) => {
              const draggable = canEdit && nm.id != null;
              return (
                <span key={i}
                  onPointerDown={draggable ? (ev) => startFcDrag(ev, nm.id as number, nm.name, lv) : undefined}
                  onClick={() => { if (!canEdit) goToObject(nm.id); }}
                  style={{ fontSize: 13, padding: "6px 12px", background: "#fff", border: "1px solid var(--border, #e3e8ef)", borderRadius: 20, color: "var(--accent-strong, #4b3fc4)", fontWeight: 600, cursor: draggable ? "grab" : "pointer", touchAction: draggable ? "none" : undefined, userSelect: "none", WebkitUserSelect: "none" }}>{nm.name}</span>
              );
            })}
          </div>
        )}
      </div>
    );
  };
  // ドラッグ中に描画する行（全レベル＋前後2段の空きレベルを降順で）
  const fcRowsDuringDrag = fcDrag ? [
    ...fcSorted.map((x) => ({ ...x, temp: false })),
    ...neighborEmpties(fcDrag.fromLv).map((lv) => ({ lv, names: [] as { id?: number; name: string }[], n: 0, temp: true })),
  ].sort((a, b) => lvKey(b.lv) - lvKey(a.lv)) : [];

  const TERRAIN: ObjectType[] = ["MOUNTAIN", "LAKE", "FLAG"];
  const named = objects.map((o) => ({ ...o, _name: (o.label || o.memberName || "").trim() })).filter((o) => o._name && !BLANK.has(o._name) && !TERRAIN.includes(o.type));
  const members = named.sort((a, b) => a._name.localeCompare(b._name));

  const cityRows = cities.filter((c) => c.id != null).map((c) => ({ id: c.id as number, name: ((c.label || c.memberName || "").trim()) || "（無名）", power: c.power ?? 0, fc: c.fcLevel }));
  const poweredCount = cityRows.filter((c) => c.power > 0).length;
  const maxPower = Math.max(1, ...cityRows.map((x) => x.power));

  // ---- 総力の推移（履歴） ----
  const parseTs = (s: string) => Date.parse(s.replace(" ", "T") + (s.includes("Z") ? "" : "Z"));
  const cityName = (oid: number) => { const o = objects.find((x) => x.id === oid); return ((o?.label || o?.memberName || "").trim()) || ("都市#" + oid); };
  const histRecs = history.map((h) => ({ id: h.id, obj: h.objectId, t: parseTs(h.recordedAt), v: h.power, source: h.source, at: h.recordedAt })).filter((r) => Number.isFinite(r.t));
  const cityHist = new Map<number, { t: number; v: number }[]>();
  for (const r of [...histRecs].sort((a, b) => a.t - b.t)) { const arr = cityHist.get(r.obj) ?? []; arr.push({ t: r.t, v: r.v }); cityHist.set(r.obj, arr); }
  // 各都市の最終更新日時（履歴の最新記録）
  const lastAt = new Map<number, number>();
  for (const [oid, arr] of cityHist) { if (arr.length) lastAt.set(oid, arr[arr.length - 1].t); }
  const fmtWhen = (t: number) => new Date(t).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const powerList = [...cityRows].filter((c) => c.power > 0).sort((a, b) => {
    if (sortMode === "pd") return b.power - a.power;
    if (sortMode === "pa") return a.power - b.power;
    const ta = lastAt.get(a.id) ?? 0, tb = lastAt.get(b.id) ?? 0; // 未記録は0＝いちばん古い扱い
    return sortMode === "dn" ? tb - ta : ta - tb;
  });
  const ymd = (t: number) => { const d = new Date(t); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
  const dayMs = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime(); };
  const dayTotals: { t: number; v: number }[] = [];
  { const latest = new Map<number, number>(); let cur = ""; let curT = 0;
    for (const r of [...histRecs].sort((a, b) => a.t - b.t)) {
      const day = ymd(r.t);
      if (cur && day !== cur) dayTotals.push({ t: dayMs(curT), v: [...latest.values()].reduce((s, x) => s + x, 0) });
      latest.set(r.obj, r.v); cur = day; curT = r.t;
    }
    if (cur) dayTotals.push({ t: dayMs(curT), v: [...latest.values()].reduce((s, x) => s + x, 0) });
  }
  // 同盟平均の推移（更新のあった日ごと・その時点で記録のある都市の平均）。推移シートの「同盟平均」比較で使用。
  const dayAvgs: { t: number; v: number }[] = [];
  { const latest = new Map<number, number>(); let cur = ""; let curT = 0;
    for (const r of [...histRecs].sort((a, b) => a.t - b.t)) {
      const day = ymd(r.t);
      if (cur && day !== cur) { const vals = [...latest.values()]; dayAvgs.push({ t: dayMs(curT), v: Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) }); }
      latest.set(r.obj, r.v); cur = day; curT = r.t;
    }
    if (cur) { const vals = [...latest.values()]; dayAvgs.push({ t: dayMs(curT), v: Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) }); }
  }
  const histCityIds = [...cityHist.keys()].sort((a, b) => cityName(a).localeCompare(cityName(b)));
  const selCity = histCity != null && cityHist.has(histCity) ? histCity : null;
  const selPoints = selCity != null ? (cityHist.get(selCity) ?? []) : [];
  const selRecs = selCity != null ? histRecs.filter((r) => r.obj === selCity).sort((a, b) => b.t - a.t) : [];
  // 同盟全体（合計）の直近7日の伸び。7日ぶんの記録が無ければ全期間にフォールバック。
  const allyTotal = dayTotals.length ? dayTotals[dayTotals.length - 1].v : 0;
  let allyBaseV = dayTotals.length ? dayTotals[0].v : 0;
  let allyUse7 = false;
  if (dayTotals.length) {
    const cutoff = dayTotals[dayTotals.length - 1].t - 7 * 86400000;
    for (let i = dayTotals.length - 1; i >= 0; i--) { if (dayTotals[i].t <= cutoff) { allyBaseV = dayTotals[i].v; allyUse7 = true; break; } }
  }
  const allyDelta = allyTotal - allyBaseV;
  const recCityCount = cityHist.size; // 記録のある都市数
  const allyAvg = recCityCount ? Math.round(allyTotal / recCityCount) : 0;
  const delHist = async (id: number) => { if (!(await confirmDelete(dlg, "履歴"))) return; try { await deletePowerHistory(id); reloadHistory(); } catch (e) { setPerr(String((e as Error).message || e)); } };
  // スワイプ検出（縦が優勢なら無視＝スクロール優先）。右=修正/左=削除を開く。
  const swStart = (e: { clientX: number; clientY: number }, id: number) => { swipeRef.current = { id, x: e.clientX, y: e.clientY, done: false }; };
  const swMove = (e: { clientX: number; clientY: number }, id: number) => {
    const s = swipeRef.current; if (!s || s.id !== id || s.done) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dy) > Math.abs(dx)) { if (Math.abs(dy) > 8) swipeRef.current = null; return; }
    if (dx > 30) { setSwOpen({ id, side: "edit" }); s.done = true; }
    else if (dx < -30) { setSwOpen({ id, side: "del" }); s.done = true; }
  };
  const swEnd = () => { swipeRef.current = null; };
  const editHist = async (r: { id: number; v: number }) => {
    const s = await dlg.prompt({ title: "総力を修正", defaultValue: String(r.v), okLabel: "保存", placeholder: "数字" });
    if (s == null) return;
    const digits = s.replace(/[^0-9]/g, "");
    if (!digits) return;
    try { await updatePowerHistory(r.id, { power: Number(digits) }); reloadHistory(); } catch (e) { setPerr(String((e as Error).message || e)); }
  };
  const totalPower = cityRows.reduce((s, x) => s + x.power, 0);

  async function saveRow(id: number) {
    if (vals[id] === undefined) return; // 触っていない（入力していない）セルは保存しない＝空欄上書きを防ぐ
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    const digits = (vals[id] ?? "").replace(/[^0-9]/g, "");
    const newPower = digits === "" ? undefined : Number(digits);
    if ((obj.power ?? undefined) === newPower) { setVals((v) => { const n = { ...v }; delete n[id]; return n; }); return; }
    setSavingId(id); setPerr(null);
    try {
      const input = { ...obj, power: newPower };
      await updateObject(id, input);
      setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, power: newPower } : o)));
      setVals((v) => { const n = { ...v }; delete n[id]; return n; });
      bulkCountRef.current++;
      setSavedId(id); window.setTimeout(() => setSavedId((s) => (s === id ? null : s)), 1200);
    } catch (e) { setPerr(String((e as Error).message || e)); }
    finally { setSavingId(null); }
  }

  const now = new Date();
  const curM = now.getMonth() + 1;
  const nextM = curM === 12 ? 1 : curM + 1;
  const bdays = objects.filter((o) => o.birthday).map((o) => { const p = parseBirthday(o.birthday); return { id: o.id, name: o.label || o.memberName || "名前なし", date: o.birthday as string, m: p?.month ?? birthdayMonth(o.birthday), d: p?.day ?? 0 }; });
  const byDay = (mon: number) => { const map = new Map<number, { id?: number; name: string }[]>(); for (const b of bdays) { if (b.m === mon && b.d > 0) { const arr = map.get(b.d) ?? []; arr.push({ id: b.id, name: b.name }); map.set(b.d, arr); } } return map; };
  const bThis = bdays.filter((b) => b.m === curM).sort((a, b) => a.d - b.d);
  const bNext = bdays.filter((b) => b.m === nextM).sort((a, b) => a.d - b.d);
  // 誕生日カレンダー（誕生日自体は年を持たないが、曜日を正しく出すためカレンダーは実在の年月を辿る）
  const calFirstDow = new Date(calY, calMonth - 1, 1).getDay();
  const calDays = new Date(calY, calMonth, 0).getDate();
  const calMap = byDay(calMonth);
  const calSelList = calSelDay ? (calMap.get(calSelDay) ?? []) : [];
  const calToday = { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  const TODAY_RING = "#f59f00"; // 今日＝アンバーの枠リング（誕生日の塗り／ドットと別チャンネル）

  // 誕生日カウントダウン（年なし＝次に来る同じ月日までの日数）
  const _t0 = new Date(now); _t0.setHours(0, 0, 0, 0);
  const bdayUpcoming = bdays.filter((b) => b.m && b.d > 0).map((b) => {
    let dt = new Date(_t0.getFullYear(), (b.m as number) - 1, b.d);
    if (dt.getTime() < _t0.getTime()) dt = new Date(_t0.getFullYear() + 1, (b.m as number) - 1, b.d);
    return { ...b, days: Math.round((dt.getTime() - _t0.getTime()) / 86400000) };
  }).sort((a, b) => a.days - b.days);
  const bdaySoonDays = bdayUpcoming.length ? bdayUpcoming[0].days : null;
  const bdaySoon = bdaySoonDays == null ? [] : bdayUpcoming.filter((u) => u.days === bdaySoonDays);

  // データ整合チェック（重複ゲームID・タイルの重なり）
  const OVERLAP_TYPES = new Set(["CITY", "HQ", "DEPOT", "STATUE", "BEAR_TRAP", "MOUNTAIN", "LAKE"]);
  const rectsOverlap = (a: MapObject, b: MapObject) => a.anchorX < b.anchorX + b.w && a.anchorX + a.w > b.anchorX && a.anchorY < b.anchorY + b.h && a.anchorY + a.h > b.anchorY;
  const gidGroups = new Map<string, MapObject[]>();
  for (const o of objects) { const g = (o.gameId || "").trim(); if (!g) continue; const arr = gidGroups.get(g) ?? []; arr.push(o); gidGroups.set(g, arr); }
  const dupGid = [...gidGroups.entries()].filter(([, a]) => a.length > 1);
  const overlapObjs = objects.filter((o) => o.placed !== 0 && o.id != null && OVERLAP_TYPES.has(o.type));
  const overlapPairs: [MapObject, MapObject][] = [];
  for (let i = 0; i < overlapObjs.length; i++) for (let j = i + 1; j < overlapObjs.length; j++) if (rectsOverlap(overlapObjs[i], overlapObjs[j])) overlapPairs.push([overlapObjs[i], overlapObjs[j]]);
  const integrityCount = dupGid.length + overlapPairs.length;
  const objName = (o: MapObject) => { const n = (o.label || o.memberName || "").trim(); return n && !BLANK.has(n) ? n : (TYPE_LABEL[o.type] || "（無名）"); };

  const bdayCol = (title: string, list: { id?: number; name: string; date: string }[]) => (
    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#7a8699", marginBottom: 8 }}>{title}</div>
      {list.length === 0 ? <div style={{ fontSize: 13, color: "#adb5bd" }}>なし</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {list.map((b, i) => (
            <div key={i} onClick={() => goToObject(b.id)} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, ...clickable }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, background: "var(--accent-soft, #ededfc)", color: "var(--accent, #5b5bd6)", flexShrink: 0 }}><Icon name="gift" size={14} /></span>
              <span style={{ color: "#7a8699", minWidth: 56, flexShrink: 0 }}>{b.date}</span>
              <strong style={{ wordBreak: "break-word", lineHeight: 1.4 }}>{b.name}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 10, marginBottom: 2 }}>
        <Metric label="オブジェクト" value={objects.length} />
        <Metric label="都市" value={cities.length} />
        <Metric label="名前つき" value={members.length} />
        <Metric label="マップ" value={mapCount} />
      </div>
      {byType.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {byType.map(({ t, n }) => (<span key={t} style={{ fontSize: 12, padding: "4px 10px", background: "var(--surface, #fff)", border: "1px solid var(--border, #e9ecef)", borderRadius: 999, color: "#5a6677", fontWeight: 600 }}>{TYPE_LABEL[t]} <strong style={{ color: "#1b2330" }}>{n}</strong></span>))}
        </div>
      )}

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <span style={{ color: "var(--accent, #5b5bd6)", display: "inline-flex" }}><Icon name="chart" size={20} /></span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1b2330" }}>大溶鉱炉レベル</h2>
          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "var(--accent-strong, #4b3fc4)", background: "var(--accent-soft, #ededfc)", padding: "3px 10px", borderRadius: 999 }}>FC設定済 {fcTotal} / 都市 {cities.length}</span>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#7a8699" }}>レベルをタップすると、その都市名が開きます。{canEdit ? "編集者は名前を長押しして別のレベル行へドラッグすると溶鉱炉レベルを変更できます。" : ""}</p>
        {fcSorted.length === 0 ? <p style={{ color: "#868e96" }}>FCレベル未設定</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, touchAction: fcDrag ? "none" : undefined }}>
            {fcDrag ? (
              fcRowsDuringDrag.map(fcRow)
            ) : (
              <>
                {fcHigh.map(fcRow)}
                {fcShowLow && fcLow.map(fcRow)}
                {fcLow.length > 0 && (
                  <button onClick={() => setFcShowLow((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", border: "1px dashed var(--border, #cbd3de)", borderRadius: 10, background: "transparent", color: "var(--accent-strong, #4b3fc4)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {fcShowLow ? "▲ 折りたたむ" : "▼ FC未満のレベルも見る（" + fcLow.length + "段階・" + fcLow.reduce((s, x) => s + x.n, 0) + "都市）"}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ color: "var(--accent, #5b5bd6)", display: "inline-flex" }}><Icon name="chart" size={20} /></span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1b2330" }}>総力ランキング</h2>
          {poweredCount > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-strong, #4b3fc4)", background: "var(--accent-soft, #ededfc)", padding: "3px 10px", borderRadius: 999, fontVariantNumeric: "tabular-nums" }}>{poweredCount}都市・計 {compactNum(totalPower)}</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "pd" | "pa" | "dn" | "do")} style={{ padding: "6px 10px", border: "1px solid var(--border, #d7dee7)", borderRadius: 10, fontSize: 12.5, background: "#fff", color: "#495057", cursor: "pointer" }}>
              <option value="pd">総力 ↓</option>
              <option value="pa">総力 ↑</option>
              <option value="dn">更新が新しい</option>
              <option value="do">更新が古い</option>
            </select>
            {canEdit && <button onClick={() => { if (editPower) { const c = bulkCountRef.current; bulkCountRef.current = 0; if (c >= 2) notifyBulkPower(c); } else { bulkCountRef.current = 0; } setEditPower((v) => !v); }} style={editPower ? { padding: "6px 13px", border: "none", borderRadius: 10, background: "var(--accent, #5b5bd6)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" } : { ...btnGhost, padding: "6px 12px", fontSize: 12.5 }}>{editPower ? "完了" : "編集"}</button>}
          </div>
        </div>
        {perr && <p style={{ color: "#e03131", fontSize: 13, margin: "0 0 8px" }}>{perr}</p>}
        {editPower ? (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#7a8699" }}>数字を直して別の欄へ移ると自動保存。全都市を表示中。</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 480, overflow: "auto" }}>
              {editOrder.map((id) => {
                const c = cityRows.find((r) => r.id === id);
                if (!c) return null;
                const val = vals[id] !== undefined ? vals[id] : (c.power > 0 ? String(c.power) : "");
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 6px" }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13.5, fontWeight: 600, color: "#1b2330" }}>{c.name}{c.fc ? <span style={{ color: "#adb5bd", fontWeight: 400, fontSize: 11.5 }}> · {fcDisplay(c.fc)}</span> : null}</span>
                    <input value={val} inputMode="numeric" pattern="[0-9]*" placeholder="未入力" onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, ""); setVals((v) => ({ ...v, [id]: d })); }} onBlur={() => saveRow(id)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} style={{ width: 132, padding: "7px 10px", border: "1px solid var(--border, #d7dee7)", borderRadius: 8, fontSize: 16, textAlign: "right", boxSizing: "border-box", background: "#fff" }} />
                    <span style={{ width: 18, textAlign: "center", fontSize: 13, fontWeight: 700, color: savingId === id ? "#7a8699" : "#2f9e44" }}>{savingId === id ? "…" : savedId === id ? "✓" : ""}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#7a8699" }}>{sortMode === "pd" ? "総力の高い順" : sortMode === "pa" ? "総力の低い順" : sortMode === "dn" ? "更新の新しい順" : "更新の古い順"}。未入力の都市は表示されません。</p>
            {powerList.length === 0 ? <p style={{ color: "#868e96" }}>総力データはまだありません。{canEdit ? "右上の「編集」から入力できます。" : "編集パネルの「総力」から入力できます。"}</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 460, overflow: "auto" }}>
                {powerList.map((c, i) => (
                  <div key={c.id ?? i} onClick={() => setTrendCity(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, background: i % 2 ? "transparent" : "#fafbfd", ...clickable }}>
                    <span style={{ width: 22, textAlign: "left", fontSize: 12, fontWeight: 700, color: i < 3 ? "var(--accent-strong, #4b3fc4)" : "#adb5bd", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13.5, fontWeight: 600, color: "#1b2330" }}>{c.name}{c.fc ? <span style={{ color: "#adb5bd", fontWeight: 400, fontSize: 11.5 }}> · {fcDisplay(c.fc)}</span> : null}</span>
                    <Spark points={cityHist.get(c.id) ?? []} />
                    <div style={{ width: 46, height: 6, background: "#eef1f5", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}><div style={{ width: Math.round((c.power / maxPower) * 100) + "%", height: "100%", background: "var(--accent, #5b5bd6)" }} /></div>
                    <div style={{ width: 72, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.15 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1b2330", fontVariantNumeric: "tabular-nums" }}>{compactNum(c.power)}</span>
                      {lastAt.has(c.id) && <span style={{ fontSize: 9.5, color: "#c2c8d2", fontVariantNumeric: "tabular-nums", marginTop: 1 }}>{fmtWhen(lastAt.get(c.id) as number)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {history.length > 0 && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ color: "var(--accent, #5b5bd6)", display: "inline-flex" }}><Icon name="chart" size={20} /></span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1b2330" }}>総力の推移</h2>
          </div>
          <div style={{ fontSize: 11.5, color: "#7a8699", fontWeight: 700 }}>同盟の総力合計</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "2px 0 8px" }}>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums", color: "#1b2330" }}>{allyTotal.toLocaleString()}</span>
            {dayTotals.length >= 2 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#3a4557", background: "#eef0f6", padding: "3px 8px", borderRadius: 7 }}>{allyUse7 ? "直近7日" : "全期間"}</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999, color: allyDelta >= 0 ? "#2f9e44" : "#e03131", background: allyDelta >= 0 ? "#e9f8ee" : "#ffece9" }}>{allyDelta >= 0 ? "▲ +" : "▼ -"}{compactNum(Math.abs(allyDelta))}</span>
              </span>
            )}
          </div>
          <LineChart points={dayTotals} fmtY={compactNum} fmtX={(t) => new Date(t).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} />
          <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: "#7a8699", marginTop: 6 }}>
            <span>記録都市数 <strong style={{ color: "#1b2330" }}>{recCityCount}</strong></span>
            <span>1都市あたり平均 <strong style={{ color: "#1b2330" }}>{compactNum(allyAvg)}</strong></span>
          </div>
          {histCityIds.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border, #eef1f5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#33404f" }}>都市別の推移</span>
                <select value={selCity ?? ""} onChange={(e) => { const id = Number(e.target.value) || null; setHistCity(id); setHistShowAll(false); try { if (id != null) localStorage.setItem("snw_hist_city", String(id)); else localStorage.removeItem("snw_hist_city"); } catch { /* noop */ } }} style={{ marginLeft: "auto", padding: "6px 10px", border: "1px solid var(--border, #d7dee7)", borderRadius: 8, fontSize: 14, background: "#fff", maxWidth: "72%" }}>
                  <option value="">（都市を選択）</option>
                  {histCityIds.map((id) => (<option key={id} value={id}>{cityName(id)}</option>))}
                </select>
              </div>
              {selCity == null ? (
                <p style={{ fontSize: 12.5, color: "#adb5bd", margin: "4px 0 2px" }}>都市を選ぶと、その盟主の総力推移と過去の記録が表示されます。ランキングの行タップでも同じ推移＋比較が見られます。</p>
              ) : (
                <>
                  <LineChart points={selPoints} fmtY={compactNum} fmtX={fmtWhen} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 11, marginBottom: 3, fontSize: 12.5, fontWeight: 600, color: "#495057", flexWrap: "wrap" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent, #5b5bd6)", flexShrink: 0 }} />
                    <span>{cityName(selCity)} の記録</span>
                  </div>
                  <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 3, maxHeight: 300, overflow: "auto" }}>
                    {(histShowAll ? selRecs : selRecs.slice(0, 3)).map((r) => {
                      const info = (<>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#7a8699", fontSize: 12 }}>{new Date(r.t).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        <span style={{ width: 96, flexShrink: 0, textAlign: "right", fontWeight: 700, color: "#1b2330", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{r.v.toLocaleString()}</span>
                        <span style={{ width: 28, flexShrink: 0, display: "flex", justifyContent: "center" }}>{r.source === "scrcpy" && <span style={{ fontSize: 9, color: "#aab2bd", background: "rgba(120,134,153,0.1)", padding: "1px 4px", borderRadius: 999, whiteSpace: "nowrap" }}>読取</span>}</span>
                      </>);
                      if (!canEdit) return <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px", fontSize: 13, borderRadius: 6, background: "#fafbfd" }}>{info}</div>;
                      if (!touch) return (
                        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", fontSize: 13, borderRadius: 6, background: "#fafbfd" }}>
                          {info}
                          <button onClick={() => editHist(r)} aria-label="この履歴を修正" title="修正" style={{ width: 30, height: 28, border: "1px solid var(--border, #d7dee7)", background: "#fff", color: "#495057", borderRadius: 8, padding: 0, cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="edit" size={14} /></button>
                          <button onClick={() => delHist(r.id)} aria-label="この履歴を削除" title="削除" style={{ width: 30, height: 28, border: "1px solid #ffc9c9", background: "#fff", color: "#e03131", borderRadius: 8, padding: 0, cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="trash" size={14} /></button>
                        </div>
                      );
                      const side = swOpen && swOpen.id === r.id ? swOpen.side : null;
                      return (
                        <div key={r.id} style={{ position: "relative", overflow: "hidden", borderRadius: 6 }}>
                          <button onClick={() => { setSwOpen(null); editHist(r); }} aria-label="修正" style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 64, border: "none", background: "var(--accent, #5b5bd6)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3 }}><Icon name="edit" size={14} />修正</button>
                          <button onClick={() => { setSwOpen(null); delHist(r.id); }} aria-label="削除" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 64, border: "none", background: "#e03131", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3 }}><Icon name="trash" size={14} />削除</button>
                          <div onPointerDown={(e) => swStart(e, r.id)} onPointerMove={(e) => swMove(e, r.id)} onPointerUp={swEnd} onPointerCancel={swEnd} onClick={() => { if (side) setSwOpen(null); }} style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, padding: "9px 6px", fontSize: 13, background: "#fafbfd", touchAction: "pan-y", transform: side === "edit" ? "translateX(64px)" : side === "del" ? "translateX(-64px)" : "translateX(0)", transition: "transform 0.2s ease" }}>{info}</div>
                        </div>
                      );
                    })}
                  </div>
                  {selRecs.length > 3 && <button onClick={() => setHistShowAll((v) => !v)} style={{ ...btnGhost, width: "100%", marginTop: 6, fontSize: 12.5, justifyContent: "center" }}>{histShowAll ? "折りたたむ" : "他 " + (selRecs.length - 3) + " 件を表示"}</button>}
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
          <span style={{ color: "var(--accent, #5b5bd6)", display: "inline-flex" }}><Icon name="gift" size={20} /></span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1b2330" }}>誕生日</h2>
          <button onClick={() => { const d = new Date(); setCalY(d.getFullYear()); setCalMonth(d.getMonth() + 1); setCalSelDay(null); setCalOpen(true); }} aria-label="誕生日カレンダー" title="カレンダーで見る" style={{ marginLeft: "auto", width: 34, height: 34, borderRadius: 9, border: "1px solid var(--border, #e3e8ef)", background: "#fff", color: "var(--accent, #5b5bd6)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="calendar" size={18} /></button>
        </div>
        {bdaySoon.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", padding: "10px 12px", borderRadius: 12, marginBottom: 12, background: bdaySoonDays === 0 ? "#fff4e6" : "var(--accent-soft, #ededfc)", border: "1px solid " + (bdaySoonDays === 0 ? "#ffd8a8" : "var(--border, #e3e8ef)") }}>
            <span style={{ fontSize: 20 }}>🎂</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: bdaySoonDays === 0 ? "#e8730c" : "var(--accent-strong, #4b3fc4)" }}>{bdaySoonDays === 0 ? "本日お誕生日！" : "次のお誕生日まで あと " + bdaySoonDays + " 日"}</div>
              <div style={{ fontSize: 13.5, marginTop: 2, display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
                {bdaySoon.map((b) => (<span key={b.id} onClick={() => goToObject(b.id)} style={{ ...clickable }}><strong>{b.name}</strong> <span style={{ color: "#868e96", fontSize: 12 }}>{b.date}</span></span>))}
              </div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {bdayCol("今月（" + curM + "月）", bThis)}
          {bdayCol("来月（" + nextM + "月）", bNext)}
        </div>
      </div>

      {calOpen && createPortal(
        <div onClick={() => setCalOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface, #fff)", borderRadius: 16, width: "min(430px, 100%)", maxHeight: "92vh", overflow: "auto", boxShadow: "0 18px 50px rgba(0,0,0,0.32)", padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <button onClick={() => { setCalSelDay(null); if (calMonth === 1) { setCalMonth(12); setCalY(calY - 1); } else setCalMonth(calMonth - 1); }} aria-label="前の月" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--border, #e3e8ef)", background: "#fff", cursor: "pointer", fontSize: 17, color: "#5a6477", lineHeight: 1 }}>‹</button>
              <div style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 700, color: "#1b2330" }}>{calY}年 {calMonth}月</div>
              <button onClick={() => { setCalSelDay(null); if (calMonth === 12) { setCalMonth(1); setCalY(calY + 1); } else setCalMonth(calMonth + 1); }} aria-label="次の月" style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--border, #e3e8ef)", background: "#fff", cursor: "pointer", fontSize: 17, color: "#5a6477", lineHeight: 1 }}>›</button>
              <button onClick={() => setCalOpen(false)} aria-label="閉じる" style={{ width: 34, height: 34, borderRadius: 9, border: "none", background: "#f1f3f5", cursor: "pointer", color: "#868e96", display: "inline-flex", alignItems: "center", justifyContent: "center", marginLeft: 2 }}><Icon name="close" size={16} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
              {["日", "月", "火", "水", "木", "金", "土"].map((w, i) => (
                <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, padding: "2px 0", color: i === 0 ? "#e8590c" : i === 6 ? "#1c7ed6" : "#adb5bd" }}>{w}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {Array.from({ length: calFirstDow }).map((_, i) => <div key={"b" + i} />)}
              {Array.from({ length: calDays }).map((_, i) => {
                const d = i + 1;
                const has = calMap.has(d);
                const sel = calSelDay === d;
                const isToday = calToday.y === calY && calToday.m === calMonth && calToday.d === d;
                return (
                  <button key={d} onClick={() => setCalSelDay(has ? (sel ? null : d) : null)} disabled={!has} title={has ? (calMap.get(d) ?? []).map((x) => x.name).join("、") : undefined}
                    style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 9, border: "1px solid " + (sel ? "var(--accent, #5b5bd6)" : has ? "var(--accent-soft, #d9d9f7)" : "transparent"), background: sel ? "var(--accent, #5b5bd6)" : has ? "var(--accent-soft, #ededfc)" : "transparent", color: sel ? "#fff" : isToday ? "#b45309" : "#33404f", fontSize: 13, fontWeight: has || isToday ? 700 : 500, cursor: has ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: isToday ? "inset 0 0 0 2px " + TODAY_RING : undefined }}>
                    {d}
                    {has && <span style={{ position: "absolute", bottom: 5, left: "50%", transform: "translateX(-50%)", width: 5, height: 5, borderRadius: "50%", background: sel ? "#fff" : "var(--accent, #5b5bd6)" }} />}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 12, minHeight: 40 }}>
              {calSelDay && calSelList.length > 0 ? (
                <div style={{ border: "1px solid var(--border, #eceff3)", borderRadius: 11, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-strong, #4b3fc4)", marginBottom: 6 }}>{calMonth}月{calSelDay}日</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {calSelList.map((x, i) => (
                      <span key={i} onClick={() => { if (x.id != null) { goToObject(x.id); setCalOpen(false); } }} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, padding: "5px 11px", background: "var(--accent-soft, #ededfc)", color: "#33404f", borderRadius: 999, ...(x.id != null ? clickable : {}) }}><Icon name="gift" size={12} />{x.name}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#adb5bd", textAlign: "center", paddingTop: 8 }}>色つきの日をタップすると、その日の誕生日メンバーが出ます。</div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 12, fontSize: 11, color: "#7a8699" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ position: "relative", width: 14, height: 14, borderRadius: 4, background: "var(--accent-soft, #ededfc)" }}><span style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "var(--accent, #5b5bd6)" }} /></span>誕生日</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 14, borderRadius: 4, boxShadow: "inset 0 0 0 2px " + TODAY_RING }} />今日</span>
            </div>
            <div style={{ fontSize: 11, color: "#c1c8d1", textAlign: "center", marginTop: 8 }}>※誕生日は毎年くり返します（登録に年は不要）。前後の月へは ‹ › で移動できます。</div>
          </div>
        </div>,
        document.body
      )}

      <div style={card}>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#1b2330" }}>名前一覧 <span style={{ fontSize: 13, fontWeight: 600, color: "#adb5bd" }}>{members.length}</span></h2>
        {members.length === 0 ? <p style={{ color: "#868e96" }}>名前の登録なし</p> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {members.map((o) => (<span key={o.id} onClick={() => goToObject(o.id)} style={{ fontSize: 13, padding: "5px 11px", background: "#f1f3f5", borderRadius: 999, color: "#33404f", maxWidth: "100%", wordBreak: "break-word", ...clickable }}>{o._name}{o.fcLevel ? " (" + fcDisplay(o.fcLevel) + ")" : ""}</span>))}
          </div>
        )}
      </div>

      {canEdit && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
            <span style={{ color: integrityCount ? "#e8590c" : "#2f9e44", display: "inline-flex" }}><Icon name={integrityCount ? "settings" : "check"} size={20} /></span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1b2330" }}>データ整合チェック</h2>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: integrityCount ? "#e8590c" : "#2f9e44", background: integrityCount ? "#fff4e6" : "#e9f8ee", padding: "3px 10px", borderRadius: 999 }}>{integrityCount ? integrityCount + " 件" : "問題なし"}</span>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#7a8699" }}>同じゲームIDの重複と、タイルが重なっている配置を検出します（名前をタップで開きます）。</p>
          {integrityCount === 0 ? (
            <p style={{ color: "#868e96", fontSize: 13.5 }}>重複ゲームID・重なりは見つかりませんでした。✓</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dupGid.map(([gid, arr]) => (
                <div key={"g" + gid} style={{ border: "1px solid #ffd8a8", borderRadius: 11, padding: "10px 12px", background: "#fffaf5" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "#e8730c", marginBottom: 5 }}>ゲームID重複: {gid}（{arr.length}件）</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {arr.map((o) => (<span key={o.id} onClick={() => goToObject(o.id)} style={{ fontSize: 13, padding: "4px 10px", background: "#fff", border: "1px solid var(--border, #e3e8ef)", borderRadius: 999, ...clickable }}>{objName(o)}</span>))}
                  </div>
                </div>
              ))}
              {overlapPairs.map(([a, b], i) => (
                <div key={"o" + i} style={{ border: "1px solid #ffd8a8", borderRadius: 11, padding: "10px 12px", background: "#fffaf5", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#e8730c" }}>タイル重なり</span>
                  <span onClick={() => goToObject(a.id)} style={{ fontSize: 13, ...clickable }}><strong>{objName(a)}</strong> <span style={{ color: "#adb5bd", fontSize: 11 }}>({a.anchorX},{a.anchorY})</span></span>
                  <span style={{ color: "#adb5bd" }}>×</span>
                  <span onClick={() => goToObject(b.id)} style={{ fontSize: 13, ...clickable }}><strong>{objName(b)}</strong> <span style={{ color: "#adb5bd", fontSize: 11 }}>({b.anchorX},{b.anchorY})</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p style={{ marginTop: 16 }}><a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a></p>

      {createPortal(
        <>
          {infoObj && (
            <div style={{ position: "fixed", inset: 0, zIndex: 1200 }}>
              <div onClick={closeOverlay} style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.4)" }} />
              {editMode && canEdit ? (
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, margin: "0 auto", width: "100%", maxWidth: 480, maxHeight: "92vh", overflow: "auto", padding: "0 12px 12px", boxSizing: "border-box", animation: "snwsheetup 0.22s ease-out" }}>
                  <ObjectEditPanel key={"st" + infoObj.id} initial={toInitial(infoObj)} others={placedObjects} onSave={saveFromStats} onDelete={delFromStats} onClose={closeOverlay} />
                </div>
              ) : (
                <ObjectInfoSheet obj={infoObj} music={music} onClose={closeOverlay} onPlay={setPlayerItem} canEdit={canEdit} onEdit={() => setEditMode(true)} />
              )}
            </div>
          )}
          {trendCity != null && (() => {
            const idx = powerList.findIndex((r) => r.id === trendCity);
            const row = idx >= 0 ? powerList[idx] : null;
            if (!row) return null;
            const cmpList = histCityIds.filter((id) => id !== trendCity).map((id) => ({ id, name: cityName(id) }));
            return (
              <PowerTrendSheet
                city={{ id: row.id, name: row.name, fc: row.fc ? fcDisplay(row.fc) : undefined, rank: idx + 1, current: row.power }}
                points={cityHist.get(trendCity) ?? []}
                cmpList={cmpList}
                getPoints={(id) => cityHist.get(id) ?? []}
                avgPoints={dayAvgs}
                canEdit={canEdit}
                onClose={() => setTrendCity(null)}
                onDetail={() => { const id = trendCity; setTrendCity(null); goToObject(id ?? undefined); }}
                fmtY={compactNum}
                fmtWhen={fmtWhen}
              />
            );
          })()}
          <style>{"@keyframes snwsheetup{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}"}</style>
          {toast && (
            <div style={{ position: "fixed", left: "50%", top: 18, transform: "translateX(-50%)", background: "#2f9e44", color: "#fff", padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, zIndex: 1300, boxShadow: "0 4px 14px rgba(0,0,0,0.22)", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="check" size={15} />{toast}</div>
          )}
          {playerItem && <MusicPlayerModal item={playerItem} onClose={() => setPlayerItem(null)} />}
        </>,
        document.body
      )}
    </div>
  );
}
