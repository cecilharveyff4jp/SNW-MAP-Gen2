# SNW 撮影〜反映 GUI（Google Play Games 版）
#
# capture-gui.ps1（スマホ＋adb 版）の姉妹版。工程はまったく同じで、①撮影の経路だけが違う。
#
#   スマホ版        adb exec-out screencap     / adb shell input swipe   … 端末が要る
#   GooglePlay版    ウィンドウを画面から取り込み / マウスのドラッグ        … PC だけで完結
#
#   ① 撮影      capture-ranking-gp.ps1   Google Play Games の窓を撮って自動スクロール
#   ② 解析      crop-rank.mjs → Claude   読む面積を削ってから画像を読ませ、JSON を書かせる
#              → verify-ranking.mjs     順位1..N連続 / 総力単調減少 / 名前 を機械検査
#   ③ ドライラン apply-ranking.mjs        DBと照合するだけ（書かない）
#   ④ 実行      apply-ranking.mjs --apply D1へ反映
#
# ★安全設計はスマホ版と同じ。④は「②の検証が合格」かつ「③で未一致0・要確認0」でなければ押せない。
#
# 起動: デスクトップのショートカット、または tools\capture-gui-gp.cmd をダブルクリック
#
# 前提:
#   ・Google Play Games でゲームを起動し、［同盟］→［ランキング］→［総力ランキング］を
#     **一番上まで戻した状態**にしておくこと。
#     ★リストを下に戻す操作（下方向ドラッグ）はゲーム側が受け付けない（実測）。途中から撮ると
#       その分だけ欠ける。開き直せば必ず先頭から始まる。
#   ・撮影中はゲームの窓が前面に出て、マウスカーソルが動く（終わると元の位置に戻る）。
#     窓を他のウィンドウで隠さないこと（画面をそのまま取り込むため）。
#   ・node は PATH に無い前提でフルパス解決する。
#   ・claude.exe は VSCode 拡張に同梱のものを使う。
#
# 自己診断（画面を出さずに配線だけ確認）:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\capture-gui-gp.ps1 -SelfTest -SelfTestOut out.txt

param([switch]$SelfTest, [string]$SelfTestOut)

Set-StrictMode -Off
$ErrorActionPreference = 'Continue'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# コンソールを持たない状態で動かす（.vbs から起動される）。詳細は capture-gui.ps1 の同じ場所を参照。
Add-Type -Namespace SnwGpGui -Name Native -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern bool FreeConsole();
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
'@
if (-not $SelfTest) { [void][SnwGpGui.Native]::FreeConsole() }

$HERE = Split-Path -Parent $MyInvocation.MyCommand.Path
$ROOT = Split-Path -Parent $HERE

# Google Play Games の中身は crosvm.exe（Android を動かしている VM）。窓の題名はゲーム名になる。
$GP_PROCESS = 'crosvm'

# ---------------------------------------------------------------- exe の場所

function Resolve-First {
  param([string[]]$Candidates)
  foreach ($c in $Candidates) {
    if (-not $c) { continue }
    if ($c -match '[\*\?]') {
      $hit = Get-ChildItem -Path $c -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
      if ($hit) { return $hit.FullName }
    } elseif (Test-Path -LiteralPath $c) {
      return (Resolve-Path -LiteralPath $c).Path
    }
  }
  return $null
}

$script:NODE = Resolve-First @(
  $env:NODE_EXE,
  'C:\Program Files\nodejs\node.exe',
  'C:\Program Files (x86)\nodejs\node.exe'
)
if (-not $script:NODE) { $c = Get-Command node -ErrorAction SilentlyContinue; if ($c) { $script:NODE = $c.Source } }

$script:CLAUDE = Resolve-First @(
  $env:CLAUDE_EXE,
  "$env:USERPROFILE\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe",
  "$env:USERPROFILE\.vscode-insiders\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe",
  "$env:LOCALAPPDATA\Programs\claude\claude.exe"
)
if (-not $script:CLAUDE) { $c = Get-Command claude -ErrorAction SilentlyContinue; if ($c) { $script:CLAUDE = $c.Source } }

$script:POWERSHELL = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path $script:POWERSHELL)) { $script:POWERSHELL = 'powershell.exe' }

# ---------------------------------------------------------------- プロセス実行
# Start-Process は使わない（コンソールを持たないプロセスから呼ぶと黒窓がちらつく）。

function ConvertTo-CmdArg {
  param([string]$Value)
  if ($Value -match '[\s"]') { return '"' + ($Value -replace '"', '\"') + '"' }
  return $Value
}

function New-HiddenProcess {
  param([string]$Exe, [string[]]$CliArgs, [string]$WorkDir, [hashtable]$EnvVars)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName               = $Exe
  $psi.Arguments              = (($CliArgs | ForEach-Object { ConvertTo-CmdArg $_ }) -join ' ')
  $psi.UseShellExecute        = $false
  $psi.CreateNoWindow         = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  # 子プロセスの出力は UTF-8。既定のままだと日本語のログが化ける。
  $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
  $psi.StandardErrorEncoding  = [System.Text.Encoding]::UTF8
  if ($WorkDir) { $psi.WorkingDirectory = $WorkDir }
  if ($EnvVars) { foreach ($k in $EnvVars.Keys) { $psi.EnvironmentVariables[$k] = [string]$EnvVars[$k] } }
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  return $p
}

