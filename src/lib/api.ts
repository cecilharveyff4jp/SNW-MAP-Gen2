import type { MapObject } from "./types";

export type ObjectInput = Omit<MapObject, "id" | "mapId">;

export async function listObjects(): Promise<MapObject[]> {
  const r = await fetch("/api/objects");
  if (!r.ok) throw new Error("一覧の取得に失敗しました (" + r.status + ")");
  return r.json();
}

export async function createObject(o: ObjectInput): Promise<{ id: number }> {
  const r = await fetch("/api/admin/objects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(o),
  });
  if (!r.ok) throw new Error(await errText(r));
  return r.json();
}

export async function updateObject(id: number, o: ObjectInput): Promise<void> {
  const r = await fetch("/api/admin/objects/" + id, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(o),
  });
  if (!r.ok) throw new Error(await errText(r));
}

export async function deleteObject(id: number): Promise<void> {
  const r = await fetch("/api/admin/objects/" + id, { method: "DELETE" });
  if (!r.ok) throw new Error(await errText(r));
}

async function errText(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { error?: string };
    return j.error || "エラー (" + r.status + ")";
  } catch {
    return "エラー (" + r.status + ")";
  }
}
