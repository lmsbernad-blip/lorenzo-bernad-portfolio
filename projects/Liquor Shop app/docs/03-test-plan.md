# 3. Test plan

## 3.1 Automated unit tests (`npm test`): 19 tests
- `tests/cart.test.js`: add/merge, stock limit, out-of-stock, remove, totals, VAT included, delivery threshold,
  promo, card/expiry/CVC/PH mobile validation, peso formatting.
- `tests/planner.test.js`: need calculation; every strategy stays within budget and stock and covers the guests;
  premium spends more than value; type filter; tight budget gives partial coverage; empty stock;
  real catalogue (₱10k, 15 guests).

## 3.2 End-to-end (headless Edge, run 2026-11-25): passed
Age gate → overview (10 shelves) → zoom into Speyside (30 bottles) → hover tag → details → add 2 →
next shelf → back → search "macallan" (1 shelf) → planner ₱10k / 15 guests (3 plans) → add plan to cart →
delivery form → invalid card rejected → valid card → order number, cart empty → 375px width, no sideways scroll.
The same flow was checked inside Streamlit (overview + zoom into Islay).

## 3.3 Manual acceptance checklist
| # | Steps | Expected | Req |
|---|---|---|---|
| 1 | Fresh browser, "No, I'm under 18" | Blocked | FR-1 |
| 2 | Overview | All 10 shelves with bottles | FR-2 |
| 3 | Click a shelf, then ‹ › and "All shelves" | Zooms in, steps, zooms out | FR-3 |
| 4 | Hover / Tab to a bottle | Lifts; tag with name, price, size | FR-4 |
| 5 | Click a bottle | Details; sale bottles show regular price struck through | FR-5 |
| 6 | Change a price in the xlsx, `npm run import:prices`, reload | New price shows | FR-6 |
| 7 | Add `images/macallan-12-sherry-cask.webp`, re-import | Photo replaces drawn bottle | FR-7 |
| 8 | Planner ₱3,000 / 30 guests | Partial plan, red meter with coverage % | FR-12 |
| 9 | Planner with only "Gin" | Only gin bottles | FR-12 |
| 10 | `streamlit run streamlit_app.py` | Shop + Price list tabs work | FR-13 |
| 11 | Pay with GCash, empty wallet number | Error shown | FR-11 |
