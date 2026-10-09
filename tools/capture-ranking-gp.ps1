# Google Play Games (Windows) 版：同盟ランキング(総力)の連続キャプチャ
#
# スマホ版 capture-ranking.mjs の置き換え。撮るものは同じで、経路だけが違う:
#   スマホ版      adb exec-out screencap  /  adb shell input swipe
#   GooglePlay版  画面のコピー            /  マウスのドラッグ(SetCursorPos + mouse_event)
#
# 出力は同じ rank_01.png, rank_02.png … なので、後段（crop-rank.mjs 以降）はそのまま使える。
#
# 使い方:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\capture-ranking-gp.ps1 -Out tools\shots\rank-x
#   下見:      … -Probe   … 1枚だけ撮って窓とレイアウトの実測値を出す（ゲームには触らない）
#
# 実測(2026-08-07): 66人ぶんで 21枚 / 50秒。最下部を検知して自動で止まる。
#
# 設計上の要点:
#
# ★1. 画素の計算は C# 側でやる。
#    PowerShell の Bitmap.GetPixel ループは 960x1032 を1枚なめるだけで分単位かかる（実測）。
#    Add-Type の C# に閉じ込めれば1枚 30〜40ms で済む。
#
# ★2. 取り込みは既定で「画面のコピー」(CopyFromScreen)。PrintWindow ではない。
#    PrintWindow(PW_RENDERFULLCONTENT) なら裏に回っていても撮れる利点があるが、**古いフレームが
#    そのまま返ることがある**（実測: ドラッグで実際にはスクロールしているのに、何枚撮っても
#    まったく同じ画像＝差分 0.00% が返り続けた）。撮れた画像が現在の画面と一致している保証が無い
#    以上、取りこぼしを検知できない。どのみち入力を送るために前面化するので、画面から直接撮る。
#    → 前面に無ければ撮る直前に前面化し直す（Get-Shot）。窓を他のウィンドウで隠さないこと。
#    裏で撮りたい場合だけ -Capture window に切り替える。
#
# ★3. 撮るのは親ウィンドウではなく、子ウィンドウ `CROSVM_1`（ゲームの描画面そのもの）。
#    Google Play Games の窓には、状況によって**タイトルバーと左のサイドツールバー**が付く。
#    親ウィンドウを撮って「黒くない所＝中身」で切り詰める方式にしていたら、このツールバーを
#    中身と誤認して切り出し位置が全部ずれた（実測 2026-08-07: 順位バッジの代わりにツールバーの
#    アイコンが写ったシートができた）。子ウィンドウの矩形はゲームの絵と1対1なので、
#    ツールバーが出ていようがいまいが同じものが撮れる。
#    そのうえで黒帯(レターボックス)も落とす。窓の縦横比によっては描画面の中にさらに黒が出るため。
#    ＝どちらにしても保存されるのは「ゲームの絵だけ」。crop-rank.mjs の割合指定が窓サイズに
#    依存しなくなる。
#
# ★4. スクロールはドラッグのみ。マウスホイールは効かない（実測: 5ノッチ回して差分1%＝アバターの
#    アニメだけ。リストは1行も動かない）。ドラッグは指のスワイプとして渡るので効く。
#
# ★5. **戻す方向（下向きドラッグ）は効かない。** 上向き＝先へ送る方向だけがゲームに通る（実測）。
#    ＝途中から撮り始めても先頭には戻せない。撮る前にランキング画面を開き直して先頭に戻すこと。
#
# ★6. 最下部の判定は「前の画面との画素差の割合」。バイト一致では判定できない。
#    上位のアバターは常時アニメーションしているため、止まっていても画像は毎回変わる。
#    実測: スクロール中 19〜34% / 停止中 0.0〜1.1%。桁で離れるのでしきい値 5% で確実に切れる。

