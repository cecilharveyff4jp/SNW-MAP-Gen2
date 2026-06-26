import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { MapObject, ObjectType } from "../lib/types";
import { createObject, updateObject, deleteObject, type ObjectInput } from "../lib/api";
import { getDefaultSize, FC_LEVELS, fcDisplay } from "../lib/sizes";

const TYPE_OPTIONS: { value: ObjectType; label: string }[] = [
  { value: "HQ", label: "本部 (HQ)" },
  { value: "CITY", label: "都市 (CITY)" },
  { value: "STATUE", label: "像 (STATUE)" },
  { value: "DEPOT", label: "デポ (DEPOT)" },
  { value: "BEAR_TRAP", label: "熊罠 (BEAR_TRAP)" },
  { value: "MOUNTAIN", label: "山 (MOUNTAIN)" },
  { value: "LAKE", label: "湖 (LAKE)" },
  { value: "FLAG", label: "旗 (FLAG)" },
];

const EMPTY: ObjectInput = {
  type: "CITY",
  anchorX: 0,
  anchorY: 0,
  w: 1,
  h: 1,
  label: "",
  memberName: "",
  gameId: "",
  fcLevel: "",
  note: "",
  birthday: "",
};

interface Props {
  objects: MapObject[];
  onChanged: () => void;
}

