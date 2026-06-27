import { useState } from "react";
import { THEMES, setTheme, setCustomAccent, getSavedTheme } from "../lib/theme";
import Icon from "./Icon";

// 端末ごとのテーマ選択（localStorage保存）。プリセット＋カスタム色。
export default function ThemePicker() {
  const [sel, setSel] = useState(getSavedTheme());

  const pick = (key: string) => { setTheme(key); setSel({ key, accent: "" }); };
  const custom = (hex: string) => { setCustomAccent(hex); setSel({ key: "custom", accent: hex }); };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
        {THEMES.map((t) => {
          const on = sel.key === t.key;
          return (
            <button key={t.key} onClick={() => pick(t.key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, border: on ? "2px solid #1c7ed6" : "1px solid #d6dde6", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#333" }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: t.swatch, flexShrink: 0, border: "1px solid rgba(0,0,0,0.15)" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
              {on && <Icon name="check" size={14} style={{ marginLeft: "auto", color: "#1c7ed6" }} />}
            </button>
          );
        })}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "9px 11px", borderRadius: 10, border: sel.key === "custom" ? "2px solid #1c7ed6" : "1px solid #d6dde6", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#333" }}>
        <span style={{ flex: 1 }}>カスタム色を選ぶ</span>
        <input type="color" value={sel.accent || "#1c7ed6"} onChange={(e) => custom(e.target.value)} style={{ width: 34, height: 26, border: "none", background: "none", cursor: "pointer", padding: 0 }} />
      </label>
      <div style={{ fontSize: 11, color: "#868e96", marginTop: 6 }}>テーマはこの端末だけに保存されます。</div>
    </div>
  );
}
