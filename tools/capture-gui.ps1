# SNW 撮影〜反映 GUI
#
# やること: 撮影 → 切り出し → Claude で画像解析 → 検証 → ドライラン → D1へ反映 を1画面で通す。
#
# 起動: デスクトップのショートカット、または tools\capture-gui.cmd をダブルクリック
#       （中身は capture-gui.vbs 経由。理由は wifi-gui.ps1 の冒頭コメントと同じ）
#
# 工程と、それぞれ誰がやるか:
#   ① 撮影      … capture-*.mjs（adb で端末を操作）
#   ② 解析      … crop-*.mjs で読む面積を削ってから claude.exe -p に投げて JSON を書かせる
#   ③ 検証      … verify-ranking.mjs（順位1..N連続 / 総力単調減少 / 名前）
#   ④ ドライラン … apply-*.mjs（書き込まない。DBとの照合結果だけ出す）
#   ⑤ 実行      … apply-*.mjs --apply
#
# ★安全設計: ⑤の［実行］は「③が合格」かつ「④で未一致0・要確認0」でなければ押せない。
#   2026-07-28 の実測で、ヘッドレス解析は総力68件を1つも間違えなかったが、名前の装飾記号
#   （ɛʋ ୨୧ ෆ ⚔ など）を残すことがあった。装飾が残ると DB の名前と一致せず「未一致」に落ちる。
#   ＝読み違いは必ず④に現れるので、④を通過ゲートにすれば取りこぼさない。
#   （プロンプト側でも装飾を除くよう指示しているが、二重に受けている）
#
# 前提:
#   ・接続は wifi-gui.ps1 で済ませておく（tools\.adb-target を読む）。USB接続なら .adb-target が無くても動く。
#   ・node は PATH に無い前提でフルパス解決する。
#   ・claude.exe は VSCode 拡張に同梱のものを使う（拡張の更新でパスが変わるのでワイルドカードで探す）。
#
# 実測(2026-07-28): ランキング1回ぶんで 撮影40秒 / 解析84秒 / 反映数秒。解析の API 費用は約 $0.43。

# -SelfTest: 画面を出さずに「実行ファイルを見つけられたか」「工程のパスが正しいか」だけを
#            テキストに書き出す。GUI は目視でしか確かめられないので、壊れやすい所だけ外から検査できるようにしてある。
param([switch]$SelfTest, [string]$SelfTestOut)

Set-StrictMode -Off
$ErrorActionPreference = 'Continue'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# コンソールを持たない状態で動かす（.vbs から起動される）。詳細は wifi-gui.ps1 のコメント参照。
Add-Type -Namespace SnwWin2 -Name Native -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern bool FreeConsole();
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
'@
if (-not $SelfTest) { [void][SnwWin2.Native]::FreeConsole() }   # 自己診断のときは出力を残したいので外さない

$HERE        = Split-Path -Parent $MyInvocation.MyCommand.Path
$ROOT        = Split-Path -Parent $HERE
$TARGET_FILE = Join-Path $HERE '.adb-target'

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

# claude.exe は拡張に同梱されている。バージョン番号がパスに入るのでワイルドカードで拾い、
# 新しい方（名前の降順）を採る。PATH に本体を入れている環境ならそちらでもよい。
$script:CLAUDE = Resolve-First @(
  $env:CLAUDE_EXE,
  "$env:USERPROFILE\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe",
  "$env:USERPROFILE\.vscode-insiders\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe",
  "$env:LOCALAPPDATA\Programs\claude\claude.exe"
)
if (-not $script:CLAUDE) { $c = Get-Command claude -ErrorAction SilentlyContinue; if ($c) { $script:CLAUDE = $c.Source } }

# adb は接続時に wifi-gui が保存したものを使う。無ければ scrcpy 同梱を探す。
$script:ADB = $null
$script:SERIAL = $null
if (Test-Path $TARGET_FILE) {
  try {
    $t = Get-Content $TARGET_FILE -Raw -Encoding UTF8 | ConvertFrom-Json
    $script:ADB = $t.adb
    $script:SERIAL = $t.serial
  } catch {}
}
if (-not $script:ADB) {
  $script:ADB = Resolve-First @($env:ADB, 'D:\Prog\scrcpy-win64-v3.3.1\adb.exe', 'C:\Prog\scrcpy-win64-v3.3.1\adb.exe', 'D:\Prog\scrcpy\adb.exe')
}

# ---------------------------------------------------------------- プロセス実行

