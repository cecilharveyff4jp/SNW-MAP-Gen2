import { useEffect, useState } from "react";
import { listMusic, createMusic, updateMusic, deleteMusic, type MusicItem } from "../lib/api";
import { getEmbedUrl, formatCredit } from "../lib/music";
import { card, input, btnSm, ordBtn, btnPrimary, btnGhost, btnDanger, badgeSoft } from "../lib/styles";
import { confirmDelete } from "../lib/confirm";
import { useReorder } from "../hooks/useReorder";
import { useDialog } from "./Dialog";
import Icon from "./Icon";

type MType = "alliance" | "city";

function TypeToggle({ value, onChange }: { value: MType; onChange: (v: MType) => void }) {
  return (
    <div style={{ display: "flex", background: "#eef1f4", borderRadius: 10, padding: 4, gap: 4 }}>
      {([["alliance", "同盟全体"], ["city", "都市メンバー"]] as const).map(([val, lbl]) => {
        const on = value === val;
        return (
          <button key={val} type="button" onClick={() => onChange(val)} aria-pressed={on} style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: on ? 700 : 600, color: on ? "#111" : "#868e96", background: on ? "#fff" : "transparent", boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : "none", transition: "background 0.15s" }}>{lbl}</button>
        );
      })}
    </div>
  );
}

function CreditFields({ composer, producer, onComposer, onProducer }: { composer: string; producer: string; onComposer: (v: string) => void; onProducer: (v: string) => void }) {
  return (
    <>
      <input style={input} placeholder="作詞・作曲（任意）" value={composer} onChange={(e) => onComposer(e.target.value)} />
      <input style={input} placeholder="制作者・提供元（任意 / AI・YouTube等）" value={producer} onChange={(e) => onProducer(e.target.value)} />
    </>
  );
}

