# Google Play Games (Windows) 版：同盟ランキングから全員の「領主ファイル」を巡回キャプチャする。
#
# スマホ版 capture-ids.mjs の置き換え。1人ぶんの操作は:
#   ① ランキングの行をクリック → ポップアップが出る
#   ② ポップアップの［確認］を押す → 領主ファイル（ゲームID・FIREレベルがある）
#   ③ 左上の ← でランキングに戻る
# これを全員ぶん繰り返す。出力は id_001.png, id_002.png … （領主ファイルの中身だけ）。
#
# 使い方:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\capture-ids-gp.ps1 -Out shots\ids-gp
#   下見(ゲームに触らない。行とポップアップの検出結果だけ出す): … -Probe
#   試運転(先頭 N 人だけ):                                      … -Limit 3
#
# ★ランキング画面を開き直して一番上に戻してから実行すること。
#   下向きドラッグ（戻す方向）はゲームが受け付けないので、途中から始めると手前が欠ける。
#
# --------------------------------------------------------------------------------
# 設計上の要点（ハマりどころ）
#
# ★1. ポップアップの出る位置は毎回変わる（押した行に付いて動く）。座標の決め打ちは不可。
#    毎回「純白の塊」を探して箱を見つけ、その中のいちばん上の段の左端の青いボタン＝［確認］を押す。
#
# ★2. **［削除する］が同じポップアップに並んでいる**（同盟から追放）。押したら取り返しがつかない。
#    保険として、押す直前にその画素が本当に青いことを確かめる。［削除する］は橙色なので弾ける。
#    青でなければその人を飛ばして次へ行く（押さない）。
#
# ★3. 淡い水色の行(205,230,250 あたり)をポップアップの白と間違えないこと。
#    明るさだけでなく「色が付いていないこと」(max-min < 10) も条件に入れる。
#
# ★4. 自分自身の行はランキングの一番下に固定表示されていて、押しても領主ファイルに飛ばない。
#    止まるので必ず飛ばす（画面の下端に貼り付いている行＝中心が 0.88 より下)。
#
# ★5. 同じ人を2回撮らないための判定は「リスト上の絶対位置」で行う（★9の実測が前提）。
#    画面が何画素動いたかを毎回測り、各行の「リスト先頭からの絶対 y」を積算して持つ。
#    同じ絶対位置の行は同じ人なので、見た目を比べる必要がない。
#
#    ☠ 以前は「行の見た目（名前の帯）」を格子に潰して突き合わせていたが、これは当てにならない。
#      2026-10-08 実測: 名前だけの帯(x 0.33..0.75)で取ったら、`りつき` `kina` `Juhi` `なぎさ`
#      `トントゥ` `かいさん` `しゅてん` `わのさん` `戦闘員一撃万枚` の **9人が「重複」と誤判定されて
#      丸ごと落ちた**（79人中70人しか撮れなかった）。短い名前は帯のほとんどが無地で、正規化すると
#      雑音が支配して別人同士の距離が縮む。総力の数字まで入れて改善したが、それでも5人落ちた。
#      絶対位置なら名前の長さに一切影響されない。Sig/Dist は -UseSig のときだけ使う保険として残す。
#
# ★7. **スクロールはホイール。ドラッグは使わない。**
#    ドラッグは指のスワイプとして渡るので動くが、**慣性が乗って送り量が毎回ぶれる**。
#    ホイールは 1ノッチ = きっかり 44px で完全に決定的（実測 2026-10-08、下記★9）。
#    ※2026-08-07 時点では「ホイールは効かない」と記録していたが、それは誤り。
#      効かなく見えた原因は (a) ポップアップが開いていた (b) 人が同時にマウスを触っていた。
#      -Scroll drag で旧方式にも戻せる。
#
# ★9. ホイールの実測値（561x999 の窓 / 中身 561x989 / 行の間隔 105.5px）:
#      - **リスト最上段では1ノッチ目が吸われて 0px**。2ノッチ目が 38px、3ノッチ目以降は 44px 固定。
#      - 12ノッチ = 528px ≒ 5.0行。画面には6行出るので必ず1行以上重なる＝飛ばしようがない。
#      - カーソルはリストの上に置いたまま回すこと（ホイールはカーソルの下の物に届く）。
#      送り量は固定値に頼らず**毎回画素で測る**（ShiftY）。測るなら吸われても狂わない。
#
# ★10. **リストは見た目が周期的なので、送り量の相関が「隣の行」にロックを誤ることがある。**
#    実測 2026-10-08: 最下部手前の1回だけ、本当は 376px 動いたのに 165px と出た（残差 23.3。
#    正常時は 4〜6）。絶対位置が2行ぶん足りなくなり、`スマートEX` と `パックン` が
#    「撮影済み」と誤判定されて落ちた。対策は2つ入れてある:
#      (a) 残差が $ShiftRmsMax を超えたら測定を信用せず、その画面は**見えている行を全部撮る**。
#      (b) 最下部に着いたら、そこで止めずに**見えている行を全部撮ってから**終わる。
#    どちらも余分に数枚撮るだけ（後段がゲームIDで重複を落とす）。落とすより撮りすぎる方が安い。
#
# ★6. $h / $H を変数に使わない。PowerShell は変数名の大小を区別しないのでハンドルと高さが衝突する。

