"""Turn bottle photos into bottle-only cut-outs (transparent background), in place.

Usage:  pip install "rembg[cpu]"      (one-off, ~170 MB model downloaded on first run)
        python scripts/cutout_bottles.py id1 id2 ...      # or no ids = every photo in images/

If a photo also shows a box, a glass or other bottles, add a crop for it to images/CROPS.json first:
    "bowmore-12": [0.56, 0, 0.8, 1]      (left, top, right, bottom as fractions of the photo)
Then check the result on the shelf; if it still isn't a clean bottle, delete it and list the id in
images/REJECTED.txt. Finally run scripts/import_pricelist.py.
"""
import json
import sys
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

IMAGES = Path(__file__).resolve().parent.parent / "images"
crops = json.loads((IMAGES / "CROPS.json").read_text()) if (IMAGES / "CROPS.json").exists() else {}
ids = sys.argv[1:] or [f.stem for f in IMAGES.glob("*.webp")]
session = new_session("isnet-general-use")

for pid in ids:
    path = next((IMAGES / f"{pid}.{e}" for e in ("webp", "png", "jpg", "jpeg") if (IMAGES / f"{pid}.{e}").exists()), None)
    if not path:
        print(f"· {pid}: no photo")
        continue
    im = Image.open(path).convert("RGB")
    if pid in crops:
        l, t, r, b = crops[pid]
        im = im.crop((int(l * im.width), int(t * im.height), int(r * im.width), int(b * im.height)))
    cut = remove(im, session=session, post_process_mask=True)
    alpha = cut.getchannel("A").point(lambda v: 0 if v < 40 else v)  # drop faint halo
    cut.putalpha(alpha)
    if alpha.getbbox():
        cut = cut.crop(alpha.getbbox())
    cut.thumbnail((500, 500))
    out = IMAGES / f"{pid}.webp"
    cut.save(out, "WEBP", quality=85)
    if path != out:
        path.unlink()
    print(f"✔ {pid} {cut.size}")
