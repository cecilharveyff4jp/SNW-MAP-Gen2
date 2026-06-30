import { useState } from "react";
import type { FormEvent } from "react";
import type { Me } from "../lib/api";
import { requestAccess } from "../lib/api";
import { card, input, fieldLabel, btnPrimary, btnGhost } from "../lib/styles";
import Icon from "./Icon";

export default function AccountPanel({ me, onReload }: { me: Me | null; onReload: () => void }) {
  const [name, setName] = useState(me?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const back = <p style={{ marginTop: 16 }}><a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a></p>;

  // 未ログイン
  if (!me || me.email == null) {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
          <span style={{ color: "var(--accent, #1c7ed6)", display: "inline-flex" }}><Icon name="lock" size={20} /></span>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#1b2330" }}>ログインが必要です</h2>
        </div>
        <p style={{ fontSize: 14, color: "#495057", marginTop: 0 }}>編集申請には Google または Discord ログインが必要です。</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 280 }}>
          <a href="/api/auth/login" style={{ ...btnPrimary, textDecoration: "none" }}>Google でログイン</a>
          <a href="/api/auth/discord/login" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 18px", borderRadius: 10, background: "#5865F2", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Discord でログイン</a>
        </div>
        {back}
      </div>
    );
  }

  const approved = me.isOwner || me.status === "approved";
  const pending = me.status === "pending";
  const rejected = me.status === "rejected";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await requestAccess(name.trim()); setDone(true); onReload(); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        <span style={{ color: "var(--accent, #1c7ed6)", display: "inline-flex" }}><Icon name="edit" size={20} /></span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#1b2330" }}>編集申請</h2>
      </div>
      <p style={{ fontSize: 13, color: "#7a8699", marginTop: 0 }}>ログイン中: <strong style={{ color: "#33404f" }}>{me.email}</strong></p>

      {approved ? (
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 15px", borderRadius: 12, background: "#e9f8ee", color: "#2b8a3e", fontWeight: 600, fontSize: 14 }}>
          <Icon name="check" size={18} />承認済みです。地図の「編集モード」が使えます。
        </div>
      ) : pending || done ? (
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 15px", borderRadius: 12, background: "#fff5e6", color: "#e8730c", fontWeight: 600, fontSize: 14 }}>
          <Icon name="clock" size={18} />申請を受け付けました。オーナーの承認をお待ちください。
        </div>
      ) : (
        <form onSubmit={submit}>
          {rejected && <p style={{ color: "#e03131", fontSize: 13 }}>以前の申請は却下されています。再申請できます。</p>}
          <label style={fieldLabel}>表示名</label>
          <input style={input} value={name} placeholder="例: たろう" onChange={(e) => setName(e.target.value)} />
          {err && <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>}
          <button type="submit" disabled={busy || name.trim() === ""} style={{ ...btnPrimary, marginTop: 14 }}>この内容で申請する</button>
        </form>
      )}

      {back}
    </div>
  );
}
