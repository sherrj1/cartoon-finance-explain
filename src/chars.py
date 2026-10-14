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
# Modelled on the show's design: pale-green eye stalks, wedge-shaped red head,
# light-blue shirt, purple pants, big glossy round claws.
import os

KW, KH = 640, 600
OUT = "#111"
SKIN = "#F2492B"
SKIN_D = "#C93720"
STALK = "#CBE8AE"
SHIRT = "#9EC6EC"
SHIRT_L = "#CFE4F7"
PANTS = "#8C6CC0"
PANTS_D = "#6B4EA3"

# (left_hand, right_hand): where each claw sits
KRABS_POSES = {
    "hips": ((50, 440), (470, 440)),
    "cross": ((222, 452), (298, 452)),
    "rub": ((226, 455), (294, 455)),
    "hold": ((190, 430), (330, 430)),
    "up": ((30, 250), (490, 250)),
    "point": ((50, 440), (495, 235)),
    "shrug": ((20, 370), (500, 370)),
    "think": ((50, 440), (372, 285)),
    "gesture": ((50, 440), (480, 335)),
}


def _claw(x, y, flip_slit=False):
    sx = -1 if flip_slit else 1
    return (
        f'<g transform="translate({x},{y})">'
        f'<ellipse cx="0" cy="0" rx="62" ry="58" fill="{SKIN}" stroke="{OUT}" stroke-width="6"/>'
        f'<path d="M{sx*34} 40 Q{sx*52} 30 {sx*60} 10" fill="none" stroke="{OUT}" stroke-width="4" stroke-linecap="round"/>'
        f'<path d="M{sx*40} 26 q{sx*8} 6 {sx*14} 4 M{sx*44} 16 q{sx*8} 6 {sx*14} 3" fill="none" stroke="{OUT}" stroke-width="3" stroke-linecap="round"/>'
        f'<ellipse cx="{-sx*26}" cy="-22" rx="14" ry="26" fill="#FFA2A2" opacity="0.9" transform="rotate({sx*25} {-sx*26} -22)"/>'
        f'</g>'
    )


def _arm(sx, sy, hx, hy):
    return (f'<line x1="{sx}" y1="{sy}" x2="{hx}" y2="{hy}" stroke="{OUT}" stroke-width="30" stroke-linecap="round"/>'
            f'<line x1="{sx}" y1="{sy}" x2="{hx}" y2="{hy}" stroke="{SKIN}" stroke-width="20" stroke-linecap="round"/>')


def _pupil(cx, cy, lid, tilt, look, dollar):
    lx, ly = look
    out = []
    if dollar:
        out.append(f'<text x="{cx}" y="{cy+16}" font-family="Inter" font-weight="900" font-size="46" '
                   f'text-anchor="middle" fill="#1a8a2a" stroke="{OUT}" stroke-width="1.5">$</text>')
        return "".join(out)
    px, py = cx + lx, cy + ly
    out.append(f'<ellipse cx="{px}" cy="{py}" rx="11" ry="18" fill="{OUT}"/>')
    out.append(f'<ellipse cx="{px+3}" cy="{py-7}" rx="3.5" ry="5" fill="#fff"/>')
    if lid > 0:
        inner = 1 if cx < 260 else -1
        yb = py - 20 + lid * 40
        pts = (f"{px-inner*26},{yb-tilt} {px+inner*26},{yb+tilt} {px+inner*26},{py-40} {px-inner*26},{py-40}")
        out.append(f'<polygon points="{pts}" fill="{STALK}"/>')
        out.append(f'<line x1="{px-inner*24}" y1="{yb-tilt}" x2="{px+inner*24}" y2="{yb+tilt}" stroke="{OUT}" stroke-width="6" stroke-linecap="round"/>')
    return "".join(out)


