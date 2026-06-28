import type { CSSProperties } from "react";
import type { Me, MapInfo } from "../lib/api";
import Icon from "./Icon";
import ThemePicker from "./ThemePicker";
import CitySelect from "./CitySelect";

interface Props {
  open: boolean;
  onClose: () => void;
  path: string;
  me: Me | null;
  abbr?: string;
  maps: MapInfo[];
  mapId: number | null;
  isOwner: boolean;
  canEdit: boolean;
  cityChoices: { id: number; name: string }[];
  myCityId: number | null;
  onSelectMyCity: (id: number | null) => void;
  onSwitchMap: (id: number) => void;
  onAddMap: () => void;
  onRenameMap: (id: number) => void;
  onRemoveMap: (id: number) => void;
  showTelop: boolean;
  onToggleTelop: () => void;
}

const NAV: [string, string][] = [
  ["/", "map"],
  ["/stats", "chart"],
  ["/links", "link"],
  ["/music", "music"],
  ["/settings", "settings"],
];
const NAV_LABEL: Record<string, string> = { "/": "地図", "/stats": "集計", "/links": "リンク集", "/music": "同盟音楽", "/settings": "同盟情報" };

const section: CSSProperties = { fontSize: 11, fontWeight: 700, color: "#8a94a6", letterSpacing: "0.08em", margin: "18px 0 8px", textTransform: "uppercase" };
const navItem = (active: boolean): CSSProperties => ({ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, textDecoration: "none", color: active ? "var(--badge-text, #1e3a8a)" : "#222", background: active ? "var(--accent-soft, #e7efff)" : "transparent", fontSize: 15, fontWeight: 600 });
const tab = (active: boolean): CSSProperties => ({ padding: "10px 12px", borderRadius: 10, border: "1px solid " + (active ? "var(--accent, #2563eb)" : "#dbe2ea"), background: active ? "var(--accent, #2563eb)" : "#fff", color: active ? "#fff" : "#333", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left" });
const miniBtn: CSSProperties = { padding: "8px 12px", borderRadius: 9, border: "1px solid #d6dde6", background: "#fff", fontSize: 13, color: "#495057", cursor: "pointer" };
const iconBtn: CSSProperties = { width: 40, height: 40, flexShrink: 0, borderRadius: 9, border: "1px solid #d6dde6", background: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

export default function MobileDrawer(p: Props) {
  if (!p.open) return null;
  const go = (href: string) => { if (href !== p.path) window.location.href = href; else p.onClose(); };
  return (
    <>
      <div onClick={p.onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 40, animation: "snwfade 0.2s ease-out" }} />
      <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: "84%", maxWidth: 330, background: "var(--surface, #fff)", zIndex: 41, boxShadow: "8px 0 30px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", animation: "snwdrawer 0.24s cubic-bezier(0.2,0.8,0.2,1)", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 16px 8px" }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--accent, #5b5bd6)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{(p.abbr || "SNW").slice(0, 3)}</span>
          <strong style={{ fontSize: 16, color: "#1e293b", flex: 1 }}>同盟内マップ</strong>
          <button onClick={p.onClose} aria-label="閉じる" style={{ width: 36, height: 36, borderRadius: 18, border: "none", background: "#f1f3f5", color: "#495057", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} /></button>
        </div>

        <div style={{ padding: "0 14px 24px" }}>
          <div style={section}>メニュー</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.map(([href, icon]) => (
              <a key={href} href={href} onClick={(e) => { e.preventDefault(); go(href); }} style={navItem(p.path === href)}>
                <Icon name={icon} size={19} />{NAV_LABEL[href]}
              </a>
            ))}
            {p.canEdit && (
              <a href="/suggestions" onClick={(e) => { e.preventDefault(); go("/suggestions"); }} style={navItem(p.path === "/suggestions")}>
                <Icon name="edit" size={19} />変更提案
              </a>
            )}
          </div>

          <div style={section}>マップ切替</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {p.maps.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => { p.onSwitchMap(m.id); p.onClose(); }} style={{ ...tab(m.id === p.mapId), flex: 1 }}>{m.name}{m.isBase ? "（メイン）" : ""}</button>
                {p.canEdit && !m.isBase && <button onClick={() => p.onRenameMap(m.id)} aria-label="名前変更" style={iconBtn}>✏️</button>}
                {p.isOwner && !m.isBase && <button onClick={() => p.onRemoveMap(m.id)} aria-label="削除" style={{ ...iconBtn, color: "#e03131", borderColor: "#ffc9c9" }}>🗑</button>}
              </div>
            ))}
            {p.canEdit && <button onClick={() => p.onAddMap()} style={{ ...miniBtn, marginTop: 4, padding: "11px 12px", fontSize: 14, borderStyle: "dashed", textAlign: "center" }}>＋ マップを追加</button>}
          </div>

          <div style={{ ...section, display: "flex", alignItems: "center", gap: 5 }}><Icon name="star" size={13} />あなたの都市</div>
          <CitySelect cities={p.cityChoices} value={p.myCityId} onSelect={p.onSelectMyCity} />
          <div style={{ fontSize: 11.5, color: "#868e96", marginTop: 6 }}>選ぶと地図上で金色に強調され、開いたときに中央へ表示されます。</div>

          <div style={{ ...section, display: "flex", alignItems: "center", gap: 5 }}><Icon name="settings" size={13} />表示設定</div>
          <button onClick={p.onToggleTelop} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #e6eaf0", background: "#fff", cursor: "pointer" }}>
            <span style={{ fontSize: 15, color: "#222" }}>誕生日テロップ</span>
            <span style={{ width: 46, height: 26, borderRadius: 13, background: p.showTelop ? "var(--accent, #2563eb)" : "#cbd3dd", position: "relative", transition: "background 0.15s" }}>
              <span style={{ position: "absolute", top: 3, left: p.showTelop ? 23 : 3, width: 20, height: 20, borderRadius: 10, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.15s" }} />
            </span>
          </button>

          <div style={{ ...section, display: "flex", alignItems: "center", gap: 5 }}><Icon name="settings" size={13} />テーマ（この端末）</div>
          <ThemePicker />

          <div style={section}>アカウント</div>
          {p.me?.email ? (
            <div style={{ fontSize: 13, color: "#475569", padding: "0 2px 10px", wordBreak: "break-all" }}>ログイン中: <strong>{p.me.email}</strong>{p.me.isOwner ? "（オーナー）" : p.me.status === "approved" ? "（編集可）" : p.me.status === "pending" ? "（承認待ち）" : ""}</div>
          ) : (
            <div style={{ fontSize: 13, color: "#94a3b8", padding: "0 2px 10px" }}>未ログイン</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {!p.me?.email && <a href="/api/auth/login" style={{ ...tab(false), textAlign: "center", textDecoration: "none", background: "var(--accent, #1c7ed6)", color: "#fff", border: "none" }}>Google でログイン</a>}
            {p.me?.email && !(p.me.isOwner || p.me.status === "approved") && <a href="/account" style={{ ...tab(false), textAlign: "center", textDecoration: "none" }}>編集を申請する</a>}
            {p.me?.isOwner && <a href="/admin" style={{ ...tab(false), textAlign: "center", textDecoration: "none" }}>ユーザー管理</a>}
            {p.me?.email && <a href="/api/auth/logout" style={{ ...miniBtn, textAlign: "center", textDecoration: "none" }}>ログアウト</a>}
          </div>
        </div>
      </div>
    </>
  );
}
