// 端末ごとのテーマ（localStorage）。ベース色から濃淡を派生し、背景・ヘッダー・カード（ほんのり色）・
// アクセント（ボタン/アイコン/選択中）まで連動させる。既定は現行ブルー。マップ内の種別色は対象外。

export interface ThemeVars {
  "--app-bg": string;       // ページ背景（薄い色）
  "--surface": string;      // カード背景（ほんのり色）
  "--border": string;       // カード境界
  "--header-grad": string;  // ヘッダーバー
  "--badge-bg": string;     // ロゴ/バッジ背景
  "--badge-text": string;   // ロゴ/バッジ文字
  "--accent": string;       // 主アクセント（ボタン/アイコン/選択中）
  "--accent-strong": string;// 濃いアクセント（強調・ホバー）
  "--accent-soft": string;  // 薄いアクセント背景（強調パネル/選択タブ）
}

export interface ThemeDef { key: string; label: string; swatch: string; vars: ThemeVars }

export const THEMES: ThemeDef[] = [
  { key: "aurora", label: "オーロラ（既定）", swatch: "#5b5bd6", vars: { "--app-bg": "#f6f7fb", "--surface": "#ffffff", "--border": "#e9ebf1", "--header-grad": "#ffffff", "--badge-bg": "#ffffff", "--badge-text": "#4b3fc4", "--accent": "#5b5bd6", "--accent-strong": "#4b3fc4", "--accent-soft": "#ededfc" } },
  { key: "blue", label: "ブルー", swatch: "#2563eb", vars: { "--app-bg": "#eef2f7", "--surface": "#ffffff", "--border": "#dce5f0", "--header-grad": "#ffffff", "--badge-bg": "#ffffff", "--badge-text": "#1b5fa8", "--accent": "#1c7ed6", "--accent-strong": "#1b5fa8", "--accent-soft": "#e7f0fb" } },
  { key: "pink", label: "ピンク", swatch: "#e64980", vars: { "--app-bg": "#f9f7f8", "--surface": "#ffffff", "--border": "#ece7ea", "--header-grad": "#ffffff", "--badge-bg": "#ffffff", "--badge-text": "#a61e4d", "--accent": "#e64980", "--accent-strong": "#a61e4d", "--accent-soft": "#fce4ee" } },
  { key: "orange", label: "オレンジ", swatch: "#f76707", vars: { "--app-bg": "#f9f8f6", "--surface": "#ffffff", "--border": "#ece8e3", "--header-grad": "#ffffff", "--badge-bg": "#ffffff", "--badge-text": "#d9480f", "--accent": "#f76707", "--accent-strong": "#d9480f", "--accent-soft": "#ffe8d6" } },
  { key: "green", label: "グリーン", swatch: "#2f9e44", vars: { "--app-bg": "#f6f9f7", "--surface": "#ffffff", "--border": "#e6ece8", "--header-grad": "#ffffff", "--badge-bg": "#ffffff", "--badge-text": "#1b7a3d", "--accent": "#2f9e44", "--accent-strong": "#1b7a3d", "--accent-soft": "#e3f7e8" } },
  { key: "purple", label: "パープル", swatch: "#7048e8", vars: { "--app-bg": "#f7f6fb", "--surface": "#ffffff", "--border": "#e8e6ef", "--header-grad": "#ffffff", "--badge-bg": "#ffffff", "--badge-text": "#5f3dc4", "--accent": "#7048e8", "--accent-strong": "#5f3dc4", "--accent-soft": "#efe7ff" } },
  { key: "mono", label: "モノクロ", swatch: "#333333", vars: { "--app-bg": "#f6f6f7", "--surface": "#ffffff", "--border": "#e7e7e9", "--header-grad": "#ffffff", "--badge-bg": "#ffffff", "--badge-text": "#111111", "--accent": "#262626", "--accent-strong": "#000000", "--accent-soft": "#ededee" } },
];

const KEY_THEME = "snw_theme";
const KEY_CUSTOM = "snw_theme_custom";
export const DEFAULT_CUSTOM = "#1c7ed6";

function applyVars(vars: ThemeVars) {
  const root = document.documentElement;
  (Object.keys(vars) as (keyof ThemeVars)[]).forEach((k) => root.style.setProperty(k, vars[k]));
}

// --- カスタムカラー：1色から9変数を派生 ---
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(rgb: [number, number, number]): string {
  return "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
// t=0で元色、t=1で目標色（白/黒）に近づける
function mix(rgb: [number, number, number], target: number, t: number): [number, number, number] {
  return [rgb[0] + (target - rgb[0]) * t, rgb[1] + (target - rgb[1]) * t, rgb[2] + (target - rgb[2]) * t];
}
const lighten = (rgb: [number, number, number], t: number) => toHex(mix(rgb, 255, t));
const darken = (rgb: [number, number, number], t: number) => toHex(mix(rgb, 0, t));

export function deriveTheme(hex: string): ThemeVars {
  const base = hexToRgb(hex);
  return {
    "--app-bg": lighten(base, 0.9),
    "--surface": lighten(base, 0.94),
    "--border": lighten(base, 0.74),
    "--header-grad": "linear-gradient(90deg," + darken(base, 0.4) + "," + hex + ")",
    "--badge-bg": "#ffffff",
    "--badge-text": darken(base, 0.35),
    "--accent": hex,
    "--accent-strong": darken(base, 0.22),
    "--accent-soft": lighten(base, 0.86),
  };
}

export function setTheme(key: string) {
  if (key === "custom") { setCustomTheme(getSavedCustomColor()); return; }
  const t = THEMES.find((x) => x.key === key) ?? THEMES[0];
  applyVars(t.vars);
  try { localStorage.setItem(KEY_THEME, t.key); } catch { /* noop */ }
}

export function setCustomTheme(hex: string) {
  applyVars(deriveTheme(hex));
  try { localStorage.setItem(KEY_THEME, "custom"); localStorage.setItem(KEY_CUSTOM, hex); } catch { /* noop */ }
}

export function getSavedThemeKey(): string {
  try { return localStorage.getItem(KEY_THEME) || "aurora"; } catch { return "aurora"; }
}

export function getSavedCustomColor(): string {
  try { return localStorage.getItem(KEY_CUSTOM) || DEFAULT_CUSTOM; } catch { return DEFAULT_CUSTOM; }
}

// 起動時に保存テーマを適用（描画前に呼ぶ）。
export function loadSavedTheme() {
  const key = getSavedThemeKey();
  if (key === "custom") { applyVars(deriveTheme(getSavedCustomColor())); return; }
  const t = THEMES.find((x) => x.key === key) ?? THEMES[0];
  applyVars(t.vars);
}
