"""Import enzo_pricelist.xlsx -> data/catalog.json (the catalogue both the web shop and Streamlit use).

Usage:  python scripts/import_pricelist.py [path/to/enzo_pricelist.xlsx]

Reads the "Market Comparison" sheet: columns "Bottle" and "Sip Twice Price".
Optional extra columns (add them to the sheet whenever you like):
  Stock        - bottles on hand (otherwise the last imported value is kept, else DEFAULT_STOCK)
  Description  - short text shown in the bottle details

Bottles listed twice keep the LOWER price as the sale price and the higher as the regular price.
Images: drop  images/<id>.jpg|.png|.webp  (the id is printed by this script and listed in
images/EXPECTED.txt) and re-run; bottles without a photo get a drawn bottle instead.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "catalog.json"
IMAGES = ROOT / "images"
DEFAULT_STOCK = 6
DEFAULT_ML = 700

# Shelves in display order. `type` is what the party planner filters on.
SHELVES = [
    {"id": "speyside", "name": "Speyside Single Malt", "type": "Whisky", "shape": "whisky", "glass": "#b8651b",
     "blurb": "Scotland's malt heartland: fruity, honeyed, often sherried."},
    {"id": "highland", "name": "Highland & Lowland Malt", "type": "Whisky", "shape": "whisky", "glass": "#c98a2b",
     "blurb": "From rich and robust Highland drams to light, floral Lowland malts."},
    {"id": "islay", "name": "Islay & Islands", "type": "Whisky", "shape": "rum", "glass": "#a8743a",
     "blurb": "Coastal whiskies, many of them peated: smoky, briny, bold."},
    {"id": "blended", "name": "Blended Scotch", "type": "Whisky", "shape": "whisky", "glass": "#c47a2c",
     "blurb": "Smooth, crowd-pleasing blends: great neat, on the rocks or in a highball."},
    {"id": "asian", "name": "Japanese & Asian Whisky", "type": "Whisky", "shape": "vodka", "glass": "#d79a3b",
     "blurb": "Precise, elegant whiskies from Japan and Taiwan."},
    {"id": "american", "name": "Bourbon & Tennessee", "type": "Whisky", "shape": "whisky", "glass": "#a5521a",
     "blurb": "Sweet American whiskey: vanilla, caramel and charred oak."},
    {"id": "irish", "name": "Irish Whiskey", "type": "Whisky", "shape": "rum", "glass": "#c9862f",
     "blurb": "Triple-distilled and easy-going."},
    {"id": "gin", "name": "Gin", "type": "Gin", "shape": "gin", "glass": "#cfe6e2",
     "blurb": "Juniper-led spirits for G&Ts and cocktails."},
    {"id": "vodka", "name": "Vodka", "type": "Vodka", "shape": "vodka", "glass": "#e8f1f7",
     "blurb": "Clean, versatile and party-ready."},
    {"id": "tequila", "name": "Tequila", "type": "Tequila", "shape": "tequila", "glass": "#eadfb8",
     "blurb": "100% agave: for shots, margaritas and sipping."},
]

# First matching keyword wins (gin first so "Suntory Roku Gin" doesn't land on the Japanese whisky shelf).
RULES = [
    ("gin", ["tanqueray", "beefeater", "bombay", "hendrick", "roku"]),
    ("vodka", ["absolut", "belvedere", "grey goose"]),
    ("tequila", ["1800", "don julio"]),
    ("islay", ["ardbeg", "bowmore", "caol ila", "lagavulin", "laphroaig", "jura", "arran"]),
    ("speyside", ["aberlour", "balvenie", "benriach", "glenfarclas", "glenfiddich", "glengrant", "glen grant",
                  "glenlivet", "macallan", "glenallachie"]),
    ("highland", ["aberfeldy", "dalmore", "deanston", "glendronach", "glengoyne", "glenmorangie",
                  "auchentoshan", "bladnoch"]),
    ("blended", ["chivas", "johnnie walker", "monkey shoulder", "ballantine"]),
    ("irish", ["tullamore", "jameson"]),
    ("asian", ["hibiki", "kakubin", "nikka", "hakushu", "yamazaki", "kavalan"]),
    ("american", ["jim beam", "bulleit", "jack daniel", "woodford"]),
]

# Different spellings of the same bottle in the sheet.
ALIASES = {
    "macallan double cask": "macallan 12 double cask",
    "tullamore dew irish whiskey": "tullamore dew",
}

SIZE_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s*(ml|l)\b", re.I)


def size_ml(name: str) -> int | None:
    m = SIZE_RE.search(name)
    if not m:
        return None
    n = float(m.group(1))
    return int(n * 1000) if m.group(2).lower() == "l" else int(n)


def display_name(name: str) -> str:
    n = SIZE_RE.sub("", name)
    n = re.sub(r"(\d+)\s*yo\b", r"\1", n, flags=re.I)
    return re.sub(r"\s+", " ", n).strip()


def key(name: str) -> str:
    k = re.sub(r"[^a-z0-9 ]", "", display_name(name).lower())
    k = re.sub(r"\s+", " ", k).strip()
    return ALIASES.get(k, k)


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def shelf_for(name: str) -> str:
    low = name.lower()
    for shelf, words in RULES:
        if any(w in low for w in words):
            return shelf
    raise SystemExit(f"Don't know which shelf '{name}' belongs on - add a keyword to RULES.")


def find_image(pid: str) -> str | None:
    for ext in ("webp", "png", "jpg", "jpeg"):
        if (IMAGES / f"{pid}.{ext}").exists():
            return f"images/{pid}.{ext}"
    return None


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "enzo_pricelist.xlsx"
    ws = openpyxl.load_workbook(src, data_only=True)["Market Comparison"]
    rows = list(ws.iter_rows(values_only=True))
    header = [str(h).strip().lower() if h else "" for h in rows[0]]
    col = {h: i for i, h in enumerate(header)}
    i_name, i_price = col["bottle"], col["sip twice price"]
    i_stock, i_desc = col.get("stock"), col.get("description")

    previous = {}
    if OUT.exists():
        previous = {p["id"]: p for p in json.loads(OUT.read_text(encoding="utf-8"))["products"]}

    merged: dict[str, dict] = {}
    for r in rows[1:]:
        if not r or not r[i_name] or r[i_price] in (None, ""):
            continue
        raw = str(r[i_name]).strip()
        price = float(r[i_price])
        k = key(raw)
        entry = merged.setdefault(k, {"names": [], "prices": [], "ml": None, "stock": None, "desc": None})
        entry["names"].append(raw)
        entry["prices"].append(price)
        entry["ml"] = entry["ml"] or size_ml(raw)
        if i_stock is not None and r[i_stock] not in (None, ""):
            entry["stock"] = int(r[i_stock])
        if i_desc is not None and r[i_desc]:
            entry["desc"] = str(r[i_desc]).strip()

    products, dupes = [], []
    for k, e in merged.items():
        name = display_name(e["names"][-1])  # later rows carry the cleaner catalogue name
        pid = slug(name)
        low, high = min(e["prices"]), max(e["prices"])
        if len(e["names"]) > 1:
            dupes.append(f"  {name}: {', '.join(f'{p:,.0f}' for p in e['prices'])} -> sale {low:,.0f}")
        prev = previous.get(pid, {})
        products.append({
            "id": pid,
            "name": name,
            "shelf": shelf_for(name),
            "price": low,
            "regularPrice": high if high > low else None,
            "volumeMl": e["ml"] or prev.get("volumeMl") or DEFAULT_ML,
            "sizeAssumed": e["ml"] is None,
            "stock": e["stock"] if e["stock"] is not None else prev.get("stock", DEFAULT_STOCK),
            "description": e["desc"] or prev.get("description"),
            "image": find_image(pid),
        })

    order = {s["id"]: i for i, s in enumerate(SHELVES)}
    products.sort(key=lambda p: (order[p["shelf"]], p["name"].lower()))

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({"shelves": SHELVES, "products": products}, indent=1, ensure_ascii=False), encoding="utf-8")
    IMAGES.mkdir(exist_ok=True)
    missing = [p["id"] for p in products if not p["image"]]
    (IMAGES / "EXPECTED.txt").write_text(
        "Put one photo per bottle here, named <id>.webp / .png / .jpg, then re-run scripts/import_pricelist.py\n"
        "Transparent-background PNG/WebP, about 400px tall, looks best on the shelves.\n\n"
        "Still missing:\n" + "\n".join(missing) + "\n", encoding="utf-8")

    print(f"{len(products)} bottles written to {OUT.relative_to(ROOT)} ({len(rows) - 1} sheet rows)")
    for s in SHELVES:
        print(f"  {s['name']:<26} {sum(p['shelf'] == s['id'] for p in products)}")
    if dupes:
        print("Listed twice (lower price used as sale price):\n" + "\n".join(dupes))
    print(f"Photos: {len(products) - len(missing)} found, {len(missing)} missing (see images/EXPECTED.txt)")


if __name__ == "__main__":
    main()
