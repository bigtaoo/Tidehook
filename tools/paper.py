"""Cut a cut-paper figure out of its white background, keeping its paper texture.
usage: python paper.py <in> <out.png> <height>
The house style is layered cut paper (docs/00-art-direction.md section 8): no outline to draw and
no palette to flatten, so unlike flatten.py this only cuts. The paper's own pale edge highlight
would read as a white rim on the dark sea, so the cut eats one pixel into the figure before the
feather."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter
from scipy import ndimage

from cutout import background_mask

# what counts as background: a slightly loose limit also takes the faint grey shadow most images have
LOOSE = dict(min_light=200, max_chroma=24)
# white or cream paper meeting the white page with no edge (the captain's beard, the shark's belly):
# only the page's own near-pure white is background
STRICT = dict(min_light=249, max_chroma=10)
TUNE = {"captain": STRICT, "enemy_glutton": STRICT}
# figures with a closed loop whose inside is page, cleared as well (the coiled eel, the winch's
# spoked pulley): the share of the image an enclosed light patch must cover to count, and how
# grey it must be (None: any light colour, so the eel's pale inner rim goes too; the winch's cream
# rope strips must stay)
HOLES = {"enemy_darter": (0.002, None), "enemy_darter_side": (0.002, 24), "winch": (0.0005, 24)}


def clear_holes(rgb, bg, limits, hole_min, hole_chroma):
    """Adds to the background mask the big page-coloured patches the figure encloses."""
    cand_bg = background_mask(rgb, **limits)
    cand = np.asarray(rgb.convert("L")) >= limits["min_light"]
    if hole_chroma is not None:
        cand &= np.ptp(np.asarray(rgb).astype(int), axis=-1) <= hole_chroma
    inner = cand & (np.asarray(cand_bg) == 0)
    lab, n = ndimage.label(inner)
    sizes = ndimage.sum(inner, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= hole_min * inner.size])
    return Image.fromarray(np.maximum(np.asarray(bg), keep.astype(np.uint8) * 255))


def paper(src, height, name=""):
    im = Image.open(src).convert("RGBA")
    limits = TUNE.get(name, LOOSE)
    rgb = im.convert("RGB")
    bg = background_mask(rgb, **limits)
    if name in HOLES:
        bg = clear_holes(rgb, bg, limits, *HOLES[name])
    fg = ImageChops.invert(bg)
    # drop specks, then pull the edge in a pixel
    fg = fg.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    box = fg.getbbox()
    im, fg = im.crop(box), fg.crop(box)
    im.putalpha(fg.filter(ImageFilter.GaussianBlur(0.8)))
    k = height / im.height
    return im.resize((round(im.width * k), height), Image.LANCZOS)


if __name__ == "__main__":
    paper(sys.argv[1], int(sys.argv[3]), Path(sys.argv[2]).stem).save(sys.argv[2], optimize=True)
