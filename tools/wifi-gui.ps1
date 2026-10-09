# SNW スマホ Wi-Fi 接続ツール（GUI）
#
# やること: 端末の「ワイヤレスデバッグ」画面に出ている IP とポートを入れて［接続］を押すだけ。
#           接続できたら自動で scrcpy のミラーリングを立ち上げる。
#
# 起動: tools\wifi-gui.cmd をダブルクリック
#       （または powershell -NoProfile -ExecutionPolicy Bypass -File tools\wifi-gui.ps1）
#
# なぜ GUI か（毎回ここで詰まっていた事情）:
#   ・ワイヤレスデバッグの【接続用ポート】は ON/OFF や Wi-Fi 再接続のたびに変わる。IP も DHCP で変わる。
#     → 覚えても無駄なので「画面の値を貼る」以外の手順を無くした。
#   ・adb mdns services はこの PC では空を返したり古いポートを返す。当てにせず手入力を主にした。
#   ・接続直後に state=offline に落ちることがある。手動だと毎回 disconnect/kill-server で試行錯誤していたので、
#     そのリカバリ（disconnect → 再connect → kill-server → 再connect）をボタン1つに畳み込んでいる。
#
# 接続に成功すると tools\.adb-target を connect-wifi.mjs と同じ形式で保存するので、
# 以降は  . tools\adb-env.ps1  で capture-*.mjs がそのまま動く。

Set-StrictMode -Off
$ErrorActionPreference = 'Continue'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# 黒いコンソールを消す。
#
# ★本命は起動方法の方: wifi-gui.vbs（WScript の Run(..., 0, False)）から起動する。これだと
#   コンソールの窓が最初から1つも作られない。デスクトップのショートカットも wifi-gui.cmd も
#   この .vbs を経由している。実機で「GUI は出る／Terminal は残らない」を確認済み。
#
#   ここで効かなかった手（記録。同じ回り道をしないため）:
#     ・ShowWindow(GetConsoleWindow(), SW_HIDE) … 消えない。Windows 11 の既定コンソールは
#       Windows Terminal で、窓を持っているのは WindowsTerminal.exe 側。GetConsoleWindow() が
#       返すのは実体のないダミーなので隠しても見えている窓は残る。
#     ・powershell -WindowStyle Hidden … ショートカットから起動すると Terminal の窓が残る。
#       （なお「-WindowStyle Hidden だとフォームまで隠れる」と以前書いたのは誤り。
#         当時の不具合の実際の原因は wifi-gui.cmd を UTF-8 で書いていたこと。）
#
# 下の FreeConsole() は保険。.vbs を通さず直接叩かれた場合にコンソールから外す。
# ★FreeConsole 後はコンソール出力ができない。このスクリプトはログを TextBox にしか書かないので影響なし。
Add-Type -Namespace SnwWin -Name Native -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern bool FreeConsole();
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
'@
[void][SnwWin.Native]::FreeConsole()

$HERE        = Split-Path -Parent $MyInvocation.MyCommand.Path
$TARGET_FILE = Join-Path $HERE '.adb-target'
$PREFS_FILE  = Join-Path $HERE '.wifi-gui.json'

# ---------------------------------------------------------------- exe の場所

# adb / scrcpy は PATH に無い前提。scrcpy 同梱の adb を優先して探す。
$SCRCPY_DIRS = @(
  $env:SCRCPY_DIR,
  'D:\Prog\scrcpy-win64-v3.3.1',
  'C:\Prog\scrcpy-win64-v3.3.1',
  'D:\Prog\scrcpy',
  'C:\Prog\scrcpy'
) | Where-Object { $_ }

