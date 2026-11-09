"""Shift one hue band of a cut-out sprite, leaving the outline, the red eyes and the rest alone.
usage: python recolor.py <in.png> <out.png> <hue lo> <hue hi> <new hue> [value x] [saturation x]
Hues are 0..1 (0.5 cyan, 0.6 blue, 0.75 violet). Pixels in [lo, hi] that are coloured enough
(saturation > 0.15, value > 0.12) get the new hue and their value and saturation scaled; the
shading steps keep their relative lightness. Deterministic, so a front and its side view recolour
the same way, which a second generator edit would not."""
import sys

import numpy as np
from PIL import Image


def recolor(im, lo, hi, hue, vx=1.0, sx=1.0):
    rgba = np.asarray(im.convert("RGBA")).astype(np.float32) / 255
    hsv = np.asarray(im.convert("RGB").convert("HSV")).astype(np.float32) / 255
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    sel = (h >= lo) & (h <= hi) & (s > 0.15) & (v > 0.12)
    h = np.where(sel, hue, h)
    s = np.where(sel, np.clip(s * sx, 0, 1), s)
    v = np.where(sel, np.clip(v * vx, 0, 1), v)
    out = Image.fromarray((np.stack([h, s, v], -1) * 255).round().astype(np.uint8), "HSV").convert("RGBA")
    arr = np.asarray(out).copy()
    arr[..., 3] = (rgba[..., 3] * 255).round().astype(np.uint8)
    return Image.fromarray(arr, "RGBA"), sel.mean()


if __name__ == "__main__":
    a = sys.argv[1:]
    src, dst, lo, hi, hue = a[0], a[1], float(a[2]), float(a[3]), float(a[4])
    vx = float(a[5]) if len(a) > 5 else 1.0
    sx = float(a[6]) if len(a) > 6 else 1.0
    im, share = recolor(Image.open(src), lo, hi, hue, vx, sx)
    im.save(dst, optimize=True)
    print(f"{dst}: {share * 100:.0f}% of pixels recoloured")
