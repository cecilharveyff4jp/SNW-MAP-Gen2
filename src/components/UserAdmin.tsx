import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Me, UserRow } from "../lib/api";
import { listUsers, setUserStatus } from "../lib/api";

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pending: { text: "申請中", color: "#f08c00" },
  approved: { text: "承認済み", color: "#2f9e44" },
  rejected: { text: "却下", color: "#e03131" },
};

export default function UserAdmin({ me }: { me: Me | null }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setUsers(await listUsers());
      setErr(null);
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (me && me.email != null && !me.isOwner) {
    return (
      <div style={box}>
        <p>この画面はオーナー専用です。</p>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: "#1c7ed6", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>← 地図に戻る</a>
      </div>
    );
  }

  async function decide(
    email: string,
    status: "approved" | "rejected"
  ) {
    try {
      await setUserStatus(email, status);
      load();
    } catch (e) {
      setErr(String((e as Error).message || e));
    }
  }

  return (
    <div style={box}>
      <h3 style={{ marginTop: 0 }}>ユーザー管理</h3>
      {err && <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>}
      {loading ? (
        <p>読み込み中…</p>
      ) : users.length === 0 ? (
        <p style={{ color: "#868e96", fontSize: 14 }}>申請はまだありません。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {users.map((u) => {
            const s = STATUS_LABEL[u.status] ?? { text: u.status, color: "#868e96" };
            return (
              <div
                key={u.email}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  border: "1px solid #f1f3f5",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <span style={{ flex: 1 }}>
                  <strong>{u.display_name || "(名前なし)"}</strong>
                  <br />
                  <span style={{ color: "#868e96" }}>{u.email}</span>
                </span>
                <span style={{ color: s.color, fontWeight: 600, minWidth: 56 }}>
                  {s.text}
                </span>
                {u.status !== "approved" && (
                  <button onClick={() => decide(u.email, "approved")} style={btnOk}>
                    承認
                  </button>
                )}
                {u.status !== "rejected" && (
                  <button onClick={() => decide(u.email, "rejected")} style={btnNg}>
                    却下
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p style={{ marginTop: 16 }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: "#1c7ed6", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>← 地図に戻る</a>
      </p>
    </div>
  );
}

const box: CSSProperties = {
  border: "1px solid #dee2e6",
  borderRadius: 8,
  padding: 20,
  background: "#fff",
  marginTop: 12,
};
const btnOk: CSSProperties = {
  padding: "4px 12px",
  border: "none",
  borderRadius: 6,
  background: "#2f9e44",
  color: "#fff",
  cursor: "pointer",
  fontSize: 12,
};
const btnNg: CSSProperties = {
  padding: "4px 12px",
  border: "1px solid #ced4da",
  borderRadius: 6,
  background: "#fff",
  color: "#e03131",
  cursor: "pointer",
  fontSize: 12,
};
