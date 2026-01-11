@echo off
echo ====================================
echo PPE System - Database Backup
echo ====================================
echo.

REM Create backup directory if it doesn't exist
if not exist "data\backups" mkdir data\backups

REM Get current date and time
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"

set "timestamp=%YYYY%%MM%%DD%_%HH%%Min%%Sec%"

REM Copy database
echo Creating backup: ppe_compliance_%timestamp%.db
copy data\ppe_compliance.db data\backups\ppe_compliance_%timestamp%.db

echo.
echo ====================================
echo Backup created successfully!
echo Location: data\backups\ppe_compliance_%timestamp%.db
echo ====================================
echo.
pause
