from machine import Pin, I2C
import time
from dht import DHT11
import network
import socket
import json
from web_server import WebServer

# Pin Tanımlamaları
SW420_PIN = Pin(16, Pin.IN)
TRIG_PIN = Pin(22, Pin.OUT)
ECHO_PIN = Pin(21, Pin.IN)
DHT11_PIN = Pin(10, Pin.IN)
i2c = I2C(0, sda=Pin(4), scl=Pin(5))

# WiFi Access Point Ayarları
WIFI_SSID = "deprem_takip"
WIFI_PASSWORD = "123456789d"

# Sensör Adresleri
MPU6050_ADDR = 0x68
MMA8451_ADDR = 0x1D

# Global değişkenler
last_vibration = 0
alarm_threshold = 1.5  # İvme eşik değeri (g)

def setup_mpu6050():
    try:
        # MPU6050'yi uyku modundan çıkar
        i2c.writeto_mem(MPU6050_ADDR, 0x6B, bytes([0]))
        # Tam ölçek aralığını ±2g olarak ayarla
        i2c.writeto_mem(MPU6050_ADDR, 0x1C, bytes([0]))
        return True
    except:
        print("MPU6050 başlatılamadı!")
        return False

def setup_mma8451():
    try:
        # MMA8451'i aktif moda al
        i2c.writeto_mem(MMA8451_ADDR, 0x2A, bytes([0x01]))
        # Tam ölçek aralığını ±2g olarak ayarla
        i2c.writeto_mem(MMA8451_ADDR, 0x0E, bytes([0x00]))
        return True
    except:
        print("MMA8451 başlatılamadı!")
        return False

def read_mpu6050():
    try:
        data = i2c.readfrom_mem(MPU6050_ADDR, 0x3B, 14)
        # 16-bit değerleri düzgün şekilde işaretle
        ax = (data[0] << 8 | data[1])
        ay = (data[2] << 8 | data[3])
        az = (data[4] << 8 | data[5])
        
        # İşaretli sayıya dönüştür
        ax = -(ax & 0x8000) | (ax & 0x7fff)
        ay = -(ay & 0x8000) | (ay & 0x7fff)
        az = -(az & 0x8000) | (az & 0x7fff)
        
        # İvme değerlerini g cinsine çevir
        ax = ax / 16384.0
        ay = ay / 16384.0
        az = az / 16384.0
        
        # Gyro değerlerini oku
        gx = (data[8] << 8 | data[9])
        gy = (data[10] << 8 | data[11])
        gz = (data[12] << 8 | data[13])
        
        # İşaretli sayıya dönüştür
        gx = -(gx & 0x8000) | (gx & 0x7fff)
        gy = -(gy & 0x8000) | (gy & 0x7fff)
        gz = -(gz & 0x8000) | (gz & 0x7fff)
        
        # Derece/saniye'ye çevir
        gx = gx / 131.0
        gy = gy / 131.0
        gz = gz / 131.0
        
        return ax, ay, az, gx, gy, gz
    except:
        return 0, 0, 0, 0, 0, 0

def read_mma8451():
    try:
        data = i2c.readfrom_mem(MMA8451_ADDR, 0x01, 6)
        # 14 bit değerleri birleştir
        x = ((data[0] << 8) | data[1]) >> 2
        y = ((data[2] << 8) | data[3]) >> 2
        z = ((data[4] << 8) | data[5]) >> 2
        
        # İşaretli değerlere çevir ve ölçekle
        x = (x if x < 8192 else x - 16384) / 4096.0
        y = (y if y < 8192 else y - 16384) / 4096.0
        z = (z if z < 8192 else z - 16384) / 4096.0
        
        return x, y, z
    except:
        return 0, 0, 0

