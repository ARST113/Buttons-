import unittest
from pathlib import Path

from server.app import load_menu_catalog

ROOT = Path(__file__).resolve().parents[1]
MENU_PATH = ROOT / 'docs' / 'data' / 'menu.json'

class MenuDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.items = load_menu_catalog(MENU_PATH)

    def test_has_expected_categories(self):
        categories = {item['category'] for item in self.items}
        expected = {'Пицца','Бургеры','Салаты','Закуски','Супы','Паста, рис','Стейки','Горячие блюда','Дополни','Суши и сеты','Роллы','Десерты','Напитки'}
        self.assertTrue(expected.issubset(categories))

    def test_ids_are_unique_and_prices_positive(self):
        ids = [item['id'] for item in self.items]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(isinstance(item['price'], int) and item['price'] > 0 for item in self.items))

    def test_representative_items_match_supplied_source(self):
        by_name = {item['name']: item for item in self.items}
        self.assertEqual(by_name['Маргарита']['price'], 569)
        self.assertEqual(by_name['Суп Том Ям']['price'], 475)
        self.assertEqual(by_name['Спагетти Карбонара']['price'], 495)
        self.assertEqual(by_name['Филадельфия Гранд']['price'], 555)

    def test_menu_is_large_enough_to_cover_supplied_catalog(self):
        self.assertGreaterEqual(len(self.items), 100)

    def test_most_items_have_source_images(self):
        with_images = sum(bool(item.get('image')) for item in self.items)
        self.assertGreaterEqual(with_images / len(self.items), 0.85)

if __name__ == '__main__':
    unittest.main()
