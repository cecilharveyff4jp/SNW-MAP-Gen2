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
    return videoId ? "https://www.youtube.com/embed/" + videoId : url;
  }
  if (platform === "suno") {
    const songId = url.split("?")[0].replace(/\/$/, "").split("/").pop();
    return songId ? "https://suno.com/embed/" + songId + "/" : url;
  }
  return url;
}