$script:Cancel = $false
$script:Proc   = $null

function Invoke-Streaming {
  param([string]$Exe, [string[]]$CliArgs, [string]$WorkDir, [hashtable]$EnvVars, [int]$TimeoutMs = 1800000, [switch]$Quiet)
  if (-not $Exe) { Write-Log '  実行ファイルが見つかりません'; return [pscustomobject]@{ Code = -1; Text = '' } }
  $script:Cancel = $false
  $lines = New-Object System.Collections.ArrayList
  try {
    $p = New-HiddenProcess -Exe $Exe -CliArgs $CliArgs -WorkDir $WorkDir -EnvVars $EnvVars
    $script:Proc = $p
    $errTask = $p.StandardError.ReadToEndAsync()
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($true) {
      $t = $p.StandardOutput.ReadLineAsync()
      while (-not $t.IsCompleted) {
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 30
        if ($script:Cancel) { try { $p.Kill() } catch {}; Write-Log '  ■ 停止しました'; break }
        if ($sw.ElapsedMilliseconds -gt $TimeoutMs) { try { $p.Kill() } catch {}; Write-Log '  ■ タイムアウト'; break }
      }
      if (-not $t.IsCompleted) { break }
      $line = $t.Result
      if ($null -eq $line) { break }
      [void]$lines.Add($line)
      if (-not $Quiet -and $line.Trim()) { Write-Log "  $line" }
    }
    while (-not $p.HasExited) { [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 30 }
    $err = ''
    try { $err = $errTask.Result } catch {}
    if ($err -and $err.Trim()) { foreach ($ln in ($err.Trim() -split "`r?`n")) { if ($ln) { Write-Log "  ! $ln" } } }
    return [pscustomobject]@{ Code = $p.ExitCode; Text = ($lines -join "`n") }
  } catch {
    Write-Log "  実行に失敗: $($_.Exception.Message)"
    return [pscustomobject]@{ Code = -1; Text = '' }
  } finally {
    $script:Proc = $null
  }
}

function Invoke-Node {
  param([string[]]$CliArgs, [int]$TimeoutMs = 1800000, [switch]$Quiet)
  Invoke-Streaming -Exe $script:NODE -CliArgs $CliArgs -WorkDir $HERE -TimeoutMs $TimeoutMs -Quiet:$Quiet
}

# 撮影だけは PowerShell スクリプト。窓の取り込みとマウス操作は Win32 API を叩く必要があり、
# node からは扱えないため。GUI 本体とは別プロセスにして、［停止］で殺せるようにしてある。
#
# ★ここから呼ぶ .ps1 は先頭で [Console]::OutputEncoding を UTF-8 にしておくこと。
#   Windows PowerShell 5.1 はリダイレクトされた標準出力にもコンソールのコードページ(932)で書く。
#   New-HiddenProcess は UTF-8 として読むので、揃えないとログ窓の日本語が全部化ける
#   （node は元から UTF-8 なので Invoke-Node では起きない）。
function Invoke-PsScript {
  param([string[]]$CliArgs, [int]$TimeoutMs = 1800000)
  $full = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File') + $CliArgs
  Invoke-Streaming -Exe $script:POWERSHELL -CliArgs $full -WorkDir $HERE -TimeoutMs $TimeoutMs
}

# ---------------------------------------------------------------- ジョブ定義

$NAME_RULES = @'
名前の抽出ルール:
- 名前の左右に付く装飾記号（例: ɛʋ ୨୧ ෆ ⚔ ✧ ♡ や飾り罫）は名前の一部ではありません。除いてください。
- 名前の右上に小さく重なる称号（例: maru Love）も除いてください。
- 末尾の丸括弧つきレベル表記（例: （42））も除いてください。
- 半角カナはそのまま半角で、全角はそのまま全角で書いてください（勝手に変換しない）。
- ★装飾として除くのは記号だけです。英数字は勝手に落とさないでください。
'@

function Get-NameHint {
  param([string]$PrevPath)
  if (-not $PrevPath) { return '' }
  return @"

照合の手がかりとして、前回の結果 $($PrevPath -replace '\\', '/') も Read してください。
読み取った名前が前回の一覧のどれかと「装飾記号や飾り数字の有無だけ」の違いなら、前回の表記をそのまま使ってください
（DBにはその表記で登録されているため）。まったく別の名前になっている場合は改名なので、読んだままにしてください。
"@
}

function Get-RenameRule {
  $roster = Join-Path $HERE 'roster.json'
  if (-not (Test-Path $roster)) { return '' }
  return @"

改名の扱い（重要）:
前回一覧に居た名前が消えていて、代わりに知らない名前が出ていたら改名の可能性があります。**勝手に確定させないでください。**

- 画像や $($roster -replace '\\', '/') の name / aliases から本人の gameId が直接引ける＝**確定**。
  その要素にだけ "gameId" を足して書いてください（他の人には付けない）。
- 順位や総力が近い、という状況証拠だけの場合＝**不確定**。gameId は書かずにJSONを書き、
  「改名かも: 旧名(前回○位 総力○) → 新名(今回○位 総力○)」と根拠つきで報告して、私の判断を待ってください。
  同一人物だと私が答えたら、そこで gameId を足し直してください。
- gameId を足したときは $($roster -replace '\\', '/') も更新（name を新名に、旧名を aliases へ、updated を今日の日付に）。
"@
}

# ★切り出しの数値はスマホ版と別物。
#   スマホ版は 720x1612 の縦長、こちらは黒帯を落とした 577x1029。1画面に写る行数が違うので、
#   行の高さ・リスト範囲の割合がそのまま流用できない。実測(2026-08-07)で決めた値:
#     y0/y1     … 列見出しの下 〜 最下部の固定行（自分の順位）の上
#     gap       … ★ここがいちばん敏感。GP版の行間は 11〜12px しかなく、既定の 10 だと隣の行と
#                 繋がって「高すぎる帯」として捨てられ、1枚から 0〜6 行と暴れる。4 で安定した
#     th        … 0.35〜0.5 のどれでも同じ結果。0.6 まで上げると金色の1位だけ割れて消える
#     hmin/hmax … 行の高さ 約96px = 0.093H
$GP_CROP = @(
  '--th', '0.45', '--gap', '4',
  '--y0', '0.172', '--y1', '0.882',
  '--hmin', '0.080', '--hmax', '0.110',
  '--badge-x0', '0.035', '--badge-x1', '0.190',
  '--text-x0', '0.330',  '--text-x1', '0.980'
)

function Get-JobSpec {
  param([string]$Key, [string]$Stamp)

  switch ($Key) {

    'ranking' {
      $dir = Join-Path $HERE "shots\rank-gp-$Stamp"
      $out = Join-Path $HERE "ranking-$Stamp.json"
      return [pscustomobject]@{
        Key = $Key; Title = '同盟ランキング'; Dir = $dir; OutJson = $out
        Hint = '［同盟］→［ランキング］→［総力ランキング］を一番上まで出しておく'
        CaptureExe  = 'ps'
        CaptureArgs = @((Join-Path $HERE 'capture-ranking-gp.ps1'), '-Out', $dir, '-Count', '45')
        CropSteps   = @(, (@('crop-rank.mjs', '--in', $dir) + $GP_CROP))
        SheetDirs   = @((Join-Path $dir 'sheets'))
        Prompt = @"
$(Join-Path $dir 'sheets') にある sheet_*.png を番号順にすべて Read して、同盟の総力ランキングを抽出してください。
各行は「順位バッジ｜名前｜総力」の並びです。

- 撮影は取りこぼし防止で重ねてあるので同じ順位が複数回出てきます。順位で名寄せして1件にしてください。
- 総力はカンマを除いた整数にしてください。
- 書く前に、順位が 1..N で連続している（欠番も重複も無い）ことを必ず確認してください。

$NAME_RULES
$(Get-NameHint -PrevPath (Get-PrevRanking -Exclude $out))
$(Get-RenameRule)

結果を次のパスに JSON 配列だけで Write してください（説明文やコードフェンスは入れない）:
  $($out -replace '\\', '/')
形式: [{"rank":1,"name":"...","power":123456789}, ...]
（改名の人だけ "gameId":"456459441" を足す）
最後に「N件」と、改名があればその1行だけを答えてください。
"@
        VerifyArgs = @('verify-ranking.mjs', '--ranking', $out)
        DryArgs    = @('apply-ranking.mjs', '--ranking', $out)
        ApplyArgs  = @('apply-ranking.mjs', '--ranking', $out, '--apply')
        GateNg     = @('unmatched=(\d+)', 'fuzzy=(\d+)')
        CopyTo     = (Join-Path $HERE 'ranking.json')
      }
    }
  }
  return $null
}

function Get-PrevRanking {
  param([string]$Exclude)
  $cands = Get-ChildItem -Path $HERE -Filter 'ranking-*.json' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne $Exclude -and $_.Name -notmatch 'ranking-(ids|sample)' } |
    Sort-Object LastWriteTime -Descending
  if ($cands) { return $cands[0].FullName }
  return $null
}

