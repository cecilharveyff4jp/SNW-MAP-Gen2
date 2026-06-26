import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { listObjects, listMaps } from "../lib/api";
import { fcDisplay } from "../lib/sizes";
import { birthdayMonth } from "../lib/birthday";
import type { MapObject, ObjectType } from "../lib/types";

const card: CSSProperties = { border: "1px solid #dee2e6", borderRadius: 12, padding: 18, background: "#fff", marginTop: 12 };
const TYPE_LABEL: Record<ObjectType, string> = { HQ: "本部", CITY: "都市", STATUE: "像", DEPOT: "デポ", BEAR_TRAP: "熊罠", MOUNTAIN: "山", LAKE: "湖", FLAG: "旗", OTHER: "その他" };
const TYPE_ORDER: ObjectType[] = ["HQ", "CITY", "STATUE", "DEPOT", "BEAR_TRAP", "MOUNTAIN", "LAKE", "FLAG", "OTHER"];
const BLANK = new Set(["空き", "空白", "空", "-", "ー", "―", "なし"]);

export default function StatsPage() {
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [mapCount, setMapCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openLv, setOpenLv] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [objs, maps] = await Promise.all([listObjects(), listMaps()]);
        setObjects(Array.isArray(objs) ? objs : []);
        setMapCount(maps.length);
      } catch { /* noop */ } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={card}>読み込み中…</div>;

  const cities = objects.filter((o) => o.type === "CITY");
  const byType = TYPE_ORDER.map((t) => ({ t, n: objects.filter((o) => o.type === t).length })).filter((x) => x.n > 0);

  // FCレベルごとの都市名
  const levelNames = new Map<string, string[]>();
  for (const c of cities) {
    if (!c.fcLevel) continue;
    const nm = (c.label || c.memberName || "").trim();
    const arr = levelNames.get(c.fcLevel) ?? [];
    arr.push(nm && !BLANK.has(nm) ? nm : "（無名）");
    levelNames.set(c.fcLevel, arr);
  }
  const lvKey = (lv: string) => (/^\d+$/.test(lv) ? parseInt(lv, 10) : 100 + parseInt(lv.replace("FC", ""), 10));
  const fcSorted = [...levelNames.entries()].map(([lv, names]) => ({ lv, names, n: names.length })).sort((a, b) => lvKey(b.lv) - lvKey(a.lv));
  const maxN = Math.max(1, ...fcSorted.map((x) => x.n));
  const isFc = (lv: string) => /^FC/.test(lv);

  const TERRAIN: ObjectType[] = ["MOUNTAIN", "LAKE", "FLAG"];
  const named = objects.map((o) => ({ ...o, _name: (o.label || o.memberName || "").trim() })).filter((o) => o._name && !BLANK.has(o._name) && !TERRAIN.includes(o.type));
  const members = named.sort((a, b) => a._name.localeCompare(b._name));

  const now = new Date();
  const curM = now.getMonth() + 1;
  const nextM = curM === 12 ? 1 : curM + 1;
  const bdays = objects.filter((o) => o.birthday).map((o) => ({ name: o.label || o.memberName || "名前なし", date: o.birthday as string, m: birthdayMonth(o.birthday) }));
  const bThis = bdays.filter((b) => b.m === curM);
  const bNext = bdays.filter((b) => b.m === nextM);

  return (
    <div>
      {/* 溶鉱炉レベル（メイン） */}
      <div style={{ ...card, border: "2px solid #ffd8a8" }}>
        <h2 style={{ marginTop: 0, marginBottom: 4, fontSize: 19 }}>🔥 溶鉱炉レベル（FC）分布</h2>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#868e96" }}>レベルをタップすると、その都市名が開きます。</p>
        {fcSorted.length === 0 ? <p style={{ color: "#868e96" }}>FCレベル未設定</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fcSorted.map(({ lv, names, n }) => {
              const open = openLv === lv;
              return (
                <div key={lv} style={{ border: "1px solid " + (open ? "#ffc078" : "#eceff3"), borderRadius: 12, overflow: "hidden" }}>
                  <button onClick={() => setOpenLv(open ? null : lv)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", border: "none", background: open ? "#fff4e6" : "#fff", cursor: "pointer" }}>
                    {isFc(lv) ? <img src={"/fire-levels/" + lv + ".webp"} alt="" style={{ width: 26, height: 26, flexShrink: 0 }} /> : <span style={{ width: 26, height: 26, flexShrink: 0, borderRadius: "50%", background: "#4169E1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: lv.length >= 2 ? 11 : 13, border: "2px solid #fff", boxShadow: "0 0 0 1.5px #c7d2fe" }}>{lv}</span>}
                    <span style={{ fontWeight: 800, fontSize: 15, minWidth: 52, textAlign: "left", color: "#c2410c" }}>{fcDisplay(lv)}</span>
                    <div style={{ flex: 1, height: 9, background: "#f1f3f5", borderRadius: 5, overflow: "hidden" }}><div style={{ width: Math.round((n / maxN) * 100) + "%", height: "100%", background: "linear-gradient(90deg,#ff922b,#e8590c)" }} /></div>
                    <span style={{ fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: "right" }}>{n}</span>
                    <span style={{ color: "#adb5bd", fontSize: 11 }}>{open ? "▲" : "▼"}</span>
                  </button>
                  {open && (
                    <div style={{ padding: "4px 14px 13px", display: "flex", flexWrap: "wrap", gap: 6, background: "#fffaf4" }}>
                      {[...names].sort((a, b) => a.localeCompare(b)).map((nm, i) => (
                        <span key={i} style={{ fontSize: 13, padding: "6px 12px", background: "#fff", border: "1px solid #ffe8cc", borderRadius: 20, color: "#9a3412", fontWeight: 600 }}>{nm}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 誕生日 */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>🎂 誕生日</h3>
        <p style={{ margin: "4px 0", fontSize: 14 }}><strong>今月（{curM}月）:</strong> {bThis.length ? bThis.map((b) => b.date + " " + b.name).join("、") : "なし"}</p>
        <p style={{ margin: "4px 0", fontSize: 14 }}><strong>来月（{nextM}月）:</strong> {bNext.length ? bNext.map((b) => b.date + " " + b.name).join("、") : "なし"}</p>
      </div>

      {/* 名前一覧 */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>名前一覧（{members.length}）</h3>
        {members.length === 0 ? <p style={{ color: "#868e96" }}>名前の登録なし</p> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {members.map((o) => (<span key={o.id} style={{ fontSize: 13, padding: "4px 10px", background: "#f1f3f5", borderRadius: 20 }}>{o._name}{o.fcLevel ? " (" + fcDisplay(o.fcLevel) + ")" : ""}</span>))}
          </div>
        )}
      </div>

      {/* 概要（控えめ） */}
      <div style={{ ...card, background: "#f8f9fb", border: "1px solid #eceff3" }}>
        <h3 style={{ marginTop: 0, fontSize: 14, color: "#868e96" }}>概要</h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: "#495057" }}>
          <span>オブジェクト {objects.length}</span><span>都市 {cities.length}</span><span>名前つき {members.length}</span><span>マップ {mapCount}</span>
        </div>
        {byType.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {byType.map(({ t, n }) => (<span key={t} style={{ fontSize: 12, padding: "3px 9px", background: "#fff", border: "1px solid #e9ecef", borderRadius: 14, color: "#868e96" }}>{TYPE_LABEL[t]} {n}</span>))}
          </div>
        )}
      </div>

      <p style={{ marginTop: 16 }}><a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: "#1c7ed6", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>← 地図に戻る</a></p>
    </div>
  );
}
