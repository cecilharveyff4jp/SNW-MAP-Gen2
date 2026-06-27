import type { CSSProperties } from "react";
import Icon from "./Icon";
import ThemePicker from "./ThemePicker";

// PC用のオーバーレイ式ナビゲーション（全ページ共通）。ハンバーガーで開閉。テーマもここに集約。
const NAV: [string, string, string][] = [
  ["/", "地図", "map"],
  ["/stats", "集計", "chart"],
  ["/links", "リンク集", "link"],
  ["/music", "同盟音楽", "music"],
  ["/settings", "同盟情報", "settings"],
];
const navItem = (active: boolean): CSSProperties => ({ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, textDecoration: "none", color: active ? "var(--badge-text, #1e3a8a)" : "#222", background: active ? "var(--accent-soft, #e7efff)" : "transparent", fontSize: 15, fontWeight: 600 });
const section: CSSProperties = { fontSize: 11, fontWeight: 700, color: "#8a94a6", letterSpacing: "0.08em", margin: "18px 0 8px", textTransform: "uppercase" };

export default function NavDrawer({ open, onClose, path, canEdit }: { open: boolean; onClose: () => void; path: string; canEdit: boolean }) {
  if (!open) return null;
  const items: [string, string, string][] = canEdit
    ? [...NAV.slice(0, 4), ["/suggestions", "変更提案", "edit"], NAV[4]]
    : NAV;
  const go = (e: React.MouseEvent, href: string) => { e.preventDefault(); if (href !== path) window.location.href = href; else onClose(); };
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 40, animation: "snwfade 0.2s ease-out" }} />
      <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 300, maxWidth: "86%", background: "var(--surface, #fff)", zIndex: 41, boxShadow: "8px 0 30px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", animation: "snwdrawer 0.24s cubic-bezier(0.2,0.8,0.2,1)", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 8px" }}>
          <span style={{ background: "var(--header-grad, linear-gradient(135deg,#1e3a8a,#2563eb))", color: "#fff", padding: "4px 10px", borderRadius: 8, fontWeight: 800, letterSpacing: "0.08em", fontSize: 14 }}>メニュー</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="閉じる" style={{ width: 36, height: 36, borderRadius: 18, border: "none", background: "#f1f3f5", color: "#495057", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} /></button>
        </div>
        <div style={{ padding: "0 14px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {items.map(([href, label, icon]) => (
              <a key={href} href={href} onClick={(e) => go(e, href)} style={navItem(path === href)}><Icon name={icon} size={19} />{label}</a>
            ))}
          </div>
          <div style={{ ...section, display: "flex", alignItems: "center", gap: 5 }}><Icon name="settings" size={13} />テーマ（この端末）</div>
          <ThemePicker />
        </div>
      </div>
      <style>{"@keyframes snwfade{from{opacity:0}to{opacity:1}}@keyframes snwdrawer{from{transform:translateX(-100%)}to{transform:translateX(0)}}"}</style>
    </>
  );
}
