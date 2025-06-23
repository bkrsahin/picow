import socket
import json
import time
import gc

class WebServer:
    def __init__(self, port=80):
        self.port = port
        self.socket = None
        self.latest_data = {}
        
    def start(self):
        """Web server'ı başlat"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.socket.bind(('', self.port))
            self.socket.listen(5)
            self.socket.settimeout(1.0)  # Non-blocking için timeout
            print(f"Web server başlatıldı, port: {self.port}")
            return True
        except Exception as e:
            print(f"Web server başlatma hatası: {e}")
            return False
    
    def update_data(self, vibration_status, mpu_data, mma_data, distance, temp, hum):
        """Sensör verilerini güncelle"""
        self.latest_data = {
            "timestamp": time.ticks_ms(),
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
    
    def handle_requests(self):
        """Gelen istekleri işle"""
        try:
            conn, addr = self.socket.accept()
            conn.settimeout(5.0)
            
            # İsteği oku
            request = conn.recv(1024).decode('utf-8')
            
            if not request:
                conn.close()
                return
            
            # İstek tipini belirle
            request_line = request.split('\n')[0]
            path = request_line.split(' ')[1] if len(request_line.split(' ')) > 1 else '/'
            
            # Yanıtı hazırla
            if path == '/' or path == '/dashboard.html':
                response = self.serve_file('dashboard.html', 'text/html')
            elif path == '/style.css':
                response = self.serve_file('style.css', 'text/css')
            elif path == '/script.js':
                response = self.serve_file('script.js', 'application/javascript')
            elif path == '/data':
                response = self.serve_json_data()
            elif path == '/jsondata':
                response = self.serve_simple_report()
            elif path == '/stats':
                response = self.serve_stats()
            elif path == '/latest':
                response = self.serve_latest()
            else:
                response = self.serve_404()
            
            # Yanıtı gönder
            conn.send(response.encode('utf-8'))
            conn.close()
            
        except OSError:
            # Timeout veya bağlantı hatası - normal
            pass
        except Exception as e:
            print(f"İstek işleme hatası: {e}")
            try:
                conn.close()
            except:
                pass
    
    def serve_file(self, filename, content_type):
        """Dosya servis et"""
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                content = f.read()
            
            response = f"""HTTP/1.1 200 OK
Content-Type: {content_type}; charset=utf-8
Content-Length: {len(content.encode('utf-8'))}
Connection: close

{content}"""
            return response
        except:
            return self.serve_404()
    
    def serve_json_data(self):
        """JSON veri servis et"""
        try:
            json_data = json.dumps(self.latest_data)
            response = f"""HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: {len(json_data)}
Connection: close

{json_data}"""
            return response
        except Exception as e:
            print(f"JSON veri servis hatası: {e}")
            return self.serve_404()
    
    def serve_404(self):
        """404 hatası servis et"""
        content = """<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body><h1>404 - Sayfa Bulunamadı</h1></body>
</html>"""
        response = f"""HTTP/1.1 404 Not Found
Content-Type: text/html
Content-Length: {len(content)}
Connection: close