# ---------------------------------------------------------------- 対象ウィンドウ

function Get-GameWindows {
  @(Get-Process -Name $GP_PROCESS -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle })
}

# ---------------------------------------------------------------- 画面

$form               = New-Object System.Windows.Forms.Form
$form.Text          = 'SNW 撮影〜反映（Google Play Games）'
$form.Size          = New-Object System.Drawing.Size(860, 720)
$form.StartPosition = 'CenterScreen'
$form.Font          = New-Object System.Drawing.Font('Yu Gothic UI', 10)
$form.MinimumSize   = New-Object System.Drawing.Size(780, 620)

function New-Label {
  param([string]$Text, [int]$X, [int]$Y, [int]$W = 120, [int]$H = 24, [switch]$Dim, [switch]$Bold)
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $Text
  $l.Location = New-Object System.Drawing.Point($X, $Y)
  $l.Size = New-Object System.Drawing.Size($W, $H)
  if ($Dim)  { $l.ForeColor = [System.Drawing.Color]::DimGray }
  if ($Bold) { $l.Font = New-Object System.Drawing.Font($form.Font, [System.Drawing.FontStyle]::Bold) }
  $form.Controls.Add($l)
  return $l
}

New-Label -Text '撮るものを選んで、左から順にボタンを押してください。' -X 16 -Y 12 -W 500 -H 22 -Bold | Out-Null

