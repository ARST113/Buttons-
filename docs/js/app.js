import {
  normalizeName,
  isAdminName,
  cartCount,
  cartTotal,
  filterMenu,
  buildSelectionPayload,
  formatRub,
  resolveMenuItems,
} from './core.js';

const API_BASE = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://127.0.0.1:8765'
  : 'https://arxistar.duckdns.org/food-api';
const IDENTITY_KEY = 'foodOrderIdentityV1';

const state = {
  menu: [],
  menuById: new Map(),
  cart: new Map(),
  category: 'Все',
  search: '',
  name: '',
  identity: readIdentity(),
  adminTimer: null,
  lastAdminData: null,
};

const $ = (id) => document.getElementById(id);
const els = {
  nameGate: $('nameGate'), nameForm: $('nameForm'), nameInput: $('nameInput'),
  shopView: $('shopView'), adminView: $('adminView'), successView: $('successView'),
  currentName: $('currentName'), changeNameButton: $('changeNameButton'),
  searchInput: $('searchInput'), categoryNav: $('categoryNav'), categoryTitle: $('categoryTitle'),
  resultMeta: $('resultMeta'), menuGrid: $('menuGrid'), menuEmpty: $('menuEmpty'),
  cartBar: $('cartBar'), cartCount: $('cartCount'), cartTotal: $('cartTotal'),
  cartDialog: $('cartDialog'), cartItems: $('cartItems'), dialogTotal: $('dialogTotal'),
  closeCartButton: $('closeCartButton'), submitOrderButton: $('submitOrderButton'), submitStatus: $('submitStatus'),
  successName: $('successName'), successItems: $('successItems'), successTotal: $('successTotal'),
  editOrderButton: $('editOrderButton'), newPersonButton: $('newPersonButton'),
  adminStatus: $('adminStatus'), statPeople: $('statPeople'), statItems: $('statItems'), statTotal: $('statTotal'),
  peoplePanel: $('peoplePanel'), dishesPanel: $('dishesPanel'), refreshAdmin: $('refreshAdmin'), adminChangeName: $('adminChangeName'),
};

function readIdentity() {
  try { return JSON.parse(localStorage.getItem(IDENTITY_KEY) || 'null'); }
  catch { return null; }
}

function saveIdentity(identity) {
  state.identity = identity;
  if (identity) localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  else localStorage.removeItem(IDENTITY_KEY);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body != null) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let payload;
  try { payload = await response.json(); }
  catch { payload = { error: 'Сервер вернул некорректный ответ' }; }
  if (!response.ok) throw new Error(payload.error || `Ошибка ${response.status}`);
  return payload;
}

async function loadMenu() {
  const response = await fetch('./data/menu.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('Не удалось загрузить меню');
  const manifest = await response.json();
  let parts = [];
  if (Array.isArray(manifest.parts)) {
    const responses = await Promise.all(manifest.parts.map((file) => fetch(`./data/${file}`, { cache: 'no-cache' })));
    if (responses.some((part) => !part.ok)) throw new Error('Не удалось загрузить часть меню');
    parts = await Promise.all(responses.map((part) => part.json()));
  }
  state.menu = resolveMenuItems(manifest, parts);
  state.menuById = new Map(state.menu.map((item) => [item.id, item]));
  renderCategories();
  renderMenu();
}

function renderCategories() {
  const categories = ['Все', ...new Set(state.menu.map((item) => item.category))];
  els.categoryNav.replaceChildren(...categories.map((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `category-chip${category === state.category ? ' active' : ''}`;
    button.textContent = category;
    button.addEventListener('click', () => {
      state.category = category;
      renderCategories();
      renderMenu();
      window.scrollTo({ top: Math.max(0, els.categoryNav.offsetTop - 70), behavior: 'smooth' });
    });
    return button;
  }));
}

function createStepper(itemId) {
  const wrap = document.createElement('div');
  const qty = state.cart.get(itemId) || 0;
  if (!qty) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'add-button';
    add.setAttribute('aria-label', 'Добавить');
    add.textContent = '+';
    add.addEventListener('click', () => setQty(itemId, 1));
    wrap.append(add);
    return wrap;
  }

  wrap.className = 'stepper-active';
  const minus = document.createElement('button');
  minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Уменьшить');
  minus.addEventListener('click', () => setQty(itemId, qty - 1));
  const count = document.createElement('span'); count.textContent = String(qty);
  const plus = document.createElement('button');
  plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Увеличить');
  plus.addEventListener('click', () => setQty(itemId, Math.min(100, qty + 1)));
  wrap.append(minus, count, plus);
  return wrap;
}

