import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { listMusic, createMusic, updateMusic, deleteMusic, type MusicItem } from "../lib/api";
import { getEmbedUrl } from "../lib/music";
import { useDialog } from "./Dialog";

const card: CSSProperties = { border: "1px solid #dee2e6", borderRadius: 12, padding: 18, background: "#fff", marginTop: 12 };
const input: CSSProperties = { padding: "10px 12px", border: "1px solid #ced4da", borderRadius: 8, fontSize: 16, boxSizing: "border-box", width: "100%" };
const btnSm: CSSProperties = { padding: "5px 10px", border: "1px solid #e3e6ea", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#495057" };

export default function MusicPage({ canEdit }: { canEdit: boolean }) {
  const dlg = useDialog();
  const [music, setMusic] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"alliance" | "city">("alliance");
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try { setMusic(await listMusic()); setErr(null); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!title.trim() || !url.trim()) return;
    setBusy(true); setErr(null);
    try {
      if (editId == null) await createMusic(title.trim(), url.trim(), type);
      else await updateMusic(editId, { title: title.trim(), url: url.trim(), type });
      setTitle(""); setUrl(""); setType("alliance"); setEditId(null); await load();
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }
  function startEdit(m: MusicItem) { setEditId(m.id); setTitle(m.title); setUrl(m.url); setType(m.type); }
  async function remove(id: number) {
    if (!(await dlg.confirm({ title: "曲を削除", message: "この曲を削除します。よろしいですか？", okLabel: "削除する", danger: true }))) return;
    setBusy(true);
    try { await deleteMusic(id); if (editId === id) { setEditId(null); setTitle(""); setUrl(""); } if (playing === id) setPlaying(null); await load(); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }

  const sections: { key: "alliance" | "city"; label: string; icon: string }[] = [
    { key: "alliance", label: "同盟全体の曲", icon: "🏰" },
    { key: "city", label: "都市メンバーの曲", icon: "🏛️" },
  ];

  return (
    <div>
      {err && <div style={card}><p style={{ color: "#e03131", margin: 0 }}>{err}</p></div>}
      {loading ? (
        <div style={card}>読み込み中…</div>
      ) : (
        sections.map((sec) => {
          const list = music.filter((m) => m.type === sec.key);
          return (
            <div key={sec.key} style={card}>
              <h2 style={{ marginTop: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>🎵 {sec.label}<span style={{ fontSize: 12, fontWeight: 600, color: "#adb5bd" }}>{list.length}曲</span></h2>
              {list.length === 0 ? (
                <p style={{ color: "#868e96", fontSize: 14 }}>まだ曲がありません。</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {list.map((m) => {
                    const isPlaying = playing === m.id;
                    return (
                      <div key={m.id} onClick={() => setPlaying(isPlaying ? null : m.id)} style={{ border: "1px solid " + (isPlaying ? "#d0bfff" : "#eef1f4"), borderRadius: 12, padding: 12, cursor: "pointer", background: isPlaying ? "#f3f0ff" : "#fff", transition: "background 0.15s, border-color 0.15s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                          <div style={{ width: 42, height: 42, borderRadius: 11, background: isPlaying ? "linear-gradient(135deg,#7048e8,#9775fa)" : "#f1f3f5", color: isPlaying ? "#fff" : "#7048e8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0, boxShadow: isPlaying ? "0 4px 12px rgba(112,72,232,0.35)" : "none" }}>{isPlaying ? "⏸" : "▶"}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title || "（タイトルなし）"}</div>
                            {isPlaying ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                                <span style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 16 }}>
                                  <span style={{ width: 3, background: "#10b981", borderRadius: 2, animation: "eqw1 0.6s infinite ease-in-out" }} />
                                  <span style={{ width: 3, background: "#10b981", borderRadius: 2, animation: "eqw2 0.6s infinite ease-in-out 0.12s" }} />
                                  <span style={{ width: 3, background: "#10b981", borderRadius: 2, animation: "eqw3 0.6s infinite ease-in-out 0.24s" }} />
                                </span>
                                <span style={{ fontSize: 11, color: "#059669", fontWeight: 800, letterSpacing: "0.06em" }}>NOW PLAYING</span>
                              </div>
                            ) : (
                              <div style={{ fontSize: 12, color: "#868e96", marginTop: 2 }}>{sec.icon} {sec.key === "alliance" ? "同盟全体" : "都市メンバー"}・タップで再生</div>
                            )}
                          </div>
                          {canEdit && (
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => startEdit(m)} disabled={busy} style={btnSm}>編集</button>
                              <button onClick={() => remove(m.id)} disabled={busy} style={{ ...btnSm, color: "#e03131", borderColor: "#ffc9c9" }}>削除</button>
                            </div>
                          )}
                        </div>
                        {isPlaying && (
                          <iframe title={m.title} src={getEmbedUrl(m.url)} style={{ width: "100%", height: 180, border: "none", borderRadius: 10, marginTop: 11 }} allow="autoplay; encrypted-media" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {canEdit && (
        <div style={card}>
          <h3 style={{ margin: "0 0 10px" }}>{editId == null ? "曲を追加" : "曲を編集"}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input style={input} placeholder="曲名" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input style={input} placeholder="Suno / YouTube のURL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div style={{ display: "flex", background: "#eef1f4", borderRadius: 10, padding: 4, gap: 4 }}>
              {([["alliance", "同盟全体"], ["city", "都市メンバー"]] as const).map(([val, lbl]) => {
                const on = type === val;
                return (
                  <button key={val} type="button" onClick={() => setType(val)} aria-pressed={on} style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: on ? 700 : 600, color: on ? "#111" : "#868e96", background: on ? "#fff" : "transparent", boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : "none", transition: "background 0.15s" }}>{lbl}</button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={submit} disabled={busy || !title.trim() || !url.trim()} style={{ padding: "10px 18px", border: "none", borderRadius: 8, background: "#7048e8", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{editId == null ? "追加" : "更新"}</button>
              {editId != null && <button onClick={() => { setEditId(null); setTitle(""); setUrl(""); setType("alliance"); }} style={{ padding: "10px 18px", border: "1px solid #ced4da", borderRadius: 8, background: "#fff", cursor: "pointer" }}>キャンセル</button>}
            </div>
          </div>
        </div>
      )}
      <p style={{ marginTop: 16, marginLeft: 4 }}><a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: "#1c7ed6", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>← 地図に戻る</a></p>
      <style>{"@keyframes eqw1{0%,100%{height:6px}50%{height:16px}}@keyframes eqw2{0%,100%{height:16px}50%{height:6px}}@keyframes eqw3{0%,100%{height:9px}50%{height:16px}}"}</style>
    </div>
  );
}
