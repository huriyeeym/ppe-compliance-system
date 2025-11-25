@echo off
REM GPU-Optimized Training - Quick Start
REM This will train for ~1-2 hours on RTX 3050
REM Target: mAP@0.5 > 0.80

echo ========================================
echo GPU-OPTIMIZED TRAINING - CONSTRUCTION PPE
echo ========================================
echo.
echo Model: YOLOv8m (better accuracy)
echo Dataset: construction_final (2590 train + 704 val)
echo Target: mAP@0.5 ^> 0.80
echo Estimated time: 1-2 hours
echo.
echo Press Ctrl+C to cancel, or any key to start...
pause

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Start training
python scripts\train_gpu_optimized.py --data data\datasets\construction_final\dataset.yaml --model yolov8m.pt --epochs 100 --batch 16 --imgsz 640 --patience 15 --name construction_gpu_v1

echo.
echo ========================================
echo TRAINING COMPLETED!
echo ========================================
echo.
echo Next: Test on webcam with test_webcam.py
echo.
pause
