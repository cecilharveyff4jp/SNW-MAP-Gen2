import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { listLinks, createLink, updateLink, deleteLink, type LinkItem } from "../lib/api";

const card: CSSProperties = { border: "1px solid #dee2e6", borderRadius: 10, padding: 20, background: "#fff", marginTop: 12 };
const input: CSSProperties = { padding: "7px 9px", border: "1px solid #ced4da", borderRadius: 6, fontSize: 14, boxSizing: "border-box" };

export default function LinksPage({ canEdit }: { canEdit: boolean }) {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try { setLinks(await listLinks()); setErr(null); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!label.trim() || !url.trim()) return;
    setBusy(true); setErr(null);
    try {
      if (editId == null) await createLink(label.trim(), url.trim());
      else await updateLink(editId, { label: label.trim(), url: url.trim() });
      setLabel(""); setUrl(""); setEditId(null); await load();
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }
  function startEdit(l: LinkItem) { setEditId(l.id); setLabel(l.label); setUrl(l.url); }
  async function remove(id: number) {
    if (!confirm("このリンクを削除しますか？")) return;
    setBusy(true);
    try { await deleteLink(id); if (editId === id) { setEditId(null); setLabel(""); setUrl(""); } await load(); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0 }}>リンク集</h2>
      {err && <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>}
      {loading ? (
        <p>読み込み中…</p>
      ) : links.length === 0 ? (
        <p style={{ color: "#868e96" }}>まだリンクがありません。{canEdit ? "下から追加してください。" : ""}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {links.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid #f1f3f5", borderRadius: 8 }}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, color: "#1c7ed6", fontWeight: 600, textDecoration: "none" }}>
                🔗 {l.label}
              </a>
              {canEdit && (
                <>
                  <button onClick={() => startEdit(l)} disabled={busy} style={btnSm}>編集</button>
                  <button onClick={() => remove(l.id)} disabled={busy} style={{ ...btnSm, color: "#e03131" }}>削除</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div style={{ marginTop: 18, borderTop: "1px solid #f1f3f5", paddingTop: 14 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{editId == null ? "リンクを追加" : "リンクを編集"}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input style={input} placeholder="表示名（例: 公式Discord）" value={label} onChange={(e) => setLabel(e.target.value)} />
            <input style={input} placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={submit} disabled={busy || !label.trim() || !url.trim()} style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "#1c7ed6", color: "#fff", fontWeight: 600, cursor: "pointer" }}>{editId == null ? "追加" : "更新"}</button>
              {editId != null && <button onClick={() => { setEditId(null); setLabel(""); setUrl(""); }} style={{ padding: "8px 16px", border: "1px solid #ced4da", borderRadius: 6, background: "#fff", cursor: "pointer" }}>キャンセル</button>}
            </div>
          </div>
        </div>
      )}
      <p style={{ marginTop: 16 }}><a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: "#1c7ed6", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>← 地図に戻る</a></p>
    </div>
  );
}

const btnSm: CSSProperties = { padding: "4px 10px", border: "1px solid #ced4da", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12 };
