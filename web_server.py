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