def _mouth(kind):
    if kind == "smile":
        return f'<path d="M214 298 Q262 330 310 298" fill="none" stroke="{OUT}" stroke-width="5" stroke-linecap="round"/>'
    if kind == "smirk":
        return f'<path d="M222 312 Q268 326 312 284" fill="none" stroke="{OUT}" stroke-width="5" stroke-linecap="round"/>'
    if kind == "frown":
        return f'<path d="M218 326 Q262 294 306 326" fill="none" stroke="{OUT}" stroke-width="5" stroke-linecap="round"/>'
    if kind == "flat":
        return f'<path d="M226 314 L298 314" stroke="{OUT}" stroke-width="6" stroke-linecap="round"/>'
    if kind == "open":
        return (f'<ellipse cx="262" cy="318" rx="30" ry="26" fill="#4a0c08" stroke="{OUT}" stroke-width="5"/>'
                f'<ellipse cx="262" cy="331" rx="17" ry="9" fill="#e8708a"/>')
    if kind == "o":
        return f'<ellipse cx="262" cy="316" rx="15" ry="20" fill="#4a0c08" stroke="{OUT}" stroke-width="5"/>'
    if kind == "grin":
        return (f'<path d="M206 290 Q262 368 318 290 Z" fill="#4a0c08" stroke="{OUT}" stroke-width="5" stroke-linejoin="round"/>'
                f'<path d="M210 292 L314 292 L305 314 L219 314 Z" fill="#fff" stroke="{OUT}" stroke-width="3"/>'
                f'<line x1="262" y1="292" x2="262" y2="314" stroke="{OUT}" stroke-width="3"/>'
                f'<ellipse cx="262" cy="338" rx="18" ry="8" fill="#e8708a"/>')
    return ""


