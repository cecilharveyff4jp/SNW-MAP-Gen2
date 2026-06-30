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

  // 未ログイン：プロバイダ選択画面（PC・スマホ共通）
  if (!me || me.email == null) {
    const GoogleMark = (
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    );
    const DiscordMark = (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.036A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    );
    const row = { display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none" } as const;
    return (
      <div style={{ ...card, maxWidth: 420, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 56, height: 56, margin: "2px auto 14px", borderRadius: 16, background: "var(--accent-soft, #ededfc)", color: "var(--accent, #5b5bd6)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="lock" size={26} /></div>
          <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#1b2330" }}>ログイン</h2>
          <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "#7a8699", lineHeight: 1.6 }}>編集申請にはログインが必要です。<br />お使いのアカウントを選んでください。</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <a href="/api/auth/login" data-pressable style={{ ...row, background: "var(--surface, #fff)", border: "1px solid var(--border, #dbe0ea)", color: "#1f2630", boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}>
            {GoogleMark}<span style={{ flex: 1 }}>Google で続ける</span>
          </a>
          <a href="/api/auth/discord/login" data-pressable style={{ ...row, background: "#5865F2", border: "1px solid #5865F2", color: "#fff", boxShadow: "0 4px 12px rgba(88,101,242,0.32)" }}>
            {DiscordMark}<span style={{ flex: 1 }}>Discord で続ける</span>
          </a>
        </div>
        <p style={{ margin: "18px 0 0", fontSize: 11.5, color: "#aab2c0", textAlign: "center", lineHeight: 1.6 }}>取得するのはメールアドレスのみです。<br />同じメールなら Google / Discord どちらでも同一ユーザー扱いです。</p>
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