$cmbJob = New-Object System.Windows.Forms.ComboBox
$cmbJob.Location      = New-Object System.Drawing.Point(16, 40)
$cmbJob.Size          = New-Object System.Drawing.Size(260, 28)
$cmbJob.DropDownStyle = 'DropDownList'
[void]$cmbJob.Items.Add('同盟ランキング')
$cmbJob.SelectedIndex = 0
$form.Controls.Add($cmbJob)
$JOB_KEYS = @('ranking')

$btnProbe = New-Object System.Windows.Forms.Button
$btnProbe.Text     = '下見'
$btnProbe.Location = New-Object System.Drawing.Point(284, 38)
$btnProbe.Size     = New-Object System.Drawing.Size(70, 30)
$form.Controls.Add($btnProbe)

$lblHint = New-Label -Text '' -X 364 -Y 44 -W 470 -H 22 -Dim
$lblHint.Anchor = 'Top,Left,Right'

$btnCapture = New-Object System.Windows.Forms.Button
$btnCapture.Text     = '① 撮影'
$btnCapture.Location = New-Object System.Drawing.Point(16, 78)
$btnCapture.Size     = New-Object System.Drawing.Size(130, 44)
$form.Controls.Add($btnCapture)

$btnStop = New-Object System.Windows.Forms.Button
$btnStop.Text     = '停止'
$btnStop.Location = New-Object System.Drawing.Point(150, 78)
$btnStop.Size     = New-Object System.Drawing.Size(70, 44)
$btnStop.Enabled  = $false
$form.Controls.Add($btnStop)

$btnAnalyze = New-Object System.Windows.Forms.Button
$btnAnalyze.Text     = '② 解析(Claude)'
$btnAnalyze.Location = New-Object System.Drawing.Point(232, 78)
$btnAnalyze.Size     = New-Object System.Drawing.Size(160, 44)
$btnAnalyze.Enabled  = $false
$form.Controls.Add($btnAnalyze)

# 既定ON。名前の表記はDBを見ないと決められない場面があり、チャット側で読むほうが確実
# （スマホ版と同じ理由。capture-gui.ps1 の同じ箇所のコメントを参照）。
$chkChat = New-Object System.Windows.Forms.CheckBox
$chkChat.Text     = '解析はチャットでやる'
$chkChat.Location = New-Object System.Drawing.Point(176, 134)
$chkChat.Size     = New-Object System.Drawing.Size(180, 24)
$chkChat.Checked  = $true
$form.Controls.Add($chkChat)

$btnDry = New-Object System.Windows.Forms.Button
$btnDry.Text     = '③ ドライラン'
$btnDry.Location = New-Object System.Drawing.Point(400, 78)
$btnDry.Size     = New-Object System.Drawing.Size(140, 44)
$btnDry.Enabled  = $false
$form.Controls.Add($btnDry)

$btnApply = New-Object System.Windows.Forms.Button
$btnApply.Text     = '④ 実行（D1へ反映）'
$btnApply.Location = New-Object System.Drawing.Point(548, 78)
$btnApply.Size     = New-Object System.Drawing.Size(190, 44)
$btnApply.Enabled  = $false
$form.Controls.Add($btnApply)

$btnRunAll = New-Object System.Windows.Forms.Button
$btnRunAll.Text     = '①〜③を通しで'
$btnRunAll.Location = New-Object System.Drawing.Point(16, 130)
$btnRunAll.Size     = New-Object System.Drawing.Size(150, 32)
$form.Controls.Add($btnRunAll)

New-Label -Text '※［実行］は検証に合格し、ドライランの未一致・要確認がどちらも0のときだけ押せます。' -X 16 -Y 164 -W 800 -H 22 -Dim | Out-Null

$lblState = New-Label -Text '状態: 待機' -X 16 -Y 188 -W 800 -H 24 -Bold
$lblState.ForeColor = [System.Drawing.Color]::DimGray
$lblState.Anchor = 'Top,Left,Right'

$txtLog = New-Object System.Windows.Forms.TextBox
$txtLog.Location   = New-Object System.Drawing.Point(16, 216)
$txtLog.Size       = New-Object System.Drawing.Size(808, 442)
$txtLog.Multiline  = $true
$txtLog.ScrollBars = 'Vertical'
$txtLog.ReadOnly   = $true
$txtLog.BackColor  = [System.Drawing.Color]::White
$txtLog.Font       = New-Object System.Drawing.Font('Consolas', 9)
$txtLog.Anchor     = 'Top,Left,Right,Bottom'
$txtLog.WordWrap   = $false
$form.Controls.Add($txtLog)

function Write-Log {
  param([string]$Message)
  $stamp = (Get-Date).ToString('HH:mm:ss')
  $txtLog.AppendText("[$stamp] $Message`r`n")
  $txtLog.SelectionStart = $txtLog.TextLength
  $txtLog.ScrollToCaret()
  [System.Windows.Forms.Application]::DoEvents()
}

