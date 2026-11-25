import {
  addItem, setQty, removeItem, itemCount, totals, promoRate,
  isValidCard, isValidExpiry, isValidCvc, isValidPhMobile, money,
} from './cart.js';
import { buildPlans, PACES, STRATEGIES, POUR_ML } from './planner.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- data ---------- */
// The Streamlit wrapper injects the catalogue inline; the static site fetches it.
const data = window.__SIP_TWICE__ ?? await fetch('data/catalog.json').then((r) => r.json());
const SHELVES = data.shelves;
const SHELF = Object.fromEntries(SHELVES.map((s) => [s.id, s]));
const PRODUCTS = data.products.map((p) => ({ ...p, type: SHELF[p.shelf].type }));
const CATALOG = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const TYPES = [...new Set(SHELVES.map((s) => s.type))];

/* ---------- persistence ---------- */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

const state = {
  cart: store.get('siptwice.cart', []).filter((l) => CATALOG[l.id]),
  promo: store.get('siptwice.promo', ''),
  view: 'shop',
  shelf: null, // null = overview
  query: '',
  current: null,
  delivery: null,
  plans: [],
  planTypes: new Set(),
};

/* ---------- bottle art ---------- */
const SHAPES = {
  whisky:  { d: 'M24 14h12v44q16 4 16 18v114q0 6-6 6H14q-6 0-6-6V76q0-14 16-18z', capY: 4, capH: 12, label: [12, 112, 36, 46] },
  gin:     { d: 'M23 34h14v20q15 3 17 16v120q0 6-6 6H12q-6 0-6-6V70q2-13 17-16z', capY: 22, capH: 14, label: [10, 104, 40, 52] },
  rum:     { d: 'M25 16h10v42c18 6 18 20 18 30v102q0 6-6 6H13q-6 0-6-6V88c0-10 0-24 18-30z', capY: 6, capH: 12, label: [11, 116, 38, 44] },
  vodka:   { d: 'M26 12h8v46c12 6 14 14 14 24v108q0 6-5 6H17q-5 0-5-6V82c0-10 2-18 14-24z', capY: 2, capH: 12, label: [14, 108, 32, 58] },
  tequila: { d: 'M24 44h12v12q18 2 18 14v118q0 8-8 8H14q-8 0-8-8V70q0-12 18-14z', capY: 26, capH: 20, label: [10, 110, 40, 48] },
};
const LABELS = ['#f1e3c6', '#1f2a24', '#7a1f1f', '#fafafa', '#2e5b3a', '#1b2e57', '#d9b44a', '#3c3c3c', '#8b1d2c', '#4b3621'];

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function contrast(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? '#2a1a0e' : '#f6ead0';
}
function initials(name) {
  return name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

let uid = 0;
/** Product photo if we have one, otherwise a drawn bottle in the shelf's style. */
function bottleArt(p) {
  if (p.image) return `<img class="bottle-img" src="${esc(p.image)}" alt="" loading="lazy" decoding="async" />`;
  const shelf = SHELF[p.shelf];
  const s = SHAPES[shelf.shape] ?? SHAPES.whisky;
  const label = LABELS[hash(p.id) % LABELS.length];
  const [lx, ly, lw, lh] = s.label;
  const id = `b${uid++}`;
  return `
  <svg viewBox="0 0 60 200" class="bottle-svg" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="g${id}" x1="0" x2="1">
        <stop offset="0" stop-color="${shelf.glass}" stop-opacity=".95"/>
        <stop offset=".45" stop-color="${shelf.glass}" stop-opacity=".7"/>
        <stop offset="1" stop-color="#000" stop-opacity=".55"/>
      </linearGradient>
      <clipPath id="c${id}"><path d="${s.d}"/></clipPath>
    </defs>
    <rect x="23" y="${s.capY}" width="14" height="${s.capH}" rx="2" fill="#2b1a10"/>
    <rect x="23" y="${s.capY}" width="14" height="3" fill="#c9a35b"/>
    <path d="${s.d}" fill="url(#g${id})" stroke="rgba(255,255,255,.25)" stroke-width="1"/>
    <g clip-path="url(#c${id})">
      <rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="2" fill="${label}"/>
      <rect x="${lx}" y="${ly + 4}" width="${lw}" height="1" fill="rgba(0,0,0,.25)"/>
      <rect x="${lx}" y="${ly + lh - 5}" width="${lw}" height="1" fill="rgba(0,0,0,.25)"/>
      <text x="30" y="${ly + lh / 2 + 3}" text-anchor="middle" font-family="Playfair Display, serif" font-size="9" font-weight="800" fill="${contrast(label)}">${esc(initials(p.name))}</text>
      <rect x="13" y="0" width="5" height="200" fill="rgba(255,255,255,.28)"/>
    </g>
  </svg>`;
}

/* ---------- filters ---------- */
function matches(p) {
  const q = state.query.trim().toLowerCase();
  return !q || p.name.toLowerCase().includes(q) || SHELF[p.shelf].name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q);
}
const onShelf = (id) => PRODUCTS.filter((p) => p.shelf === id && matches(p));

