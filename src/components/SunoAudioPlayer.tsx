import { useEffect, useRef, useState } from "react";
import { getSunoAudioUrl } from "../lib/music";
import Icon from "./Icon";

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return m + ":" + (ss < 10 ? "0" : "") + ss;
}

// Sunoの重い埋め込み(iframe)はiOSホーム画面アプリでメモリ超過→ページごとリロードを起こす。
// そこで音声mp3だけをネイティブ<audio>で鳴らす軽量プレーヤー（モバイル用）。読めない曲は別画面(Safari)へフォールバック。
export default function SunoAudioPlayer({ url, onPlayingChange }: { url: string; onPlayingChange?: (playing: boolean) => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [failed, setFailed] = useState(false);
  const seeking = useRef(false);
  const src = getSunoAudioUrl(url);

  const report = (p: boolean) => { setPlaying(p); onPlayingChange?.(p); };

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    // 選曲タップの流れで自動再生を試す（iOSでブロックされたら停止のまま＝ユーザーが再生ボタンを押す）
    a.play().then(() => report(true)).catch(() => report(false));
  }, [src]);

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  if (failed) {
    return (
      <div style={{ marginTop: 11 }} onClick={stop} onPointerDown={stop}>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", boxSizing: "border-box", padding: "12px 16px", borderRadius: 10, background: "linear-gradient(135deg,#7048e8,#9775fa)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px rgba(112,72,232,0.32)" }}><Icon name="play" size={16} />Sunoプレーヤーを開く（別画面）</a>
        <p style={{ margin: "7px 2px 0", fontSize: 11, color: "#98a2b3", textAlign: "center" }}>アプリ内で読み込めなかったため、別画面（Safari）で再生してください</p>
      </div>
    );
  }

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) a.play().then(() => report(true)).catch(() => {});
    else { a.pause(); report(false); }
  };

  return (
    <div onClick={stop} onPointerDown={stop} style={{ marginTop: 11, background: "linear-gradient(135deg,#3a2a6e,#553c99)", borderRadius: 12, padding: "12px 14px" }}>
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onDurationChange={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => { if (!seeking.current) setCur(e.currentTarget.currentTime); }}
        onPlay={() => report(true)}
        onPause={() => report(false)}
        onEnded={() => { report(false); setCur(0); }}
        onError={() => { setFailed(true); onPlayingChange?.(false); }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={toggle} aria-label={playing ? "一時停止" : "再生"} style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 21, border: "none", cursor: "pointer", background: "#fff", color: "#5b3fc4", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(0,0,0,0.25)" }}>
          <Icon name={playing ? "pause" : "play"} size={19} />
        </button>
        <span style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 20, flexShrink: 0 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{ width: 3, borderRadius: 2, background: "#d9ccff", height: 6, animation: playing ? `sneq${(i % 3) + 1} 0.65s infinite ease-in-out ${i * 0.09}s` : "none" }} />
          ))}
        </span>
        <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
          <span style={{ color: "#c9b8ff", fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>{fmt(cur)} / {fmt(dur)}</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={isFinite(dur) && dur > 0 ? dur : 0}
        value={cur}
        step={0.1}
        onChange={(e) => { const a = ref.current; if (a) { a.currentTime = Number(e.target.value); setCur(Number(e.target.value)); } }}
        onPointerDown={() => { seeking.current = true; }}
        onPointerUp={() => { seeking.current = false; }}
        aria-label="シーク"
        style={{ width: "100%", marginTop: 11, accentColor: "#c4b5fd", cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={stop} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#d9ccff", textDecoration: "none" }}><Icon name="link" size={12} />Sunoで開く</a>
      </div>
      <style>{"@keyframes sneq1{0%,100%{height:6px}50%{height:20px}}@keyframes sneq2{0%,100%{height:20px}50%{height:8px}}@keyframes sneq3{0%,100%{height:11px}50%{height:18px}}"}</style>
    </div>
  );
}