function Resolve-Exe {
  param([string]$Name, [string]$EnvValue)
  $cands = @()
  if ($EnvValue) { $cands += $EnvValue }
  foreach ($d in $SCRCPY_DIRS) { $cands += (Join-Path $d $Name) }
  foreach ($c in $cands) { if (Test-Path -LiteralPath $c) { return (Resolve-Path -LiteralPath $c).Path } }
  $cmd = Get-Command ([System.IO.Path]::GetFileNameWithoutExtension($Name)) -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

$script:ADB    = Resolve-Exe -Name 'adb.exe'    -EnvValue $env:ADB
$script:SCRCPY = Resolve-Exe -Name 'scrcpy.exe' -EnvValue $env:SCRCPY

# ---------------------------------------------------------------- プロセス実行

# ★ここで Start-Process は使わない。
#   この GUI は .vbs から SW_HIDE で起動されるためコンソールを持っていない。その状態で
#   Start-Process -NoNewWindow を呼ぶと adb 1回ごとに黒い窓が出たり消えたりして激しくちらつく
#   （接続中は adb devices を0.5秒おきに叩くので特に目立つ）。
#   ProcessStartInfo の CreateNoWindow は「コンソールを作らない」だけで、相手のGUIウィンドウには
#   影響しないので、adb にも scrcpy にも安全に使える（SW_HIDE を渡す -WindowStyle Hidden とは別物）。
function ConvertTo-CmdArg {
  param([string]$Value)
  if ($Value -match '[\s"]') { return '"' + ($Value -replace '"', '\"') + '"' }
  return $Value
}

# .NET Framework の ProcessStartInfo に ArgumentList は無いので、引数は自前で組み立てる。
function New-HiddenProcess {
  param([string]$Exe, [string[]]$CliArgs, [string]$WorkDir)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName               = $Exe
  $psi.Arguments              = (($CliArgs | ForEach-Object { ConvertTo-CmdArg $_ }) -join ' ')
  $psi.UseShellExecute        = $false
  $psi.CreateNoWindow         = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  if ($WorkDir) { $psi.WorkingDirectory = $WorkDir }
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  return $p
}

# UI を固めずに外部コマンドを待つ。
# 標準出力/エラーは非同期で汲み続ける（片方だけ読むとパイプが詰まって固まるため）。
function Invoke-Cli {
  param([string]$Exe, [string[]]$CliArgs, [int]$TimeoutMs = 20000)
  if (-not $Exe) { return [pscustomobject]@{ Code = -1; Out = ''; Err = '(実行ファイルが見つかりません)' } }
  try {
    $p = New-HiddenProcess -Exe $Exe -CliArgs $CliArgs
    $outTask = $p.StandardOutput.ReadToEndAsync()
    $errTask = $p.StandardError.ReadToEndAsync()
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while (-not $p.HasExited) {
      [System.Windows.Forms.Application]::DoEvents()
      Start-Sleep -Milliseconds 40
      if ($sw.ElapsedMilliseconds -gt $TimeoutMs) {
        try { $p.Kill() } catch {}
        return [pscustomobject]@{ Code = -1; Out = ''; Err = '(タイムアウト)' }
      }
    }
    $out = ''; $err = ''
    try { $out = $outTask.Result } catch {}
    try { $err = $errTask.Result } catch {}
    return [pscustomobject]@{ Code = $p.ExitCode; Out = ("$out").Trim(); Err = ("$err").Trim() }
  } catch {
    return [pscustomobject]@{ Code = -1; Out = ''; Err = $_.Exception.Message }
  }
}

function Invoke-Adb {
  param([string[]]$CliArgs, [int]$TimeoutMs = 20000)
  Invoke-Cli -Exe $script:ADB -CliArgs $CliArgs -TimeoutMs $TimeoutMs
}

function Wait-Ui {
  param([int]$Ms)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.ElapsedMilliseconds -lt $Ms) {
    [System.Windows.Forms.Application]::DoEvents()
    Start-Sleep -Milliseconds 40
  }
}

# ---------------------------------------------------------------- adb 補助

$IPPORT_RE = '^\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}$'

function Get-DeviceState {
  param([string]$Addr)
  # get-state は offline のときエラー終了するので devices の一覧から拾う。
  $r = Invoke-Adb -CliArgs @('devices') -TimeoutMs 10000
  foreach ($line in ("$($r.Out)" -split "`r?`n")) {
    $t = $line.Trim()
    if (-not $t -or $t -like 'List of devices*') { continue }
    $parts = $t -split '\s+'
    if ($parts[0] -eq $Addr) { return $parts[1] }
  }
  return $null
}