param(
  [string]$Out = 'shots\rank-gp',
  [int]$Count = 45,
  [string]$Match = 'crosvm',      # ウィンドウを持つプロセス名（Google Play Games の本体は crosvm.exe）
  [string]$TitleLike = '',        # 同じゲームを複数窓開けている時に題名で絞る
  [double]$DragFrom = 0.62,       # ドラッグ開始位置（中身の高さに対する割合）
  [double]$DragTo = 0.44,         # ドラッグ終了位置。差が小さいほど1回の送り量が減る
  [int]$Settle = 900,             # 離してから撮るまでの待ち（慣性が止まるのを待つ）
  [int]$Steps = 24,               # ドラッグの分割数
  [int]$StepMs = 18,              # 1ステップの待ち
  [int]$HoldMs = 300,             # 離す直前に止まっている時間
  [int]$Kill = 0,                 # 終点を打ち直す回数（速度を殺す。0=しない）
  [double]$DiffStop = 0.05,       # これを下回ったら最下部とみなす
  [ValidateSet('screen', 'window')]
  [string]$Capture = 'screen',    # screen=画面から直接 / window=PrintWindow（★注記参照）
  [switch]$Probe,                 # 1枚撮って実測値を出すだけ（ドラッグしない）
  [switch]$KeepCursor             # マウスカーソルを元の位置に戻さない（デバッグ用）
)

$ErrorActionPreference = 'Stop'

# ★標準出力を UTF-8 にする。
#   Windows PowerShell 5.1 はリダイレクトされた標準出力にも既定でコンソールのコードページ(932)で
#   書き出す。GUI 側（capture-gui-gp.ps1）は子プロセスの出力を UTF-8 として読むので、ここを
#   変えないとログ窓の日本語が全部化ける（node は元から UTF-8 なのでスマホ版では起きない）。
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}

Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class SnwGp {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int d, IntPtr e);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder s, int n);
  public delegate bool EnumProc(IntPtr h, IntPtr l);

  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }

  public const uint LDOWN = 0x0002, LUP = 0x0004;
  public const int SW_RESTORE = 9;

  // ゲームの描画面は親の子ウィンドウ CROSVM_1。親を撮ると Google Play Games のタイトルバーや
  // サイドツールバーまで入ってしまうので、必ずこちらを探して使う。見つからなければ IntPtr.Zero。
  public static IntPtr FindSurface(IntPtr parent) {
    IntPtr best = IntPtr.Zero;
    long bestArea = 0;
    EnumChildWindows(parent, delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      var cn = new System.Text.StringBuilder(200);
      GetClassName(h, cn, 200);
      if (cn.ToString().IndexOf("CROSVM", StringComparison.OrdinalIgnoreCase) < 0) return true;
      RECT r;
      if (!GetWindowRect(h, out r)) return true;
      long area = (long)(r.R - r.L) * (r.B - r.T);
      if (area > bestArea) { bestArea = area; best = h; }
      return true;
    }, IntPtr.Zero);
    return best;
  }

  // PW_RENDERFULLCONTENT(2): DirectX/GPU で描いている窓の中身も取れる。これが無いと真っ黒になる。
  // ただし古いフレームが返ることがある（★冒頭の注記5を参照）。既定は ShotScreen。
  public static Bitmap ShotWindow(IntPtr h) {
    RECT r;
    if (!GetWindowRect(h, out r)) return null;
    int w = r.R - r.L, ht = r.B - r.T;
    if (w <= 0 || ht <= 0) return null;
    Bitmap b = new Bitmap(w, ht, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(b)) {
      IntPtr hdc = g.GetHdc();
      PrintWindow(h, hdc, 2);
      g.ReleaseHdc(hdc);
    }
    return b;
  }

  // 画面そのものをコピーする。今まさに映っているものが確実に取れる（＝古いフレームが混ざらない）。
  // 代わりに「前面にあって、他の窓に隠されていない」ことが条件になる。
  public static Bitmap ShotScreen(IntPtr h) {
    RECT r;
    if (!GetWindowRect(h, out r)) return null;
    int w = r.R - r.L, ht = r.B - r.T;
    if (w <= 0 || ht <= 0) return null;
    Bitmap b = new Bitmap(w, ht, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(b))
      g.CopyFromScreen(r.L, r.T, 0, 0, new Size(w, ht), CopyPixelOperation.SourceCopy);
    return b;
  }

  static byte[] Bytes(Bitmap b) {
    BitmapData d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    byte[] buf = new byte[b.Width * b.Height * 4];
    for (int y = 0; y < b.Height; y++)
      Marshal.Copy(new IntPtr(d.Scan0.ToInt64() + (long)y * d.Stride), buf, y * b.Width * 4, b.Width * 4);
    b.UnlockBits(d);
    return buf;
  }

  // 黒帯を除いた中身の矩形 [x, y, w, h]。窓の縁が真っ黒でない場合に備えて thr で閾値を上げられる。
  public static int[] Content(Bitmap b, int thr) {
    byte[] p = Bytes(b);
    int W = b.Width, H = b.Height;
    int x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (int y = 0; y < H; y += 4) {
      for (int x = 0; x < W; x += 4) {
        int i = (y * W + x) * 4;
        if (p[i] + p[i + 1] + p[i + 2] > thr * 3) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return new int[] { 0, 0, W, H };
    return new int[] { x0, y0, x1 - x0 + 1, y1 - y0 + 1 };
  }

  // 色差>30 の画素の割合。fy0..fy1 は見る範囲（見出しと最下部の固定行を外すため）。
  public static double Diff(Bitmap a, Bitmap b, double fy0, double fy1) {
    if (a == null || b == null) return 1.0;
    if (a.Width != b.Width || a.Height != b.Height) return 1.0;
    byte[] pa = Bytes(a), pb = Bytes(b);
    int W = a.Width, H = a.Height;
    int y0 = (int)(H * fy0), y1 = (int)(H * fy1);
    int diff = 0, tot = 0;
    for (int y = y0; y < y1; y += 6)
      for (int x = 4; x < W - 4; x += 6) {
        int i = (y * W + x) * 4;
        tot++;
        if (Math.Abs(pa[i] - pb[i]) > 30 || Math.Abs(pa[i + 1] - pb[i + 1]) > 30 || Math.Abs(pa[i + 2] - pb[i + 2]) > 30) diff++;
      }
    return tot == 0 ? 1.0 : (double)diff / tot;
  }

  public static Bitmap Crop(Bitmap b, int x, int y, int w, int h) {
    Bitmap o = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(o))
      g.DrawImage(b, new Rectangle(0, 0, w, h), new Rectangle(x, y, w, h), GraphicsUnit.Pixel);
    return o;
  }
}
'@

