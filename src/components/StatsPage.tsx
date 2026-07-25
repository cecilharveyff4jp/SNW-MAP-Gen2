import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { listObjects, listMaps, listMusic, updateObject, deleteObject, listPowerHistory, updatePowerHistory, deletePowerHistory, type MusicItem, type ObjectInput, type PowerPoint } from "../lib/api";
import { card, btnGhost } from "../lib/styles";
import { confirmDelete } from "../lib/confirm";
import { useDialog } from "./Dialog";
import FcBadge from "./FcBadge";
import Icon from "./Icon";
import LineChart from "./LineChart";
import ObjectInfoSheet from "./ObjectInfoSheet";
import ObjectEditPanel, { type PanelInitial } from "./ObjectEditPanel";
import MusicPlayerModal from "./MusicPlayerModal";
import { fcDisplay } from "../lib/sizes";
import { birthdayMonth } from "../lib/birthday";
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
  const [sortMode, setSortMode] = useState<"pd" | "pa" | "dn" | "do">("pd"); // 総力↓/総力↑/更新新しい/更新古い
  const [editPower, setEditPower] = useState(false);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [editOrder, setEditOrder] = useState<number[]>([]);
  const [perr, setPerr] = useState<string | null>(null);
  const [music, setMusic] = useState<MusicItem[]>([]);
  const [infoObj, setInfoObj] = useState<MapObject | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [playerItem, setPlayerItem] = useState<MusicItem | null>(null);
  const [history, setHistory] = useState<PowerPoint[]>([]);
  const [histCity, setHistCity] = useState<number | null>(() => { try { const v = localStorage.getItem("snw_my_city"); return v ? Number(v) : null; } catch { return null; } }); // 既定は自分の都市
  const [histShowAll, setHistShowAll] = useState(false); // 履歴一覧を全件表示するか

  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 1800); return () => window.clearTimeout(t); }, [toast]);

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
  const histCityIds = [...cityHist.keys()].sort((a, b) => cityName(a).localeCompare(cityName(b)));
  const selCity = histCity != null && cityHist.has(histCity) ? histCity : null;
  const selPoints = selCity != null ? (cityHist.get(selCity) ?? []) : [];
  const selRecs = selCity != null ? histRecs.filter((r) => r.obj === selCity).sort((a, b) => b.t - a.t) : [];
  const delHist = async (id: number) => { if (!(await confirmDelete(dlg, "履歴"))) return; try { await deletePowerHistory(id); reloadHistory(); } catch (e) { setPerr(String((e as Error).message || e)); } };
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
      setSavedId(id); window.setTimeout(() => setSavedId((s) => (s === id ? null : s)), 1200);
    } catch (e) { setPerr(String((e as Error).message || e)); }
    finally { setSavingId(null); }
  }

  const now = new Date();
  const curM = now.getMonth() + 1;
  const nextM = curM === 12 ? 1 : curM + 1;
  const bdays = objects.filter((o) => o.birthday).map((o) => ({ id: o.id, name: o.label || o.memberName || "名前なし", date: o.birthday as string, m: birthdayMonth(o.birthday) }));
  const bThis = bdays.filter((b) => b.m === curM);
  const bNext = bdays.filter((b) => b.m === nextM);

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
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#7a8699" }}>レベルをタップすると、その都市名が開きます。</p>
        {fcSorted.length === 0 ? <p style={{ color: "#868e96" }}>FCレベル未設定</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fcSorted.map(({ lv, names, n }) => {
              const open = openLv === lv;
              return (
                <div key={lv} style={{ border: "1px solid " + (open ? "var(--accent, #5b5bd6)" : "var(--border, #eceff3)"), borderRadius: 12, overflow: "hidden" }}>
                  <button onClick={() => setOpenLv(open ? null : lv)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", border: "none", background: open ? "var(--accent-soft, #ededfc)" : "#fff", cursor: "pointer" }}>
                    <FcBadge fc={lv} imgSize={26} circleSize={22} />
                    <div style={{ flex: 1, height: 9, background: "#f1f3f5", borderRadius: 5, overflow: "hidden" }}><div style={{ width: Math.round((n / maxN) * 100) + "%", height: "100%", background: "linear-gradient(90deg, var(--accent, #5b5bd6), var(--accent-strong, #4b3fc4))" }} /></div>
                    <span style={{ fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: "right", color: "var(--accent-strong, #4b3fc4)" }}>{n}</span>
                    <span style={{ color: "#adb5bd", fontSize: 11 }}>{open ? "▲" : "▼"}</span>
                  </button>
                  {open && (
                    <div style={{ padding: "4px 14px 13px", display: "flex", flexWrap: "wrap", gap: 6, background: "var(--accent-soft, #ededfc)" }}>
                      {[...names].sort((a, b) => a.name.localeCompare(b.name)).map((nm, i) => (
                        <span key={i} onClick={() => goToObject(nm.id)} style={{ fontSize: 13, padding: "6px 12px", background: "#fff", border: "1px solid var(--border, #e3e8ef)", borderRadius: 20, color: "var(--accent-strong, #4b3fc4)", fontWeight: 600, ...clickable }}>{nm.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
            {canEdit && <button onClick={() => setEditPower((v) => !v)} style={editPower ? { padding: "6px 13px", border: "none", borderRadius: 10, background: "var(--accent, #5b5bd6)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" } : { ...btnGhost, padding: "6px 12px", fontSize: 12.5 }}>{editPower ? "完了" : "編集"}</button>}
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
                  <div key={c.id ?? i} onClick={() => goToObject(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, background: i % 2 ? "transparent" : "#fafbfd", ...clickable }}>
                    <span style={{ width: 22, textAlign: "left", fontSize: 12, fontWeight: 700, color: i < 3 ? "var(--accent-strong, #4b3fc4)" : "#adb5bd", flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13.5, fontWeight: 600, color: "#1b2330" }}>{c.name}{c.fc ? <span style={{ color: "#adb5bd", fontWeight: 400, fontSize: 11.5 }}> · {fcDisplay(c.fc)}</span> : null}</span>
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
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ color: "var(--accent, #5b5bd6)", display: "inline-flex" }}><Icon name="chart" size={20} /></span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1b2330" }}>総力の推移</h2>
            {dayTotals.length > 0 && <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "var(--accent-strong, #4b3fc4)", background: "var(--accent-soft, #ededfc)", padding: "3px 10px", borderRadius: 999, fontVariantNumeric: "tabular-nums" }}>最新 計 {compactNum(dayTotals[dayTotals.length - 1].v)}</span>}
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#7a8699" }}>同盟合計（更新のあった日ごとのスナップショット）。</p>
          <LineChart points={dayTotals} fmtY={compactNum} fmtX={(t) => new Date(t).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} />
          {histCityIds.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border, #eef1f5)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#33404f" }}>都市別の推移</span>
                <select value={selCity ?? ""} onChange={(e) => { setHistCity(Number(e.target.value) || null); setHistShowAll(false); }} style={{ marginLeft: "auto", padding: "6px 10px", border: "1px solid var(--border, #d7dee7)", borderRadius: 8, fontSize: 14, background: "#fff", maxWidth: "72%" }}>
                  <option value="">（都市を選択）</option>
                  {histCityIds.map((id) => (<option key={id} value={id}>{cityName(id)}</option>))}
                </select>
              </div>
              {selCity == null ? (
                <p style={{ fontSize: 12.5, color: "#adb5bd", margin: "4px 0 2px" }}>都市を選ぶと、その盟主の総力推移が表示されます。</p>
              ) : (
                <>
                  <LineChart points={selPoints} fmtY={compactNum} fmtX={fmtWhen} />
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 3, maxHeight: 300, overflow: "auto" }}>
                    {(histShowAll ? selRecs : selRecs.slice(0, 3)).map((r) => (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", fontSize: 13, borderRadius: 6, background: "#fafbfd" }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#7a8699", fontSize: 12 }}>{new Date(r.t).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        <span style={{ width: 96, flexShrink: 0, textAlign: "right", fontWeight: 700, color: "#1b2330", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{r.v.toLocaleString()}</span>
                        <span style={{ width: 28, flexShrink: 0, display: "flex", justifyContent: "center" }}>{r.source === "scrcpy" && <span style={{ fontSize: 9, color: "#aab2bd", background: "rgba(120,134,153,0.1)", padding: "1px 4px", borderRadius: 999, whiteSpace: "nowrap" }}>読取</span>}</span>
                        {canEdit && <button onClick={() => editHist(r)} aria-label="この履歴を修正" style={{ border: "1px solid var(--border, #d7dee7)", background: "#fff", color: "#495057", borderRadius: 8, padding: "3px 8px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>修正</button>}
                        {canEdit && <button onClick={() => delHist(r.id)} aria-label="この履歴を削除" style={{ border: "1px solid #ffc9c9", background: "#fff", color: "#e03131", borderRadius: 8, padding: "3px 8px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>削除</button>}
                      </div>
                    ))}
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
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {bdayCol("今月（" + curM + "月）", bThis)}
          {bdayCol("来月（" + nextM + "月）", bNext)}
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "#1b2330" }}>名前一覧 <span style={{ fontSize: 13, fontWeight: 600, color: "#adb5bd" }}>{members.length}</span></h2>
        {members.length === 0 ? <p style={{ color: "#868e96" }}>名前の登録なし</p> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {members.map((o) => (<span key={o.id} onClick={() => goToObject(o.id)} style={{ fontSize: 13, padding: "5px 11px", background: "#f1f3f5", borderRadius: 999, color: "#33404f", maxWidth: "100%", wordBreak: "break-word", ...clickable }}>{o._name}{o.fcLevel ? " (" + fcDisplay(o.fcLevel) + ")" : ""}</span>))}
          </div>
        )}
      </div>

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
