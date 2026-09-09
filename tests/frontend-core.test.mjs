import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cartCount,
  cartTotal,
  filterMenu,
  buildSelectionPayload,
  normalizeName,
  isAdminName,
  resolveMenuItems,
} from '../docs/js/core.js';

const menu = [
  { id: 'a', name: 'Суп Том Ям', description: 'Креветки и кальмар', category: 'Супы', price: 475 },
  { id: 'b', name: 'Спагетти Карбонара', description: 'Бекон и сливки', category: 'Паста, рис', price: 495 },
  { id: 'c', name: 'Маргарита', description: 'Моцарелла и томаты', category: 'Пицца', price: 569 },
];

const menuById = new Map(menu.map((item) => [item.id, item]));

test('cart helpers count quantities and canonical menu prices', () => {
  const cart = new Map([['a', 2], ['b', 1]]);
  assert.equal(cartCount(cart), 3);
  assert.equal(cartTotal(cart, menuById), 475 * 2 + 495);
});

test('filterMenu searches name and description within category', () => {
  assert.deepEqual(filterMenu(menu, 'кревет', 'Все').map((x) => x.id), ['a']);
  assert.deepEqual(filterMenu(menu, '', 'Пицца').map((x) => x.id), ['c']);
  assert.deepEqual(filterMenu(menu, 'бекон', 'Паста, рис').map((x) => x.id), ['b']);
});

test('buildSelectionPayload removes zero quantities and sorts by id', () => {
  const cart = new Map([['b', 2], ['a', 1], ['c', 0]]);
  assert.deepEqual(buildSelectionPayload(cart), [
    { id: 'a', qty: 1 },
    { id: 'b', qty: 2 },
  ]);
});

test('name normalization and Vanya shortcut are case-insensitive', () => {
  assert.equal(normalizeName('  Маша   Иванова  '), 'Маша Иванова');
  assert.equal(isAdminName(' ВАНЯ '), true);
  assert.equal(isAdminName('Ванечка'), false);
});

test('resolveMenuItems combines split menu parts from a manifest', () => {
  const manifest = { parts: ['menu-1.json', 'menu-2.json'] };
  const parts = [{ items: [menu[0]] }, { items: [menu[1], menu[2]] }];
  assert.deepEqual(resolveMenuItems(manifest, parts), menu);
});