# Start-Process は使わない（コンソールを持たないプロセスから呼ぶと黒窓がちらつく）。wifi-gui.ps1 と同じ方針。
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
  # 子プロセス(node/claude)の出力は UTF-8。既定のままだと日本語のログが化ける。
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

# 標準出力を1行ずつログ窓に流しながら待つ。撮影は40秒、解析は90秒近くかかるので、
# 終わるまで無反応だと「固まった」に見える。行が出るたびに進捗が分かるようにする。
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
  $envVars = @{}
  if ($script:ADB)    { $envVars['ADB'] = $script:ADB }
  if ($script:SERIAL) { $envVars['ANDROID_SERIAL'] = $script:SERIAL }
  Invoke-Streaming -Exe $script:NODE -CliArgs $CliArgs -WorkDir $HERE -EnvVars $envVars -TimeoutMs $TimeoutMs -Quiet:$Quiet
}

# ---------------------------------------------------------------- ジョブ定義
#
# 撮影メニューごとに「どのツールをどの順で、どのファイルに向けて動かすか」だけをここに書く。
# ボタン側は工程を知らない＝メニューを増やしてもボタンのコードは変わらない。

# 名前の装飾に関する指示は全ジョブ共通。ここを直せば全部に効く。
$NAME_RULES = @'
名前の抽出ルール:
- 名前の左右に付く装飾記号（例: ɛʋ ୨୧ ෆ ⚔ ✧ ♡ や飾り罫）は名前の一部ではありません。除いてください。
- 名前の右上に小さく重なる称号（例: maru Love）も除いてください。
- 末尾の丸括弧つきレベル表記（例: （42））も除いてください。
- 半角カナはそのまま半角で、全角はそのまま全角で書いてください（勝手に変換しない）。
- ★装飾として除くのは記号だけです。英数字は勝手に落とさないでください。
'@

# 装飾の左右対（例「ɛʋ ○○63」の ɛʋ と 63）は、画像だけでは名前の一部かどうか決められない。
# 実測(2026-07-28): 6位「ɛʋ Lūna63」は DB 名が "Lūna"（63は装飾）、57位「ɛʋ トリちゃん63」は
# DB 名が "ﾄﾘちゃん63"（63は名前）。見た目が同じで扱いが逆なので、判断材料は画像の外にしか無い。
# → 前回の結果を読ませて、装飾の有無だけの違いなら前回の表記に寄せてもらう。
function Get-NameHint {
  param([string]$PrevPath)
  if (-not $PrevPath) { return '' }
  return @"

照合の手がかりとして、前回の結果 $($PrevPath -replace '\\', '/') も Read してください。
読み取った名前が前回の一覧のどれかと「装飾記号や飾り数字の有無だけ」の違いなら、前回の表記をそのまま使ってください
（DBにはその表記で登録されているため）。まったく別の名前になっている場合は改名なので、読んだままにしてください。
"@
}

# 改名は「前回一覧から消えた名前」＋「知らない名前」の対で現れる。gameId を足しておかないと
# apply-ranking.mjs が名前一致に落ちて「未一致＝新規候補」になり、--create-new で二重登録になる
# （lib-norm.mjs の matchRanking は via=="gameid" のときだけ label を書き換える）。
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

