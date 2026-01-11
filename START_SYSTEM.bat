@echo off
echo ====================================
echo Starting Complete PPE Safety System
echo ====================================
echo.
echo This will start:
echo  - Backend API (Port 8000)
echo  - Frontend UI (Port 5173)
echo.
echo Close this window to stop both services
echo ====================================
echo.

REM Start backend in new window
start "PPE Backend" cmd /k "python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"

REM Wait 3 seconds for backend to start
timeout /t 3 /nobreak

REM Start frontend in new window
start "PPE Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ====================================
echo System started successfully!
echo ====================================
echo.
echo Backend API: http://localhost:8000
echo API Documentation: http://localhost:8000/docs
echo Frontend UI: http://localhost:5173
echo.
echo Press any key to open frontend in browser...
pause

REM Open browser
start http://localhost:5173

echo.
echo Both services are running in separate windows.
echo Close those windows to stop the services.
echo.
pause
