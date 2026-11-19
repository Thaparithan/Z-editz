@echo off
echo ==============================================
echo   Z-editz Video Editor - Desktop Shortcut Setup
echo ==============================================
echo.
powershell -NoProfile -Command "$WshShell = New-Object -ComObject WScript.Shell; $Desktop = [Environment]::GetFolderPath('Desktop'); $Shortcut = $WshShell.CreateShortcut($Desktop + '\Z-editz.lnk'); $Shortcut.TargetPath = '%~dp0windows\win-unpacked\Z-editz.exe'; $Shortcut.WorkingDirectory = '%~dp0windows\win-unpacked'; $Shortcut.Description = 'Z-editz Professional Video Editor'; $Shortcut.Save()"
echo [SUCCESS] Shortcut created on your Desktop! You can now launch Z-editz directly from your desktop.
echo.
pause
