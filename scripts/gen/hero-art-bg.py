# Small copies of the hero art (public/img/hero-art/) for the Wrapped backdrop wall
# (pages/wrapped.js addCollage): 360px wide, low quality, since the wall is dimmed and blurred by
# distance. About a third of the bytes. Rerun after adding hero art: python scripts/gen/hero-art-bg.py
from pathlib import Path
from PIL import Image

src = Path("public/img/hero-art")
out = Path("public/img/hero-art-bg")
out.mkdir(exist_ok=True)
before = after = 0
for f in sorted(src.glob("*.webp")):
    im = Image.open(f).convert("RGB")
    w = 360
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    dst = out / f.name
    im.save(dst, "WEBP", quality=50, method=6)
    before += f.stat().st_size
    after += dst.stat().st_size
print(f"{len(list(out.glob('*.webp')))} files, {before // 1024} KB -> {after // 1024} KB")
