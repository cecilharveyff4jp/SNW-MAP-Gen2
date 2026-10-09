// 名前の正規化・照合ロジック（サーバの _shared.ts と同じ toHalf を移植）。
// SNW-MAP-Gen2 では member_name は保存時に toHalf() で半角化される。
// 照合するには抽出した名前にも同じ正規化を適用する必要がある。
//
// 照合の優先順位: game_id（ゲーム内ID・不変） > 名前完全一致 > 名前の緩い一致。
// ゲーム内で改名が多いため、ID があれば最優先で使う。

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

/** プロフィール名の先頭に付く同盟タグ「[SNW]」等を除去（照合用。保存名の方針に合わせて使う）。 */
export function stripTag(name) {
  return String(name).replace(/^\s*[\[【][^\]】]*[\]】]\s*/, "").trim();
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
  return Array.from(half)
    .filter((ch) => /[0-9a-z぀-ヿｦ-ﾟ一-鿿]/i.test(ch))
    .join("");
}

const gid = (v) => (v == null ? "" : String(v).replace(/[^0-9]/g, "")); // ゲームIDは数字のみ

/**
 * ランキング/プロフィール抽出を現行 objects と照合する。
 * ranking: [{rank?, name, power, gameId?}]
 * objects: [{id, member_name, game_id, power, type}]
 * 返り値: { matched, fuzzy, unmatched, dbOnly }
 *   matched[].via = 'gameid' | 'exact'（自動反映OK）
 *   matched[].rename     = ID一致で名前が変わっている（member_name を更新すべき）
 *   matched[].seedGameId = DBに game_id が無く、今回の gameId で補完すべき
 *   fuzzy = loose一致（人手確認）
 */
export function matchRanking(ranking, objects, opts = {}) {
  const useFuzzy = opts.fuzzy !== false;

  const byGameId = new Map();
  const byPrimary = new Map();
  const byLoose = new Map();
  for (const o of objects) {
    const g = gid(o.game_id);
    if (g) (byGameId.get(g) ?? byGameId.set(g, []).get(g)).push(o);
    const name = o.member_name;
    if (name == null || name === "") continue;
    const pk = primaryKey(name);
    const lk = looseKey(name);
    if (pk) (byPrimary.get(pk) ?? byPrimary.set(pk, []).get(pk)).push(o);
    if (lk) (byLoose.get(lk) ?? byLoose.set(lk, []).get(lk)).push(o);
  }

  const matched = [];
  const fuzzy = [];
  const unmatched = [];
  const usedIds = new Set();

  const take = (list) => (list ? list.filter((o) => !usedIds.has(o.id)) : []);

  for (const r of ranking) {
    const rg = gid(r.gameId);
    const pk = primaryKey(r.name);
    const lk = looseKey(r.name);

    let hit = null, via = null;
    if (rg) { const a = take(byGameId.get(rg)); if (a.length === 1) { hit = a[0]; via = "gameid"; } else if (a.length > 1) { hit = a[0]; via = "gameid"; } }
    if (!hit) { const a = take(byPrimary.get(pk)); if (a.length === 1) { hit = a[0]; via = "exact"; } else if (a.length > 1) { fuzzy.push({ ...r, id: a[0].id, oldPower: a[0].power ?? null, dbName: a[0].member_name, dbGameId: a[0].game_id ?? null, type: a[0].type, via: "exact-ambiguous" }); continue; } }
    if (!hit && useFuzzy) { const a = take(byLoose.get(lk)); if (a.length === 1) { hit = a[0]; via = "loose"; } else if (a.length > 1) { fuzzy.push({ ...r, id: a[0].id, oldPower: a[0].power ?? null, dbName: a[0].member_name, dbGameId: a[0].game_id ?? null, type: a[0].type, via: "loose-ambiguous" }); continue; } }

    if (!hit) { unmatched.push({ ...r, reason: "no-match" }); continue; }

    usedIds.add(hit.id);
    const dbGameId = hit.game_id ?? null;
    const rec = {
      ...r, gameId: rg || null,
      id: hit.id, oldPower: hit.power ?? null, dbName: hit.member_name, dbGameId, type: hit.type, via,
      dbX: hit.anchor_x ?? null, dbY: hit.anchor_y ?? null, dbFc: hit.fc_level ?? null,
      placed: hit.placed == null ? 1 : hit.placed,
      rename: via === "gameid" && primaryKey(r.name) !== primaryKey(hit.member_name ?? ""),
      seedGameId: !!rg && gid(dbGameId) !== rg,
    };
    if (via === "loose") fuzzy.push(rec); else matched.push(rec);
  }

  const dbOnly = objects
    .filter((o) => o.member_name && !usedIds.has(o.id))
    .map((o) => ({ id: o.id, member_name: o.member_name, game_id: o.game_id ?? null, type: o.type, power: o.power ?? null }));

  return { matched, fuzzy, unmatched, dbOnly };
}

/** wrangler --json / D1 REST / 素の配列 いずれの形でも行配列を取り出す。 */
export function extractRows(data) {
  if (Array.isArray(data)) {
    if (data.length && data[0] && Array.isArray(data[0].results)) return data[0].results;
    return data;
  }
  if (data && Array.isArray(data.result)) {
    if (data.result[0] && Array.isArray(data.result[0].results)) return data.result[0].results;
    return data.result;
  }
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}
