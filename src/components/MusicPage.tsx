import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { listMusic, createMusic, updateMusic, deleteMusic, type MusicItem } from "../lib/api";
import { getEmbedUrl } from "../lib/music";
import { useDialog } from "./Dialog";

const card: CSSProperties = { border: "1px solid #dee2e6", borderRadius: 12, padding: 18, background: "#fff", marginTop: 12 };
const input: CSSProperties = { padding: "10px 12px", border: "1px solid #ced4da", borderRadius: 8, fontSize: 16, boxSizing: "border-box", width: "100%" };
const btnSm: CSSProperties = { padding: "5px 10px", border: "1px solid #e3e6ea", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#495057" };
const ordBtn: CSSProperties = { width: 30, height: 28, border: "1px solid #e3e6ea", borderRadius: 7, background: "#fff", cursor: "pointer", fontSize: 13, color: "#495057", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 };

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
  const [flashId, setFlashId] = useState<number | null>(null);

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
    if (!(await dlg.confirm({ title: "曲を削除", message: "この曲を削除します。よろしいですか？", okLabel: "削除する", danger: true }))) return;
    setBusy(true);
    try { await deleteMusic(id); if (editId === id) setEditId(null); if (playing === id) setPlaying(null); await load(); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }
  // 並び替え: 画面はその場で入れ替え（リロードして先頭に飛ばない）＋移動した曲を一瞬ハイライト
  async function move(list: MusicItem[], m: MusicItem, dir: "up" | "down") {
    if (busy) return;
    const i = list.findIndex((x) => x.id === m.id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    const ao = a.sortOrder, bo = b.sortOrder === a.sortOrder ? a.sortOrder + (dir === "up" ? -1 : 1) : b.sortOrder;
    setMusic((prev) => prev.map((x) => (x.id === a.id ? { ...x, sortOrder: bo } : x.id === b.id ? { ...x, sortOrder: ao } : x)));
    setFlashId(a.id);
    window.setTimeout(() => setFlashId((cur) => (cur === a.id ? null : cur)), 1100);
    setBusy(true); setErr(null);
    try {
      await updateMusic(a.id, { sortOrder: bo });
      await updateMusic(b.id, { sortOrder: ao });
    } catch (e) { setErr(String((e as Error).message || e)); await load(); }
    finally { setBusy(false); }
  }

  const sections: { key: MType; label: string; icon: string }[] = [
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
          const list = music.filter((m) => m.type === sec.key).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
          return (
            <div key={sec.key} style={card}>
              <h2 style={{ marginTop: 0, fontSize: 17, display: "flex", alignItems: "center", gap: 8 }}>🎵 {sec.label}<span style={{ fontSize: 12, fontWeight: 600, color: "#adb5bd" }}>{list.length}曲</span></h2>
              {list.length === 0 ? (
                <p style={{ color: "#868e96", fontSize: 14 }}>まだ曲がありません。</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {list.map((m, idx) => {
                    if (editId === m.id) {
                      return (
                        <div key={m.id} style={{ border: "1.5px solid #f59f00", borderRadius: 12, padding: 12, background: "#fff8ef" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#e8590c", letterSpacing: "0.04em", marginBottom: 10 }}>✎ この曲を編集中</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <input style={input} placeholder="曲名" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
                            <input style={input} placeholder="Suno / YouTube のURL" value={eUrl} onChange={(e) => setEUrl(e.target.value)} />
                            <CreditFields composer={eComposer} producer={eProducer} onComposer={setEComposer} onProducer={setEProducer} />
                            <TypeToggle value={eType} onChange={setEType} />
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <button onClick={submitEdit} disabled={busy || !eTitle.trim() || !eUrl.trim()} style={{ padding: "10px 18px", border: "none", borderRadius: 8, background: "#f08c00", color: "#fff", fontWeight: 700, cursor: "pointer" }}>更新する</button>
                              <button onClick={cancelEdit} disabled={busy} style={{ padding: "10px 16px", border: "1px solid #ced4da", borderRadius: 8, background: "#fff", cursor: "pointer", fontWeight: 600, color: "#495057" }}>キャンセル</button>
                              <div style={{ flex: 1 }} />
                              <button onClick={() => remove(m.id)} disabled={busy} style={{ padding: "10px 14px", border: "1px solid #ffc9c9", borderRadius: 8, background: "#fff", color: "#e03131", cursor: "pointer", fontWeight: 600 }}>削除</button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const isPlaying = playing === m.id;
                    const isFlash = flashId === m.id;
                    const credit = [m.composer && "作詞作曲: " + m.composer, m.producer && "制作: " + m.producer].filter(Boolean).join("　");
                    return (
                      <div key={m.id} onClick={() => setPlaying(isPlaying ? null : m.id)} style={{ border: "1px solid " + (isFlash ? "#ffd43b" : isPlaying ? "#d0bfff" : "#eef1f4"), borderRadius: 12, padding: 12, cursor: "pointer", background: isFlash ? "#fff3bf" : isPlaying ? "#f3f0ff" : "#fff", transition: "background 0.4s ease, border-color 0.4s ease" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                          {canEdit && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => move(list, m, "up")} disabled={busy || idx === 0} aria-label="上へ" style={{ ...ordBtn, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                              <button onClick={() => move(list, m, "down")} disabled={busy || idx === list.length - 1} aria-label="下へ" style={{ ...ordBtn, opacity: idx === list.length - 1 ? 0.3 : 1 }}>▼</button>
                            </div>
                          )}
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
                              <div style={{ fontSize: 12, color: "#868e96", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{credit || (sec.icon + " " + (sec.key === "alliance" ? "同盟全体" : "都市メンバー") + "・タップで再生")}</div>
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
        addOpen ? (
          <div style={{ ...card, border: "1px solid #a5d8ff", background: "#f8fafc" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, color: "#1c7ed6", fontSize: 16 }}><span style={{ fontSize: 20, lineHeight: 1 }}>＋</span>新しい曲を追加</h3>
              <button onClick={() => { setAddOpen(false); setATitle(""); setAUrl(""); setAType("alliance"); setAComposer(""); setAProducer(""); }} aria-label="閉じる" style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "#e9ecef", color: "#868e96", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input style={input} placeholder="曲名" value={aTitle} onChange={(e) => setATitle(e.target.value)} />
              <input style={input} placeholder="Suno / YouTube のURL" value={aUrl} onChange={(e) => setAUrl(e.target.value)} />
              <CreditFields composer={aComposer} producer={aProducer} onComposer={setAComposer} onProducer={setAProducer} />
              <TypeToggle value={aType} onChange={setAType} />
              <button onClick={submitAdd} disabled={busy || !aTitle.trim() || !aUrl.trim()} style={{ marginTop: 2, padding: "12px 18px", border: "none", borderRadius: 8, background: "#1c7ed6", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>この曲を追加する</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddOpen(true)} style={{ ...card, width: "100%", border: "1px dashed #b2c2d6", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#1c7ed6", fontSize: 15, fontWeight: 700, cursor: "pointer" }}><span style={{ fontSize: 20, lineHeight: 1 }}>＋</span>新しい曲を追加</button>
        )
      )}
      <p style={{ marginTop: 16, marginLeft: 4 }}><a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: "#1c7ed6", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>← 地図に戻る</a></p>
      <style>{"@keyframes eqw1{0%,100%{height:6px}50%{height:16px}}@keyframes eqw2{0%,100%{height:16px}50%{height:6px}}@keyframes eqw3{0%,100%{height:9px}50%{height:16px}}"}</style>
    </div>
  );
}