function Set-State {
  param([string]$Text, [string]$Kind = 'idle')
  $lblState.Text = "状態: $Text"
  switch ($Kind) {
    'ok'   { $lblState.ForeColor = [System.Drawing.Color]::FromArgb(0, 128, 0) }
    'ng'   { $lblState.ForeColor = [System.Drawing.Color]::Firebrick }
    'busy' { $lblState.ForeColor = [System.Drawing.Color]::DarkOrange }
    default { $lblState.ForeColor = [System.Drawing.Color]::DimGray }
  }
  [System.Windows.Forms.Application]::DoEvents()
}

# ---------------------------------------------------------------- 工程の状態

$script:Spec     = $null
$script:Captured = $false
$script:Analyzed = $false
$script:DryOk    = $false
$script:Busy     = $false

function Update-Buttons {
  $idle = -not $script:Busy
  $btnCapture.Enabled = $idle
  $btnRunAll.Enabled  = $idle
  $btnProbe.Enabled   = $idle
  $cmbJob.Enabled     = $idle
  $btnAnalyze.Enabled = $idle -and $script:Captured
  $btnDry.Enabled     = $idle -and $script:Analyzed
  $btnApply.Enabled   = $idle -and $script:DryOk
  $btnStop.Enabled    = -not $idle
  [System.Windows.Forms.Application]::DoEvents()
}

function Set-Busy {
  param([bool]$Busy)
  $script:Busy = $Busy
  if ($Busy) { $form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor }
  else       { $form.Cursor = [System.Windows.Forms.Cursors]::Default }
  Update-Buttons
}

function Get-SelectedKey { return $JOB_KEYS[$cmbJob.SelectedIndex] }

# ---------------------------------------------------------------- 下見（撮影せずに対象を確認）

function Invoke-Probe {
  $wins = Get-GameWindows
  if ($wins.Count -eq 0) {
    Write-Log 'Google Play Games のウィンドウが見つかりません。ゲームを起動してください。'
    Set-State 'ウィンドウなし' 'ng'
    return $false
  }
  foreach ($w in $wins) { Write-Log "  候補: $($w.MainWindowTitle)  (pid $($w.Id))" }
  if ($wins.Count -gt 1) {
    Write-Log '  ★複数のゲーム窓が開いています。1つだけにしてください。'
    Set-State '対象を絞れません' 'ng'
    return $false
  }
  $dir = Join-Path $HERE 'shots\gp-probe'
  $r = Invoke-PsScript -CliArgs @((Join-Path $HERE 'capture-ranking-gp.ps1'), '-Probe', '-Out', $dir) -TimeoutMs 120000
  if ($r.Code -ne 0) { Set-State '下見に失敗' 'ng'; return $false }
  Write-Log "  下見画像: $dir （中身が総力ランキングの一番上になっているか確認してください）"
  Set-State '下見OK' 'ok'
  return $true
}

# ---------------------------------------------------------------- ① 撮影

function Invoke-Capture {
  $key   = Get-SelectedKey
  $stamp = (Get-Date).ToString('yyyyMMdd-HHmm')
  $spec  = Get-JobSpec -Key $key -Stamp $stamp
  if (-not $spec) { Write-Log 'ジョブ定義が見つかりません'; return $false }

  if (-not $script:NODE) { Write-Log 'node.exe が見つかりません（環境変数 NODE_EXE で指定できます）'; Set-State 'node なし' 'ng'; return $false }
  $wins = Get-GameWindows
  if ($wins.Count -eq 0) { Write-Log 'Google Play Games のウィンドウが見つかりません。ゲームを起動してください。'; Set-State 'ウィンドウなし' 'ng'; return $false }
  if ($wins.Count -gt 1) { Write-Log '★複数のゲーム窓が開いています。1つだけにしてください。'; Set-State '対象を絞れません' 'ng'; return $false }

  $script:Spec = $spec
  $script:Captured = $false; $script:Analyzed = $false; $script:DryOk = $false
  Update-Buttons

  Write-Log ('=' * 60)
  Write-Log "① 撮影: $($spec.Title)"
  Write-Log "  対象: $($wins[0].MainWindowTitle)"
  Write-Log "  出力先: $($spec.Dir)"
  Write-Log '  ※ゲームの窓が前面に出てマウスが動きます。終わるまで触らないでください。'
  Set-State "撮影中… $($spec.Title)" 'busy'

  $r = if ($spec.CaptureExe -eq 'ps') { Invoke-PsScript -CliArgs $spec.CaptureArgs } else { Invoke-Node -CliArgs $spec.CaptureArgs }

  if ($r.Code -ne 0) { Write-Log '  撮影に失敗しました。'; Set-State '撮影失敗' 'ng'; return $false }

  $shots = @(Get-ChildItem -Path $spec.Dir -Filter 'rank_*.png' -ErrorAction SilentlyContinue)
  if ($shots.Count -eq 0) { Write-Log '  画像が1枚もありません。'; Set-State '撮影失敗（0枚）' 'ng'; return $false }

  # 1枚で終わった＝1回もスクロールしていない。一番上ではなく最後まで送った状態から
  # 撮り始めた時にこうなる（下に戻す操作はゲームが受け付けないので撮り直しでは直らない）。
  if ($shots.Count -le 2) {
    Write-Log "  ★$($shots.Count)枚しか撮れていません。リストが最後まで送られたままの可能性があります。"
    Write-Log '    ランキング画面を開き直して一番上に戻してから、もう一度［① 撮影］を押してください。'
    Set-State "撮影が短すぎます（$($shots.Count)枚）" 'ng'
    return $false
  }

  Write-Log "  撮影 $($shots.Count) 枚"
  $script:Captured = $true
  Set-State "撮影完了 $($shots.Count)枚 → ② 解析へ" 'ok'
  return $true
}

