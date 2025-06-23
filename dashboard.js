// Dashboard JavaScript - ThingSpeak API Integration

// ThingSpeak Konfigürasyonu
const CONFIG = {
    channelId: '2996256', // main.py'den alınan channel ID
    readApiKey: 'E7RN2WP7L12MNTYQ',
    updateInterval: 30000, // 30 saniye
    maxDataPoints: 50, // Grafiklerde gösterilecek maksimum veri sayısı
    baseUrl: 'https://api.thingspeak.com'
};

// Global değişkenler
let charts = {};
let latestData = {};
let isConnected = false;

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Dashboard başlatılıyor...');
    
    // Chart.js global ayarları
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.position = 'top';
    
    // Grafikleri başlat
    initializeCharts();
    
    // İlk veri yükleme
    loadData();
    
    // Otomatik güncelleme
    setInterval(loadData, CONFIG.updateInterval);
    
    console.log(`✅ Dashboard hazır! ${CONFIG.updateInterval/1000}s aralıklarla güncelleniyor.`);
});

// Grafikleri başlat
function initializeCharts() {
    // İvme grafik
    const accelCtx = document.getElementById('accelChart').getContext('2d');
    charts.accel = new Chart(accelCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'X Ekseni (g)',
                    data: [],
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Y Ekseni (g)',
                    data: [],
                    borderColor: '#4caf50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Z Ekseni (g)',
                    data: [],
                    borderColor: '#2196f3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'İvme (g)' }
                },
                x: {
                    title: { display: true, text: 'Zaman' }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    // MPU6050 Gyro grafik
    const gyroCtx = document.getElementById('gyroChart').getContext('2d');
    charts.gyro = new Chart(gyroCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Gyro X (°/s)',
                    data: [],
                    borderColor: '#ff9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Gyro Y (°/s)',
                    data: [],
                    borderColor: '#9c27b0',
                    backgroundColor: 'rgba(156, 39, 176, 0.1)',
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Gyro Z (°/s)',
                    data: [],
                    borderColor: '#00bcd4',
                    backgroundColor: 'rgba(0, 188, 212, 0.1)',
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Açısal Hız (°/s)' }
                },
                x: {
                    title: { display: true, text: 'Zaman' }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    // MMA8451 İvme grafik
    const mmaCtx = document.getElementById('mmaChart').getContext('2d');
    charts.mma = new Chart(mmaCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'MMA X (g)',
                    data: [],
                    borderColor: '#e91e63',
                    backgroundColor: 'rgba(233, 30, 99, 0.1)',
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'MMA Y (g)',
                    data: [],
                    borderColor: '#673ab7',
                    backgroundColor: 'rgba(103, 58, 183, 0.1)',
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'MMA Z (g)',
                    data: [],
                    borderColor: '#795548',
                    backgroundColor: 'rgba(121, 85, 72, 0.1)',
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'İvme (g)' }
                },
                x: {
                    title: { display: true, text: 'Zaman' }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    // Titreşim ve toplam ivme grafik
    const vibrationCtx = document.getElementById('vibrationChart').getContext('2d');
    charts.vibration = new Chart(vibrationCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Toplam İvme (g)',
                    data: [],
                    borderColor: '#ff9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Titreşim',
                    data: [],
                    borderColor: '#e91e63',
                    backgroundColor: 'rgba(233, 30, 99, 0.2)',
                    type: 'bar',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Toplam İvme (g)' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    max: 1,
                    min: 0,
                    title: { display: true, text: 'Titreşim (0/1)' },
                    grid: { drawOnChartArea: false }
                },
                x: {
                    title: { display: true, text: 'Zaman' }
                }
            }
        }
    });

    // Çevre grafik (sıcaklık & nem)
    const envCtx = document.getElementById('envChart').getContext('2d');
    charts.env = new Chart(envCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Sıcaklık (°C)',
                    data: [],
                    borderColor: '#ff5722',
                    backgroundColor: 'rgba(255, 87, 34, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Nem (%)',
                    data: [],
                    borderColor: '#00bcd4',
                    backgroundColor: 'rgba(0, 188, 212, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Sıcaklık (°C)' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    max: 100,
                    min: 0,
                    title: { display: true, text: 'Nem (%)' },
                    grid: { drawOnChartArea: false }
                },
                x: {
                    title: { display: true, text: 'Zaman' }
                }
            }
        }
    });

    // Mesafe grafik
    const distanceCtx = document.getElementById('distanceChart').getContext('2d');
    charts.distance = new Chart(distanceCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Mesafe (cm)',
                data: [],
                borderColor: '#9c27b0',
                backgroundColor: 'rgba(156, 39, 176, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Mesafe (cm)' }
                },
                x: {
                    title: { display: true, text: 'Zaman' }
                }
            }
        }
    });

    console.log('📊 Tüm grafikler başlatıldı');
}