param(
  [string]$Out = 'shots\ids-gp',
  [int]$Screens = 60,             # 最大何回スクロールするか（暴走よけ）
  [int]$MaxSteps = 400,           # 最大何手ぶん回すか（1手＝1人撮る or 1回スクロール。暴走よけ）
  [int]$Limit = 0,                # 0=全員。試運転で人数を絞るとき用
  [string]$Match = 'crosvm',
  [ValidateSet('wheel', 'drag')]
  [string]$Scroll = 'wheel',      # ★既定はホイール。ドラッグは慣性で送り量が暴れる（★7）
  [int]$Notches = 6,              # ホイール1回ぶんのノッチ数。実測 1ノッチ=44px、6で264px≒2.5行
                                  # ★大きくしすぎないこと。送り量の測定上限は約445px（★11）
  [int]$WheelStepMs = 55,         # ノッチ間の待ち
  [double]$WheelAtX = 0.50,       # ホイールを回す位置（カーソルの下にある物に効く）
  [double]$WheelAtY = 0.50,
  [double]$FocusX = 0.50,         # ★回す前に1回クリックして窓にフォーカスを渡す場所（★12）
  [double]$FocusY = 0.148,        #   既定は列見出し「順位／領主／総力」の帯＝押しても何も起きない
  [double]$DragFrom = 0.62,       # -Scroll drag のときだけ使う
  [double]$DragTo = 0.44,
  [int]$Steps = 24,
  [int]$StepMs = 18,
  [int]$HoldMs = 300,
  [int]$Settle = 900,
  [int]$WaitPopup = 900,          # 行を押してからポップアップが出るまで
  [int]$WaitProfile = 1500,       # ［確認］から領主ファイルが開くまで
  [int]$WaitBack = 1200,          # ← からランキングに戻るまで
  [double]$BackX = 0.062,         # 左上の ← （領主ファイルのレイアウトは固定）
  [double]$BackY = 0.028,
  [double]$NearRows = 0.40,       # 絶対位置がこの行数ぶんより近ければ「同じ行」
  [double]$ShiftRmsMax = 12.0,    # 送り量の残差がこれを超えたら測定を信用しない（★10）
  [switch]$NoDedupe,              # 既撮の判定をせず画面に出た行を全部撮る（遅い。切り分け用）
  [int]$PopupRetry = 1,           # ポップアップが出なかったときに押し直す回数
  [switch]$Probe,                 # 検出結果を出すだけ。ゲームには触らない
  [switch]$KeepCursor
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class SnwIds {
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

  // ---- 行の検出（★5）: 名前の右と総力の左にはさまれた「地の色だけ」の帯の明るさで、
  //      明るい帯(=行)の連なりを拾う。返すのは y0,y1 の並び。
  public static int[] Rows(Bitmap b, double fxa, double fxb, int thr, int minH) {
    byte[] p = Bytes(b);
    int W = b.Width, H = b.Height;
    int xa = (int)(W * fxa), xb = (int)(W * fxb);
    var res = new List<int>();
    int s = -1;
    for (int y = 0; y < H; y++) {
      long sum = 0; int n = 0;
      for (int x = xa; x < xb; x++) { int i = (y * W + x) * 4; sum += (p[i] + p[i + 1] + p[i + 2]) / 3; n++; }
      bool on = n > 0 && (sum / n) > thr;
      if (on && s < 0) s = y;
      if (!on && s >= 0) { if (y - s >= minH) { res.Add(s); res.Add(y - 1); } s = -1; }
    }
    if (s >= 0 && H - s >= minH) { res.Add(s); res.Add(H - 1); }
    return res.ToArray();
  }

  // ---- ポップアップの箱（★1 ★3）: 純白で、かつ色が付いていない画素の塊。
  //      返り値 [x0,y0,x1,y1]。見つからなければ null。
  // ★「白い行の数」で縦の範囲を決めてはいけない。ボタンの段は白がほとんど残らないので
  //   箱が段ごとにぶつ切りになる（実測: 240px の箱が 19px になった）。
  //   箱の地は margin でひとつながりなので、**白画素の連結成分のうち最大のもの**の外接矩形を取る。
  public static int[] WhiteBox(Bitmap b) {
    byte[] p = Bytes(b);
    int W = b.Width, H = b.Height;
    var mask = new bool[W * H];
    for (int y = 0; y < H; y++)
      for (int x = 0; x < W; x++) {
        int i = (y * W + x) * 4;
        int bb = p[i], g = p[i + 1], r = p[i + 2];
        int mx = Math.Max(r, Math.Max(g, bb)), mn = Math.Min(r, Math.Min(g, bb));
        if (mn > 244 && mx - mn < 10) mask[y * W + x] = true;
      }
    var seen = new bool[W * H];
    var stack = new int[W * H];
    int bestArea = 0; int[] bestBox = null;
    for (int start = 0; start < W * H; start++) {
      if (!mask[start] || seen[start]) continue;
      int sp = 0; stack[sp++] = start; seen[start] = true;
      int area = 0, x0 = W, x1 = -1, y0 = H, y1 = -1;
      while (sp > 0) {
        int cur = stack[--sp];
        int cy = cur / W, cx = cur - cy * W;
        area++;
        if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
        if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
        if (cx > 0 && mask[cur - 1] && !seen[cur - 1]) { seen[cur - 1] = true; stack[sp++] = cur - 1; }
        if (cx < W - 1 && mask[cur + 1] && !seen[cur + 1]) { seen[cur + 1] = true; stack[sp++] = cur + 1; }
        if (cy > 0 && mask[cur - W] && !seen[cur - W]) { seen[cur - W] = true; stack[sp++] = cur - W; }
        if (cy < H - 1 && mask[cur + W] && !seen[cur + W]) { seen[cur + W] = true; stack[sp++] = cur + W; }
      }
      if (area > bestArea) { bestArea = area; bestBox = new int[] { x0, y0, x1, y1 }; }
    }
    // 小さすぎる塊（見出しの白文字や、最下部の自分の行の白い縁）は箱ではない。
    if (bestBox == null || bestArea < W * H * 0.015) return null;
    if (bestBox[2] - bestBox[0] < W * 0.25 || bestBox[3] - bestBox[1] < H * 0.10) return null;
    return bestBox;
  }

  static bool IsBlue(byte[] p, int W, int x, int y) {
    int i = (y * W + x) * 4;
    int bb = p[i], g = p[i + 1], r = p[i + 2];
    return bb > 150 && bb - r > 50 && g > 90;
  }

  // ---- 箱の中のいちばん上の段の、いちばん左の青いボタンの中心（＝［確認］）。
  //      返り値 [cx, cy]。見つからなければ null。
  public static int[] FirstBlueButton(Bitmap b, int bx0, int by0, int bx1, int by1) {
    byte[] p = Bytes(b);
    int W = b.Width;
    int bandY0 = -1, bandY1 = -1;
    int need = (int)((bx1 - bx0) * 0.10);
    int s = -1;
    for (int y = by0; y <= by1 + 1; y++) {
      int c = 0;
      if (y <= by1) for (int x = bx0; x <= bx1; x++) if (IsBlue(p, W, x, y)) c++;
      bool on = y <= by1 && c >= need;
      if (on && s < 0) s = y;
      if (!on && s >= 0) { if (y - s >= 15) { bandY0 = s; bandY1 = y - 1; break; } s = -1; }
    }
    if (bandY0 < 0) return null;
    int my = (bandY0 + bandY1) / 2;
    int rs = -1;
    for (int x = bx0; x <= bx1 + 1; x++) {
      bool on = x <= bx1 && IsBlue(p, W, x, my);
      if (on && rs < 0) rs = x;
      if (!on && rs >= 0) { if (x - rs >= 20) return new int[] { (rs + x - 1) / 2, my }; rs = -1; }
    }
    return null;
  }

  // 押す直前の保険（★2）: その点が本当に青いか。橙の［削除する］を弾くため。
  public static bool BlueAt(Bitmap b, int x, int y) {
    byte[] p = Bytes(b);
    if (x < 0 || y < 0 || x >= b.Width || y >= b.Height) return false;
    return IsBlue(p, b.Width, x, y);
  }

  // ---- 名前の帯の見た目（★5）: gw x gh に平均で潰して正規化したベクトル。
  public static double[] Sig(Bitmap b, int x0, int y0, int w, int ht, int gw, int gh) {
    byte[] p = Bytes(b);
    int W = b.Width, H = b.Height;
    var v = new double[gw * gh];
    for (int j = 0; j < gh; j++)
      for (int i = 0; i < gw; i++) {
        double sum = 0; int n = 0;
        int ya = y0 + ht * j / gh, yb = y0 + ht * (j + 1) / gh;
        int xa = x0 + w * i / gw, xb = x0 + w * (i + 1) / gw;
        for (int y = ya; y < yb; y++) {
          if (y < 0 || y >= H) continue;
          for (int x = xa; x < xb; x++) {
            if (x < 0 || x >= W) continue;
            int k = (y * W + x) * 4;
            sum += (p[k] + p[k + 1] + p[k + 2]) / 3.0; n++;
          }
        }
        v[j * gw + i] = n > 0 ? sum / n : 0;
      }
    double mean = 0; for (int i = 0; i < v.Length; i++) mean += v[i];
    mean /= v.Length;
    double sd = 0; for (int i = 0; i < v.Length; i++) sd += (v[i] - mean) * (v[i] - mean);
    sd = Math.Sqrt(sd / v.Length);
    if (sd < 1e-6) sd = 1;
    for (int i = 0; i < v.Length; i++) v[i] = (v[i] - mean) / sd;
    return v;
  }

  public static double Dist(double[] a, double[] b) {
    if (a == null || b == null || a.Length != b.Length) return 99;
    double s = 0;
    for (int i = 0; i < a.Length; i++) { double d = a[i] - b[i]; s += d * d; }
    return Math.Sqrt(s / a.Length);
  }

  // ---- 2枚が縦に何画素ずれたかを測る（★9 ★11）。戻り値 [dy, 残差RMS]。dy>0 = 先へ送られた。
  //
  // ★11 **候補ごとに比較する画素数を変えてはいけない。**
  //   「重なった部分だけを比べて RMS が最小の dy を採る」という作りにしたら、
  //   大きく送ったとき（重なりが1.5行ぶんしか残らない）に **dy=0（重なり最大）の不正解が勝った**。
  //   リストは行が周期的でレイアウトが同じなので、dy=0 でもそこそこ合ってしまうため。
  //   実測 2026-10-08: 本当は 526px 動いているのに 0px と出て、巡回がリストの半分で
  //   「最下部」と誤判定した（残差は 20前後で、正解時の 4〜6 より大きいのに最小だった）。
  //   → **新しい画面から固定の高さの短冊(テンプレート)を切り、古い画面の上を滑らせて探す。**
  //     どの dy でも比較画素数が同じになるので公平に比べられる。
  //
  //   短冊は上から 0.20H の位置、高さ 0.22H。探せる上限は 0.87H-0.20H-0.22H = 0.45H（≒445px）。
  //   **1回の送り量はこれを超えないこと**（既定の6ノッチ＝264pxは十分収まる）。
  public static double[] ShiftY(Bitmap a, Bitmap b, int lo, int hi) {
    if (a == null || b == null || a.Width != b.Width || a.Height != b.Height) return new double[] { 0, 999 };
    byte[] pa = Bytes(a), pb = Bytes(b);
    int W = a.Width, H = a.Height;
    int x0 = (int)(W * 0.33), x1 = (int)(W * 0.98);
    int ty0 = (int)(H * 0.20), th = (int)(H * 0.22);
    int limit = (int)(H * 0.87) - ty0 - th;     // これ以上はみ出す dy は測れない
    if (hi > limit) hi = limit;
    if (lo < -ty0 + (int)(H * 0.18)) lo = -ty0 + (int)(H * 0.18);
    int bestDy = 0; double bestRms = double.MaxValue;
    for (int dy = lo; dy <= hi; dy++) {
      double s = 0; int n = 0;
      for (int y = ty0; y < ty0 + th; y += 2) {
        int ay = y + dy;                         // 新(b)の y は 旧(a)の y+dy にあったもの
        int rb = y * W, ra = ay * W;
        for (int x = x0; x < x1; x += 2) {
          int ia = (ra + x) * 4, ib = (rb + x) * 4;
          double va = (pa[ia] + pa[ia + 1] + pa[ia + 2]) / 3.0;
          double vb = (pb[ib] + pb[ib + 1] + pb[ib + 2]) / 3.0;
          double d = va - vb; s += d * d; n++;
        }
      }
      if (n == 0) continue;
      double rms = Math.Sqrt(s / n);
      if (rms < bestRms) { bestRms = rms; bestDy = dy; }
    }
    return new double[] { bestDy, bestRms };
  }
}
'@

# ---------------------------------------------------------------- ウィンドウ
$procs = @(Get-Process -Name $Match -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle })
if ($procs.Count -ne 1) {
  Write-Output "ゲームのウィンドウが $($procs.Count) 件見つかりました。1件だけにしてください。"
  $procs | ForEach-Object { Write-Output "  $($_.Id)  $($_.MainWindowTitle)" }
  exit 1
}
$game = $procs[0]
$hwnd = $game.MainWindowHandle
Write-Output "対象: $($game.MainWindowTitle)  (pid $($game.Id))"
if ([SnwIds]::IsIconic($hwnd)) { [void][SnwIds]::ShowWindow($hwnd, [SnwIds]::SW_RESTORE); Start-Sleep -Milliseconds 600 }

