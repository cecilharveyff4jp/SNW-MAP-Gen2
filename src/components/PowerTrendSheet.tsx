import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import LineChart from "./LineChart";
import CompareChart from "./CompareChart";

export interface TrendCity {
  id: number;
  name: string;
  fc?: string;
  rank: number; // 1始まり
  current: number; // 現在の総力
}

// 総力ランキングの行タップで開く、盟主ごとの総力推移シート。
// データ（履歴・比較・同盟平均）は StatsPage 側で用意して渡す。既存 LineChart / CompareChart を再利用。
export default function PowerTrendSheet({
  city, points, cmpList, getPoints, avgPoints, canEdit, onClose, onDetail, fmtY, fmtWhen,
}: {
  city: TrendCity;
  points: { t: number; v: number }[];
  cmpList: { id: number; name: string }[];
  getPoints: (id: number) => { t: number; v: number }[];
  avgPoints: { t: number; v: number }[];
  canEdit: boolean;
  onClose: () => void;
  onDetail: () => void;
  fmtY: (n: number) => string;
  fmtWhen: (t: number) => string;
}) {
  const [cmp, setCmp] = useState<"avg" | number | null>(null);
  const [closing, setClosing] = useState(false);
  const close = () => { setClosing(true); window.setTimeout(onClose, 200); };

  // Escで閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasHist = points.length >= 2;
  const lastV = hasHist ? points[points.length - 1].v : city.current;
  const lastStep = hasHist ? lastV - points[points.length - 2].v : 0;
  const maxV = hasHist ? Math.max(...points.map((p) => p.v)) : city.current;

  // 見出しの「伸び」は直近7日基準。7日ぶんの記録がまだ無ければ全期間にフォールバック。
  const WINDOW = 7 * 86400000;
  let baseV = hasHist ? points[0].v : city.current;
  let baseT = hasHist ? points[0].t : 0;
  let use7 = false;
  if (hasHist) {
    const cutoff = points[points.length - 1].t - WINDOW;
    for (let i = points.length - 1; i >= 0; i--) { if (points[i].t <= cutoff) { baseV = points[i].v; baseT = points[i].t; use7 = true; break; } }
  }
  const delta = lastV - baseV;
  const up = delta >= 0;
  const spanDays = hasHist ? Math.round((points[points.length - 1].t - baseT) / 86400000) : 0;
  const growLabel = use7 ? "直近7日の伸び" : spanDays >= 1 ? "全期間 約" + spanDays + "日の伸び" : "本日の記録から";

  const cmpPoints = cmp === "avg" ? avgPoints : typeof cmp === "number" ? getPoints(cmp) : [];
  const cmpName = cmp === "avg" ? "同盟平均" : typeof cmp === "number" ? (cmpList.find((c) => c.id === cmp)?.name ?? "") : "";
  const showCompare = hasHist && cmp != null && cmpPoints.length >= 2;

  const statTile = (k: string, val: string, color?: string) => (
    <div style={{ background: "#fafbfd", border: "1px solid var(--border, #e3e8ef)", borderRadius: 11, padding: "8px 6px", textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#7a8699", fontWeight: 700 }}>{k}</div>
      <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums", color: color ?? "#1b2330" }}>{val}</div>
    </div>
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1250 }}>
      <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.44)", animation: "snwtfade 0.2s ease-out", opacity: closing ? 0 : 1, transition: "opacity 0.2s" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, margin: "0 auto", width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto", background: "var(--surface, #fff)", borderRadius: "20px 20px 0 0", boxShadow: "0 -10px 40px rgba(0,0,0,0.24)", padding: "8px 16px 20px", boxSizing: "border-box", transform: closing ? "translateY(102%)" : "translateY(0)", animation: closing ? undefined : "snwtup 0.26s cubic-bezier(.22,.61,.36,1)", transition: "transform 0.2s ease-in" }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: "#dbe0e8", margin: "4px auto 12px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 30, height: 30, padding: "0 7px", borderRadius: 9, background: "var(--accent-soft, #ededfc)", color: "var(--accent-strong, #4b3fc4)", fontWeight: 800, fontSize: 14 }}>#{city.rank}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 18, fontWeight: 800, color: "#1b2330" }}>{city.name}</span>
          {city.fc && <span style={{ fontSize: 11, fontWeight: 700, color: "#7a8699", background: "#f1f3f5", padding: "3px 9px", borderRadius: 999 }}>{city.fc}</span>}
          <button onClick={close} aria-label="閉じる" style={{ width: 32, height: 32, border: "none", borderRadius: 9, background: "#f1f3f5", color: "#868e96", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="close" size={16} /></button>
        </div>

        {hasHist ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "2px 0 4px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums", color: "#1b2330" }}>{lastV.toLocaleString()}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999, color: up ? "#2f9e44" : "#e03131", background: up ? "#e9f8ee" : "#ffece9" }}>{up ? "▲ +" : "▼ -"}{fmtY(Math.abs(delta))}</span>
            </div>
            <p style={{ fontSize: 11.5, color: "#adb5bd", margin: "0 0 10px" }}>{growLabel} ・ 前回から {lastStep >= 0 ? "+" : "-"}{fmtY(Math.abs(lastStep))}</p>

            <div style={{ border: "1px solid var(--border, #e3e8ef)", borderRadius: 12, padding: "10px 8px 6px", background: "#fff", marginBottom: 12 }}>
              {showCompare ? (
                <CompareChart a={{ name: city.name, color: "var(--accent, #5b5bd6)", points }} b={{ name: cmpName, color: "#f76707", points: cmpPoints }} fmtY={fmtY} fmtX={fmtWhen} />
              ) : (
                <LineChart points={points} fmtY={fmtY} fmtX={fmtWhen} />
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
              {statTile("最高", fmtY(maxV))}
              {statTile("直近の伸び", (lastStep >= 0 ? "+" : "-") + fmtY(Math.abs(lastStep)), lastStep >= 0 ? "#2f9e44" : "#e03131")}
              {statTile("記録数", String(points.length))}
              {statTile("最終更新", fmtWhen(points[points.length - 1].t))}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#7a8699" }}>重ねて比較</span>
              <button onClick={() => setCmp((c) => (c === "avg" ? null : "avg"))} style={pill(cmp === "avg")}>同盟平均</button>
              {cmpList.length > 0 && (
                <select value={typeof cmp === "number" ? cmp : ""} onChange={(e) => { const v = Number(e.target.value); setCmp(v ? v : null); }} style={{ padding: "6px 10px", border: "1px solid var(--border, #d7dee7)", borderRadius: 999, fontSize: 12, background: cmp != null && typeof cmp === "number" ? "var(--accent, #5b5bd6)" : "#fff", color: cmp != null && typeof cmp === "number" ? "#fff" : "#495057", fontWeight: 700, cursor: "pointer", maxWidth: 160 }}>
                  <option value="">他の都市…</option>
                  {cmpList.map((c) => (<option key={c.id} value={c.id} style={{ color: "#495057" }}>{c.name}</option>))}
                </select>
              )}
            </div>
          </>
        ) : (
          <div style={{ border: "1px dashed var(--border, #e3e8ef)", borderRadius: 12, padding: "22px 14px", textAlign: "center", background: "#fafbfd", marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, color: "#7a8699" }}>現在の総力</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#1b2330", margin: "6px 0", fontVariantNumeric: "tabular-nums" }}>{city.current.toLocaleString()}</div>
            <div style={{ fontSize: 12.5, color: "#7a8699", lineHeight: 1.6 }}>まだ推移データがありません。<br />総力の記録が2件以上たまるとグラフが表示されます。</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={close} style={{ flex: 0.7, borderRadius: 11, padding: 11, fontSize: 13.5, fontWeight: 700, cursor: "pointer", border: "1px solid var(--border, #e3e8ef)", background: "#fff", color: "#495057" }}>閉じる</button>
          <button onClick={() => { onDetail(); }} style={{ flex: 1, borderRadius: 11, padding: 11, fontSize: 13.5, fontWeight: 700, cursor: "pointer", border: "1px solid var(--accent, #5b5bd6)", background: "var(--accent, #5b5bd6)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Icon name={canEdit ? "edit" : "map"} size={15} />{canEdit ? "詳細・編集を開く" : "詳細を開く"}</button>
        </div>
        {canEdit && <p style={{ fontSize: 11, color: "#adb5bd", margin: "8px 2px 0", textAlign: "center" }}>※ 従来のカードは名前一覧・大溶鉱炉レベル等からも開けます</p>}
      </div>
      <style>{"@keyframes snwtup{from{transform:translateY(102%)}to{transform:translateY(0)}}@keyframes snwtfade{from{opacity:0}to{opacity:1}}"}</style>
    </div>,
    document.body
  );
}

function pill(on: boolean): CSSProperties {
  return { padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid " + (on ? "var(--accent, #5b5bd6)" : "var(--border, #e3e8ef)"), background: on ? "var(--accent, #5b5bd6)" : "#fff", color: on ? "#fff" : "#495057" };
}
