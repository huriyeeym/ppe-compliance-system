# 🏗️ PPE Compliance & Violation Tracking System

**Gerçek Zamanlı Multi-Domain İSG (İş Sağlığı ve Güvenliği) Uyumluluk Sistemi**

[![Python](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2+-61dafb.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 📖 Proje Hakkında

Bu sistem, **canlı video görüntülerinden** çalışan kişileri ve üzerlerindeki **Kişisel Koruyucu Ekipmanları (PPE)** tespit eder. Tanımlı iş güvenliği kurallarına göre eksik ekipmanları **ihlâl** olarak işaretler ve bunları kayıt altına alır.

### 🎯 Temel Özellikler

- ✅ **Multi-Domain Destek**: Farklı iş alanları (inşaat, üretim, madencilik vb.) için özel kurallar
- ✅ **Real-Time Detection**: YOLOv8 tabanlı hızlı PPE tespiti
- ✅ **Çoklu Kamera Desteği**: Webcam, RTSP, video dosyaları
- ✅ **İhlal Takibi**: Zaman/konum damgalı ihlal kayıtları
- ✅ **Web Arayüzü**: Canlı görüntü, ihlal listesi, filtreler, dashboard
- ✅ **Ölçeklenebilir Mimari**: Yeni domain eklemek çok kolay

### 🏭 Desteklenen Domainler

| Domain | PPE Türleri | Durum |
|--------|-------------|-------|
| **İnşaat** | Baret, Yelek, Güvenlik Botu | 🟢 Aktif |
| **Üretim Sanayi** | Gözlük, Kulaklık, Maske, Eldiven, Koruyucu Giysi (17 sınıf) | 🟢 Aktif |
| **Madencilik** | Madenci Bareti, Toz Maskesi, Çelik Burunlu Bot | 🟡 Planlı |
| **Sağlık/Hastane** | Cerrahi Maske, Önlük, Eldiven, Yüz Siperliği | 🟡 Planlı |
| **Gıda Üretimi** | Bone, Önlük, Eldiven | 🟡 Planlı |

---

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Python 3.9+
- Node.js 18+
- GPU (önerilen, CPU'da da çalışır ama yavaş)
- Webcam veya RTSP kamera

### Kurulum

#### 1. Repository'yi Klonlayın

```bash
git clone https://github.com/YOUR_USERNAME/ppe-compliance-system.git
cd ppe-compliance-system
```

#### 2. Backend Kurulumu

```bash
# Virtual environment oluştur
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# Bağımlılıkları yükle
pip install -r requirements.txt

# Veritabanını başlat
python scripts/init_database.py

# Veri setlerini indir (opsiyonel, ilk çalıştırmada otomatik indirilir)
python scripts/download_datasets.py
```

#### 3. Frontend Kurulumu

```bash
cd frontend
npm install
npm run dev
```

#### 4. Backend'i Başlat

```bash
# Ana dizinde
cd backend
uvicorn main:app --reload
```

#### 5. Tarayıcıda Açın

```
http://localhost:3000
```

---

## 📚 Dokümantasyon

| Dosya | İçerik |
|-------|--------|
| [PROJECT_BRIEF.md](PROJECT_BRIEF.md) | Proje vizyonu, çalışma prensipleri, tüm konuşmalar |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Mimari detayları, database schema, teknoloji kararları |
| [ROADMAP.md](ROADMAP.md) | Neredeyiz, sonraki adımlar, faz planlaması |
| [LEARNING_LOG.md](LEARNING_LOG.md) | Öğrenme notları, kavramlar, trade-off'lar |
| [FEATURES.md](FEATURES.md) | Özellik istekleri, tasarım kararları |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Geliştirici rehberi, kod standartları |
| [CHANGELOG.md](CHANGELOG.md) | Versiyon geçmişi, yapılan değişiklikler |

---

## 🏗️ Proje Yapısı

```
ppe-compliance-system/
├── backend/              # FastAPI backend
│   ├── api/              # REST endpoints
│   ├── database/         # ORM models, CRUD
│   ├── ml_engine/        # YOLO detection
│   ├── rules_engine/     # Compliance checking
│   └── utils/            # Helpers
├── frontend/             # React frontend
│   └── src/
│       ├── components/   # UI components
│       └── services/     # API calls
├── data/
│   ├── datasets/         # Training data
│   └── models/           # Trained models (.pt)
├── docs/                 # Detaylı dokümantasyon
│   └── domains/          # Domain-specific docs
└── scripts/              # Utility scripts
```

---

## 🎮 Kullanım

### 1. Domain Seçimi

Arayüzde sağ üstten çalışma alanını seçin:
- İnşaat Alanı
- Üretim Sanayi
- vb.

### 2. Kamera Bağlantısı

- **Webcam:** Otomatik algılanır
- **RTSP:** Ayarlar'dan kamera URI'sini girin
- **Video Dosyası:** Dosya yükleyin

### 3. İhlal Takibi

- Canlı görüntüde eksik PPE kırmızı ile vurgulanır
- İhlaller otomatik kaydedilir
- İhlal listesinden filtreleyebilir/detay görebilirsiniz

---

## 🧪 Test

```bash
# Backend testleri
pytest tests/backend/

# Frontend testleri
cd frontend
npm test
```

---

## 🤝 Katkıda Bulunma

Bu proje aktif geliştirme aşamasındadır. Katkılarınızı bekliyoruz!

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'feat: add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

**Commit Mesaj Formatı:** `<type>(<scope>): <subject>`  
Detaylar için [DEVELOPMENT.md](DEVELOPMENT.md)'ye bakın.

---

## 📊 Veri Setleri

Proje aşağıdaki açık kaynak veri setlerini kullanır:

- **SHEL5K** (İnşaat): Construction Safety Equipment Detection
- **SH17** (Üretim): 17-class Safety Helmet Dataset

Detaylar: [data/datasets/README.md](data/datasets/README.md)

---

## 📜 Lisans

Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.

---

## 🙏 Teşekkürler

- [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics)
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://reactjs.org/)
- SHEL5K ve SH17 veri seti katkı sağlayanları

---

## 📞 İletişim

Sorularınız için issue açabilirsiniz.

**Proje Durumu:** 🚧 Aktif Geliştirme (Faz 1)  
**Son Güncelleme:** 08 Kasım 2025

