// 端末ごとのテーマ（localStorage）。UIのアクセント・ヘッダー・背景・ロゴ色をCSS変数で切替。
// 既定は現行のブルー。マップ内の種別色など意味を持つ色は対象外。

export interface ThemeVars {
  "--app-bg": string;
  "--header-grad": string;
  "--badge-bg": string;
  "--badge-text": string;
  "--accent": string;
}

export interface ThemeDef { key: string; label: string; swatch: string; vars: ThemeVars }

export const THEMES: ThemeDef[] = [
  { key: "blue", label: "ブルー（既定）", swatch: "#2563eb", vars: { "--app-bg": "#e9eef4", "--header-grad": "linear-gradient(90deg,#1e3a8a,#2563eb)", "--badge-bg": "#ffffff", "--badge-text": "#1e3a8a", "--accent": "#1c7ed6" } },
  { key: "pink", label: "パステル桃", swatch: "#e64980", vars: { "--app-bg": "#fdeff5", "--header-grad": "linear-gradient(90deg,#a61e4d,#e64980)", "--badge-bg": "#ffffff", "--badge-text": "#a61e4d", "--accent": "#e64980" } },
  { key: "orange", label: "パステル橙", swatch: "#f76707", vars: { "--app-bg": "#fff5ec", "--header-grad": "linear-gradient(90deg,#d9480f,#f76707)", "--badge-bg": "#ffffff", "--badge-text": "#d9480f", "--accent": "#f76707" } },
  { key: "green", label: "パステル緑", swatch: "#2f9e44", vars: { "--app-bg": "#eefbf1", "--header-grad": "linear-gradient(90deg,#1b7a3d,#2f9e44)", "--badge-bg": "#ffffff", "--badge-text": "#1b7a3d", "--accent": "#2f9e44" } },
  { key: "purple", label: "ビビッド紫", swatch: "#7048e8", vars: { "--app-bg": "#f3eeff", "--header-grad": "linear-gradient(90deg,#5f3dc4,#7048e8)", "--badge-bg": "#ffffff", "--badge-text": "#5f3dc4", "--accent": "#7048e8" } },
  { key: "dos", label: "ターミナル（黒×緑）", swatch: "#2f9e44", vars: { "--app-bg": "#04140a", "--header-grad": "linear-gradient(90deg,#022b12,#024d22)", "--badge-bg": "#033b1a", "--badge-text": "#39ff7a", "--accent": "#2f9e44" } },
  { key: "mono", label: "白黒", swatch: "#333333", vars: { "--app-bg": "#e9e9e9", "--header-grad": "linear-gradient(90deg,#111111,#333333)", "--badge-bg": "#ffffff", "--badge-text": "#111111", "--accent": "#262626" } },
];

const KEY_THEME = "snw_theme";
const KEY_ACCENT = "snw_accent";

function applyVars(vars: ThemeVars) {
  const root = document.documentElement;
  (Object.keys(vars) as (keyof ThemeVars)[]).forEach((k) => root.style.setProperty(k, vars[k]));
}

export function setTheme(key: string) {
  const t = THEMES.find((x) => x.key === key) ?? THEMES[0];
  applyVars(t.vars);
  try { localStorage.setItem(KEY_THEME, t.key); localStorage.removeItem(KEY_ACCENT); } catch { /* noop */ }
}

export function setCustomAccent(hex: string) {
  const base = THEMES[0].vars;
  applyVars({ ...base, "--app-bg": "#eef1f5", "--header-grad": "linear-gradient(100deg," + hex + "," + hex + "cc)", "--badge-bg": "#ffffff", "--badge-text": hex, "--accent": hex });
  try { localStorage.setItem(KEY_THEME, "custom"); localStorage.setItem(KEY_ACCENT, hex); } catch { /* noop */ }
}

export function getSavedTheme(): { key: string; accent: string } {
  try { return { key: localStorage.getItem(KEY_THEME) || "blue", accent: localStorage.getItem(KEY_ACCENT) || "" }; }
  catch { return { key: "blue", accent: "" }; }
}

// 起動時に保存テーマを適用（描画前に呼ぶ）。
export function loadSavedTheme() {
  const { key, accent } = getSavedTheme();
  if (key === "custom" && accent) { setCustomAccent(accent); return; }
  const t = THEMES.find((x) => x.key === key) ?? THEMES[0];
  applyVars(t.vars);
}
