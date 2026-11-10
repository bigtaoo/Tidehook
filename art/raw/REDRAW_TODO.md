# Redraw: done (2026-11-10)

All 25 sprites are cut paper, built from art/raw/<name>_<pick>.png into art/cut, art/web and
public/art by `bash tools/build_sprites.sh`. The six new monster sprites (hermit, ray, kraken,
front and side) replaced the tinted stand-ins in src/view/scene/look.ts.

What each hand fix did is noted next to its PICK line in tools/build_sprites.sh; the techniques
(prompt wording for flat paper, recolour, eye fill, hole clearing) are in
docs/00-art-direction.md section 9.

To add a sprite later:

1. Write art/prompts/<name>_paper_edit1.txt (edit the crab anchor; copy an existing prompt's tail).
2. `MISTRAL_KEY=H bash tools/edit_image.sh art/raw/mix/crab.png art/raw/<name>_p1.png art/prompts/<name>_paper_edit1.txt`
3. Add the name to the list in tools/build_sprites.sh (and a PICK line if a later attempt wins), build.
4. A closed loop with page inside needs a HOLES entry in tools/paper.py.
5. Check it on all three sea bands in the browser pane, then `npm run check`.
