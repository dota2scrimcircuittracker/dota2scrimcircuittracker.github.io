# Link-preview images (og:image), one per league: public/img/og/<key>.png, 1200x630.
# The brand mark in the league's colours, the league name in the site's display font.
# Committed; rerun only when a league, a colour or the look changes.
# Needs Python with Pillow, and the site fonts in .cache/fonts (gitignored). Get them from
# Google Fonts (the same files the site loads):
#   curl -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Big+Shoulders+Stencil+Display:wght@900&family=Martian+Mono:wght@400;600&family=Epilogue:wght@500"
# and save the .ttf URLs it lists as display-900.ttf, mono-400.ttf, mono-600.ttf, epilogue-500.ttf.
# Usage: python scripts/gen-og-images.py
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / ".cache" / "fonts"
OUT = ROOT / "public" / "img" / "og"
W, H = 1200, 630
INK, BONE, DUST, DIM = "#0c0b0a", "#efe7da", "#9b9184", "#5d564e"
JADE, EMBER, GOLD = "#5fd39b", "#ff5a36", "#e8b64c"

# key: (kicker, title, accent, mark colours) — colours as style.css's .brand-mark per league.
LEAGUES = {
    "site": ("Dota 2 · scrims + AD2L S48", "Stat Tracker", GOLD, (JADE, EMBER)),
    "scrim": ("Our scrims", "Scrim League", JADE, (JADE, EMBER)),
    "all": ("AD2L · Season 48", "All Divisions", BONE, (JADE, EMBER)),
    "ad2l": ("AD2L · Season 48", "Champion", GOLD, (GOLD, "#b98a2e")),
    "heroic": ("AD2L · Season 48", "Heroic/Aegis", "#a58bff", ("#a58bff", "#6a4fd6")),
    "conqueror": ("AD2L · Season 48", "Conqueror", "#5aa9e6", ("#5aa9e6", "#2f78b5")),
    "warrior": ("AD2L · Season 48", "Warrior", "#ff9a3c", ("#ff9a3c", "#c4671c")),
    "challenger": ("AD2L · Season 48", "Challenger", "#9bd34a", ("#9bd34a", "#5e8f22")),
    "voyager": ("AD2L · Season 48", "Voyager", "#ef6b73", ("#ef6b73", "#a83a44")),
    "explorer": ("AD2L · Season 48", "Explorer", "#3cc6c6", ("#3cc6c6", "#1f8585")),
}
SUB = ("Standings, weekly recaps, players,", "heroes and predictions.")


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def spaced(draw, xy, text, f, fill, tracking):
    # Letter-spaced caps, like the site's mono labels.
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + tracking
    return x


def mark(img, cx, cy, side, a, b):
    # The diamond: a square rotated 45°, split on its diagonal; the second half nudged out.
    s = 4  # supersample for clean edges
    layer = Image.new("RGBA", (side * 2 * s, side * 2 * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    o, n, off = side // 2 * s, side * s, side * s // 9
    d.polygon([(o, o), (o + n, o), (o, o + n)], fill=a)
    d.polygon([(o + n + off, o + off), (o + n + off, o + n + off), (o + off, o + n + off)], fill=b)
    layer = layer.rotate(-45, resample=Image.BICUBIC).resize((side * 2, side * 2), Image.LANCZOS)
    img.alpha_composite(layer, (cx - side, cy - side))


def card(key):
    kicker, title, accent, (a, b) = LEAGUES[key]
    img = Image.new("RGBA", (W, H), INK)
    mark(img, 1000, 300, 190, a, b)

    d = ImageDraw.Draw(img)
    x = 84
    d.rectangle([x, 150, x + 44, 152], fill=accent)
    spaced(d, (x + 62, 138), kicker.upper(), font("mono-600.ttf", 24), accent, 5)
    size = 150
    while size > 70 and d.textlength(title.upper(), font=font("display-900.ttf", size)) > 640:
        size -= 6
    d.text((x - 4, 190), title.upper(), font=font("display-900.ttf", size), fill=BONE)
    for i, line in enumerate(SUB):
        d.text((x, 380 + i * 38), line, font=font("epilogue-500.ttf", 27), fill=DUST)
    d.rectangle([x, 500, W - 84, 501], fill=DIM)
    spaced(d, (x, 530), "AD2L STAT TRACKER", font("mono-600.ttf", 20), BONE, 4)
    url = "dota2scrimcircuittracker.github.io"
    uf = font("mono-400.ttf", 18)
    d.text((W - 84 - d.textlength(url, font=uf), 532), url, font=uf, fill=DUST)
    OUT.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(OUT / f"{key}.png", optimize=True)


for k in LEAGUES:
    card(k)
    print(f"img/og/{k}.png")
