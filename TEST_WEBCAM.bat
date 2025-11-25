@echo off
REM Webcam Demo - Quick Test
REM Tests the best trained model on live webcam

echo ========================================
echo WEBCAM PPE DETECTION DEMO
echo ========================================
echo.
echo Controls:
echo   - Press 'q' to quit
echo   - Press 's' to save screenshot
echo.
echo Starting in 3 seconds...
timeout /t 3

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Find latest best model
set MODEL_PATH=runs\train\ppe_progressive_chatgpt_stage2\weights\best.pt

REM If new GPU model exists, use it
if exist "runs\train\construction_gpu_v1\weights\best.pt" (
    set MODEL_PATH=runs\train\construction_gpu_v1\weights\best.pt
    echo Using new GPU-trained model
) else (
    echo Using existing model
)

echo Model: %MODEL_PATH%
echo.

REM Start webcam demo
python scripts\test_webcam.py --model %MODEL_PATH% --device 0 --conf 0.25

echo.
echo Demo stopped.
pause
