"""Builds the lane backdrop public/art/sea.webp from the chart painting art/raw/mix/bg2.png.

The painting has the pier on the left and the sea deepening to the right. The output is the lane
in landscape (dock on the left), 1600 x 960 for an 800 x 480 lane: the pier strip is scaled to the
dock's share of the length (B.dock.edge 112 / 800), the sea fills the rest. The view rotates it in
portrait. Usage: python tools/build_sea.py [src] [out]
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "art/raw/mix/bg2.png"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "public/art/sea.webp"

W, H = 1600, 960
DOCK = 112 / 800
# where the pier ends in the painting (the posts' outer side), and the vignette trimmed off
PIER_X = 150
TRIM_TOP, TRIM_BOTTOM, TRIM_RIGHT = 14, 14, 40

im = Image.open(SRC).convert("RGB")
sw, sh = im.size
pier = im.crop((0, TRIM_TOP, PIER_X, sh - TRIM_BOTTOM))
sea = im.crop((PIER_X, TRIM_TOP, sw - TRIM_RIGHT, sh - TRIM_BOTTOM))
dock_w = round(W * DOCK)
out = Image.new("RGB", (W, H))
out.paste(pier.resize((dock_w, H), Image.LANCZOS), (0, 0))
out.paste(sea.resize((W - dock_w, H), Image.LANCZOS), (dock_w, 0))
OUT.parent.mkdir(parents=True, exist_ok=True)
out.save(OUT, "WEBP", quality=82, method=6)
print(f"{OUT} {OUT.stat().st_size // 1024} KB")
