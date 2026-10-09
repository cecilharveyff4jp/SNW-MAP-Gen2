@echo off
rem ASCII only. cmd.exe reads this file with the OEM codepage (932), so UTF-8 Japanese
rem comments would corrupt the following lines and break the launcher.
start "" wscript.exe "%~dp0capture-gui.vbs"
