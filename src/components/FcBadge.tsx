import type { ReactNode } from "react";

// 溶鉱炉レベル表示の共通バッジ。FC1〜10は画像、数値はLv（円 or ピル）。
// imgSize=画像サイズ, circleSize=数値の円サイズ, lv=数値をLvピルで表示, fallback=未設定時の表示。
export default function FcBadge({ fc, imgSize = 30, circleSize = 24, lv = false, fallback = null }: { fc?: string; imgSize?: number; circleSize?: number; lv?: boolean; fallback?: ReactNode }) {
  if (!fc) return <>{fallback}</>;
  if (/^FC/.test(fc)) return <img src={"/fire-levels/" + fc + ".webp"} alt={fc} style={{ width: imgSize, height: imgSize, flexShrink: 0, verticalAlign: "middle" }} />;
  if (lv) return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 28, height: 24, padding: "0 7px", borderRadius: 12, background: "#4169E1", color: "#fff", fontWeight: 800, fontSize: 13 }}>Lv{fc}</span>;
  const big = circleSize >= 24;
  return <span style={{ width: circleSize, height: circleSize, flexShrink: 0, borderRadius: "50%", background: "#4169E1", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: fc.length >= 2 ? (big ? 11 : 10) : (big ? 13 : 12), border: "2px solid #fff", boxShadow: "0 0 0 1.5px #c7d2fe" }}>{fc}</span>;
}
