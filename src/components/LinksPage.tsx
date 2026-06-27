import { useState, useEffect } from "react";
import { listLinks, createLink, updateLink, deleteLink, type LinkItem } from "../lib/api";
import { card, input, btnSm, ordBtn } from "../lib/styles";
import { confirmDelete } from "../lib/confirm";
import { useReorder } from "../hooks/useReorder";
import { useDialog } from "./Dialog";
import Icon from "./Icon";

export default function LinksPage({ canEdit }: { canEdit: boolean }) {
  const dlg = useDialog();
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [aLabel, setALabel] = useState("");
  const [aUrl, setAUrl] = useState("");
  const [aDesc, setADesc] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [eLabel, setELabel] = useState("");
  const [eUrl, setEUrl] = useState("");
  const [eDesc, setEDesc] = useState("");

  async function load() {
    setLoading(true);
    try { setLinks(await listLinks()); setErr(null); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const { move, flashId, moving } = useReorder<LinkItem>(updateLink, load, setErr);

  async function submitAdd() {
    if (!aLabel.trim() || !aUrl.trim()) return;
    setBusy(true); setErr(null);
    try {
      await createLink({ label: aLabel.trim(), url: aUrl.trim(), description: aDesc.trim() });
      setALabel(""); setAUrl(""); setADesc(""); setAddOpen(false); await load();
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }
  function startEdit(l: LinkItem) { setEditId(l.id); setELabel(l.label); setEUrl(l.url); setEDesc(l.description); }
  function cancelEdit() { setEditId(null); }
  async function submitEdit() {
    if (editId == null || !eLabel.trim() || !eUrl.trim()) return;
    setBusy(true); setErr(null);
    try {
      await updateLink(editId, { label: eLabel.trim(), url: eUrl.trim(), description: eDesc.trim() });
      setEditId(null); await load();
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }
  async function remove(id: number) {
    if (!(await confirmDelete(dlg, "リンク"))) return;
    setBusy(true);
    try { await deleteLink(id); if (editId === id) setEditId(null); await load(); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }

  const ordered = links.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>リンク集</h2>
      {err && <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>}
      {loading ? (
        <p>読み込み中…</p>
      ) : ordered.length === 0 ? (
        <p style={{ color: "#868e96" }}>まだリンクがありません。{canEdit ? "下から追加してください。" : ""}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {ordered.map((l, idx) => {
            if (editId === l.id) {
              return (
                <div key={l.id} style={{ border: "1.5px solid #f59f00", borderRadius: 11, padding: 12, background: "#fff8ef" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#e8590c", marginBottom: 10 }}><Icon name="edit" size={14} />このリンクを編集中</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input style={input} placeholder="表示名（例: 公式Discord）" value={eLabel} onChange={(e) => setELabel(e.target.value)} />
                    <input style={input} placeholder="https://..." value={eUrl} onChange={(e) => setEUrl(e.target.value)} />
                    <input style={input} placeholder="概要説明（任意）" value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button onClick={submitEdit} disabled={busy || !eLabel.trim() || !eUrl.trim()} style={{ padding: "10px 18px", border: "none", borderRadius: 8, background: "#f08c00", color: "#fff", fontWeight: 700, cursor: "pointer" }}>保存する</button>
                      <button onClick={cancelEdit} disabled={busy} style={{ padding: "10px 16px", border: "1px solid #ced4da", borderRadius: 8, background: "#fff", cursor: "pointer", fontWeight: 600, color: "#495057" }}>キャンセル</button>
                      <div style={{ flex: 1 }} />
                      <button onClick={() => remove(l.id)} disabled={busy} style={{ padding: "10px 14px", border: "1px solid #ffc9c9", borderRadius: 8, background: "#fff", color: "#e03131", cursor: "pointer", fontWeight: 600 }}>削除</button>
                    </div>
                  </div>
                </div>
              );
            }
            const isFlash = flashId === l.id;
            return (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", border: "1px solid " + (isFlash ? "#ffd43b" : "#eef1f4"), borderRadius: 11, background: isFlash ? "#fff3bf" : "#fff", transition: "background 0.4s ease, border-color 0.4s ease" }}>
                {canEdit && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                    <button onClick={() => move(ordered, l, "up", setLinks)} disabled={busy || moving || idx === 0} aria-label="上へ" style={{ ...ordBtn, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                    <button onClick={() => move(ordered, l, "down", setLinks)} disabled={busy || moving || idx === ordered.length - 1} aria-label="下へ" style={{ ...ordBtn, opacity: idx === ordered.length - 1 ? 0.3 : 1 }}>▼</button>
                  </div>
                )}
                <span style={{ color: "var(--accent, #1c7ed6)", flexShrink: 0, display: "inline-flex" }}><Icon name="link" size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent, #1c7ed6)", fontWeight: 600, textDecoration: "none", fontSize: 14.5, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.label}</a>
                  {l.description && <div style={{ fontSize: 11.5, color: "#868e96", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.description}</div>}
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => startEdit(l)} disabled={busy} style={btnSm}>編集</button>
                    <button onClick={() => remove(l.id)} disabled={busy} style={{ ...btnSm, color: "#e03131", borderColor: "#ffc9c9" }}>削除</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        addOpen ? (
          <div style={{ marginTop: 14, border: "1px solid #a5d8ff", borderRadius: 12, padding: 14, background: "#f8fafc" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, color: "var(--accent, #1c7ed6)", fontSize: 16 }}><Icon name="plus" size={18} />新しいリンクを追加</h3>
              <button onClick={() => { setAddOpen(false); setALabel(""); setAUrl(""); setADesc(""); }} aria-label="閉じる" style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "#e9ecef", color: "#868e96", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={16} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input style={input} placeholder="表示名（例: 公式Discord）" value={aLabel} onChange={(e) => setALabel(e.target.value)} />
              <input style={input} placeholder="https://..." value={aUrl} onChange={(e) => setAUrl(e.target.value)} />
              <input style={input} placeholder="概要説明（任意）" value={aDesc} onChange={(e) => setADesc(e.target.value)} />
              <button onClick={submitAdd} disabled={busy || !aLabel.trim() || !aUrl.trim()} style={{ marginTop: 2, padding: "12px 18px", border: "none", borderRadius: 8, background: "var(--accent, #1c7ed6)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>追加する</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddOpen(true)} style={{ marginTop: 14, width: "100%", padding: 14, border: "1px dashed #b2c2d6", borderRadius: 12, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--accent, #1c7ed6)", fontSize: 15, fontWeight: 700, cursor: "pointer" }}><Icon name="plus" size={18} />新しいリンクを追加</button>
        )
      )}
      <p style={{ marginTop: 16 }}><a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: "var(--accent, #1c7ed6)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>← 地図に戻る</a></p>
    </div>
  );
}