function Get-JobSpec {
  param([string]$Key, [string]$Stamp)

  switch ($Key) {

    'ranking' {
      $dir = Join-Path $HERE "shots\rank-$Stamp"
      $out = Join-Path $HERE "ranking-$Stamp.json"
      return [pscustomobject]@{
        Key = $Key; Title = '同盟ランキング'; Dir = $dir; OutJson = $out
        Hint = '端末で［同盟］→［ランキング］→［総力ランキング］を一番上まで出しておいてください。'
        CaptureArgs = @('capture-ranking.mjs', '--out', $dir, '--count', '45')
        CropSteps   = @(, @('crop-rank.mjs', '--in', $dir))
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

    'ids' {
      $dir = Join-Path $HERE "ids-$Stamp"
      $out = Join-Path $HERE "ranking-ids-$Stamp.json"
      return [pscustomobject]@{
        Key = $Key; Title = 'クローズドループID'; Dir = $dir; OutJson = $out
        Hint = '総力ランキングを一番上まで出しておいてください。各行をタップして領主ファイルを撮ります（自動）。'
        CaptureArgs = @('capture-ids.mjs', '--from-ranking', (Join-Path $HERE 'ranking.json'), '--out', $dir)
        CropSteps   = @(, @('crop-ids.mjs', '--in', $dir, '--out', (Join-Path $dir 'sheets')))
        SheetDirs   = @((Join-Path $dir 'sheets'))
        Prompt = @"
$(Join-Path $dir 'sheets') にある sheet_*.png を番号順にすべて Read して、領主ファイルの情報を抽出してください。
各パネルに「名前・ゲームID・総力・炉/FCレベル」が載っています。

- 同じ人が複数回写っていることがあります。ゲームIDで名寄せして1件にしてください。
- ゲームIDは数字だけにしてください（ID: などの接頭辞は含めない）。
- 総力は丸められた表示（例 644.8M）のことがあります。その場合は power を書かないでください（ランキング側の正確な値を使うため）。
- 炉/FCレベルは画面表記のまま文字列で（"25" や "FC8"）。読めなければ書かないでください。

$NAME_RULES

結果を次のパスに JSON 配列だけで Write してください（説明文やコードフェンスは入れない）:
  $($out -replace '\\', '/')
形式: [{"name":"...","gameId":"463123560","fcLevel":"FC8"}, ...]
最後に「N件」とだけ答えてください。
"@
        VerifyArgs = $null
        DryArgs    = @('apply-ranking.mjs', '--ranking', $out)
        ApplyArgs  = @('apply-ranking.mjs', '--ranking', $out, '--apply')
        GateNg     = @('unmatched=(\d+)', 'fuzzy=(\d+)')
        CopyTo     = $null
      }
    }

    'cards' {
      $dir = Join-Path $HERE "cards\cap-$Stamp"
      $out = Join-Path $HERE "cards-$Stamp.json"
      return [pscustomobject]@{
        Key = $Key; Title = '都市カード'; Dir = $dir; OutJson = $out
        Hint = '郊外マップを開き、都市を1つずつタップしてください。カードが出るたびに自動で1枚保存します。終わったら［停止］。'
        CaptureArgs = @('capture-cards.mjs', '--out', $dir)
        CropSteps   = @(, @('crop-cards.mjs', '--in', $dir, '--out', (Join-Path $dir 'sheets')))
        SheetDirs   = @((Join-Path $dir 'sheets'))
        Watch = $true
        Prompt = @"
$(Join-Path $dir 'sheets') にある sheet_*.png を番号順にすべて Read して、都市カードの情報を抽出してください。
各カードに「名前・座標(X/Y)・戦闘力(総力)」が載っています。

- X と Y は整数です。どちらか読めないカードは行ごと出さないでください（座標が無いと使えないため）。
- 総力はカンマを除いた整数にしてください。
- 同じ都市が複数回写っていることがあります。名前と座標が同じなら1件にまとめてください。
  名前が同じで座標が違う場合は、読み違いの可能性があるので両方残してください。

$NAME_RULES

結果を次のパスに JSON 配列だけで Write してください（説明文やコードフェンスは入れない）:
  $($out -replace '\\', '/')
形式: [{"name":"...","x":551,"y":443,"power":123456789}, ...]
最後に「N件」とだけ答えてください。
"@
        VerifyArgs = $null
        DryArgs    = @('apply-cards.mjs', '--cards', $out)
        ApplyArgs  = @('apply-cards.mjs', '--cards', $out, '--apply')
        GateNg     = @('未一致=(\d+)', '要確認=(\d+)')
        CopyTo     = $null
      }
    }

    'all' {
      $dir = Join-Path $HERE "cap-$Stamp"
      $out = Join-Path $HERE "ranking-all-$Stamp.json"
      return [pscustomobject]@{
        Key = $Key; Title = '全部入り（ランキング＋ID）'; Dir = $dir; OutJson = $out
        Hint = '総力ランキングを開いておいてください。ランキング撮影→最上段へ復帰→各行タップでID取得まで自動で通します。'
        CaptureArgs = @('capture-all.mjs', '--out', $dir)
        CropSteps   = @(
          @('crop-rank.mjs', '--in', $dir, '--out', (Join-Path $dir 'sheets-rank')),
          @('crop-ids.mjs',  '--in', $dir, '--out', (Join-Path $dir 'sheets-ids'))
        )
        SheetDirs   = @((Join-Path $dir 'sheets-rank'), (Join-Path $dir 'sheets-ids'))
        Prompt = @"
2種類のシートを読んで、1つの表にまとめてください。

(A) $(Join-Path $dir 'sheets-rank') の sheet_*.png … 総力ランキング。「順位バッジ｜名前｜総力」。
(B) $(Join-Path $dir 'sheets-ids')  の sheet_*.png … 領主ファイル。「名前・ゲームID・炉/FCレベル」。

- 両方を番号順にすべて Read してください。
- (A) は順位で名寄せ、(B) はゲームIDで名寄せして、それぞれ重複を1件にしてください。
- (A) と (B) を名前で突き合わせ、1人1件にまとめてください。(B) に無い人は gameId を書かないでください。
- 総力は必ず (A) の値を使ってください（(B) の総力は丸められているため）。
- 書く前に、順位が 1..N で連続している（欠番も重複も無い）ことを必ず確認してください。

$NAME_RULES
$(Get-NameHint -PrevPath (Get-PrevRanking -Exclude $out))

結果を次のパスに JSON 配列だけで Write してください（説明文やコードフェンスは入れない）:
  $($out -replace '\\', '/')
形式: [{"rank":1,"name":"...","power":123456789,"gameId":"463123560","fcLevel":"FC8"}, ...]
最後に「N件」とだけ答えてください。
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

# 検証の「前回ぶん」。今回のファイルを除いた ranking-*.json のうち一番新しいものを使う。
function Get-PrevRanking {
  param([string]$Exclude)
  $cands = Get-ChildItem -Path $HERE -Filter 'ranking-*.json' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -ne $Exclude -and $_.Name -notmatch 'ranking-(ids|sample)' } |
    Sort-Object LastWriteTime -Descending
  if ($cands) { return $cands[0].FullName }
  return $null
}

# ---------------------------------------------------------------- 画面

$form               = New-Object System.Windows.Forms.Form
$form.Text          = 'SNW 撮影〜反映'
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
[void]$cmbJob.Items.Add('クローズドループID')
[void]$cmbJob.Items.Add('都市カード')
[void]$cmbJob.Items.Add('全部入り（ランキング＋ID）')
$cmbJob.SelectedIndex = 0
$form.Controls.Add($cmbJob)
$JOB_KEYS = @('ranking', 'ids', 'cards', 'all')

$lblHint = New-Label -Text '' -X 288 -Y 44 -W 540 -H 22 -Dim
$lblHint.Anchor = 'Top,Left,Right'

# 工程ボタン。押せる/押せないで「今どこに居るか」を示す。
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

# 解析だけを人（チャットの Claude Code）に任せるモード。
# なぜ要るか: 総力の数値はヘッドレスでも正確だが、名前は画像だけでは決められないことがある。
#   実測(2026-07-28〜29): 「ɛʋ ○○63」の 63 は Lūna では装飾・トリちゃん63 では名前の一部、
#   「へ(ひらがな)」と「ヘ(カタカナ)」は字形がほぼ同一。どちらも “DBに何と登録されているか” を
#   見ないと決まらない。チャットなら DB や前回値と突き合わせながら読めるので、そこで吸収できる。
$chkChat = New-Object System.Windows.Forms.CheckBox
$chkChat.Text     = '解析はチャットでやる'
$chkChat.Location = New-Object System.Drawing.Point(176, 134)
$chkChat.Size     = New-Object System.Drawing.Size(180, 24)
# 既定ON。名前の表記はDBを見ないと決められない場面があり、チャット側で読むほうが確実だと
# 実運用で確認したため（2026-07-29）。ヘッドレスに戻したいときだけチェックを外す。
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

$script:Spec     = $null   # 現在のジョブ（撮影を始めた時点で確定する）
$script:Captured = $false
$script:Analyzed = $false
$script:DryOk    = $false
$script:Busy     = $false

function Update-Buttons {
  $idle = -not $script:Busy
  $btnCapture.Enabled = $idle
  $btnRunAll.Enabled  = $idle
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

# ---------------------------------------------------------------- ① 撮影

function Invoke-Capture {
  $key   = Get-SelectedKey
  $stamp = (Get-Date).ToString('yyyyMMdd-HHmm')
  $spec  = Get-JobSpec -Key $key -Stamp $stamp
  if (-not $spec) { Write-Log 'ジョブ定義が見つかりません'; return $false }

  if (-not $script:NODE) { Write-Log 'node.exe が見つかりません（環境変数 NODE_EXE で指定できます）'; Set-State 'node なし' 'ng'; return $false }
  if (-not $script:ADB)  { Write-Log 'adb.exe が見つかりません。先に Wi-Fi 接続ツールで接続してください。'; Set-State 'adb なし' 'ng'; return $false }

  $script:Spec = $spec
  $script:Captured = $false; $script:Analyzed = $false; $script:DryOk = $false
  Update-Buttons

  Write-Log ('=' * 60)
  Write-Log "① 撮影: $($spec.Title)"
  Write-Log "  出力先: $($spec.Dir)"
  if ($spec.Watch) { Write-Log '  ※ このモードは自分では終わりません。撮り終えたら［停止］を押してください。' }
  Set-State "撮影中… $($spec.Title)" 'busy'

  # ★$args という名前は使わない（PowerShell の自動変数と衝突する）。
  $capArgs = @()
  $capArgs += $spec.CaptureArgs
  if ($script:SERIAL) { $capArgs += @('--serial', $script:SERIAL) }
  $r = Invoke-Node -CliArgs $capArgs

  # ウォッチ型は［停止］で終わらせるので、Kill 由来の終了コードは失敗扱いにしない。
  $ok = ($r.Code -eq 0) -or ($spec.Watch -and (Test-Path $spec.Dir))
  if (-not $ok) { Write-Log '  撮影に失敗しました。'; Set-State '撮影失敗' 'ng'; return $false }

  $shots = @(Get-ChildItem -Path $spec.Dir -Filter '*.png' -ErrorAction SilentlyContinue)
  if ($shots.Count -eq 0) { Write-Log '  画像が1枚もありません。'; Set-State '撮影失敗（0枚）' 'ng'; return $false }

  Write-Log "  撮影 $($shots.Count) 枚"
  $script:Captured = $true
  Set-State "撮影完了 $($shots.Count)枚 → ② 解析へ" 'ok'
  return $true
}

# ---------------------------------------------------------------- ② 解析（切り出し → Claude → 検証）

function Invoke-Analyze {
  $spec = $script:Spec
  if (-not $spec) { Write-Log '先に撮影してください。'; return $false }
  if (-not $script:CLAUDE) { Write-Log 'claude.exe が見つかりません（環境変数 CLAUDE_EXE で指定できます）'; Set-State 'claude なし' 'ng'; return $false }

  $script:Analyzed = $false; $script:DryOk = $false
  Update-Buttons

  # --- 切り出し: 読ませる面積を減らす。ここを飛ばすと解析が数倍遅く・高くなる。
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
    # --- チャットに任せる: お題をクリップボードに入れて、JSON が置かれるのを待つだけ。
    Write-Log '② 解析 [2/3] チャットで読み取り'
    try {
      [System.Windows.Forms.Clipboard]::SetText($spec.Prompt)
      Write-Log '  お題をクリップボードにコピーしました。Claude Code のチャットに貼り付けてください。'
    } catch {
      # クリップボードは他アプリが掴んでいると失敗する。その時は手で伝えられるようにログへ出す。
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
    # --- Claude(ヘッドレス): 画像を読ませて JSON を書かせる。
    #     ★--allowedTools を明示的に渡すこと。このワークスペースは trust されていないため
    #       .claude\settings.json の permissions は無視される（-p 実行時に警告が出る）。
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

  # --- 検証: 順位が連続しているか等。ここが赤なら以降に進ませない。
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
  } else {
    # 順位を持たないデータ（ID/カード）は連続性の検査ができない。件数だけ確認して、
    # 実際の妥当性はドライランの照合結果（未一致・要確認）で見る。
    try {
      $rows = Get-Content $spec.OutJson -Raw -Encoding UTF8 | ConvertFrom-Json
      Write-Log "  $(@($rows).Count) 件（順位が無い形式なので、妥当性は③のドライランで見ます）"
    } catch {
      Write-Log "  JSON として読めません: $($_.Exception.Message)"
      Set-State '解析失敗' 'ng'
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

  # 通過ゲート: 未一致・要確認が1件でもあれば実行させない。
  # 名前の読み違い（装飾記号の残り等）はここに必ず現れるので、これが最後の砦になる。
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
  $script:DryOk = $false   # 二重反映の防止（もう一度やるならドライランからやり直す）
  return $true
}

# ---------------------------------------------------------------- ボタン

$cmbJob.Add_SelectedIndexChanged({
  $spec = Get-JobSpec -Key (Get-SelectedKey) -Stamp 'x'
  if ($spec) { $lblHint.Text = $spec.Hint }
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

# 通し実行。④だけは必ず人が押す。
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
  # ★フォームを明示的に表示する。
  #   このスクリプトは .vbs から SW_HIDE（Run(...,0,False)）で起動される。CreateProcess の
  #   STARTUPINFO に載った SW_HIDE を、プロセス内で最初に出るトップレベルウィンドウが
  #   引き継いでしまうため、ShowDialog を呼んでいるのに IsWindowVisible=False のまま
  #   「プロセスは生きているが窓が出ない」状態になる（実測 2026-07-28）。
  #   ここで SW_SHOW(5) を明示すれば継承を上書きできる。
  [void][SnwWin2.Native]::ShowWindow($form.Handle, 5)
  [void][SnwWin2.Native]::SetForegroundWindow($form.Handle)

  Write-Log "node  :$(if ($script:NODE)   { $script:NODE }   else { '見つかりません' })"
  Write-Log "adb   : $(if ($script:ADB)    { $script:ADB }    else { '見つかりません（先に Wi-Fi 接続ツールで接続してください）' })"
  Write-Log "claude: $(if ($script:CLAUDE) { $script:CLAUDE } else { '見つかりません' })"
  if ($script:SERIAL) { Write-Log "端末  : $script:SERIAL" }

  $spec = Get-JobSpec -Key (Get-SelectedKey) -Stamp 'x'
  if ($spec) { $lblHint.Text = $spec.Hint }
  Update-Buttons
  Write-Log '端末側の画面を用意してから［① 撮影］を押してください。'
})

if ($SelfTest) {
  $rep = New-Object System.Collections.ArrayList
  [void]$rep.Add("node   = $script:NODE")
  [void]$rep.Add("adb    = $script:ADB")
  [void]$rep.Add("serial = $script:SERIAL")
  [void]$rep.Add("claude = $script:CLAUDE")
  foreach ($k in $JOB_KEYS) {
    $s = Get-JobSpec -Key $k -Stamp 'TEST'
    [void]$rep.Add("--- $k : $($s.Title)")
    [void]$rep.Add("    dir     = $($s.Dir)")
    [void]$rep.Add("    out     = $($s.OutJson)")
    [void]$rep.Add("    capture = $($s.CaptureArgs -join ' ')")
    foreach ($c in $s.CropSteps) { [void]$rep.Add("    crop    = $($c -join ' ')") }
    [void]$rep.Add("    dry     = $($s.DryArgs -join ' ')")
    [void]$rep.Add("    apply   = $($s.ApplyArgs -join ' ')")
    [void]$rep.Add("    gate    = $($s.GateNg -join ' , ')")
    [void]$rep.Add("    prompt  = $(($s.Prompt -split "`n").Count) 行")
    # ツール本体が実在するか（ジョブ定義のタイプミスはここで落とす）
    foreach ($a in @($s.CaptureArgs[0]) + @($s.CropSteps | ForEach-Object { $_[0] }) + @($s.DryArgs[0])) {
      if (-not (Test-Path (Join-Path $HERE $a))) { [void]$rep.Add("    ★ 見つかりません: $a") }
    }
  }
  # 出力を1行ずつ汲みながら待つ所（Invoke-Streaming）は、失敗すると GUI ごと固まる＝目視でも原因が分からない。
  # 実物をそのまま短いコマンドで回して、行が取れること・ちゃんと終わることを確かめる。
  [void]$rep.Add('--- streaming')
  $t0 = [System.Diagnostics.Stopwatch]::StartNew()
  $sr = Invoke-Node -CliArgs @('-e', "for(let i=1;i<=5;i++)console.log('line '+i);console.error('to stderr');") -TimeoutMs 30000
  [void]$rep.Add("    exit=$($sr.Code)  lines=$(@($sr.Text -split "`n").Count)  $([int]$t0.ElapsedMilliseconds)ms")
  if ($sr.Code -ne 0 -or $sr.Text -notmatch 'line 5') { [void]$rep.Add('    ★ ストリーミングが正しく動いていません') }
  $t1 = [System.Diagnostics.Stopwatch]::StartNew()
  $tr = Invoke-Node -CliArgs @('-e', "setTimeout(()=>{},60000);") -TimeoutMs 3000
  [void]$rep.Add("    timeout: exit=$($tr.Code)  $([int]$t1.ElapsedMilliseconds)ms（3秒で打ち切れていればOK）")

  $text = ($rep -join "`r`n")
  if ($SelfTestOut) { $text | Out-File -FilePath $SelfTestOut -Encoding utf8 } else { Write-Output $text }
  return
}

[void]$form.ShowDialog()
