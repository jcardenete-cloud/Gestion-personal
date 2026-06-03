$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath("Desktop"))
$ProjectDir = $PSScriptRoot

# Acceso directo para Arrancar
$ShortcutStart = $WshShell.CreateShortcut("$DesktopPath\Arrancar Gestion Personal.lnk")
$ShortcutStart.TargetPath = "wscript.exe"
$ShortcutStart.Arguments = "`"$ProjectDir\run_hidden.vbs`""
$ShortcutStart.WorkingDirectory = $ProjectDir
$ShortcutStart.IconLocation = "shell32.dll,247"
$ShortcutStart.Save()

# Acceso directo para Detener
$ShortcutStop = $WshShell.CreateShortcut("$DesktopPath\Detener Gestion Personal.lnk")
$ShortcutStop.TargetPath = "$ProjectDir\stop_services.bat"
$ShortcutStop.WorkingDirectory = $ProjectDir
$ShortcutStop.IconLocation = "shell32.dll,240"
$ShortcutStop.Save()

Write-Host "Accesos directos creados en el escritorio."