# ---------------------------------------------------------------- ウィンドウを探す
#
# ★変数名に $h / $H を使わないこと。PowerShell の変数は大文字小文字を区別しないので、
#   ハンドルの $h と高さの $H が同じ変数になり、ハンドルが数値で潰れる（実測で1時間溶かした）。

$procs = @(Get-Process -Name $Match -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle })
if ($TitleLike) { $procs = @($procs | Where-Object { $_.MainWindowTitle -like "*$TitleLike*" }) }
if ($procs.Count -eq 0) {
  Write-Output "ウィンドウが見つかりません（プロセス名: $Match）。Google Play Games でゲームを開いてから実行してください。"
  exit 1
}
if ($procs.Count -gt 1) {
  Write-Output "候補が $($procs.Count) 件あります。-TitleLike で絞ってください:"
  $procs | ForEach-Object { Write-Output "  $($_.Id)  $($_.MainWindowTitle)" }
  exit 1
}
$game = $procs[0]
$hwnd = $game.MainWindowHandle
Write-Output "対象: $($game.MainWindowTitle)  (pid $($game.Id))"

if ([SnwGp]::IsIconic($hwnd)) { [void][SnwGp]::ShowWindow($hwnd, [SnwGp]::SW_RESTORE); Start-Sleep -Milliseconds 600 }