def read_hcsr04():
    try:
        # Maksimum bekleme süresi (ms)
        MAX_WAIT = 100
        
        TRIG_PIN.value(0)
        time.sleep_us(2)
        TRIG_PIN.value(1)
        time.sleep_us(10)
        TRIG_PIN.value(0)
        
        # Echo yükselmesini bekle
        pulse_start = time.ticks_us()
        deadline = time.ticks_add(pulse_start, MAX_WAIT * 1000)
        
        while ECHO_PIN.value() == 0:
            if time.ticks_diff(deadline, time.ticks_us()) <= 0:
                return 0
            pulse_start = time.ticks_us()
        
        # Echo düşmesini bekle
        pulse_end = time.ticks_us()
        while ECHO_PIN.value() == 1:
            if time.ticks_diff(deadline, time.ticks_us()) <= 0:
                return 0
            pulse_end = time.ticks_us()
        
        # Mesafeyi hesapla
        duration = time.ticks_diff(pulse_end, pulse_start)
        distance = (duration * 0.0343) / 2
        
        return min(max(distance, 0), 400)  # 0-400cm aralığında sınırla
    except:
        return 0

def read_dht11():
    try:
        dht = DHT11(DHT11_PIN)
        dht.measure()
        return dht.temperature(), dht.humidity()
    except:
        return 0, 0

def check_vibration(pin):
    global last_vibration
    current_time = time.ticks_ms()
    if time.ticks_diff(current_time, last_vibration) > 100:  # Debounce
        last_vibration = current_time
        return True
    return False

def setup_access_point():
    """Access Point kurar"""
    try:
        ap = network.WLAN(network.AP_IF)
        ap.active(True)
        ap.config(essid=WIFI_SSID, password=WIFI_PASSWORD)
        
        while not ap.active():
            time.sleep(0.1)
        
        print(f"Access Point kuruldu: {WIFI_SSID}")
        print(f"IP Adresi: {ap.ifconfig()[0]}")
        return ap
    except Exception as e:
        print(f"Access Point kurulum hatası: {e}")
        return None

def save_sensor_data(vibration_status, mpu_data, mma_data, distance, temp, hum):
    """Sensör verilerini JSON formatında depolar"""
    try:
        # Zaman damgası
        timestamp = time.ticks_ms()
        
        # Veri yapısı
        data = {
            "timestamp": timestamp,
            "vibration": vibration_status,
            "mpu6050": {
                "accel": {"x": mpu_data[0], "y": mpu_data[1], "z": mpu_data[2]},
                "gyro": {"x": mpu_data[3], "y": mpu_data[4], "z": mpu_data[5]}
            },
            "mma8451": {
                "accel": {"x": mma_data[0], "y": mma_data[1], "z": mma_data[2]}
            },
            "distance": distance,
            "temperature": temp,
            "humidity": hum
        }
        
        # JSON string'e çevir (MicroPython uyumlu)
        json_data = json.dumps(data)
        
        # Dosyaya yaz
        with open("sensor_data.json", "a") as f:
            f.write(json_data + "\n" + "-"*50 + "\n")
        
        return json_data
    except Exception as e:
        print(f"Veri kaydetme hatası: {e}")
        return None

