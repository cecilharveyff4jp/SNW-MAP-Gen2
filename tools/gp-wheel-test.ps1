# ホイールの送り量を実測する。1プロセスの中で「回す→撮る」を繰り返す。
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\gp-wheel-test.ps1 -Out shots\wheel2 -Notch 1 -Times 10
#
# ★1回ごとに gp-poke.ps1 を呼ぶ方式だと、呼び出しのたびに前面化とカーソル復帰が挟まる。
#   ゲームが「カーソルがリストの上にある」ことを見ている場合、その出入りが結果を汚す。
#   ここでは最初に1度だけ前面化し、カーソルをリストの上に置いたまま最後まで回す。
#
# 出力は w_00.png（回す前）, w_01.png, w_02.png … 連番。あとで measure-shift.mjs で差を測る。

param(
  [string]$Out = 'shots\wheel2',
  [int]$Notch = 1,            # 1回あたりのノッチ数（負の delta = 先へ送る）
  [int]$Times = 10,           # 何回繰り返すか
  [int]$Wait = 1000,          # 回してから撮るまでの待ち
  [int]$StepMs = 60,          # ノッチ間の待ち
  [double]$AtX = 0.5,         # カーソルを置く位置（中身に対する割合）
  [double]$AtY = 0.5,
  [string]$Match = 'crosvm'
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class SnwWheel {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int d, IntPtr e);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder s, int n);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public const uint WHEEL = 0x0800;

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

$procs = @(Get-Process -Name $Match -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle })
if ($procs.Count -ne 1) { Write-Output "ウィンドウが $($procs.Count) 件。1件でないと測れません。"; exit 1 }
$hwnd = $procs[0].MainWindowHandle
$surface = [SnwWheel]::FindSurface($hwnd)
if ($surface -eq [IntPtr]::Zero) { $surface = $hwnd }
$rect = New-Object SnwWheel+RECT
[void][SnwWheel]::GetWindowRect($surface, [ref]$rect)

[void][SnwWheel]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 700

$probe = [SnwWheel]::ShotScreen($surface)
$c = [SnwWheel]::Content($probe, 10)
$cx0 = $c[0]; $cy0 = $c[1]; $cw = $c[2]; $ch = $c[3]
$probe.Dispose()

$outDir = if ([IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $PSScriptRoot $Out }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Get-ChildItem -Path $outDir -Filter 'w_*.png' -ErrorAction SilentlyContinue | Remove-Item -Force

function Save-Shot([int]$i) {
  $s = [SnwWheel]::ShotScreen($surface)
  $crop = [SnwWheel]::Crop($s, $cx0, $cy0, $cw, $ch)
  $f = Join-Path $outDir ("w_{0:d2}.png" -f $i)
  $crop.Save($f, [Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose(); $s.Dispose()
  return $f
}

# ★カーソルはここに置いたまま、最後まで動かさない。
$wx = $rect.L + $cx0 + [int]($cw * $AtX)
$wy = $rect.T + $cy0 + [int]($ch * $AtY)
[void][SnwWheel]::SetCursorPos($wx, $wy)
Start-Sleep -Milliseconds 300

Write-Output "中身 $($cw)x$($ch)  カーソル 画面($wx,$wy)  1回 $Notch ノッチ x $Times 回"
Save-Shot 0 | Out-Null

$delta = if ($Notch -lt 0) { -120 } else { 120 }
$n = [Math]::Abs($Notch)
for ($t = 1; $t -le $Times; $t++) {
  for ($i = 0; $i -lt $n; $i++) {
    [SnwWheel]::mouse_event([SnwWheel]::WHEEL, 0, 0, $delta, [IntPtr]::Zero)
    Start-Sleep -Milliseconds $StepMs
  }
  Start-Sleep -Milliseconds $Wait
  Save-Shot $t | Out-Null
}
Write-Output "完了: $($Times + 1) 枚を $outDir に保存（w_00 が回す前）"