def krabs(pose="hips", mouth="smile", lid=0.0, tilt=0, look=(0, 0), dollar=False,
          sweat=False, hat=False, flip=False):
    """Mr. Krabs. lid 0..0.9 half-closes the eyes, tilt>0 = angry / <0 = sad."""
    pose = {"cross": "cross"}.get(pose, pose)
    lh, rh = KRABS_POSES[pose]
    arm_l = _arm(160, 360, *lh)
    arm_r = _arm(360, 360, *rh)
    claws = _claw(*lh, flip_slit=True) + _claw(*rh)

    stalks = ""
    for bx, tx in ((236, 222), (288, 302)):
        stalks += (f'<line x1="{bx}" y1="225" x2="{tx}" y2="48" stroke="{OUT}" stroke-width="52" stroke-linecap="round"/>')
    for bx, tx in ((236, 222), (288, 302)):
        stalks += (f'<line x1="{bx}" y1="225" x2="{tx}" y2="48" stroke="{STALK}" stroke-width="42" stroke-linecap="round"/>')
    tufts = ""
    for tx, dirs in ((222, (-1, 0, 1)), (302, (-1, 0, 1))):
        for d in dirs:
            tufts += (f'<path d="M{tx+d*10} 36 q{d*6} -30 {d*16} -34" fill="none" stroke="{OUT}" stroke-width="10" stroke-linecap="round"/>'
                      f'<path d="M{tx+d*10} 36 q{d*6} -30 {d*16} -34" fill="none" stroke="#D2823A" stroke-width="5" stroke-linecap="round"/>')
    pupils = _pupil(241, 152, lid, tilt, look, dollar) + _pupil(283, 152, lid, -tilt, look, dollar)

    head = (f'<path d="M220 222 Q262 196 304 224 Q334 276 362 350 L162 350 Q190 276 220 222 Z" fill="{SKIN}" stroke="{OUT}" stroke-width="6" stroke-linejoin="round"/>'
            f'<path d="M214 232 q-14 -14 -2 -26 q12 -12 0 -24 q-8 -10 2 -20" fill="none" stroke="#8a2210" stroke-width="5" stroke-linecap="round"/>')

    sleeves = (f'<path d="M168 352 Q120 340 112 392 Q118 420 158 410 Z" fill="{SHIRT}" stroke="{OUT}" stroke-width="6" stroke-linejoin="round"/>'
               f'<path d="M356 352 Q404 340 412 392 Q406 420 366 410 Z" fill="{SHIRT}" stroke="{OUT}" stroke-width="6" stroke-linejoin="round"/>')
    torso = (f'<path d="M158 345 Q262 372 366 345 L370 420 L154 420 Z" fill="{SHIRT}" stroke="{OUT}" stroke-width="6" stroke-linejoin="round"/>'
             f'<polygon points="226,346 266,366 248,396 214,356" fill="{SHIRT_L}" stroke="{OUT}" stroke-width="4" stroke-linejoin="round"/>'
             f'<polygon points="298,346 258,366 276,396 310,356" fill="{SHIRT_L}" stroke="{OUT}" stroke-width="4" stroke-linejoin="round"/>'
             f'<polygon points="247,368 273,368 260,404" fill="#fff" stroke="{OUT}" stroke-width="4" stroke-linejoin="round"/>')
    pants = (f'<path d="M150 415 Q124 480 168 520 Q262 548 356 520 Q400 480 374 415 Z" fill="{PANTS}" stroke="{OUT}" stroke-width="6" stroke-linejoin="round"/>'
             f'<path d="M158 478 Q262 520 366 478 Q372 500 356 520 Q262 548 168 520 Q152 500 158 478 Z" fill="{PANTS_D}"/>'
             f'<path d="M150 415 Q124 480 168 520 Q262 548 356 520 Q400 480 374 415 Z" fill="none" stroke="{OUT}" stroke-width="6" stroke-linejoin="round"/>'
             f'<rect x="248" y="452" width="26" height="54" rx="9" fill="{PANTS}" stroke="{OUT}" stroke-width="3.5"/>')
    belt = (f'<path d="M152 410 Q262 432 372 410 L374 446 Q262 468 150 446 Z" fill="{OUT}"/>'
            f'<rect x="232" y="412" width="58" height="48" rx="5" fill="{OUT}" stroke="#F2C230" stroke-width="7"/>')
    legs = "".join(
        f'<rect x="{x}" y="528" width="54" height="30" fill="{PANTS}" stroke="{OUT}" stroke-width="5"/>'
        f'<ellipse cx="{x+27}" cy="566" rx="14" ry="18" fill="{SKIN}" stroke="{OUT}" stroke-width="5"/>'
        for x in (186, 284))

    sweat_svg = ""
    if sweat:
        sweat_svg = (f'<path d="M380 120 Q396 160 380 172 Q364 160 380 120 Z" fill="#8fd3ff" stroke="{OUT}" stroke-width="4"/>'
                     f'<path d="M420 170 Q432 200 420 210 Q408 200 420 170 Z" fill="#8fd3ff" stroke="{OUT}" stroke-width="4"/>')

    # crossed/held poses sit in front of the body; wide poses sit behind it
    in_front = pose in ("cross", "rub", "hold", "think", "point", "gesture")
    body = legs + pants + belt + torso + sleeves + head
    arms = arm_l + arm_r
    inner = (("" if in_front else arms) + stalks + body + (arms if in_front else "") +
             tufts + pupils + _mouth(mouth) + claws + sweat_svg)
    tf = 'transform="translate(520,0) scale(-1,1)"' if flip else ""
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -20 {KW} {KH}" width="{KW}" height="{KH}"><g {tf}>{inner}</g></svg>'
    return svg, (KW, KH)


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


if __name__ == "__main__":
    import cairosvg, sys, io
    from PIL import Image
    samples = [krabs("hips", "smile"), krabs("up", "grin", dollar=True), krabs("point", "open", sweat=True),
               krabs("hips", "frown", lid=0.5, tilt=12), krabs("cross", "smirk", lid=0.45, tilt=6),
               krabs("think", "o", look=(6, -6)), krabs("shrug", "flat", lid=0.4, sweat=True),
               spongebob()]
    cw, ch = 640, 600
    sheet = Image.new("RGBA", (4 * cw, 2 * ch), (165, 194, 207, 255))
    for i, (svg, (w, h)) in enumerate(samples):
        png = cairosvg.svg2png(bytestring=svg.encode(), output_width=w)
        im = Image.open(io.BytesIO(png))
        sheet.alpha_composite(im, ((i % 4) * cw, (i // 4) * ch))
    sheet.convert("RGB").save(sys.argv[1])
