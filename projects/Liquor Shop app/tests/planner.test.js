import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPlan, buildPlans, neededMl } from '../js/planner.js';

const products = [
  { id: 'cheap-gin', type: 'Gin', price: 800, volumeMl: 700, stock: 10 },
  { id: 'mid-gin', type: 'Gin', price: 2000, volumeMl: 700, stock: 4 },
  { id: 'cheap-whisky', type: 'Whisky', price: 1000, volumeMl: 1000, stock: 10 },
  { id: 'mid-whisky', type: 'Whisky', price: 3000, volumeMl: 700, stock: 4 },
  { id: 'top-whisky', type: 'Whisky', price: 9000, volumeMl: 700, stock: 1 },
  { id: 'sold-out', type: 'Vodka', price: 500, volumeMl: 1000, stock: 0 },
];

const qtyOf = (plan, id) => plan.lines.find((l) => l.id === id)?.qty ?? 0;
const opts = { budget: 10000, pax: 10, types: [], pace: 'moderate' }; // needs 2250 ml

test('neededMl = pax x drinks x 45ml', () => {
  assert.equal(neededMl(10, 'moderate'), 2250);
  assert.equal(neededMl(4, 'light'), 540);
});

for (const strategy of ['value', 'balanced', 'premium']) {
  test(`${strategy}: within budget, within stock, covers the guests`, () => {
    const plan = buildPlan(products, opts, strategy);
    assert.ok(plan.total <= opts.budget);
    assert.ok(plan.ml >= plan.needMl, `ml ${plan.ml} < need ${plan.needMl}`);
    for (const l of plan.lines) {
      assert.ok(l.qty <= products.find((p) => p.id === l.id).stock);
    }
    assert.equal(qtyOf(plan, 'sold-out'), 0);
  });
}

test('premium plan spends more on better bottles than value plan', () => {
  const v = buildPlan(products, opts, 'value');
  const p = buildPlan(products, opts, 'premium');
  assert.ok(p.total > v.total);
  assert.equal(qtyOf(p, 'top-whisky'), 0, 'top whisky would leave too little to cover everyone');
});

test('type filter is respected', () => {
  const plan = buildPlan(products, { ...opts, types: ['Gin'] }, 'balanced');
  assert.ok(plan.lines.every((l) => l.id.endsWith('gin')));
});

test('tight budget returns partial coverage instead of overspending', () => {
  const plan = buildPlan(products, { ...opts, budget: 1500, pax: 20 }, 'premium');
  assert.ok(plan.total <= 1500);
  assert.ok(plan.coverage < 1);
  assert.ok(plan.lines.length > 0, 'should still suggest what the budget can buy');
});

test('no matching stock gives an empty plan', () => {
  const plan = buildPlan(products, { ...opts, types: ['Vodka'] }, 'value');
  assert.deepEqual(plan.lines, []);
});

test('real catalogue: 10k for 15 guests', () => {
  const catalog = JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url)));
  const type = Object.fromEntries(catalog.shelves.map((s) => [s.id, s.type]));
  const items = catalog.products.map((p) => ({ ...p, type: type[p.shelf] }));
  const plans = buildPlans(items, { budget: 10000, pax: 15, types: [], pace: 'moderate' });
  assert.ok(plans.length >= 2);
  for (const plan of plans) {
    assert.ok(plan.total <= 10000);
    assert.ok(plan.coverage === 1);
  }
});
