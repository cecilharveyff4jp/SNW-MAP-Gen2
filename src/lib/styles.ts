import type { CSSProperties } from "react";

// 画面共通のスタイル定数（カード/入力/小ボタン/並び替えボタン）。
export const card: CSSProperties = { border: "1px solid var(--border, #dee2e6)", borderRadius: 12, padding: 18, background: "var(--surface, #fff)", marginTop: 12 };
export const input: CSSProperties = { padding: "10px 12px", border: "1px solid #ced4da", borderRadius: 8, fontSize: 16, boxSizing: "border-box", width: "100%" };
export const btnSm: CSSProperties = { padding: "5px 10px", border: "1px solid #e3e6ea", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#495057" };
export const ordBtn: CSSProperties = { width: 24, height: 19, border: "1px solid #e3e6ea", borderRadius: 5, background: "#fff", cursor: "pointer", fontSize: 10, color: "#868e96", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 };
