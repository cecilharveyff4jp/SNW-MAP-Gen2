import { useState } from "react";
import { THEMES, setTheme, setCustomTheme, getSavedThemeKey, getSavedCustomColor } from "../lib/theme";
import Icon from "./Icon";

// 端末ごとのテーマ選択（localStorage保存）。プリセット＋カスタムカラー。
export default function ThemePicker() {
  const [sel, setSel] = useState(getSavedThemeKey());
  const [custom, setCustom] = useState(getSavedCustomColor());
  const pick = (key: string) => { setTheme(key); setSel(key); };
  const applyCustom = (hex: string) => { setCustom(hex); setCustomTheme(hex); setSel("custom"); };
  const customOn = sel === "custom";
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 8 }}>
        {THEMES.map((t) => {
          const on = sel === t.key;
          return (
            <button key={t.key} onClick={() => pick(t.key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, border: on ? "2px solid var(--accent, #1c7ed6)" : "1px solid #d6dde6", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#333" }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: t.swatch, flexShrink: 0, border: "1px solid rgba(0,0,0,0.15)" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
              {on && <Icon name="check" size={14} style={{ marginLeft: "auto", color: "var(--accent, #1c7ed6)" }} />}
            </button>
          );
        })}
        <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, border: customOn ? "2px solid var(--accent, #1c7ed6)" : "1px solid #d6dde6", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#333" }}>
          <span style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
            <span style={{ display: "block", width: 18, height: 18, borderRadius: "50%", background: custom, border: "1px solid rgba(0,0,0,0.15)" }} />
            <input type="color" value={custom} onChange={(e) => applyCustom(e.target.value)} style={{ position: "absolute", inset: 0, width: 18, height: 18, opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>カスタム</span>
          {customOn && <Icon name="check" size={14} style={{ marginLeft: "auto", color: "var(--accent, #1c7ed6)" }} />}
        </label>
      </div>
      <div style={{ fontSize: 11, color: "#868e96", marginTop: 6 }}>「カスタム」は選んだ色から濃淡を自動生成します。テーマはこの端末だけに保存されます。</div>
    </div>
  );
}
