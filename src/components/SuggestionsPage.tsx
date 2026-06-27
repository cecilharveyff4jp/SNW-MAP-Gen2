import { useEffect, useState } from "react";
import { listSuggestions, updateSuggestion, deleteSuggestion, type Suggestion } from "../lib/api";
import { card, btnSm } from "../lib/styles";
import { useDialog } from "./Dialog";

const FIELD_LABEL: Record<string, string> = { birthday: "誕生日", fc_level: "溶鉱炉レベル", note: "メモ", position: "位置入替", name: "名前", other: "その他" };
const backLink = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, background: "var(--accent, #1c7ed6)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600 } as const;

export default function SuggestionsPage({ canEdit }: { canEdit: boolean }) {
  const dlg = useDialog();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() { setLoading(true); try { setItems(await listSuggestions()); setErr(null); } catch (e) { setErr(String((e as Error).message || e)); } finally { setLoading(false); } }
  useEffect(() => { if (canEdit) load(); else setLoading(false); }, [canEdit]);

  async function setStatus(id: number, status: "open" | "done" | "rejected") { setBusy(true); try { await updateSuggestion(id, status); await load(); } catch (e) { setErr(String((e as Error).message || e)); } finally { setBusy(false); } }
  async function remove(id: number) { if (!(await dlg.confirm({ title: "提案を削除", message: "この提案を削除します。よろしいですか？", okLabel: "削除する", danger: true }))) return; setBusy(true); try { await deleteSuggestion(id); await load(); } catch (e) { setErr(String((e as Error).message || e)); } finally { setBusy(false); } }

  if (!canEdit) {
    return (
      <div style={card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>変更提案</h2>
        <p style={{ color: "#868e96" }}>このページは編集者のみ閲覧できます。</p>
        <p style={{ marginTop: 16 }}><a href="/" style={backLink}>← 地図に戻る</a></p>
      </div>
    );
  }

  return (
    <div style={card}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>変更提案</h2>
      {err && <p style={{ color: "#e03131", fontSize: 13 }}>{err}</p>}
      {loading ? <p>読み込み中…</p> : items.length === 0 ? <p style={{ color: "#868e96" }}>提案はありません。</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((s) => {
            const open = s.status === "open";
            return (
              <div key={s.id} style={{ border: "1px solid #eef1f4", borderRadius: 11, padding: 12, background: open ? "#fff" : "#f8f9fb", opacity: open ? 1 : 0.72 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: open ? "var(--accent, #1c7ed6)" : "#adb5bd", borderRadius: 6, padding: "2px 7px" }}>{FIELD_LABEL[s.field] ?? s.field}</span>
                  <strong style={{ fontSize: 14 }}>{s.objectLabel || (s.objectId ? "ID " + s.objectId : "（全体）")}</strong>
                  {!open && <span style={{ fontSize: 11, color: "#868e96" }}>{s.status === "done" ? "対応済" : "却下"}</span>}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "#adb5bd" }}>{(s.createdAt || "").slice(0, 10)}</span>
                </div>
                {s.value && <div style={{ fontSize: 14, marginTop: 6 }}>内容: {s.value}</div>}
                {s.comment && <div style={{ fontSize: 13, marginTop: 4, color: "#495057", whiteSpace: "pre-wrap" }}>{s.comment}</div>}
                <div style={{ fontSize: 11.5, color: "#868e96", marginTop: 6 }}>提案者: {s.proposerName || s.proposerEmail || "—"}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                  {open && <button onClick={() => setStatus(s.id, "done")} disabled={busy} style={{ ...btnSm, color: "#2f9e44", borderColor: "#b2f2bb" }}>対応済にする</button>}
                  {open && <button onClick={() => setStatus(s.id, "rejected")} disabled={busy} style={{ ...btnSm, color: "#e8590c", borderColor: "#ffd8a8" }}>却下</button>}
                  {!open && <button onClick={() => setStatus(s.id, "open")} disabled={busy} style={btnSm}>未対応に戻す</button>}
                  <button onClick={() => remove(s.id)} disabled={busy} style={{ ...btnSm, color: "#e03131", borderColor: "#ffc9c9" }}>削除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p style={{ marginTop: 16 }}><a href="/" style={backLink}>← 地図に戻る</a></p>
    </div>
  );
}
