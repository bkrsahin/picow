// Dashboard JavaScript - ThingSpeak API Integration

// ThingSpeak Konfigürasyonu
const CONFIG = {
    channelId: '2996256', // main.py'den alınan channel ID
    readApiKey: 'E7RN2WP7L12MNTYQ',
    updateInterval: 8000, // 8 saniye (hızlı dashboard yanıtı)
    fastUpdateInterval: 5000, // 5 saniye (kritik durumda - ThingSpeak limit dikkate alınarak)
    maxDataPoints: 50, // Grafiklerde gösterilecek maksimum veri sayısı
    baseUrl: 'https://api.thingspeak.com',
    criticalMode: false // Kritik durum takibi
};

// Global değişkenler
let charts = {};
let latestData = {};
let isConnected = false;
let updateTimer = null; // Timer kontrolü için
let consecutiveErrors = 0; // Hata sayacı
let lastVibrationTime = 0; // Son titreşim zamanı

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
    
    // Akıllı güncelleme sistemi başlat
    startAdaptiveUpdates();
    
    console.log(`✅ Dashboard hazır! Akıllı güncelleme sistemi aktif.`);
});

// Akıllı güncelleme sistemi
function startAdaptiveUpdates() {
    function scheduleNextUpdate() {
        // Kritik durumda daha hızlı güncelle
        const interval = CONFIG.criticalMode ? CONFIG.fastUpdateInterval : CONFIG.updateInterval;
        
        updateTimer = setTimeout(() => {
            loadData().then(() => {
                scheduleNextUpdate(); // Rekursif olarak devam et
            }).catch(() => {
                // Hata durumunda biraz bekle ve tekrar dene
                setTimeout(scheduleNextUpdate, 5000);
            });
        }, interval);
    }
    
    scheduleNextUpdate();
}

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
        
        // UI'yi güncelle - son işlenmiş veriyi kullan
        if (latestData.feeds && latestData.feeds.length > 0) {
            const latestFeed = latestData.feeds[latestData.feeds.length - 1];
            
            // Kritik durum kontrolü - titreşim algılandıysa hızlı moda geç
            checkCriticalStatus(latestFeed);
            
            updateUI(latestFeed); 
            updateCharts(latestData.feeds);
            updateStatistics(latestData.feeds);
        }
        
        const currentTime = new Date().toLocaleTimeString('tr-TR');
        const interval = CONFIG.criticalMode ? CONFIG.fastUpdateInterval/1000 : CONFIG.updateInterval/1000;
        updateConnectionStatus('connected', `Son güncelleme: ${currentTime} (${interval}s aralık)`);
        isConnected = true;
        consecutiveErrors = 0; // Başarılı veri yükleme sonrası hata sayacını sıfırla
        
    } catch (error) {
        console.error('❌ Veri yükleme hatası:', error);
        consecutiveErrors++;
        
        // Rate limit durumu kontrolü
        if (error.message.includes('429') || error.message.includes('rate')) {
            updateConnectionStatus('error', `ThingSpeak rate limit - ${CONFIG.updateInterval/1000}s aralıkla deneniyor`);
        }
        // Çok fazla hata varsa güncelleme aralığını artır
        else if (consecutiveErrors > 3) {
            CONFIG.updateInterval = Math.min(CONFIG.updateInterval * 1.5, 60000); // Max 60s
            console.log(`⚠️ Çok fazla hata, güncelleme aralığı artırıldı: ${CONFIG.updateInterval/1000}s`);
            updateConnectionStatus('error', `Bağlantı sorunu - ${CONFIG.updateInterval/1000}s aralıkla deneniyor`);
        } else {
            updateConnectionStatus('error', `Hata: ${error.message}`);
        }
        
        isConnected = false;
        throw error; // Hata durumunu üst fonksiyona ilet
    }
}

