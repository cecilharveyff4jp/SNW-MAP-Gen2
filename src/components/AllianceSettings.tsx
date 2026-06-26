import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { Me } from "../lib/api";
import { getSettings, updateSettings } from "../lib/api";

const card: CSSProperties = { border: "1px solid #dee2e6", borderRadius: 10, padding: 20, background: "#fff", marginTop: 12 };
const labelStyle: CSSProperties = { fontSize: 12, color: "#495057", marginBottom: 4 };
const inputStyle: CSSProperties = { width: "100%", padding: "9px 11px", border: "1px solid #ced4da", borderRadius: 8, fontSize: 15, boxSizing: "border-box" };

export default function AllianceSettings({ me }: { me: Me | null }) {
  const isOwner = !!me?.isOwner;
  const [serverNo, setServerNo] = useState("");
  const [allianceName, setAllianceName] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((s) => { setServerNo(s.serverNo); setAllianceName(s.allianceName); setNote(s.note); })
      .catch(() => { /* noop */ }).finally(() => setLoading(false));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      await updateSettings({ serverNo, allianceName, note });
      setMsg("保存しました。地図のタイトルに反映されます。");
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally { setBusy(false); }
  }

  if (loading) return <div style={card}>読み込み中…</div>;

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>⚙ 同盟情報</h2>
      <p style={{ fontSize: 13, color: "#868e96", marginTop: 0 }}>サーバー番号や同盟の正式名称を設定します。地図のロゴ・タイトルに表示されます。</p>

      {isOwner ? (
        <form onSubmit={submit}>
          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>同盟の正式名称</div>
            <input style={inputStyle} value={allianceName} placeholder="例: SNOW" onChange={(e) => setAllianceName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>サーバー番号</div>
            <input style={inputStyle} value={serverNo} placeholder="例: 1234" onChange={(e) => setServerNo(e.target.value)} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>ひとことメモ・説明（任意）</div>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={note} placeholder="同盟の方針・告知など" onChange={(e) => setNote(e.target.value)} />
          </div>
          {err && <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>}
          {msg && <p style={{ color: "#2f9e44", fontSize: 13 }}>{msg}</p>}
          <button type="submit" disabled={busy} style={{ padding: "10px 18px", border: "none", borderRadius: 8, background: "#1c7ed6", color: "#fff", fontWeight: 700, cursor: "pointer" }}>保存する</button>
        </form>
      ) : (
        <div style={{ fontSize: 14, color: "#333" }}>
          <p><strong>同盟名:</strong> {allianceName || "（未設定）"}</p>
          <p><strong>サーバー:</strong> {serverNo || "（未設定）"}</p>
          {note && <p style={{ whiteSpace: "pre-wrap" }}><strong>メモ:</strong> {note}</p>}
          <p style={{ color: "#868e96", fontSize: 13 }}>編集できるのはオーナーのみです。</p>
        </div>
      )}

      <p style={{ marginTop: 16 }}><a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: "#1c7ed6", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>← 地図に戻る</a></p>
    </div>
  );
}
