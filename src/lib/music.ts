// 作詞作曲・制作者からクレジット表示文字列を作る（曲一覧・プレーヤー共通）。
export function formatCredit(composer?: string, producer?: string): string {
  return [composer && "作詞作曲: " + composer, producer && "制作: " + producer].filter(Boolean).join("　");
}

export function getMusicPlatform(url: string): "youtube" | "suno" | "other" {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("suno.com") || url.includes("suno.ai")) return "suno";
  return "other";
}

// 埋め込み再生用URLへ変換
export function getEmbedUrl(url: string): string {
  const platform = getMusicPlatform(url);
  if (platform === "youtube") {
    let videoId = "";
    if (url.includes("youtube.com/watch")) {
      try { videoId = new URL(url).searchParams.get("v") || ""; } catch { videoId = ""; }
    } else if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1]?.split("?")[0] || "";
    }
    return videoId ? "https://www.youtube.com/embed/" + videoId + "?autoplay=1&playsinline=1&rel=0" : url;
  }
  if (platform === "suno") {
    const songId = url.split("?")[0].replace(/\/$/, "").split("/").pop();
    return songId ? "https://suno.com/embed/" + songId + "/" : url;
  }
  return url;
}

// iOSのホーム画面アプリ（standalone）判定。standaloneはSafariタブよりメモリ枠が小さく、
// 重い埋め込み（特にSunoの本格プレーヤー）を開いた瞬間にページごと自動リロード（＝落ちる）する。
export function isStandaloneApp(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const mm = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
    return !!mm || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

// Sunoの音声ファイル(mp3)直リンクを作る。song/<id> の id から cdn の mp3 を組み立てる。
// 重いプレーヤーiframeを読まずネイティブ<audio>で鳴らすためのURL。
export function getSunoAudioUrl(url: string): string {
  const id = url.split("?")[0].replace(/\/$/, "").split("/").pop();
  return id ? "https://cdn1.suno.ai/" + id + ".mp3" : url;
}

// モバイル端末（スマホ/タブレット）判定。PCは重い埋め込みでも落ちないので従来の埋め込み、
// モバイルだけ軽量ミニプレーヤーに切り替えるために使う。
export function isMobileDevice(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
    // iPadOS 13+ はUAがMacに偽装されるのでタッチ数で補正
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
    // タッチ主体かつ狭い画面
    return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches) && window.innerWidth <= 820;
  } catch { return false; }
}
