export function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function isAdminName(value) {
  return normalizeName(value).toLocaleLowerCase('ru-RU') === 'ваня';
}

export function isClearName(value) {
  return normalizeName(value) === 'kill_cql1';
}

export function cartCount(cart) {
  let count = 0;
  for (const qty of cart.values()) {
    if (Number.isInteger(qty) && qty > 0) count += qty;
  }
  return count;
}

export function cartTotal(cart, menuById) {
  let total = 0;
  for (const [id, qty] of cart.entries()) {
    const item = menuById.get(id);
    if (item && Number.isInteger(qty) && qty > 0) total += item.price * qty;
  }
  return total;
}

export function filterMenu(items, search = '', category = 'Все') {
  const query = String(search).trim().toLocaleLowerCase('ru-RU');
  return items.filter((item) => {
    if (category !== 'Все' && item.category !== category) return false;
    if (!query) return true;
    const haystack = `${item.name} ${item.description ?? ''}`.toLocaleLowerCase('ru-RU');
    return haystack.includes(query);
  });
}

export function buildSelectionPayload(cart) {
  return [...cart.entries()]
    .filter(([, qty]) => Number.isInteger(qty) && qty > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, qty]) => ({ id, qty }));
}

export function formatRub(value) {
  return `${new Intl.NumberFormat('ru-RU').format(Number(value) || 0)} ₽`;
}

export function resolveMenuItems(manifest, partPayloads = []) {
  if (Array.isArray(manifest?.items)) return manifest.items;
  if (!Array.isArray(manifest?.parts)) throw new Error('Некорректный формат меню');
  return partPayloads.flatMap((part) => Array.isArray(part?.items) ? part.items : []);
}

