# 使い方（ドットソースで読み込む）:  . tools\adb-env.ps1
# connect-wifi.mjs が保存した接続先を、このターミナルの環境変数に入れる。
#   $env:ADB            … adb.exe のフルパス（PATH に無いので必須）
#   $env:ANDROID_SERIAL … adb が -s 未指定のときに使うシリアル。
#                         これで capture-*.mjs を1行も変えずに Wi-Fi 端末を掴ませる。

$targetFile = Join-Path $PSScriptRoot ".adb-target"
if (-not (Test-Path $targetFile)) {
  Write-Host "tools\.adb-target がありません。先に接続してください:" -ForegroundColor Yellow
  Write-Host "  node tools\connect-wifi.mjs --auto   （初回は引数なしで対話実行）"
  return
}

$t = Get-Content $targetFile -Raw | ConvertFrom-Json
$env:ADB = $t.adb
$env:ANDROID_SERIAL = $t.serial

Write-Host "ADB            = $env:ADB" -ForegroundColor DarkGray
Write-Host "ANDROID_SERIAL = $env:ANDROID_SERIAL" -ForegroundColor Green

$state = (& $env:ADB -s $env:ANDROID_SERIAL get-state) 2>$null
if ($state -eq "device") {
  Write-Host "接続OK" -ForegroundColor Green
} else {
  Write-Host "未接続です。再接続してください: node tools\connect-wifi.mjs --auto" -ForegroundColor Yellow
}
