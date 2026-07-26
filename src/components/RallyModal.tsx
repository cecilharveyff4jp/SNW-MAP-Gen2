import { useState } from "react";
import Icon from "./Icon";
import FcBadge from "./FcBadge";
import type { MapObject } from "../lib/types";

const centerOf = (o: MapObject) => ({ x: o.anchorX + o.w / 2, y: o.anchorY + o.h / 2 });
const nameOf = (o: MapObject) => (o.label || o.memberName || "（無名）").trim() || "（無名）";
function compact(n: number): string {
  if (n < 1000) return String(n);
  const [v, u] = n >= 1e9 ? [1e9, "B"] : n >= 1e6 ? [1e6, "M"] : [1e3, "K"];
  const x = n / v; return parseFloat(x.toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2)) + u;
}

// 熊罠ラリー支援：選んだ熊罠から各都市までの距離（マス）でソート。行軍の集合順の目安。
export default function RallyModal({ objects, dark = false, onClose, onPick }: { objects: MapObject[]; dark?: boolean; onClose: () => void; onPick: (id: number) => void }) {
  const traps = objects.filter((o) => o.type === "BEAR_TRAP" && o.id != null).sort((a, b) => nameOf(a).localeCompare(nameOf(b), "ja"));
  const [trapId, setTrapId] = useState<number | null>(traps[0]?.id ?? null);
  const trap = traps.find((t) => t.id === trapId) ?? traps[0];
  const cities = objects.filter((o) => o.type === "CITY" && o.id != null);
  const ranked = trap ? cities.map((c) => { const t = centerOf(trap), cc = centerOf(c); const dx = t.x - cc.x, dy = t.y - cc.y; return { c, dist: Math.round(Math.sqrt(dx * dx + dy * dy)) }; }).sort((a, b) => a.dist - b.dist) : [];

  const surf = dark ? "#141a24" : "#fff";
  const txt = dark ? "#e6edf5" : "#1f2630";
  const muted = dark ? "#9fb0c4" : "#7a8699";
  const border = dark ? "rgba(255,255,255,0.1)" : "#eef1f4";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: surf, color: txt, borderRadius: 16, width: "min(440px, 100%)", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 18px 50px rgba(0,0,0,0.34)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 16px", borderBottom: "1px solid " + border }}>
          <span style={{ color: "var(--accent, #5b5bd6)", display: "inline-flex" }}><Icon name="target" size={20} /></span>
          <strong style={{ fontSize: 16 }}>熊罠ラリー・距離順</strong>
          <button onClick={onClose} aria-label="閉じる" style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: 9, border: "none", background: dark ? "rgba(255,255,255,0.08)" : "#f1f3f5", color: muted, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={16} /></button>
        </div>

        {traps.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: muted, fontSize: 14 }}>熊罠が地図にありません。<br />編集モードで熊罠を配置すると使えます。</div>
        ) : (
          <>
            {traps.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", flexWrap: "wrap", borderBottom: "1px solid " + border }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: muted, flexShrink: 0 }}>対象の罠</span>
                {traps.map((t) => { const on = t.id === (trap?.id ?? null); return (
                  <button key={t.id} onClick={() => setTrapId(t.id ?? null)} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid " + (on ? "var(--accent, #5b5bd6)" : border), background: on ? "var(--accent-soft, #ededfc)" : "transparent", color: on ? "var(--accent-strong, #4b3fc4)" : muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{nameOf(t)}</button>
                ); })}
              </div>
            )}
            {trap && <div style={{ fontSize: 12, color: muted, padding: "8px 16px 4px" }}>{nameOf(trap)}（X {trap.anchorX} · Y {trap.anchorY}）に近い順＝集合の位置番号・{ranked.length} 都市</div>}
            <div style={{ overflowY: "auto", padding: "4px 10px 4px" }}>
              {ranked.map(({ c, dist }, i) => (
                <button key={c.id} onClick={() => c.id != null && onPick(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "9px 10px", border: "none", borderRadius: 10, background: "transparent", color: txt, cursor: "pointer" }}>
                  <span style={{ width: 36, textAlign: "right", fontSize: 13, fontWeight: 800, color: i < 3 ? "var(--accent-strong, #4b3fc4)" : muted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{i + 1}<span style={{ fontSize: 10, fontWeight: 600, color: muted }}>番</span></span>
                  <FcBadge fc={c.fcLevel} imgSize={22} circleSize={20} fallback={<span style={{ width: 22, height: 22, flexShrink: 0 }} />} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(c)}{c.power != null ? <span style={{ color: muted, fontWeight: 500, fontSize: 12 }}>　{compact(c.power)}</span> : null}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent, #5b5bd6)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>約{dist}<span style={{ fontSize: 11, color: muted, fontWeight: 500 }}>マス</span></span>
                </button>
              ))}
              {ranked.length === 0 && <div style={{ padding: 20, textAlign: "center", color: muted, fontSize: 13 }}>都市がありません。</div>}
            </div>
            <div style={{ fontSize: 11, color: dark ? "#8b97a8" : "#adb5bd", padding: "6px 16px 12px", lineHeight: 1.5 }}>近い順に集合の位置番号（○番）を割り当てた並びです。距離はマス（直線）。実際の行軍時間は各自の行軍速度で変わります。</div>
          </>
        )}
      </div>
    </div>
  );
}
