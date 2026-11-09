#!/usr/bin/env bash
# Rebuilds art/cut/ from the chosen generator outputs in art/raw/.
# usage: bash tools/build_sprites.sh
# Each line names a sprite and the raw image picked for it (art/raw/<raw>.png, made from the
# prompt art/prompts/<name>_editN.txt). The crab and the eel came out the same blues as the sea
# bands, so recolor.py moves them off it: crab to periwinkle, eel to violet (front and side alike).
set -euo pipefail
cd "$(dirname "$0")"
H=256
OUT=../art/cut
mkdir -p "$OUT"

flat() { python flatten.py "../art/raw/$2.png" "$OUT/$1.png" "$H"; }

flat enemy_grunt enemy_grunt_e1
flat enemy_darter enemy_darter_e1
flat enemy_brute enemy_brute_e1
flat enemy_glutton enemy_glutton_e1
for s in grunt darter brute glutton; do
  [ -f "../art/raw/enemy_${s}_side_e1.png" ] && flat "enemy_${s}_side" "enemy_${s}_side_e1"
done
flat fish_gold fish_gold_e1
flat fish_orange fish_orange_e1
flat fish_coral fish_coral_e1
flat chest chest_e1
flat junk_log junk_log_e1
flat junk_anchor junk_anchor_e1
flat junk_barrel junk_barrel_e1
flat mine mine_e1
flat crane crane_e2
flat hook hook_e1
flat captain captain_e1

for f in enemy_grunt enemy_grunt_side; do
  [ -f "$OUT/$f.png" ] && python recolor.py "$OUT/$f.png" "$OUT/$f.png" 0.5 0.7 0.62 1.2 0.7
done
for f in enemy_darter enemy_darter_side; do
  [ -f "$OUT/$f.png" ] && python recolor.py "$OUT/$f.png" "$OUT/$f.png" 0.5 0.7 0.78 1.7 0.8
done
echo "built $(ls "$OUT" | wc -l) sprites in art/cut"
cd ..
python tools/export_web.py
python tools/to_webp.py
