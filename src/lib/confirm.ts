// 削除確認ダイアログの共通ヘルパー。各画面で同じ文言・挙動に揃える。
interface ConfirmDialog {
  confirm: (opts: { title: string; message: string; okLabel?: string; danger?: boolean }) => Promise<boolean>;
}

export function confirmDelete(dlg: ConfirmDialog, itemName: string): Promise<boolean> {
  return dlg.confirm({
    title: itemName + "を削除",
    message: "この" + itemName + "を削除します。よろしいですか？",
    okLabel: "削除する",
    danger: true,
  });
}
