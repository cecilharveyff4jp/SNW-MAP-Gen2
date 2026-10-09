@echo off
rem SNW phone Wi-Fi connect GUI launcher. Double-click this file (or the desktop shortcut).
rem
rem ASCII ONLY. cmd.exe reads .cmd in the OEM code page (932), so UTF-8 Japanese in a
rem comment gets mis-decoded and breaks the following line. That -- not any window flag --
rem was the real cause of "double-click does nothing, a window flashes and closes".
rem
rem Launch goes through wifi-gui.vbs so that no console window is ever created.
rem On Windows 11 the default console host is Windows Terminal: starting powershell.exe
rem directly leaves a Terminal window behind the GUI, and closing it kills the GUI.
rem Neither -WindowStyle Hidden nor FreeConsole() removes that window, because it belongs
rem to WindowsTerminal.exe. WScript's Run(..., 0, False) never creates one.
start "" wscript.exe "%~dp0wifi-gui.vbs"
