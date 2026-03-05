@echo off
chcp 65001 >nul
echo ====================================
echo PPE Compliance System - Frontend
echo ====================================
cd /d "%~dp0"

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

:: Navigate to frontend directory
cd frontend

echo.
echo [1/2] Checking dependencies...

:: Install dependencies if node_modules doesn't exist or package.json is newer
if not exist "node_modules" (
    echo Installing npm packages...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install npm packages!
        pause
        exit /b 1
    )
    echo Dependencies installed successfully.
) else (
    echo Dependencies found.
)

echo.
echo [2/2] Starting development server...
echo.
echo ====================================
echo Frontend URL: http://localhost:5173
echo ====================================
echo.
echo Press Ctrl+C to stop the server.
echo.

call npm run dev
