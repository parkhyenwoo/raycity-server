@echo off
chcp 949 >nul
title RaycityIN Key Server

if not exist "%~dp0node_modules" (
    echo Run install.bat first!
    pause
    exit /b 1
)

cd /d "%~dp0"
echo ========================================
echo    RaycityIN Key Server
echo ========================================
echo.
node server.js
pause
