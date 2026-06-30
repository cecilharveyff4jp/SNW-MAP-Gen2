import { useState } from "react";
import type { CSSProperties } from "react";
import Icon from "./Icon";
import ThemePicker from "./ThemePicker";

// PC用の常設サイドバー（折りたたみ可）。Aurora: 白＋極細罫線、アクセント角丸ロゴ。
const NAV: [string, string, string][] = [
  ["/", "地図", "map"],
  ["/stats", "集計", "chart"],
  ["/links", "リンク集", "link"],
  ["/music", "同盟音楽", "music"],
  ["/settings", "同盟情報", "settings"],
];

export default function Sidebar({ path, canEdit, abbr }: { path: string; canEdit: boolean; abbr: string }) {
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("snw_sidebar") === "collapsed"; } catch { return false; } });
  const [themeOpen, setThemeOpen] = useState(false);
  const toggle = () => setCollapsed((v) => { const nv = !v; try { localStorage.setItem("snw_sidebar", nv ? "collapsed" : "open"); } catch { /* noop */ } return nv; });
  const items: [string, string, string][] = canEdit ? [...NAV.slice(0, 4), ["/suggestions", "変更提案", "edit"], NAV[4]] : NAV;
  const W = collapsed ? 64 : 232;
  const item = (active: boolean): CSSProperties => ({ display: "flex", alignItems: "center", gap: 12, padding: collapsed ? "11px 0" : "10px 12px", justifyContent: collapsed ? "center" : "flex-start", borderRadius: 10, textDecoration: "none", color: active ? "var(--badge-text, #4b3fc4)" : "#525a6b", background: active ? "var(--accent-soft, #ededfc)" : "transparent", fontSize: 14, fontWeight: active ? 600 : 500, whiteSpace: "nowrap" });
  const logo = <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--accent, #5b5bd6)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, letterSpacing: "0.02em", flexShrink: 0 }}>{abbr.slice(0, 3)}</span>;
  const toggleBtn = (
    <button onClick={toggle} aria-label={collapsed ? "メニューを開く" : "メニューを閉じる"} title={collapsed ? "開く" : "閉じる"} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border, #e9ebf1)", background: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#7a8699", flexShrink: 0 }}>
      <Icon name="chevronDown" size={17} style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(90deg)" }} />
    </button>
  );

  return (
    <aside style={{ width: W, flexShrink: 0, background: "var(--surface, #fff)", borderRight: "1px solid var(--border, #e9ebf1)", display: "flex", flexDirection: "column", transition: "width 0.18s ease", overflow: "hidden", zIndex: 11 }}>
      <div style={{ display: "flex", flexDirection: collapsed ? "column" : "row", alignItems: "center", gap: 10, padding: collapsed ? "14px 0" : "14px 14px", justifyContent: collapsed ? "center" : "space-between", borderBottom: "1px solid var(--border, #eef0f4)" }}>
        {logo}
        {toggleBtn}
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: 10, flex: 1, overflowY: "auto" }}>
        {items.map(([href, label, icon]) => {
          const active = path === href;
          return (
            <a key={href} href={href} data-pressable title={collapsed ? label : undefined} style={item(active)}>
              <Icon name={icon} size={19} />{!collapsed && label}
            </a>
          );
        })}
      </nav>

      <div style={{ padding: 10, borderTop: "1px solid var(--border, #eef0f4)" }}>
        {collapsed ? (
          <button onClick={toggle} title="テーマ" aria-label="テーマ" style={{ width: "100%", padding: "11px 0", border: "none", borderRadius: 10, background: "transparent", cursor: "pointer", display: "flex", justifyContent: "center", color: "#7a8699" }}><Icon name="palette" size={19} /></button>
        ) : (
          <>
            <button onClick={() => setThemeOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 11px", border: "1px solid var(--border, #e9ebf1)", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#525a6b" }}>
              <Icon name="palette" size={16} />テーマ<span style={{ flex: 1 }} /><Icon name="chevronDown" size={15} style={{ transform: themeOpen ? "rotate(180deg)" : "none" }} />
            </button>
            {themeOpen && <div style={{ marginTop: 8 }}><ThemePicker /></div>}
          </>
        )}
      </div>
    </aside>
  );
}