function renderMenu() {
  const visible = filterMenu(state.menu, state.search, state.category);
  els.categoryTitle.textContent = state.category === 'Все' ? 'Всё меню' : state.category;
  els.resultMeta.textContent = `${visible.length} ${plural(visible.length, 'блюдо', 'блюда', 'блюд')}`;
  els.menuEmpty.hidden = visible.length > 0;
  els.menuGrid.replaceChildren(...visible.map((item) => {
    const node = $('menuCardTemplate').content.firstElementChild.cloneNode(true);
    const img = node.querySelector('.menu-image');
    const fallback = node.querySelector('.image-fallback');
    if (item.image) {
      img.src = item.image;
      img.alt = item.name;
      img.addEventListener('error', () => { img.hidden = true; fallback.hidden = false; }, { once: true });
    } else {
      img.hidden = true;
      fallback.hidden = false;
    }
    node.querySelector('.menu-name').textContent = item.name;
    const desc = node.querySelector('.menu-description');
    desc.textContent = item.description || 'Состав не указан';
    node.querySelector('.menu-price').textContent = formatRub(item.price);
    const stepper = node.querySelector('.stepper');
    stepper.replaceChildren(createStepper(item.id));
    return node;
  }));
}

function setQty(id, qty) {
  if (qty <= 0) state.cart.delete(id);
  else state.cart.set(id, qty);
  renderMenu();
  renderCartBar();
  if (els.cartDialog.open) renderCartDialog();
}

function renderCartBar() {
  const count = cartCount(state.cart);
  els.cartBar.hidden = count === 0;
  els.cartCount.textContent = String(count);
  els.cartTotal.textContent = formatRub(cartTotal(state.cart, state.menuById));
}

function renderCartDialog() {
  const rows = buildSelectionPayload(state.cart).map(({ id, qty }) => {
    const item = state.menuById.get(id);
    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <div><h3></h3><p></p></div>
      <div class="cart-row-right"><div class="cart-row-total"></div><div class="mini-stepper"></div></div>`;
    row.querySelector('h3').textContent = item.name;
    row.querySelector('p').textContent = `${qty} × ${formatRub(item.price)}`;
    row.querySelector('.cart-row-total').textContent = formatRub(item.price * qty);
    row.querySelector('.mini-stepper').append(createStepper(id));
    return row;
  });
  els.cartItems.replaceChildren(...rows);
  els.dialogTotal.textContent = formatRub(cartTotal(state.cart, state.menuById));
  els.submitStatus.textContent = '';
  els.submitStatus.classList.remove('error');
}

async function restoreOwnOrder() {
  if (!state.identity?.orderId || !state.identity?.token) return;
  try {
    const params = new URLSearchParams({ token: state.identity.token });
    const payload = await api(`/orders/${state.identity.orderId}?${params}`);
    state.cart = new Map(payload.order.items.map((item) => [item.id, item.qty]));
    renderMenu();
    renderCartBar();
  } catch (error) {
    console.warn('Saved order could not be restored:', error);
    saveIdentity(null);
  }
}

async function submitOrder() {
  const items = buildSelectionPayload(state.cart);
  if (!items.length) return;
  els.submitOrderButton.disabled = true;
  els.submitStatus.textContent = state.identity ? 'Обновляю заказ…' : 'Сохраняю заказ…';
  els.submitStatus.classList.remove('error');
  try {
    let order;
    if (state.identity?.orderId && state.identity?.token) {
      const payload = await api(`/orders/${state.identity.orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: state.name, token: state.identity.token, items }),
      });
      order = payload.order;
    } else {
      const payload = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({ name: state.name, items }),
      });
      order = payload.order;
      saveIdentity({ orderId: order.orderId, token: order.editToken, name: state.name });
    }
    showSuccess(order);
  } catch (error) {
    els.submitStatus.textContent = `${error.message}. Попробуй ещё раз.`;
    els.submitStatus.classList.add('error');
  } finally {
    els.submitOrderButton.disabled = false;
  }
}

function showSuccess(order) {
  if (els.cartDialog.open) els.cartDialog.close();
  els.cartBar.hidden = true;
  els.shopView.hidden = true;
  els.successView.hidden = false;
  els.successName.textContent = order.name;
  els.successItems.replaceChildren(...order.items.map((item) => {
    const row = document.createElement('div');
    row.className = 'success-item';
    row.innerHTML = '<span></span><strong></strong>';
    row.querySelector('span').textContent = `${item.name} × ${item.qty}`;
    row.querySelector('strong').textContent = formatRub(item.subtotal);
    return row;
  }));
  els.successTotal.textContent = formatRub(order.total);
}

function enterShop(name) {
  stopAdminPolling();
  state.name = normalizeName(name);
  els.currentName.textContent = state.name;
  els.nameGate.hidden = true;
  els.adminView.hidden = true;
  els.successView.hidden = true;
  els.shopView.hidden = false;
  if (state.identity && normalizeName(state.identity.name).toLocaleLowerCase('ru-RU') !== state.name.toLocaleLowerCase('ru-RU')) {
    saveIdentity(null);
    state.cart.clear();
  }
  restoreOwnOrder();
}

function enterAdmin() {
  state.name = 'Ваня';
  els.nameGate.hidden = true;
  els.shopView.hidden = true;
  els.successView.hidden = true;
  els.cartBar.hidden = true;
  els.adminView.hidden = false;
  loadAdmin();
  stopAdminPolling();
  state.adminTimer = setInterval(loadAdmin, 10000);
}

