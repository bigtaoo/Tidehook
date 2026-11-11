"""Builds the game's sounds from CC0 sources (docs/00-art-direction.md section 7).

usage: python tools/build_audio.py

Each cue below names its source files. The first run copies them from the local packs (SRC_ROOTS)
into art/audio/sources/, so later runs need only this repo. Every file is trimmed of leading and
trailing silence, capped in length, made mono and peak-normalised to the cue's level, then encoded
as MP3 (every browser decodes it) into public/audio/<cue>_<n>.mp3. The music, one track per sea
and one for the harbour (public/audio/music_<track>.mp3), is loudness-normalised and kept in stereo;
a track that is only another played faster (SHARED) is not built at all, the game setting the rate.

Writes:
  public/audio/*.mp3         what the game loads
  src/audio/cues.json        cue -> number of variants (the game picks one at random)
  art/audio/credits.json     where every file came from and under what licence
  art/audio/licenses/        the packs' licence texts
"""

import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "art/audio/sources"
OUT = ROOT / "public/audio"
LICENSES = ROOT / "art/audio/licenses"

KENNEY = Path("D:/jump/ref/audio-src")
FREEPD = Path("D:/funny/art/audio")
SRC_ROOTS = {
    "impact-sounds": KENNEY / "kenney_impact-sounds/Audio",
    "interface-sounds": KENNEY / "kenney_interface-sounds/Audio",
    "sci-fi-sounds": KENNEY / "kenney_sci-fi-sounds/Audio",
    "music-jingles": KENNEY / "kenney_music-jingles/Audio",
    "freepd": FREEPD / "sources/freepd",
}
PACKS = {
    "impact-sounds": ("Impact Sounds 1.0", "Kenney", "https://kenney.nl/assets/impact-sounds", KENNEY / "kenney_impact-sounds/License.txt"),
    "interface-sounds": ("Interface Sounds 1.0", "Kenney", "https://kenney.nl/assets/interface-sounds", KENNEY / "kenney_interface-sounds/License.txt"),
    "sci-fi-sounds": ("Sci-fi Sounds 1.0", "Kenney", "https://kenney.nl/assets/sci-fi-sounds", KENNEY / "kenney_sci-fi-sounds/License.txt"),
    "music-jingles": ("Music Jingles", "Kenney", "https://kenney.nl/assets/music-jingles", KENNEY / "kenney_music-jingles/License.txt"),
    "freepd": ("FreePD (archive.org item 'freepd')", "Bryan Teoh", "https://archive.org/details/freepd", FREEPD / "licenses/freepd-LICENSE.txt"),
}

