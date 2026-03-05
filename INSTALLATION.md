# Installation Guide

PPE Compliance System kurulum rehberi. Bu rehberi takip ederek sistemi kolayca kurabilir ve calistirabilirsiniz.


### Adim 1: Repository'yi Klonlayin

```bash
git clone https://github.com/YOUR_USERNAME/ppe-compliance-system.git
cd ppe-compliance-system
```

### Adim 2: Backend'i Baslatin

Sadece `START_BACKEND.bat` dosyasini cift tiklayin veya terminal'de calistirin:

```bash
.\START_BACKEND.bat
```

Bu script otomatik olarak:
- Python kurulu mu kontrol eder
- Virtual environment olusturur (ilk calistirmada)
- Tum bagimliliklari yukler (`requirements.txt`)
- FastAPI sunucusunu baslatir

**Backend URL'leri:**
- API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Adim 3: Frontend'i Baslatin

Yeni bir terminal acin ve `START_FRONTEND.bat` dosyasini calistirin:

```bash
.\START_FRONTEND.bat
```

Bu script otomatik olarak:
- Node.js kurulu mu kontrol eder
- npm paketlerini yukler (ilk calistirmada)
- Vite dev server'i baslatir

**Frontend URL:** http://localhost:5173

---

## Manuel Kurulum

Eger bat dosyalarini kullanmak istemiyorsaniz, asagidaki adimlari takip edin:

### Backend Manuel Kurulum

```bash
# 1. Proje dizinine gidin
cd ppe-compliance-system

# 2. Virtual environment olusturun
python -m venv venv

# 3. Virtual environment'i aktive edin
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 4. Bagimliliklari yukleyin
pip install -r backend/requirements.txt

# 5. Backend'i baslatin
set PYTHONPATH=%CD%
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Manuel Kurulum

```bash
# 1. Frontend dizinine gidin
cd frontend

# 2. npm paketlerini yukleyin
npm install

# 3. Development server'i baslatin
npm run dev
```

---

## Ilk Calistirma

### Varsayilan Giris Bilgileri

Sistem ilk calistirmada otomatik olarak varsayilan admin kullanicisi olusturur:

| Email | Sifre | Rol |
|-------|-------|-----|
| `admin@safevision.io` | `admin123` | Super Admin |


### Ilk Adimlar

1. http://localhost:5173 adresine gidin
2. Admin hesabiyla giris yapin
3. **Configure** sayfasindan kamera ekleyin
4. **Live Camera** sayfasindan canli izleme baslatin
5. **Events** sayfasindan ihlalleri takip edin

