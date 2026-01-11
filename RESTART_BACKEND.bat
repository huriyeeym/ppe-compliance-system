@echo off
echo ====================================
echo Restarting Backend Server
echo ====================================
echo.

REM Kill existing backend process
echo Stopping existing backend process...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do taskkill /F /PID %%a 2>NUL

echo.
echo Starting backend server...
echo.

REM Activate virtual environment and start backend
call venv\Scripts\activate.bat
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

pause