/* ---------- overview: every shelf at a glance ---------- */
function renderOverview() {
  const html = SHELVES.map((s) => {
    const items = onShelf(s.id);
    if (!items.length) return '';
    const from = Math.min(...items.map((p) => p.price));
    return `
      <button class="cubby" data-shelf="${s.id}" aria-label="${esc(s.name)}, ${items.length} bottles. Open shelf">
        <span class="cubby-back">
          <span class="minis">${items.map((p) => `<span class="mini ${p.stock <= 0 ? 'out' : ''}">${bottleArt(p)}</span>`).join('')}</span>
          <span class="mini-plank"></span>
        </span>
        <span class="plate">${esc(s.name)}</span>
        <span class="cubby-meta">${items.length} bottle${items.length > 1 ? 's' : ''} · from ${money(from)}</span>
        <span class="zoom-hint">Step closer →</span>
      </button>`;
  }).join('');
  $('#cabinet').innerHTML = html || '<p class="empty">No bottles match your search.</p>';
}

/* ---------- zoomed shelf ---------- */
function renderShelf() {
  const s = SHELF[state.shelf];
  const items = onShelf(s.id);
  $('#shelf-name').textContent = s.name;
  $('#shelf-blurb').textContent = s.blurb;
  $('#empty').hidden = items.length > 0;
  $('#shelf-grid').innerHTML = items.map((p) => `
    <div class="slot">
      <button class="bottle ${p.stock <= 0 ? 'out' : ''}" data-id="${p.id}" aria-label="${esc(p.name)}, ${money(p.price)}${p.stock <= 0 ? ', sold out' : ''}">
        ${p.regularPrice ? '<span class="sale">SALE</span>' : ''}
        ${bottleArt(p)}
      </button>
      <span class="edge-tag">${money(p.price)}</span>
    </div>`).join('');
}

