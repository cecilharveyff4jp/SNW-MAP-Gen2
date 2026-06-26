@echo off
REM ============================================================
REM SNW-MAP-Gen2  git 初期化スクリプト (Windows)
REM コミット作成者は Cecil 識別子に固定（このリポジトリ限定 / --global は変更しない）
REM ============================================================
cd /d "%~dp0"

REM サンドボックスが残した壊れた .git があれば削除
if exist .git rmdir /s /q .git

git init
git config user.name "cecilharveyff4jp"
git config user.email "cecil.harvey.ff4.jp@gmail.com"
git add .
git commit -m "chore: initial scaffold (Cloudflare Pages + Functions + D1)"
git branch -M main

echo.
echo === 完了。コミット作成者 ===
git config user.name
git config user.email
echo.
echo 次は GitHub で空リポジトリ SNW-MAP-Gen2 を作成し、
echo   git remote add origin ^<URL^>
echo   git push -u origin main
echo を実行してください。
pause
