import type { MapObject } from "./types";

export type SurveyOption = { value: string; label: string };
export interface SurveyData {
  key: string;
  title: string;
  active: boolean;
  options: SurveyOption[];
  answers: Record<string, string>;
  counts: Record<string, number>;
  total: number;
}

// 都市（メンバー）の横断同定キー。全処理で共通利用。
export function cityKey(o: MapObject): string {
  return (o.gameId && o.gameId.trim()) || (o.memberName && o.memberName.trim()) || (o.label && o.label.trim()) || ("obj-" + (o.id ?? "?"));
}

export async function getSurvey(key: string): Promise<SurveyData> {
  const r = await fetch("/api/survey?key=" + encodeURIComponent(key));
  if (!r.ok) throw new Error("survey failed " + r.status);
  return r.json();
}
export async function submitSurveyAnswer(key: string, memberKey: string, value: string): Promise<void> {
  const r = await fetch("/api/survey", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, memberKey, value }) });
  if (!r.ok) {
    if (r.status === 409) throw new Error("募集は終了しています");
    throw new Error("保存に失敗しました (" + r.status + ")");
  }
}
export async function setSurveyActive(key: string, active: boolean): Promise<void> {
  const r = await fetch("/api/admin/survey", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, active }) });
  if (!r.ok) throw new Error("切替に失敗しました (" + r.status + ")");
}