# cue: (peak dBFS, longest ms, [pack/file, ...], why)
CUES = {
    "cast": (-9, 320, ["interface-sounds/scroll_001.ogg", "interface-sounds/scroll_003.ogg"], "the winch's ratchet paying the rope out"),
    "reel": (-14, 60, ["interface-sounds/tick_001.ogg", "interface-sounds/tick_002.ogg"], "one click of the winch reeling in; repeated slower and lower under weight"),
    "throw": (-8, 200, ["impact-sounds/impactSoft_medium_000.ogg", "impact-sounds/impactSoft_medium_002.ogg"], "the junk leaving the crane"),
    "grabFish": (-8, 300, ["interface-sounds/drop_002.ogg", "interface-sounds/drop_003.ogg", "interface-sounds/drop_004.ogg"], "a wet bloop as the hook takes a fish"),
    "grabJunk": (-8, 280, ["impact-sounds/impactWood_light_000.ogg", "impact-sounds/impactWood_light_002.ogg"], "the hook knocking on wood"),
    "grabMonster": (-6, 450, ["impact-sounds/impactPunch_medium_000.ogg", "impact-sounds/impactPunch_medium_001.ogg"], "the hook biting a monster"),
    "hit": (-6, 380, ["impact-sounds/impactPlank_medium_000.ogg", "impact-sounds/impactPlank_medium_002.ogg", "impact-sounds/impactPlank_medium_004.ogg"], "thrown junk landing on a monster"),
    "bounce": (-9, 260, ["impact-sounds/impactMetal_light_002.ogg", "impact-sounds/impactMetal_light_004.ogg"], "junk glancing off"),
    "kill": (-4, 550, ["impact-sounds/impactPunch_heavy_000.ogg", "impact-sounds/impactPunch_heavy_002.ogg"], "a monster beaten"),
    "blast": (-5, 800, ["sci-fi-sounds/explosionCrunch_000.ogg"], "a barrel bursting"),
    "mine": (-3, 1000, ["sci-fi-sounds/lowFrequency_explosion_001.ogg"], "the mine going off"),
    "coins": (-12, 160, ["interface-sounds/glass_002.ogg", "interface-sounds/glass_003.ogg", "interface-sounds/glass_005.ogg"], "coins in the till as the catch lands"),
    "spat": (-8, 200, ["interface-sounds/pluck_001.ogg", "interface-sounds/pluck_002.ogg"], "the glutton spitting out what it ate"),
    "eat": (-9, 500, ["sci-fi-sounds/slime_000.ogg"], "the glutton starting on a fish"),
    "eaten": (-8, 220, ["impact-sounds/impactSoft_heavy_001.ogg"], "the glutton's gulp"),
    "leak": (-4, 340, ["impact-sounds/impactWood_heavy_000.ogg", "impact-sounds/impactWood_heavy_003.ogg"], "a monster battering the dock"),
    "buy": (-9, 450, ["interface-sounds/confirmation_001.ogg"], "a purchase in the shop"),
    "deny": (-14, 200, ["interface-sounds/error_004.ogg"], "a shop button that cannot be paid for"),
    "waveStart": (-8, 700, ["impact-sounds/impactBell_heavy_003.ogg"], "the harbour bell: here they come"),
    "waveClear": (-7, 1500, ["music-jingles/Steel jingles/jingles_STEEL02.ogg"], "steel pan, rising (pitch contour x1.56)"),
    "over": (-7, 1400, ["music-jingles/Steel jingles/jingles_STEEL12.ogg"], "steel pan, falling (pitch contour x0.39)"),
}
# music_<track>: (pack/file, title, author, upstream path, start s, length s or None, rate, why). One per sea
# and one for the harbour between games (docs/00-art-direction.md section 7); src/audio/cues.ts MUSIC.
# rate > 1 plays the master faster and higher (asetrate), a busier rendition of the same tune.
MUSIC = {
    "harbour": ("freepd/hopeful.mp3", "Hopeful", "Rafael Krux", "comedy/Hopeful.mp3", 0, None, 1.0,
                "the harbour between games: warm and unhurried, a breather before the next voyage"),
    "bay": ("freepd/busybody.mp3", "Busybody", "Bryan Teoh", "comedy/Busybody.mp3", 0, None, 1.0,
            "the home bay: happily frantic, the game's own tune since the first build"),
    "fog": ("freepd/managing-mischief.mp3", "Managing Mischief", "Bryan Teoh", "comedy/Managing Mischief.mp3", 52.5, 74.0, 1.0,
            "the Fog Bank: frisky yet cautious, creeping, for a sea where you cannot see what is coming"),
    "storm": ("freepd/busybody.mp3", "Busybody (x1.12)", "Bryan Teoh", "comedy/Busybody.mp3", 0, None, 1.12,
              "the Storm Reach: the bay's tune played 12% faster and two semitones up, the same harbour in a gale"),
}
MUSIC_FADE = 0.35
# A track that is another one played faster: the game sets the rate on the <audio> element
# (src/audio/cues.ts SHARED, RATE), so only the master's own file is built. A second encode of
# the same tune cost 600 kB of the bundle and a second download for nothing.
SHARED = {"storm": "bay"}


def run(*args: str) -> bytes:
    return subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True, capture_output=True).stdout


def source(rel: str) -> Path:
    """The local copy of pack/file, fetched from the pack folder the first time."""
    dst = SOURCES / rel
    if not dst.exists():
        pack, name = rel.split("/", 1)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SRC_ROOTS[pack] / name, dst)
    return dst


