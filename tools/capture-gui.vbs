' SNW capture GUI launcher (no console at all).
'
' ASCII ONLY. wscript reads this with the OEM codepage (932); UTF-8 Japanese bytes here
' corrupt the following lines and the script dies with 800A0005 at the Run line.
'
' Keep the PowerShell switches identical to wifi-gui.vbs: -STA -WindowStyle Hidden.
' Run(..., 0, False) starts PowerShell with SW_HIDE from the beginning, so no console
' window is ever created (hiding it afterwards does not work on Windows 11).
Dim sh, here, ps
Set sh = CreateObject("WScript.Shell")
here = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
ps = "powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File """ & here & "capture-gui.ps1"""
sh.Run ps, 0, False
