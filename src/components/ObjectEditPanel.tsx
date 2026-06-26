import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { ObjectType } from "../lib/types";
import { listMusic, type ObjectInput, type MusicItem } from "../lib/api";
import { getDefaultSize, FC_LEVELS, fcDisplay, overlapsAny, findFreeAnchor } from "../lib/sizes";
import { parseBirthday } from "../lib/birthday";
import { useDialog } from "./Dialog";

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
  useEffect(() => { listMusic().then(setMusicList).catch(() => { /* noop */ }); }, []);
  // 方向ボタン等で外部から座標が変わったら入力欄も追従（再マウントせず同期）
  useEffect(() => { setForm((f) => ({ ...f, anchorX: initial.anchorX, anchorY: initial.anchorY })); }, [initial.anchorX, initial.anchorY]);
  const initB = parseBirthday(initial.birthday);
  const [bMonth, setBMonth] = useState(initB ? String(initB.month) : "");
  const [bDay, setBDay] = useState(initB && initB.day ? String(initB.day) : "");
  const setBirthdayParts = (mo: string, da: string) => { setBMonth(mo); setBDay(da); setForm((f) => ({ ...f, birthday: mo && da ? mo + "月" + da + "日" : "" })); };
  const selMusic = form.musicIds ?? [];
  const toggleMusic = (id: number) => setForm({ ...form, musicIds: selMusic.includes(id) ? selMusic.filter((x) => x !== id) : [...selMusic, id] });

  const overlapping = overlapsAny({ anchorX: form.anchorX, anchorY: form.anchorY, w: form.w, h: form.h }, others ?? [], initial.id);

  const num = (v: string) => (v === "" ? 0 : parseInt(v, 10) || 0);

  // 種別変更：山/湖/旗にしたら名前を絵文字に自動入力。地形→他に戻したら絵文字を消す。
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

  const labelStyle: CSSProperties = { fontSize: 12, color: "#495057" };
  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #ced4da",
    borderRadius: 8,
    fontSize: 16,
    boxSizing: "border-box",
  };

  return (
    <div style={{ border: "1px solid #dee2e6", borderRadius: 8, padding: 16, marginTop: 12, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{isNew ? "新規オブジェクト" : "オブジェクトを編集"}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {onCollapse && <button type="button" onClick={onCollapse} style={{ border: "1px solid #ced4da", background: "#f1f5fb", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 700, color: "#1971c2", cursor: "pointer", whiteSpace: "nowrap" }}>▼ 地図で調整</button>}
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "#868e96" }}>×</button>
        </div>
      </div>
      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ gridColumn: "1 / 3" }}>
            <div style={labelStyle}>種別（選ぶとサイズを自動補完）</div>
            <select style={inputStyle} value={form.type} onChange={(e) => changeType(e.target.value as ObjectType)}>
              {TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div><div style={labelStyle}>アンカー X</div><input style={inputStyle} type="number" value={form.anchorX} onChange={(e) => { const v = num(e.target.value); setForm({ ...form, anchorX: v }); onDraftMove?.(v, form.anchorY); }} /></div>
          <div><div style={labelStyle}>アンカー Y</div><input style={inputStyle} type="number" value={form.anchorY} onChange={(e) => { const v = num(e.target.value); setForm({ ...form, anchorY: v }); onDraftMove?.(form.anchorX, v); }} /></div>
          <div><div style={labelStyle}>幅 W</div><input style={inputStyle} type="number" min={1} value={form.w} onChange={(e) => setForm({ ...form, w: Math.max(1, num(e.target.value)) })} /></div>
          <div><div style={labelStyle}>高さ H</div><input style={inputStyle} type="number" min={1} value={form.h} onChange={(e) => setForm({ ...form, h: Math.max(1, num(e.target.value)) })} /></div>
          <div style={{ gridColumn: "1 / 3" }}><div style={labelStyle}>名前</div><input style={inputStyle} type="text" value={form.label ?? ""} placeholder="例: ミクヲ / 本部 / 🏔" onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
          <div><div style={labelStyle}>ゲーム内ID（任意）</div><input style={inputStyle} type="text" value={form.gameId ?? ""} onChange={(e) => setForm({ ...form, gameId: e.target.value })} /></div>
          <div><div style={labelStyle}>FCレベル（任意）</div>
            <select style={inputStyle} value={form.fcLevel ?? ""} onChange={(e) => setForm({ ...form, fcLevel: e.target.value || undefined })}>
              <option value="">（なし）</option>
              {FC_LEVELS.map((v) => (<option key={v} value={v}>{fcDisplay(v)}</option>))}
            </select></div>
          <div style={{ gridColumn: "1 / 3" }}>
            <div style={labelStyle}>誕生日（任意）</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
          <div style={{ gridColumn: "1 / 3" }}><div style={labelStyle}>メモ・備考（任意）</div><textarea style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          {musicList.length > 0 && (
            <div style={{ gridColumn: "1 / 3" }}>
              <div style={labelStyle}>紐づける曲（任意）</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 120, overflow: "auto", border: "1px solid #eee", borderRadius: 6, padding: 6 }}>
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
        {overlapping && (
          <div style={{ background: "#d6336c", borderRadius: 10, margin: "12px 0 0", padding: "11px 12px" }}>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.5 }}>⚠ 他のオブジェクトと重なっています。このままでは保存できません。</p>
            <button type="button" onClick={() => { const free = findFreeAnchor(form.anchorX, form.anchorY, form.w, form.h, others ?? [], initial.id); setForm((f) => ({ ...f, anchorX: free.x, anchorY: free.y })); onDraftMove?.(free.x, free.y); }} style={{ marginTop: 9, width: "100%", padding: "11px", border: "none", borderRadius: 8, background: "#fff", color: "#d6336c", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>✨ 重ならない近くの場所へ移動</button>
          </div>
        )}
        {err && <p style={{ color: "#e03131", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="submit" disabled={busy || overlapping} style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: overlapping ? "#adb5bd" : "#1c7ed6", color: "#fff", fontWeight: 600, cursor: overlapping ? "not-allowed" : "pointer" }}>{isNew ? "追加" : "保存"}</button>
          {!isNew && <button type="button" onClick={remove} disabled={busy} style={{ padding: "8px 16px", border: "1px solid #ffc9c9", borderRadius: 6, background: "#fff", color: "#e03131", cursor: "pointer" }}>削除</button>}
          <button type="button" onClick={onClose} disabled={busy} style={{ padding: "8px 16px", border: "1px solid #ced4da", borderRadius: 6, background: "#fff", cursor: "pointer" }}>閉じる</button>
        </div>
      </form>
    </div>
  );
}
