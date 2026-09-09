from __future__ import annotations

import json
import os
import secrets
import sqlite3
import threading
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


def load_menu_catalog(menu_path: str | Path) -> list[dict[str, Any]]:
    path = Path(menu_path)
    payload = json.loads(path.read_text(encoding='utf-8'))
    if isinstance(payload.get('items'), list):
        return payload['items']
    parts = payload.get('parts')
    if not isinstance(parts, list):
        raise ValueError('Некорректный формат меню')
    items: list[dict[str, Any]] = []
    for part_name in parts:
        part_path = path.parent / str(part_name)
        part = json.loads(part_path.read_text(encoding='utf-8'))
        part_items = part.get('items')
        if not isinstance(part_items, list):
            raise ValueError(f'Некорректная часть меню: {part_name}')
        items.extend(part_items)
    return items


class ValidationError(ValueError):
    pass


class PermissionDenied(Exception):
    pass


class NotFound(Exception):
    pass


class OrderStore:
    def __init__(self, menu_path: str | Path, db_path: str | Path):
        self.menu_path = Path(menu_path)
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.menu_items = {item['id']: item for item in load_menu_catalog(self.menu_path)}
        self._lock = threading.RLock()
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute('PRAGMA foreign_keys = ON')
        self._init_schema()

    def _init_schema(self) -> None:
        self.conn.executescript(
            '''
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                edit_token TEXT NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS order_items (
                order_id TEXT NOT NULL,
                item_id TEXT NOT NULL,
                qty INTEGER NOT NULL CHECK(qty > 0),
                PRIMARY KEY (order_id, item_id),
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at);
            '''
        )
        self.conn.commit()

    def close(self) -> None:
        with self._lock:
            self.conn.close()

    def _normalize_name(self, name: Any) -> str:
        if not isinstance(name, str):
            raise ValidationError('Имя должно быть строкой')
        name = ' '.join(name.split())
        if not name:
            raise ValidationError('Введите имя')
        if len(name) > 80:
            raise ValidationError('Имя слишком длинное')
        return name

    def _normalize_selections(self, selections: Any) -> list[dict[str, Any]]:
        if not isinstance(selections, list) or not selections:
            raise ValidationError('Выберите хотя бы одно блюдо')
        merged: dict[str, int] = defaultdict(int)
        for entry in selections:
            if not isinstance(entry, dict):
                raise ValidationError('Некорректная позиция заказа')
            item_id = entry.get('id')
            qty = entry.get('qty')
            if item_id not in self.menu_items:
                raise ValidationError('В заказе есть неизвестное блюдо')
            if isinstance(qty, bool) or not isinstance(qty, int) or qty < 1 or qty > 100:
                raise ValidationError('Количество должно быть от 1 до 100')
            merged[item_id] += qty
            if merged[item_id] > 100:
                raise ValidationError('Количество одного блюда не может превышать 100')
        return [{'id': item_id, 'qty': qty} for item_id, qty in merged.items()]

    def _public_order(self, order_id: str) -> dict[str, Any]:
        row = self.conn.execute(
            'SELECT id, name, created_at, updated_at FROM orders WHERE id = ?',
            (order_id,),
        ).fetchone()
        if row is None:
            raise NotFound('Заказ не найден')
        item_rows = self.conn.execute(
            'SELECT item_id, qty FROM order_items WHERE order_id = ? ORDER BY rowid',
            (order_id,),
        ).fetchall()
        items: list[dict[str, Any]] = []
        total = 0
        item_count = 0
        for item_row in item_rows:
            menu_item = self.menu_items.get(item_row['item_id'])
            if menu_item is None:
                continue
            qty = int(item_row['qty'])
            subtotal = menu_item['price'] * qty
            total += subtotal
            item_count += qty
            items.append({
                'id': menu_item['id'],
                'name': menu_item['name'],
                'category': menu_item['category'],
                'price': menu_item['price'],
                'qty': qty,
                'subtotal': subtotal,
            })
        return {
            'orderId': row['id'],
            'name': row['name'],
            'createdAt': row['created_at'],
            'updatedAt': row['updated_at'],
            'items': items,
            'itemCount': item_count,
            'total': total,
        }

    def create_order(self, name: Any, selections: Any) -> dict[str, Any]:
        name = self._normalize_name(name)
        selections = self._normalize_selections(selections)
        now = datetime.now(timezone.utc).isoformat()
        order_id = uuid.uuid4().hex
        edit_token = secrets.token_urlsafe(32)
        with self._lock:
            with self.conn:
                self.conn.execute(
                    'INSERT INTO orders(id, edit_token, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                    (order_id, edit_token, name, now, now),
                )
                self.conn.executemany(
                    'INSERT INTO order_items(order_id, item_id, qty) VALUES (?, ?, ?)',
                    [(order_id, item['id'], item['qty']) for item in selections],
                )
            result = self._public_order(order_id)
        result['editToken'] = edit_token
        return result

    def _verify_token(self, order_id: str, token: Any) -> None:
        row = self.conn.execute('SELECT edit_token FROM orders WHERE id = ?', (order_id,)).fetchone()
        if row is None:
            raise NotFound('Заказ не найден')
        if not isinstance(token, str) or not secrets.compare_digest(row['edit_token'], token):
            raise PermissionDenied('Неверный токен изменения заказа')

    def update_order(self, order_id: str, token: Any, selections: Any, name: Any = None) -> dict[str, Any]:
        selections = self._normalize_selections(selections)
        with self._lock:
            self._verify_token(order_id, token)
            if name is None:
                row = self.conn.execute('SELECT name FROM orders WHERE id = ?', (order_id,)).fetchone()
                name = row['name']
            name = self._normalize_name(name)
            now = datetime.now(timezone.utc).isoformat()
            with self.conn:
                self.conn.execute('UPDATE orders SET name = ?, updated_at = ? WHERE id = ?', (name, now, order_id))
                self.conn.execute('DELETE FROM order_items WHERE order_id = ?', (order_id,))
                self.conn.executemany(
                    'INSERT INTO order_items(order_id, item_id, qty) VALUES (?, ?, ?)',
                    [(order_id, item['id'], item['qty']) for item in selections],
                )
            return self._public_order(order_id)

    def get_order(self, order_id: str, token: Any) -> dict[str, Any]:
        with self._lock:
            self._verify_token(order_id, token)
            return self._public_order(order_id)

    def list_orders(self) -> dict[str, Any]:
        with self._lock:
            rows = self.conn.execute('SELECT id FROM orders ORDER BY created_at ASC').fetchall()
            orders = [self._public_order(row['id']) for row in rows]
            summary: dict[str, dict[str, Any]] = {}
            grand_total = 0
            item_count = 0
            for order in orders:
                grand_total += order['total']
                item_count += order['itemCount']
                for item in order['items']:
                    bucket = summary.setdefault(item['id'], {
                        'id': item['id'],
                        'name': item['name'],
                        'category': item['category'],
                        'price': item['price'],
                        'qty': 0,
                        'subtotal': 0,
                    })
                    bucket['qty'] += item['qty']
                    bucket['subtotal'] += item['subtotal']
            dish_summary = sorted(summary.values(), key=lambda x: (x['category'], x['name']))
            return {
                'orders': orders,
                'dishSummary': dish_summary,
                'participantCount': len(orders),
                'itemCount': item_count,
                'grandTotal': grand_total,
            }


