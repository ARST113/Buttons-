# Food Order — общий выбор блюд

Статический frontend для GitHub Pages + небольшой Python/SQLite backend на `arxistar.duckdns.org`.

## Что уже реализовано

- вход по имени;
- имя `Ваня` открывает общую сводку без пароля;
- 158 позиций из предоставленного меню «Сыто Пьяно»;
- фотографии берутся по прямым URL `static.tildacdn.com` из исходного меню (для 6 бургеров в исходном снимке URL изображений отсутствовали, поэтому у них показывается аккуратная заглушка);
- категории, поиск по названию и составу;
- количество `− / +`, корзина и итоговая сумма;
- сохранение заказа в SQLite через API;
- повторное открытие/изменение заказа с того же браузера;
- режим Вани: заказы по людям, сводка по блюдам, число участников, число позиций, общая сумма;
- автоматическое обновление сводки раз в 10 секунд.

## Структура

```text
docs/                 GitHub Pages
  index.html
  css/app.css
  js/app.js
  js/core.js
  data/menu.json       манифест меню
  data/menu-1.json … menu-4.json
server/               backend
  app.py
  food-order.service
  Caddyfile.example
  install.sh
tests/                автоматические тесты
```

## Локальная проверка

Backend:

```bash
FOOD_ORDER_ORIGIN=http://127.0.0.1:8080 python3 server/app.py
```

Frontend:

```bash
python3 -m http.server 8080 --directory docs
```

Открыть `http://127.0.0.1:8080`.

Все тесты:

```bash
npm test
```

## Публикация frontend на GitHub Pages

Целевой репозиторий: `ARST113/Buttons-`.

1. Загрузить этот проект в ветку `main`.
2. GitHub → **Settings → Pages**.
3. Source: **Deploy from a branch**.
4. Branch: `main`, folder: `/docs`.
5. После публикации frontend будет доступен по адресу `https://arst113.github.io/Buttons-/`.

Frontend уже настроен на production API:

```text
https://arxistar.duckdns.org/food-api
```

При запуске на `localhost` он автоматически использует `http://127.0.0.1:8765`.

## Установка backend на сервер

На сервере:

```bash
sudo git clone https://github.com/ARST113/Buttons-.git /opt/food-order
sudo /opt/food-order/server/install.sh
```

Проверка:

```bash
curl http://127.0.0.1:8765/health
```

Ожидаемый ответ:

```json
{"ok": true}
```

### Caddy

В существующий блок `arxistar.duckdns.org { ... }` добавить:

```caddy
handle_path /food-api/* {
    reverse_proxy 127.0.0.1:8765
}
```

Затем:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl https://arxistar.duckdns.org/food-api/health
```

## База

SQLite создаётся автоматически:

```text
/opt/food-order/server/data/orders.db
```

Backend не принимает цены от браузера: имя, цена и категория каждой позиции заново берутся из файлов меню, перечисленных в `docs/data/menu.json`.
