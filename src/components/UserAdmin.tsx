import { useEffect, useState } from "react";
import type { Me, UserRow } from "../lib/api";
import { listUsers, setUserStatus } from "../lib/api";
import { card, btnGhost } from "../lib/styles";
import Icon from "./Icon";
import SwipeRow from "./SwipeRow";

const STATUS_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  pending: { text: "申請中", bg: "#fff3e0", color: "#e8730c" },
  approved: { text: "承認済み", bg: "#e9f8ee", color: "#2b8a3e" },
  rejected: { text: "却下", bg: "#fdecec", color: "#d6403a" },
};

function initials(name: string | null, email: string): string {
  const s = (name || email || "?").trim();
  return s.slice(0, 2).toUpperCase();
}

export default function UserAdmin({ me }: { me: Me | null }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setUsers(await listUsers()); setErr(null); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const back = (
    <p style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a>
      <a href="/admin/log" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="refresh" size={15} />操作履歴</a>
    </p>
  );

  if (me && me.email != null && !me.isOwner) {
    return (<div style={card}><p style={{ marginTop: 0 }}>この画面はオーナー専用です。</p>{back}</div>);
  }

  async function decide(email: string, status: "approved" | "rejected") {
    try { await setUserStatus(email, status); load(); }
    catch (e) { setErr(String((e as Error).message || e)); }
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span style={{ color: "var(--accent, #1c7ed6)", display: "inline-flex" }}><Icon name="settings" size={20} /></span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#1b2330" }}>ユーザー管理</h2>
      </div>
      <p style={{ fontSize: 13, color: "#7a8699", margin: "0 0 14px" }}>編集の申請を承認・却下します。</p>
      {err && <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>}
      {loading ? (
        <p style={{ color: "#868e96" }}>読み込み中…</p>
      ) : users.length === 0 ? (
        <p style={{ color: "#868e96", fontSize: 14 }}>申請はまだありません。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map((u) => {
            const s = STATUS_LABEL[u.status] ?? { text: u.status, bg: "#f1f3f5", color: "#868e96" };
            return (
              <SwipeRow key={u.email} radius={12} gap={11} contentStyle={{ padding: "11px 13px", border: "1px solid var(--border, #eef1f4)", fontSize: 13 }}
                primary={u.status !== "approved" ? { icon: "check", label: "承認", bg: "#2f9e44", onAct: () => decide(u.email, "approved") } : undefined}
                danger={u.status !== "rejected" ? { icon: "close", label: "却下", bg: "#d6403a", onAct: () => decide(u.email, "rejected") } : undefined}>
                <span style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--accent-soft, #e7f0fb)", color: "var(--accent-strong, #1b5fa8)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{initials(u.display_name, u.email)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 14 }}>{u.display_name || "(名前なし)"}</strong>
                  <span style={{ display: "block", color: "#868e96", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</span>
                </span>
                <span style={{ background: s.bg, color: s.color, fontWeight: 600, fontSize: 12, padding: "4px 10px", borderRadius: 999, flexShrink: 0 }}>{s.text}</span>
              </SwipeRow>
            );
          })}
        </div>
      )}
      {back}
    </div>
  );
}