function showView(view, shelf = null) {
  state.view = view;
  state.shelf = view === 'shop' ? shelf : null;
  $('#overview').hidden = !(view === 'shop' && !shelf);
  $('#shelf-view').hidden = !(view === 'shop' && shelf);
  $('#planner').hidden = view !== 'planner';
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.view === view));
  hideTag();
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Zoom from the clicked cubby into the shelf view. */
function openShelf(id, fromEl) {
  const from = fromEl?.getBoundingClientRect();
  showView('shop', id);
  renderShelf();
  window.scrollTo({ top: 0 });
  const view = $('#shelf-view');
  if (!from || reduceMotion() || !view.animate) return;
  const to = view.getBoundingClientRect();
  const scale = from.width / to.width;
  view.animate([
    { transformOrigin: 'top left', transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`, opacity: 0.4 },
    { transformOrigin: 'top left', transform: 'none', opacity: 1 },
  ], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

function backToOverview() {
  const last = state.shelf;
  showView('shop');
  renderOverview();
  const cubby = document.querySelector(`.cubby[data-shelf="${last}"]`);
  cubby?.scrollIntoView({ block: 'center' });
  cubby?.focus({ preventScroll: true });
  if (!reduceMotion() && $('#overview').animate) {
    $('#overview').animate([{ transform: 'scale(1.08)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'ease-out' });
  }
}

function stepShelf(dir) {
  const visible = SHELVES.filter((s) => onShelf(s.id).length);
  const i = visible.findIndex((s) => s.id === state.shelf);
  const next = visible[(i + dir + visible.length) % visible.length];
  if (!next) return;
  state.shelf = next.id;
  renderShelf();
  const grid = $('#shelf-grid');
  if (!reduceMotion() && grid.animate) grid.animate([{ transform: `translateX(${dir * 40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: 'ease-out' });
}

/* ---------- hover price tag ---------- */
const tag = $('#tag');
function showTag(el) {
  const p = CATALOG[el.dataset.id];
  if (!p) return;
  tag.innerHTML = `<strong>${esc(p.name)}</strong><span>${money(p.price)}</span>${p.regularPrice ? `<s>${money(p.regularPrice)}</s>` : ''}<small>${p.volumeMl >= 1000 ? `${p.volumeMl / 1000} L` : `${p.volumeMl} ml`}${p.stock <= 0 ? ' · sold out' : ''}</small>`;
  tag.hidden = false;
  const r = el.getBoundingClientRect();
  const w = tag.offsetWidth;
  tag.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8)}px`;
  tag.style.top = `${Math.max(8, r.top - tag.offsetHeight - 10)}px`;
}
function hideTag() { tag.hidden = true; }

/* ---------- product dialog ---------- */
const pd = $('#product-dialog');
const size = (ml) => (ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`);

function openProduct(id) {
  const p = CATALOG[id];
  state.current = p;
  hideTag();
  $('#pd-art').innerHTML = bottleArt(p);
  $('#pd-shelf').textContent = SHELF[p.shelf].name;
  $('#pd-name').textContent = p.name;
  $('#pd-price').textContent = money(p.price);
  $('#pd-regular').textContent = p.regularPrice ? money(p.regularPrice) : '';
  $('#pd-save').textContent = p.regularPrice ? `Save ${money(p.regularPrice - p.price)}` : '';
  $('#pd-desc').textContent = p.description || SHELF[p.shelf].blurb;
  $('#pd-size').textContent = size(p.volumeMl) + (p.sizeAssumed ? '*' : '');
  $('#pd-pour').textContent = `${money(Math.round((p.price / p.volumeMl) * POUR_ML))} · ${Math.floor(p.volumeMl / POUR_ML)} pours`;
  $('#pd-stock').textContent = p.stock <= 0 ? 'Sold out' : p.stock <= 3 ? `Only ${p.stock} left` : 'In stock';
  const qty = $('#pd-qty');
  qty.max = Math.max(1, p.stock);
  qty.value = 1;
  $('#pd-add').disabled = p.stock <= 0;
  $('#pd-add').textContent = p.stock <= 0 ? 'Sold out' : 'Add to cart';
  if (!pd.open) pd.showModal();
}

function clampQtyInput() {
  const qty = $('#pd-qty');
  qty.value = Math.min(Math.max(1, parseInt(qty.value, 10) || 1), Math.max(1, state.current?.stock ?? 1));
}

/* ---------- cart ---------- */
const drawer = $('#drawer');
const backdrop = $('#drawer-backdrop');

function totalsHTML(t) {
  return `
    <div><dt>Subtotal</dt><dd>${money(t.subtotal)}</dd></div>
    ${t.discount ? `<div class="disc"><dt>Promo ${esc(state.promo)}</dt><dd>−${money(t.discount)}</dd></div>` : ''}
    <div><dt>Delivery</dt><dd>${t.delivery ? money(t.delivery) : 'Free'}</dd></div>
    <div class="grand"><dt>Total</dt><dd>${money(t.total)}</dd></div>
    <div class="vat"><dt>VAT included</dt><dd>${money(t.vatIncluded)}</dd></div>`;
}

function renderCart() {
  const count = itemCount(state.cart);
  $('#cart-count').textContent = count;
  $('#cart-empty').hidden = count > 0;
  $('#cart-foot').hidden = count === 0;
  $('#cart-lines').innerHTML = state.cart.map((l) => {
    const p = CATALOG[l.id];
    return `
      <li class="line">
        <button class="line-art" data-open="${p.id}" aria-label="View ${esc(p.name)}">${bottleArt(p)}</button>
        <div class="line-info">
          <strong>${esc(p.name)}</strong>
          <span>${money(p.price)} · ${size(p.volumeMl)}</span>
          <div class="qty small">
            <button data-dec="${p.id}" aria-label="Decrease">−</button>
            <span>${l.qty}</span>
            <button data-inc="${p.id}" aria-label="Increase" ${l.qty >= p.stock ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div class="line-end">
          <strong>${money(p.price * l.qty)}</strong>
          <button class="link" data-remove="${p.id}">Remove</button>
        </div>
      </li>`;
  }).join('');
  $('#cart-totals').innerHTML = totalsHTML(totals(state.cart, CATALOG, state.promo));
  store.set('siptwice.cart', state.cart);
  store.set('siptwice.promo', state.promo);
}

function openCart() {
  backdrop.hidden = false;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  $('#close-cart').focus();
}
function closeCart() {
  backdrop.hidden = true;
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ---------- party planner ---------- */
function renderPlannerForm() {
  $('#type-chips').innerHTML = TYPES.map((t) => `
    <label class="type-chip"><input type="checkbox" value="${t}" ${state.planTypes.has(t) ? 'checked' : ''} /><span>${t}</span></label>`).join('');
  $('#pace').innerHTML = Object.entries(PACES).map(([k, v]) => `<option value="${k}" ${k === 'moderate' ? 'selected' : ''}>${v.label}</option>`).join('');
}

function renderPlans(opts) {
  const box = $('#plans');
  if (!state.plans.length || !state.plans.some((p) => p.lines.length)) {
    box.innerHTML = `<div class="plans-empty">Nothing in stock fits those choices. Try a bigger budget or another type of liquor.</div>`;
    return;
  }
  box.innerHTML = state.plans.map((plan, i) => {
    const s = STRATEGIES[plan.strategy];
    const perGuest = (plan.pours / opts.pax).toFixed(1);
    const short = plan.coverage < 1;
    return `
      <article class="plan ${plan.strategy}">
        <header>
          <h3>${s.title}</h3>
          <p>${s.blurb}</p>
        </header>
        <div class="plan-total">${money(plan.total)} <small>of ${money(opts.budget)}</small></div>
        <div class="meter ${short ? 'short' : ''}" role="img" aria-label="Covers ${Math.round(plan.coverage * 100)}% of the estimated drinks">
          <span style="width:${Math.round(plan.coverage * 100)}%"></span>
        </div>
        <p class="plan-stats">${plan.pours} pours · about ${perGuest} per guest${short ? ' · <b>budget covers ' + Math.round(plan.coverage * 100) + '% of the estimate</b>' : ''}</p>
        <ul class="plan-lines">
          ${plan.lines.map((l) => {
            const p = CATALOG[l.id];
            return `<li><button class="plan-line" data-open="${p.id}">
              <span class="thumb">${bottleArt(p)}</span>
              <span class="pl-name">${esc(p.name)}<small>${esc(SHELF[p.shelf].name)} · ${size(p.volumeMl)}</small></span>
              <span class="pl-qty">${l.qty} × ${money(p.price)}</span>
            </button></li>`;
          }).join('')}
        </ul>
        <button class="btn btn-gold wide" data-add-plan="${i}">Add all to cart</button>
        ${plan.leftover > 0 ? `<p class="small">${money(plan.leftover)} left for mixers and ice.</p>` : ''}
      </article>`;
  }).join('');
}

/* ---------- checkout ---------- */
const co = $('#checkout');
function goStep(n) {
  [...$('#steps').children].forEach((li, i) => li.classList.toggle('on', i <= n));
  $('#ship-form').hidden = n !== 0;
  $('#pay-form').hidden = n !== 1;
  $('#done').hidden = n !== 2;
}

function ageFrom(dob) {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) age--;
  return age;
}

function formError(form, msg) {
  form.querySelector('[data-err]').textContent = msg;
  return false;
}

function validateDelivery(form) {
  const f = Object.fromEntries(new FormData(form));
  const labels = { name: 'your name', mobile: 'a mobile number', email: 'your email', address: 'a delivery address', city: 'your city', dob: 'your date of birth' };
  for (const [k, label] of Object.entries(labels)) {
    if (!String(f[k] || '').trim()) return formError(form, `Please enter ${label}.`);
  }
  if (!isValidPhMobile(f.mobile)) return formError(form, 'Mobile number should look like 0917 123 4567.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return formError(form, 'Please enter a valid email.');
  if (ageFrom(f.dob) < 18) return formError(form, 'You must be 18 or older to order.');
  formError(form, '');
  return f;
}

function validatePayment(form) {
  const f = Object.fromEntries(new FormData(form));
  if (f.method === 'gcash' || f.method === 'maya') {
    if (!isValidPhMobile(f.wallet)) return formError(form, 'Enter the mobile number linked to your e-wallet.');
  }
  if (f.method === 'card') {
    if (!String(f.cardName).trim()) return formError(form, 'Please enter the name on the card.');
    if (!isValidCard(f.card)) return formError(form, 'Invalid card number.');
    if (!isValidExpiry(f.exp)) return formError(form, 'Expiry must be a future date as MM/YY.');
    if (!isValidCvc(f.cvc)) return formError(form, 'CVC must be 3 or 4 digits.');
  }
  formError(form, '');
  return true;
}

function syncMethod() {
  const m = $('#pay-form').elements.method.value;
  $('[data-for="wallet"]').hidden = !(m === 'gcash' || m === 'maya');
  $('[data-for="card"]').hidden = m !== 'card';
  $('[data-for="cod"]').hidden = m !== 'cod';
  $('#pay-btn').textContent = m === 'cod' ? 'Place order' : `Pay ${money(totals(state.cart, CATALOG, state.promo).total)}`;
}

/** Mock payment. Replace with a real gateway (PayMongo, Xendit, Stripe) before going live. */
function placeOrder() {
  return new Promise((resolve) => setTimeout(() => resolve(`ST-${Date.now().toString(36).toUpperCase()}`), 900));
}

/* ---------- events ---------- */
function bind() {
  const gate = $('#age-gate');
  if (!store.get('siptwice.age', false)) gate.hidden = false;
  $('#age-yes').onclick = () => { store.set('siptwice.age', true); gate.hidden = true; };
  $('#age-no').onclick = () => { $('#age-denied').hidden = false; };

  // Navigation
  $('#home').onclick = () => { $('#search').value = ''; state.query = ''; showView('shop'); renderOverview(); };
  document.querySelectorAll('.tab').forEach((t) => {
    t.onclick = () => { showView(t.dataset.view); if (t.dataset.view === 'shop') renderOverview(); };
  });
  $('#back').onclick = backToOverview;
  $('#prev-shelf').onclick = () => stepShelf(-1);
  $('#next-shelf').onclick = () => stepShelf(1);
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape' && drawer.classList.contains('open')) { closeCart(); return; }
    if (state.view !== 'shop' || !state.shelf || e.target.matches('input, select, textarea')) return;
    if (e.key === 'Escape') backToOverview();
    if (e.key === 'ArrowLeft') stepShelf(-1);
    if (e.key === 'ArrowRight') stepShelf(1);
  });

  $('#search').addEventListener('input', (e) => {
    state.query = e.target.value;
    if (state.view !== 'shop') showView('shop');
    if (state.shelf && !onShelf(state.shelf).length) showView('shop');
    state.shelf ? renderShelf() : renderOverview();
  });

  // Overview: click a shelf to zoom; hover the minis for prices too
  const cabinet = $('#cabinet');
  cabinet.addEventListener('click', (e) => {
    const c = e.target.closest('.cubby');
    if (c) openShelf(c.dataset.shelf, c);
  });

  // Shelf: hover/focus = price tag, click = details
  const grid = $('#shelf-grid');
  grid.addEventListener('mouseover', (e) => { const b = e.target.closest('.bottle'); if (b) showTag(b); });
  grid.addEventListener('mouseout', (e) => { if (!e.relatedTarget?.closest?.('.bottle')) hideTag(); });
  grid.addEventListener('focusin', (e) => { const b = e.target.closest('.bottle'); if (b) showTag(b); });
  grid.addEventListener('focusout', hideTag);
  grid.addEventListener('click', (e) => { const b = e.target.closest('.bottle'); if (b) openProduct(b.dataset.id); });
  window.addEventListener('scroll', hideTag, { passive: true });

  // Product dialog
  $('#pd-minus').onclick = () => { $('#pd-qty').value = Number($('#pd-qty').value) - 1; clampQtyInput(); };
  $('#pd-plus').onclick = () => { $('#pd-qty').value = Number($('#pd-qty').value) + 1; clampQtyInput(); };
  $('#pd-qty').addEventListener('change', clampQtyInput);
  $('#pd-add').onclick = () => {
    clampQtyInput();
    state.cart = addItem(state.cart, state.current, Number($('#pd-qty').value));
    renderCart();
    pd.close();
    toast(`${state.current.name} added to cart`);
  };

  for (const dlg of [pd, co]) {
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
  }

  // Anything with data-open shows that bottle (cart lines, planner lines)
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o) { closeCart(); openProduct(o.dataset.open); }
  });

  // Cart
  $('#open-cart').onclick = openCart;
  $('#close-cart').onclick = closeCart;
  backdrop.onclick = closeCart;
  $('#cart-lines').addEventListener('click', (e) => {
    const t = e.target.closest('button');
    const id = t?.dataset.inc || t?.dataset.dec || t?.dataset.remove;
    const p = CATALOG[id];
    const line = state.cart.find((l) => l.id === id);
    if (!p || !line) return;
    if (t.dataset.inc) state.cart = setQty(state.cart, p, line.qty + 1);
    if (t.dataset.dec) state.cart = setQty(state.cart, p, line.qty - 1);
    if (t.dataset.remove) state.cart = removeItem(state.cart, id);
    renderCart();
  });
  $('#promo').value = state.promo;
  $('#promo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = $('#promo').value.trim().toUpperCase();
    const msg = $('#promo-msg');
    if (!code) { state.promo = ''; msg.textContent = ''; }
    else if (promoRate(code) === null) { msg.textContent = 'That code isn’t valid.'; msg.className = 'msg bad'; return; }
    else { state.promo = code; msg.textContent = `${code} applied: ${promoRate(code) * 100}% off.`; msg.className = 'msg good'; }
    renderCart();
  });

  // Planner
  renderPlannerForm();
  $('#budget-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-budget]');
    if (b) $('#budget').value = b.dataset.budget;
  });
  const pax = $('#pax');
  $('#pax-minus').onclick = () => { pax.value = Math.max(1, Number(pax.value) - 1); };
  $('#pax-plus').onclick = () => { pax.value = Math.min(500, Number(pax.value) + 1); };
  $('#type-chips').addEventListener('change', (e) => {
    e.target.checked ? state.planTypes.add(e.target.value) : state.planTypes.delete(e.target.value);
  });
  $('#plan-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const opts = {
      budget: Math.max(0, Number($('#budget').value) || 0),
      pax: Math.max(1, Math.min(500, Number(pax.value) || 1)),
      types: [...state.planTypes],
      pace: $('#pace').value,
    };
    // Plan against what's still available after the current cart.
    const available = PRODUCTS.map((p) => ({ ...p, stock: p.stock - (state.cart.find((l) => l.id === p.id)?.qty ?? 0) }));
    state.plans = buildPlans(available, opts);
    renderPlans(opts);
    if (window.innerWidth < 900) $('#plans').scrollIntoView({ behavior: 'smooth' });
  });
  $('#plans').addEventListener('click', (e) => {
    const b = e.target.closest('[data-add-plan]');
    if (!b) return;
    for (const l of state.plans[Number(b.dataset.addPlan)].lines) state.cart = addItem(state.cart, CATALOG[l.id], l.qty);
    renderCart();
    openCart();
  });

  // Checkout
  $('#checkout-btn').onclick = () => { closeCart(); goStep(0); co.showModal(); };
  $('#ship-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const ok = validateDelivery(e.target);
    if (!ok) return;
    state.delivery = ok;
    if (!$('#pay-form').elements.wallet.value) $('#pay-form').elements.wallet.value = ok.mobile;
    $('#pay-totals').innerHTML = totalsHTML(totals(state.cart, CATALOG, state.promo));
    syncMethod();
    goStep(1);
  });
  $('#pay-form').addEventListener('change', (e) => { if (e.target.name === 'method') syncMethod(); });
  $('#back-ship').onclick = () => goStep(0);
  $('#pay-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validatePayment(e.target)) return;
    const btn = $('#pay-btn');
    btn.disabled = true;
    btn.textContent = 'Processing…';
    const orderNo = await placeOrder();
    btn.disabled = false;
    for (const l of state.cart) CATALOG[l.id].stock -= l.qty; // reflect the sale in this session
    $('#order-no').textContent = orderNo;
    $('#order-mobile').textContent = state.delivery.mobile;
    e.target.reset();
    state.cart = [];
    state.promo = '';
    $('#promo').value = '';
    $('#promo-msg').textContent = '';
    renderCart();
    state.shelf ? renderShelf() : renderOverview();
    goStep(2);
  });
}

renderOverview();
renderCart();
bind();
