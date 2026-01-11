@echo off
echo ====================================
echo PPE System - Install Dependencies
echo ====================================
echo.
echo This will install:
echo  - Backend Python packages
echo  - Frontend Node packages
echo.
echo ====================================
echo.

echo [1/4] Creating Python virtual environment...
python -m venv venv

echo.
echo [2/4] Installing Python dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt

echo.
echo [3/4] Installing Node.js dependencies...
cd frontend
call npm install

cd ..

echo.
echo ====================================
echo All dependencies installed!
echo ====================================
echo.
echo Next steps:
echo  1. Run SETUP_DATABASE.bat to initialize database
echo  2. Run START_SYSTEM.bat to start the application
echo.
pause