export default function MusicPage({ canEdit }: { canEdit: boolean }) {
  const dlg = useDialog();
  const [music, setMusic] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [aTitle, setATitle] = useState("");
  const [aUrl, setAUrl] = useState("");
  const [aType, setAType] = useState<MType>("alliance");
  const [aComposer, setAComposer] = useState("");
  const [aProducer, setAProducer] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eUrl, setEUrl] = useState("");
  const [eType, setEType] = useState<MType>("alliance");
  const [eComposer, setEComposer] = useState("");
  const [eProducer, setEProducer] = useState("");

  async function load() {
    setLoading(true);
    try { setMusic(await listMusic()); setErr(null); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const { move, flashId, moving } = useReorder<MusicItem>(updateMusic, load, setErr);

  async function submitAdd() {
    if (!aTitle.trim() || !aUrl.trim()) return;
    setBusy(true); setErr(null);
    try {
      await createMusic({ title: aTitle.trim(), url: aUrl.trim(), type: aType, composer: aComposer.trim(), producer: aProducer.trim() });
      setATitle(""); setAUrl(""); setAType("alliance"); setAComposer(""); setAProducer(""); setAddOpen(false); await load();
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }

  function startEdit(m: MusicItem) { setPlaying(null); setEditId(m.id); setETitle(m.title); setEUrl(m.url); setEType(m.type); setEComposer(m.composer); setEProducer(m.producer); }
  function cancelEdit() { setEditId(null); }
  async function submitEdit() {
    if (editId == null || !eTitle.trim() || !eUrl.trim()) return;
    setBusy(true); setErr(null);
    try {
      await updateMusic(editId, { title: eTitle.trim(), url: eUrl.trim(), type: eType, composer: eComposer.trim(), producer: eProducer.trim() });
      setEditId(null); await load();
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }
  async function remove(id: number) {
    if (!(await confirmDelete(dlg, "曲"))) return;
    setBusy(true);
    try { await deleteMusic(id); if (editId === id) setEditId(null); if (playing === id) setPlaying(null); await load(); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }

  const sections: { key: MType; label: string }[] = [
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
          const list = music.filter((m) => m.type === sec.key).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
          return (
            <div key={sec.key} style={card}>
              <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 17, display: "flex", alignItems: "center", gap: 9 }}><span style={{ color: "var(--accent, #1c7ed6)", display: "inline-flex" }}><Icon name="music" size={18} /></span>{sec.label}<span style={badgeSoft}>{list.length}</span></h2>
              {list.length === 0 ? (
                <p style={{ color: "#868e96", fontSize: 14 }}>まだ曲がありません。</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {list.map((m, idx) => {
                    if (editId === m.id) {
                      return (
                        <div key={m.id} style={{ border: "1px solid #f1b056", borderRadius: 12, padding: 13, background: "#fff9f0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#e8590c", letterSpacing: "0.04em", marginBottom: 11 }}><Icon name="edit" size={14} />この曲を編集中</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                            <input style={input} placeholder="曲名" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
                            <input style={input} placeholder="Suno / YouTube のURL" value={eUrl} onChange={(e) => setEUrl(e.target.value)} />
                            <CreditFields composer={eComposer} producer={eProducer} onComposer={setEComposer} onProducer={setEProducer} />
                            <TypeToggle value={eType} onChange={setEType} />
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <button onClick={submitEdit} disabled={busy || !eTitle.trim() || !eUrl.trim()} style={{ ...btnPrimary, background: "#f08c00" }}>保存する</button>
                              <button onClick={cancelEdit} disabled={busy} style={btnGhost}>キャンセル</button>
                              <div style={{ flex: 1 }} />
                              <button onClick={() => remove(m.id)} disabled={busy} style={btnDanger}><Icon name="trash" size={14} />削除</button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const isPlaying = playing === m.id;
                    const isFlash = flashId === m.id;
                    const credit = formatCredit(m.composer, m.producer);
                    return (
                      <div key={m.id} onClick={() => setPlaying(isPlaying ? null : m.id)} style={{ border: "1px solid " + (isFlash ? "#ffd43b" : isPlaying ? "#d0bfff" : "var(--border, #eef1f4)"), borderRadius: 12, padding: "10px 12px", cursor: "pointer", background: isFlash ? "#fff3bf" : isPlaying ? "#f3f0ff" : "#fff", transition: "background 0.4s ease, border-color 0.4s ease" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {canEdit && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => move(list, m, "up", setMusic)} disabled={busy || moving || idx === 0} aria-label="上へ" style={{ ...ordBtn, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                              <button onClick={() => move(list, m, "down", setMusic)} disabled={busy || moving || idx === list.length - 1} aria-label="下へ" style={{ ...ordBtn, opacity: idx === list.length - 1 ? 0.3 : 1 }}>▼</button>
                            </div>
                          )}
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: isPlaying ? "linear-gradient(135deg,#7048e8,#9775fa)" : "#f1f3f5", color: isPlaying ? "#fff" : "#7048e8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: isPlaying ? "0 4px 12px rgba(112,72,232,0.35)" : "none" }}><Icon name={isPlaying ? "pause" : "play"} size={16} /></div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title || "（タイトルなし）"}</div>
                            {isPlaying ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                                <span style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 16 }}>
                                  <span style={{ width: 3, background: "#10b981", borderRadius: 2, animation: "eqw1 0.6s infinite ease-in-out" }} />
                                  <span style={{ width: 3, background: "#10b981", borderRadius: 2, animation: "eqw2 0.6s infinite ease-in-out 0.12s" }} />
                                  <span style={{ width: 3, background: "#10b981", borderRadius: 2, animation: "eqw3 0.6s infinite ease-in-out 0.24s" }} />
                                </span>
                                <span style={{ fontSize: 11, color: "#059669", fontWeight: 700, letterSpacing: "0.06em" }}>再生中</span>
                              </div>
                            ) : credit ? (
                              <div style={{ fontSize: 12, color: "#868e96", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{credit}</div>
                            ) : null}
                          </div>
                          {canEdit && (
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => startEdit(m)} disabled={busy} style={btnSm}><Icon name="edit" size={13} />編集</button>
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
        addOpen ? (
          <div style={{ ...card, border: "1px solid var(--border, #d7dee7)", background: "var(--accent-soft, #f4f8fd)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, color: "var(--accent-strong, #1b5fa8)", fontSize: 15, fontWeight: 700 }}><Icon name="plus" size={18} />新しい曲を追加</h3>
              <button onClick={() => { setAddOpen(false); setATitle(""); setAUrl(""); setAType("alliance"); setAComposer(""); setAProducer(""); }} aria-label="閉じる" style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "rgba(0,0,0,0.06)", color: "#868e96", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={16} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <input style={input} placeholder="曲名" value={aTitle} onChange={(e) => setATitle(e.target.value)} />
              <input style={input} placeholder="Suno / YouTube のURL" value={aUrl} onChange={(e) => setAUrl(e.target.value)} />
              <CreditFields composer={aComposer} producer={aProducer} onComposer={setAComposer} onProducer={setAProducer} />
              <TypeToggle value={aType} onChange={setAType} />
              <button onClick={submitAdd} disabled={busy || !aTitle.trim() || !aUrl.trim()} style={{ ...btnPrimary, width: "100%", padding: "12px 18px", fontSize: 15, marginTop: 2 }}>追加する</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddOpen(true)} style={{ ...card, width: "100%", border: "1px dashed var(--border, #b2c2d6)", background: "transparent", boxShadow: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--accent, #1c7ed6)", fontSize: 15, fontWeight: 600, cursor: "pointer" }}><Icon name="plus" size={18} />新しい曲を追加</button>
        )
      )}
      <p style={{ marginTop: 16, marginLeft: 4 }}><a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a></p>
      <style>{"@keyframes eqw1{0%,100%{height:6px}50%{height:16px}}@keyframes eqw2{0%,100%{height:16px}50%{height:6px}}@keyframes eqw3{0%,100%{height:9px}50%{height:16px}}"}</style>
    </div>
  );
}