// Kritik durum kontrolü
function checkCriticalStatus(latestFeed) {
    const currentTime = Date.now();
    const wasInCriticalMode = CONFIG.criticalMode;
    
    // Titreşim algılandıysa kritik moda geç
    if (latestFeed.vibration === 1) {
        CONFIG.criticalMode = true;
        lastVibrationTime = currentTime;
        console.log('🚨 KRİTİK MOD AKTİF - Hızlı güncelleme başladı');
    }
    // 30 saniye sonra normal moda dön
    else if (CONFIG.criticalMode && currentTime - lastVibrationTime > 30000) {
        CONFIG.criticalMode = false;
        console.log('✅ Normal moda geçildi - Standart güncelleme aralığı');
    }
    
    // Yüksek ivme değerleri kontrolü
    const maxAccel = Math.max(latestFeed.mpu_total_accel || 0, latestFeed.mma_total_accel || 0);
    if (maxAccel > 2.0) {
        CONFIG.criticalMode = true;
        lastVibrationTime = currentTime;
        console.log(`🚨 YÜKSEK İVME ALGILANDI: ${maxAccel.toFixed(3)}g - Kritik mod aktif`);
    }
    
    // Mod değişikliği log
    if (wasInCriticalMode !== CONFIG.criticalMode) {
        const interval = CONFIG.criticalMode ? CONFIG.fastUpdateInterval : CONFIG.updateInterval;
        console.log(`🔄 Güncelleme modu değişti: ${interval/1000}s aralık`);
    }
}

// Veriyi işle ve temizle
function processData(data) {
    latestData = {
        channel: data.channel,
        feeds: data.feeds.map(feed => {
            // Hibrit parsing: Hem eski tek-değer hem yeni X,Y,Z formatını destekle
            let mpuAccel, mpuGyro, mmaAccel;
            
            // Field2: MPU İvme - eğer virgül varsa X,Y,Z formatı, yoksa tek değer
            if (feed.field2 && (feed.field2.includes(',') || feed.field2.includes('%2C'))) {
                // URL decode edilmiş virgülleri handle et
                const field2Clean = feed.field2.replace(/%2C/g, ',');
                mpuAccel = field2Clean.split(',').map(v => parseFloat(v) || 0);
            } else {
                // Eski format: tek değer - bunu X ekseni olarak kullan, Y ve Z'yi 0 yap
                const singleValue = parseFloat(feed.field2) || 0;
                mpuAccel = [singleValue, 0, 0];
            }
            
            // Field3: MPU Gyro - aynı hibrit yaklaşım
            if (feed.field3 && (feed.field3.includes(',') || feed.field3.includes('%2C'))) {
                const field3Clean = feed.field3.replace(/%2C/g, ',');
                mpuGyro = field3Clean.split(',').map(v => parseFloat(v) || 0);
            } else {
                const singleValue = parseFloat(feed.field3) || 0;
                mpuGyro = [singleValue, 0, 0];
            }
            
            // Field4: MMA İvme - aynı hibrit yaklaşım
            if (feed.field4 && (feed.field4.includes(',') || feed.field4.includes('%2C'))) {
                const field4Clean = feed.field4.replace(/%2C/g, ',');
                mmaAccel = field4Clean.split(',').map(v => parseFloat(v) || 0);
            } else {
                const singleValue = parseFloat(feed.field4) || 0;
                mmaAccel = [singleValue, 0, 0];
            }
            
            // 3-elementli dizi garantisi (güvenlik kontrolü)
            while (mpuAccel.length < 3) mpuAccel.push(0);
            while (mpuGyro.length < 3) mpuGyro.push(0);
            while (mmaAccel.length < 3) mmaAccel.push(0);
            
            return {
                created_at: new Date(feed.created_at),
                vibration: parseFloat(feed.field1) || 0,
                mpu_accel_x: mpuAccel[0] || 0,
                mpu_accel_y: mpuAccel[1] || 0, 
                mpu_accel_z: mpuAccel[2] || 0,
                mpu_gyro_x: mpuGyro[0] || 0,
                mpu_gyro_y: mpuGyro[1] || 0,
                mpu_gyro_z: mpuGyro[2] || 0,
                mma_accel_x: mmaAccel[0] || 0,
                mma_accel_y: mmaAccel[1] || 0,
                mma_accel_z: mmaAccel[2] || 0,
                distance: parseFloat(feed.field5) || 0,
                temperature: parseFloat(feed.field6) || 0,
                humidity: parseFloat(feed.field7) || 0,
                // Toplam ivme hesaplama - null check eklendi
                mpu_total_accel: Math.sqrt((mpuAccel[0]||0)**2 + (mpuAccel[1]||0)**2 + (mpuAccel[2]||0)**2),
                mma_total_accel: Math.sqrt((mmaAccel[0]||0)**2 + (mmaAccel[1]||0)**2 + (mmaAccel[2]||0)**2)
            }
        })
    };
}

