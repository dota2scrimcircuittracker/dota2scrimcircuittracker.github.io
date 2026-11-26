# AD2L Wrapped link-preview images, one per league, team and player. Jobs with tile: true (all
# that wrapped-pages.js writes) are drawn like the Wrapped hub's tiles (draw_tile); draw is the
# older player card. Older player card: 1200x630 JPEGs. The player's name, record,
# MVPs, KDA, signature stat, awards and top three heroes over their top hero's full render, in
# the league's colours and the site's fonts. scripts/deploy/wrapped-pages.js writes the job list
# and runs this at deploy time; the images aren't committed.
# Needs Python with Pillow. The fonts are .cache/fonts (as gen-og-images.py); missing ones are
# fetched from Google Fonts, the files the site loads. Hero art comes from Valve's CDN, cached in
# .cache/wrapped-art.
# Usage: python scripts/gen/wrapped-og.py <jobs.json>
import io
import json
import re
import sys
import urllib.request
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / ".cache" / "fonts"
ART = ROOT / ".cache" / "wrapped-art"
CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2"
W, H = 1200, 630
INK, BONE, DUST, GOLD = (12, 11, 10), (239, 231, 218), (190, 180, 166), (232, 182, 76)
UA = "Mozilla/4.0"  # Google Fonts sends .ttf files to old browsers