def format_human_readable_data(vibration_status, mpu_data, mma_data, distance, temp, hum):
    """Sensör verilerini insan dostu formatta döndürür"""
    
    # Tarih ve saat bilgisi (basit format)
    timestamp = time.ticks_ms()
    
    # Titreşim durumu metni
    vibration_text = "🚨 TİTREŞİM ALGILANDI!" if vibration_status == 1 else "✅ Normal"
    
    # MPU6050 verileri
    total_acceleration = (mpu_data[0]**2 + mpu_data[1]**2 + mpu_data[2]**2)**0.5
    
    # Rapor metni oluştur
    report = f"""
╔══════════════════════════════════════════════════════════════╗
║                    DEPREM TAKİP RAPORU                      ║
╠══════════════════════════════════════════════════════════════╣
║ Zaman Damgası: {timestamp} ms                              ║
║                                                              ║
║ 🔴 TİTREŞİM DURUMU: {vibration_text:<30} ║
║                                                              ║
║ 📊 MPU6050 SENSÖRÜ (Ana İvmeölçer):                        ║
║   • X Ekseni İvmesi: {mpu_data[0]:>8.3f} g                 ║
║   • Y Ekseni İvmesi: {mpu_data[1]:>8.3f} g                 ║
║   • Z Ekseni İvmesi: {mpu_data[2]:>8.3f} g                 ║
║   • Toplam İvme:     {total_acceleration:>8.3f} g                 ║
║   • X Dönme Hızı:    {mpu_data[3]:>8.1f} °/s               ║
║   • Y Dönme Hızı:    {mpu_data[4]:>8.1f} °/s               ║
║   • Z Dönme Hızı:    {mpu_data[5]:>8.1f} °/s               ║
║                                                              ║
║ 📊 MMA8451 SENSÖRÜ (Yedek İvmeölçer):                      ║
║   • X Ekseni İvmesi: {mma_data[0]:>8.3f} g                 ║
║   • Y Ekseni İvmesi: {mma_data[1]:>8.3f} g                 ║
║   • Z Ekseni İvmesi: {mma_data[2]:>8.3f} g                 ║
║                                                              ║
║ 📏 MESAFE SENSÖRÜ (HC-SR04):                               ║
║   • Ölçülen Mesafe:  {distance:>8.1f} cm                   ║
║                                                              ║
║ 🌡️  ORTAM KOŞULLARI (DHT11):                               ║
║   • Sıcaklık:        {temp:>8} °C                          ║
║   • Nem Oranı:       {hum:>8} %                            ║
║                                                              ║
║ 🔍 DEĞERLENDİRME:                                           ║
║   • İvme Seviyesi: {"🔴 YÜKSEK" if total_acceleration > 1.2 else "🟡 ORTA" if total_acceleration > 0.5 else "🟢 DÜŞÜK":<20} ║
║   • Titreşim Risk: {"🚨 RİSKLİ" if vibration_status == 1 else "✅ GÜVENLİ":<20} ║
╚══════════════════════════════════════════════════════════════╝
"""
    return report

def save_human_readable_data(vibration_status, mpu_data, mma_data, distance, temp, hum):
    """İnsan dostu formatta veri kaydet"""
    try:
        report = format_human_readable_data(vibration_status, mpu_data, mma_data, distance, temp, hum)
        
        # İnsan dostu raporu dosyaya kaydet
        with open("sensor_report.txt", "a") as f:
            f.write(report + "\n")
        
        return report
    except Exception as e:
        print(f"İnsan dostu veri kaydetme hatası: {e}")
        return None

def save_csv_data(vibration_status, mpu_data, mma_data, distance, temp, hum):
    """Sensör verilerini CSV formatında kaydet (Excel'de açılabilir)"""
    try:
        # CSV dosyası yoksa başlık satırını ekle
        csv_file = "sensor_data.csv"
        file_exists = False
        try:
            with open(csv_file, "r"):
                file_exists = True
        except:
            pass
        
        # Zaman damgası
        timestamp = time.ticks_ms()
        
        # CSV satırı oluştur
        csv_line = f"{timestamp},{vibration_status},{mpu_data[0]:.3f},{mpu_data[1]:.3f},{mpu_data[2]:.3f},{mpu_data[3]:.1f},{mpu_data[4]:.1f},{mpu_data[5]:.1f},{mma_data[0]:.3f},{mma_data[1]:.3f},{mma_data[2]:.3f},{distance:.1f},{temp},{hum}\n"
        
        with open(csv_file, "a") as f:
            # İlk kayıtsa başlık ekle
            if not file_exists:
                header = "Zaman,Titresim,MPU_X,MPU_Y,MPU_Z,Gyro_X,Gyro_Y,Gyro_Z,MMA_X,MMA_Y,MMA_Z,Mesafe,Sicaklik,Nem\n"
                f.write(header)
            f.write(csv_line)
        
        return csv_line
    except Exception as e:
        print(f"CSV veri kaydetme hatası: {e}")
        return None

