@echo off
echo ====================================
echo PPE System - Database Setup
echo ====================================
echo.
echo This will:
echo  1. Create database schema
echo  2. Add sample domains and cameras
echo  3. Initialize email notification system
echo.
echo ====================================

REM Run database initialization
python init_database.py

echo.
echo ====================================
echo Database setup complete!
echo ====================================
echo.
pause
