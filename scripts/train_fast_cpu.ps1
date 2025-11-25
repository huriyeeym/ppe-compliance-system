# CPU için optimize edilmiş hızlı eğitim scripti (PowerShell)
# Kullanım: .\scripts\train_fast_cpu.ps1

Write-Host "🚀 CPU Hızlı Eğitim Başlatılıyor..." -ForegroundColor Green
Write-Host ""

# Virtual environment'ı aktif et
& "venv\Scripts\Activate.ps1"

# Eğitimi başlat
python scripts/train_model.py `
    --data data/datasets/construction_subset/dataset.yaml `
    --device cpu `
    --name ppe_cpu_fast `
    --epochs 30 `
    --patience 15 `
    --batch 8 `
    --imgsz 416 `
    --workers 4

Write-Host ""
Write-Host "✅ Eğitim tamamlandı!" -ForegroundColor Green

