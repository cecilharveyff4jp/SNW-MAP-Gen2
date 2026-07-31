import { useState } from "react";
import { createPortal } from "react-dom";
import { toDataURL } from "qrcode";
import Icon from "./Icon";
import { btnGhost } from "../lib/styles";

// 任意のURLをQRコードで表示・保存できる共有ボタン（オフライン生成・外部送信なし）。
export default function QrShare({ url, label = "QRを表示" }: { url: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const show = async () => {
    setOpen(true);
    if (!img) {
      try { setImg(await toDataURL(url, { width: 280, margin: 2, color: { dark: "#1b2330", light: "#ffffff" } })); }
      catch { /* noop */ }
    }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* noop */ } };

  return (
    <>
      <button onClick={show} style={{ ...btnGhost, cursor: "pointer" }}><Icon name="qr" size={15} />{label}</button>
      {open && createPortal(
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 20, width: "min(320px, 100%)", boxShadow: "0 18px 50px rgba(0,0,0,0.32)", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <strong style={{ fontSize: 15, color: "#1b2330" }}>QRコード</strong>
              <button onClick={() => setOpen(false)} aria-label="閉じる" style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: 8, border: "none", background: "#f1f3f5", color: "#868e96", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={16} /></button>
            </div>
            {img ? <img src={img} alt="QRコード" style={{ width: "100%", maxWidth: 240, height: "auto", borderRadius: 8 }} /> : <div style={{ padding: 40, color: "#adb5bd", fontSize: 13 }}>生成中…</div>}
            <div style={{ fontSize: 11.5, color: "#868e96", marginTop: 10, wordBreak: "break-all" }}>{url}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={copy} style={{ ...btnGhost, cursor: "pointer" }}><Icon name={copied ? "check" : "link"} size={15} />{copied ? "コピーしました" : "リンクをコピー"}</button>
              {img && <a href={img} download="snw-qr.png" style={{ ...btnGhost, textDecoration: "none" }}><Icon name="download" size={15} />画像を保存</a>}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
