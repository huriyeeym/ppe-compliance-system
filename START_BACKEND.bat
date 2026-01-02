@echo off
echo ========================================
echo PPE Detection Backend Starter
echo ========================================
echo.

echo [1/4] Killing old backend processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000.*LISTENING 2^>nul') do (
    echo Killing process %%a...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo [2/4] Clearing Python cache...
for /d /r backend %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d" >nul 2>&1
del /s /q backend\*.pyc >nul 2>&1

echo [3/4] Starting backend with smart recording...
echo.
echo IMPORTANT: The backend will now start with:
echo   - Person tracking enabled (ByteTrack)
echo   - Smart violation recording
echo   - Adaptive recording intervals
echo.
echo Backend will be available at: http://localhost:8000
echo API documentation: http://localhost:8000/docs
echo.
echo Press CTRL+C to stop the backend
echo.

echo [4/4] Starting uvicorn...
cd /d %~dp0
call venv\Scripts\activate.bat
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

pause
