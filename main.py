# =============================================================================
# DEPREM TAKİP SİSTEMİ - THİNGSPEAK ENTEGRASYONU
# =============================================================================
# Kullanım için aşağıdaki WiFi bilgilerini kendi ağınıza göre değiştirin:

from machine import Pin, I2C
import time
from dht import DHT11
import network
import urequests
import json

# Pin Tanımlamaları
SW420_PIN = Pin(16, Pin.IN)
TRIG_PIN = Pin(22, Pin.OUT)
ECHO_PIN = Pin(21, Pin.IN)
DHT11_PIN = Pin(10, Pin.IN)
i2c = I2C(0, sda=Pin(4), scl=Pin(5))

# WiFi Bağlantı Ayarları (İnternet bağlantısı için)
WIFI_SSID = "SUPERBOX_Wi-Fi_8360"  # Kendi WiFi ağınızın adını yazın
WIFI_PASSWORD = "5hE5453Eu7"  # Kendi WiFi şifrenizi yazın

# ThingSpeak API Ayarları
THINGSPEAK_CHANNEL_ID = "2996256"  # ThingSpeak kanalınızın ID numarası
THINGSPEAK_WRITE_API_KEY = "XC6BSW6SXH6G3I0P"
THINGSPEAK_READ_API_KEY = "E7RN2WP7L12MNTYQ"
THINGSPEAK_CHANNEL_URL = "https://api.thingspeak.com/update"

# Sensör Adresları
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

def connect_to_wifi():
    """WiFi ağına bağlan (İnternet erişimi için)"""
    try:
        wlan = network.WLAN(network.STA_IF)
        wlan.active(True)
        
        if not wlan.isconnected():
            print(f"WiFi ağına bağlanılıyor: {WIFI_SSID}")
            wlan.connect(WIFI_SSID, WIFI_PASSWORD)
            
            # Bağlantı kontrolü
            timeout = 20
            while not wlan.isconnected() and timeout > 0:
                time.sleep(1)
                timeout -= 1
                print(".", end="")
            
            if wlan.isconnected():
                print(f"\nWiFi bağlantısı başarılı!")
                print(f"IP Adresi: {wlan.ifconfig()[0]}")
                return True
            else:
                print("\nWiFi bağlantısı başarısız!")
                return False
        else:
            print("WiFi zaten bağlı")
            return True
            
    except Exception as e:
        print(f"WiFi bağlantı hatası: {e}")
        return False

def send_to_thingspeak(vibration, mpu_data, mma_data, distance, temp, hum):
    """Sensör verilerini ThingSpeak'e gönder
    
    ThingSpeak Channel Field Mapping:
    - Field 1: Titreşim durumu (0=Normal, 1=Titreşim var)
    - Field 2: MPU6050 X ekseni ivme (g)
    - Field 3: MPU6050 Y ekseni ivme (g)  
    - Field 4: MPU6050 Z ekseni ivme (g)
    - Field 5: Mesafe sensörü (cm)
    - Field 6: Sıcaklık (°C)
    - Field 7: Nem (%)
    - Field 8: MMA8451 toplam ivme magnitude (g)
    """
    try:
        # ThingSpeak field'ları:
        # field1: Titreşim durumu (0/1)
        # field2: MPU6050 X ekseni ivme
        # field3: MPU6050 Y ekseni ivme  
        # field4: MPU6050 Z ekseni ivme
        # field5: Mesafe (cm)
        # field6: Sıcaklık (°C)
        # field7: Nem (%)
        # field8: MMA8451 toplam ivme
        
        # MMA8451 toplam ivme hesaplama
        mma_total = (mma_data[0]**2 + mma_data[1]**2 + mma_data[2]**2)**0.5
        
        url = f"{THINGSPEAK_CHANNEL_URL}?api_key={THINGSPEAK_WRITE_API_KEY}"
        url += f"&field1={vibration}"
        url += f"&field2={mpu_data[0]:.3f}"
        url += f"&field3={mpu_data[1]:.3f}"
        url += f"&field4={mpu_data[2]:.3f}"
        url += f"&field5={distance:.1f}"
        url += f"&field6={temp}"
        url += f"&field7={hum}"
        url += f"&field8={mma_total:.3f}"
        
        response = urequests.get(url)
        
        if response.status_code == 200:
            entry_id = response.text.strip()
            if entry_id != "0":
                print(f"✅ ThingSpeak'e veri gönderildi (Entry ID: {entry_id})")
                return True
            else:
                print("❌ ThingSpeak veri gönderme başarısız (Rate limit?)")
                return False
        else:
            print(f"❌ ThingSpeak HTTP hatası: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ ThingSpeak gönderme hatası: {e}")
        return False
    finally:
        try:
            response.close()
        except:
            pass