// ThingSpeak'ten veri yükle
async function loadData() {
    try {
        updateConnectionStatus('loading', 'Veriler yükleniyor...');
        
        // Son verileri al (results=CONFIG.maxDataPoints)
        const url = `${CONFIG.baseUrl}/channels/${CONFIG.channelId}/feeds.json?api_key=${CONFIG.readApiKey}&results=${CONFIG.maxDataPoints}`;
        
        console.log(`📡 ThingSpeak'ten veri çekiliyor: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.feeds || data.feeds.length === 0) {
            throw new Error('Veri bulunamadı');
        }
        
        console.log(`✅ ${data.feeds.length} veri noktası alındı`);
        
        // Veriyi işle
        processData(data);
        
        // UI'yi güncelle
        updateUI(data.feeds[data.feeds.length - 1]); // Son veri
        updateCharts(data.feeds);
        updateStatistics(data.feeds);
        
        updateConnectionStatus('connected', `Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}`);
        isConnected = true;
        
    } catch (error) {
        console.error('❌ Veri yükleme hatası:', error);
        updateConnectionStatus('error', `Hata: ${error.message}`);
        isConnected = false;
    }
}

// Veriyi işle ve temizle
function processData(data) {
    latestData = {
        channel: data.channel,
        feeds: data.feeds.map(feed => {
            // Field2: MPU İvme "X,Y,Z" formatında parse et
            const mpuAccel = (feed.field2 || "0,0,0").split(',').map(v => parseFloat(v) || 0);
            // Field3: MPU Gyro "X,Y,Z" formatında parse et  
            const mpuGyro = (feed.field3 || "0,0,0").split(',').map(v => parseFloat(v) || 0);
            // Field4: MMA İvme "X,Y,Z" formatında parse et
            const mmaAccel = (feed.field4 || "0,0,0").split(',').map(v => parseFloat(v) || 0);
            
            return {
                created_at: new Date(feed.created_at),
                vibration: parseFloat(feed.field1) || 0,
                mpu_accel_x: mpuAccel[0],
                mpu_accel_y: mpuAccel[1], 
                mpu_accel_z: mpuAccel[2],
                mpu_gyro_x: mpuGyro[0],
                mpu_gyro_y: mpuGyro[1],
                mpu_gyro_z: mpuGyro[2],
                mma_accel_x: mmaAccel[0],
                mma_accel_y: mmaAccel[1],
                mma_accel_z: mmaAccel[2],
                distance: parseFloat(feed.field5) || 0,
                temperature: parseFloat(feed.field6) || 0,
                humidity: parseFloat(feed.field7) || 0,
                // Toplam ivme hesaplama
                mpu_total_accel: Math.sqrt(mpuAccel[0]**2 + mpuAccel[1]**2 + mpuAccel[2]**2),
                mma_total_accel: Math.sqrt(mmaAccel[0]**2 + mmaAccel[1]**2 + mmaAccel[2]**2)
            }
        })
    };
}

// Ana metrikleri güncelle
function updateUI(latestFeed) {
    if (!latestFeed) return;
    
    const timeStr = new Date(latestFeed.created_at).toLocaleTimeString('tr-TR');
    
    // Titreşim durumu
    const vibrationCard = document.getElementById('vibrationCard');
    const vibrationStatus = document.getElementById('vibrationStatus');
    const vibrationTime = document.getElementById('vibrationTime');
    
    if (latestFeed.vibration === 1) {
        vibrationStatus.textContent = 'TİTREŞİM ALGILANDI!';
        vibrationCard.classList.add('active');
        vibrationTime.textContent = `⚠️ ${timeStr}`;
    } else {
        vibrationStatus.textContent = 'Normal';
        vibrationCard.classList.remove('active');
        vibrationTime.textContent = `✅ ${timeStr}`;
    }
    
    // Toplam ivme - MPU ve MMA arasından büyük olanı göster
    const maxTotalAccel = Math.max(latestFeed.mpu_total_accel, latestFeed.mma_total_accel);
    const totalAccelValue = maxTotalAccel;
    document.getElementById('totalAccel').textContent = totalAccelValue === 0 ? 
        'Veri Bekleniyor...' : `${totalAccelValue.toFixed(3)} g`;
    
    document.getElementById('temperature').textContent = `${latestFeed.temperature.toFixed(1)} °C`;
    document.getElementById('humidity').textContent = `${latestFeed.humidity.toFixed(1)} %`;
    document.getElementById('distance').textContent = `${latestFeed.distance.toFixed(1)} cm`;
    
    // Zaman damgaları
    document.getElementById('accelTime').textContent = timeStr;
    document.getElementById('tempTime').textContent = timeStr;
    document.getElementById('humTime').textContent = timeStr;
    document.getElementById('distTime').textContent = timeStr;
}

// Grafikleri güncelle
function updateCharts(feeds) {
    const labels = feeds.map(feed => 
        new Date(feed.created_at).toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        })
    );
    
    // MPU6050 İvme grafik (X, Y, Z)
    charts.accel.data.labels = labels;
    charts.accel.data.datasets[0].data = feeds.map(feed => feed.mpu_accel_x);
    charts.accel.data.datasets[1].data = feeds.map(feed => feed.mpu_accel_y);
    charts.accel.data.datasets[2].data = feeds.map(feed => feed.mpu_accel_z);
    charts.accel.update('none');
    
    // MPU6050 Gyro grafik (X, Y, Z)
    charts.gyro.data.labels = labels;
    charts.gyro.data.datasets[0].data = feeds.map(feed => feed.mpu_gyro_x);
    charts.gyro.data.datasets[1].data = feeds.map(feed => feed.mpu_gyro_y);
    charts.gyro.data.datasets[2].data = feeds.map(feed => feed.mpu_gyro_z);
    charts.gyro.update('none');
    
    // MMA8451 İvme grafik (X, Y, Z)
    charts.mma.data.labels = labels;
    charts.mma.data.datasets[0].data = feeds.map(feed => feed.mma_accel_x);
    charts.mma.data.datasets[1].data = feeds.map(feed => feed.mma_accel_y);
    charts.mma.data.datasets[2].data = feeds.map(feed => feed.mma_accel_z);
    charts.mma.update('none');
    
    // Titreşim ve toplam ivme grafik
    charts.vibration.data.labels = labels;
    charts.vibration.data.datasets[0].data = feeds.map(feed => Math.max(feed.mpu_total_accel, feed.mma_total_accel));
    charts.vibration.data.datasets[1].data = feeds.map(feed => feed.vibration);
    charts.vibration.update('none');
    
    // Çevre grafik (Sıcaklık & Nem)
    charts.env.data.labels = labels;
    charts.env.data.datasets[0].data = feeds.map(feed => feed.temperature);
    charts.env.data.datasets[1].data = feeds.map(feed => feed.humidity);
    charts.env.update('none');
    
    // Mesafe grafik
    charts.distance.data.labels = labels;
    charts.distance.data.datasets[0].data = feeds.map(feed => feed.distance);
    charts.distance.update('none');
}

// İstatistikleri hesapla ve güncelle
function updateStatistics(feeds) {
    if (feeds.length === 0) return;        // Son 24 saat filtrele (ThingSpeak'te zaten filtrelenmiş olabilir)
        const now = new Date();
        const last24h = feeds.filter(feed => {
            const feedTime = new Date(feed.created_at);
            return (now - feedTime) <= 24 * 60 * 60 * 1000;
        });
        
        // İstatistikleri hesapla
        const totalVibrations = last24h.filter(feed => feed.vibration === 1).length;
        const accelValues = last24h.map(feed => Math.max(feed.mpu_total_accel, feed.mma_total_accel));
        const maxAccel = Math.max(...accelValues);
        const tempValues = last24h.map(feed => feed.temperature).filter(t => t > 0);
        const avgTemp = tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : 0;
    
    // UI'yi güncelle
    document.getElementById('totalVibrations').textContent = totalVibrations;
    document.getElementById('maxAccel').textContent = `${maxAccel.toFixed(3)} g`;
    document.getElementById('avgTemp').textContent = `${avgTemp.toFixed(1)} °C`;
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('tr-TR');
    
    // Alarm durumu
    updateAlarmStatus(maxAccel, totalVibrations);
}

// Alarm durumunu güncelle
function updateAlarmStatus(maxAccel, totalVibrations) {
    const alarmStatus = document.getElementById('alarmStatus');
    const alarmIndicator = document.getElementById('alarmIndicator');
    const alarmText = document.getElementById('alarmText');
    const alarmDetails = document.getElementById('alarmDetails');
    
    // Reset classes
    alarmStatus.className = 'alarm-status';
    alarmIndicator.className = 'alarm-indicator';
    
    if (maxAccel > 2.0 || totalVibrations > 10) {
        // Kritik durum
        alarmStatus.classList.add('critical');
        alarmIndicator.classList.add('critical');
        alarmText.textContent = 'KRİTİK';
        alarmDetails.innerHTML = `
            <p><strong>⚠️ Yüksek seviyeli titreşim algılandı!</strong></p>
            <p>Maksimum ivme: ${maxAccel.toFixed(3)} g</p>
            <p>Son 24 saatte ${totalVibrations} titreşim kaydedildi.</p>
        `;
    } else if (maxAccel > 1.0 || totalVibrations > 3) {
        // Uyarı
        alarmStatus.classList.add('warning');
        alarmIndicator.classList.add('warning');
        alarmText.textContent = 'UYARI';
        alarmDetails.innerHTML = `
            <p><strong>⚠️ Orta seviyeli aktivite detected.</strong></p>
            <p>Maksimum ivme: ${maxAccel.toFixed(3)} g</p>
            <p>Son 24 saatte ${totalVibrations} titreşim kaydedildi.</p>
        `;
    } else {
        // Normal
        alarmStatus.classList.add('normal');
        alarmIndicator.classList.add('normal');
        alarmText.textContent = 'Normal';
        alarmDetails.innerHTML = `
            <p>✅ Sistem normal çalışıyor.</p>
            <p>Kritik titreşim algılanmadı.</p>
            <p>Son 24 saatte ${totalVibrations} minor titreşim kaydedildi.</p>
        `;
    }
}

// Bağlantı durumunu güncelle
function updateConnectionStatus(status, message) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    // Reset classes
    statusDot.className = 'status-dot';
    
    switch (status) {
        case 'connected':
            statusDot.classList.add('connected');
            break;
        case 'error':
            statusDot.classList.add('error');
            break;
        case 'loading':
        default:
            // Keep default orange color
            break;
    }
    
    statusText.textContent = message;
}

// Hata durumunda retry
window.addEventListener('online', function() {
    if (!isConnected) {
        console.log('🌐 İnternet bağlantısı geri geldi, veri yükleniyor...');
        loadData();
    }
});

// Debug için global olarak expose et
window.dashboardDebug = {
    config: CONFIG,
    latestData: () => latestData,
    charts: charts,
    loadData: loadData
};