// Ana metrikleri güncelle
function updateUI(latestFeed) {
    if (!latestFeed) return;
    
    // Son işlenmiş veriyi al
    const processedFeeds = latestData.feeds;
    if (!processedFeeds || processedFeeds.length === 0) return;
    
    const latestProcessed = processedFeeds[processedFeeds.length - 1];
    const timeStr = latestProcessed.created_at.toLocaleTimeString('tr-TR');
    
    // Titreşim durumu
    const vibrationCard = document.getElementById('vibrationCard');
    const vibrationStatus = document.getElementById('vibrationStatus');
    const vibrationTime = document.getElementById('vibrationTime');
    
    if (latestProcessed.vibration === 1) {
        vibrationStatus.textContent = 'TİTREŞİM ALGILANDI!';
        vibrationCard.classList.add('active');
        vibrationTime.textContent = `⚠️ ${timeStr}`;
    } else {
        vibrationStatus.textContent = 'Normal';
        vibrationCard.classList.remove('active');
        vibrationTime.textContent = `✅ ${timeStr}`;
    }
    
    // Toplam ivme - MPU ve MMA arasından büyük olanı göster
    const maxTotalAccel = Math.max(latestProcessed.mpu_total_accel || 0, latestProcessed.mma_total_accel || 0);
    document.getElementById('totalAccel').textContent = maxTotalAccel === 0 ? 
        'Veri Bekleniyor...' : `${maxTotalAccel.toFixed(3)} g`;
    
    document.getElementById('temperature').textContent = `${(latestProcessed.temperature || 0).toFixed(1)} °C`;
    document.getElementById('humidity').textContent = `${(latestProcessed.humidity || 0).toFixed(1)} %`;
    document.getElementById('distance').textContent = `${(latestProcessed.distance || 0).toFixed(1)} cm`;
    
    // Zaman damgaları
    document.getElementById('accelTime').textContent = timeStr;
    document.getElementById('tempTime').textContent = timeStr;
    document.getElementById('humTime').textContent = timeStr;
    document.getElementById('distTime').textContent = timeStr;
}

// Grafikleri güncelle
function updateCharts(feeds) {
    if (!feeds || feeds.length === 0) {
        console.log('⚠️ Grafik güncellemesi için veri yok');
        return;
    }
    
    const labels = feeds.map(feed => 
        feed.created_at.toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        })
    );
    
    // Veri sayısını sınırla (performans için)
    const maxPoints = CONFIG.maxDataPoints;
    const limitedFeeds = feeds.slice(-maxPoints);
    const limitedLabels = labels.slice(-maxPoints);
    
    // Batch güncelleme ile performans artışı
    const updates = [];
    
    // MPU6050 İvme grafik (X, Y, Z) - null safety eklendi
    if (charts.accel) {
        charts.accel.data.labels = limitedLabels;
        charts.accel.data.datasets[0].data = limitedFeeds.map(feed => feed.mpu_accel_x || 0);
        charts.accel.data.datasets[1].data = limitedFeeds.map(feed => feed.mpu_accel_y || 0);
        charts.accel.data.datasets[2].data = limitedFeeds.map(feed => feed.mpu_accel_z || 0);
        updates.push(() => charts.accel.update('none'));
    }
    
    // MPU6050 Gyro grafik (X, Y, Z) - null safety eklendi
    if (charts.gyro) {
        charts.gyro.data.labels = limitedLabels;
        charts.gyro.data.datasets[0].data = limitedFeeds.map(feed => feed.mpu_gyro_x || 0);
        charts.gyro.data.datasets[1].data = limitedFeeds.map(feed => feed.mpu_gyro_y || 0);
        charts.gyro.data.datasets[2].data = limitedFeeds.map(feed => feed.mpu_gyro_z || 0);
        updates.push(() => charts.gyro.update('none'));
    }
    
    // MMA8451 İvme grafik (X, Y, Z) - null safety eklendi
    if (charts.mma) {
        charts.mma.data.labels = limitedLabels;
        charts.mma.data.datasets[0].data = limitedFeeds.map(feed => feed.mma_accel_x || 0);
        charts.mma.data.datasets[1].data = limitedFeeds.map(feed => feed.mma_accel_y || 0);
        charts.mma.data.datasets[2].data = limitedFeeds.map(feed => feed.mma_accel_z || 0);
        updates.push(() => charts.mma.update('none'));
    }
    
    // Titreşim ve toplam ivme grafik - null safety eklendi
    if (charts.vibration) {
        charts.vibration.data.labels = limitedLabels;
        charts.vibration.data.datasets[0].data = limitedFeeds.map(feed => 
            Math.max(feed.mpu_total_accel || 0, feed.mma_total_accel || 0)
        );
        charts.vibration.data.datasets[1].data = limitedFeeds.map(feed => feed.vibration || 0);
        updates.push(() => charts.vibration.update('none'));
    }
    
    // Çevre grafik (Sıcaklık & Nem) - null safety eklendi
    if (charts.env) {
        charts.env.data.labels = limitedLabels;
        charts.env.data.datasets[0].data = limitedFeeds.map(feed => feed.temperature || 0);
        charts.env.data.datasets[1].data = limitedFeeds.map(feed => feed.humidity || 0);
        updates.push(() => charts.env.update('none'));
    }
    
    // Mesafe grafik - null safety eklendi
    if (charts.distance) {
        charts.distance.data.labels = limitedLabels;
        charts.distance.data.datasets[0].data = limitedFeeds.map(feed => feed.distance || 0);
        updates.push(() => charts.distance.update('none'));
    }
    
    // Tüm grafikleri batch olarak güncelle
    requestAnimationFrame(() => {
        updates.forEach(update => update());
        console.log(`📊 ${updates.length} grafik güncellendi, ${limitedFeeds.length} veri noktası`);
    });
}

