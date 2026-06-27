import { useState } from "react";
import { createSuggestion, type SuggestField } from "../lib/api";
import { input } from "../lib/styles";
import Icon from "./Icon";

const FIELDS: { v: SuggestField; label: string; ph: string }[] = [
  { v: "birthday", label: "誕生日", ph: "例: 12月4日" },
  { v: "fc_level", label: "溶鉱炉レベル", ph: "例: FC5 / 25" },
  { v: "note", label: "メモ", ph: "新しいメモ内容" },
  { v: "position", label: "位置の入れ替え", ph: "例: ◯◯さんと入れ替え希望" },
  { v: "name", label: "名前", ph: "新しい名前" },
  { v: "other", label: "その他", ph: "内容" },
];

export default function SuggestModal({ obj, onClose, onDone }: { obj: { id?: number | null; label?: string | null; mapId?: number | null }; onClose: () => void; onDone: () => void }) {
  const [field, setField] = useState<SuggestField>("birthday");
  const [value, setValue] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cur = FIELDS.find((f) => f.v === field)!;

  async function submit() {
    if (!value.trim() && !comment.trim()) { setErr("内容かコメントを入力してください"); return; }
    setBusy(true); setErr(null);
    try {
      await createSuggestion({ objectId: obj.id ?? null, mapId: obj.mapId ?? null, objectLabel: obj.label ?? null, field, value: value.trim(), comment: comment.trim() });
      onDone();
    } catch (e) { setErr(String((e as Error).message || e)); setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(440px,100%)", background: "#fff", borderRadius: 16, boxShadow: "0 14px 44px rgba(0,0,0,0.4)", overflow: "hidden" }}>
        <div style={{ background: "var(--accent, #1c7ed6)", color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <strong style={{ fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>変更を提案{obj.label ? "：" + obj.label : ""}</strong>
          <button onClick={onClose} aria-label="閉じる" style={{ border: "none", background: "rgba(255,255,255,0.22)", color: "#fff", width: 30, height: 30, borderRadius: 15, cursor: "pointer", fontSize: 17, flexShrink: 0 }}>×</button>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "#868e96", marginBottom: 4 }}>提案する項目</div>
            <select style={input} value={field} onChange={(e) => setField(e.target.value as SuggestField)}>
              {FIELDS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#868e96", marginBottom: 4 }}>提案内容</div>
            <input style={input} value={value} placeholder={cur.ph} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#868e96", marginBottom: 4 }}>コメント（任意）</div>
            <textarea style={{ ...input, minHeight: 60, resize: "vertical" }} value={comment} placeholder="補足があれば" onChange={(e) => setComment(e.target.value)} />
          </div>
          {err && <p style={{ color: "#e03131", fontSize: 13, margin: 0 }}>{err}</p>}
          <button onClick={submit} disabled={busy} style={{ padding: "12px", border: "none", borderRadius: 10, background: "var(--accent, #1c7ed6)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Icon name="check" size={18} />この内容で提案する</button>
          <div style={{ fontSize: 11, color: "#adb5bd", textAlign: "center" }}>提案は編集者へ通知され、確認のうえ反映されます。</div>
        </div>
      </div>
    </div>
  );
}
