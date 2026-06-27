import { useState } from "react";
import { THEMES, setTheme, getSavedThemeKey } from "../lib/theme";
import Icon from "./Icon";

// 端末ごとのテーマ選択（localStorage保存）。プリセットのみ。
export default function ThemePicker() {
  const [sel, setSel] = useState(getSavedThemeKey());
  const pick = (key: string) => { setTheme(key); setSel(key); };
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
      </div>
      <div style={{ fontSize: 11, color: "#868e96", marginTop: 6 }}>テーマはこの端末だけに保存されます。</div>
    </div>
  );
}