# ---------------------------------------------------------------- ② 解析（切り出し → Claude → 検証）

function Invoke-Analyze {
  $spec = $script:Spec
  if (-not $spec) { Write-Log '先に撮影してください。'; return $false }
  if (-not $chkChat.Checked -and -not $script:CLAUDE) { Write-Log 'claude.exe が見つかりません（環境変数 CLAUDE_EXE で指定できます）'; Set-State 'claude なし' 'ng'; return $false }

  $script:Analyzed = $false; $script:DryOk = $false
  Update-Buttons

  Write-Log ('-' * 60)
  Write-Log '② 解析 [1/3] 切り出し'
  Set-State '切り出し中…' 'busy'
  foreach ($step in $spec.CropSteps) {
    $r = Invoke-Node -CliArgs $step
    if ($r.Code -ne 0) { Write-Log '  切り出しに失敗しました。'; Set-State '切り出し失敗' 'ng'; return $false }
  }
  foreach ($sd in $spec.SheetDirs) {
    $n = @(Get-ChildItem -Path $sd -Filter 'sheet_*.png' -ErrorAction SilentlyContinue).Count
    Write-Log "  $sd : $n 枚"
    if ($n -eq 0) { Write-Log '  シートが作られませんでした。'; Set-State '切り出し失敗' 'ng'; return $false }
  }

  if (Test-Path $spec.OutJson) { Remove-Item $spec.OutJson -Force }

  if ($chkChat.Checked) {
    Write-Log '② 解析 [2/3] チャットで読み取り'
    try {
      [System.Windows.Forms.Clipboard]::SetText($spec.Prompt)
      Write-Log '  お題をクリップボードにコピーしました。Claude Code のチャットに貼り付けてください。'
    } catch {
      Write-Log "  クリップボードに入れられませんでした（$($_.Exception.Message)）。下の内容をチャットに伝えてください:"
      foreach ($ln in ($spec.Prompt -split "`r?`n")) { Write-Log "    $ln" }
    }
    Write-Log "  $($spec.OutJson) が作られるのを待っています。（［停止］で中止）"
    Set-State 'チャットの解析待ち…' 'busy'

    $script:Cancel = $false
    $wait = [System.Diagnostics.Stopwatch]::StartNew()
    $beat = 0
    while (-not (Test-Path $spec.OutJson)) {
      [System.Windows.Forms.Application]::DoEvents()
      Start-Sleep -Milliseconds 400
      if ($script:Cancel) { Write-Log '  待機を中止しました。'; Set-State '中止' 'ng'; return $false }
      if ([int]($wait.Elapsed.TotalSeconds / 30) -gt $beat) { $beat++; Write-Log "  待機中… $([int]$wait.Elapsed.TotalSeconds) 秒" }
    }
    # 書き込み途中を掴まないように、サイズが落ち着くまで少し待つ。
    $prevLen = -1
    for ($i = 0; $i -lt 20; $i++) {
      $len = (Get-Item $spec.OutJson).Length
      if ($len -gt 0 -and $len -eq $prevLen) { break }
      $prevLen = $len
      [System.Windows.Forms.Application]::DoEvents()
      Start-Sleep -Milliseconds 300
    }
    Write-Log "  JSON を検出しました（$([int]$wait.Elapsed.TotalSeconds) 秒）"
  } else {
    # ★--allowedTools を明示的に渡すこと。このワークスペースは trust されていないため
    #   .claude\settings.json の permissions は無視される（-p 実行時に警告が出る）。
    Write-Log '② 解析 [2/3] Claude で読み取り（1〜3分かかります）'
    Set-State '解析中… Claude が画像を読んでいます' 'busy'

    $claudeArgs = @(
      '-p', $spec.Prompt,
      '--allowedTools', 'Read', 'Write', 'Glob',
      '--permission-mode', 'acceptEdits',
      '--output-format', 'text',
      '--no-session-persistence'
    )
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $r = Invoke-Streaming -Exe $script:CLAUDE -CliArgs $claudeArgs -WorkDir $ROOT -TimeoutMs 900000
    Write-Log "  ($([int]$sw.Elapsed.TotalSeconds) 秒)"
  }

  if (-not (Test-Path $spec.OutJson)) {
    Write-Log "  JSON が作られませんでした: $($spec.OutJson)"
    Set-State '解析失敗' 'ng'
    return $false
  }
  Write-Log "  出力: $($spec.OutJson)"

  Write-Log '② 解析 [3/3] 検証'
  if ($spec.VerifyArgs) {
    $vargs = @() + $spec.VerifyArgs
    $prev = Get-PrevRanking -Exclude $spec.OutJson
    if ($prev) { $vargs += @('--prev', $prev); Write-Log "  前回比: $(Split-Path -Leaf $prev)" }
    $v = Invoke-Node -CliArgs $vargs
    if ($v.Code -ne 0) {
      Write-Log '  ★検証で不合格です。読み直し（②）か撮り直し（①）が必要です。'
      Set-State '検証NG' 'ng'
      return $false
    }
  }

  if ($spec.CopyTo) {
    Copy-Item -LiteralPath $spec.OutJson -Destination $spec.CopyTo -Force
    Write-Log "  $(Split-Path -Leaf $spec.CopyTo) にもコピーしました（他ツールが参照します）"
  }

  $script:Analyzed = $true
  Set-State '解析・検証OK → ③ ドライランへ' 'ok'
  return $true
}

