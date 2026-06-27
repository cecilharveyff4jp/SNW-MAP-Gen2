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
  { key: "blue", label: "ブルー（既定）", swatch: "#2563eb", vars: { "--app-bg": "#e9eef4", "--surface": "#f4f8fd", "--border": "#dbe6f2", "--header-grad": "linear-gradient(90deg,#1e3a8a,#2563eb)", "--badge-bg": "#ffffff", "--badge-text": "#1e3a8a", "--accent": "#1c7ed6", "--accent-strong": "#1b5fa8", "--accent-soft": "#e7f0fb" } },
  { key: "pink", label: "パステル桃", swatch: "#e64980", vars: { "--app-bg": "#fdeff5", "--surface": "#fdf4f8", "--border": "#f3d9e4", "--header-grad": "linear-gradient(90deg,#a61e4d,#e64980)", "--badge-bg": "#ffffff", "--badge-text": "#a61e4d", "--accent": "#e64980", "--accent-strong": "#a61e4d", "--accent-soft": "#fce4ee" } },
  { key: "orange", label: "パステル橙", swatch: "#f76707", vars: { "--app-bg": "#fff5ec", "--surface": "#fff8f2", "--border": "#f6e0cd", "--header-grad": "linear-gradient(90deg,#d9480f,#f76707)", "--badge-bg": "#ffffff", "--badge-text": "#d9480f", "--accent": "#f76707", "--accent-strong": "#d9480f", "--accent-soft": "#ffe8d6" } },
  { key: "green", label: "パステル緑", swatch: "#2f9e44", vars: { "--app-bg": "#eefbf1", "--surface": "#f4fbf6", "--border": "#d3ecd9", "--header-grad": "linear-gradient(90deg,#1b7a3d,#2f9e44)", "--badge-bg": "#ffffff", "--badge-text": "#1b7a3d", "--accent": "#2f9e44", "--accent-strong": "#1b7a3d", "--accent-soft": "#e3f7e8" } },
  { key: "purple", label: "ビビッド紫", swatch: "#7048e8", vars: { "--app-bg": "#f3eeff", "--surface": "#f8f4ff", "--border": "#e3d9f7", "--header-grad": "linear-gradient(90deg,#5f3dc4,#7048e8)", "--badge-bg": "#ffffff", "--badge-text": "#5f3dc4", "--accent": "#7048e8", "--accent-strong": "#5f3dc4", "--accent-soft": "#efe7ff" } },
  { key: "mono", label: "白黒", swatch: "#333333", vars: { "--app-bg": "#ececec", "--surface": "#fafafa", "--border": "#dcdcdc", "--header-grad": "linear-gradient(90deg,#111111,#333333)", "--badge-bg": "#ffffff", "--badge-text": "#111111", "--accent": "#262626", "--accent-strong": "#000000", "--accent-soft": "#e9e9e9" } },
];

const KEY_THEME = "snw_theme";

function applyVars(vars: ThemeVars) {
  const root = document.documentElement;
  (Object.keys(vars) as (keyof ThemeVars)[]).forEach((k) => root.style.setProperty(k, vars[k]));
}

export function setTheme(key: string) {
  const t = THEMES.find((x) => x.key === key) ?? THEMES[0];
  applyVars(t.vars);
  try { localStorage.setItem(KEY_THEME, t.key); } catch { /* noop */ }
}

export function getSavedThemeKey(): string {
  try { return localStorage.getItem(KEY_THEME) || "blue"; } catch { return "blue"; }
}

// 起動時に保存テーマを適用（描画前に呼ぶ）。
export function loadSavedTheme() {
  const t = THEMES.find((x) => x.key === getSavedThemeKey()) ?? THEMES[0];
  applyVars(t.vars);
}
