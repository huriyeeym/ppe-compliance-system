"""
Kaggle API setup kontrol scripti
"""
import os
import json
from pathlib import Path

def check_kaggle_setup():
    """Kaggle API kurulumunu kontrol et"""
    print("=" * 60)
    print("Kaggle API Setup Kontrolü")
    print("=" * 60)
    
    # 1. Kaggle API kurulu mu? (import hatası olmadan kontrol)
    try:
        import subprocess
        result = subprocess.run(
            ["pip", "show", "kaggle"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("[OK] Kaggle API kurulu")
        else:
            print("[!] Kaggle API kurulu değil")
            print("    Kurulum: pip install kaggle")
            return False
    except Exception as e:
        print(f"[!] Pip kontrolü hatası: {e}")
        return False
    
    # 2. .kaggle klasörü var mı?
    kaggle_dir = Path.home() / ".kaggle"
    if kaggle_dir.exists():
        print(f"[OK] .kaggle klasörü mevcut: {kaggle_dir}")
    else:
        print(f"[!] .kaggle klasörü bulunamadı")
        print(f"    Oluşturulacak: {kaggle_dir}")
        return False
    
    # 3. kaggle.json var mı?
    kaggle_json = kaggle_dir / "kaggle.json"
    if kaggle_json.exists():
        print(f"[OK] kaggle.json mevcut: {kaggle_json}")
        
        # 4. Token içeriği kontrol et
        try:
            with open(kaggle_json, 'r') as f:
                token_data = json.load(f)
            
            if 'username' in token_data and 'key' in token_data:
                print(f"[OK] Token geçerli görünüyor")
                print(f"    Username: {token_data.get('username', 'N/A')}")
                
                # 5. API test (sadece token varsa)
                try:
                    from kaggle.api.kaggle_api_extended import KaggleApi
                    api = KaggleApi()
                    api.authenticate()
                    print("[OK] Kaggle API authentication başarılı")
                    return True
                except Exception as e:
                    print(f"[!] Kaggle API authentication hatası: {e}")
                    return False
            else:
                print("[!] Token formatı geçersiz")
                print("    Gerekli alanlar: username, key")
                return False
        except Exception as e:
            print(f"[!] Token okuma hatası: {e}")
            return False
    else:
        print(f"[!] kaggle.json bulunamadı")
        print(f"    Beklenen konum: {kaggle_json}")
        print("")
        print("Yapılacaklar:")
        print("1. https://www.kaggle.com/settings -> API -> Create New Token")
        print("2. İndirilen kaggle.json dosyasını buraya kopyala:")
        print(f"   {kaggle_json}")
        return False


if __name__ == "__main__":
    success = check_kaggle_setup()
    print("")
    print("=" * 60)
    if success:
        print("[OK] Kaggle API hazır! Pipeline'ı çalıştırabilirsin.")
    else:
        print("[!] Kaggle API kurulumu tamamlanmadı.")
        print("    KAGGLE_TOKEN_INSTRUCTIONS.md dosyasına bak.")
    print("=" * 60)

