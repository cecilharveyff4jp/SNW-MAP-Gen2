import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { listObjects, listMaps } from "../lib/api";
import { fcDisplay } from "../lib/sizes";
import { birthdayMonth } from "../lib/birthday";
import type { MapObject, ObjectType } from "../lib/types";

const card: CSSProperties = { border: "1px solid #dee2e6", borderRadius: 10, padding: 20, background: "#fff", marginTop: 12 };
const TYPE_LABEL: Record<ObjectType, string> = {
  HQ: "本部", CITY: "都市", STATUE: "像", DEPOT: "デポ", BEAR_TRAP: "熊罠", MOUNTAIN: "山", LAKE: "湖", FLAG: "旗",
};
const TYPE_ORDER: ObjectType[] = ["HQ", "CITY", "STATUE", "DEPOT", "BEAR_TRAP", "MOUNTAIN", "LAKE", "FLAG"];


export default function StatsPage() {
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [mapCount, setMapCount] = useState(0);
  const [loading, setLoading] = useState(true);

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

  const byType = TYPE_ORDER.map((t) => ({ t, n: objects.filter((o) => o.type === t).length })).filter((x) => x.n > 0);
  const cities = objects.filter((o) => o.type === "CITY");
  const fcGroups = new Map<string, number>();
  for (const c of cities) { if (c.fcLevel) fcGroups.set(c.fcLevel, (fcGroups.get(c.fcLevel) ?? 0) + 1); }
  const fcSorted = [...fcGroups.entries()].sort((a, b) => {
    const na = /^\d+$/.test(a[0]) ? parseInt(a[0], 10) : 100 + parseInt(a[0].replace("FC", ""), 10);
    const nb = /^\d+$/.test(b[0]) ? parseInt(b[0], 10) : 100 + parseInt(b[0].replace("FC", ""), 10);
    return na - nb;
  });
  const named = objects.map((o) => ({ ...o, _name: o.label || o.memberName || "" })).filter((o) => o._name);
  const members = named.sort((a, b) => a._name.localeCompare(b._name));

  const now = new Date();
  const curM = now.getMonth() + 1;
  const nextM = curM === 12 ? 1 : curM + 1;
  const bdays = objects.filter((o) => o.birthday).map((o) => ({ name: o.label || o.memberName || "名前なし", date: o.birthday as string, m: birthdayMonth(o.birthday) }));
  const bThis = bdays.filter((b) => b.m === curM);
  const bNext = bdays.filter((b) => b.m === nextM);

  return (
    <div>
      <div style={card}>
        <h2 style={{ marginTop: 0 }}>集計</h2>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Stat label="オブジェクト総数" value={objects.length} />
          <Stat label="都市" value={cities.length} />
          <Stat label="名前つき" value={members.length} />
          <Stat label="マップ数" value={mapCount} />
        </div>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>種別ごとの数</h3>
        {byType.length === 0 ? <p style={{ color: "#868e96" }}>データなし</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {byType.map(({ t, n }) => <Bar key={t} label={TYPE_LABEL[t]} n={n} max={Math.max(...byType.map((x) => x.n))} />)}
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>都市のFCレベル分布</h3>
        {fcSorted.length === 0 ? <p style={{ color: "#868e96" }}>FC未設定</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {fcSorted.map(([lv, n]) => <Bar key={lv} label={fcDisplay(lv)} n={n} max={Math.max(...fcSorted.map((x) => x[1]))} />)}
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>誕生日</h3>
        <p style={{ margin: "4px 0", fontSize: 14 }}><strong>今月（{curM}月）:</strong> {bThis.length ? bThis.map((b) => b.date + " " + b.name).join("、") : "なし"}</p>
        <p style={{ margin: "4px 0", fontSize: 14 }}><strong>来月（{nextM}月）:</strong> {bNext.length ? bNext.map((b) => b.date + " " + b.name).join("、") : "なし"}</p>
      </div>

      <div style={card}>
        <h3 style={{ marginTop: 0 }}>名前一覧（{members.length}）</h3>
        {members.length === 0 ? <p style={{ color: "#868e96" }}>名前の登録なし</p> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {members.map((o) => (
              <span key={o.id} style={{ fontSize: 13, padding: "4px 10px", background: "#f1f3f5", borderRadius: 20 }}>
                {o._name}{o.fcLevel ? " (" + fcDisplay(o.fcLevel) + ")" : ""}
              </span>
            ))}
          </div>
        )}
      </div>

      <p style={{ marginTop: 16 }}><a href="/" style={{ fontSize: 13 }}>← 地図に戻る</a></p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#1e3a8a" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#868e96" }}>{label}</div>
    </div>
  );
}

function Bar({ label, n, max }: { label: string; n: number; max: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
      <span style={{ width: 64, textAlign: "right", color: "#495057" }}>{label}</span>
      <div style={{ flex: 1, background: "#f1f3f5", borderRadius: 6, overflow: "hidden", height: 18 }}>
        <div style={{ width: Math.round((n / max) * 100) + "%", background: "#4dabf7", height: "100%" }} />
      </div>
      <span style={{ width: 30, fontWeight: 700 }}>{n}</span>
    </div>
  );
}