{content}"""
        return response
    
    def stop(self):
        """Web server'ı durdur"""
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
        print("Web server durduruldu")
    
    def cleanup(self):
        """Bellek temizliği"""
        gc.collect()
    
    def read_json_file(self):
        """JSON dosyasından son verileri oku"""
        try:
            with open("sensor_data.json", "r") as f:
                lines = f.readlines()
            
            # Son 10 veriyi al
            data_entries = []
            for line in lines[-20:]:  # Son 20 satır (çünkü aralarında çizgi var)
                line = line.strip()
                if line and not line.startswith('-'):
                    try:
                        import json
                        data = json.loads(line)
                        data_entries.append(data)
                    except:
                        continue
            
            return data_entries[-10:]  # Son 10 veri
        except:
            return []
    
    def serve_simple_report(self):
        """Ultra basit JSON verileri raporu"""
        data_entries = self.read_json_file()
        
        html = """<html><head><title>JSON Verileri</title></head><body>
<h1>KAYDEDILEN JSON VERILERI</h1>
<p><a href="/">Ana Dashboard'a Don</a></p>
<h2>SON 10 KAYIT</h2>
<table border="1" style="border-collapse: collapse; width: 100%;">
<tr style="background-color: #f0f0f0;">
<th>Zaman</th><th>Titresim</th><th>MPU X</th><th>MPU Y</th><th>MPU Z</th><th>MMA X</th><th>MMA Y</th><th>MMA Z</th><th>Mesafe</th><th>Sicaklik</th><th>Nem</th>
</tr>"""
        
        for data in data_entries:
            timestamp = data.get('timestamp', 0)
            vibration = "EVET" if data.get('vibration', 0) == 1 else "HAYIR"
            mpu = data.get('mpu6050', {}).get('accel', {'x': 0, 'y': 0, 'z': 0})
            mma = data.get('mma8451', {}).get('accel', {'x': 0, 'y': 0, 'z': 0})
            distance = data.get('distance', 0)
            temp = data.get('temperature', 0)
            hum = data.get('humidity', 0)
            
            style = "background-color: #ffeeee;" if vibration == "EVET" else ""
            html += f'<tr style="{style}"><td>{timestamp}</td><td><b>{vibration}</b></td><td>{mpu["x"]:.2f}</td><td>{mpu["y"]:.2f}</td><td>{mpu["z"]:.2f}</td><td>{mma["x"]:.2f}</td><td>{mma["y"]:.2f}</td><td>{mma["z"]:.2f}</td><td>{distance:.1f}</td><td>{temp}</td><td>{hum}</td></tr>'
        
        if not data_entries:
            html += '<tr><td colspan="11">Henuz veri yok</td></tr>'
        
        html += """</table>
<br>
<p><a href="/">Ana Dashboard'a Don</a> | <a href="/stats">Istatistikler</a></p>
</body></html>"""
        
        response = f"""HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: {len(html)}
Connection: close

{html}"""
        return response
    
    def serve_stats(self):
        """Ultra basit istatistik sayfası"""
        data_entries = self.read_json_file()
        
        if not data_entries:
            html = "<html><body><h1>VERI YOK</h1><p><a href='/'>Ana Dashboard'a Don</a></p></body></html>"
        else:
            total = len(data_entries)
            vibrations = sum(1 for d in data_entries if d.get('vibration', 0) == 1)
            
            # Ortalama değerler
            avg_temp = sum(d.get('temperature', 0) for d in data_entries) / total
            avg_hum = sum(d.get('humidity', 0) for d in data_entries) / total
            avg_dist = sum(d.get('distance', 0) for d in data_entries) / total
            
            html = f"""<html><head><title>JSON Veri Istatistikleri</title></head><body>
<h1>JSON VERI ISTATISTIKLERI</h1>
<p><a href="/">Ana Dashboard'a Don</a></p>
<table border="1" style="border-collapse: collapse;">
<tr><td><b>Toplam Kayit</b></td><td>{total}</td></tr>
<tr><td><b>Titresim Sayisi</b></td><td>{vibrations}</td></tr>
<tr><td><b>Titresim Orani</b></td><td>{vibrations/total*100:.1f}%</td></tr>
<tr><td><b>Ortalama Sicaklik</b></td><td>{avg_temp:.1f} °C</td></tr>
<tr><td><b>Ortalama Nem</b></td><td>{avg_hum:.1f} %</td></tr>
<tr><td><b>Ortalama Mesafe</b></td><td>{avg_dist:.1f} cm</td></tr>
</table>
<br>
<p><a href="/">Ana Dashboard'a Don</a> | <a href="/jsondata">JSON Verileri</a></p>
</body></html>"""
        
        response = f"""HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: {len(html)}
Connection: close

{html}"""
        return response
    
    def serve_latest(self):
        """En son veri"""
        html = f"""<html><head><title>Son Veri</title></head><body>
<h1>CANLI VERI</h1>
<p>TITRESIM: {"EVET" if self.latest_data.get('vibration', 0) == 1 else "HAYIR"}</p>
<p>MPU X: {self.latest_data.get('mpu6050', {}).get('accel', {}).get('x', 0):.2f}</p>
<p>MPU Y: {self.latest_data.get('mpu6050', {}).get('accel', {}).get('y', 0):.2f}</p>
<p>MPU Z: {self.latest_data.get('mpu6050', {}).get('accel', {}).get('z', 0):.2f}</p>
<p>MESAFE: {self.latest_data.get('distance', 0):.1f} cm</p>
<p>SICAKLIK: {self.latest_data.get('temperature', 0)} C</p>
<p>NEM: {self.latest_data.get('humidity', 0)} %</p>
<p><a href="/report">RAPOR</a> | <a href="/">ANA SAYFA</a></p>
</body></html>"""
        
        response = f"""HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: {len(html)}
Connection: close

{html}"""
        return response