def peak_db(path: Path) -> float:
    out = subprocess.run(["ffmpeg", "-v", "info", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    for line in out.splitlines():
        if "max_volume" in line:
            return float(line.split("max_volume:")[1].split("dB")[0])
    raise RuntimeError(f"no peak for {path}")


def duration_ms(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout
    return round(float(out) * 1000, 1)


def build_sfx(src: Path, dst: Path, peak: float, cap_ms: int) -> dict:
    trim = "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse"
    fade = max(20, cap_ms // 5)
    tmp = dst.with_suffix(".wav")
    run("-i", str(src), "-ac", "1", "-ar", "44100", "-af", f"{trim},atrim=0:{cap_ms / 1000},afade=t=out:st={max(0, cap_ms - fade) / 1000}:d={fade / 1000}", str(tmp))
    gain = peak - peak_db(tmp)
    run("-i", str(tmp), "-af", f"volume={gain:.2f}dB", "-c:a", "libmp3lame", "-q:a", "5", str(dst))
    tmp.unlink()
    return {"gain_db": round(gain, 2), "duration_ms": duration_ms(dst), "bytes": dst.stat().st_size}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    LICENSES.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.mp3"):
        old.unlink()
    credits = {
        "note": "Licence and provenance of every file in public/audio/. Written by tools/build_audio.py; edit that, not this.",
        "license": "CC0-1.0 for every source; attribution is not required. The authors are listed anyway.",
        "packs": {},
        "cues": [],
        "music": [],
    }
    used = set()
    counts = {}
    for cue, (peak, cap, files, why) in CUES.items():
        entry = {"cue": cue, "why": why, "files": []}
        for i, rel in enumerate(files):
            dst = OUT / f"{cue}_{i}.mp3"
            info = build_sfx(source(rel), dst, peak, cap)
            entry["files"].append({"file": f"audio/{dst.name}", "source": rel, **info})
            used.add(rel.split("/")[0])
        counts[cue] = len(files)
        credits["cues"].append(entry)
    for track, (rel, title, author, upstream, at, length, rate, why) in MUSIC.items():
        shared = SHARED.get(track)
        dst = OUT / f"music_{shared or track}.mp3"
        if not shared:
            # it loops: silence at either end would be a gap at the seam
            tail = "areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse"
            head = "silenceremove=start_periods=1:start_threshold=-50dB"
            chain = [head, tail]
            if length:
                # a region of a long master, faded at both ends so the seam is a breath, not a click
                chain = [f"atrim={at}:{at + length}", "asetpts=PTS-STARTPTS", f"afade=t=in:d={MUSIC_FADE}",
                         f"afade=t=out:st={length - MUSIC_FADE}:d={MUSIC_FADE}"]
            chain.append("loudnorm=I=-20:TP=-3:LRA=11")
            run("-i", str(source(rel)), "-af", ",".join(chain), "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "64k", str(dst))
        credits["music"].append({"track": track, "file": f"audio/{dst.name}", "title": title, "author": author, "source": rel,
                                 "upstream": f"archive.org/details/freepd {upstream}", "why": why, "start_s": at, "length_s": length,
                                 "rate": rate, "duration_ms": round(duration_ms(dst) / rate, 1), "bytes": dst.stat().st_size})
        used.add(rel.split("/")[0])
    for pack in sorted(used):
        name, author, url, lic = PACKS[pack]
        shutil.copy2(lic, LICENSES / f"{pack}-LICENSE.txt")
        credits["packs"][pack] = {"name": name, "author": author, "url": url, "license": "CC0-1.0", "license_text": f"licenses/{pack}-LICENSE.txt"}
    (ROOT / "art/audio/credits.json").write_text(json.dumps(credits, indent=1) + chr(10), encoding="utf-8")
    (ROOT / "src/audio/cues.json").write_text(json.dumps(counts, indent=1) + chr(10), encoding="utf-8")
    total = sum(f.stat().st_size for f in OUT.glob("*.mp3"))
    print(f"built {len(list(OUT.glob('*.mp3')))} files, {total // 1024} kB, in public/audio")


if __name__ == "__main__":
    main()