export default function ObjectEditor({ objects, onChanged }: Props) {
  const [form, setForm] = useState<ObjectInput>({ ...EMPTY });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setForm({ ...EMPTY });
    setEditingId(null);
    setErr(null);
  };

  const num = (v: string) => (v === "" ? 0 : parseInt(v, 10) || 0);

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
      };
      if (editingId == null) await createObject(payload);
      else await updateObject(editingId, payload);
      reset();
      onChanged();
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(o: MapObject) {
    setEditingId(o.id ?? null);
    setForm({
      type: o.type,
      anchorX: o.anchorX,
      anchorY: o.anchorY,
      w: o.w,
      h: o.h,
      label: o.label ?? "",
      memberName: o.memberName ?? "",
      gameId: o.gameId ?? "",
      fcLevel: o.fcLevel ?? "",
      note: o.note ?? "",
      birthday: o.birthday ?? "",
    });
    setErr(null);
  }

  async function remove(id: number) {
    if (!confirm("このオブジェクトを削除しますか？")) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteObject(id);
      if (editingId === id) reset();
      onChanged();
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  }

  const labelStyle: CSSProperties = { fontSize: 12, color: "#495057" };
  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #ced4da",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        border: "1px solid #dee2e6",
        borderRadius: 8,
        padding: 16,
        marginTop: 12,
        background: "#fff",
      }}
    >
      <h3 style={{ margin: "0 0 12px" }}>
        {editingId == null ? "新規オブジェクト" : "オブジェクトを編集 #" + editingId}
      </h3>

      <form onSubmit={submit}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <div style={{ gridColumn: "1 / 3" }}>
            <div style={labelStyle}>種別</div>
            <select
              style={inputStyle}
              value={form.type}
              onChange={(e) => {
                const t = e.target.value as ObjectType;
                const d = getDefaultSize(t);
                setForm({ ...form, type: t, w: d.w, h: d.h });
              }}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={labelStyle}>アンカー X（ゲーム座標）</div>
            <input
              style={inputStyle}
              type="number"
              value={form.anchorX}
              onChange={(e) =>
                setForm({ ...form, anchorX: num(e.target.value) })
              }
            />
          </div>
          <div>
            <div style={labelStyle}>アンカー Y（ゲーム座標）</div>
            <input
              style={inputStyle}
              type="number"
              value={form.anchorY}
              onChange={(e) =>
                setForm({ ...form, anchorY: num(e.target.value) })
              }
            />
          </div>

          <div>
            <div style={labelStyle}>幅 W（タイル）</div>
            <input
              style={inputStyle}
              type="number"
              min={1}
              value={form.w}
              onChange={(e) =>
                setForm({ ...form, w: Math.max(1, num(e.target.value)) })
              }
            />
          </div>
          <div>
            <div style={labelStyle}>高さ H（タイル）</div>
            <input
              style={inputStyle}
              type="number"
              min={1}
              value={form.h}
              onChange={(e) =>
                setForm({ ...form, h: Math.max(1, num(e.target.value)) })
              }
            />
          </div>

          <div style={{ gridColumn: "1 / 3" }}>
            <div style={labelStyle}>ラベル（任意）</div>
            <input
              style={inputStyle}
              type="text"
              value={form.label ?? ""}
              placeholder="例: メイン都市"
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: "1 / 3" }}>
            <div style={labelStyle}>メンバー名 / プレイヤー名（任意）</div>
            <input
              style={inputStyle}
              type="text"
              value={form.memberName ?? ""}
              onChange={(e) => setForm({ ...form, memberName: e.target.value })}
            />
          </div>

          <div>
            <div style={labelStyle}>ゲーム内ID（任意）</div>
            <input
              style={inputStyle}
              type="text"
              value={form.gameId ?? ""}
              placeholder="都市のID等"
              onChange={(e) => setForm({ ...form, gameId: e.target.value })}
            />
          </div>
          <div>
            <div style={labelStyle}>FCレベル（任意）</div>
            <select
              style={inputStyle}
              value={form.fcLevel ?? ""}
              onChange={(e) =>
                setForm({ ...form, fcLevel: e.target.value || undefined })
              }
            >
              <option value="">（なし）</option>
              {FC_LEVELS.map((v) => (
                <option key={v} value={v}>
                  {fcDisplay(v)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "1 / 3" }}>
            <div style={labelStyle}>誕生日（任意・例「3月15日」）</div>
            <input
              style={inputStyle}
              type="text"
              value={form.birthday ?? ""}
              placeholder="例: 3月15日"
              onChange={(e) => setForm({ ...form, birthday: e.target.value })}
            />
          </div>

          <div style={{ gridColumn: "1 / 3" }}>
            <div style={labelStyle}>メモ・備考（任意）</div>
            <textarea
              style={{ ...inputStyle, minHeight: 56, resize: "vertical" }}
              value={form.note ?? ""}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </div>

        {err && (
          <p style={{ color: "#e03131", fontSize: 13, margin: "10px 0 0" }}>
            {err}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 6,
              background: "#1c7ed6",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {editingId == null ? "追加" : "更新"}
          </button>
          {editingId != null && (
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              style={{
                padding: "8px 16px",
                border: "1px solid #ced4da",
                borderRadius: 6,
                background: "#fff",
                cursor: "pointer",
              }}
            >
              キャンセル
            </button>
          )}
        </div>
      </form>

      <h4 style={{ margin: "18px 0 8px" }}>
        登録済み（{objects.length}件）
      </h4>
      {objects.length === 0 ? (
        <p style={{ color: "#868e96", fontSize: 13 }}>
          まだありません。上のフォームから追加してください。
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {objects.map((o) => (
            <div
              key={o.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                padding: "6px 8px",
                border: "1px solid #f1f3f5",
                borderRadius: 6,
              }}
            >
              <span style={{ flex: 1 }}>
                <strong>{o.label || o.type}</strong>{" "}
                <span style={{ color: "#868e96" }}>
                  {o.type} ({o.anchorX},{o.anchorY}) {o.w}×{o.h}
                  {o.fcLevel ? " " + fcDisplay(o.fcLevel) : ""}
                </span>
                {o.memberName ? (
                  <span style={{ color: "#1c7ed6" }}> / {o.memberName}</span>
                ) : null}
              </span>
              <button
                onClick={() => startEdit(o)}
                disabled={busy}
                style={btnSm}
              >
                編集
              </button>
              <button
                onClick={() => o.id && remove(o.id)}
                disabled={busy}
                style={{ ...btnSm, color: "#e03131" }}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btnSm: CSSProperties = {
  padding: "4px 10px",
  border: "1px solid #ced4da",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 12,
};
