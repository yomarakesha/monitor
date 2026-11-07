"""Renders build/icon.png (1024px) and build/icon.ico. Run: python3 build/make-icon.py"""
from pathlib import Path
from PIL import Image, ImageDraw

S = 1024
out = Path(__file__).parent


def render(size: int) -> Image.Image:
    k = 4  # supersample for smooth edges
    n = size * k
    f = n / S
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Background tile
    d.rounded_rectangle([40 * f, 40 * f, 984 * f, 984 * f], radius=200 * f, fill=(23, 26, 33, 255))
    # Screen
    d.rounded_rectangle([170 * f, 220 * f, 854 * f, 700 * f], radius=48 * f, fill=(15, 17, 21, 255),
                        outline=(79, 140, 255, 255), width=int(34 * f))
    # Stand
    d.rectangle([462 * f, 700 * f, 562 * f, 790 * f], fill=(79, 140, 255, 255))
    d.rounded_rectangle([330 * f, 780 * f, 694 * f, 830 * f], radius=25 * f, fill=(79, 140, 255, 255))
    # Pulse line
    pts = [(230, 470), (380, 470), (440, 360), (520, 600), (590, 420), (640, 470), (794, 470)]
    d.line([(x * f, y * f) for x, y in pts], fill=(46, 204, 113, 255), width=int(40 * f), joint='curve')
    for x, y in (pts[0], pts[-1]):
        r = 20 * f
        d.ellipse([x * f - r, y * f - r, x * f + r, y * f + r], fill=(46, 204, 113, 255))
    return img.resize((size, size), Image.LANCZOS)


big = render(S)
big.save(out / 'icon.png')
big.save(out / 'icon.ico', sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
print('ok')
