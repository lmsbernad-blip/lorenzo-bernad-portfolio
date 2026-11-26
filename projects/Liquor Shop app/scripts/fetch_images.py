"""Find a product photo for every bottle in data/catalog.json that doesn't have one yet.

Usage:  python scripts/fetch_images.py [--force] [--only id1,id2]

Sources (both openly licensed, so the shop can show them):
  1. Open Food Facts   - product photos, CC BY-SA 3.0
  2. Wikimedia Commons - free-licensed photos (licence recorded per file)

A result is only accepted when the brand words and any age statement (12, 18, ...) match the
bottle's name, and the result doesn't name a different age. Everything is logged to
images/CREDITS.json (source page + licence). Wrong picture? Delete the file, add its id to
images/REJECTED.txt so it isn't fetched again, and re-run scripts/import_pricelist.py.
"""
from __future__ import annotations

import io
import json
import re
import sys
import time
import urllib.parse
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
CREDITS = IMAGES / "CREDITS.json"
REJECTED = IMAGES / "REJECTED.txt"
UA = {"User-Agent": "SipTwiceCatalog/1.0 (shop catalogue image lookup)"}
STOP = {"the", "of", "no", "and", "single", "malt", "whisky", "whiskey", "scotch", "gin", "vodka",
        "tequila", "london", "dry", "irish", "bourbon", "yo", "year", "years", "old", "distillery"}
# Words that mean a different product from the same brand (flavours, finishes, other bottlings).
VARIANTS = {"citron", "mandrin", "raspberri", "vanilia", "vanilla", "peach", "pear", "apple", "honey", "fire",
            "bramble", "citrus", "lime", "orange", "mango", "lemon", "cherry", "flavored", "flavoured", "liqueur",
            "cream", "rye", "caskmates", "barrel", "red", "green", "rangpur", "premium", "sinatra", "devils",
            "peated", "fiction", "toasted", "cask", "sherry", "port", "rum", "smoky", "13", "oak",
            "black", "white", "double", "gold", "blue", "silver", "reposado", "anejo", "blanco"}


def get(url: str, tries: int = 4) -> bytes:
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == tries - 1:
                raise
            time.sleep(5 * (attempt + 1))  # rate limited: back off


def words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower().replace("'", ""))


def ages(text: str) -> set[str]:
    """Age statements like '12', '18 yo', '21 years' (ignores sizes and ABV)."""
    t = re.sub(r"\d+([.,]\d+)?\s*(%|(ml|cl|l|proof|vol)\b)", " ", text.lower())
    return set(re.findall(r"\b(\d{1,2})(?=\s*(?:yo|y\.?o\.?|years?|yr|\b))", t))


def acceptable(name: str, candidate: str) -> bool:
    want = [w for w in words(name) if w not in STOP and not w.isdigit()]
    have = set(words(candidate))
    if not want or not all(w in have or any(h.startswith(w) for h in have) for w in want):
        return False
    if any(v in have and v not in words(name) for v in VARIANTS):
        return False
    mine, theirs = ages(name), ages(candidate)
    return mine <= theirs | set(words(candidate)) and not (theirs - mine)


def from_off(name: str):
    q = urllib.parse.urlencode({"q": name, "page_size": 10, "fields": "code,product_name,brands,image_front_url,categories_tags"})
    hits = json.loads(get(f"https://search.openfoodfacts.org/search?{q}"))["hits"]
    for h in hits:
        label = f"{' '.join(h.get('brands') or [])} {h.get('product_name') or ''}".replace("xx:", "")
        cats = " ".join(h.get("categories_tags") or [])
        if not re.search(r"alcoholic|spirit|whisk|gin|vodka|tequila|bourbon", cats):
            continue
        if h.get("image_front_url") and acceptable(name, label):
            url = h["image_front_url"]
            return {"url": url, "page": f"https://world.openfoodfacts.org/product/{h['code']}",
                    "title": label.strip(), "license": "CC BY-SA 3.0", "source": "Open Food Facts"}
    return None


def from_commons(name: str):
    q = urllib.parse.urlencode({"action": "query", "generator": "search", "gsrnamespace": 6, "gsrlimit": 10,
                                "gsrsearch": f"{name} bottle", "prop": "imageinfo", "iiprop": "url|extmetadata|mime",
                                "iiurlwidth": 500, "format": "json"})
    pages = json.loads(get(f"https://commons.wikimedia.org/w/api.php?{q}")).get("query", {}).get("pages", {})
    for p in sorted(pages.values(), key=lambda p: p.get("index", 99)):
        info = (p.get("imageinfo") or [{}])[0]
        title = p["title"].removeprefix("File:").rsplit(".", 1)[0].replace("_", " ")
        if info.get("mime") in ("image/jpeg", "image/png", "image/webp") and acceptable(name, title):
            lic = info.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "see source page")
            return {"url": info.get("thumburl") or info["url"], "page": info.get("descriptionurl"),
                    "title": title, "license": lic, "source": "Wikimedia Commons"}
    return None


def save(pid: str, data: bytes) -> Path:
    img = Image.open(io.BytesIO(data))
    img.load()
    if img.height < 200 or img.width < 50:
        raise ValueError(f"too small ({img.width}x{img.height})")
    img = img.convert("RGB")
    img.thumbnail((500, 500))
    out = IMAGES / f"{pid}.webp"
    img.save(out, "WEBP", quality=82)
    return out


def main() -> None:
    force = "--force" in sys.argv
    only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
    catalog = json.loads((ROOT / "data" / "catalog.json").read_text(encoding="utf-8"))
    credits = json.loads(CREDITS.read_text(encoding="utf-8")) if CREDITS.exists() else {}
    rejected = set(REJECTED.read_text(encoding="utf-8").split()) if REJECTED.exists() else set()
    IMAGES.mkdir(exist_ok=True)

    found, missing = 0, []
    for p in catalog["products"]:
        pid = p["id"]
        if (only and pid not in only) or pid in rejected:
            continue
        if not force and any((IMAGES / f"{pid}.{e}").exists() for e in ("webp", "png", "jpg", "jpeg")):
            continue
        hit = None
        for finder in (from_off, from_commons):
            try:
                hit = finder(p["name"])
            except Exception as e:  # network hiccup: try the next source
                print(f"  {finder.__name__} failed for {pid}: {e}")
            if hit:
                try:
                    save(pid, get(hit["url"]))
                    break
                except Exception as e:
                    print(f"  rejected image for {pid}: {e}")
                    hit = None
            time.sleep(1.5)
        if hit:
            credits[pid] = hit
            found += 1
            print(f"✔ {p['name']:<36} {hit['source']}: {hit['title'][:60]}")
        else:
            missing.append(p["name"])
            print(f"· {p['name']:<36} no confident match")

    CREDITS.write_text(json.dumps(credits, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"\n{found} new photos. {len(missing)} without a confident match (they keep the drawn bottle).")
    print("Next: python scripts/cutout_bottles.py <new ids>  (bottle-only cut-outs), then python scripts/import_pricelist.py")


if __name__ == "__main__":
    main()