function Test-PortOpen {
  param([string]$IpAddress, [int]$Port)
  $c = New-Object System.Net.Sockets.TcpClient
  try {
    $ar = $c.BeginConnect($IpAddress, $Port, $null, $null)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while (-not $ar.AsyncWaitHandle.WaitOne(100) -and $sw.ElapsedMilliseconds -lt 3000) {
      [System.Windows.Forms.Application]::DoEvents()
    }
    if (-not $ar.IsCompleted) { return $false }
    $c.EndConnect($ar)
    return $true
  } catch { return $false } finally { $c.Close() }
}

function Save-Target {
  param([string]$Serial)
  $obj = [ordered]@{ serial = $Serial; adb = $script:ADB; updatedAt = (Get-Date).ToString('o') }
  ($obj | ConvertTo-Json) | Out-File -FilePath $TARGET_FILE -Encoding utf8
}

function Save-Prefs {
  param([string]$IpAddress, [string]$Port, [bool]$AutoMirror)
  $obj = [ordered]@{ ip = $IpAddress; port = $Port; autoMirror = $AutoMirror }
  ($obj | ConvertTo-Json) | Out-File -FilePath $PREFS_FILE -Encoding utf8
}

function Get-Prefs {
  if (-not (Test-Path $PREFS_FILE)) { return $null }
  try { return (Get-Content $PREFS_FILE -Raw | ConvertFrom-Json) } catch { return $null }
}

# ---------------------------------------------------------------- 画面

$form                 = New-Object System.Windows.Forms.Form
$form.Text            = 'SNW スマホ Wi-Fi 接続'
$form.Size            = New-Object System.Drawing.Size(660, 606)
$form.StartPosition   = 'CenterScreen'
$form.Font            = New-Object System.Drawing.Font('Yu Gothic UI', 10)
$form.MinimumSize     = New-Object System.Drawing.Size(620, 526)

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

New-Label -Text '端末の［ワイヤレスデバッグ］画面に出ている IP アドレスとポートを入れて［接続］' -X 16 -Y 12 -W 600 -H 22 -Bold | Out-Null
New-Label -Text 'ポートは ON/OFF や Wi-Fi 再接続のたびに変わります。値を控えたあとに端末側でトグルしないでください。' -X 16 -Y 34 -W 620 -H 22 -Dim | Out-Null

New-Label -Text 'IP アドレス' -X 16 -Y 68 -W 90 | Out-Null
$txtIp = New-Object System.Windows.Forms.TextBox
$txtIp.Location = New-Object System.Drawing.Point(106, 65)
$txtIp.Size     = New-Object System.Drawing.Size(180, 26)
$txtIp.Text     = '192.168.0.52'
$form.Controls.Add($txtIp)

New-Label -Text 'ポート' -X 300 -Y 68 -W 50 | Out-Null
$txtPort = New-Object System.Windows.Forms.TextBox
$txtPort.Location = New-Object System.Drawing.Point(352, 65)
$txtPort.Size     = New-Object System.Drawing.Size(100, 26)
$form.Controls.Add($txtPort)

New-Label -Text '※「192.168.0.52:33593」や「192.168.0.52-33593」をIP欄にそのまま貼っても自動で分割します' -X 16 -Y 94 -W 620 -H 22 -Dim | Out-Null

# 貼り付け対応: IP 欄に IP:ポート 形式が入ったらポート欄へ分割する（区切りは : - 空白 のどれでも）。
$splitPasted = {
  $t = $txtIp.Text.Trim()
  $m = [regex]::Match($t, '^(\d{1,3}(?:\.\d{1,3}){3})\s*[:\-\s]\s*(\d{2,5})$')
  if ($m.Success) {
    $txtIp.Text   = $m.Groups[1].Value
    $txtPort.Text = $m.Groups[2].Value
    $txtPort.Focus() | Out-Null
  }
}
$txtIp.Add_TextChanged($splitPasted)

$btnConnect = New-Object System.Windows.Forms.Button
$btnConnect.Text     = '接続'
$btnConnect.Location = New-Object System.Drawing.Point(16, 126)
$btnConnect.Size     = New-Object System.Drawing.Size(120, 40)
$form.Controls.Add($btnConnect)
$form.AcceptButton = $btnConnect

