import { useState } from "react";
import type { CSSProperties } from "react";
import Icon from "./Icon";
import ThemePicker from "./ThemePicker";

// PC用の常設サイドバー（折りたたみ可）。地図を右に押し出す。テーマもここに集約。
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
  const W = collapsed ? 60 : 226;
  const item = (active: boolean): CSSProperties => ({ display: "flex", alignItems: "center", gap: 12, padding: collapsed ? "12px 0" : "11px 14px", justifyContent: collapsed ? "center" : "flex-start", borderRadius: 10, textDecoration: "none", color: active ? "var(--badge-text, #1e3a8a)" : "#333", background: active ? "var(--accent-soft, #e7efff)" : "transparent", fontSize: 14.5, fontWeight: 600, whiteSpace: "nowrap" });

  return (
    <aside style={{ width: W, flexShrink: 0, background: "var(--surface, #fff)", borderRight: "1px solid var(--border, #dde3ea)", display: "flex", flexDirection: "column", transition: "width 0.18s ease", overflow: "hidden", zIndex: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 12px", justifyContent: collapsed ? "center" : "space-between", borderBottom: "1px solid var(--border, #eef1f4)" }}>
        {!collapsed && <span style={{ background: "var(--header-grad, linear-gradient(135deg,#1e3a8a,#2563eb))", color: "#fff", padding: "5px 11px", borderRadius: 8, fontWeight: 800, letterSpacing: "0.06em", fontSize: 14 }}>{abbr}</span>}
        <button onClick={toggle} aria-label={collapsed ? "メニューを開く" : "メニューを閉じる"} title={collapsed ? "開く" : "閉じる"} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border, #dde3ea)", background: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#495057", flexShrink: 0 }}>
          <Icon name="chevronDown" size={18} style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(90deg)" }} />
        </button>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 3, padding: "8px", flex: 1, overflowY: "auto" }}>
        {items.map(([href, label, icon]) => {
          const active = path === href;
          return (
            <a key={href} href={href} title={collapsed ? label : undefined} style={item(active)}>
              <Icon name={icon} size={20} />{!collapsed && label}
            </a>
          );
        })}
      </nav>

      <div style={{ padding: 8, borderTop: "1px solid var(--border, #eef1f4)" }}>
        {collapsed ? (
          <button onClick={toggle} title="テーマ" aria-label="テーマ" style={{ width: "100%", padding: "11px 0", border: "none", borderRadius: 10, background: "transparent", cursor: "pointer", display: "flex", justifyContent: "center", color: "#495057" }}><Icon name="settings" size={20} /></button>
        ) : (
          <>
            <button onClick={() => setThemeOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 11px", border: "1px solid var(--border, #dde3ea)", borderRadius: 10, background: "#fff", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "#333" }}>
              <Icon name="settings" size={16} />テーマ<span style={{ flex: 1 }} /><Icon name="chevronDown" size={15} style={{ transform: themeOpen ? "rotate(180deg)" : "none" }} />
            </button>
            {themeOpen && <div style={{ marginTop: 8 }}><ThemePicker /></div>}
          </>
        )}
      </div>
    </aside>
  );
}
