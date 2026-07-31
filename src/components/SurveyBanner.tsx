import { useEffect, useState } from "react";
import { getSurvey } from "../lib/survey";
import Icon from "./Icon";

// 地図上に出る配置アンケートの案内バー（募集中のみ表示・この端末で閉じたら非表示）。
export default function SurveyBanner() {
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("配置アンケート");
  useEffect(() => {
    let on = true;
    try { if (sessionStorage.getItem("snw_survey_banner_off") === "1") return; } catch { /* noop */ }
    getSurvey("trap_placement").then((s) => { if (!on) return; if (s.active) { setTitle(s.title || "配置アンケート"); setShow(true); } }).catch(() => { /* noop */ });
    return () => { on = false; };
  }, []);
  if (!show) return null;
  return (
    <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 8, width: "min(460px, calc(100% - 84px))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg,#3f7fe0,#2f6fd0)", color: "#fff", borderRadius: 12, padding: "10px 12px", boxShadow: "0 6px 18px rgba(47,111,208,0.35)" }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.18)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="target" size={16} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.35, wordBreak: "break-word" }}>{title}<span style={{ marginLeft: 4 }}>受付中</span></div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>あなたの都市の希望を教えてください</div>
        </div>
        <a href="/survey" style={{ background: "#fff", color: "#2f6fd0", fontWeight: 800, fontSize: 12, textDecoration: "none", borderRadius: 8, padding: "7px 11px", whiteSpace: "nowrap" }}>答える</a>
        <button onClick={() => { try { sessionStorage.setItem("snw_survey_banner_off", "1"); } catch { /* noop */ } setShow(false); }} aria-label="閉じる" style={{ border: "none", background: "transparent", color: "#fff", cursor: "pointer", padding: 2, display: "inline-flex" }}><Icon name="close" size={16} /></button>
      </div>
    </div>
  );
}
