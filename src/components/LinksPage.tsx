import { useState, useEffect } from "react";
import { listLinks, createLink, updateLink, deleteLink, type LinkItem } from "../lib/api";
import { card, input, btnSm, btnPrimary, btnGhost, badgeSoft } from "../lib/styles";
import { confirmDelete } from "../lib/confirm";
import { useDragSort } from "../hooks/useDragSort";
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

  const { dragId, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, dragJustEnded } = useDragSort<LinkItem>(setLinks, updateLink, load, setErr);

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
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <span style={{ color: "var(--accent, #1c7ed6)", display: "inline-flex" }}><Icon name="link" size={20} /></span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#1b2330" }}>リンク集</h2>
        {!loading && ordered.length > 0 && <span style={badgeSoft}>{ordered.length}</span>}
      </div>
      <p style={{ fontSize: 13, color: "#7a8699", margin: "0 0 14px" }}>同盟でよく使うリンクをまとめます。{canEdit ? "並べ替え・編集ができます。" : ""}</p>
      {err && <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>}
      {loading ? (
        <p style={{ color: "#868e96" }}>読み込み中…</p>
      ) : ordered.length === 0 ? (
        <p style={{ color: "#868e96" }}>まだリンクがありません。{canEdit ? "下から追加してください。" : ""}</p>
      ) : (
        <div data-sortgroup style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ordered.map((l) => {
            if (editId === l.id) {
              return (
                <div key={l.id} style={{ border: "1px solid #f1b056", borderRadius: 12, padding: 13, background: "#fff9f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#e8590c", marginBottom: 11 }}><Icon name="edit" size={14} />このリンクを編集中</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    <input style={input} placeholder="表示名（例: 公式Discord）" value={eLabel} onChange={(e) => setELabel(e.target.value)} />
                    <input style={input} placeholder="https://..." value={eUrl} onChange={(e) => setEUrl(e.target.value)} />
                    <input style={input} placeholder="概要説明（任意）" value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={submitEdit} disabled={busy || !eLabel.trim() || !eUrl.trim()} style={{ ...btnPrimary, background: "#f08c00", flex: 1 }}>保存する</button>
                      <button onClick={cancelEdit} disabled={busy} style={btnGhost}>キャンセル</button>
                    </div>
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border, #edf0f4)", display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => remove(l.id)} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid #ffc9c9", background: "#fff", color: "#e03131", fontSize: 13, fontWeight: 600, cursor: "pointer" }}><Icon name="trash" size={14} />このリンクを削除</button>
                    </div>
                  </div>
                </div>
              );
            }
            const isDragging = dragId === l.id;
            return (
              <div key={l.id} data-sortid={l.id} onPointerDown={canEdit ? (e) => onPointerDown(e, l, ordered.map((x) => x.id)) : undefined} onPointerMove={canEdit ? onPointerMove : undefined} onPointerUp={canEdit ? onPointerUp : undefined} onPointerCancel={canEdit ? onPointerCancel : undefined} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", border: "1px solid " + (isDragging ? "var(--accent, #5b5bd6)" : "var(--border, #eef1f4)"), borderRadius: 12, background: "#fff", boxShadow: isDragging ? "0 14px 32px rgba(15,23,42,0.28)" : "none", opacity: isDragging ? 0.97 : 1, position: isDragging ? "relative" : undefined, zIndex: isDragging ? 5 : undefined, touchAction: canEdit ? "pan-y" : undefined, userSelect: "none", WebkitUserSelect: "none", transition: isDragging ? "none" : "box-shadow 0.2s ease, border-color 0.3s ease" }}>
                {canEdit && (
                  <div aria-hidden="true" style={{ color: "#ccd2db", flexShrink: 0, display: "flex", alignItems: "center", padding: "6px 2px" }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="3" r="1.4" /><circle cx="11" cy="3" r="1.4" /><circle cx="5" cy="8" r="1.4" /><circle cx="11" cy="8" r="1.4" /><circle cx="5" cy="13" r="1.4" /><circle cx="11" cy="13" r="1.4" /></svg>
                  </div>
                )}
                <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-soft, #e7f0fb)", color: "var(--accent, #1c7ed6)", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="link" size={17} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (dragJustEnded()) e.preventDefault(); }} style={{ color: "var(--accent, #1c7ed6)", fontWeight: 600, textDecoration: "none", fontSize: 14.5, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.label}</a>
                  {l.description && <div style={{ fontSize: 11.5, color: "#868e96", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.description}</div>}
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onPointerDown={(e) => e.stopPropagation()}>
                    <button onClick={() => startEdit(l)} disabled={busy} style={btnSm}><Icon name="edit" size={13} />編集</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        addOpen ? (
          <div style={{ marginTop: 14, border: "1px solid var(--border, #d7dee7)", borderRadius: 14, padding: 15, background: "var(--accent-soft, #f4f8fd)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, color: "var(--accent-strong, #1b5fa8)", fontSize: 15, fontWeight: 700 }}><Icon name="plus" size={18} />新しいリンクを追加</h3>
              <button onClick={() => { setAddOpen(false); setALabel(""); setAUrl(""); setADesc(""); }} aria-label="閉じる" style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "rgba(0,0,0,0.06)", color: "#868e96", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={16} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <input style={input} placeholder="表示名（例: 公式Discord）" value={aLabel} onChange={(e) => setALabel(e.target.value)} />
              <input style={input} placeholder="https://..." value={aUrl} onChange={(e) => setAUrl(e.target.value)} />
              <input style={input} placeholder="概要説明（任意）" value={aDesc} onChange={(e) => setADesc(e.target.value)} />
              <button onClick={submitAdd} disabled={busy || !aLabel.trim() || !aUrl.trim()} style={{ ...btnPrimary, width: "100%", padding: "12px 18px", fontSize: 15, marginTop: 2 }}>追加する</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddOpen(true)} style={{ marginTop: 14, width: "100%", padding: 14, border: "1px dashed var(--border, #b2c2d6)", borderRadius: 14, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--accent, #1c7ed6)", fontSize: 15, fontWeight: 600, cursor: "pointer" }}><Icon name="plus" size={18} />新しいリンクを追加</button>
        )
      )}
      <p style={{ marginTop: 16 }}><a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a></p>
    </div>
  );
}
