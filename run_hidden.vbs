Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
ScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run chr(34) & ScriptDir & "\start_services.bat" & Chr(34), 0
Set WshShell = Nothing
Set FSO = Nothing
