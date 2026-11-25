# Sip Twice: interactive liquor shop

The catalogue is a wall of shelves. See every shelf at a glance, click one to zoom in, hover a bottle
for its price, click it for details. A **Party Planner** turns a budget, guest count and liquor
preference into bottle lists from current stock. Cart, promo codes, and checkout with GCash, Maya,
card or cash on delivery (demo, nothing is charged).

**Live demo:** https://lmsbernad-blip.github.io/lorenzo-bernad-portfolio/sip-twice/

```
npm start                 # static site at http://localhost:5173
npm test                  # 19 unit tests (cart, pricing, planner)
npm run import:prices     # enzo_pricelist.xlsx -> data/catalog.json
npm run publish:portfolio # copy into the portfolio's public/sip-twice
streamlit run streamlit_app.py
```

Plain HTML, CSS and JavaScript modules; Python only for the price-list import and the Streamlit wrapper.

## Software development lifecycle
1. [Requirements](docs/01-requirements.md)
2. [Design](docs/02-design.md), including the Party Planner algorithm
3. Implementation: `index.html`, `css/`, `js/`, `scripts/`, `streamlit_app.py`
4. [Testing](docs/03-test-plan.md): unit tests in `tests/`, plus end-to-end results
5. [Deployment and maintenance](docs/04-deployment.md)

Try card `4242 4242 4242 4242` and promo code `SIPTWICE10`.
