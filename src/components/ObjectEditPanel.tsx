import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { ObjectType } from "../lib/types";
import { listMusic, type ObjectInput, type MusicItem } from "../lib/api";
import { getDefaultSize, FC_LEVELS, fcDisplay, overlapsAny, findFreeAnchor } from "../lib/sizes";
import { parseBirthday } from "../lib/birthday";
import { useDialog } from "./Dialog";
import { confirmDelete } from "../lib/confirm";
import Icon from "./Icon";

const TYPE_OPTIONS: { value: ObjectType; label: string }[] = [
  { value: "HQ", label: "本部 (HQ)" },
  { value: "CITY", label: "都市 (CITY)" },
  { value: "STATUE", label: "同盟建造物 (STATUE)" },
  { value: "DEPOT", label: "同盟資材 (DEPOT)" },
  { value: "BEAR_TRAP", label: "熊罠 (BEAR_TRAP)" },
  { value: "MOUNTAIN", label: "山 (MOUNTAIN)" },
  { value: "LAKE", label: "湖 (LAKE)" },
  { value: "FLAG", label: "旗 (FLAG)" },
  { value: "OTHER", label: "その他 (OTHER)" },
];
// 旧データで名前に地形絵文字が入っているものを種別変更時に消すための判定用。
const TERRAIN_EMOJIS = ["🏔", "🌊", "🏴"];

