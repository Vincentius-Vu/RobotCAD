@echo off
title RoboKinematics 3D Visualizer
color 0B
echo ================================================================
echo           ROBOKINEMATICS 3D SIMULATOR - LAUNCHER
echo ================================================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [Thong bao] Phat hien lan dau khoi chay, dang cai dat thu vien...
    call npm install
)

echo.
echo [1/2] Dang khoi dong Web Server tai cong 5173...
echo [2/2] Tu dong mo trinh duyet den http://localhost:5173 ...
echo.
echo ================================================================
echo   [HUONG DAN DUNG]:
echo   - Khi can dung phan mem: chi can DONG CUA SO NAY hoac an Ctrl + C.
echo   - Khong co tien trinh chay ngam sau khi dong.
echo ================================================================
echo.

call npx vite --port 5173 --open

pause
