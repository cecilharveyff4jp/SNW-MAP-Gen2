import type { CSSProperties } from "react";

// 画面共通のProデザインキット。テーマ変数(--accent/--surface/--border等)に連動。
// 既存名(card/input/btnSm/ordBtn)は後方互換のため維持しつつ刷新。

export const card: CSSProperties = { border: "1px solid var(--border, #e3e8ef)", borderRadius: 16, padding: "20px 22px", background: "var(--surface, #fff)", marginTop: 14, boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.05)" };

// input は iOS のフォーカス時ズーム回避のため fontSize 16 を維持する。
export const input: CSSProperties = { padding: "11px 13px", border: "1px solid var(--border, #d7dee7)", borderRadius: 10, fontSize: 16, boxSizing: "border-box", width: "100%", background: "#fff", color: "#1f2630" };

export const fieldLabel: CSSProperties = { fontSize: 12, fontWeight: 600, color: "#5a6677", marginBottom: 5, display: "block" };

export const btnPrimary: CSSProperties = { padding: "10px 18px", border: "none", borderRadius: 10, background: "var(--accent, #1c7ed6)", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,0.14)", display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "center" };
export const btnGhost: CSSProperties = { padding: "9px 15px", border: "1px solid var(--border, #d7dee7)", borderRadius: 10, background: "#fff", color: "#33404f", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "center" };
export const btnDanger: CSSProperties = { padding: "9px 15px", border: "1px solid #f3c0c0", borderRadius: 10, background: "#fff", color: "#d6403a", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "center" };

export const btnSm: CSSProperties = { padding: "6px 11px", border: "1px solid var(--border, #e3e8ef)", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#475063", display: "inline-flex", alignItems: "center", gap: 5 };
export const ordBtn: CSSProperties = { width: 26, height: 21, border: "1px solid var(--border, #e3e8ef)", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11, color: "#7a8699", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 };

export const pageTitle: CSSProperties = { fontSize: 20, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 9, color: "#1b2330" };
export const pageLead: CSSProperties = { fontSize: 13, color: "#7a8699", marginTop: 0, marginBottom: 4 };
export const sectionTitle: CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: "#5a6677", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 7, textTransform: "uppercase" };

export const pill: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, border: "1px solid var(--border, #e3e8ef)", background: "#fff", fontSize: 12, fontWeight: 600, color: "#475063" };
export const badgeSoft: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, background: "var(--accent-soft, #e7f0fb)", color: "var(--accent-strong, #1b5fa8)", fontSize: 12, fontWeight: 600 };
export const hr: CSSProperties = { border: "none", borderTop: "1px solid var(--border, #eceff3)", margin: "16px 0" };
