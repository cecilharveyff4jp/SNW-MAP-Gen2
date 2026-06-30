// 並び替えドラッグ中フラグ。CenteredPage の「引っ張って更新」を一時無効化するために共有する。
let active = false;
export function setDragActive(v: boolean) { active = v; }
export function isDragActive() { return active; }
