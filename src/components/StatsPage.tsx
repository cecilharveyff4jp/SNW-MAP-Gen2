import { useEffect, useState } from "react";
import { listObjects, listMaps } from "../lib/api";
import { card, btnGhost } from "../lib/styles";
import FcBadge from "./FcBadge";
import Icon from "./Icon";
import { fcDisplay } from "../lib/sizes";
import { birthdayMonth } from "../lib/birthday";
import type { MapObject, ObjectType } from "../lib/types";

const TYPE_LABEL: Record<ObjectType, string> = { HQ: "本部", CITY: "都市", STATUE: "同盟建造物", DEPOT: "同盟資材", BEAR_TRAP: "熊罠", MOUNTAIN: "山", LAKE: "湖", FLAG: "旗", OTHER: "その他" };
const TYPE_ORDER: ObjectType[] = ["HQ", "CITY", "STATUE", "DEPOT", "BEAR_TRAP", "MOUNTAIN", "LAKE", "FLAG", "OTHER"];
const BLANK = new Set(["空き", "空白", "空", "-", "ー", "―", "なし"]);

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "var(--surface, #fff)", border: "1px solid var(--border, #e3e8ef)", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div style={{ fontSize: 12, color: "#7a8699", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#1b2330", lineHeight: 1.1, marginTop: 4 }}>{value}</div>
    </div>
  );
}

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
  const fcTotal = fcSorted.reduce((s, x) => s + x.n, 0);

  const TERRAIN: ObjectType[] = ["MOUNTAIN", "LAKE", "FLAG"];
  const named = objects.map((o) => ({ ...o, _name: (o.label || o.memberName || "").trim() })).filter((o) => o._name && !BLANK.has(o._name) && !TERRAIN.includes(o.type));
  const members = named.sort((a, b) => a._name.localeCompare(b._name));

  const now = new Date();
  const curM = now.getMonth() + 1;
  const nextM = curM === 12 ? 1 : curM + 1;
  const bdays = objects.filter((o) => o.birthday).map((o) => ({ name: o.label || o.memberName || "名前なし", date: o.birthday as string, m: birthdayMonth(o.birthday) }));
  const bThis = bdays.filter((b) => b.m === curM);
  const bNext = bdays.filter((b) => b.m === nextM);

  const bdayCol = (title: string, list: { name: string; date: string }[]) => (
    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#7a8699", marginBottom: 8 }}>{title}</div>
      {list.length === 0 ? <div style={{ fontSize: 13, color: "#adb5bd" }}>なし</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {list.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, background: "#fff0f3", color: "#d6406b", flexShrink: 0 }}><Icon name="gift" size={14} /></span>
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
          <span style={{ color: "#e8590c", display: "inline-flex" }}><Icon name="chart" size={20} /></span>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1b2330" }}>溶鉱炉レベル（FC）分布</h2>
          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#9a3412", background: "#fff0e0", padding: "3px 10px", borderRadius: 999 }}>FC設定済 {fcTotal} / 都市 {cities.length}</span>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#7a8699" }}>レベルをタップすると、その都市名が開きます。</p>
        {fcSorted.length === 0 ? <p style={{ color: "#868e96" }}>FCレベル未設定</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fcSorted.map(({ lv, names, n }) => {
              const open = openLv === lv;
              return (
                <div key={lv} style={{ border: "1px solid " + (open ? "#ffc078" : "var(--border, #eceff3)"), borderRadius: 12, overflow: "hidden" }}>
                  <button onClick={() => setOpenLv(open ? null : lv)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", border: "none", background: open ? "#fff4e6" : "#fff", cursor: "pointer" }}>
                    <FcBadge fc={lv} imgSize={26} circleSize={22} />
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

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
          <span style={{ color: "#d6406b", display: "inline-flex" }}><Icon name="gift" size={20} /></span>
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
            {members.map((o) => (<span key={o.id} style={{ fontSize: 13, padding: "5px 11px", background: "#f1f3f5", borderRadius: 999, color: "#33404f", maxWidth: "100%", wordBreak: "break-word" }}>{o._name}{o.fcLevel ? " (" + fcDisplay(o.fcLevel) + ")" : ""}</span>))}
          </div>
        )}
      </div>

      <p style={{ marginTop: 16 }}><a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a></p>
    </div>
  );
}
