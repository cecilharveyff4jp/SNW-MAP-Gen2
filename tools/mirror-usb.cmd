@echo off
rem Mirror the phone over USB. Use this when the desktop scrcpy shortcut closes
rem instantly and you want to read the error.
rem
rem ASCII ONLY. cmd.exe reads .cmd in the OEM code page (932); UTF-8 Japanese in a
rem comment gets mis-decoded and breaks the following line.
rem
rem Why "-d": scrcpy refuses to start when adb lists more than one transport.
rem A stale "192.168.0.x:port  offline" entry from a previous Wi-Fi session is
rem enough to break it. "-d" forces the USB device, and "adb disconnect" below
rem drops the leftovers.

setlocal
if "%ADB%"=="" set "ADB=D:\Prog\scrcpy-win64-v3.3.1\adb.exe"
if "%SCRCPY%"=="" set "SCRCPY=D:\Prog\scrcpy-win64-v3.3.1\scrcpy.exe"

echo [1/3] dropping stale Wi-Fi transports...
"%ADB%" disconnect >nul 2>&1

echo [2/3] adb devices:
"%ADB%" devices

echo [3/3] starting scrcpy on the USB device...
"%SCRCPY%" -d --stay-awake %*
set "RC=%errorlevel%"

if not "%RC%"=="0" (
  echo.
  echo scrcpy exited with code %RC%.
  echo   - "Could not find ADB device"  : USB cable / "Allow USB debugging" on the phone
  echo   - "Multiple ADB devices"       : run this file again, it clears them first
  echo.
  pause
)
endlocal
