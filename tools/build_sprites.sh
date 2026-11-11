#!/usr/bin/env bash
# Rebuilds art/cut/ from the chosen generator outputs in art/raw/, then art/web and public/art.
# usage: bash tools/build_sprites.sh
# Each sprite is art/raw/<name>_<pick>.png, made from art/prompts/<name>_paper_editN.txt by editing
# art/raw/mix/crab.png, the cut-paper anchor (docs/00-art-direction.md section 8). paper.py only
# cuts it out: the paper's texture and layers are the style, so nothing is outlined or flattened.
# The old outlined set (the *_e1 raws, flatten.py) is kept for reference.
set -euo pipefail
cd "$(dirname "$0")"
H=384
OUT=../art/cut
mkdir -p "$OUT"

pick() { echo "${PICK[$1]:-p1}"; }
declare -A PICK=()
# PICK[name]=p2 when a later attempt replaced the first
PICK[enemy_grunt_side]=p2   # p1 with its red eyestalk recoloured blue (monsters stay cold)
PICK[enemy_darter_side]=p2  # p1 came out a barracuda
PICK[junk_barrel]=p2        # p1 was photographic, not paper
PICK[enemy_glutton]=p2      # p1 with its frown painted out (dot eyes only)
PICK[enemy_hermit]=p2       # p1: red claws recoloured teal, shell cooled to blue-grey, dot eyes added at the rim
PICK[enemy_hermit_side]=p2  # p1: eye whites filled (dot eyes only), shell cooled to blue-grey
PICK[enemy_kraken]=p2       # p1 with its pink suckers recoloured lavender
PICK[enemy_kraken_side]=p2  # p1 with its smile painted out, eye whites filled, suckers lavender
PICK[enemy_ray_side]=p2     # p1 with a floating eye stalk painted out
PICK[chest]=p2              # p1 with its lemon-yellow bands toned to brass
PICK[junk_anchor]=p2        # p1: photographic rust flattened to iron and lightened, stray dot eyes removed, ring hole filled
PICK[mine]=p2               # p1 was a glossy 3D render, not paper
PICK[winch]=p3              # p1 was photographic wood and rope, p2 too bare
PICK[enemy_puffer]=p2       # p1 showed its face (lips and belly), not its back
PICK[enemy_puffer_side]=p2  # p1 with its eye white filled (dot eyes only)
PICK[enemy_moray]=p3        # p1 curled into a ring; p2 was a stiff fish, p3 a curved eel
PICK[enemy_moray_side]=p4   # p1 and p2 were fish; p3 lost the tail fan, p4 the throat fin and belly frill

for n in enemy_grunt enemy_darter enemy_brute enemy_glutton \
         enemy_grunt_side enemy_darter_side enemy_brute_side enemy_glutton_side \
         fish_gold fish_orange fish_coral chest junk_log junk_anchor junk_barrel \
         mine winch hook captain \
         enemy_hermit enemy_ray enemy_kraken enemy_hermit_side enemy_ray_side enemy_kraken_side \
         enemy_puffer enemy_moray enemy_puffer_side enemy_moray_side; do
  src="../art/raw/${n}_$(pick "$n").png"
  # until every paper raw is made, a missing one keeps the old cut-out in art/cut
  if [ -f "$src" ]; then python paper.py "$src" "$OUT/$n.png" "$H"; else echo "kept old $n (or none yet)"; fi
done
echo "built $(ls "$OUT" | wc -l) sprites in art/cut"
cd ..
python tools/export_web.py
python tools/to_webp.py