def make_http_server(store: OrderStore, host: str = '127.0.0.1', port: int = 8765,
                     allowed_origin: str = 'https://arst113.github.io') -> ThreadingHTTPServer:
    class Handler(BaseHTTPRequestHandler):
        server_version = 'FoodOrderAPI/1.0'

        def log_message(self, fmt: str, *args: Any) -> None:
            print(f'{self.address_string()} - {fmt % args}')

        def _set_cors(self) -> None:
            origin = self.headers.get('Origin')
            if origin == allowed_origin:
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Vary', 'Origin')

        def _json(self, status: int, payload: dict[str, Any]) -> None:
            data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self._set_cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)

        def _read_json(self) -> dict[str, Any]:
            try:
                length = int(self.headers.get('Content-Length', '0'))
            except ValueError as exc:
                raise ValidationError('Некорректная длина запроса') from exc
            if length <= 0 or length > 1_000_000:
                raise ValidationError('Некорректное тело запроса')
            raw = self.rfile.read(length)
            try:
                payload = json.loads(raw.decode('utf-8'))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ValidationError('Некорректный JSON') from exc
            if not isinstance(payload, dict):
                raise ValidationError('JSON должен быть объектом')
            return payload

        def _handle_error(self, exc: Exception) -> None:
            if isinstance(exc, ValidationError):
                self._json(400, {'error': str(exc)})
            elif isinstance(exc, PermissionDenied):
                self._json(403, {'error': str(exc)})
            elif isinstance(exc, NotFound):
                self._json(404, {'error': str(exc)})
            else:
                self._json(500, {'error': 'Внутренняя ошибка сервера'})

        def do_OPTIONS(self) -> None:
            self.send_response(204)
            self._set_cors()
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Max-Age', '600')
            self.end_headers()

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            try:
                if parsed.path == '/health':
                    self._json(200, {'ok': True})
                    return
                if parsed.path == '/orders':
                    self._json(200, store.list_orders())
                    return
                if parsed.path.startswith('/orders/'):
                    order_id = parsed.path.rsplit('/', 1)[-1]
                    token = parse_qs(parsed.query).get('token', [None])[0]
                    self._json(200, {'order': store.get_order(order_id, token)})
                    return
                self._json(404, {'error': 'Маршрут не найден'})
            except Exception as exc:
                self._handle_error(exc)

        def do_POST(self) -> None:
            parsed = urlparse(self.path)
            try:
                if parsed.path != '/orders':
                    self._json(404, {'error': 'Маршрут не найден'})
                    return
                payload = self._read_json()
                order = store.create_order(payload.get('name'), payload.get('items'))
                self._json(201, {'order': order})
            except Exception as exc:
                self._handle_error(exc)

        def do_PUT(self) -> None:
            parsed = urlparse(self.path)
            try:
                if not parsed.path.startswith('/orders/'):
                    self._json(404, {'error': 'Маршрут не найден'})
                    return
                order_id = parsed.path.rsplit('/', 1)[-1]
                payload = self._read_json()
                order = store.update_order(
                    order_id,
                    payload.get('token'),
                    payload.get('items'),
                    payload.get('name'),
                )
                self._json(200, {'order': order})
            except Exception as exc:
                self._handle_error(exc)

    return ThreadingHTTPServer((host, port), Handler)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    menu_path = Path(os.environ.get('FOOD_ORDER_MENU', root / 'docs' / 'data' / 'menu.json'))
    db_path = Path(os.environ.get('FOOD_ORDER_DB', root / 'server' / 'data' / 'orders.db'))
    host = os.environ.get('FOOD_ORDER_HOST', '127.0.0.1')
    port = int(os.environ.get('FOOD_ORDER_PORT', '8765'))
    allowed_origin = os.environ.get('FOOD_ORDER_ORIGIN', 'https://arst113.github.io')
    store = OrderStore(menu_path, db_path)
    httpd = make_http_server(store, host, port, allowed_origin)
    print(f'Food order API listening on http://{host}:{port}')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        store.close()


if __name__ == '__main__':
    main()
