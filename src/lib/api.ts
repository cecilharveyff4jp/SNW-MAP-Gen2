import type { MapObject } from "./types";

export type ObjectInput = Omit<MapObject, "id" | "mapId">;

export interface Me {
  email: string | null;
  isOwner: boolean;
  status: string; // anonymous | none | pending | approved | rejected
  displayName: string | null;
}

export interface UserRow {
  email: string;
  display_name: string | null;
  status: string;
  role: string;
  requested_at: string;
  decided_at: string | null;
}

export interface MapInfo {
  id: number;
  name: string;
  isVisible: boolean;
  isBase: boolean;
  sortOrder: number;
}

// ---- 読み取り（公開） ----
export async function listObjects(mapId?: number): Promise<MapObject[]> {
  const r = await fetch("/api/objects" + (mapId != null ? "?map=" + mapId : ""));
  if (!r.ok) throw new Error("list failed " + r.status);
  return r.json();
}

export async function listMaps(): Promise<MapInfo[]> {
  const r = await fetch("/api/maps");
  if (!r.ok) throw new Error("maps failed " + r.status);
  return r.json();
}

// ---- マップ管理（オーナー） ----
export async function createMap(name: string): Promise<{ id: number }> {
  const r = await fetch("/api/admin/maps", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
  if (!r.ok) throw new Error(await errText(r));
  return r.json();
}
export async function updateMap(id: number, patch: { name?: string; isVisible?: boolean; sortOrder?: number }): Promise<void> {
  const r = await fetch("/api/admin/maps/" + id, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
  if (!r.ok) throw new Error(await errText(r));
}
export async function deleteMap(id: number): Promise<void> {
  const r = await fetch("/api/admin/maps/" + id, { method: "DELETE" });
  if (!r.ok) throw new Error(await errText(r));
}

// ---- 本人確認 / 申請（Access 配下） ----
export async function getMe(): Promise<Me> {
  const r = await fetch("/api/account/me", { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error("me failed " + r.status);
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error("not authenticated");
  return r.json();
}

export async function requestAccess(displayName: string): Promise<void> {
  const r = await fetch("/api/account/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  if (!r.ok) throw new Error(await errText(r));
}

// ---- ユーザー管理（オーナー） ----
export async function listUsers(): Promise<UserRow[]> {
  const r = await fetch("/api/admin/users");
  if (!r.ok) throw new Error(await errText(r));
  return r.json();
}

export async function setUserStatus(
  email: string,
  status: "approved" | "rejected" | "pending"
): Promise<void> {
  const r = await fetch("/api/admin/users/" + encodeURIComponent(email), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) throw new Error(await errText(r));
}

// ---- オブジェクト書き込み（承認済み編集者） ----
export async function createObject(o: ObjectInput, mapId?: number): Promise<{ id: number }> {
  const r = await fetch("/api/admin/objects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mapId != null ? { ...o, mapId } : o),
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
    return j.error || "error " + r.status;
  } catch {
    return "error " + r.status;
  }
}
