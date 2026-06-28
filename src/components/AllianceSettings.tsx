import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Me } from "../lib/api";
import { getSettings, updateSettings } from "../lib/api";
import { card, input, fieldLabel, btnPrimary, btnGhost } from "../lib/styles";
import Icon from "./Icon";

export default function AllianceSettings({ me }: { me: Me | null }) {
  const isOwner = !!me?.isOwner;
  const [serverNo, setServerNo] = useState("");
  const [allianceName, setAllianceName] = useState("");
  const [abbr, setAbbr] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((s) => { setServerNo(s.serverNo); setAllianceName(s.allianceName); setAbbr(s.abbr); setNote(s.note); })
      .catch(() => { /* noop */ }).finally(() => setLoading(false));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      await updateSettings({ serverNo, allianceName, abbr, note });
      setMsg("保存しました。地図のタイトルに反映されます。");
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally { setBusy(false); }
  }

  const back = <p style={{ marginTop: 16 }}><a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a></p>;

  if (loading) return <div style={card}>読み込み中…</div>;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span style={{ color: "var(--accent, #1c7ed6)", display: "inline-flex" }}><Icon name="settings" size={20} /></span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#1b2330" }}>同盟情報</h2>
      </div>
      <p style={{ fontSize: 13, color: "#7a8699", margin: "0 0 16px" }}>サーバー番号や同盟の正式名称を設定します。地図のロゴ・タイトルに表示されます。</p>

      {isOwner ? (
        <form onSubmit={submit}>
          <div style={{ marginBottom: 13 }}>
            <label style={fieldLabel}>同盟の正式名称</label>
            <input style={input} value={allianceName} placeholder="例: SNOW" onChange={(e) => setAllianceName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 13 }}>
            <label style={fieldLabel}>同盟略称（ロゴ表示・最大12文字／未入力ならSNW）</label>
            <input style={input} value={abbr} placeholder="例: SNW" onChange={(e) => setAbbr(e.target.value)} />
          </div>
          <div style={{ marginBottom: 13 }}>
            <label style={fieldLabel}>サーバー番号</label>
            <input style={input} value={serverNo} placeholder="例: 1234" onChange={(e) => setServerNo(e.target.value)} />
          </div>
          <div style={{ marginBottom: 13 }}>
            <label style={fieldLabel}>ひとことメモ・説明（任意）</label>
            <textarea style={{ ...input, minHeight: 140, resize: "vertical" }} value={note} placeholder="同盟の方針・告知など" onChange={(e) => setNote(e.target.value)} />
          </div>
          {err && <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>}
          {msg && <p style={{ color: "#2f9e44", fontSize: 13 }}>{msg}</p>}
          <button type="submit" disabled={busy} style={btnPrimary}>保存する</button>
        </form>
      ) : (
        <div style={{ fontSize: 14, color: "#333" }}>
          <p><strong>同盟名:</strong> {allianceName || "（未設定）"}</p>
          <p><strong>サーバー:</strong> {serverNo || "（未設定）"}</p>
          {note && <p style={{ whiteSpace: "pre-wrap" }}><strong>メモ:</strong> {note}</p>}
          <p style={{ color: "#868e96", fontSize: 13 }}>編集できるのはオーナーのみです。</p>
        </div>
      )}

      {back}
    </div>
  );
}
