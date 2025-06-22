// Dashboard JavaScript - Basit ve güvenilir veri gösterimi
let updateInterval;
let isConnected = false;

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard başlatılıyor...');
    startDataUpdates();
});

// Veri güncellemelerini başlat
function startDataUpdates() {
    // İlk veriyi hemen al
    fetchSensorData();
    
    // Her 2 saniyede bir güncelle
    updateInterval = setInterval(fetchSensorData, 2000);
    
    console.log('Veri güncellemeleri başlatıldı');
}

// Sensör verilerini al
function fetchSensorData() {
    fetch('/data')
        .then(response => {
            if (!response.ok) {
                throw new Error('Veri alınamadı');
            }
            return response.json();
        })
        .then(data => {
            updateUI(data);
            updateConnectionStatus(true);
        })
        .catch(error => {
            console.error('Veri alma hatası:', error);
            updateConnectionStatus(false);
        });
}

// Kullanıcı arayüzünü güncelle
function updateUI(data) {
    try {
        // Titreşim durumu
        const vibrationElement = document.getElementById('vibrationStatus');
        const vibrationCard = document.getElementById('vibrationCard');
        
        if (data.vibration === 1) {
            vibrationElement.textContent = 'TİTREŞİM ALGILANDI!';
            vibrationElement.className = 'vibration-status active';
        } else {
            vibrationElement.textContent = 'YOK';
            vibrationElement.className = 'vibration-status';
        }

        // Sıcaklık ve nem
        document.getElementById('temperature').textContent = data.temperature || '--';
        document.getElementById('humidity').textContent = data.humidity || '--';

        // Mesafe
        document.getElementById('distance').textContent = data.distance ? data.distance.toFixed(1) : '--';

        // MPU6050 ivme değerleri
        if (data.mpu6050 && data.mpu6050.accel) {
            document.getElementById('mpuAccelX').textContent = data.mpu6050.accel.x.toFixed(2);
            document.getElementById('mpuAccelY').textContent = data.mpu6050.accel.y.toFixed(2);
            document.getElementById('mpuAccelZ').textContent = data.mpu6050.accel.z.toFixed(2);
        }

        // MMA8451 ivme değerleri
        if (data.mma8451 && data.mma8451.accel) {
            document.getElementById('mmaAccelX').textContent = data.mma8451.accel.x.toFixed(2);
            document.getElementById('mmaAccelY').textContent = data.mma8451.accel.y.toFixed(2);
            document.getElementById('mmaAccelZ').textContent = data.mma8451.accel.z.toFixed(2);
        }

        // Gyro değerleri
        if (data.mpu6050 && data.mpu6050.gyro) {
            document.getElementById('gyroX').textContent = data.mpu6050.gyro.x.toFixed(1);
            document.getElementById('gyroY').textContent = data.mpu6050.gyro.y.toFixed(1);
            document.getElementById('gyroZ').textContent = data.mpu6050.gyro.z.toFixed(1);
        }

        // Son güncelleme zamanı
        const now = new Date();
        document.getElementById('lastUpdate').textContent = now.toLocaleTimeString('tr-TR');

    } catch (error) {
        console.error('UI güncelleme hatası:', error);
    }
}

// Bağlantı durumunu güncelle
function updateConnectionStatus(connected) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-indicator span');
    
    if (connected !== isConnected) {
        isConnected = connected;
        
        if (connected) {
            statusDot.classList.remove('disconnected');
            statusText.textContent = 'Bağlı';
            console.log('Bağlantı kuruldu');
        } else {
            statusDot.classList.add('disconnected');
            statusText.textContent = 'Bağlantı Kesildi';
            console.log('Bağlantı kesildi');
        }
    }
}

// Sayfa kapatılırken temizle
window.addEventListener('beforeunload', function() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});