# 撮る対象は親ではなく、ゲームの描画面である子ウィンドウ CROSVM_1（★冒頭の注記3）。
# 前面化とカーソル復帰は親に対して行うが、画像と座標はすべてこの子の矩形を基準にする。
$surface = [SnwGp]::FindSurface($hwnd)
if ($surface -eq [IntPtr]::Zero) {
  Write-Output '  ※ 描画面(CROSVM_1)が見つからないので窓全体を使います。ツールバーが写ると切り出しがずれます。'
  $surface = $hwnd
}

$rect = New-Object SnwGp+RECT
if (-not [SnwGp]::GetWindowRect($surface, [ref]$rect)) { Write-Output 'ウィンドウの位置を取得できません。'; exit 1 }

# 撮るのは描画面($surface)。前面判定は親($hwnd)で見る（前面になるのは親なので）。
# screen 方式は「前面にあること」が前提。撮る直前に必ず確かめて、外れていたら戻す。
function Get-Shot {
  if ($Capture -eq 'window') { return [SnwGp]::ShotWindow($surface) }
  if ([SnwGp]::GetForegroundWindow() -ne $hwnd) {
    [void][SnwGp]::SetForegroundWindow($hwnd)
    Start-Sleep -Milliseconds 400
  }
  return [SnwGp]::ShotScreen($surface)
}

# 元の前面ウィンドウとカーソル位置は、前面化するより前に控えておく（最後に戻すため）。
$prevFg = [SnwGp]::GetForegroundWindow()
$savedCur = New-Object SnwGp+POINT
[void][SnwGp]::GetCursorPos([ref]$savedCur)

$first = Get-Shot
if (-not $first) { Write-Output '画面を取り込めません。'; exit 1 }
$cont = [SnwGp]::Content($first, 10)
$cx0 = $cont[0]; $cy0 = $cont[1]; $cw = $cont[2]; $ch = $cont[3]
$trim = if ($cw -eq $first.Width -and $ch -eq $first.Height) { '黒帯なし' } else { "黒帯 左$($cx0) 上$($cy0) を除去" }
Write-Output "描画面 $($first.Width)x$($first.Height) @ $($rect.L),$($rect.T)  /  中身 $($cw)x$($ch) （$trim）"

