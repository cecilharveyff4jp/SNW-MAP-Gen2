// 名前の正規化・照合ロジック（サーバの _shared.ts と同じ toHalf を移植）。
// SNW-MAP-Gen2 では member_name は保存時に toHalf() で半角化される。
// 照合するには抽出した名前にも同じ正規化を適用する必要がある。

const KANA = {
  "ガ":"ｶﾞ","ギ":"ｷﾞ","グ":"ｸﾞ","ゲ":"ｹﾞ","ゴ":"ｺﾞ","ザ":"ｻﾞ","ジ":"ｼﾞ","ズ":"ｽﾞ","ゼ":"ｾﾞ","ゾ":"ｿﾞ",
  "ダ":"ﾀﾞ","ヂ":"ﾁﾞ","ヅ":"ﾂﾞ","デ":"ﾃﾞ","ド":"ﾄﾞ","バ":"ﾊﾞ","ビ":"ﾋﾞ","ブ":"ﾌﾞ","ベ":"ﾍﾞ","ボ":"ﾎﾞ",
  "パ":"ﾊﾟ","ピ":"ﾋﾟ","プ":"ﾌﾟ","ペ":"ﾍﾟ","ポ":"ﾎﾟ","ヴ":"ｳﾞ",
  "ァ":"ｧ","ィ":"ｨ","ゥ":"ｩ","ェ":"ｪ","ォ":"ｫ","ャ":"ｬ","ュ":"ｭ","ョ":"ｮ","ッ":"ｯ","ー":"ｰ",
  "ア":"ｱ","イ":"ｲ","ウ":"ｳ","エ":"ｴ","オ":"ｵ","カ":"ｶ","キ":"ｷ","ク":"ｸ","ケ":"ｹ","コ":"ｺ",
  "サ":"ｻ","シ":"ｼ","ス":"ｽ","セ":"ｾ","ソ":"ｿ","タ":"ﾀ","チ":"ﾁ","ツ":"ﾂ","テ":"ﾃ","ト":"ﾄ",
  "ナ":"ﾅ","ニ":"ﾆ","ヌ":"ﾇ","ネ":"ﾈ","ノ":"ﾉ","ハ":"ﾊ","ヒ":"ﾋ","フ":"ﾌ","ヘ":"ﾍ","ホ":"ﾎ",
  "マ":"ﾏ","ミ":"ﾐ","ム":"ﾑ","メ":"ﾒ","モ":"ﾓ","ヤ":"ﾔ","ユ":"ﾕ","ヨ":"ﾖ",
  "ラ":"ﾗ","リ":"ﾘ","ル":"ﾙ","レ":"ﾚ","ロ":"ﾛ","ワ":"ﾜ","ヲ":"ｦ","ン":"ﾝ",
  "、":"､","。":"｡","「":"｢","」":"｣","・":"･","　":" ",
};

/** ランキング名の末尾に付く「（42）」等のレベル表示を除去。 */
export function cleanName(name) {
  return String(name).replace(/[（(]\s*\d+\s*[）)]\s*$/, "").trim();
}

/** サーバ _shared.ts の toHalf() と同一。全角英数・カナを半角化。 */
export function toHalf(s) {
  s = String(s).replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  return Array.from(s).map((c) => KANA[c] ?? c).join("");
}

/** DB の member_name と厳密照合するための第一キー（保存時と同じ形）。 */
export function primaryKey(name) {
  return toHalf(name).trim();
}

/** 装飾記号・空白を除いた緩い照合キー（表記ゆれ吸収用）。 */
export function looseKey(name) {
  const half = toHalf(name).trim().toLowerCase();
  // 記号・絵文字・空白を除去し、英数字・カナ・漢字などの「中身」だけ残す
  return Array.from(half)
    .filter((ch) => /[0-9a-z぀-ヿｦ-ﾟ一-鿿]/i.test(ch))
    .join("");
}

/**
 * ランキング抽出（{name,power}）を現行 objects と照合する。
 * objects: [{id, member_name, power, type}] 相当
 * 返り値: { matched, fuzzy, unmatched, dbOnly }
 */
export function matchRanking(ranking, objects, opts = {}) {
  const useFuzzy = opts.fuzzy !== false; // 既定で緩い照合も試す

  // DB 側インデックス
  const byPrimary = new Map(); // key -> [obj]
  const byLoose = new Map();
  for (const o of objects) {
    const name = o.member_name;
    if (name == null || name === "") continue;
    const pk = primaryKey(name);
    const lk = looseKey(name);
    if (pk) (byPrimary.get(pk) ?? byPrimary.set(pk, []).get(pk)).push(o);
    if (lk) (byLoose.get(lk) ?? byLoose.set(lk, []).get(lk)).push(o);
  }

  const matched = [];   // {rank,name,power, id, oldPower, dbName, type, via}
  const fuzzy = [];     // {rank,name,power, id, oldPower, dbName, type} 要確認
  const unmatched = []; // {rank,name,power, reason}
  const usedIds = new Set();

  for (const r of ranking) {
    const pk = primaryKey(r.name);
    const lk = looseKey(r.name);
    let hit = byPrimary.get(pk);
    let via = "exact";
    if ((!hit || hit.length === 0) && useFuzzy) { hit = byLoose.get(lk); via = "loose"; }

    if (!hit || hit.length === 0) {
      unmatched.push({ ...r, reason: "no-match" });
      continue;
    }
    // 既に使われていない候補に絞る
    const avail = hit.filter((o) => !usedIds.has(o.id));
    if (avail.length === 0) {
      unmatched.push({ ...r, reason: "all-candidates-used" });
      continue;
    }
    if (avail.length > 1) {
      // 複数候補 → 曖昧。要確認へ（先頭を提示）
      fuzzy.push({ ...r, id: avail[0].id, oldPower: avail[0].power ?? null,
        dbName: avail[0].member_name, type: avail[0].type,
        candidates: avail.map((o) => ({ id: o.id, member_name: o.member_name, type: o.type })), via });
      continue;
    }
    const o = avail[0];
    usedIds.add(o.id);
    const rec = { rank: r.rank ?? null, name: r.name, power: r.power,
      id: o.id, oldPower: o.power ?? null, dbName: o.member_name, type: o.type, via };
    if (via === "exact") matched.push(rec);
    else fuzzy.push(rec); // loose 一致は要確認扱い
  }

  // ランキングに現れなかった DB メンバー（参考）
  const dbOnly = objects
    .filter((o) => o.member_name && !usedIds.has(o.id))
    .map((o) => ({ id: o.id, member_name: o.member_name, type: o.type, power: o.power ?? null }));

  return { matched, fuzzy, unmatched, dbOnly };
}

/** wrangler --json / D1 REST / 素の配列 いずれの形でも行配列を取り出す。 */
export function extractRows(data) {
  if (Array.isArray(data)) {
    if (data.length && data[0] && Array.isArray(data[0].results)) return data[0].results;
    return data;
  }
  if (data && Array.isArray(data.result)) {
    // Cloudflare D1 REST: { result: [ { results: [...] } ] }
    if (data.result[0] && Array.isArray(data.result[0].results)) return data.result[0].results;
    return data.result;
  }
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}
