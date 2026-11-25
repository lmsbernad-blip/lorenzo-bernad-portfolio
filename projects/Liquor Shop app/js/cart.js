// Pure cart, pricing and validation logic. No DOM access - unit tested in tests/cart.test.js.
// Prices are in Philippine pesos and already include 12% VAT.

export const VAT_RATE = 0.12;
export const DELIVERY_FEE = 150;
export const FREE_DELIVERY_FROM = 5000;
export const PROMOS = { SIPTWICE10: 0.10 };

const round2 = (n) => Math.round(n * 100) / 100;
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

/** Add qty of a product; merges with an existing line and never exceeds stock. */
export function addItem(lines, product, qty = 1) {
  if (product.stock <= 0) return lines;
  const existing = lines.find((l) => l.id === product.id);
  const next = clamp((existing ? existing.qty : 0) + qty, 1, product.stock);
  if (existing) return lines.map((l) => (l.id === product.id ? { ...l, qty: next } : l));
  return [...lines, { id: product.id, qty: next }];
}

/** Set an exact quantity; 0 or less removes the line. */
export function setQty(lines, product, qty) {
  if (qty <= 0) return removeItem(lines, product.id);
  return lines.map((l) => (l.id === product.id ? { ...l, qty: clamp(qty, 1, product.stock) } : l));
}

export function removeItem(lines, id) {
  return lines.filter((l) => l.id !== id);
}

export function itemCount(lines) {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/** 0 for no code, the discount rate for a valid code, null for an invalid one. */
export function promoRate(code) {
  if (!code) return 0;
  return PROMOS[code.trim().toUpperCase()] ?? null;
}

/** Totals for a cart. `catalog` maps id -> product. VAT is shown as an included amount. */
export function totals(lines, catalog, promoCode = '') {
  const subtotal = round2(lines.reduce((s, l) => s + (catalog[l.id]?.price ?? 0) * l.qty, 0));
  const discount = round2(subtotal * (promoRate(promoCode) || 0));
  const net = subtotal - discount;
  const delivery = subtotal === 0 || net >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
  const total = round2(net + delivery);
  const vatIncluded = round2((net * VAT_RATE) / (1 + VAT_RATE));
  return { subtotal, discount, delivery, vatIncluded, total };
}

/** Luhn check for card numbers (spaces/dashes ignored). */
export function isValidCard(number) {
  const digits = String(number).replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Expiry as "MM/YY"; valid through the end of that month. */
export function isValidExpiry(value, now = new Date()) {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(value).trim());
  if (!m) return false;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return false;
  return new Date(2000 + Number(m[2]), month, 1) > now;
}

export function isValidCvc(value) {
  return /^\d{3,4}$/.test(String(value).trim());
}

/** Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX. */
export function isValidPhMobile(value) {
  return /^(09|\+639)\d{9}$/.test(String(value).replace(/[\s-]/g, ''));
}

export function money(n) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
