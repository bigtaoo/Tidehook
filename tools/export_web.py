"""Shrink the finished cut-outs (art/cut) to the size the game draws them at its sharpest and
write them to art/web, the sources tools/to_webp.py turns into public/art.
usage: python tools/export_web.py
A monster or a catch is at most ~140 design units across (a brute, r 19, on a 1080-wide portrait
lane at 2.25 units per world unit), ~50 css px on a phone, so 192 px on the long side is sharp at a
device pixel ratio of 3. The crane and the captain are drawn bigger.
Also writes src/view/artFit.json: each sprite's size and the radius of a circle with its opaque
area, in its own pixels, so the view sizes a sprite by area (docs/00-art-direction.md section 6)."""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).parent.parent
SRC, OUT = ROOT / "art/cut", ROOT / "art/web"
LONG = {"crane": 320, "captain": 480}
OUT.mkdir(exist_ok=True)
fit = {}
for f in sorted(SRC.glob("*.png")):
    im = Image.open(f).convert("RGBA")
    side = LONG.get(f.stem, 192)
    k = side / max(im.size)
    if k < 1:
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(OUT / f.name, optimize=True)
    opaque = int((np.asarray(im.getchannel("A")) > 128).sum())
    fit[f.stem] = {"w": im.width, "h": im.height, "r": round(math.sqrt(opaque / math.pi), 1)}
    print(f"{f.stem}: {im.width}x{im.height}")
(ROOT / "src/view/artFit.json").write_text(json.dumps(fit, indent=1) + chr(10))
