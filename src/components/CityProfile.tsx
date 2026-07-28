import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { listObjects, listPowerHistory, type PowerPoint } from "../lib/api";
import type { MapObject } from "../lib/types";
import { card, btnGhost } from "../lib/styles";
import { fcDisplay } from "../lib/sizes";
import Icon from "./Icon";
import FcBadge from "./FcBadge";
import LineChart from "./LineChart";
import QrShare from "./QrShare";

function compact(n: number): string {
  if (n < 1000) return String(n);
  const [v, u] = n >= 1e9 ? [1e9, "B"] : n >= 1e6 ? [1e6, "M"] : [1e3, "K"];
  const x = n / v; return parseFloat(x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2)) + u;
}
const parseTs = (s: string) => Date.parse(s.replace(" ", "T") + (s.includes("Z") ? "" : "Z"));

export default function CityProfile() {
  const id = Number(window.location.pathname.split("/").filter(Boolean).pop());
  const [obj, setObj] = useState<MapObject | null>(null);
  const [hist, setHist] = useState<PowerPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await listObjects();
        const o = list.find((x) => x.id === id) ?? null;
        if (alive) setObj(o);
        if (o) { try { const h = await listPowerHistory(id); if (alive) setHist(h); } catch { /* noop */ } }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]);

  const back = <a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a>;
  const copyLink = async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* noop */ } };

  if (loading) return <div style={card}><p style={{ color: "#868e96", margin: 0 }}>読み込み中…</p></div>;
  if (!obj) return <div style={card}><p style={{ marginTop: 0 }}>この都市は見つかりませんでした。</p><p style={{ marginTop: 12 }}>{back}</p></div>;

  const name = (obj.label || obj.memberName || "（名称なし）").trim() || "（名称なし）";
  const pts = hist.map((h) => ({ t: parseTs(h.recordedAt), v: h.power })).filter((p) => Number.isFinite(p.t));
  const row = (label: string, value: ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: "1px solid var(--border, #eef1f4)", fontSize: 14 }}>
      <span style={{ color: "#7a8699" }}>{label}</span>
      <span style={{ color: "#1b2330", fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <FcBadge fc={obj.fcLevel} imgSize={40} circleSize={34} fallback={<span style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent-soft, #e7f0fb)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#adb5bd", fontSize: 12 }}>-</span>} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "#1b2330", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</h2>
          <div style={{ fontSize: 12.5, color: "#868e96", marginTop: 2 }}>座標 X {obj.anchorX} · Y {obj.anchorY}{obj.fcLevel ? " ・ " + fcDisplay(obj.fcLevel) : ""}</div>
        </div>
      </div>

      {obj.power != null && (
        <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 12, background: "var(--accent-soft, #ededfc)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-strong, #4b3fc4)" }}>総力</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1b2330", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{obj.power.toLocaleString()}</div>
          {pts.length >= 2 ? (
            <div style={{ marginTop: 8 }}><LineChart points={pts} color="var(--accent, #5b5bd6)" fmtY={compact} fmtX={(t) => new Date(t).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} /></div>
          ) : <div style={{ fontSize: 12, color: "#7a8699", marginTop: 6 }}>推移グラフは記録が2件以上でます。</div>}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        {obj.birthday && row("誕生日", obj.birthday)}
        {obj.gameId && row("ゲーム内ID", obj.gameId)}
        {obj.note && row("メモ", <span style={{ whiteSpace: "pre-wrap", fontWeight: 400 }}>{obj.note}</span>)}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <a href={"/?focus=" + id} style={{ ...btnGhost, textDecoration: "none" }}><Icon name="target" size={15} />地図で開く</a>
        <button onClick={copyLink} style={{ ...btnGhost, cursor: "pointer" }}><Icon name={copied ? "check" : "link"} size={15} />{copied ? "コピーしました" : "共有リンクをコピー"}</button>
        <QrShare url={window.location.href} label="QRを表示" />
        {back}
      </div>
    </div>
  );
}
