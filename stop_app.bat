@echo off
title Stop RoboKinematics 3D Visualizer
color 0C
echo ================================================================
echo           DUNG TIEN TRINH ROBOKINEMATICS 3D (PORT 5173)
echo ================================================================
echo.
echo Dang kiem tra va giai phong port 5173...

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; if ($proc) { Write-Host ('[Dang dong] PID: ' + $proc.Id + ' (' + $proc.ProcessName + ')'); Stop-Process -Id $proc.Id -Force } }"

echo.
echo [Hoan tat] Da giai phong toan bo port 5173.
echo Khong con tien trinh nao chay ngam chiem CPU/RAM!
echo.
pause
