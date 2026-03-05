@echo off
chcp 65001 >nul
echo ====================================
echo PPE Compliance System - Backend
echo ====================================
cd /d "%~dp0"

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.10+ from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo.
echo [1/3] Checking Python virtual environment...

:: Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment!
        pause
        exit /b 1
    )
    echo Virtual environment created successfully.
) else (
    echo Virtual environment found.
)

:: Activate virtual environment
echo.
echo [2/3] Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment!
    pause
    exit /b 1
)

:: Install/update dependencies
echo.
echo [3/3] Installing/updating dependencies...
pip install -r backend\requirements.txt --quiet
if errorlevel 1 (
    echo [WARNING] Some dependencies may have failed to install.
    echo Attempting to continue...
)

:: Set Python path
set PYTHONPATH=%CD%

echo.
echo ====================================
echo Starting FastAPI server...
echo ====================================
echo.
echo Backend URL: http://localhost:8000
echo Swagger UI:  http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the server.
echo.

python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

:: Deactivate virtual environment on exit
call venv\Scripts\deactivate.bat 2>nul