def log_sensor_data(vibration_status, mpu_data, mma_data, distance, temp, hum, thingspeak_success):
    """Sensör verilerini yerel dosyaya kaydet"""
    try:
        # Zaman damgası
        timestamp = time.ticks_ms()
        
        # Basit log formatı
        log_line = f"{timestamp},{vibration_status},{mpu_data[0]:.3f},{mpu_data[1]:.3f},{mpu_data[2]:.3f},"
        log_line += f"{mma_data[0]:.3f},{mma_data[1]:.3f},{mma_data[2]:.3f},"
        log_line += f"{distance:.1f},{temp},{hum},{thingspeak_success}\n"
        
        # Dosyaya yaz
        with open("sensor_log.txt", "a") as f:
            f.write(log_line)
        
        return True
    except Exception as e:
        print(f"Log kaydetme hatası: {e}")
        return False





def main():
    print("Deprem Takip Sistemi - ThingSpeak Entegrasyonu")
    print("=" * 50)
    
    # WiFi bağlantısı kur
    if not connect_to_wifi():
        print("HATA: İnternet bağlantısı gerekli!")
        print("WiFi ayarlarınızı kontrol edin ve sistemi yeniden başlatın.")
        return
    
    # Sensörleri başlat
    print("Sensörler başlatılıyor...")
    mpu_ok = setup_mpu6050()
    mma_ok = setup_mma8451()
    
    if not (mpu_ok and mma_ok):
        print("UYARI: Bazı sensörler başlatılamadı!")
    
    # Titreşim sensörü interrupt'ını ayarla
    SW420_PIN.irq(trigger=Pin.IRQ_RISING, handler=check_vibration)
    
    print("Sistem hazır! ThingSpeak'e veri gönderimi başlıyor...")
    print(f"ThingSpeak Channel: https://thingspeak.com/channels/{THINGSPEAK_CHANNEL_ID}")
    print("=" * 50)
    
    last_thingspeak_send = 0
    send_interval = 15000  # 15 saniye (ThingSpeak free account limiti)
    
    while True:
        try:
            current_time = time.ticks_ms()
            
            # Titreşim kontrolü
            vibration_status = SW420_PIN.value()
            vibration_text = "TİTREŞİM ALGILANDI!" if vibration_status == 1 else "Normal"
            
            # Sensör verilerini oku
            mpu_ax, mpu_ay, mpu_az, gx, gy, gz = read_mpu6050()
            mma_ax, mma_ay, mma_az = read_mma8451()
            distance = read_hcsr04()
            temp, hum = read_dht11()
            
            # Verileri konsola yazdır
            print(f"\n[{current_time}] Sensör Durumu:")
            print(f"  Titreşim: {vibration_text}")
            print(f"  MPU6050 İvme (g): X={mpu_ax:.3f}, Y={mpu_ay:.3f}, Z={mpu_az:.3f}")
            print(f"  MMA8451 İvme (g): X={mma_ax:.3f}, Y={mma_ay:.3f}, Z={mma_az:.3f}")
            print(f"  Mesafe: {distance:.1f} cm")
            print(f"  Sıcaklık: {temp}°C, Nem: {hum}%")
            
            # ThingSpeak'e veri gönder (belirli aralıklarla)
            thingspeak_sent = False
            if time.ticks_diff(current_time, last_thingspeak_send) >= send_interval:
                mpu_data = (mpu_ax, mpu_ay, mpu_az, gx, gy, gz)
                mma_data = (mma_ax, mma_ay, mma_az)
                
                if send_to_thingspeak(vibration_status, mpu_data, mma_data, distance, temp, hum):
                    last_thingspeak_send = current_time
                    thingspeak_sent = True
                    print(f"  📡 ThingSpeak: Veri gönderildi")
                else:
                    print(f"  📡 ThingSpeak: Gönderme başarısız")
            else:
                remaining = (send_interval - time.ticks_diff(current_time, last_thingspeak_send)) // 1000
                print(f"  📡 ThingSpeak: {remaining}s sonra gönderilecek")
            
            # Yerel log kaydet
            mpu_data = (mpu_ax, mpu_ay, mpu_az, gx, gy, gz)
            mma_data = (mma_ax, mma_ay, mma_az)
            log_sensor_data(vibration_status, mpu_data, mma_data, distance, temp, hum, thingspeak_sent)
            
            # Titreşim durumunda hemen gönder
            if vibration_status == 1 and time.ticks_diff(current_time, last_thingspeak_send) >= 5000:
                print("  🚨 ACİL: Titreşim algılandı, hemen ThingSpeak'e gönderiliyor!")
                if send_to_thingspeak(vibration_status, mpu_data, mma_data, distance, temp, hum):
                    last_thingspeak_send = current_time
                    print("  🚨 ACİL gönderim başarılı!")
            
            time.sleep(2)  # 2 saniyede bir ölçüm
            
        except KeyboardInterrupt:
            print("\nSistem kapatılıyor...")
            break
        except Exception as e:
            print(f"Hata oluştu: {e}")
            time.sleep(5)  # Hata durumunda 5 saniye bekle

if __name__ == '__main__':
    main()
