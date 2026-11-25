"""Sip Twice on Streamlit.

The interactive shop (shelves, zoom, bottle details, cart, checkout, party planner) is the same
HTML/CSS/JS as the static site. This app inlines it into one page and adds a searchable price list.

    streamlit run streamlit_app.py
"""
from __future__ import annotations

import base64
import json
import mimetypes
import re
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

ROOT = Path(__file__).resolve().parent
JS_FILES = ["js/cart.js", "js/planner.js", "js/app.js"]  # dependency order

IMPORT_RE = re.compile(r"^\s*import\s+[\s\S]*?\s+from\s+['\"][^'\"]+['\"];\s*$", re.M)


@st.cache_data
def load_catalog() -> dict:
    data = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
    # The page lives in an iframe with no file access, so photos travel as data URIs.
    for p in data["products"]:
        if p.get("image"):
            path = ROOT / p["image"]
            if path.exists():
                mime = mimetypes.guess_type(path.name)[0] or "image/png"
                p["image"] = f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"
            else:
                p["image"] = None
    return data


@st.cache_data
def build_page(catalog_json: str) -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "css" / "styles.css").read_text(encoding="utf-8")
    js = "\n".join(
        re.sub(r"^export\s+", "", IMPORT_RE.sub("", (ROOT / f).read_text(encoding="utf-8")), flags=re.M)
        for f in JS_FILES
    )
    safe_json = catalog_json.replace("</", "<\\/")
    html = html.replace('<link rel="stylesheet" href="css/styles.css" />', f"<style>{css}</style>")
    html = html.replace(
        '<script type="module" src="js/app.js"></script>',
        f"<script>window.__SIP_TWICE__ = {safe_json};</script>\n<script type=\"module\">{js}</script>",
    )
    return html


st.set_page_config(page_title="Sip Twice", page_icon="🥃", layout="wide")
st.markdown(
    """<style>
      .block-container { padding-top: 1rem; padding-bottom: 0; max-width: 100%; }
      header[data-testid="stHeader"] { background: transparent; }
    </style>""",
    unsafe_allow_html=True,
)

catalog = load_catalog()
shop_tab, list_tab = st.tabs(["🥃 Shop", "📋 Price list"])

with shop_tab:
    components.html(build_page(json.dumps(catalog, ensure_ascii=False)), height=1100, scrolling=True)

with list_tab:
    shelves = {s["id"]: s for s in catalog["shelves"]}
    query = st.text_input("Search", placeholder="e.g. Macallan, gin, 1L")
    picked = st.multiselect("Shelf", [s["name"] for s in catalog["shelves"]])
    rows = [
        {
            "Bottle": p["name"],
            "Shelf": shelves[p["shelf"]]["name"],
            "Type": shelves[p["shelf"]]["type"],
            "Size (ml)": p["volumeMl"],
            "Price (₱)": p["price"],
            "Regular (₱)": p["regularPrice"],
            "In stock": p["stock"],
        }
        for p in catalog["products"]
        if (not picked or shelves[p["shelf"]]["name"] in picked)
        and (not query or query.lower() in f"{p['name']} {shelves[p['shelf']]['name']} {p['volumeMl']}ml".lower())
    ]
    st.caption(f"{len(rows)} of {len(catalog['products'])} bottles · prices include VAT")
    st.dataframe(
        rows,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Price (₱)": st.column_config.NumberColumn(format="₱%,.0f"),
            "Regular (₱)": st.column_config.NumberColumn(format="₱%,.0f", help="Shown when the bottle is on sale"),
        },
    )