$surface = [SnwIds]::FindSurface($hwnd)
if ($surface -eq [IntPtr]::Zero) { $surface = $hwnd }
$rect = New-Object SnwIds+RECT
[void][SnwIds]::GetWindowRect($surface, [ref]$rect)

$prevFg = [SnwIds]::GetForegroundWindow()
$savedCur = New-Object SnwIds+POINT
[void][SnwIds]::GetCursorPos([ref]$savedCur)

function Get-Shot {
  if ([SnwIds]::GetForegroundWindow() -ne $hwnd) {
    [void][SnwIds]::SetForegroundWindow($hwnd)
    Start-Sleep -Milliseconds 400
  }
  $raw = [SnwIds]::ShotScreen($surface)
  if (-not $raw) { return $null }
  $c = [SnwIds]::Content($raw, 10)
  $script:cx0 = $c[0]; $script:cy0 = $c[1]; $script:cw = $c[2]; $script:ch = $c[3]
  $crop = [SnwIds]::Crop($raw, $c[0], $c[1], $c[2], $c[3])
  $raw.Dispose()
  return $crop
}

# 中身の座標(画素)を画面の座標に直して押す
function Invoke-Tap([int]$ix, [int]$iy, [int]$down = 60) {
  $px = $rect.L + $script:cx0 + $ix
  $py = $rect.T + $script:cy0 + $iy
  [void][SnwIds]::SetCursorPos($px, $py)
  Start-Sleep -Milliseconds 120
  [SnwIds]::mouse_event([SnwIds]::LDOWN, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds $down
  [SnwIds]::mouse_event([SnwIds]::LUP, 0, 0, 0, [IntPtr]::Zero)
}

# ★7 ホイール。カーソルをリストの上に置いてから回す。送り量は決定的（1ノッチ=44px）。
function Invoke-Wheel {
  # ★12 **回す前に必ず1回クリックする。** クリック(mouse_event)はカーソルの下の窓に位置で届くが、
  #   ホイールは**フォーカスのある窓**にしか届かない。SetForegroundWindow だけでは足りず、
  #   実測 2026-10-08 で「クリックは効くのにホイールだけ36ノッチ投げても1pxも動かない」状態に
  #   なった（画面は正常なランキング・ポップアップ無し）。見出しの帯を1回押すと以後きちんと動く。
  #   押す場所は列見出し「順位／領主／総力」。押しても何も起きないことを実測で確認済み
  #   （クリック後の移動が純粋な平行移動で、並び替えも画面遷移も起きていない）。
  Invoke-Tap ([int]($script:cw * $FocusX)) ([int]($script:ch * $FocusY))
  Start-Sleep -Milliseconds 250

  $wx = $rect.L + $script:cx0 + [int]($script:cw * $WheelAtX)
  $wy = $rect.T + $script:cy0 + [int]($script:ch * $WheelAtY)
  [void][SnwIds]::SetCursorPos($wx, $wy)
  Start-Sleep -Milliseconds 120
  for ($i = 0; $i -lt $Notches; $i++) {
    [SnwIds]::mouse_event([SnwIds]::WHEEL, 0, 0, -120, [IntPtr]::Zero)
    Start-Sleep -Milliseconds $WheelStepMs
  }
  Start-Sleep -Milliseconds $Settle
}

function Invoke-Scroll {
  if ($Scroll -eq 'wheel') { Invoke-Wheel } else { Invoke-Drag }
}

function Invoke-Drag {
  $cxp = $rect.L + $script:cx0 + [int]($script:cw / 2)
  $ya = $rect.T + $script:cy0 + [int]($script:ch * $DragFrom)
  $yb = $rect.T + $script:cy0 + [int]($script:ch * $DragTo)
  [void][SnwIds]::SetCursorPos($cxp, $ya)
  Start-Sleep -Milliseconds 150
  [SnwIds]::mouse_event([SnwIds]::LDOWN, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  for ($i = 1; $i -le $Steps; $i++) {
    [void][SnwIds]::SetCursorPos($cxp, [int]($ya + ($yb - $ya) * $i / $Steps))
    Start-Sleep -Milliseconds $StepMs
  }
  Start-Sleep -Milliseconds $HoldMs
  [SnwIds]::mouse_event([SnwIds]::LUP, 0, 0, 0, [IntPtr]::Zero)
  Start-Sleep -Milliseconds $Settle
}

# 画面に写っている「押してよい行」を返す。
#   ・高さが行として妥当なもの（画面の 7%〜13%）
#   ・上下で切れていないもの
#   ・★4 自分の固定行（中心が 0.88 より下）は除く
function Get-Rows($img) {
  $raw = [SnwIds]::Rows($img, 0.60, 0.655, 150, [int]($img.Height * 0.05))
  $rows = @()
  for ($i = 0; $i -lt $raw.Length; $i += 2) {
    $a = $raw[$i]; $b = $raw[$i + 1]
    $hgt = $b - $a + 1
    $c = ($a + $b) / 2
    if ($hgt -lt $img.Height * 0.070 -or $hgt -gt $img.Height * 0.130) { continue }
    if ($a -lt $img.Height * 0.175) { continue }      # 見出しに食い込んでいる＝上で切れている
    if ($b -gt $img.Height * 0.880) { continue }      # 下で切れている / 自分の固定行
    $rows += ,@($a, $b, $c)
  }
  return $rows
}

$outDir = if ([IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $PSScriptRoot $Out }

# ---------------------------------------------------------------- 下見
if ($Probe) {
  $img = Get-Shot
  if (-not $img) { Write-Output '画面を取り込めません。'; exit 1 }
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $img.Save((Join-Path $outDir 'probe.png'), [Drawing.Imaging.ImageFormat]::Png)
  Write-Output "中身 $($script:cw)x$($script:ch)"
  $rows = Get-Rows $img
  Write-Output "押せる行: $($rows.Count) 本"
  foreach ($r in $rows) { Write-Output ("  y {0}..{1}  中心{2}  割合 {3:N4}" -f $r[0], $r[1], $r[2], ($r[2] / $img.Height)) }
  $box = [SnwIds]::WhiteBox($img)
  if ($box) {
    Write-Output "白い箱: x $($box[0])..$($box[2])  y $($box[1])..$($box[3])"
    $btn = [SnwIds]::FirstBlueButton($img, $box[0], $box[1], $box[2], $box[3])
    if ($btn) { Write-Output "  1段目左の青ボタン（＝確認）: ($($btn[0]), $($btn[1]))" } else { Write-Output '  青いボタンが見つかりません' }
  } else {
    Write-Output '白い箱なし（＝ポップアップは出ていない。正常）'
  }
  $img.Dispose()
  if (-not $KeepCursor) { [void][SnwIds]::SetCursorPos($savedCur.X, $savedCur.Y) }
  if ($prevFg -ne [IntPtr]::Zero) { [void][SnwIds]::SetForegroundWindow($prevFg) }
  exit 0
}

# ---------------------------------------------------------------- 本編
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$old = @(Get-ChildItem -Path $outDir -Filter 'id_*.png' -ErrorAction SilentlyContinue)
if ($old.Count) { $old | Remove-Item -Force; Write-Output "旧キャプチャ $($old.Count) 枚を削除" }

# ★5 既撮の判定は「リスト先頭からの絶対 y」。画面が何画素動いたかを毎回測って積算する。
#    1手につき「新しい行を1人撮る」か「スクロールする」のどちらかだけを行い、毎回撮り直して
#    位置を測り直す。こうすると、領主ファイルから戻ったときにリストが動いていても自動で追従する。
$captured = New-Object System.Collections.ArrayList   # 撮り終えた（or 試した）行の絶対y
$saved = 0
$skippedDup = 0
$failed = 0
$scrolls = 0
$prevScreen = $null
$absBase = 0.0          # 今の画面の y=0 が、リスト全体の何画素目にあたるか
$zeroRuns = 0
$justScrolled = $false
# ★10 測定を信用できないとき／最下部に着いたときは「見えている行を全部撮る」モードに入る
$forceAll = $false
$bottomSweep = $false
$forcedDone = New-Object System.Collections.ArrayList

try {
  [void][SnwIds]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 700

  for ($step = 1; $step -le $MaxSteps; $step++) {
    if ($Limit -gt 0 -and $saved -ge $Limit) { Write-Output "-Limit $Limit に達したので終了。"; break }
    if ($scrolls -gt $Screens) { Write-Output "スクロール上限 $Screens 回に達したので終了。"; break }

    $img = Get-Shot
    if (-not $img) { Write-Output 'キャプチャに失敗しました。'; break }

    # ---- 前の画面からの送り量を測る。スクロール直後かどうかで探す範囲を変える（そのぶん速い）。
    $dy = 0.0
    if ($prevScreen) {
      # 送り量は 1ノッチ=44px と分かっているので、探す範囲を予想の周りに絞る（誤ロックしにくい）。
      if ($justScrolled) { $lo = 0; $hi = [int]($Notches * 44 + 90) } else { $lo = -40; $hi = 40 }
      $sh = [SnwIds]::ShiftY($prevScreen, $img, $lo, $hi)
      $dy = [double]$sh[0]
      $absBase += $dy
      if ($justScrolled) {
        Write-Output ("  ↓ {0}px 送り（{1}ノッチ / 残差 {2:N1}）" -f [int]$dy, $Notches, $sh[1])
        # ★10 残差が大きい＝ロックを誤った疑い。この画面は絶対位置を信用せず全部撮る。
        if ($sh[1] -gt $ShiftRmsMax) {
          Write-Output ("  ※ 送り量の測定が怪しい（残差 {0:N1} > {1}）。この画面は見えている行を全部撮ります。" -f $sh[1], $ShiftRmsMax)
          $forceAll = $true
          $forcedDone.Clear()
        }
      } elseif ([Math]::Abs($dy) -gt 8) {
        Write-Output ("  ※ 戻った先でリストが {0}px 動いていました。基準を取り直します。" -f [int]$dy)
      }
      $prevScreen.Dispose()
    }
    $prevScreen = $img      # 次回の比較用。ここでは Dispose しない。
    $justScrolled = $false

    $rows = Get-Rows $img
    $rowPitch = if ($rows.Count -ge 2) { ($rows[$rows.Count - 1][2] - $rows[0][2]) / ($rows.Count - 1) } else { $img.Height * 0.1067 }
    $near = $rowPitch * $NearRows

    # ---- まだ撮っていない行を上から探す
    #   通常は「リスト全体での絶対位置」で判定。★10 のモードに入っているときは絶対位置を無視し、
    #   この画面で撮った行($forcedDone)だけを避けて、見えている行を全部撮る。
    $target = $null; $targetAbs = 0.0
    foreach ($r in $rows) {
      $abs = $absBase + $r[2]
      $isNew = $true
      if ($forceAll) {
        foreach ($p in $forcedDone) { if ([Math]::Abs($p - $abs) -lt $near) { $isNew = $false; break } }
      } elseif (-not $NoDedupe) {
        foreach ($p in $captured) { if ([Math]::Abs($p - $abs) -lt $near) { $isNew = $false; break } }
      }
      if ($isNew) { $target = $r; $targetAbs = $abs; break }
      $skippedDup++
    }

    if (-not $target) {
      if ($forceAll) {
        # 全部撮りきった。最下部での総仕上げだったならここで終わり。
        $forceAll = $false
        $forcedDone.Clear()
        if ($bottomSweep) { Write-Output '最下部の総仕上げまで完了。'; break }
        continue
      }
      # この画面に新しい行は無い → スクロールする。
      # ★最下部の判定は「ホイールを回しても1画素も動かない」こと。画素差の割合より確実。
      #   ただしリスト最上段では1ノッチ目が吸われるので、1回だけでは判断しない（2回続けて0なら最下部）。
      if ($dy -eq 0 -and $step -gt 1) {
        $zeroRuns++
        if ($zeroRuns -ge 2) {
          # ★10(b) ここで止めない。最後の画面に出ている行を全部撮ってから終わる。
          Write-Output '最下部に到達。念のため見えている行を全部撮ってから終わります。'
          $bottomSweep = $true
          $forceAll = $true
          $forcedDone.Clear()
          continue
        }
      } else { $zeroRuns = 0 }
      Invoke-Scroll
      $scrolls++
      $justScrolled = $true
      continue
    }
    $zeroRuns = 0

    # ★失敗しても必ず記録する。しないと同じ行を永久に押し続ける。
    [void]$captured.Add($targetAbs)
    if ($forceAll) { [void]$forcedDone.Add($targetAbs) }

    # ① 行を押す。★スクロール直後などに取りこぼすことがあるので押し直す。
    $pop = $null; $box = $null
    for ($try = 0; $try -le $PopupRetry; $try++) {
      Invoke-Tap ([int]($img.Width * 0.50)) ([int]$target[2])
      Start-Sleep -Milliseconds $WaitPopup
      if ($pop) { $pop.Dispose() }
      $pop = Get-Shot
      $box = [SnwIds]::WhiteBox($pop)
      if ($box) { break }
      Start-Sleep -Milliseconds 400
    }
    if (-not $box) {
      Write-Output "  ✗ y$([int]$target[2]): ポップアップが出ませんでした（$($PopupRetry + 1)回）。飛ばします。"
      if ($pop) { $pop.Dispose() }
      $failed++
      continue
    }
    $btn = [SnwIds]::FirstBlueButton($pop, $box[0], $box[1], $box[2], $box[3])
    if (-not $btn) {
      Write-Output "  ✗ y$([int]$target[2]): ［確認］が見つかりません。飛ばします。"
      Invoke-Tap ([int]($pop.Width * 0.5)) ([int]($pop.Height * 0.12))   # 箱を閉じる
      Start-Sleep -Milliseconds 500
      $pop.Dispose(); $failed++
      continue
    }
    # ★2 保険: 本当に青いか（橙の［削除する］を絶対に押さない）
    if (-not [SnwIds]::BlueAt($pop, $btn[0], $btn[1])) {
      Write-Output "  ✗ y$([int]$target[2]): 押そうとした点が青くありません。安全のため飛ばします。"
      Invoke-Tap ([int]($pop.Width * 0.5)) ([int]($pop.Height * 0.12))
      Start-Sleep -Milliseconds 500
      $pop.Dispose(); $failed++
      continue
    }
    $pop.Dispose()

    # ② ［確認］→ 領主ファイル
    Invoke-Tap $btn[0] $btn[1]
    Start-Sleep -Milliseconds $WaitProfile
    $prof = Get-Shot
    if (-not $prof) { Write-Output '  ✗ 領主ファイルを撮れませんでした。'; $failed++; continue }

    $saved++
    $file = Join-Path $outDir ("id_{0:d3}.png" -f $saved)
    $prof.Save($file, [Drawing.Imaging.ImageFormat]::Png)
    $prof.Dispose()
    Write-Output ("  saved {0}  (絶対y {1})" -f $file, [int]$targetAbs)

    # ③ ← で戻る。戻った先のずれは次の手の頭で測り直す。
    Invoke-Tap ([int]($img.Width * $BackX)) ([int]($img.Height * $BackY))
    Start-Sleep -Milliseconds $WaitBack
  }
} finally {
  if ($prevScreen) { $prevScreen.Dispose() }
  if (-not $KeepCursor) { [void][SnwIds]::SetCursorPos($savedCur.X, $savedCur.Y) }
  if ($prevFg -ne [IntPtr]::Zero) { [void][SnwIds]::SetForegroundWindow($prevFg) }
}

Write-Output ""
Write-Output "完了: $saved 枚を $outDir に保存（スクロール $scrolls 回 / 撮影済みとして飛ばした行 $skippedDup / 失敗 $failed）"
if ($saved -eq 0) { exit 1 }