# ---------------------------------------------------------------- ③ ドライラン

function Invoke-DryRun {
  $spec = $script:Spec
  if (-not $spec) { Write-Log '先に撮影・解析してください。'; return $false }
  $script:DryOk = $false
  Update-Buttons

  Write-Log ('-' * 60)
  Write-Log '③ ドライラン（DBには書きません）'
  Set-State 'ドライラン中…' 'busy'
  $r = Invoke-Node -CliArgs $spec.DryArgs
  if ($r.Code -ne 0) { Write-Log '  ドライランに失敗しました。'; Set-State 'ドライラン失敗' 'ng'; return $false }

  $ng = 0
  $detail = @()
  foreach ($re in $spec.GateNg) {
    $m = [regex]::Match($r.Text, $re)
    if ($m.Success) {
      $v = [int]$m.Groups[1].Value
      $ng += $v
      $detail += "$($m.Value)"
    }
  }
  if ($detail.Count) { Write-Log "  ゲート: $($detail -join '  ')" }

  if ($ng -gt 0) {
    Write-Log '  ★未一致または要確認があります。実行はできません。'
    Write-Log '    上の [2] に出ている名前を見てください。'
    Write-Log '    ・DBの登録名と装飾/表記だけが違う → ② をやり直す（前回名に寄せて読み直します）'
    Write-Log '    ・本当に新規メンバー、または改名  → このログを Claude Code のチャットに貼って相談してください。'
    Write-Log '      （新規登録には --create-new が要るので、GUI からは実行しません）'
    Set-State "ドライランNG（未一致・要確認 計 $ng 件）" 'ng'
    return $false
  }

  $script:DryOk = $true
  Set-State 'ドライランOK → ④ 実行できます' 'ok'
  return $true
}

# ---------------------------------------------------------------- ④ 実行

function Invoke-Apply {
  $spec = $script:Spec
  if (-not $spec -or -not $script:DryOk) { Write-Log 'ドライランに合格していません。'; return $false }

  $msg = "D1（本番DB）に反映します。よろしいですか？`n`n$($spec.Title)`n$(Split-Path -Leaf $spec.OutJson)"
  $ans = [System.Windows.Forms.MessageBox]::Show($msg, '確認', 'YesNo', 'Warning')
  if ($ans -ne 'Yes') { Write-Log '  キャンセルしました。'; return $false }

  Write-Log ('-' * 60)
  Write-Log '④ 実行（D1へ反映）'
  Set-State '反映中…' 'busy'
  $r = Invoke-Node -CliArgs $spec.ApplyArgs
  if ($r.Code -ne 0) { Write-Log '  反映に失敗しました。'; Set-State '反映失敗' 'ng'; return $false }

  Write-Log '  完了しました。'
  Set-State '反映完了' 'ok'
  $script:DryOk = $false   # 二重反映の防止
  return $true
}

# ---------------------------------------------------------------- ボタン

$cmbJob.Add_SelectedIndexChanged({
  $spec = Get-JobSpec -Key (Get-SelectedKey) -Stamp 'x'
  if ($spec) { $lblHint.Text = $spec.Hint }
})

$btnProbe.Add_Click({
  Set-Busy $true
  try { [void](Invoke-Probe) } finally { Set-Busy $false }
})

$btnCapture.Add_Click({
  Set-Busy $true
  try { [void](Invoke-Capture) } finally { Set-Busy $false }
})

$btnStop.Add_Click({
  $script:Cancel = $true
  Write-Log '停止を要求しました…'
})

$btnAnalyze.Add_Click({
  Set-Busy $true
  try { [void](Invoke-Analyze) } finally { Set-Busy $false }
})

$btnDry.Add_Click({
  Set-Busy $true
  try { [void](Invoke-DryRun) } finally { Set-Busy $false }
})

$btnApply.Add_Click({
  Set-Busy $true
  try { [void](Invoke-Apply) } finally { Set-Busy $false }
})

$btnRunAll.Add_Click({
  Set-Busy $true
  try {
    if (-not (Invoke-Capture)) { return }
    if (-not (Invoke-Analyze)) { return }
    if (-not (Invoke-DryRun))  { return }
    Write-Log ''
    Write-Log '★ ここまで自動で通りました。内容を確認して［④ 実行］を押してください。'
  } finally { Set-Busy $false }
})

$form.Add_FormClosing({
  if ($script:Proc -and -not $script:Proc.HasExited) {
    try { $script:Proc.Kill() } catch {}
  }
})

# ---------------------------------------------------------------- 起動時

