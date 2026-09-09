import tempfile
import unittest
from pathlib import Path

from server.app import OrderStore, ValidationError, PermissionDenied, load_menu_catalog

ROOT = Path(__file__).resolve().parents[1]
MENU_PATH = ROOT / 'docs' / 'data' / 'menu.json'

class BackendStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp.name) / 'orders.db'
        self.store = OrderStore(MENU_PATH, self.db_path)
        self.menu = load_menu_catalog(MENU_PATH)
        self.by_name = {x['name']: x for x in self.menu}

    def tearDown(self):
        self.store.close()
        self.tmp.cleanup()

    def test_create_order_uses_server_prices(self):
        pizza = self.by_name['Маргарита']
        fries = self.by_name['Картофель Фри']
        created = self.store.create_order('Маша', [
            {'id': pizza['id'], 'qty': 1},
            {'id': fries['id'], 'qty': 2},
        ])
        self.assertEqual(created['name'], 'Маша')
        self.assertEqual(created['total'], 569 + 295 * 2)
        self.assertEqual(created['itemCount'], 3)
        self.assertTrue(created['orderId'])
        self.assertTrue(created['editToken'])

    def test_rejects_invalid_name_empty_order_unknown_item_and_bad_qty(self):
        item = self.by_name['Маргарита']
        with self.assertRaises(ValidationError):
            self.store.create_order(' ', [{'id': item['id'], 'qty': 1}])
        with self.assertRaises(ValidationError):
            self.store.create_order('Маша', [])
        with self.assertRaises(ValidationError):
            self.store.create_order('Маша', [{'id': 'missing', 'qty': 1}])
        with self.assertRaises(ValidationError):
            self.store.create_order('Маша', [{'id': item['id'], 'qty': 0}])
        with self.assertRaises(ValidationError):
            self.store.create_order('Маша', [{'id': item['id'], 'qty': 101}])

    def test_load_menu_catalog_supports_split_manifest(self):
        import json
        root = Path(self.tmp.name) / 'menu'
        root.mkdir()
        (root / 'menu-1.json').write_text(json.dumps({'items': [self.by_name['Маргарита']]}, ensure_ascii=False), encoding='utf-8')
        (root / 'menu-2.json').write_text(json.dumps({'items': [self.by_name['Суп Том Ям']]}, ensure_ascii=False), encoding='utf-8')
        manifest = root / 'menu.json'
        manifest.write_text(json.dumps({'parts': ['menu-1.json', 'menu-2.json']}, ensure_ascii=False), encoding='utf-8')
        items = load_menu_catalog(manifest)
        self.assertEqual([x['name'] for x in items], ['Маргарита', 'Суп Том Ям'])

    def test_update_requires_edit_token_and_replaces_items(self):
        first = self.by_name['Маргарита']
        second = self.by_name['Суп Том Ям']
        created = self.store.create_order('Петя', [{'id': first['id'], 'qty': 1}])
        with self.assertRaises(PermissionDenied):
            self.store.update_order(created['orderId'], 'wrong', [{'id': second['id'], 'qty': 1}])
        updated = self.store.update_order(created['orderId'], created['editToken'], [{'id': second['id'], 'qty': 2}])
        self.assertEqual(updated['total'], second['price'] * 2)
        self.assertEqual(updated['items'][0]['name'], 'Суп Том Ям')
        self.assertEqual(updated['items'][0]['qty'], 2)

    def test_get_order_requires_edit_token(self):
        item = self.by_name['Маргарита']
        created = self.store.create_order('Ира', [{'id': item['id'], 'qty': 1}])
        with self.assertRaises(PermissionDenied):
            self.store.get_order(created['orderId'], 'wrong')
        saved = self.store.get_order(created['orderId'], created['editToken'])
        self.assertEqual(saved['name'], 'Ира')
        self.assertNotIn('editToken', saved)

    def test_list_orders_contains_people_and_dish_aggregation(self):
        pizza = self.by_name['Маргарита']
        soup = self.by_name['Суп Том Ям']
        self.store.create_order('Маша', [{'id': pizza['id'], 'qty': 2}, {'id': soup['id'], 'qty': 1}])
        self.store.create_order('Саша', [{'id': pizza['id'], 'qty': 1}])
        result = self.store.list_orders()
        self.assertEqual(result['participantCount'], 2)
        self.assertEqual(result['itemCount'], 4)
        self.assertEqual(result['grandTotal'], pizza['price'] * 3 + soup['price'])
        grouped = {x['id']: x for x in result['dishSummary']}
        self.assertEqual(grouped[pizza['id']]['qty'], 3)
        self.assertEqual(grouped[pizza['id']]['subtotal'], pizza['price'] * 3)
        self.assertEqual(len(result['orders']), 2)

    def test_concurrent_creates_are_serialized(self):
        import concurrent.futures
        item = self.by_name['Маргарита']
        def create(i):
            return self.store.create_order(f'Участник {i}', [{'id': item['id'], 'qty': 1}])
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            results = list(pool.map(create, range(20)))
        self.assertEqual(len(results), 20)
        self.assertEqual(self.store.list_orders()['participantCount'], 20)

if __name__ == '__main__':
    unittest.main()