$btnMirror = New-Object System.Windows.Forms.Button
$btnMirror.Text     = 'ミラーリング'
$btnMirror.Location = New-Object System.Drawing.Point(146, 126)
$btnMirror.Size     = New-Object System.Drawing.Size(120, 40)
$form.Controls.Add($btnMirror)

$btnDisconnect = New-Object System.Windows.Forms.Button
$btnDisconnect.Text     = '切断'
$btnDisconnect.Location = New-Object System.Drawing.Point(276, 126)
$btnDisconnect.Size     = New-Object System.Drawing.Size(90, 40)
$form.Controls.Add($btnDisconnect)

$btnDetect = New-Object System.Windows.Forms.Button
$btnDetect.Text     = '自動検出'
$btnDetect.Location = New-Object System.Drawing.Point(376, 126)
$btnDetect.Size     = New-Object System.Drawing.Size(90, 40)
$form.Controls.Add($btnDetect)

$chkAuto = New-Object System.Windows.Forms.CheckBox
$chkAuto.Text     = '接続できたら自動でミラーリング'
$chkAuto.Location = New-Object System.Drawing.Point(480, 136)
$chkAuto.Size     = New-Object System.Drawing.Size(160, 24)
$chkAuto.Checked  = $true
$form.Controls.Add($chkAuto)

# 接続の次にやることは必ず撮影なので、ここから直接開けるようにしておく。
# （デスクトップの SNW撮影.lnk と同じ tools\capture-gui.vbs を起動する）
$btnCapGui = New-Object System.Windows.Forms.Button
$btnCapGui.Text     = '撮影ツールを開く'
$btnCapGui.Location = New-Object System.Drawing.Point(16, 174)
$btnCapGui.Size     = New-Object System.Drawing.Size(180, 34)
$form.Controls.Add($btnCapGui)

New-Label -Text '接続できたら、こちらで 撮影→解析→ドライラン→D1反映 を行います。' -X 206 -Y 180 -W 430 -H 22 -Dim | Out-Null

$lblState = New-Label -Text '状態: 未接続' -X 16 -Y 218 -W 620 -H 24 -Bold
$lblState.ForeColor = [System.Drawing.Color]::DimGray

$txtLog = New-Object System.Windows.Forms.TextBox
$txtLog.Location   = New-Object System.Drawing.Point(16, 246)
$txtLog.Size       = New-Object System.Drawing.Size(608, 240)
$txtLog.Multiline  = $true
$txtLog.ScrollBars = 'Vertical'
$txtLog.ReadOnly   = $true
$txtLog.BackColor  = [System.Drawing.Color]::White
$txtLog.Font       = New-Object System.Drawing.Font('Consolas', 9)
$txtLog.Anchor     = 'Top,Left,Right,Bottom'
$form.Controls.Add($txtLog)

# 初回だけ必要なペア設定。普段は使わないので下に小さく置く。
$lblPair = New-Label -Text '初回のみ（未ペアリング時）:' -X 16 -Y 500 -W 170 -H 24 -Dim
$lblPair.Anchor = 'Left,Bottom'

$txtPairAddr = New-Object System.Windows.Forms.TextBox
$txtPairAddr.Location = New-Object System.Drawing.Point(190, 498)
$txtPairAddr.Size     = New-Object System.Drawing.Size(160, 26)
$txtPairAddr.Anchor   = 'Left,Bottom'
$form.Controls.Add($txtPairAddr)
$phPair = New-Label -Text 'ペア設定用 IP:ポート' -X 190 -Y 524 -W 160 -H 18 -Dim
$phPair.Font = New-Object System.Drawing.Font('Yu Gothic UI', 8)
$phPair.Anchor = 'Left,Bottom'

$txtPairCode = New-Object System.Windows.Forms.TextBox
$txtPairCode.Location = New-Object System.Drawing.Point(360, 498)
$txtPairCode.Size     = New-Object System.Drawing.Size(90, 26)
$txtPairCode.Anchor   = 'Left,Bottom'
$form.Controls.Add($txtPairCode)
$phCode = New-Label -Text 'PIN(6桁)' -X 360 -Y 524 -W 90 -H 18 -Dim
$phCode.Font = New-Object System.Drawing.Font('Yu Gothic UI', 8)
$phCode.Anchor = 'Left,Bottom'

