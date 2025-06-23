# Deprem Takip Sistemi

Raspberry Pi Pico W ile deprem ve çevresel parametreleri izleyen sistem.

## Dosyalar

- `main.py` - Pico W ana kodu  
- `index.html` - Dashboard ana sayfa
- `dashboard.css` - Dashboard stil
- `dashboard.js` - Dashboard kod

## Kurulum

### 1. Pico W Kurulumu
`main.py` dosyasındaki WiFi ayarlarını güncelleyin:
```python
WIFI_SSID = "WiFi_Adiniz" 
WIFI_PASSWORD = "WiFi_Sifreniz"
```

### 2. Dashboard Yayınlama
1. GitHub'da yeni repo oluşturun
2. `index.html`, `dashboard.css`, `dashboard.js` dosyalarını yükleyin
3. GitHub Pages'i aktifleştirin

## Özellikler

- Titreşim sensörü (SW420)
- İvme sensörleri (MPU6050, MMA8451)  
- Mesafe sensörü (HC-SR04)
- Sıcaklık/nem sensörü (DHT11)
- ThingSpeak entegrasyonu
- Web dashboard ile izleme

## Kullanım

1. Pico W'yi çalıştırın
2. Dashboard URL'nize gidin: `https://kullanici.github.io/repo-adi/`
3. Gerçek zamanlı verileri izleyin
