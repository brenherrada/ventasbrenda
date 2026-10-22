"""Local review only. Never writes to Google; UI fixtures are explicitly opt-in."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.request import urlopen
import json
import subprocess

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / 'output/qa/collective/response.json'
class Preview(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def fixture(self):
        return json.loads(FIXTURE.read_text()) if FIXTURE.exists() else {}
    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        if self.path.startswith('/api/catalog?sheet=Config'):
            fixture = self.fixture()
            if 'flag' in fixture or 'config_status' in fixture:
                return self.reply(fixture.get('config_status', 200), {'table': {'rows': [{'c': [{'v':'mostrar_boton_vender'}, {'v':fixture.get('flag', 'si')}]}]}})
            try:
                with urlopen('https://plottwistcolectivo.ar/api/catalog?sheet=Config', timeout=20) as response:
                    return self.reply(200, json.load(response))
            except Exception:
                return self.reply(503, {'error':'config_unavailable'})
        if self.path.split('?')[0] == '/' and self.fixture().get('registration_status') == 200:
            page = (ROOT / 'dist/index.html').read_text().replace('<body>', '<body><aside class="site-alert" role="note">VISTA PREVIA LOCAL · LOS ENVÍOS DE PRUEBA NO SE GUARDAN EN GOOGLE</aside>')
            body = page.encode()
            self.send_response(200); self.send_header('Content-Type', 'text/html; charset=utf-8'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
            return
        super().do_GET()
    def do_POST(self):
        size = int(self.headers.get('Content-Length', '0'))
        if size > 4 * 1024 * 1024: return self.reply(413, {'error':'too_large'})
        data = self.rfile.read(size)
        fixture = self.fixture()
        if self.path == '/api/waitlist':
            status = fixture.get('registration_status', 403)
            return self.reply(status, {'ok':True, 'intakeToken':'local-ui-fixture-only'} if status == 200 else {'error':'preview_registration_disabled'})
        if self.path == '/api/product-intake' and fixture.get('registration_status') == 200:
            status = fixture.get('product_status', 200)
            if status != 200: return self.reply(status, {'error':'session_expired' if status == 401 else 'temporarily_unavailable'})
            try:
                result = subprocess.run(['node', str(ROOT / 'scripts/preview-product.mjs'), self.headers['Content-Type']], input=data, capture_output=True, timeout=20, cwd=ROOT)
                return self.reply(200 if result.returncode == 0 else 400, json.loads(result.stdout))
            except Exception: return self.reply(400, {'error':'invalid_product'})
        self.reply(403, {'error':'preview_writes_disabled'})

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 8765), Preview)
    print('Collective review: http://localhost:8765 — Google writes disabled.', flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
