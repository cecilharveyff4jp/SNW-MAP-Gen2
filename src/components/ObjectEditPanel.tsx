import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { ObjectType } from "../lib/types";
import { listMusic, type ObjectInput, type MusicItem } from "../lib/api";
import { getDefaultSize, FC_LEVELS, fcDisplay, overlapsAny, findFreeAnchor } from "../lib/sizes";
import { parseBirthday } from "../lib/birthday";
import { useDialog } from "./Dialog";
import Icon from "./Icon";

const TYPE_OPTIONS: { value: ObjectType; label: string }[] = [
  { value: "HQ", label: "本部 (HQ)" },
  { value: "CITY", label: "都市 (CITY)" },
  { value: "STATUE", label: "像 (STATUE)" },
  { value: "DEPOT", label: "デポ (DEPOT)" },
  { value: "BEAR_TRAP", label: "熊罠 (BEAR_TRAP)" },
  { value: "MOUNTAIN", label: "山 (MOUNTAIN)" },
  { value: "LAKE", label: "湖 (LAKE)" },
  { value: "FLAG", label: "旗 (FLAG)" },
  { value: "OTHER", label: "その他 (OTHER)" },
];
const TERRAIN_EMOJI: Partial<Record<ObjectType, string>> = { MOUNTAIN: "🏔", LAKE: "🌊", FLAG: "🏴" };
const TERRAIN_EMOJIS = ["🏔", "🌊", "🏴"];

export type PanelInitial = ObjectInput & { id?: number };

