import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from server.app import OrderStore, make_http_server, load_menu_catalog

ROOT = Path(__file__).resolve().parents[1]
MENU_PATH = ROOT / 'docs' / 'data' / 'menu.json'
ORIGIN = 'https://arst113.github.io'

class BackendHttpTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = OrderStore(MENU_PATH, Path(self.tmp.name) / 'orders.db')
        self.server = make_http_server(self.store, '127.0.0.1', 0, ORIGIN)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_address[1]}'
        menu = load_menu_catalog(MENU_PATH)
        self.pizza = next(x for x in menu if x['name'] == 'Маргарита')

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.store.close()
        self.tmp.cleanup()

    def request(self, path, method='GET', payload=None, origin=ORIGIN):
        data = None if payload is None else json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(self.base + path, method=method, data=data)
        if data is not None:
            req.add_header('Content-Type', 'application/json')
        if origin:
            req.add_header('Origin', origin)
        try:
            with urllib.request.urlopen(req, timeout=3) as resp:
                body = json.loads(resp.read().decode('utf-8'))
                return resp.status, dict(resp.headers), body
        except urllib.error.HTTPError as exc:
            body = json.loads(exc.read().decode('utf-8'))
            return exc.code, dict(exc.headers), body

    def test_health_and_cors(self):
        status, headers, body = self.request('/health')
        self.assertEqual(status, 200)
        self.assertEqual(body, {'ok': True})
        self.assertEqual(headers.get('Access-Control-Allow-Origin'), ORIGIN)

    def test_create_get_update_and_list_flow(self):
        status, _, created = self.request('/orders', 'POST', {
            'name': 'Маша',
            'items': [{'id': self.pizza['id'], 'qty': 1}],
            'price': 1,
        })
        self.assertEqual(status, 201)
        self.assertEqual(created['order']['total'], self.pizza['price'])
        order_id = created['order']['orderId']
        token = created['order']['editToken']
        query = urllib.parse.urlencode({'token': token})
        status, _, own = self.request(f'/orders/{order_id}?{query}')
        self.assertEqual(status, 200)
        self.assertEqual(own['order']['name'], 'Маша')
        status, _, updated = self.request(f'/orders/{order_id}', 'PUT', {
            'token': token,
            'name': 'Маша',
            'items': [{'id': self.pizza['id'], 'qty': 2}],
        })
        self.assertEqual(status, 200)
        self.assertEqual(updated['order']['total'], self.pizza['price'] * 2)
        status, _, aggregate = self.request('/orders')
        self.assertEqual(status, 200)
        self.assertEqual(aggregate['participantCount'], 1)
        self.assertEqual(aggregate['grandTotal'], self.pizza['price'] * 2)

    def test_validation_and_bad_token_errors_are_json(self):
        status, _, bad = self.request('/orders', 'POST', {'name': '', 'items': []})
        self.assertEqual(status, 400)
        self.assertIn('error', bad)
        _, _, created = self.request('/orders', 'POST', {'name': 'Ира', 'items': [{'id': self.pizza['id'], 'qty': 1}]})
        order_id = created['order']['orderId']
        status, _, denied = self.request(f'/orders/{order_id}', 'PUT', {
            'token': 'wrong',
            'items': [{'id': self.pizza['id'], 'qty': 1}],
        })
        self.assertEqual(status, 403)
        self.assertIn('error', denied)

    def test_options_and_disallowed_origin(self):
        req = urllib.request.Request(self.base + '/orders', method='OPTIONS')
        req.add_header('Origin', ORIGIN)
        with urllib.request.urlopen(req, timeout=3) as resp:
            self.assertEqual(resp.status, 204)
            self.assertEqual(resp.headers.get('Access-Control-Allow-Origin'), ORIGIN)
            self.assertIn('POST', resp.headers.get('Access-Control-Allow-Methods', ''))
        status, headers, _ = self.request('/health', origin='https://evil.example')
        self.assertEqual(status, 200)
        self.assertIsNone(headers.get('Access-Control-Allow-Origin'))

if __name__ == '__main__':
    unittest.main()
