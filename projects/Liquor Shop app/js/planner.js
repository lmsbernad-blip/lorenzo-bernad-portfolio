// Party planner: given a budget, guest count, liquor types and drinking pace, suggest bottle
// combinations from what is in stock. Pure logic - unit tested in tests/planner.test.js.

export const POUR_ML = 45; // one standard pour / shot
export const PACES = {
  light: { label: 'Light (2-3 drinks each)', drinks: 3 },
  moderate: { label: 'Moderate (4-5 drinks each)', drinks: 5 },
  heavy: { label: 'Heavy (7-8 drinks each)', drinks: 8 },
};

export const STRATEGIES = {
  value: { title: 'Best Value', blurb: 'Covers the most drinks for the least money.' },
  balanced: { title: 'Crowd Favourite', blurb: 'Good bottles at a price that fits your budget.' },
  premium: { title: 'Premium Night', blurb: 'The best bottles your budget allows, with enough for everyone.' },
};

export function neededMl(pax, pace = 'moderate') {
  return pax * (PACES[pace] ?? PACES.moderate).drinks * POUR_ML;
}

/**
 * Build one plan.
 * @param products  array of { id, price, volumeMl, stock, type }
 * @param opts      { budget, pax, types: string[] (empty = any), pace }
 * @param strategy  'value' | 'balanced' | 'premium'
 */
export function buildPlan(products, { budget, pax, types = [], pace = 'moderate' }, strategy) {
  const need = neededMl(pax, pace);
  const pool = products.filter((p) => p.stock > 0 && p.price > 0 && (!types.length || types.includes(p.type)));
  const empty = { strategy, lines: [], total: 0, ml: 0, needMl: need, pours: 0, coverage: 0, leftover: budget };
  if (!pool.length || budget <= 0 || need <= 0) return empty;

  const perMl = (p) => p.price / p.volumeMl;
  // If even the cheapest bottles can't cover everyone, don't reserve money - just buy as much as fits.
  const cheapestPerMl = budget >= need * Math.min(...pool.map(perMl)) ? Math.min(...pool.map(perMl)) : 0;
  const avgMl = pool.reduce((s, p) => s + p.volumeMl, 0) / pool.length;
  const targetPrice = budget / Math.max(1, Math.ceil(need / avgMl));

  const sorters = {
    value: (a, b) => perMl(a) - perMl(b),
    balanced: (a, b) => Math.abs(a.price - targetPrice) - Math.abs(b.price - targetPrice),
    premium: (a, b) => b.price - a.price,
  };
  // Variety: the value plan may buy a cheap bottle many times; the others spread across bottles.
  const maxPerSku = strategy === 'value' ? Infinity : 3;

  const byType = new Map();
  for (const p of [...pool].sort(sorters[strategy])) {
    if (!byType.has(p.type)) byType.set(p.type, []);
    byType.get(p.type).push(p);
  }

  const qty = new Map();
  let spent = 0;
  let ml = 0;
  let rotation = [...byType.keys()];
  while (ml < need && rotation.length) {
    const stillOpen = [];
    for (const type of rotation) {
      if (ml >= need) break;
      const remainingNeed = need - ml;
      const pick = byType.get(type).find((p) => {
        const q = qty.get(p.id) ?? 0;
        if (q >= Math.min(p.stock, maxPerSku)) return false;
        const after = budget - spent - p.price;
        if (after < 0) return false;
        // Keep enough money to cover the rest of the drinks at the cheapest rate.
        const stillNeeded = Math.max(0, remainingNeed - p.volumeMl);
        return after >= stillNeeded * cheapestPerMl;
      });
      if (pick) {
        qty.set(pick.id, (qty.get(pick.id) ?? 0) + 1);
        spent += pick.price;
        ml += pick.volumeMl;
        stillOpen.push(type);
      }
    }
    rotation = stillOpen;
  }

  // Budget too tight to cover everything: fall back to the cheapest-per-ml bottles we can afford.
  if (ml < need && strategy !== 'value') return { ...buildPlan(products, { budget, pax, types, pace }, 'value'), strategy };

  const lines = [...qty].map(([id, q]) => ({ id, qty: q }));
  return {
    strategy,
    lines,
    total: Math.round(spent * 100) / 100,
    ml,
    needMl: need,
    pours: Math.floor(ml / POUR_ML),
    coverage: Math.min(1, ml / need),
    leftover: Math.round((budget - spent) * 100) / 100,
  };
}

/** All three plans, dropping any that turned out identical. */
export function buildPlans(products, opts) {
  const seen = new Set();
  return Object.keys(STRATEGIES)
    .map((s) => buildPlan(products, opts, s))
    .filter((plan) => {
      const sig = plan.lines.map((l) => `${l.id}x${l.qty}`).sort().join('|');
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
}