function resetToNameGate({ clearIdentity = false } = {}) {
  stopAdminPolling();
  if (els.cartDialog.open) els.cartDialog.close();
  if (clearIdentity) {
    saveIdentity(null);
    state.cart.clear();
    renderMenu();
    renderCartBar();
  }
  els.shopView.hidden = true;
  els.adminView.hidden = true;
  els.successView.hidden = true;
  els.cartBar.hidden = true;
  els.nameGate.hidden = false;
  els.nameInput.value = clearIdentity ? '' : (state.identity?.name || state.name || '');
  setTimeout(() => els.nameInput.focus(), 40);
}

function stopAdminPolling() {
  if (state.adminTimer) clearInterval(state.adminTimer);
  state.adminTimer = null;
}

async function loadAdmin() {
  els.adminStatus.textContent = state.lastAdminData ? 'Обновляю…' : 'Загружаю заказы…';
  els.adminStatus.classList.remove('error');
  try {
    const data = await api('/orders');
    state.lastAdminData = data;
    renderAdmin(data);
    els.adminStatus.textContent = `Обновлено ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (error) {
    els.adminStatus.textContent = `Не удалось получить заказы: ${error.message}`;
    els.adminStatus.classList.add('error');
  }
}

function renderAdmin(data) {
  els.statPeople.textContent = String(data.participantCount);
  els.statItems.textContent = String(data.itemCount);
  els.statTotal.textContent = formatRub(data.grandTotal);

  if (!data.orders.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.textContent = 'Пока никто не отправил заказ.';
    els.peoplePanel.replaceChildren(empty);
  } else {
    els.peoplePanel.replaceChildren(...data.orders.map((order) => {
      const card = document.createElement('article');
      card.className = 'person-card';
      const updated = new Date(order.updatedAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      card.innerHTML = `
        <div class="person-head"><h2></h2><strong></strong></div>
        <p class="person-meta"></p>
        <div class="person-items"></div>`;
      card.querySelector('h2').textContent = order.name;
      card.querySelector('.person-head strong').textContent = formatRub(order.total);
      card.querySelector('.person-meta').textContent = `${order.itemCount} ${plural(order.itemCount, 'позиция', 'позиции', 'позиций')} · ${updated}`;
      const items = order.items.map((item) => {
        const row = document.createElement('div');
        row.className = 'person-item';
        row.innerHTML = '<span></span><span></span>';
        row.children[0].textContent = `${item.name} × ${item.qty}`;
        row.children[1].textContent = formatRub(item.subtotal);
        return row;
      });
      card.querySelector('.person-items').replaceChildren(...items);
      return card;
    }));
  }

  if (!data.dishSummary.length) {
    const empty = document.createElement('div');
    empty.className = 'admin-empty';
    empty.textContent = 'Сводка по блюдам появится после первого заказа.';
    els.dishesPanel.replaceChildren(empty);
  } else {
    const sorted = [...data.dishSummary].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'ru'));
    els.dishesPanel.replaceChildren(...sorted.map((item) => {
      const card = document.createElement('article');
      card.className = 'dish-card';
      card.innerHTML = '<div class="dish-main"><h3></h3><p></p></div><div class="dish-qty"></div>';
      card.querySelector('h3').textContent = item.name;
      card.querySelector('p').textContent = `${item.category} · ${formatRub(item.subtotal)}`;
      card.querySelector('.dish-qty').textContent = `×${item.qty}`;
      return card;
    }));
  }
}

function plural(value, one, few, many) {
  const n = Math.abs(value) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

els.nameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = normalizeName(els.nameInput.value);
  if (!name) return;
  if (isAdminName(name)) enterAdmin();
  else enterShop(name);
});
els.searchInput.addEventListener('input', () => { state.search = els.searchInput.value; renderMenu(); });
els.cartBar.addEventListener('click', () => { renderCartDialog(); els.cartDialog.showModal(); });
els.closeCartButton.addEventListener('click', () => els.cartDialog.close());
els.cartDialog.addEventListener('click', (event) => { if (event.target === els.cartDialog) els.cartDialog.close(); });
els.submitOrderButton.addEventListener('click', submitOrder);
els.editOrderButton.addEventListener('click', () => { els.successView.hidden = true; els.shopView.hidden = false; renderCartBar(); });
els.newPersonButton.addEventListener('click', () => resetToNameGate({ clearIdentity: true }));
els.changeNameButton.addEventListener('click', () => resetToNameGate());
els.adminChangeName.addEventListener('click', () => resetToNameGate());
els.refreshAdmin.addEventListener('click', loadAdmin);
document.querySelectorAll('[data-admin-tab]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('[data-admin-tab]').forEach((b) => b.classList.toggle('active', b === button));
  const people = button.dataset.adminTab === 'people';
  els.peoplePanel.hidden = !people;
  els.dishesPanel.hidden = people;
}));

(async function init() {
  try {
    await loadMenu();
    els.nameInput.value = state.identity?.name || '';
    if (els.nameInput.value) els.nameInput.select();
  } catch (error) {
    els.nameForm.querySelector('button').disabled = true;
    els.nameInput.placeholder = 'Меню не загрузилось';
    document.querySelector('.gate-copy').textContent = error.message;
  }
})();