function NumStepper({ value, onChange, min }: { value: number; onChange: (v: number) => void; min?: number }) {
  const clamp = (v: number) => (min != null ? Math.max(min, v) : v);
  const parse = (s: string) => (s === "" ? 0 : parseInt(s, 10) || 0);
  const btn: CSSProperties = { width: 34, flexShrink: 0, border: "1px solid #ced4da", background: "#f8fafc", cursor: "pointer", fontSize: 18, fontWeight: 700, color: "#495057", display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none" };
  return (
    <div style={{ display: "flex", alignItems: "stretch", height: 40 }}>
      <button type="button" onClick={() => onChange(clamp(value - 1))} style={{ ...btn, borderRadius: "8px 0 0 8px", borderRight: "none" }}>−</button>
      <input type="number" value={value} onChange={(e) => onChange(clamp(parse(e.target.value)))} style={{ width: "100%", minWidth: 0, textAlign: "center", padding: "0 2px", border: "1px solid #ced4da", fontSize: 16, boxSizing: "border-box" }} />
      <button type="button" onClick={() => onChange(clamp(value + 1))} style={{ ...btn, borderRadius: "0 8px 8px 0", borderLeft: "none" }}>＋</button>
    </div>
  );
}

export type PanelInitial = ObjectInput & { id?: number };

interface Props {
  initial: PanelInitial;
  others?: { id?: number; anchorX: number; anchorY: number; w: number; h: number }[];
  onSave: (payload: ObjectInput, id?: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
  onDraftMove?: (x: number, y: number) => void;
  onCollapse?: () => void;
  onDuplicate?: (src: ObjectInput) => void;
}

export default function ObjectEditPanel({ initial, others, onSave, onDelete, onClose, onDraftMove, onCollapse, onDuplicate }: Props) {
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
  const isCity = form.type === "CITY";

  function changeType(t: ObjectType) {
    const d = getDefaultSize(t);
    const isT = t === "MOUNTAIN" || t === "LAKE" || t === "FLAG";
    const cur = (form.label ?? "").trim();
    const nextLabel = isT ? "" : (TERRAIN_EMOJIS.includes(cur) ? "" : form.label);
    const base = { ...form, type: t, w: d.w, h: d.h, label: nextLabel, ...(isT ? { fcLevel: "", birthday: "" } : {}) };
    if (isT) { setBMonth(""); setBDay(""); }
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
    if (!(await confirmDelete(dlg, "オブジェクト"))) return;
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
    <div style={{ border: "1px solid var(--border, #dee2e6)", borderRadius: 14, padding: 16, marginTop: 12, background: "var(--surface, #fff)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{isNew ? "新規オブジェクト" : "オブジェクトを編集"}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {onCollapse && <button type="button" onClick={onCollapse} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #d0d7e2", background: "#f1f5fb", borderRadius: 9, padding: "7px 11px", fontSize: 12.5, fontWeight: 700, color: "#1971c2", cursor: "pointer", whiteSpace: "nowrap" }}><Icon name="chevronDown" size={16} />地図で調整</button>}
          <button type="button" onClick={onClose} aria-label="閉じる" style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: "#f1f3f5", color: "#868e96", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} /></button>
        </div>
      </div>
      <form onSubmit={submit}>
        {/* よく使う項目（強調） */}
        <div style={{ background: "var(--accent-soft, #f5f8ff)", border: "1px solid var(--border, #e7edff)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={emLabel}>種別</div>
            <select style={emInput} value={form.type} onChange={(e) => changeType(e.target.value as ObjectType)}>
              {TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <div style={emLabel}>名前</div>
            <input style={emInput} type="text" value={form.label ?? ""} placeholder="例: ミクヲ / 本部" onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div>
            <div style={emLabel}>溶鉱炉レベル（FC）</div>
            <select style={{ ...emInput, opacity: isTerrain ? 0.5 : 1 }} disabled={isTerrain} value={form.fcLevel ?? ""} onChange={(e) => setForm({ ...form, fcLevel: e.target.value || undefined })}>
              <option value="">（なし）</option>
              {FC_LEVELS.map((v) => (<option key={v} value={v}>{fcDisplay(v)}</option>))}
            </select>
          </div>
        </div>

        {/* その他の項目（折りたたみ。タップ領域を大きく、保存ボタンとは別の見た目に） */}
        <button type="button" onClick={() => setShowDetail((v) => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 14, padding: "13px 15px", border: "1px solid #d0d7e2", borderRadius: 12, background: "#eef2f9", color: "#37486b", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="chevronDown" size={18} style={{ transform: showDetail ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />その他の項目（座標・サイズなど）</span>
        </button>
        {showDetail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {isCity && <div><div style={labelMuted}>ゲーム内ID（任意）</div><input style={inputStyle} type="text" value={form.gameId ?? ""} onChange={(e) => setForm({ ...form, gameId: e.target.value })} /></div>}
            {isCity && (
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
            )}
            {!isTerrain && <div><div style={labelMuted}>メモ・備考（任意）</div><textarea style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} value={form.note ?? ""} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>}
            <div>
              <div style={labelMuted}>座標・サイズ（−／＋で調整）</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><div style={labelMuted}>X</div><NumStepper value={form.anchorX} onChange={(v) => { setForm({ ...form, anchorX: v }); onDraftMove?.(v, form.anchorY); }} /></div>
                <div><div style={labelMuted}>Y</div><NumStepper value={form.anchorY} onChange={(v) => { setForm({ ...form, anchorY: v }); onDraftMove?.(form.anchorX, v); }} /></div>
                <div><div style={labelMuted}>幅</div><NumStepper value={form.w} min={1} onChange={(v) => setForm({ ...form, w: v })} /></div>
                <div><div style={labelMuted}>高さ</div><NumStepper value={form.h} min={1} onChange={(v) => setForm({ ...form, h: v })} /></div>
              </div>
            </div>
            {!isTerrain && musicList.length > 0 && (
              <div>
                <div style={labelMuted}>紐づける曲（任意）</div>
                {selMusic.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {selMusic.map((id) => {
                      const m = musicList.find((x) => x.id === id);
                      if (!m) return null;
                      return (
                        <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f3f0ff", color: "#5b3ec8", border: "1px solid #d7ccf7", borderRadius: 999, padding: "5px 6px 5px 11px", fontSize: 13, fontWeight: 600 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{m.title}</span>
                          <button type="button" onClick={() => toggleMusic(id)} aria-label="解除" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", border: "none", background: "#e4dbfb", color: "#5b3ec8", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {(() => {
                  const avail = musicList.filter((m) => !selMusic.includes(m.id));
                  return (
                    <select value="" disabled={avail.length === 0} onChange={(e) => { const v = Number(e.target.value); if (v) toggleMusic(v); }} style={{ ...inputStyle, color: "#495057", cursor: avail.length ? "pointer" : "not-allowed" }}>
                      <option value="">{avail.length ? "＋ 曲を追加…" : "（追加できる曲がありません）"}</option>
                      {avail.map((m) => (<option key={m.id} value={m.id}>{m.title}（{m.type === "alliance" ? "同盟" : "都市"}）</option>))}
                    </select>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {overlapping && (
          <div style={{ background: "#d6336c", borderRadius: 10, margin: "12px 0 0", padding: "11px 12px" }}>
            <p style={{ color: "#fff", fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.5 }}>⚠ 他のオブジェクトと重なっています。このままでは保存できません。</p>
            <button type="button" onClick={() => { const free = findFreeAnchor(form.anchorX, form.anchorY, form.w, form.h, others ?? [], initial.id); setForm((f) => ({ ...f, anchorX: free.x, anchorY: free.y })); onDraftMove?.(free.x, free.y); }} style={{ marginTop: 9, width: "100%", padding: "11px", border: "none", borderRadius: 8, background: "#fff", color: "#d6336c", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>重ならない近くの場所へ移動</button>
          </div>
        )}
        {err && <p style={{ color: "#e03131", fontSize: 13, margin: "10px 0 0" }}>{err}</p>}

        {/* 操作ボタン（折りたたみトグルと押し間違えないよう仕切り線で分離） */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #edf0f4" }}>
          <button type="submit" disabled={busy || overlapping} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "14px", border: "none", borderRadius: 12, background: overlapping ? "#adb5bd" : "var(--accent, #1c7ed6)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: overlapping ? "not-allowed" : "pointer", boxShadow: overlapping ? "none" : "0 4px 14px rgba(28,126,214,0.35)" }}><Icon name="check" size={20} />{isNew ? "追加する" : "保存する"}</button>
          {!isNew && onDuplicate && (
            <button type="button" onClick={() => onDuplicate(form)} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 12, padding: "11px", border: "1px solid #ced4da", borderRadius: 10, background: "#fff", color: "#495057", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}><Icon name="plus" size={16} />同じ設定で複製して追加</button>
          )}
          {!isNew && (
            <button type="button" onClick={remove} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 14, padding: "10px", border: "none", borderRadius: 10, background: "transparent", color: "#e03131", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}><Icon name="trash" size={16} />このオブジェクトを削除</button>
          )}
        </div>
      </form>
    </div>
  );
}