$btnPair = New-Object System.Windows.Forms.Button
$btnPair.Text     = 'ペア設定'
$btnPair.Location = New-Object System.Drawing.Point(460, 497)
$btnPair.Size     = New-Object System.Drawing.Size(90, 28)
$btnPair.Anchor   = 'Left,Bottom'
$form.Controls.Add($btnPair)

# ---------------------------------------------------------------- ログ / 状態表示

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

function Set-Busy {
  param([bool]$Busy)
  foreach ($b in @($btnConnect, $btnMirror, $btnDisconnect, $btnDetect, $btnPair)) { $b.Enabled = -not $Busy }
  if ($Busy) { $form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor }
  else       { $form.Cursor = [System.Windows.Forms.Cursors]::Default }
  [System.Windows.Forms.Application]::DoEvents()
}

# ---------------------------------------------------------------- 接続

function Get-Addr {
  $ip   = $txtIp.Text.Trim()
  $port = $txtPort.Text.Trim()
  if ($ip -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { Write-Log 'IP アドレスの形式が違います（例 192.168.0.52）'; return $null }
  if ($port -notmatch '^\d{2,5}$')             { Write-Log 'ポートの形式が違います（例 33593）'; return $null }
  return "${ip}:${port}"
}

# 1回分の connect → state 確認。device になったら $true。
function Invoke-ConnectOnce {
  param([string]$Addr)
  $r = Invoke-Adb -CliArgs @('connect', $Addr) -TimeoutMs 15000
  $msg = ("$($r.Out) $($r.Err)").Trim()
  if ($msg) { Write-Log "  adb connect: $msg" }
  # connect 直後は state が確定しないことがあるので少し待って確認する。
  for ($i = 0; $i -lt 12; $i++) {
    $st = Get-DeviceState -Addr $Addr
    if ($st -eq 'device') { return $true }
    if ($st -eq 'unauthorized') { Write-Log '  端末側に「このPCを許可しますか」が出ています。許可してください。'; }
    Wait-Ui -Ms 500
  }
  return $false
}

function Connect-Phone {
  $addr = Get-Addr
  if (-not $addr) { return $false }
  if (-not $script:ADB) { Write-Log 'adb.exe が見つかりません。環境変数 ADB にフルパスを設定してください。'; Set-State '接続不可' 'ng'; return $false }

  Set-Busy $true
  Set-State '接続中...' 'busy'
  Write-Log "接続先: $addr"

  try {
    $ip   = $addr.Split(':')[0]
    $port = [int]$addr.Split(':')[1]

    # まず TCP が開いているかを見る。ここで落ちるなら「ポートが変わった」がほぼ確定なので原因を切り分けられる。
    if (-not (Test-PortOpen -IpAddress $ip -Port $port)) {
      Write-Log "  ${addr} に TCP 接続できません。"
      Write-Log '  → 端末の［ワイヤレスデバッグ］画面を開き直して、今表示されているポートを入れ直してください。'
      Write-Log '  → 画面に出ていない/繋がらない場合は、端末の Wi-Fi を OFF→ON してから再度確認。'
      Set-State 'ポートに届きません（値が古い可能性）' 'ng'
      return $false
    }
    Write-Log '  TCP 到達 OK'

    if (Invoke-ConnectOnce -Addr $addr) { return (Complete-Connect -Addr $addr) }

    # ここから offline リカバリ。手でやると毎回悩む所なので順番に自動で流す。
    Write-Log '  state が device になりません。リカバリを試します。'

    Write-Log '  [1/2] disconnect → connect'
    Invoke-Adb -CliArgs @('disconnect', $addr) -TimeoutMs 10000 | Out-Null
    Wait-Ui -Ms 1200
    if (Invoke-ConnectOnce -Addr $addr) { return (Complete-Connect -Addr $addr) }

    Write-Log '  [2/2] adb サーバ再起動 → connect'
    Invoke-Adb -CliArgs @('kill-server') -TimeoutMs 10000 | Out-Null
    Wait-Ui -Ms 1500
    Invoke-Adb -CliArgs @('start-server') -TimeoutMs 15000 | Out-Null
    Wait-Ui -Ms 800
    if (Invoke-ConnectOnce -Addr $addr) { return (Complete-Connect -Addr $addr) }

    Write-Log '  接続できませんでした。端末の Wi-Fi を OFF→ON し、ワイヤレスデバッグ画面の値を入れ直してください。'
    Set-State '接続失敗' 'ng'
    return $false
  } finally {
    Set-Busy $false
  }
}

# 接続成立後の確認と保存。
function Complete-Connect {
  param([string]$Addr)
  $sz = Invoke-Adb -CliArgs @('-s', $Addr, 'shell', 'wm', 'size') -TimeoutMs 15000
  $m  = [regex]::Match("$($sz.Out)", '(\d+)\s*x\s*(\d+)')
  if (-not $m.Success) {
    Write-Log '  接続はしましたが端末が応答しません（端末側の許可ダイアログを確認してください）'
    Set-State '応答なし' 'ng'
    return $false
  }
  $model = (Invoke-Adb -CliArgs @('-s', $Addr, 'shell', 'getprop', 'ro.product.model') -TimeoutMs 10000).Out
  Write-Log "接続完了: $Addr  $model  $($m.Groups[1].Value)x$($m.Groups[2].Value)"
  Save-Target -Serial $Addr
  Save-Prefs -IpAddress $Addr.Split(':')[0] -Port $Addr.Split(':')[1] -AutoMirror $chkAuto.Checked
  Write-Log "tools\.adb-target を更新しました（他ツールは  . tools\adb-env.ps1  で使えます）"
  Test-LinkSpeed -Addr $Addr
  Set-State "接続中  $Addr  $model" 'ok'
  return $true
}

# 「繋がったのに遅すぎて使い物にならない」を接続直後に気づくための実測。
# PNG を1枚取るのにかかる時間が、そのまま撮影・監視ツールの1判定あたりのコストになる。
function Test-LinkSpeed {
  param([string]$Addr)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $r  = Invoke-Adb -CliArgs @('-s', $Addr, 'exec-out', 'screencap', '-p') -TimeoutMs 30000
  $ms = $sw.ElapsedMilliseconds
  # Invoke-Adb は出力をテキストで受けるのでバイト数は正確ではない。ここで見たいのは所要時間だけ。
  if ($r.Code -ne 0 -and -not $r.Out) {
    Write-Log "リンク: 画面の取得に失敗しました（$($r.Err)）"
    return
  }
  if ($ms -lt 1000) {
    Write-Log "リンク: 画面1枚 ${ms}ms — 良好。撮影・監視とも問題ありません。"
  } elseif ($ms -lt 3000) {
    Write-Log "リンク: 画面1枚 ${ms}ms — やや遅い。監視は回せますがミラーリングは重く感じます。"
  } else {
    Write-Log "リンク: 画面1枚 ${ms}ms — ★遅すぎます。端末の画面をONのままにする/端末をルーターに近づけてください。"
    Write-Log "  詳しく測る:  node tools\link-check.mjs"
  }
}

# ---------------------------------------------------------------- ミラーリング

function Start-Mirror {
  $addr = Get-Addr
  if (-not $addr) { return }
  if (-not $script:SCRCPY) { Write-Log 'scrcpy.exe が見つかりません。環境変数 SCRCPY にフルパスを設定してください。'; return }

  $st = Get-DeviceState -Addr $addr
  if ($st -ne 'device') { Write-Log "ミラーリングの前に接続が必要です（現在: $st）"; return }

  Set-Busy $true
  try {
    Write-Log 'ミラーリングを起動します...'

    # タイトルに空白を入れると引数が分割されるのでハイフン区切りにしている。
    #
    # Wi-Fi 用に絞った設定。ここは 2.4GHz しか無く（5GHz の SSID なし）、ch11 の利用率が 40%前後で
    # 混んでいるため、既定のままだと遅延が実用外になる。
    #   --no-audio  … scrcpy 3.x は既定で音声も流す。帯域とバッファを食うので切る（効果が大きい）
    #   --max-fps / --video-bit-rate / --max-size … 送るデータ量そのものを削る
    # ★--turn-screen-off は使わない。画面OFFは Android の Wi-Fi 省電力を誘発し、
    #   ping が数百ms＋パケットロスという今回の症状そのものになる。
    $cliArgs = @(
      '-s', $addr,
      '--window-title', 'SNW-phone-WiFi',
      '--stay-awake',
      '--no-audio',
      '--max-fps', '15',
      '--video-bit-rate', '2M',
      '--max-size', '720'
    )
    # CreateNoWindow で起動する。コンソールを作らないだけなので scrcpy 自身のウィンドウは普通に出る。
    # 出力は非同期で汲み続ける（読まないとパイプが詰まって scrcpy が止まる）。
    $p = New-HiddenProcess -Exe $script:SCRCPY -CliArgs $cliArgs -WorkDir (Split-Path -Parent $script:SCRCPY)
    $outTask = $p.StandardOutput.ReadToEndAsync()
    $errTask = $p.StandardError.ReadToEndAsync()

    # 起動待ち: ウィンドウが出れば成功、落ちればログを出す。
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.ElapsedMilliseconds -lt 20000) {
      Wait-Ui -Ms 300
      if ($p.HasExited) {
        Write-Log 'ミラーリングが起動直後に終了しました。ログ:'
        foreach ($task in @($outTask, $errTask)) {
          $t = ''
          try { $t = $task.Result } catch {}
          if ($t) { foreach ($ln in ("$t".Trim() -split "`r?`n")) { if ($ln) { Write-Log "    $ln" } } }
        }
        Write-Log '  → ［接続］を押し直してから、もう一度ミラーリングしてください。'
        Set-State 'ミラーリング失敗' 'ng'
        return
      }
      $p.Refresh()
      if ($p.MainWindowHandle -ne [IntPtr]::Zero) {
        Write-Log "ミラーリング表示中（PID $($p.Id)）。ウィンドウを閉じると終了します。"
        Set-State "ミラーリング中  $addr" 'ok'
        return
      }
    }
    Write-Log 'ミラーリングの起動確認がタイムアウトしました（画面が出ていれば問題ありません）。'
  } finally {
    Set-Busy $false
  }
}

