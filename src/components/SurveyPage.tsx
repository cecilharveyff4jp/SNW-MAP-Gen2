import { useEffect, useState } from "react";
import { listMaps, listObjects } from "../lib/api";
import type { MapObject } from "../lib/types";
import { getSurvey, submitSurveyAnswer, cancelSurveyAnswer, setSurveyActive, cityKey, type SurveyData } from "../lib/survey";
import { card, input, badgeSoft, btnGhost } from "../lib/styles";
import Icon from "./Icon";

const KEY = "trap_placement";
const COLORS: Record<string, string> = { p1: "#2f77e0", p2: "#e0453f", both: "#8a4fd6", any: "#98a2b3" };
const colorOf = (v: string) => COLORS[v] || "#98a2b3";
const SHORT: Record<string, string> = { p1: "罠1", p2: "罠2", both: "両方", any: "任せ" };
function cityName(o: MapObject): string { return o.label || o.memberName || ("都市#" + (o.id ?? "")); }

export default function SurveyPage({ canEdit }: { canEdit: boolean }) {
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [cities, setCities] = useState<MapObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [meKey, setMeKey] = useState<string | null>(null);
  const [meName, setMeName] = useState<string>("");
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [traps, setTraps] = useState<string[]>([]);
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());
  const [proxy, setProxy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminQ, setAdminQ] = useState("");
  const [adminOnly, setAdminOnly] = useState(false);
  const toggleGroup = (v: string) => setOpenSet((prev) => { const n = new Set(prev); if (n.has(v)) n.delete(v); else n.add(v); return n; });

  async function load() {
    try {
      const maps = await listMaps();
      const base = maps.find((m) => m.isBase) || maps[0];
      const objs = base ? await listObjects(base.id) : [];
      const cs = objs.filter((o) => o.type === "CITY").sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
      setCities(cs);
      setTraps(objs.filter((o) => o.type === "BEAR_TRAP").map((o) => (o.label || o.memberName || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b)));
      const s = await getSurvey(KEY);
      setSurvey(s);
      // 自分の都市を推定（snw_my_city=基準マップのオブジェクトID → 前回選択の cityKey）
      try {
        const v = localStorage.getItem("snw_my_city");
        const id = v ? Number(v) : null;
        const byId = id != null ? cs.find((o) => o.id === id) : undefined;
        const savedKey = localStorage.getItem("snw_survey_me");
        if (byId) { setMeKey(cityKey(byId)); setMeName(cityName(byId)); }
        else if (savedKey) { const c = cs.find((o) => cityKey(o) === savedKey); if (c) { setMeKey(savedKey); setMeName(cityName(c)); } }
      } catch { /* noop */ }
      // 都市カードからの遷移（代理入力を含む）。既定の自分の都市は上書きしない一度きりの指定。
      try {
        const target = sessionStorage.getItem("snw_survey_target");
        if (target) { sessionStorage.removeItem("snw_survey_target"); const c = cs.find((o) => cityKey(o) === target); if (c) { setMeKey(target); setMeName(cityName(c)); setPicking(false); let own: string | null = null; try { own = localStorage.getItem("snw_survey_me"); } catch { /* noop */ } setProxy(!!own && target !== own); } }
      } catch { /* noop */ }
      setErr(null);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const chooseCity = (o: MapObject) => { const k = cityKey(o); setMeKey(k); setMeName(cityName(o)); setPicking(false); setQ(""); setProxy(false); try { localStorage.setItem("snw_survey_me", k); } catch { /* noop */ } };
  const myAnswer = meKey && survey ? survey.answers[meKey] : undefined;
  const labelFor = (op: { value: string; label: string }) => {
    if (op.value === "p1") return (traps[0] || "熊罠1") + " に近づけたい";
    if (op.value === "p2") return (traps[1] || "熊罠2") + " に近づけたい";
    return op.label;
  };

  async function answer(value: string) {
    if (!meKey || !survey) return;
    setBusy(true); setErr(null);
    try { await submitSurveyAnswer(KEY, meKey, value); setSaved(true); window.setTimeout(() => setSaved(false), 1600); await load(); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }
  async function cancelAnswer() {
    if (!meKey) return;
    setBusy(true); setErr(null);
    try { await cancelSurveyAnswer(KEY, meKey); await load(); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }
  async function reloadSurvey() { try { const sv = await getSurvey(KEY); setSurvey(sv); } catch { /* noop */ } }
  async function setCityAnswer(o: MapObject, value: string) {
    const k = cityKey(o);
    setSurvey((sv) => (sv ? { ...sv, answers: { ...sv.answers, [k]: value } } : sv));
    try { await submitSurveyAnswer(KEY, k, value); await reloadSurvey(); } catch (e) { setErr(String((e as Error).message || e)); await reloadSurvey(); }
  }
  async function clearCityAnswer(o: MapObject) {
    const k = cityKey(o);
    setSurvey((sv) => { if (!sv) return sv; const a = { ...sv.answers }; delete a[k]; return { ...sv, answers: a }; });
    try { await cancelSurveyAnswer(KEY, k); await reloadSurvey(); } catch (e) { setErr(String((e as Error).message || e)); await reloadSurvey(); }
  }
  async function toggleActive() {
    if (!survey) return; setBusy(true); setErr(null);
    try { await setSurveyActive(KEY, !survey.active); await load(); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }

  if (loading) return <div style={card}>読み込み中…</div>;
  if (!survey) return <div style={card}><p style={{ color: "#e03131", margin: 0 }}>{err || "アンケートが見つかりません"}</p></div>;

  const answered = survey.total;
  const filtered = q.trim() ? cities.filter((o) => cityName(o).indexOf(q.trim()) >= 0) : cities;

  return (
    <div>
      {err && <div style={card}><p style={{ color: "#e03131", margin: 0 }}>{err}</p></div>}

      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#3f7fe0,#2f6fd0)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="target" size={18} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>{survey.title}</h2>
            <div style={{ fontSize: 12, color: survey.active ? "#2b8a3e" : "#868e96", fontWeight: 700, marginTop: 2 }}>{survey.active ? "● 受付中" : "○ 停止中"}</div>
          </div>
          {canEdit && (
            <button onClick={toggleActive} disabled={busy} style={{ ...btnGhost, cursor: "pointer", color: survey.active ? "#e03131" : "#2b8a3e", borderColor: survey.active ? "#ffc9c9" : "#b2f2bb" }}>{survey.active ? "募集を停止" : "募集を開始"}</button>
          )}
        </div>
        <p style={{ fontSize: 12.5, color: "#6b7684", margin: "10px 0 0", lineHeight: 1.6 }}>新しいマップでの都市配置を、みんなの希望をもとに決めます。あなたの都市の希望を選んでください（いつでも変更できます）。</p>
      </div>

      {!survey.active && !canEdit ? (
        <div style={card}><p style={{ margin: 0, color: "#868e96" }}>現在このアンケートは受付していません。募集が始まったらここで回答できます。</p></div>
      ) : (
        <>
          {/* 自分の都市 */}
          <div style={card}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 9, display: "flex", alignItems: "center", gap: 6 }}><Icon name="star" size={14} />{proxy ? "回答する都市" : "あなたの都市"}{proxy && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: "#b26a00", background: "#fff4e0", border: "1px solid #ffe0b2", borderRadius: 999, padding: "2px 8px" }}>代理入力中</span>}</div>
            {meKey && !picking ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--accent-soft, #eef4ff)", border: "1px solid #dbe7fb", borderRadius: 11, padding: "10px 12px" }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent, #2f6fd0)", color: "#fff", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{meName.slice(0, 2)}</span>
                <b style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meName}</b>
                <button onClick={() => setPicking(true)} style={{ ...btnGhost, cursor: "pointer", fontSize: 12, padding: "6px 10px" }}>変更</button>
              </div>
            ) : (
              <>
                <input style={input} placeholder="都市名で検索…" value={q} onChange={(e) => setQ(e.target.value)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
                  {filtered.slice(0, 60).map((o) => (
                    <button key={o.id} onClick={() => chooseCity(o)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", border: "1px solid var(--border, #eef1f4)", borderRadius: 10, background: "#fff", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ width: 26, height: 26, borderRadius: 7, background: "#eef1f5", color: "#7a8595", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{cityName(o).slice(0, 2)}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, fontSize: 14 }}>{cityName(o)}</span>
                    </button>
                  ))}
                  {filtered.length === 0 && <p style={{ color: "#868e96", fontSize: 13, margin: 6 }}>該当する都市がありません。</p>}
                </div>
              </>
            )}
          </div>

          {/* 4択 */}
          {meKey && (
            <div style={card}>
              <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 10 }}>どの熊罠に近づけたい？{saved && <span style={{ color: "#2b8a3e", marginLeft: 8, fontSize: 12 }}>✓ 保存しました</span>}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {survey.options.map((op) => {
                  const on = myAnswer === op.value;
                  const c = colorOf(op.value);
                  return (
                    <button key={op.value} onClick={() => answer(op.value)} disabled={busy || !survey.active} style={{ display: "flex", alignItems: "center", gap: 12, padding: 13, borderRadius: 12, cursor: survey.active ? "pointer" : "default", background: on ? "#fbfcff" : "#fff", border: "2px solid " + (on ? c : "var(--border, #e5e9f0)"), opacity: survey.active ? 1 : 0.6, textAlign: "left" }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: c, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 14.5 }}>{labelFor(op)}</span>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid " + (on ? c : "#cfd6df"), background: on ? c : "transparent", boxShadow: on ? "inset 0 0 0 3px #fff" : "none", flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
              {myAnswer && survey.active && <button onClick={cancelAnswer} disabled={busy} style={{ marginTop: 12, width: "100%", padding: "9px", borderRadius: 10, border: "1px solid #ffd0d0", background: "#fff", color: "#e03131", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>回答を取り消す</button>}
              {!survey.active && <p style={{ fontSize: 11.5, color: "#868e96", margin: "10px 2px 0" }}>※現在は募集停止中のため保存できません。</p>}
            </div>
          )}

          {/* 集計 */}
          <div style={card}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 10, display: "flex", justifyContent: "space-between" }}><span>今の回答状況</span><span style={badgeSoft}>{answered} / {cities.length} 人</span></div>
            {[...survey.options, { value: "__none__", label: "未回答" }].map((op) => {
              const none = op.value === "__none__";
              const list = none ? cities.filter((o) => !survey.answers[cityKey(o)]) : cities.filter((o) => survey.answers[cityKey(o)] === op.value);
              const n = list.length;
              const pct = Math.round((100 * n) / (cities.length || 1));
              const c = none ? "#adb5bd" : colorOf(op.value);
              const open = openSet.has(op.value);
              return (
                <div key={op.value} style={{ marginBottom: 8 }}>
                  <button onClick={() => toggleGroup(op.value)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: "3px 0", cursor: "pointer", textAlign: "left" }}>
                    <span style={{ width: 11, height: 11, borderRadius: "50%", background: c, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: none ? "#868e96" : c }}>{none ? "未回答" : labelFor(op)}</span>
                    <span style={{ fontSize: 12, color: "#868e96" }}>{n}人</span>
                    <Icon name="chevronDown" size={14} style={{ transform: open ? "rotate(180deg)" : "none", color: "#adb5bd" }} />
                  </button>
                  <div style={{ height: 6, borderRadius: 4, background: "#eef1f5", overflow: "hidden", marginTop: 2 }}><span style={{ display: "block", height: "100%", width: pct + "%", background: c }} /></div>
                  {open && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, marginBottom: 4 }}>
                      {list.length ? list.map((o) => (<span key={o.id} style={{ fontSize: 12, padding: "4px 9px", borderRadius: 999, background: none ? "#f1f3f5" : (c + "18"), color: none ? "#868e96" : c, fontWeight: 600 }}>{cityName(o)}</span>)) : <span style={{ fontSize: 12, color: "#adb5bd" }}>なし</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {canEdit && (
            <div style={card}>
              <button onClick={() => setAdminOpen((v) => !v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, fontWeight: 800 }}>
                <Icon name="edit" size={14} />管理者：回答を直接編集
                <span style={{ flex: 1 }} />
                <Icon name="chevronDown" size={16} style={{ transform: adminOpen ? "rotate(180deg)" : "none", color: "#adb5bd" }} />
              </button>
              {adminOpen && (
                <div style={{ marginTop: 12 }}>
                  {!survey.active && <p style={{ fontSize: 12, color: "#e8590c", background: "#fff4e6", borderRadius: 8, padding: "8px 10px", margin: "0 0 10px" }}>募集停止中は編集できません。上の「募集を開始」で開いてください。</p>}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <input style={{ ...input, flex: 1, marginBottom: 0 }} placeholder="都市名で検索…" value={adminQ} onChange={(e) => setAdminQ(e.target.value)} />
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#495057", whiteSpace: "nowrap" }}><input type="checkbox" checked={adminOnly} onChange={(e) => setAdminOnly(e.target.checked)} />未回答だけ</label>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
                    {cities.filter((o) => (!adminQ.trim() || cityName(o).indexOf(adminQ.trim()) >= 0) && (!adminOnly || !survey.answers[cityKey(o)])).map((o) => {
                      const k = cityKey(o); const cur = survey.answers[k];
                      return (
                        <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", border: "1px solid " + (cur ? "var(--border, #eef1f4)" : "#ffe3c2"), background: cur ? "#fff" : "#fffaf3", borderRadius: 9 }}>
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, fontSize: 13 }}>{cityName(o)}{!cur && <span style={{ marginLeft: 6, fontSize: 10.5, color: "#e8590c", fontWeight: 700 }}>未</span>}</span>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            {survey.options.map((op) => { const on = cur === op.value; const c = colorOf(op.value); return (
                              <button key={op.value} onClick={() => setCityAnswer(o, op.value)} disabled={!survey.active} title={labelFor(op)} style={{ width: 34, height: 30, borderRadius: 7, fontSize: 11.5, fontWeight: 800, cursor: survey.active ? "pointer" : "default", background: on ? c : "#fff", color: on ? "#fff" : c, border: "1px solid " + c, opacity: survey.active ? 1 : 0.5 }}>{SHORT[op.value] || "?"}</button>
                            ); })}
                            <button onClick={() => clearCityAnswer(o)} disabled={!survey.active || !cur} title="回答を消す" style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #e5e9f0", background: "#fff", color: "#adb5bd", cursor: (survey.active && cur) ? "pointer" : "default", opacity: (survey.active && cur) ? 1 : 0.4 }}>×</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <p style={{ marginTop: 16, marginLeft: 4 }}><a href="/" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="map" size={15} />地図に戻る</a></p>
    </div>
  );
}