FONT_FILES = {
    ("Big Shoulders Stencil Display", "900"): "display-900.ttf",
    ("Martian Mono", "400"): "mono-400.ttf",
    ("Martian Mono", "600"): "mono-600.ttf",
    ("Epilogue", "500"): "epilogue-500.ttf",
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def fetch_fonts():
    if all((FONTS / f).exists() for f in FONT_FILES.values()):
        return
    FONTS.mkdir(parents=True, exist_ok=True)
    css = get("https://fonts.googleapis.com/css2?family=Big+Shoulders+Stencil+Display:wght@900"
              "&family=Martian+Mono:wght@400;600&family=Epilogue:wght@500").decode()
    for block in re.findall(r"@font-face\s*{([^}]*)}", css):
        fam = re.search(r"font-family:\s*'([^']+)'", block)
        wt = re.search(r"font-weight:\s*(\d+)", block)
        src = re.search(r"url\((\S+?\.ttf)\)", block)
        name = fam and wt and FONT_FILES.get((fam.group(1), wt.group(1)))
        if name and src and not (FONTS / name).exists():
            (FONTS / name).write_bytes(get(src.group(1)))
    missing = [f for f in FONT_FILES.values() if not (FONTS / f).exists()]
    if missing:
        raise SystemExit(f"fonts missing after download: {missing}")


_fonts = {}


def font(name, size):
    k = (name, size)
    if k not in _fonts:
        _fonts[k] = ImageFont.truetype(str(FONTS / name), size)
    return _fonts[k]


def art(slug, kind):
    # kind: "render" (the full transparent render) or "icon" (the 256x144 landscape). None if
    # Valve's CDN doesn't have it.
    if not slug:
        return None
    ART.mkdir(parents=True, exist_ok=True)
    path = ART / f"{slug}-{kind}.png"
    if not path.exists():
        url = f"{CDN}/videos/dota_react/heroes/renders/{slug}.png" if kind == "render" else f"{CDN}/images/dota_react/heroes/{slug}.png"
        try:
            path.write_bytes(get(url))
        except Exception as e:  # no art: the card goes without it
            print(f"  no {kind} for {slug}: {e}", file=sys.stderr)
            return None
    try:
        return Image.open(path).convert("RGBA")
    except Exception:
        return None


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def spaced(d, xy, text, f, fill, tracking):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + tracking
    return x


def spaced_len(d, text, f, tracking):
    return sum(d.textlength(ch, font=f) + tracking for ch in text) - tracking


def fit(d, text, name, size, width, floor):
    while size > floor and d.textlength(text, font=font(name, size)) > width:
        size -= 4
    return font(name, size)


def ellipsize(d, text, f, width):
    if d.textlength(text, font=f) <= width:
        return text
    while text and d.textlength(text + "…", font=f) > width:
        text = text[:-1]
    return text.rstrip() + "…"


def background(color, dark):
    # The league colour glowing from the top left into near black, Wrapped style.
    c, k = hexrgb(color), hexrgb(dark)
    base = Image.new("RGB", (W, H), INK)
    glow = Image.new("L", (W, H), 0)
    g = ImageDraw.Draw(glow)
    g.ellipse([-520, -560, 760, 560], fill=200)
    g.ellipse([700, 260, 1500, 1000], fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    tint = Image.new("RGB", (W, H), c)
    img = Image.composite(tint, base, glow)
    low = Image.new("L", (W, H), 0)
    ImageDraw.Draw(low).rectangle([0, H // 2, W, H], fill=120)
    low = low.filter(ImageFilter.GaussianBlur(140))
    img = Image.composite(Image.new("RGB", (W, H), tuple(v // 3 for v in k)), img, low)
    return img.convert("RGBA")


def cover(im, w, h, y_bias=0.3):
    # Scale to fill w x h, cropping the overflow (y_bias: how far down the crop sits, 0 = top).
    scale = max(w / im.width, h / im.height)
    im = im.resize((max(w, round(im.width * scale)), max(h, round(im.height * scale))), Image.LANCZOS)
    x0, y0 = (im.width - w) // 2, int((im.height - h) * y_bias)
    return im.crop((x0, y0, x0 + w, y0 + h))


def place_render(img, slug):
    # The hero's full render on the right, fading out to the left so the words stay clear.
    render = art(slug, "render")
    if not render:
        return
    box = render.getbbox()
    if box:
        render = render.crop(box)
    scale = 700 / render.height
    render = render.resize((max(1, int(render.width * scale)), 700), Image.LANCZOS)
    x0 = max(560, 930 - render.width // 2)
    fade = Image.new("L", render.size, 255)
    fd = ImageDraw.Draw(fade)
    for i in range(220):
        fd.line([(i, 0), (i, render.height)], fill=int(255 * i / 220))
    alpha = Image.composite(render.getchannel("A"), Image.new("L", render.size, 0), fade)
    render.putalpha(alpha)
    shadow = Image.new("RGBA", render.size, (0, 0, 0, 0))
    shadow.putalpha(alpha.point(lambda a: a * 0.6))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)), (x0 + 14, 10))
    img.alpha_composite(render, (x0, -20))


def draw_tile(job):
    # The Wrapped hub's tile (pages/wrapped.js renderHub), landscape: the hero's art as a soft
    # backdrop under the league's colour, its full render sharp on the right, NAME / WRAPPED in
    # the league's colour, a frame in that colour. Players and teams add their numbers.
    accent, dark = hexrgb(job["color"]), hexrgb(job["dark"])
    img = background(job["color"], job["dark"])
    src = job.get("art")
    if src and Path(src).exists():
        try:
            a = Image.open(src).convert("RGB")
            back = cover(a, W, H).filter(ImageFilter.GaussianBlur(max(3, int(1200 / a.width * 2))))
            back = Image.blend(back, Image.new("RGB", (W, H), dark), 0.25)
            img = Image.blend(img.convert("RGB"), back, 0.8).convert("RGBA")
        except Exception as e:
            print(f"  art {src}: {e}", file=sys.stderr)
    # The tile's wash: the league's dark colour at the top, ink at the bottom and down the left.
    wash = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    for y in range(H):
        t = y / H
        top = max(0.0, 0.45 - t * 1.5)
        wd.line([(0, y), (W, y)], fill=dark + (int(255 * top),))
    img.alpha_composite(wash)
    place_render(img, job.get("hero"))
    left = Image.new("L", (W, H), 0)
    ld = ImageDraw.Draw(left)
    for x in range(W):
        ld.line([(x, 0), (x, H)], fill=int(235 * max(0.0, 1 - x / 760) ** 1.3))
    bottom = Image.new("L", (W, H), 0)
    bd = ImageDraw.Draw(bottom)
    for y in range(H):
        bd.line([(0, y), (W, y)], fill=int(200 * max(0.0, (y / H - 0.55) / 0.45) ** 1.5))
    shade = Image.new("RGBA", (W, H), INK + (255,))
    img = Image.composite(shade, img, ImageChops.lighter(left, bottom))

    d = ImageDraw.Draw(img)
    x, width = 72, 640
    # Kicker: a rule, then AD2L · S48 (or what the job says) in the league's colour.
    d.line([(x, 72), (x + 36, 72)], fill=accent, width=3)
    spaced(d, (x + 50, 60), job["kicker"].upper(), font("mono-600.ttf", 21), accent, 5)

    stats, line = job.get("stats"), job.get("line")
    name = job["name"].upper()
    nf = fit(d, name, "display-900.ttf", 150, width, 64)
    mf = font("display-900.ttf", 128 if not stats else 112)
    # Stack from the bottom: brand row, line, stats, sub, WRAPPED, name.
    y = H - 64
    if line:
        lf = font("epilogue-500.ttf", 25)
        y -= 34
        d.text((x, y), ellipsize(d, line, lf, width + 80), font=lf, fill=GOLD)
        y -= 14
    if stats:
        y -= 92
        sx = x
        for label, value in stats:
            vf = font("display-900.ttf", 60)
            spaced(d, (sx, y), label, font("mono-600.ttf", 14), DUST, 3)
            d.text((sx - 2, y + 18), value, font=vf, fill=BONE)
            sx += max(112, int(d.textlength(value, font=vf)) + 38)
        y -= 18
    sf = font("epilogue-500.ttf", 28)
    y -= 38
    d.text((x, y), ellipsize(d, job["sub"], sf, width + 60), font=sf, fill=(214, 205, 191))
    y -= 8
    mark = "WRAPPED"
    mh = d.textbbox((0, 0), mark, font=mf)
    y -= mh[3]
    d.text((x - 4, y), mark, font=mf, fill=accent)
    nh = d.textbbox((0, 0), name, font=nf)
    y -= nh[3] - 6
    d.text((x - 4, y), name, font=nf, fill=BONE)

    # The frame, in the league's colour, like the tile's border.
    d.rounded_rectangle([14, 14, W - 15, H - 15], radius=26, outline=accent, width=5)
    brand = "ad2l stat tracker"
    bf = font("mono-400.ttf", 15)
    d.text((W - 48 - d.textlength(brand, font=bf), H - 50), brand, font=bf, fill=DUST)

    out = Path(job["out"])
    out.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out, "JPEG", quality=86, optimize=True, progressive=True)


def draw_hub(job):
    # The Wrapped hub (pages/wrapped.js renderHub): S48 WRAPPED over a row of every division's
    # tile, each its most-picked hero's art under NAME / WRAPPED in its colour. Divisions still
    # playing are greyed, as on the hub.
    img = Image.new("RGBA", (W, H), INK + (255,))
    tiles = job["tiles"]
    arts = []
    for t in tiles:
        a = None
        if t.get("art") and Path(t["art"]).exists():
            try:
                a = Image.open(t["art"]).convert("RGB")
            except Exception:
                a = None
        arts.append(a)
    # Backdrop: the arts side by side, blurred and dimmed.
    have = [a for a in arts if a]
    if have:
        strip = Image.new("RGB", (W, H), INK)
        bw = W // len(have) + 1
        for i, a in enumerate(have):
            strip.paste(cover(a, bw, H, 0.2), (i * (W // len(have)), 0))
        strip = strip.filter(ImageFilter.GaussianBlur(28))
        img = Image.blend(img.convert("RGB"), strip, 0.38).convert("RGBA")
    d = ImageDraw.Draw(img)
    # Title: a rule, AD2L · S48, then S48 WRAPPED, centred like the hub's head.
    kick = f"AD2L  ·  {job['season']}"
    kf = font("mono-600.ttf", 20)
    kw = spaced_len(d, kick, kf, 5)
    kx = (W - kw) // 2 + 26
    d.line([(kx - 52, 52), (kx - 16, 52)], fill=GOLD, width=3)
    spaced(d, (kx, 40), kick, kf, GOLD, 5)
    title = f"{job['season']} WRAPPED"
    tf = font("display-900.ttf", 112)
    d.text(((W - d.textlength(title, font=tf)) // 2, 62), title, font=tf, fill=BONE)
    # The tiles.
    n, gap, side = len(tiles), 14, 40
    tw = (W - 2 * side - gap * (n - 1)) // n
    ty = 206
    th = H - ty - 46
    for i, (t, a) in enumerate(zip(tiles, arts)):
        tx = side + i * (tw + gap)
        accent, dark = hexrgb(t["color"]), hexrgb(t["dark"])
        tile = Image.new("RGBA", (tw, th), dark + (255,))
        if a:
            tile = cover(a, tw, th, 0.35).convert("RGBA")
            if not t["open"]:
                tile = Image.blend(tile, tile.convert("L").convert("RGBA"), 0.6)
        g = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        for y in range(th):
            f = y / th
            top = max(0.0, 0.35 - f * 1.2)
            low = max(0.0, (f - 0.45) / 0.55)
            col = tuple(int(dark[k] * top / max(top + low, 1e-6) + INK[k] * low / max(top + low, 1e-6)) for k in range(3))
            gd.line([(0, y), (tw, y)], fill=col + (int(255 * min(1.0, top + low * 0.95)),))
        tile.alpha_composite(g)
        td = ImageDraw.Draw(tile)
        name = t["name"].upper()
        nf = fit(td, name, "display-900.ttf", 38, tw - 20, 16)
        mf = fit(td, "WRAPPED", "display-900.ttf", 44, tw - 20, 16)
        my = th - 22 - td.textbbox((0, 0), "WRAPPED", font=mf)[3]
        td.text((10, my), "WRAPPED", font=mf, fill=accent if t["open"] else DUST)
        td.text((10, my - td.textbbox((0, 0), name, font=nf)[3] - 2), name, font=nf, fill=BONE)
        spaced(td, (10, 10), f"AD2L {job['season']}", font("mono-600.ttf", 11), accent, 2)
        mask = Image.new("L", (tw, th), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, tw - 1, th - 1], radius=12, fill=255)
        img.paste(tile, (tx, ty), mask)
        d.rounded_rectangle([tx, ty, tx + tw - 1, ty + th - 1], radius=12, outline=accent if t["open"] else (120, 112, 104), width=3)
    brand = "ad2l stat tracker"
    bf = font("mono-400.ttf", 15)
    d.text((W - 40 - d.textlength(brand, font=bf), H - 30), brand, font=bf, fill=DUST)
    out = Path(job["out"])
    out.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out, "JPEG", quality=86, optimize=True, progressive=True)


def draw(job):
    img = background(job["color"], job["dark"])
    accent = hexrgb(job["color"])
    top = job["heroes"][0] if job["heroes"] else None

    # The top hero's render on the right, fading out to the left so the words stay clear.
    render = art(top and top["slug"], "render")
    if render:
        box = render.getbbox()
        if box:
            render = render.crop(box)
        scale = 700 / render.height
        render = render.resize((max(1, int(render.width * scale)), 700), Image.LANCZOS)
        x0 = max(560, 930 - render.width // 2)
        fade = Image.new("L", render.size, 255)
        fd = ImageDraw.Draw(fade)
        for i in range(220):
            fd.line([(i, 0), (i, render.height)], fill=int(255 * i / 220))
        alpha = Image.composite(render.getchannel("A"), Image.new("L", render.size, 0), fade)
        render.putalpha(alpha)
        shadow = Image.new("RGBA", render.size, (0, 0, 0, 0))
        shadow.putalpha(alpha.point(lambda a: a * 0.55))
        img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)), (x0 + 14, 10))
        img.alpha_composite(render, (x0, -20))
    # A dark wash under the text column.
    wash = Image.new("L", (W, H), 0)
    ImageDraw.Draw(wash).rectangle([0, 0, 640, H], fill=150)
    wash = wash.filter(ImageFilter.GaussianBlur(90))
    img = Image.composite(Image.new("RGBA", (W, H), INK + (255,)), img, wash)

    d = ImageDraw.Draw(img)
    x, width = 64, 620
    spaced(d, (x, 52), f"AD2L · {job['season']} WRAPPED · {job['league'].upper()}", font("mono-600.ttf", 20), accent, 4)

    name = job["name"].upper()
    f = fit(d, name, "display-900.ttf", 132, width, 60)
    d.text((x - 4, 82), name, font=f, fill=BONE)
    # The team right under the name, however small a long name got.
    team_y = min(228, d.textbbox((x - 4, 82), name, font=f)[3] + 16)
    # The team, then its finish in gold ("4th, Aegis", "Champions").
    tf = font("epilogue-500.ttf", 30)
    fin = f"  ·  {job['finish']}" if job.get("finish") else ""
    team = ellipsize(d, job["team"], tf, width - d.textlength(fin, font=tf))
    d.text((x, team_y), team, font=tf, fill=DUST)
    if fin:
        d.text((x + d.textlength(team, font=tf), team_y), fin, font=tf, fill=GOLD)

    # The numbers.
    # A job can name its own four (a team's); a player's are record, games, MVPs and KDA.
    stats = job.get("stats") or [("RECORD", job["record"]), ("GAMES", str(job["games"])), ("MVPS", str(job["mvps"])), ("KDA", job["kda"])]
    sx = x
    for label, value in stats:
        vf = font("display-900.ttf", 72)
        spaced(d, (sx, 292), label, font("mono-600.ttf", 15), DUST, 3)
        d.text((sx - 2, 312), value, font=vf, fill=BONE)
        sx += max(118, int(d.textlength(value, font=vf)) + 40)

    y = 410
    sig = job.get("signature")
    if sig:
        lead = f"#{sig['rank']} " if sig["rank"] <= 3 else f"#{sig['rank']} of {sig['of']} "
        lf = font("epilogue-500.ttf", 27)
        d.text((x, y), lead, font=lf, fill=GOLD)
        rest = f"· {sig['value']} {sig['label']}" + (f" (of {sig['of']})" if sig["rank"] <= 3 else "")
        d.text((x + d.textlength(lead, font=lf), y), ellipsize(d, rest, lf, width - d.textlength(lead, font=lf)), font=lf, fill=BONE)
        y += 46

    # Awards won: gold chips.
    cx = x
    for title in job["awards"]:
        cf = font("mono-600.ttf", 16)
        text = title.upper()
        w = spaced_len(d, text, cf, 2) + 28
        if cx + w > x + width:
            break
        d.rounded_rectangle([cx, y, cx + w, y + 34], radius=17, fill=GOLD)
        spaced(d, (cx + 14, y + 7), text, cf, INK, 2)
        cx += w + 10
    if job["awards"]:
        y += 48

    # Top heroes: icon, name, record.
    hy = max(y + 4, 506)
    hx = x
    for h in job["heroes"][:3]:
        icon = art(h["slug"], "icon")
        if icon:
            icon = icon.resize((96, 54), Image.LANCZOS)
            mask = Image.new("L", icon.size, 0)
            ImageDraw.Draw(mask).rounded_rectangle([0, 0, 95, 53], radius=6, fill=255)
            img.paste(icon, (hx, hy), mask)
        nf = font("epilogue-500.ttf", 19)
        d.text((hx, hy + 60), ellipsize(d, h["name"], nf, 190), font=nf, fill=BONE)
        d.text((hx + 104, hy + 14), h["record"], font=font("display-900.ttf", 30), fill=BONE)
        hx += 206

    brand = "ad2l stat tracker"
    bf = font("mono-400.ttf", 15)
    d.text((W - 40 - d.textlength(brand, font=bf), H - 38), brand, font=bf, fill=DUST)

    out = Path(job["out"])
    out.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(out, "JPEG", quality=84, optimize=True, progressive=True)


def main():
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    fetch_fonts()
    for i, job in enumerate(jobs):
        (draw_hub if job.get("hub") else draw_tile if job.get("tile") else draw)(job)
        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{len(jobs)} Wrapped images")
    print(f"wrote {len(jobs)} Wrapped images")


if __name__ == "__main__":
    main()
