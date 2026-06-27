import type { MusicItem } from "../lib/api";
import { getEmbedUrl, formatCredit } from "../lib/music";
import Icon from "./Icon";

export default function MusicPlayerModal({ item, onClose }: { item: MusicItem; onClose: () => void }) {
  const credit = formatCredit(item.composer, item.producer);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "snwfade 0.18s ease-out" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(440px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 14px 44px rgba(0,0,0,0.4)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid #eee" }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#7048e8,#9775fa)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="music" size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 15, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || "（タイトルなし）"}</strong>
            {credit && <div style={{ fontSize: 11.5, color: "#868e96", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{credit}</div>}
          </div>
          <button onClick={onClose} aria-label="閉じる" style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: "#f1f3f5", color: "#868e96", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
        <iframe title={item.title} src={getEmbedUrl(item.url)} style={{ width: "100%", height: 240, border: "none", display: "block" }} allow="autoplay; encrypted-media" />
      </div>
    </div>
  );
}
