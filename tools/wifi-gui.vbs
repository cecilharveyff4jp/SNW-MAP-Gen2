' SNW phone Wi-Fi connect GUI launcher (no console at all).
'
' ASCII ONLY, like the .cmd files here.
'
' Why this exists: launching wifi-gui.ps1 from a shortcut leaves a Windows Terminal
' window behind the GUI on Windows 11, and closing that window kills the GUI.
' Neither -WindowStyle Hidden nor FreeConsole() removes it, because the window belongs
' to WindowsTerminal.exe, not to our process. Run(..., 0, False) starts PowerShell with
' SW_HIDE from the very beginning, so no console window is ever created.
Dim sh, here
Set sh = CreateObject("WScript.Shell")
here = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File """ & here & "wifi-gui.ps1""", 0, False
