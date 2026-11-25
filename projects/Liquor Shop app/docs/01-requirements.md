# 1. Requirements: Sip Twice online shop

## 1.1 Purpose
An online liquor shop for **Sip Twice** whose catalogue *is* the interface: a cabinet of wooden
shelves, one per style of spirit, holding every bottle in the price list.

## 1.2 Stakeholders
| Stakeholder | Interest |
|---|---|
| Owner (Sip Twice) | Distinctive brand, catalogue driven by the existing price list, sales |
| Customer (18+) | Find a bottle quickly, see its price, plan a party within budget, pay with familiar methods |
| Regulator | Age verification; responsible-drinking notice; ID on delivery |

## 1.3 Functional requirements
| ID | Requirement | Priority | Version |
|---|---|---|---|
| FR-1 | Age gate on first visit (18+, Philippines); under-age visitors are blocked | Must | v1, v2 age changed |
| FR-2 | **Overview** shows every shelf at once, each with its bottles | Must | v2 |
| FR-3 | Clicking a shelf **zooms in** to it; next/previous shelf; back to overview | Must | v2 |
| FR-4 | Hover/focus a bottle lifts it and shows name, price, size | Must | v1 |
| FR-5 | Clicking a bottle shows details: shelf, price, sale price, size, cost per pour, availability | Must | v1 |
| FR-6 | Catalogue and prices come from `enzo_pricelist.xlsx` | Must | v2 |
| FR-7 | Each bottle shows its product photo when one is supplied, else a drawn bottle | Must | v2 |
| FR-8 | Search across all shelves | Should | v1 |
| FR-9 | Cart: add with quantity (limited to stock), change quantity, remove, promo code `SIPTWICE10` | Must | v1 |
| FR-10 | Totals in pesos; prices include 12% VAT; ₱150 delivery, free from ₱5,000 | Must | v2 |
| FR-11 | Checkout: delivery details → payment (GCash, Maya, card, COD) → confirmation | Must | v2 |
| FR-12 | **Party Planner**: customer enters budget, number of guests, liquor types and drinking pace; gets up to 3 bottle plans from current stock, each addable to cart in one click | Must | v2 |
| FR-13 | Shop available on **Streamlit**, plus a searchable price list | Must | v2 |
| FR-14 | Shop published under the GitHub portfolio | Must | v2 |
| FR-15 | Cart survives page reload | Should | v1 |

## 1.4 Non-functional requirements
- **Accessibility:** keyboard operable (Tab/Enter, Esc to go back, ←/→ between shelves), AA contrast, works at 360px width, respects reduced motion.
- **Performance:** no frameworks; one JSON catalogue; images lazy-loaded.
- **Security / privacy:** no payment data stored or sent (demo). The source spreadsheet, which has competitor comparisons, is never published, only shop prices.
- **Maintainability:** owner updates the spreadsheet and re-runs one import command; pricing and planner logic are pure and unit-tested.

## 1.5 Out of scope
User accounts, real payment capture, server-side stock, delivery-zone legality checks.
