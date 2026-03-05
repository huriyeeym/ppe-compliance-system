# PPE Compliance System

Canli kamera goruntulerinden kisisel koruyucu ekipman (PPE) tespiti yapan is guvenligi uyumluluk sistemi.

## Ne Yapar?

Sistem, YOLOv8 tabanli yapay zeka modeli kullanarak canli kamera goruntulerinden calisanlari ve uzerlerindeki koruyucu ekipmanlari tespit eder. Eksik ekipman durumunda ihlal kaydeder, snapshot ve video alir.

### Desteklenen Alanlar

- **Insaat:** Baret, yelek, guvenlik botu
- **Uretim:** Gozluk, kulaklik, eldiven, maske
- **Madencilik:** Baret, yelek, maske, bot, eldiven
- **Depo:** Baret, yelek, guvenlik botu

### Ozellikler

- Gercek zamanli PPE tespiti
- Webcam ve RTSP kamera destegi
- Ihlal kaydi (snapshot + video)
- Web tabanli yonetim paneli
- Coklu kullanici ve organizasyon destegi
- E-posta bildirimleri
- Raporlama ve Excel/PDF export

## Hizli Baslangic

### Gereksinimler

- Python 3.10+
- Node.js 18+

### Kurulum

```bash
git clone https://github.com/YOUR_USERNAME/ppe-compliance-system.git
cd ppe-compliance-system
```

### Calistirma

```bash
# Backend
.\START_BACKEND.bat

# Frontend (yeni terminal)
.\START_FRONTEND.bat
```

### Erisim

- **Arayuz:** http://localhost:5173
- **API:** http://localhost:8000/docs

### Varsayilan Giris

| Email | Sifre |
|-------|-------|
| admin@safevision.io | admin123 |

## Teknolojiler

- **Backend:** FastAPI, SQLAlchemy, YOLOv8, OpenCV
- **Frontend:** React, TypeScript, TailwindCSS
- **Veritabani:** SQLite

## Dokumantasyon

Detayli kurulum icin: [INSTALLATION.md](INSTALLATION.md)
