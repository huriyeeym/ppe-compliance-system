# 📊 Dataset Directory

**İnşaat Odaklı Model Eğitimi için Veri Setleri**

---

## 📁 Dizin Yapısı

```
data/datasets/
├── construction/          # İnşaat odaklı veri seti (HEDEF)
│   ├── images/
│   │   ├── train/        # ~10,000 görüntü
│   │   └── val/          # ~2,000 görüntü
│   ├── labels/
│   │   ├── train/
│   │   └── val/
│   └── dataset.yaml      # YOLOv8 config
├── shel5k/               # SHEL5K orijinal veri seti
├── sh17/                 # SH17 orijinal veri seti
└── custom/               # Kendi test verileriniz
    └── reflektor_yelek_kask/
```

---

## 🎯 İnşaat Domain Sınıfları

**Sadece 3 sınıf:**
1. **person** - Kişi
2. **hard_hat** - Baret/Kask
3. **safety_vest** - Reflektor Yelek

---

## 📥 Veri Seti İndirme Talimatları

### 1. SHEL5K Dataset

**Kaynaklar:**
- **RoboFlow Universe:** https://universe.roboflow.com/
  - Arama: "SHEL5K" veya "construction safety"
  - Format: YOLOv8 export seç
- **Original Paper:** ArXiv (SHEL5K paper)
- **GitHub:** Açık kaynak projeler

**İndirme:**
```bash
# RoboFlow'dan indir (YOLOv8 format)
# veya
# GitHub'dan clone et
```

**Beklenen:**
- ~5,000 görüntü
- Sınıflar: person, hard_hat, safety_vest

---

### 2. SH17 Dataset

**Kaynak:**
- **GitHub:** https://github.com/ahmadmughees/sh17dataset
- **Paper:** ArXiv - "SH17: A Large-Scale Dataset for Safety Helmet Detection"

**İndirme:**
```bash
git clone https://github.com/ahmadmughees/sh17dataset.git
cd sh17dataset
# Veri setini data/datasets/sh17/ dizinine kopyala
```

**Beklenen:**
- ~8,099 görüntü
- 17 sınıf (sadece inşaat kısmını filtrele: hard_hat, safety_vest, person)

**Filtreleme:**
- SH17'de 17 sınıf var
- Sadece şunları al: `person`, `hard_hat`, `safety_vest`
- Diğer sınıfları (glasses, gloves, etc.) at

---

### 3. CHV Dataset (Opsiyonel - Ek)

**Kaynak:**
- ArXiv papers (Construction Helmet Vest Detection)
- GitHub açık kaynak projeler

**Beklenen:**
- ~3,000 görüntü
- Sınıflar: hard_hat, safety_vest

---

### 4. Custom Dataset (Kendi Test Verileriniz)

**Konum:** `data/datasets/custom/reflektor_yelek_kask/`

**İçerik:**
- Reflektor yelek + kask görüntüleri
- Validation set'e eklenecek
- Gerçek dünya senaryoları için test

**Format:**
```
custom/reflektor_yelek_kask/
├── images/
│   ├── test1.jpg
│   ├── test2.jpg
│   └── ...
└── labels/
    ├── test1.txt  # YOLOv8 format: class x y w h
    ├── test2.txt
    └── ...
```

---

## 🔄 Veri Seti Birleştirme

**Script:** `scripts/prepare_dataset.py`

**Komut:**
```bash
python scripts/prepare_dataset.py --domain construction
```

**Yapılacaklar:**
1. SHEL5K veri setini oku
2. SH17 veri setini oku (sadece inşaat sınıfları)
3. CHV veri setini oku (varsa)
4. Custom test verilerinizi ekle
5. Tüm verileri birleştir
6. Train/Val split (80/20)
7. YOLOv8 formatına çevir
8. `dataset.yaml` oluştur

---

## 📊 Beklenen Sonuç

**Hedef:**
- **Train:** 10,000+ görüntü
- **Val:** 2,000+ görüntü
- **Sınıflar:** 3 (person, hard_hat, safety_vest)

**Dosya Yapısı:**
```
construction/
├── images/
│   ├── train/        # ~10,000 .jpg
│   └── val/          # ~2,000 .jpg
├── labels/
│   ├── train/        # ~10,000 .txt
│   └── val/          # ~2,000 .txt
└── dataset.yaml
```

---

## ✅ Kontrol Listesi

- [ ] SHEL5K indirildi → `data/datasets/shel5k/`
- [ ] SH17 indirildi → `data/datasets/sh17/`
- [ ] CHV indirildi (opsiyonel) → `data/datasets/chv/`
- [ ] Custom test verileri eklendi → `data/datasets/custom/`
- [ ] `prepare_dataset.py` çalıştırıldı
- [ ] `construction/dataset.yaml` oluşturuldu
- [ ] Train/Val split yapıldı
- [ ] YOLOv8 formatına çevrildi

---

## 🚀 Sonraki Adım

Veri setleri hazır olduktan sonra:

```bash
# Model eğitimi
python scripts/train_model.py \
    --data data/datasets/construction/dataset.yaml \
    --model yolov8n.pt \
    --epochs 100 \
    --batch 16 \
    --device 0
```

---

**Son Güncelleme:** 19 Kasım 2025