def format_json_simple(data, indent_level=0):
    """MicroPython için basit JSON formatlama"""
    indent = "  " * indent_level
    
    if isinstance(data, dict):
        lines = ["{"]
        for i, (key, value) in enumerate(data.items()):
            comma = "," if i < len(data) - 1 else ""
            if isinstance(value, (dict, list)):
                lines.append(f'{indent}  "{key}": {format_json_simple(value, indent_level + 1)}{comma}')
            elif isinstance(value, str):
                lines.append(f'{indent}  "{key}": "{value}"{comma}')
            else:
                lines.append(f'{indent}  "{key}": {value}{comma}')
        lines.append(f"{indent}}}")
        return "\n".join(lines)
    
    elif isinstance(data, list):
        if not data:
            return "[]"
        lines = ["["]
        for i, item in enumerate(data):
            comma = "," if i < len(data) - 1 else ""
            lines.append(f"{indent}  {format_json_simple(item, indent_level + 1)}{comma}")
        lines.append(f"{indent}]")
        return "\n".join(lines)
    
    else:
        return json.dumps(data)

def main():
    print("Sistem başlatılıyor...")
    
    # Access Point kur
    ap = setup_access_point()
    if not ap:
        print("Access Point kurulamadı!")
        return
    
    # Web server'ı başlat
    web_server = WebServer(port=80)
    if not web_server.start():
        print("Web server başlatılamadı!")
        return
    
    print(f"Dashboard adres: http://{ap.ifconfig()[0]}/")
    
    # Sensörleri başlat
    if not (setup_mpu6050() and setup_mma8451()):
        print("Sensör başlatma hatası!")
        return
    
    # Titreşim sensörü interrupt'ını ayarla
    SW420_PIN.irq(trigger=Pin.IRQ_RISING, handler=check_vibration)
    
    print("Sistem hazır, ölçümler başlıyor...")
    
    while True:
        try:
            # Web isteklerini işle (non-blocking)
            web_server.handle_requests()
            
            # Titreşim kontrolü
            vibration_status = SW420_PIN.value()
            vibration_text = "TİTREŞİM ALGILANDI!" if vibration_status == 1 else "YOK"
            
            # Sensör verilerini oku
            mpu_ax, mpu_ay, mpu_az, gx, gy, gz = read_mpu6050()
            mma_ax, mma_ay, mma_az = read_mma8451()
            distance = read_hcsr04()
            temp, hum = read_dht11()
            
            # Web server verilerini güncelle
            mpu_data = (mpu_ax, mpu_ay, mpu_az, gx, gy, gz)
            mma_data = (mma_ax, mma_ay, mma_az)
            web_server.update_data(vibration_status, mpu_data, mma_data, distance, temp, hum)
            
            # Verileri JSON formatında kaydet
            json_data = save_sensor_data(vibration_status, mpu_data, mma_data, distance, temp, hum)
            
            # CSV formatında da kaydet (Excel için)
            csv_data = save_csv_data(vibration_status, mpu_data, mma_data, distance, temp, hum)
            
            # İnsan dostu formatta da kaydet
            human_report = save_human_readable_data(vibration_status, mpu_data, mma_data, distance, temp, hum)
            
            # Verileri yazdır
            print("\n=== Sensör Verileri ===")
            print(f"SW420 Titreşim Durumu: {vibration_text}")
            print(f"MPU6050 İvme (g): X={mpu_ax:.2f}, Y={mpu_ay:.2f}, Z={mpu_az:.2f}")
            print(f"MPU6050 Gyro (°/s): X={gx:.1f}, Y={gy:.1f}, Z={gz:.1f}")
            print(f"MMA8451 İvme (g): X={mma_ax:.2f}, Y={mma_ay:.2f}, Z={mma_az:.2f}")
            print(f"Mesafe (cm): {distance:.1f}")
            print(f"Sıcaklık: {temp}°C, Nem: {hum}%")
            if json_data:
                print("✅ Veriler JSON formatında kaydedildi")
            if csv_data:
                print("✅ Veriler CSV formatında kaydedildi (Excel için)")
            if human_report:
                print("✅ İnsan dostu rapor oluşturuldu")
            print("=" * 20)
            
            # Bellek temizliği
            if time.ticks_ms() % 10000 < 50:  # Her 10 saniyede bir
                web_server.cleanup()
            
            time.sleep(0.5)  # Daha hızlı güncelleme için azaltıldı
            
        except KeyboardInterrupt:
            print("Sistem kapatılıyor...")
            web_server.stop()
            break
        except Exception as e:
            print(f"Hata oluştu: {e}")
            time.sleep(1)

if __name__ == '__main__':
    main()
