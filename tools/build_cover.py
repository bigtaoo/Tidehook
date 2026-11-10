"""Builds the store covers from the key art (docs/05-store.md section 1).

usage: python tools/build_cover.py [art/raw/cover/cover_e2.png]

Crops the key art to each of Playgama's three cover slots (square 800x800, portrait 1080x1920,
landscape 1920x1080), keeping the captain and the hooked shark in frame, and writes the title in
the open sea at the top: cream letters in the game's own bold system face with the UI's dark
walnut outline (the Logo face, Luckiest Guy, is not on this machine). The generator draws 4:3, so
the portrait slot extends the sky with the art's own top rows, mirrored, before cropping.

Writes art/cover/cover_{square,portrait,landscape}.png.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "art/cover"
FONT = Path("C:/Windows/Fonts/seguibl.ttf")
TITLE = "Tidehook"
CREAM = (255, 241, 214)
LINE = (36, 20, 10)

# slot: (size, focus x as a share of the art's width, title height as a share of the slot's,
#        title centre x and widest title, as shares of the slot's width)
# The landscape crop keeps the shark high up, so its title sits left of it, over the open sea.
SLOTS = {
    "square": ((800, 800), 0.42, 0.17, 0.5, 0.86),
    "portrait": ((1080, 1920), 0.40, 0.09, 0.5, 0.86),
    "landscape": ((1920, 1080), 0.5, 0.16, 0.34, 0.38),
}
# Only the art's rows above the shark's splash are mirrored into a taller slot's extra sky.
SKY_ROWS = 0.2


def tall(art: Image.Image, ratio: float) -> Image.Image:
    """The art with more sea on top until it is at least `ratio` (height / width) tall."""
    w, h = art.size
    need = int(w * ratio) - h
    if need <= 0:
        return art
    band = art.crop((0, 0, w, min(int(h * SKY_ROWS), need)))
    sky = Image.new("RGB", (w, need))
    y = need
    flip = False
    while y > 0:
        piece = ImageOps.flip(band) if not flip else band
        y -= piece.height
        sky.paste(piece, (0, y))
        flip = not flip
    out = Image.new("RGB", (w, h + need))
    out.paste(sky, (0, 0))
    out.paste(art, (0, need))
    # soften the seams of the mirrored sea
    top = out.crop((0, 0, w, need + 24)).filter(ImageFilter.GaussianBlur(3))
    out.paste(top, (0, 0))
    return out


def crop(art: Image.Image, size: tuple[int, int], focus: float) -> Image.Image:
    tw, th = size
    art = tall(art, th / tw)
    w, h = art.size
    scale = max(tw / w, th / h)
    big = art.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    bw, bh = big.size
    x = min(max(0, round(bw * focus - tw / 2)), bw - tw)
    return big.crop((x, bh - th, x + tw, bh))


def title(img: Image.Image, share: float, cx: float, widest: float) -> None:
    w, h = img.size
    px = round(h * share)
    font = ImageFont.truetype(str(FONT), px)
    while font.getlength(TITLE) > w * widest:
        px -= 4
        font = ImageFont.truetype(str(FONT), px)
    stroke = max(4, px // 11)
    x = w * cx - font.getlength(TITLE) / 2
    y = h * 0.05
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((x + stroke, y + stroke * 1.4), TITLE, font=font, fill=LINE + (150,), stroke_width=stroke, stroke_fill=LINE + (150,))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(stroke * 0.8)))
    ImageDraw.Draw(img).text((x, y), TITLE, font=font, fill=CREAM, stroke_width=stroke, stroke_fill=LINE)


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "art/raw/cover/cover_e2.png"
    art = Image.open(src).convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    for slot, (size, focus, share, cx, widest) in SLOTS.items():
        img = crop(art, size, focus).convert("RGBA")
        title(img, share, cx, widest)
        dst = OUT / f"cover_{slot}.png"
        img.convert("RGB").save(dst, optimize=True)
        print(dst.relative_to(ROOT), img.size, dst.stat().st_size // 1024, "kB")


if __name__ == "__main__":
    main()