# ---------------------------------------------------------------- ボタン

$btnConnect.Add_Click({
  $okConn = Connect-Phone
  if ($okConn -and $chkAuto.Checked) { Start-Mirror }
})

$btnMirror.Add_Click({ Start-Mirror })

# 撮影ツール(capture-gui)を開く。
# ★必ず .vbs を経由する。powershell.exe を直に起動すると GUI の裏に Windows Terminal の窓が残り、
#   それを閉じると GUI ごと落ちる（この GUI 自身と同じ理由。wifi-gui.vbs のコメント参照）。
$btnCapGui.Add_Click({
  $vbs = Join-Path $HERE 'capture-gui.vbs'
  if (-not (Test-Path $vbs)) { Write-Log "撮影ツールが見つかりません: $vbs"; return }
  if (-not (Test-Path $TARGET_FILE)) {
    Write-Log '※ まだ接続していません。撮影ツールは開きますが、先に［接続］を済ませてください。'
  }
  try {
    [void](New-HiddenProcess -Exe (Join-Path $env:SystemRoot 'System32\wscript.exe') -CliArgs @($vbs) -WorkDir $HERE)
    Write-Log '撮影ツールを開きました。'
  } catch {
    Write-Log "撮影ツールを開けませんでした: $($_.Exception.Message)"
  }
})

