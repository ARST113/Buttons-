import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('food ordering page exposes the agreed user and Vanya views', async () => {
  const html = await read('docs/index.html');
  for (const id of ['nameGate', 'shopView', 'menuGrid', 'cartBar', 'cartDialog', 'successView', 'adminView']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /Введи имя/i);
  assert.match(html, /Готово/);
});

test('frontend has a single production API base that can be changed later', async () => {
  const app = await read('docs/js/app.js');
  assert.match(app, /const API_BASE\s*=/);
  assert.match(app, /arxistar\.duckdns\.org\/food-api/);
});

test('frontend confirms and requests a full order database clear', async () => {
  const app = await read('docs/js/app.js');
  assert.match(app, /confirm\(/);
  assert.match(app, /method:\s*['\"]DELETE['\"]/);
  assert.match(app, /\/orders/);
});
test('GitHub Pages workflow publishes the docs directory', async () => {
  const workflow = await read('.github/workflows/pages.yml');
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /path:\s*['"]?\.\/docs['"]?/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});