interface Props {
  initial: PanelInitial;
  others?: { id?: number; anchorX: number; anchorY: number; w: number; h: number }[];
  onSave: (payload: ObjectInput, id?: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
  onDraftMove?: (x: number, y: number) => void;
  onCollapse?: () => void;
}

export default function ObjectEditPanel({ initial, others, onSave, onDelete, onClose, onDraftMove, onCollapse }: Props) {
  const dlg = useDialog();
  const isNew = initial.id == null;
  const [form, setForm] = useState<ObjectInput>({
    type: initial.type,
    anchorX: initial.anchorX,
    anchorY: initial.anchorY,
    w: initial.w,
    h: initial.h,
    label: initial.label || initial.memberName || "",
    memberName: "",
    gameId: initial.gameId ?? "",
    fcLevel: initial.fcLevel ?? "",
    note: initial.note ?? "",
    birthday: initial.birthday ?? "",
    musicIds: initial.musicIds ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [musicList, setMusicList] = useState<MusicItem[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  useEffect(() => { listMusic().then(setMusicList).catch(() => { /* noop */ }); }, []);
  useEffect(() => { setForm((f) => ({ ...f, anchorX: initial.anchorX, anchorY: initial.anchorY })); }, [initial.anchorX, initial.anchorY]);
  const initB = parseBirthday(initial.birthday);
  const [bMonth, setBMonth] = useState(initB ? String(initB.month) : "");
  const [bDay, setBDay] = useState(initB && initB.day ? String(initB.day) : "");
  const setBirthdayParts = (mo: string, da: string) => { setBMonth(mo); setBDay(da); setForm((f) => ({ ...f, birthday: mo && da ? mo + "月" + da + "日" : "" })); };
  const selMusic = form.musicIds ?? [];
  const toggleMusic = (id: number) => setForm({ ...form, musicIds: selMusic.includes(id) ? selMusic.filter((x) => x !== id) : [...selMusic, id] });

  const overlapping = overlapsAny({ anchorX: form.anchorX, anchorY: form.anchorY, w: form.w, h: form.h }, others ?? [], initial.id);
  const isTerrain = form.type === "MOUNTAIN" || form.type === "LAKE" || form.type === "FLAG";

  const num = (v: string) => (v === "" ? 0 : parseInt(v, 10) || 0);

  function changeType(t: ObjectType) {
    const d = getDefaultSize(t);
    const emo = TERRAIN_EMOJI[t];
    const nextLabel = emo ? emo : (TERRAIN_EMOJIS.includes((form.label ?? "").trim()) ? "" : form.label);
    const base = { ...form, type: t, w: d.w, h: d.h, label: nextLabel, ...(emo ? { fcLevel: "", birthday: "" } : {}) };
    if (emo) { setBMonth(""); setBDay(""); }
    if (isNew) {
      const free = findFreeAnchor(form.anchorX, form.anchorY, d.w, d.h, others ?? [], initial.id);
      setForm({ ...base, anchorX: free.x, anchorY: free.y });
      onDraftMove?.(free.x, free.y);
    } else {
      setForm(base);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const clean = (s?: string) => (s && s.trim() ? s.trim() : undefined);
      const payload: ObjectInput = {
        type: form.type,
        anchorX: form.anchorX,
        anchorY: form.anchorY,
        w: form.w,
        h: form.h,
        label: clean(form.label),
        memberName: clean(form.memberName),
        gameId: clean(form.gameId),
        note: clean(form.note),
        birthday: clean(form.birthday),
        fcLevel: form.fcLevel ? form.fcLevel : undefined,
        musicIds: selMusic.length ? selMusic : undefined,
      };
      await onSave(payload, isNew ? undefined : (initial.id as number));
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (isNew || initial.id == null) return;
    if (!(await dlg.confirm({ title: "オブジェクトを削除", message: "このオブジェクトを削除します。よろしいですか？", okLabel: "削除する", danger: true }))) return;
    setBusy(true);
    setErr(null);
    try {
      await onDelete(initial.id);
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  }

  const labelMuted: CSSProperties = { fontSize: 11.5, color: "#868e96", marginBottom: 3 };
  const emLabel: CSSProperties = { fontSize: 12.5, color: "#3b5bdb", fontWeight: 700, marginBottom: 5 };
  const inputStyle: CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #ced4da", borderRadius: 8, fontSize: 16, boxSizing: "border-box" };
  const emInput: CSSProperties = { ...inputStyle, border: "1.5px solid #bac8ff", background: "#fff" };

  return (
    <div style={{ border: "1px solid #dee2e6", borderRadius: 14, padding: 16, marginTop: 12, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{isNew ? "新規オブジェクト" : "オブジェクトを編集"}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {onCollapse && <button type="button" onClick={onCollapse} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #d0d7e2", background: "#f1f5fb", borderRadius: 9, padding: "7px 11px", fontSize: 12.5, fontWeight: 700, color: "#1971c2", cursor: "pointer", whiteSpace: "nowrap" }}><Icon name="chevronDown" size={16} />地図で調整</button>}
          <button type="button" onClick={onClose} aria-label="閉じる" style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: "#f1f3f5", color: "#868e96", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} /></button>
        </div>
      </div>
      <form onSubmit={submit}>
        {/* よく使う項目（強調） */}
        <div style={{ background: "#f5f8ff", border: "1px solid #e7edff", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={emLabel}>種別</div>
            <select style={emInput} value={form.type} onChange={(e) => changeType(e.target.value as ObjectType)}>
              {TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <div style={emLabel}>名前</div>
            <input style={emInput} type="text" value={form.label ?? ""} placeholder="例: ミクヲ / 本部 / 🏔" onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div>
            <div style={emLabel}>溶鉱炉レベル（FC）</div>
            <select style={{ ...emInput, opacity: isTerrain ? 0.5 : 1 }} disabled={isTerrain} value={form.fcLevel ?? ""} onChange={(e) => setForm({ ...form, fcLevel: e.target.value || undefined })}>
              <option value="">（なし）</option>
              {FC_LEVELS.map((v) => (<option key={v} value={v}>{fcDisplay(v)}</option>))}
            </select>
          </div>
        </div>

        {/* 位置・サイズ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
          <div><div style={labelMuted}>X</div><input style={inputStyle} type="number" value={form.anchorX} onChange={(e) => { const v = num(e.target.value); setForm({ ...form, anchorX: v }); onDraftMove?.(v, form.anchorY); }} /></div>
          <div><div style={labelMuted}>Y</div><input style={inputStyle} type="number" value={form.anchorY} onChange={(e) => { const v = num(e.target.value); setForm({ ...form, anchorY: v }); onDraftMove?.(form.anchorX, v); }} /></div>
          <div><div style={labelMuted}>幅</div><input style={inputStyle} type="number" min={1} value={form.w} onChange={(e) => setForm({ ...form, w: Math.max(1, num(e.target.value)) })} /></div>
          <div><div style={labelMuted}>高さ</div><input style={inputStyle} type="number" min={1} value={form.h} onChange={(e) => setForm({ ...form, h: Math.max(1, num(e.target.value)) })} /></div>
        </div>

        {/* その他（折りたたみ） */}
        <button type="button" onClick={() => setShowDetail((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, border: "none", background: "transparent", color: "#495057", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}>
          <Icon name={showDetail ? "chevronUp" : "chevronDown"} size={16} />その他の項目（ID・誕生日・メモ・曲）
        </button>
        {showDetail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            <div><div style={labelMuted}>ゲーム内ID（任意）</div><input style={inputStyle} type="text" value={form.gameId ?? ""} onChange={(e) => setForm({ ...form, gameId: e.target.value })} /></div>
            <div>
              <div style={labelMuted}>誕生日（任意）</div>
              <div style={{ display: "flex", gap: 8 }}>
                <select style={{ ...inputStyle, flex: 1 }} value={bMonth} onChange={(e) => setBirthdayParts(e.target.value, bDay)}>
                  <option value="">月</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (<option key={m} value={m}>{m}月</option>))}
                </select>
                <select style={{ ...inputStyle, flex: 1 }} value={bDay} onChange={(e) => setBirthdayParts(bMonth, e.target.value)}>
                  <option value="">日</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (<option key={d} value={d}>{d}日</option>))}
                </select>
              </div>
            </div>
            <div><div style={labelMuted}>メモ・備考（任意）</div><textarea style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            {musicList.length > 0 && (
              <div>
                <div style={labelMuted}>紐づける曲（任意）</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 120, overflow: "auto", border: "1px solid #eee", borderRadius: 8, padding: 6 }}>
                  {musicList.map((m) => (
                    <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                      <input type="checkbox" checked={selMusic.includes(m.id)} onChange={() => toggleMusic(m.id)} />
                      <span>♪ {m.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {overlapping && (
          <div style={{ background: "#d6336c", borderRadius: 10, margin: "12px 0 0", padding: "11px 12px" }}>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.5 }}>⚠ 他のオブジェクトと重なっています。このままでは保存できません。</p>
            <button type="button" onClick={() => { const free = findFreeAnchor(form.anchorX, form.anchorY, form.w, form.h, others ?? [], initial.id); setForm((f) => ({ ...f, anchorX: free.x, anchorY: free.y })); onDraftMove?.(free.x, free.y); }} style={{ marginTop: 9, width: "100%", padding: "11px", border: "none", borderRadius: 8, background: "#fff", color: "#d6336c", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>✨ 重ならない近くの場所へ移動</button>
          </div>
        )}
        {err && <p style={{ color: "#e03131", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}

        <button type="submit" disabled={busy || overlapping} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", marginTop: 16, padding: "14px", border: "none", borderRadius: 12, background: overlapping ? "#adb5bd" : "#1c7ed6", color: "#fff", fontWeight: 800, fontSize: 16, cursor: overlapping ? "not-allowed" : "pointer", boxShadow: overlapping ? "none" : "0 4px 14px rgba(28,126,214,0.35)" }}><Icon name="check" size={20} />{isNew ? "この内容で追加" : "保存する"}</button>
        {!isNew && (
          <button type="button" onClick={remove} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 14, padding: "10px", border: "none", borderRadius: 10, background: "transparent", color: "#e03131", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}><Icon name="trash" size={16} />このオブジェクトを削除</button>
        )}
      </form>
    </div>
  );
}