$btnDisconnect.Add_Click({
  Set-Busy $true
  try {
    $addr = Get-Addr
    if ($addr) { Invoke-Adb -CliArgs @('disconnect', $addr) -TimeoutMs 10000 | Out-Null }
    else       { Invoke-Adb -CliArgs @('disconnect') -TimeoutMs 10000 | Out-Null }
    Write-Log '切断しました。'
    Set-State '未接続'
  } finally { Set-Busy $false }
})

# mDNS はこの PC では空/古い値を返すことがあるので、あくまで補助。見つかった値は欄に入れるだけ。
$btnDetect.Add_Click({
  Set-Busy $true
  try {
    Write-Log 'mDNS で探索中...（端末のワイヤレスデバッグ画面を開いたままにしてください）'
    $found = $null
    for ($i = 0; $i -lt 5; $i++) {
      $r = Invoke-Adb -CliArgs @('mdns', 'services') -TimeoutMs 10000
      foreach ($line in ("$($r.Out)" -split "`r?`n")) {
        if ($line -notmatch '_adb-tls-connect\._tcp') { continue }
        $m = [regex]::Match($line, '(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})\s*$')
        if ($m.Success) { $found = $m; break }
      }
      if ($found) { break }
      Wait-Ui -Ms 1200
    }
    if ($found) {
      $txtIp.Text   = $found.Groups[1].Value
      $txtPort.Text = $found.Groups[2].Value
      Write-Log "検出: $($found.Groups[1].Value):$($found.Groups[2].Value)  ← 古い値のこともあるので画面の表示と照合してください"
    } else {
      Write-Log '見つかりませんでした。端末の画面に出ている値を手で入れてください。'
    }
  } finally { Set-Busy $false }
})

