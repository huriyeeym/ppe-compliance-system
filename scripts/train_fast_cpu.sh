#!/bin/bash
# CPU için optimize edilmiş hızlı eğitim scripti
# Kullanım: bash scripts/train_fast_cpu.sh

echo "🚀 CPU Hızlı Eğitim Başlatılıyor..."
echo ""

python scripts/train_model.py \
    --data data/datasets/construction_subset/dataset.yaml \
    --device cpu \
    --name ppe_cpu_fast \
    --epochs 30 \
    --patience 15 \
    --batch 8 \
    --imgsz 416 \
    --workers 4

echo ""
echo "✅ Eğitim tamamlandı!"

