import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type Kind = "confirm" | "prompt" | "alert" | "choose";
interface ChoiceOpt { label: string; value: string; danger?: boolean }
interface DlgState {
  kind: Kind;
  title?: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  okLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  options?: ChoiceOpt[];
}
interface ConfirmOpts { title?: string; message?: string; okLabel?: string; cancelLabel?: string; danger?: boolean }
interface PromptOpts { title?: string; message?: string; placeholder?: string; defaultValue?: string; okLabel?: string; cancelLabel?: string }
interface AlertOpts { title?: string; message?: string; okLabel?: string }
interface ChooseOpts { title?: string; message?: string; options: ChoiceOpt[]; cancelLabel?: string }
interface DialogApi {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
  alert: (o: AlertOpts) => Promise<void>;
  choose: (o: ChooseOpts) => Promise<string | null>;
}

const Ctx = createContext<DialogApi | null>(null);
export function useDialog(): DialogApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDialog must be used within <DialogProvider>");
  return c;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DlgState | null>(null);
  const [value, setValue] = useState("");
  const resolveRef = useRef<((v: unknown) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback((st: DlgState, initial: string): Promise<unknown> => {
    setState(st); setValue(initial);
    return new Promise<unknown>((res) => { resolveRef.current = res; });
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => open({ kind: "confirm", ...o }, "") as Promise<boolean>, [open]);
  const prompt = useCallback((o: PromptOpts) => open({ kind: "prompt", ...o }, o.defaultValue ?? "") as Promise<string | null>, [open]);
  const alert = useCallback((o: AlertOpts) => open({ kind: "alert", ...o }, "") as Promise<void>, [open]);
  const choose = useCallback((o: ChooseOpts) => open({ kind: "choose", ...o }, "") as Promise<string | null>, [open]);

  const settle = useCallback((result: unknown) => {
    const r = resolveRef.current; resolveRef.current = null; setState(null);
    if (r) r(result);
  }, []);

  const onOk = useCallback(() => {
    if (!state) return;
    if (state.kind === "prompt") settle(value);
    else if (state.kind === "confirm") settle(true);
    else settle(undefined);
  }, [state, value, settle]);
  const onCancel = useCallback(() => {
    if (!state) return;
    if (state.kind === "prompt" || state.kind === "choose") settle(null);
    else if (state.kind === "confirm") settle(false);
    else settle(undefined);
  }, [state, settle]);

  useEffect(() => {
    if (!state) return;
    if (state.kind === "prompt") setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); else if (e.key === "Enter" && state.kind !== "alert" && state.kind !== "choose") { e.preventDefault(); onOk(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onOk, onCancel]);

  const api: DialogApi = { confirm, prompt, alert, choose };

  return (
    <Ctx.Provider value={api}>
      {children}
      {state && (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }} style={overlay}>
          <div style={card}>
            {state.title && <div style={titleStyle}>{state.title}</div>}
            {state.message && <div style={msgStyle}>{state.message}</div>}
            {state.kind === "prompt" && (
              <input ref={inputRef} value={value} placeholder={state.placeholder} onChange={(e) => setValue(e.target.value)} style={inputStyle} />
            )}
            {state.kind === "choose" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                {state.options?.map((op) => (
                  <button key={op.value} onClick={() => settle(op.value)} style={{ ...btnBase, width: "100%", minWidth: 0, padding: "13px", textAlign: "left", background: op.danger ? "#fff0f0" : "var(--accent-soft, #eef4ff)", color: op.danger ? "#e03131" : "var(--accent-strong, #1c4fb8)", border: "1px solid " + (op.danger ? "#ffc9c9" : "var(--border, #cfe0ff)") }}>{op.label}</button>
                ))}
                <button onClick={onCancel} style={{ ...btnCancel, width: "100%", minWidth: 0, marginTop: 2 }}>{state.cancelLabel ?? "キャンセル"}</button>
              </div>
            ) : (
              <div style={btnRow}>
                {state.kind !== "alert" && (
                  <button onClick={onCancel} style={btnCancel}>{state.cancelLabel ?? "キャンセル"}</button>
                )}
                <button onClick={onOk} style={{ ...btnOk, background: state.danger ? "#e03131" : "var(--accent, #5b5bd6)" }}>{state.okLabel ?? (state.kind === "confirm" ? "OK" : state.kind === "prompt" ? "決定" : "OK")}</button>
              </div>
            )}
          </div>
          <style>{"@keyframes dlgpop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}@keyframes dlgfade{from{opacity:0}to{opacity:1}}"}</style>
        </div>
      )}
    </Ctx.Provider>
  );
}

const overlay: CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 1000, animation: "dlgfade 0.15s ease-out" };
const card: CSSProperties = { width: "100%", maxWidth: 380, background: "#fff", borderRadius: 18, boxShadow: "0 24px 64px -12px rgba(15,23,42,0.4)", padding: "22px 20px 18px", animation: "dlgpop 0.18s cubic-bezier(0.2,0.9,0.3,1)" };
const titleStyle: CSSProperties = { fontSize: 17, fontWeight: 700, color: "#1e293b", marginBottom: 8 };
const msgStyle: CSSProperties = { fontSize: 14, color: "#475569", lineHeight: 1.6, whiteSpace: "pre-wrap" };
const inputStyle: CSSProperties = { width: "100%", marginTop: 14, padding: "12px 14px", border: "1.5px solid #ced4da", borderRadius: 10, fontSize: 16, boxSizing: "border-box", outline: "none" };
const btnRow: CSSProperties = { display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" };
const btnBase: CSSProperties = { padding: "11px 18px", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", border: "none", minWidth: 92 };
const btnCancel: CSSProperties = { ...btnBase, background: "#f1f3f5", color: "#495057" };
const btnOk: CSSProperties = { ...btnBase, color: "#fff" };
