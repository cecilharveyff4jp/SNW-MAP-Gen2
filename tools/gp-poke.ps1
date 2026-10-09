# Google Play Games の描画面を「つつく」ための最小ドライバ（探索・調整用）。
#
# capture-ranking-gp.ps1 からウィンドウ探索・画面コピー・黒帯除去だけを抜き出し、
# 「指定した割合位置をクリックして、待って、撮る」ことだけをする。
# 領主ファイル巡回（capture-ids-gp.ps1）を作る前の下調べに使う。
#
#   # 撮るだけ（ゲームに触らない）
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\gp-poke.ps1 -Out shots\poke\a.png
#
#   # 中身の (x=50%, y=25%) をクリックして 900ms 待ってから撮る
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\gp-poke.ps1 -X 0.5 -Y 0.25 -Wait 900 -Out shots\poke\b.png
#
# 座標はすべて「黒帯を除いた中身」に対する割合(0..1)。窓の大きさが変わっても同じ場所を指す。
# 出力は中身だけを切り出した PNG なので、読んだ画素位置をそのまま割合に戻せる。

param(
  [double]$X = -1,                # クリック位置（中身に対する割合）。負なら押さない
  [double]$Y = -1,
  [int]$Wait = 900,               # クリック/ホイールしてから撮るまでの待ち
  [string]$Out = 'shots\poke\shot.png',
  [string]$Match = 'crosvm',
  [int]$Down = 60,                # 押してから離すまで（タップとして渡る長さ）
  [int]$Wheel = 0,                # ホイールのノッチ数。負=下へ送る(リストが進む) / 正=上へ戻す
  [double]$WheelX = 0.5,          # ホイールを回す位置（中身に対する割合）。カーソルの下の物に効く
  [double]$WheelY = 0.5,
  [int]$WheelStepMs = 60,         # ノッチ間の待ち
  [switch]$KeepCursor
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class SnwPoke {
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
  public const uint LDOWN = 0x0002, LUP = 0x0004, WHEEL = 0x0800;
  public const int SW_RESTORE = 9;

  // 描画面は子ウィンドウ CROSVM_1（親だとタイトルバー／サイドツールバーが混ざる）。
  public static IntPtr FindSurface(IntPtr parent) {
    IntPtr best = IntPtr.Zero; long bestArea = 0;
    EnumChildWindows(parent, delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      var cn = new System.Text.StringBuilder(200);
      GetClassName(h, cn, 200);
      if (cn.ToString().IndexOf("CROSVM", StringComparison.OrdinalIgnoreCase) < 0) return true;
      RECT r; if (!GetWindowRect(h, out r)) return true;
      long area = (long)(r.R - r.L) * (r.B - r.T);
      if (area > bestArea) { bestArea = area; best = h; }
      return true;
    }, IntPtr.Zero);
    return best;
  }

  public static Bitmap ShotScreen(IntPtr h) {
    RECT r; if (!GetWindowRect(h, out r)) return null;
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

  public static int[] Content(Bitmap b, int thr) {
    byte[] p = Bytes(b);
    int W = b.Width, H = b.Height;
    int x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (int y = 0; y < H; y += 4)
      for (int x = 0; x < W; x += 4) {
        int i = (y * W + x) * 4;
        if (p[i] + p[i + 1] + p[i + 2] > thr * 3) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    if (x1 < 0) return new int[] { 0, 0, W, H };
    return new int[] { x0, y0, x1 - x0 + 1, y1 - y0 + 1 };
  }

  public static Bitmap Crop(Bitmap b, int x, int y, int w, int h) {
    Bitmap o = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(o))
      g.DrawImage(b, new Rectangle(0, 0, w, h), new Rectangle(x, y, w, h), GraphicsUnit.Pixel);
    return o;
  }
}
'@

# ★$h / $H は使わない（PowerShell は変数名の大小を区別しないのでハンドルと高さが衝突する）。
$procs = @(Get-Process -Name $Match -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle })
if ($procs.Count -ne 1) { Write-Output "ウィンドウが $($procs.Count) 件。1件でないと操作できません。"; exit 1 }
$game = $procs[0]
$hwnd = $game.MainWindowHandle
if ([SnwPoke]::IsIconic($hwnd)) { [void][SnwPoke]::ShowWindow($hwnd, [SnwPoke]::SW_RESTORE); Start-Sleep -Milliseconds 600 }

