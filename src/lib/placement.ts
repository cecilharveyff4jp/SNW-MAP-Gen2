import type { MapObject } from "./types";
import { cityKey } from "./survey";

export interface Placement { id: number; anchorX: number; anchorY: number }
export interface PlacementResult { placements: Placement[]; unplaced: MapObject[]; trapCount: number }

const tileKey = (x: number, y: number) => x + "," + y;
function center(o: { anchorX: number; anchorY: number; w: number; h: number }) {
  return { x: o.anchorX + o.w / 2, y: o.anchorY + o.h / 2 };
}

// アンケートの希望と総力に沿って、全都市を熊罠周辺へ自動配置する。
// answers: { memberKey: 'p1' | 'p2' | 'both' | 'any' }
// - 障害物（都市以外の全オブジェクト）を避ける
// - p1/p2 は各熊罠、both は中点、any も中点を狙い、総力の高い順に最近傍の空きへ詰める
export function autoPlace(objects: MapObject[], answers: Record<string, string>): PlacementResult {
  const cities = objects.filter((o) => o.type === "CITY" && o.id != null);
  const traps = objects.filter((o) => o.type === "BEAR_TRAP").sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  if (traps.length === 0) return { placements: [], unplaced: cities, trapCount: 0 };
  const c1 = center(traps[0]);
  const c2 = center(traps[1] || traps[0]);
  const mid = { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };

  // 障害物（都市以外の占有タイル）
  const blocked = new Set<string>();
  for (const o of objects) {
    if (o.type === "CITY") continue;
    for (let x = o.anchorX; x < o.anchorX + o.w; x++)
      for (let y = o.anchorY; y < o.anchorY + o.h; y++) blocked.add(tileKey(x, y));
  }
  const used = new Set<string>();
  const fits = (ax: number, ay: number, w: number, h: number) => {
    for (let x = ax; x < ax + w; x++)
      for (let y = ay; y < ay + h; y++) { const k = tileKey(x, y); if (blocked.has(k) || used.has(k)) return false; }
    return true;
  };
  const occupy = (ax: number, ay: number, w: number, h: number) => {
    for (let x = ax; x < ax + w; x++) for (let y = ay; y < ay + h; y++) used.add(tileKey(x, y));
  };

  const MAXR = 150;
  const findFree = (tc: { x: number; y: number }, w: number, h: number): { ax: number; ay: number } | null => {
    const ix = Math.round(tc.x - w / 2), iy = Math.round(tc.y - h / 2);
    for (let R = 0; R <= MAXR; R++) {
      let best: { ax: number; ay: number } | null = null, bestD = Infinity;
      for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) {
        if (R > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== R) continue; // 外周リングのみ
        const ax = ix + dx, ay = iy + dy;
        if (!fits(ax, ay, w, h)) continue;
        const cx = ax + w / 2, cy = ay + h / 2;
        const d = (cx - tc.x) ** 2 + (cy - tc.y) ** 2;
        if (d < bestD) { bestD = d; best = { ax, ay }; }
      }
      if (best) return best;
    }
    return null;
  };

  const prefOf = (o: MapObject) => answers[cityKey(o)] || "any";
  const targetOf = (pref: string) => (pref === "p1" ? c1 : pref === "p2" ? c2 : mid);
  const byPower = (a: MapObject, b: MapObject) => (b.power ?? 0) - (a.power ?? 0);

  const g12 = cities.filter((o) => { const p = prefOf(o); return p === "p1" || p === "p2"; }).sort(byPower);
  const gBoth = cities.filter((o) => prefOf(o) === "both").sort(byPower);
  const gAny = cities.filter((o) => { const p = prefOf(o); return p !== "p1" && p !== "p2" && p !== "both"; }).sort(byPower);

  const placements: Placement[] = [];
  const unplaced: MapObject[] = [];
  for (const o of [...g12, ...gBoth, ...gAny]) {
    const spot = findFree(targetOf(prefOf(o)), o.w, o.h);
    if (spot) { occupy(spot.ax, spot.ay, o.w, o.h); placements.push({ id: o.id as number, anchorX: spot.ax, anchorY: spot.ay }); }
    else unplaced.push(o);
  }
  return { placements, unplaced, trapCount: traps.length };
}