$btnPair.Add_Click({
  Set-Busy $true
  try {
    $pa = $txtPairAddr.Text.Trim() -replace '[\-\s]', ':'
    $pc = ($txtPairCode.Text -replace '\D', '')
    if ($pa -notmatch $IPPORT_RE) { Write-Log 'ペア設定用の IP:ポート を入れてください（ペア設定ダイアログに出ている方の値）'; return }
    if ($pc.Length -ne 6)          { Write-Log 'PIN は6桁の数字です'; return }
    Write-Log "ペア設定: $pa"
    $r = Invoke-Adb -CliArgs @('pair', $pa, $pc) -TimeoutMs 30000
    $msg = ("$($r.Out) $($r.Err)").Trim()
    Write-Log "  $msg"
    if ($msg -match 'Successfully paired') {
      Write-Log 'ペア設定は初回だけです。次からは上の IP/ポートで［接続］するだけです。'
    } else {
      Write-Log '  ダイアログを開き直して新しい PIN でやり直してください（ダイアログ側のポートを使うこと）。'
    }
  } finally { Set-Busy $false }
})

# ---------------------------------------------------------------- 起動時

$form.Add_Shown({
  # ★フォームを明示的に表示する。
  #   .vbs が Run(..., 0, False) で起動するため、CreateProcess の STARTUPINFO に SW_HIDE が載る。
  #   これをプロセス内で最初に出るトップレベルウィンドウが引き継ぐと、ShowDialog を呼んでいるのに
  #   IsWindowVisible=False のまま「プロセスは生きているのに窓が出ない」状態になる。
  #   デスクトップのショートカットから起動したときは表面化しないが、既に隠れているプロセスから
  #   起動されると（例: 撮影GUIのボタン経由、スクリプトからの起動）必ず再現する。SW_SHOW で上書きする。
  [void][SnwWin.Native]::ShowWindow($form.Handle, 5)
  [void][SnwWin.Native]::SetForegroundWindow($form.Handle)

  Write-Log "adb   :$(if ($script:ADB) { $script:ADB } else { '見つかりません' })"
  Write-Log "scrcpy: $(if ($script:SCRCPY) { $script:SCRCPY } else { '見つかりません' })"

  $prefs = Get-Prefs
  if ($prefs) {
    if ($prefs.ip)   { $txtIp.Text   = $prefs.ip }
    if ($prefs.port) { $txtPort.Text = $prefs.port }
    if ($null -ne $prefs.autoMirror) { $chkAuto.Checked = [bool]$prefs.autoMirror }
  } elseif (Test-Path $TARGET_FILE) {
    try {
      $t = Get-Content $TARGET_FILE -Raw | ConvertFrom-Json
      if ("$($t.serial)" -match '^(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})$') {
        $txtIp.Text = $Matches[1]; $txtPort.Text = $Matches[2]
      }
    } catch {}
  }

  Write-Log '端末の［ワイヤレスデバッグ］画面の値を入れて［接続］を押してください。'
  $txtPort.Focus() | Out-Null
  $txtPort.SelectAll()
})

[void]$form.ShowDialog()