$surface = [SnwPoke]::FindSurface($hwnd)
if ($surface -eq [IntPtr]::Zero) { $surface = $hwnd }
$rect = New-Object SnwPoke+RECT
[void][SnwPoke]::GetWindowRect($surface, [ref]$rect)

$prevFg = [SnwPoke]::GetForegroundWindow()
$savedCur = New-Object SnwPoke+POINT
[void][SnwPoke]::GetCursorPos([ref]$savedCur)

if ([SnwPoke]::GetForegroundWindow() -ne $hwnd) {
  [void][SnwPoke]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 500
}

# 黒帯の量は窓の大きさで変わるので、押す前に必ず測り直す。
$probe = [SnwPoke]::ShotScreen($surface)
if (-not $probe) { Write-Output '画面を取り込めません。'; exit 1 }
$c = [SnwPoke]::Content($probe, 10)
$cx0 = $c[0]; $cy0 = $c[1]; $cw = $c[2]; $ch = $c[3]
$probe.Dispose()

try {
  if ($X -ge 0 -and $Y -ge 0) {
    $px = $rect.L + $cx0 + [int]($cw * $X)
    $py = $rect.T + $cy0 + [int]($ch * $Y)
    [void][SnwPoke]::SetCursorPos($px, $py)
    Start-Sleep -Milliseconds 120
    [SnwPoke]::mouse_event([SnwPoke]::LDOWN, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds $Down
    [SnwPoke]::mouse_event([SnwPoke]::LUP, 0, 0, 0, [IntPtr]::Zero)
    Write-Output ("click 中身({0:N3},{1:N3}) = 画面({2},{3})" -f $X, $Y, $px, $py)
    Start-Sleep -Milliseconds $Wait
  }

  if ($Wheel -ne 0) {
    # ★ホイールはカーソルの下にある物に届く。必ずリストの上に置いてから回すこと。
    $wx = $rect.L + $cx0 + [int]($cw * $WheelX)
    $wy = $rect.T + $cy0 + [int]($ch * $WheelY)
    [void][SnwPoke]::SetCursorPos($wx, $wy)
    Start-Sleep -Milliseconds 150
    $n = [Math]::Abs($Wheel)
    $delta = if ($Wheel -lt 0) { -120 } else { 120 }
    for ($i = 0; $i -lt $n; $i++) {
      [SnwPoke]::mouse_event([SnwPoke]::WHEEL, 0, 0, $delta, [IntPtr]::Zero)
      Start-Sleep -Milliseconds $WheelStepMs
    }
    Write-Output ("wheel {0}ノッチ(delta {1}) @ 中身({2:N3},{3:N3}) = 画面({4},{5})" -f $Wheel, $delta, $WheelX, $WheelY, $wx, $wy)
    Start-Sleep -Milliseconds $Wait
  }

  if ([SnwPoke]::GetForegroundWindow() -ne $hwnd) { [void][SnwPoke]::SetForegroundWindow($hwnd); Start-Sleep -Milliseconds 300 }
  $shot = [SnwPoke]::ShotScreen($surface)
  $outPath = if ([IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $PSScriptRoot $Out }
  New-Item -ItemType Directory -Force -Path (Split-Path $outPath) | Out-Null
  $crop = [SnwPoke]::Crop($shot, $cx0, $cy0, $cw, $ch)
  $crop.Save($outPath, [Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose(); $shot.Dispose()
  Write-Output "中身 $($cw)x$($ch) → $outPath"
} finally {
  if (-not $KeepCursor) { [void][SnwPoke]::SetCursorPos($savedCur.X, $savedCur.Y) }
  if ($prevFg -ne [IntPtr]::Zero) { [void][SnwPoke]::SetForegroundWindow($prevFg) }
}
