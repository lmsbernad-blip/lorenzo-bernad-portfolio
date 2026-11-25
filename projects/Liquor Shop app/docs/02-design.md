# 2. System design

## 2.1 Architecture
```
enzo_pricelist.xlsx ──► scripts/import_pricelist.py ──► data/catalog.json ◄── images/<id>.webp
                                                              │
                         ┌────────────────────────────────────┴──────────────────┐
                 Static site (index.html, css/, js/)                    streamlit_app.py
                 served by server.js locally,                           inlines the same page +
                 copied to portfolio public/sip-twice/                  catalogue + photos into
                 by scripts/publish-portfolio.mjs                       one component; adds Price list tab
```
| File | Role |
|---|---|
| `js/cart.js` | Cart, totals, VAT, delivery, promo, payment validation (pure, tested) |
| `js/planner.js` | Party Planner algorithm (pure, tested) |
| `js/app.js` | UI: overview, zoom, bottle art, dialogs, cart, checkout, planner |

## 2.2 Data model (`data/catalog.json`)
```js
Shelf   { id, name, type: 'Whisky'|'Gin'|'Vodka'|'Tequila', shape, glass, blurb }
Product { id, name, shelf, price, regularPrice|null, volumeMl, sizeAssumed, stock, description|null, image|null }
```
**Import rules**
- Shelf from brand keywords (e.g. Macallan → Speyside, Ardbeg → Islay); unknown brands stop the import with a message.
- Size parsed from the name (`700ml`, `1L`); 700 ml assumed if missing (`sizeAssumed`, shown with *).
- Bottles listed twice keep the lower price as the sale price and the higher as `regularPrice`.
- Optional sheet columns `Stock` and `Description`; re-importing keeps previous stock otherwise.

## 2.3 Business rules
- Prices are VAT-inclusive; VAT shown as `total × 12/112`.
- Delivery ₱150, free when (subtotal − discount) ≥ ₱5,000.
- `SIPTWICE10` = 10% off. Quantity is limited to 1…stock.

## 2.4 Party Planner algorithm
1. Need = guests × drinks per guest (light 3 / moderate 5 / heavy 8) × 45 ml.
2. Candidates = in-stock bottles of the chosen types, after subtracting what's already in the cart.
3. Three strategies sort candidates differently:
   - **Best Value**: cheapest per ml.
   - **Crowd Favourite**: price closest to budget ÷ bottles needed.
   - **Premium Night**: most expensive first.
4. Bottles are picked round-robin across liquor types (for variety, at most 3 of a bottle except in Best Value).
   A bottle is only picked if the money left still covers the remaining drinks at the cheapest rate.
5. If the budget can't cover everyone, the plan buys as much as fits and shows the coverage percentage.
6. Identical plans are merged.

## 2.5 UI
- **Overview:** a cabinet grid; each cubby shows its bottles in miniature on a plank, with a brass name plate, count and "from" price.
- **Zoom:** a FLIP animation scales the shelf view from the clicked cubby. Each grid row is one shelf plank
  (painted with a repeating gradient), with a price strip on the shelf edge under every bottle.
- **Details:** a dialog with a large bottle on a plank.
- **Planner:** form on the left; plan cards with a coverage meter and "Add all to cart" on the right.