// İstatistikleri hesapla ve güncelle
function updateStatistics(feeds) {
    if (!feeds || feeds.length === 0) {
        console.log('⚠️ İstatistik hesaplaması için veri yok');
        return;
    }
    
    try {
        // Son 24 saat filtrele (ThingSpeak'te zaten filtrelenmiş olabilir)
        const now = new Date();
        const last24h = feeds.filter(feed => {
            const feedTime = new Date(feed.created_at);
            return (now - feedTime) <= 24 * 60 * 60 * 1000;
        });
        
        // İstatistikleri hesapla - null safety eklendi
        const totalVibrations = last24h.filter(feed => (feed.vibration || 0) === 1).length;
        
        const accelValues = last24h.map(feed => {
            const mpuTotal = feed.mpu_total_accel || 0;
            const mmaTotal = feed.mma_total_accel || 0;
            return Math.max(mpuTotal, mmaTotal);
        }).filter(val => val > 0); // Sıfır değerleri filtrele
        
        const maxAccel = accelValues.length > 0 ? Math.max(...accelValues) : 0;
        
        const tempValues = last24h
            .map(feed => feed.temperature || 0)
            .filter(t => t > 0); // Sıfır olmayan sıcaklıklar
            
        const avgTemp = tempValues.length > 0 ? 
            tempValues.reduce((a, b) => a + b, 0) / tempValues.length : 0;
    
        // UI'yi güncelle - safe values
        document.getElementById('totalVibrations').textContent = totalVibrations;
        document.getElementById('maxAccel').textContent = maxAccel === 0 ? 
            'Veri Bekleniyor...' : `${maxAccel.toFixed(3)} g`;
        document.getElementById('avgTemp').textContent = avgTemp === 0 ?
            'Veri Bekleniyor...' : `${avgTemp.toFixed(1)} °C`;
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('tr-TR');
        
        // Alarm durumu
        updateAlarmStatus(maxAccel, totalVibrations);
        
        console.log(`📈 İstatistikler güncellendi: ${totalVibrations} titreşim, max ivme: ${maxAccel.toFixed(3)}g`);
        
    } catch (error) {
        console.error('❌ İstatistik hesaplama hatası:', error);
        // Hata durumunda varsayılan değerler
        document.getElementById('totalVibrations').textContent = 'Hata';
        document.getElementById('maxAccel').textContent = 'Hata';
        document.getElementById('avgTemp').textContent = 'Hata';
    }
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

// Page Visibility API - sayfa görünür değilken güncellemeyi yavaşlat
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        console.log('👁️ Sayfa gizlendi, güncelleme yavaşlatıldı');
        // Güncelleme aralığını 2x artır
        if (updateTimer) {
            clearTimeout(updateTimer);
            setTimeout(() => startAdaptiveUpdates(), CONFIG.updateInterval * 2);
        }
    } else {
        console.log('👁️ Sayfa görünür oldu, normal güncelleme devam ediyor');
        // Normal güncellemeye geri dön
        if (updateTimer) {
            clearTimeout(updateTimer);
            startAdaptiveUpdates();
        }
    }
});

// Debug için global olarak expose et
window.dashboardDebug = {
    config: CONFIG,
    latestData: () => latestData,
    charts: charts,
    loadData: loadData
};