if ($Probe) {
  # 下見も本番と同じ経路で撮ったもの（$first）をそのまま出す。撮ったあとは前面を戻す。
  $outDirP = if ([IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $PSScriptRoot $Out }
  New-Item -ItemType Directory -Force -Path $outDirP | Out-Null
  $p1 = Join-Path $outDirP 'probe_full.png'
  $p2 = Join-Path $outDirP 'probe_content.png'
  $first.Save($p1, [Drawing.Imaging.ImageFormat]::Png)
  $cropped = [SnwGp]::Crop($first, $cx0, $cy0, $cw, $ch)
  $cropped.Save($p2, [Drawing.Imaging.ImageFormat]::Png)
  $cropped.Dispose(); $first.Dispose()
  if (-not $KeepCursor) { [void][SnwGp]::SetCursorPos($savedCur.X, $savedCur.Y) }
  if ($prevFg -ne [IntPtr]::Zero) { [void][SnwGp]::SetForegroundWindow($prevFg) }
  Write-Output "下見: $p1 / $p2"
  exit 0
}

# ---------------------------------------------------------------- 出力先
$outDir = if ([IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $PSScriptRoot $Out }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$old = @(Get-ChildItem -Path $outDir -Filter 'rank_*.png' -ErrorAction SilentlyContinue)
if ($old.Count) { $old | Remove-Item -Force; Write-Output "旧キャプチャ $($old.Count) 枚を削除" }

# ---------------------------------------------------------------- ドラッグ（＝スワイプ）
#
# ★慣性(フリング)は乗る。実測で 0.18H(185px≒1.7行)のドラッグに対して約3行送られる。
#   1画面に 7.4行 写るので、重なりは約4.4行ぶん残る。取りこぼしはこの重なりで防ぐ
#   （重複は後段が順位で名寄せするので、多い分には害が無い）。
#
# ★離す直前に終点を打ち直して速度を殺す(-Kill)のは**やってはいけない**。
#   慣性を消せるだろうと入れたら、ドラッグ自体がゲームに届かなくなり1行も動かなくなった（実測）。
#   同じ座標への SetCursorPos は移動イベントを生まないため、押しっぱなしのまま静止した状態が
#   長く続き、ドラッグではなく長押しとして扱われるものと思われる。既定は 0（＝しない）。
function Invoke-Drag {
  $cx = $rect.L + $cx0 + [int]($cw / 2)
  $ya = $rect.T + $cy0 + [int]($ch * $DragFrom)
  $yb = $rect.T + $cy0 + [int]($ch * $DragTo)
  [void][SnwGp]::SetCursorPos($cx, $ya)
  Start-Sleep -Milliseconds 150
  [SnwGp]::mouse_event([SnwGp]::LDOWN, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  for ($i = 1; $i -le $Steps; $i++) {
    [void][SnwGp]::SetCursorPos($cx, [int]($ya + ($yb - $ya) * $i / $Steps))
    Start-Sleep -Milliseconds $StepMs
  }
  for ($i = 0; $i -lt $Kill; $i++) { [void][SnwGp]::SetCursorPos($cx, $yb); Start-Sleep -Milliseconds 40 }
  Start-Sleep -Milliseconds $HoldMs
  [SnwGp]::mouse_event([SnwGp]::LUP, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds $Settle
}

# ---------------------------------------------------------------- 本編

$prev = $null
$saved = 0
$first.Dispose()
try {
  [void][SnwGp]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 700

  for ($i = 0; $i -lt $Count; $i++) {
    $shot = Get-Shot
    if (-not $shot) { Write-Output 'キャプチャに失敗しました。'; break }

    # 撮影中に窓の大きさが変わることがある（全画面⇔半面など）。基準を取り直さないと
    # 黒帯の位置とドラッグ座標が古いままになるので、変わったらその場で作り直す。
    if ($shot.Width -ne $rect.R - $rect.L -or $shot.Height -ne $rect.B - $rect.T) {
      [void][SnwGp]::GetWindowRect($surface, [ref]$rect)
      $cont = [SnwGp]::Content($shot, 10)
      $cx0 = $cont[0]; $cy0 = $cont[1]; $cw = $cont[2]; $ch = $cont[3]
      Write-Output "  ※ 窓の大きさが変わりました → 描画面 $($shot.Width)x$($shot.Height) / 中身 $($cw)x$($ch) で続行"
      if ($prev) { $prev.Dispose(); $prev = $null }   # 大きさが違う画像同士は比較できない
    }

    if ($prev) {
      # 見出し(上)と自分の固定行(下)は毎枚同じものが写る。そこを外してリスト部分だけ比べる。
      $d = [SnwGp]::Diff($prev, $shot, 0.18, 0.87)
      Write-Output ("  差分 {0:N2}%" -f ($d * 100))
      if ($d -lt $DiffStop) {
        Write-Output ("最下部に到達（前画面との差 {0:N2}% < {1:N0}%）。{2}枚で終了。" -f ($d * 100), ($DiffStop * 100), $saved)
        $shot.Dispose()
        break
      }
    }

    $saved++
    $crop = [SnwGp]::Crop($shot, $cx0, $cy0, $cw, $ch)
    $file = Join-Path $outDir ("rank_{0:d2}.png" -f $saved)
    $crop.Save($file, [Drawing.Imaging.ImageFormat]::Png)
    $crop.Dispose()
    Write-Output "saved $file"

    if ($prev) { $prev.Dispose() }
    $prev = $shot
    Invoke-Drag
  }
} finally {
  if ($prev) { $prev.Dispose() }
  if (-not $KeepCursor) { [void][SnwGp]::SetCursorPos($savedCur.X, $savedCur.Y) }
  if ($prevFg -ne [IntPtr]::Zero) { [void][SnwGp]::SetForegroundWindow($prevFg) }
}

Write-Output ""
Write-Output "完了: $saved 枚を $outDir に保存。"
if ($saved -eq 0) { exit 1 }
