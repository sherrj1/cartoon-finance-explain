"""Hand-built SVG cartoon characters: Mr. Krabs and SpongeBob.

Each factory returns (svg_string, (width, height)) so the renderer can scale it.
"""
import math

INK = "#161616"
RED = "#D8402B"
RED_D = "#A62A1B"
BLUE = "#2F5FA8"
GOLD = "#F2B632"
YEL = "#F4D23A"
YEL_D = "#D4AE22"

# --------------------------------------------------------------------------- Krabs
# Uses the supplied Mr. Krabs artwork (assets/krabs_*.png, background removed). No redrawing.
import os, io
import cairosvg
from PIL import Image, ImageOps

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
_sprites = {}
# display width relative to the `w` passed by the scene, so all poses end up a similar size
_FACTOR = {"wave": 0.95, "fold": 0.55, "money": 1.15}
OUT = "#111"


def _sprite(name, flip=False, sweat=False):
    key = (name, flip, sweat)
    if key not in _sprites:
        im = Image.open(os.path.join(ASSETS, f"krabs_{name}.png")).convert("RGBA")
        if sweat:
            pad = int(im.width * 0.22)
            canvas = Image.new("RGBA", (im.width + pad, im.height), (0, 0, 0, 0))
            canvas.alpha_composite(im, (0, 0))
            svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 200" width="120" height="200">'
                   f'<path d="M40 8 Q64 70 40 88 Q16 70 40 8 Z" fill="#8fd3ff" stroke="{OUT}" stroke-width="6"/>'
                   f'<path d="M92 110 Q108 150 92 164 Q76 150 92 110 Z" fill="#8fd3ff" stroke="{OUT}" stroke-width="6"/></svg>')
            drop = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=int(pad * 1.1)))).convert("RGBA")
            canvas.alpha_composite(drop, (im.width - int(pad * 0.1), int(im.height * 0.02)))
            im = canvas
        if flip:
            im = ImageOps.mirror(im)
        _sprites[key] = im
    return _sprites[key]


def krabs(pose="hips", mouth=None, dollar=False, sweat=False, flip=False, **_ignored):
    """Returns a sprite asset (PIL image, (w, h)). `pose` picks one of the supplied drawings:
    folded claws for cross/rub/hold, the lying-on-money pose when dollar=True, the grin-and-wave otherwise."""
    if dollar:
        name = "money"
    elif pose in ("cross", "rub", "hold"):
        name = "fold"
    else:
        name = "wave"
    im = _sprite(name, flip, sweat)
    return (im, im.size, _FACTOR[name])


# ------------------------------------------------------------------------- SpongeBob
# Uses the supplied vector artwork as-is (single pose).
SB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "spongebob.svg")
SW, SH = 314, 406
_SB = None


def spongebob(flip=False, **_ignored):
    global _SB
    if _SB is None:
        raw = open(SB_PATH, encoding="utf-8").read()
        _SB = raw[raw.index(">") + 1: raw.rindex("</svg>")]
    tf = f'transform="translate({SW},0) scale(-1,1)"' if flip else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SW} {SH}" width="{SW}" height="{SH}">'
            f'<g {tf}>{_SB}</g></svg>', (SW, SH))


