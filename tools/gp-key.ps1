# send keys to the game window via keybd_event with scan codes. -Text types digits; -Keys sends named keys (BS,ENTER,ESC) comma separated
param([string]$Text = "", [string]$Keys = "")
Add-Type @'
using System; using System.Runtime.InteropServices;
public class GK {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern uint MapVirtualKey(uint c, uint t);
 [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, IntPtr e);
 public static void Tap(byte vk){ byte sc=(byte)MapVirtualKey(vk,0); keybd_event(vk,sc,0,IntPtr.Zero); System.Threading.Thread.Sleep(40); keybd_event(vk,sc,2,IntPtr.Zero); System.Threading.Thread.Sleep(80);} }
'@
$p = Get-Process crosvm | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | Select-Object -First 1
[void][GK]::SetForegroundWindow($p.MainWindowHandle); Start-Sleep -m 300
$map = @{ BS = 0x08; ENTER = 0x0D; ESC = 0x1B }
foreach ($k in ($Keys -split ',' | Where-Object { $_ })) { [GK]::Tap([byte]$map[$k]) }
foreach ($c in $Text.ToCharArray()) { [GK]::Tap([byte][char]$c) }
