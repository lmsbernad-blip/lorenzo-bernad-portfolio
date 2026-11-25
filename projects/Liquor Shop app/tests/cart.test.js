import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addItem, setQty, removeItem, itemCount, totals, promoRate,
  isValidCard, isValidExpiry, isValidCvc, isValidPhMobile, money,
} from '../js/cart.js';

const a = { id: 'a', price: 2000, stock: 3 };
const b = { id: 'b', price: 999, stock: 10 };
const none = { id: 'n', price: 500, stock: 0 };
const catalog = { a, b, n: none };

test('addItem adds and merges lines', () => {
  assert.deepEqual(addItem(addItem([], a, 1), a, 1), [{ id: 'a', qty: 2 }]);
});

test('addItem clamps to stock and ignores out-of-stock', () => {
  assert.equal(addItem([], a, 99)[0].qty, 3);
  assert.deepEqual(addItem([], none, 1), []);
});

test('setQty clamps, and 0 removes', () => {
  const c = addItem([], b, 2);
  assert.equal(setQty(c, b, 50)[0].qty, 10);
  assert.deepEqual(setQty(c, b, 0), []);
});

test('removeItem and itemCount', () => {
  const c = addItem(addItem([], a, 2), b, 3);
  assert.equal(itemCount(c), 5);
  assert.equal(itemCount(removeItem(c, 'a')), 3);
});

test('empty cart totals are zero', () => {
  assert.deepEqual(totals([], catalog), { subtotal: 0, discount: 0, delivery: 0, vatIncluded: 0, total: 0 });
});

test('delivery fee below threshold; VAT is included, not added', () => {
  const t = totals([{ id: 'b', qty: 2 }], catalog); // 1998
  assert.equal(t.delivery, 150);
  assert.equal(t.total, 2148);
  assert.equal(t.vatIncluded, 214.07);
});

test('free delivery from 5000', () => {
  assert.equal(totals([{ id: 'a', qty: 3 }], catalog).delivery, 0);
});

test('promo SIPTWICE10 is case-insensitive and can drop below free delivery', () => {
  assert.equal(promoRate(' siptwice10 '), 0.1);
  assert.equal(promoRate('FOO'), null);
  const t = totals([{ id: 'a', qty: 2 }, { id: 'b', qty: 1 }], catalog, 'SIPTWICE10'); // 4999 -> 4499.1
  assert.equal(t.discount, 499.9);
  assert.equal(t.delivery, 150);
});

test('card, expiry, cvc, mobile validation', () => {
  assert.ok(isValidCard('4242 4242 4242 4242'));
  assert.ok(!isValidCard('1234 5678 9012 3456'));
  const now = new Date(2026, 10, 25);
  assert.ok(isValidExpiry('11/26', now));
  assert.ok(!isValidExpiry('10/26', now));
  assert.ok(!isValidExpiry('13/27', now));
  assert.ok(isValidCvc('123') && !isValidCvc('12'));
  assert.ok(isValidPhMobile('0917 123 4567'));
  assert.ok(isValidPhMobile('+639171234567'));
  assert.ok(!isValidPhMobile('12345'));
});

test('money formats pesos', () => {
  assert.equal(money(10000), '₱10,000');
  assert.equal(money(214.07), '₱214.07');
});
