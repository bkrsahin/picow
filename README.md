# Deprem Takip Sistemi Dashboard

Raspberry Pi Pico W tabanlı deprem takip sistemi için web dashboard'u.

## Dosya Yapısı

- `main.py` - Ana program (değiştirilmez)
- `web_server.py` - Web server sınıfı
- `dashboard.html` - Dashboard arayüzü (ana sayfa)
- `style.css` - CSS stilleri
- `script.js` - JavaScript kodu

## Kurulum

1. Tüm dosyaları Raspberry Pi Pico W'ye yükleyin
2. `main.py` dosyasını çalıştırın
3. Access Point "deprem_takip" ağına bağlanın (şifre: 123456789d)
4. Tarayıcınızda IP adresine gidin (genellikle 192.168.4.1)
5. Dashboard otomatik olarak açılır

## Özellikler

- **Direkt erişim**: IP adresine gittiğinizde dashboard açılır
- **Gerçek zamanlı veri izleme**: Sensör verileri 2 saniyede bir güncellenir
- **Responsive tasarım**: Mobil ve masaüstü uyumlu
- **Ayrı dosya yapısı**: HTML, CSS ve JS dosyaları birbirinden ayrı
- **Basit yapı**: JS dosyası minimal ve anlaşılır

## Sensör Verileri

- SW420 Titreşim Sensörü
- MPU6050 İvme ve Gyro Sensörü
- MMA8451 İvme Sensörü
- HC-SR04 Mesafe Sensörü
- DHT11 Sıcaklık ve Nem Sensörü

## Kullanım

1. Pico'nun IP adresini öğrenin (seri monitörde görünür)
2. Tarayıcınızda IP adresine gidin
3. Dashboard otomatik olarak yüklenir
4. Sensör verilerini gerçek zamanlı izleyin

## Statik IP Kullanımı

- Pico'yu her açtığınızda aynı IP'yi kullanabilirsiniz
- Nerede olursanız olun, IP adresine giderek dashboard'a erişebilirsiniz
- Access Point modu sayesinde internet bağlantısı gerektirmez

## Not

- Dashboard main.py dosyasına dahil edilmemiştir
- Veriler JSON formatında `/data` endpoint'inden alınır
- CSS ve JS dosyaları ayrı olarak yüklenir
- Sistem non-blocking şekilde çalışır
- Ana sayfaya gittiğinizde direkt dashboard açılır
