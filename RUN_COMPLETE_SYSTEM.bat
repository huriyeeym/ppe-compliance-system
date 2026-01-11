@echo off
echo ====================================
echo PPE Safety System - Complete Setup
echo ====================================
echo.
echo This script will:
echo  1. Check if backend is running
echo  2. Start backend if needed
echo  3. Start frontend
echo  4. Open browser
echo.
echo ====================================
echo.

REM Check if backend is already running
echo Checking if backend is running on port 8000...
netstat -ano | findstr ":8000.*LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Backend is already running
) else (
    echo [INFO] Backend not running, starting now...
    start "PPE Backend" cmd /k "call venv\Scripts\activate.bat && python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"

    echo Waiting 5 seconds for backend to initialize...
    timeout /t 5 /nobreak
)

echo.
echo Starting frontend...
start "PPE Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Waiting 3 seconds for frontend to start...
timeout /t 3 /nobreak

echo.
echo ====================================
echo System is running!
echo ====================================
echo.
echo Backend: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo Frontend: http://localhost:5173
echo.

echo Opening frontend in browser...
start http://localhost:5173

echo.
echo Both services are running in separate windows.
echo Close those windows to stop the services.
echo.
pause
