import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { listMusic, createMusic, updateMusic, deleteMusic, type MusicItem } from "../lib/api";
import { getEmbedUrl } from "../lib/music";

const card: CSSProperties = { border: "1px solid #dee2e6", borderRadius: 10, padding: 20, background: "#fff", marginTop: 12 };
const input: CSSProperties = { padding: "7px 9px", border: "1px solid #ced4da", borderRadius: 6, fontSize: 14, boxSizing: "border-box", width: "100%" };
const btnSm: CSSProperties = { padding: "4px 10px", border: "1px solid #ced4da", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12 };

export default function MusicPage({ canEdit }: { canEdit: boolean }) {
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
    if (!confirm("この曲を削除しますか？")) return;
    setBusy(true);
    try { await deleteMusic(id); if (editId === id) { setEditId(null); setTitle(""); setUrl(""); } if (playing === id) setPlaying(null); await load(); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }

  const sections: { key: "alliance" | "city"; label: string }[] = [
    { key: "alliance", label: "同盟全体の曲" },
    { key: "city", label: "都市メンバーの曲" },
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
              <h2 style={{ marginTop: 0 }}>🎵 {sec.label}</h2>
              {list.length === 0 ? (
                <p style={{ color: "#868e96" }}>まだ曲がありません。</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {list.map((m) => (
                    <div key={m.id} style={{ border: "1px solid #f1f3f5", borderRadius: 8, padding: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 600 }}>{m.title}</span>
                        <button onClick={() => setPlaying(playing === m.id ? null : m.id)} style={{ ...btnSm, background: playing === m.id ? "#e7f5ff" : "#fff", color: "#1c7ed6", fontWeight: 600 }}>{playing === m.id ? "閉じる" : "▶ 再生"}</button>
                        {canEdit && (<><button onClick={() => startEdit(m)} disabled={busy} style={btnSm}>編集</button><button onClick={() => remove(m.id)} disabled={busy} style={{ ...btnSm, color: "#e03131" }}>削除</button></>)}
                      </div>
                      {playing === m.id && (
                        <iframe title={m.title} src={getEmbedUrl(m.url)} style={{ width: "100%", height: 180, border: "none", borderRadius: 8, marginTop: 8 }} allow="autoplay; encrypted-media" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {canEdit && (
        <div style={card}>
          <h3 style={{ margin: "0 0 8px" }}>{editId == null ? "曲を追加" : "曲を編集"}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input style={input} placeholder="曲名" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input style={input} placeholder="Suno / YouTube のURL" value={url} onChange={(e) => setUrl(e.target.value)} />
            <select style={input} value={type} onChange={(e) => setType(e.target.value as "alliance" | "city")}>
              <option value="alliance">同盟全体</option>
              <option value="city">都市メンバー</option>
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={submit} disabled={busy || !title.trim() || !url.trim()} style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "#a855f7", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{editId == null ? "追加" : "更新"}</button>
              {editId != null && <button onClick={() => { setEditId(null); setTitle(""); setUrl(""); setType("alliance"); }} style={{ padding: "8px 16px", border: "1px solid #ced4da", borderRadius: 6, background: "#fff", cursor: "pointer" }}>キャンセル</button>}
            </div>
          </div>
        </div>
      )}
      <p style={{ marginTop: 16, marginLeft: 4 }}><a href="/" style={{ fontSize: 13 }}>← 地図に戻る</a></p>
    </div>
  );
}
