import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { Me } from "../lib/api";
import { requestAccess } from "../lib/api";
import Icon from "./Icon";

const box: CSSProperties = {
  border: "1px solid #dee2e6",
  borderRadius: 8,
  padding: 20,
  background: "#fff",
  marginTop: 12,
};

export default function AccountPanel({
  me,
  onReload,
}: {
  me: Me | null;
  onReload: () => void;
}) {
  const [name, setName] = useState(me?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 未ログイン
  if (!me || me.email == null) {
    return (
      <div style={box}>
        <h3 style={{ marginTop: 0 }}>ログインが必要です</h3>
        <p style={{ fontSize: 14, color: "#495057" }}>
          編集申請には Google ログインが必要です。
        </p>
        <a href="/api/auth/login" style={{ ...btnPrimary, textDecoration: "none", display: "inline-block" }}>
          Google でログイン
        </a>
        <p style={{ marginTop: 16 }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: "#1c7ed6", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>← 地図に戻る</a>
        </p>
      </div>
    );
  }

  const approved = me.isOwner || me.status === "approved";
  const pending = me.status === "pending";
  const rejected = me.status === "rejected";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await requestAccess(name.trim());
      setDone(true);
      onReload();
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={box}>
      <h3 style={{ marginTop: 0 }}>編集申請</h3>
      <p style={{ fontSize: 13, color: "#868e96", marginTop: 0 }}>
        ログイン中: <strong>{me.email}</strong>
      </p>

      {approved ? (
        <p style={{ color: "#2f9e44", display: "flex", alignItems: "center", gap: 7 }}>
          <Icon name="check" size={17} />承認済みです。地図の「編集モード」が使えます。
        </p>
      ) : pending || done ? (
        <p style={{ color: "#f08c00", display: "flex", alignItems: "center", gap: 7 }}>
          <Icon name="clock" size={17} />申請を受け付けました。オーナーの承認をお待ちください。
        </p>
      ) : (
        <form onSubmit={submit}>
          {rejected && (
            <p style={{ color: "#e03131", fontSize: 13 }}>
              以前の申請は却下されています。再申請できます。
            </p>
          )}
          <div style={{ fontSize: 12, color: "#495057" }}>表示名</div>
          <input
            style={{
              width: "100%",
              padding: "11px 13px",
              border: "1px solid #ced4da",
              borderRadius: 8,
              boxSizing: "border-box",
              fontSize: 16,
            }}
            value={name}
            placeholder="例: たろう"
            onChange={(e) => setName(e.target.value)}
          />
          {err && (
            <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>
          )}
          <button
            type="submit"
            disabled={busy || name.trim() === ""}
            style={{ ...btnPrimary, marginTop: 12 }}
          >
            この内容で申請する
          </button>
        </form>
      )}

      <p style={{ marginTop: 16 }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: "#1c7ed6", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>← 地図に戻る</a>
      </p>
    </div>
  );
}

const btnPrimary: CSSProperties = {
  padding: "8px 16px",
  border: "none",
  borderRadius: 6,
  background: "#1c7ed6",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};
