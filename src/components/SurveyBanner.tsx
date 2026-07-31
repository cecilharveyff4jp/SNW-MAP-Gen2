import { useState } from "react";
import Icon from "./Icon";

// 地図上に出る配置アンケートの案内バー。募集状態は親(MapView)から受け取る（開始/停止に即反応）。
// この端末で閉じたらそのセッション中は非表示。
export default function SurveyBanner({ active, title = "配置アンケート" }: { active: boolean; title?: string }) {
  const [off, setOff] = useState(() => { try { return sessionStorage.getItem("snw_survey_banner_off") === "1"; } catch { return false; } });
  if (!active || off) return null;
  return (
    <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 8, width: "min(460px, calc(100% - 84px))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg,#3f7fe0,#2f6fd0)", color: "#fff", borderRadius: 12, padding: "10px 12px", boxShadow: "0 6px 18px rgba(47,111,208,0.35)" }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="target" size={16} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.35, wordBreak: "break-word" }}>{title}<span style={{ marginLeft: 4 }}>受付中</span></div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>あなたの都市の希望を教えてください</div>
        </div>
        <a href="/survey" style={{ background: "#fff", color: "#2f6fd0", fontWeight: 800, fontSize: 12, textDecoration: "none", borderRadius: 8, padding: "7px 11px", whiteSpace: "nowrap" }}>答える</a>
        <button onClick={() => { try { sessionStorage.setItem("snw_survey_banner_off", "1"); } catch { /* noop */ } setOff(true); }} aria-label="閉じる" style={{ border: "none", background: "transparent", color: "#fff", cursor: "pointer", padding: 2, display: "inline-flex" }}><Icon name="close" size={16} /></button>
      </div>
    </div>
  );
}
