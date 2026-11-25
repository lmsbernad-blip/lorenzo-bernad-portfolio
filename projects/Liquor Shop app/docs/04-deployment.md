# 4. Deployment and maintenance

## Update prices, stock or photos
1. Edit `enzo_pricelist.xlsx` (sheet "Market Comparison"). To track stock, add a column called **Stock**
   (and optionally **Description**). Until then every bottle has a placeholder stock of 6.
2. Photos: save one per bottle as `images/<id>.webp` (or .png/.jpg). The ids still missing a photo are
   listed in `images/EXPECTED.txt`.
3. Run `npm run import:prices`, then `npm test`.

## GitHub portfolio (GitHub Pages)
```
npm run publish:portfolio      # copies the shop into ../../public/sip-twice
```
Commit and push the portfolio; the existing GitHub Action deploys it to
`https://lmsbernad-blip.github.io/lorenzo-bernad-portfolio/sip-twice/`.
The Projects page links to it.

## Streamlit
Local: `pip install -r requirements.txt` then `streamlit run streamlit_app.py`.

Streamlit Community Cloud: **New app** → repo `lmsbernad-blip/lorenzo-bernad-portfolio`, branch `main`,
main file `projects/Liquor Shop app/streamlit_app.py`. It uses `requirements.txt` and `.streamlit/config.toml`
from the same folder.

## Before taking real orders
1. **Payments:** replace `placeOrder()` in `js/app.js` with a PH gateway (PayMongo or Xendit for GCash/Maya/cards).
2. **Server-side stock and prices:** the browser can't be trusted with either; confirm orders on a backend.
3. **Legal:** liquor permit, delivery rules for each LGU, age check and ID on delivery, privacy policy (Data Privacy Act).
4. **Photos:** use images you have rights to: your own photos or distributor-supplied product shots.