$form.Add_Shown({
  # .vbs から SW_HIDE で起動されるため、明示的に表示する（詳細は capture-gui.ps1 の同じ場所）。
  [void][SnwGpGui.Native]::ShowWindow($form.Handle, 5)
  [void][SnwGpGui.Native]::SetForegroundWindow($form.Handle)

  Write-Log "node  : $(if ($script:NODE)   { $script:NODE }   else { '見つかりません' })"
  Write-Log "claude: $(if ($script:CLAUDE) { $script:CLAUDE } else { '見つかりません' })"
  $wins = Get-GameWindows
  if ($wins.Count -eq 0) { Write-Log 'ゲーム  : 見つかりません（Google Play Games でゲームを起動してください）' }
  else { foreach ($w in $wins) { Write-Log "ゲーム  : $($w.MainWindowTitle)  (pid $($w.Id))" } }

  $spec = Get-JobSpec -Key (Get-SelectedKey) -Stamp 'x'
  if ($spec) { $lblHint.Text = $spec.Hint }
  Update-Buttons
  Write-Log '総力ランキングを一番上まで出してから［① 撮影］を押してください（［下見］で今の画面を確認できます）。'
})

if ($SelfTest) {
  $rep = New-Object System.Collections.ArrayList
  [void]$rep.Add("node       = $script:NODE")
  [void]$rep.Add("claude     = $script:CLAUDE")
  [void]$rep.Add("powershell = $script:POWERSHELL")
  $wins = Get-GameWindows
  [void]$rep.Add("game       = $(if ($wins.Count) { ($wins | ForEach-Object { "$($_.MainWindowTitle) (pid $($_.Id))" }) -join ' / ' } else { '見つかりません' })")
  foreach ($k in $JOB_KEYS) {
    $s = Get-JobSpec -Key $k -Stamp 'TEST'
    [void]$rep.Add("--- $k : $($s.Title)")
    [void]$rep.Add("    dir     = $($s.Dir)")
    [void]$rep.Add("    out     = $($s.OutJson)")
    [void]$rep.Add("    capture = [$($s.CaptureExe)] $($s.CaptureArgs -join ' ')")
    foreach ($c in $s.CropSteps) { [void]$rep.Add("    crop    = $($c -join ' ')") }
    [void]$rep.Add("    verify  = $($s.VerifyArgs -join ' ')")
    [void]$rep.Add("    dry     = $($s.DryArgs -join ' ')")
    [void]$rep.Add("    apply   = $($s.ApplyArgs -join ' ')")
    [void]$rep.Add("    gate    = $($s.GateNg -join ' , ')")
    [void]$rep.Add("    prompt  = $(($s.Prompt -split "`n").Count) 行")
    # ツール本体が実在するか（ジョブ定義のタイプミスはここで落とす）
    $need = @()
    if ($s.CaptureExe -eq 'ps') { $need += $s.CaptureArgs[0] } else { $need += (Join-Path $HERE $s.CaptureArgs[0]) }
    $need += @($s.CropSteps  | ForEach-Object { Join-Path $HERE $_[0] })
    $need += @($s.VerifyArgs | Select-Object -First 1 | ForEach-Object { Join-Path $HERE $_ })
    $need += (Join-Path $HERE $s.DryArgs[0])
    foreach ($f in $need) { if ($f -and -not (Test-Path $f)) { [void]$rep.Add("    ★ 見つかりません: $f") } }
  }
  # 出力を1行ずつ汲みながら待つ所（Invoke-Streaming）は、失敗すると GUI ごと固まる。
  [void]$rep.Add('--- streaming')
  $t0 = [System.Diagnostics.Stopwatch]::StartNew()
  $sr = Invoke-Node -CliArgs @('-e', "for(let i=1;i<=5;i++)console.log('line '+i);console.error('to stderr');") -TimeoutMs 30000
  [void]$rep.Add("    node : exit=$($sr.Code)  lines=$(@($sr.Text -split "`n").Count)  $([int]$t0.ElapsedMilliseconds)ms")
  if ($sr.Code -ne 0 -or $sr.Text -notmatch 'line 5') { [void]$rep.Add('    ★ ストリーミングが正しく動いていません') }
  $t1 = [System.Diagnostics.Stopwatch]::StartNew()
  $pr = Invoke-Streaming -Exe $script:POWERSHELL -CliArgs @('-NoProfile', '-Command', '1..5 | ForEach-Object { "line $_" }') -WorkDir $HERE -TimeoutMs 30000
  [void]$rep.Add("    ps   : exit=$($pr.Code)  lines=$(@($pr.Text -split "`n").Count)  $([int]$t1.ElapsedMilliseconds)ms")
  if ($pr.Code -ne 0 -or $pr.Text -notmatch 'line 5') { [void]$rep.Add('    ★ PowerShell 側のストリーミングが動いていません') }
  $t2 = [System.Diagnostics.Stopwatch]::StartNew()
  $tr = Invoke-Node -CliArgs @('-e', "setTimeout(()=>{},60000);") -TimeoutMs 3000
  [void]$rep.Add("    timeout: exit=$($tr.Code)  $([int]$t2.ElapsedMilliseconds)ms（3秒で打ち切れていればOK）")

  $text = ($rep -join "`r`n")
  if ($SelfTestOut) { $text | Out-File -FilePath $SelfTestOut -Encoding utf8 } else { Write-Output $text }
  return
}

[void]$form.ShowDialog()
