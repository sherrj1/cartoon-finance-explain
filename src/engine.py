"""Tiny 2D scene engine: SVG layers -> animated frames -> ffmpeg."""
import io, math, os, subprocess
import cairosvg
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
FPS = 30
BG = (165, 194, 207)
CAP_Y = int(H * 0.66)
FONT_CAP = "/usr/share/fonts/opentype/inter/InterDisplay-BlackItalic.otf"

_png_cache = {}


def svg_img(svg, width):
    if isinstance(svg, Image.Image):
        key = (id(svg), int(width))
        if key not in _png_cache:
            _png_cache[key] = svg.resize((int(width), max(1, int(svg.height * width / svg.width))), Image.LANCZOS)
        return _png_cache[key]
    key = (hash(svg), width)
    if key not in _png_cache:
        png = cairosvg.svg2png(bytestring=svg.encode(), output_width=int(width))
        _png_cache[key] = Image.open(io.BytesIO(png)).convert("RGBA")
    return _png_cache[key]


class L:
    """One layer. x,y = centre on the 1080x1920 canvas, w = target pixel width."""

    def __init__(self, asset, x, y, w, anim="pop", delay=0.0, until=None, bob=0, shadow=False,
                 delay_f=None, until_f=None, rot=0, wiggle=0):
        self.svg, (aw, ah), *rest = asset if len(asset) == 3 else (*asset, 1.0)
        if rest and rest[0] != 1.0:
            w = w * rest[0]
        self.x, self.y, self.w = x, y, w
        self.h = w * ah / aw
        self.anim, self.delay, self.until = anim, delay, until
        self.delay_f, self.until_f = delay_f, until_f
        self.bob, self.shadow, self.rot, self.wiggle = bob, shadow, rot, wiggle

    def times(self, dur):
        d = self.delay_f * dur if self.delay_f is not None else self.delay
        u = self.until_f * dur if self.until_f is not None else self.until
        return d, u


def _ease_out_back(t):
    c1, c3 = 1.2, 2.2
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def bg_image(kind="day", ground=None, ground_y=1080):
    key = ("bg", kind, ground, ground_y)
    if key in _png_cache:
        return _png_cache[key]
    base = {"day": BG, "night": (38, 52, 84), "dark": (30, 36, 48)}[kind]
    img = Image.new("RGB", (W, H), base)
    d = ImageDraw.Draw(img)
    if kind == "night":
        import random
        r = random.Random(3)
        for _ in range(60):
            x, y, s = r.randint(0, W), r.randint(0, 900), r.randint(2, 5)
            d.ellipse((x, y, x + s, y + s), fill=(240, 240, 200))
    elif kind == "day":
        for cx, cy, sc in ((180, 200, 1.0), (850, 330, 1.2), (330, 1480, 0.9), (900, 1620, 1.0)):
            for dx, dy, r in ((0, 0, 70), (70, -25, 85), (150, 5, 65), (60, 25, 60)):
                x, y, rr = cx + dx * sc, cy + dy * sc, r * sc
                d.ellipse((x - rr, y - rr * 0.8, x + rr, y + rr * 0.8), fill=(250, 252, 252), outline=(60, 90, 110), width=3)
            for dx, dy, r in ((0, 0, 70), (70, -25, 85), (150, 5, 65), (60, 25, 60)):
                x, y, rr = cx + dx * sc, cy + dy * sc, r * sc
                d.ellipse((x - rr + 3, y - rr * 0.8 + 3, x + rr - 3, y + rr * 0.8 - 3), fill=(250, 252, 252))
    if ground:
        col = {"mud": (112, 82, 52), "gravel": (128, 128, 124), "grass": (96, 150, 84), "asphalt": (70, 74, 82)}[ground]
        dark = tuple(int(c * 0.78) for c in col)
        d.rectangle((0, ground_y, W, H), fill=col)
        d.line((0, ground_y, W, ground_y), fill=(20, 20, 20), width=6)
        import random
        r = random.Random(11)
        for _ in range(260):
            x, y, s = r.randint(0, W), r.randint(ground_y + 12, H), r.randint(4, 14)
            d.ellipse((x, y, x + s, y + s * 0.6), fill=dark)
    _png_cache[key] = img
    return img


_shadow = None


def shadow_img(w):
    key = ("sh", int(w))
    if key not in _png_cache:
        im = Image.new("RGBA", (int(w), int(w * 0.16)), (0, 0, 0, 0))
        ImageDraw.Draw(im).ellipse((0, 0, im.width - 1, im.height - 1), fill=(0, 0, 0, 70))
        _png_cache[key] = im
    return _png_cache[key]


_caps = {}


def cap_img(word, size=104):
    key = (word, size)
    if key not in _caps:
        f = ImageFont.truetype(FONT_CAP, size)
        pad = 24
        tmp = Image.new("RGBA", (1, 1))
        bb = ImageDraw.Draw(tmp).textbbox((0, 0), word, font=f, stroke_width=12)
        im = Image.new("RGBA", (bb[2] - bb[0] + pad * 2, bb[3] - bb[1] + pad * 2), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        pos = (pad - bb[0], pad - bb[1])
        d.text((pos[0] + 4, pos[1] + 7), word, font=f, fill=(0, 0, 0, 120), stroke_width=12, stroke_fill=(0, 0, 0, 120))
        d.text(pos, word, font=f, fill=(255, 229, 0), stroke_width=12, stroke_fill=(10, 10, 10))
        _caps[key] = im
    return _caps[key]


def frame_at(bg, layers, t, dur, words, ct=None):
    tc = t if ct is None else ct
    frame = bg.copy()
    for ly in layers:
        d0, u0 = ly.times(dur)
        if t < d0 or (u0 is not None and t >= u0):
            continue
        lt = t - d0
        scale, alpha, dx, dy = 1.0, 1.0, 0, 0
        if ly.anim == "pop":
            p = min(1, lt / 0.30)
            scale = max(0.05, 0.25 + 0.75 * _ease_out_back(p)) if p < 1 else 1
            alpha = min(1, lt / 0.10)
        elif ly.anim == "drop":
            p = min(1, lt / 0.5)
            dy = -(1 - p) ** 2 * 900 if p < 1 else 0
            if 0.5 <= lt < 0.7:
                dy = -math.sin((lt - 0.5) / 0.2 * math.pi) * 28
        elif ly.anim == "left":
            p = min(1, lt / 0.4); dx = -(1 - p) ** 3 * 800
        elif ly.anim == "right":
            p = min(1, lt / 0.4); dx = (1 - p) ** 3 * 800
        elif ly.anim == "fade":
            alpha = min(1, lt / 0.3)
        if ly.bob:
            dy += math.sin(t * 2 * math.pi * 1.1) * ly.bob
            scale *= 1 + math.sin(t * 2 * math.pi * 1.1 + 1.2) * 0.008
        ang = ly.rot + (math.sin(t * 2 * math.pi * 0.9) * ly.wiggle if ly.wiggle else 0)
        w = max(8, int(ly.w * scale))
        im = svg_img(ly.svg, ly.w if scale == 1.0 and not ang else w)
        if ang:
            im = im.rotate(ang, resample=Image.BICUBIC, expand=True)
        if scale != 1.0:
            im = im.resize((max(1, int(im.width * w / ly.w)), max(1, int(im.height * w / ly.w))), Image.BILINEAR)
        if alpha < 1:
            a = im.getchannel("A").point(lambda v: int(v * alpha))
            im = im.copy(); im.putalpha(a)
        px, py = int(ly.x + dx - im.width / 2), int(ly.y + dy - im.height / 2)
        if ly.shadow:
            sh = shadow_img(im.width * 0.7)
            frame.paste(sh, (int(ly.x + dx - sh.width / 2), int(ly.y + ly.h / 2 - 10)), sh)
        frame.paste(im, (px, py), im)
    # slow push-in
    z = 1.14 + 0.06 * (t / max(dur, 0.1))
    cw, ch = W / z, H / z
    x0, y0 = (W - cw) / 2, min(H - ch, (H - ch) / 2 + 40)
    frame = frame.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))
    # captions
    cur = None
    for (w0, w1, word) in words:
        if w0 <= tc < w1:
            cur = (w0, word)
    if cur is None and words and tc >= words[-1][0]:
        cur = (words[-1][0], words[-1][2])
    if cur:
        ci = cap_img(cur[1])
        age = tc - cur[0]
        s = 1.0 + 0.22 * max(0, 1 - age / 0.12)
        if s != 1.0:
            ci = ci.resize((int(ci.width * s), int(ci.height * s)), Image.BILINEAR)
        frame.paste(ci, (int(W / 2 - ci.width / 2), int(CAP_Y - ci.height / 2)), ci)
    return frame


def frame_scene(sc, bg, t, dur, words):
    """Picks the active visual beat of a scene (scenes can cut to a 2nd/3rd image mid-narration)."""
    beats = [(0.0, sc["layers"])] + sc.get("beats", [])
    idx = max(i for i, (f, _) in enumerate(beats) if t >= f * dur - 1e-6)
    f0 = beats[idx][0]
    f1 = beats[idx + 1][0] if idx + 1 < len(beats) else 1.0
    b = sc.get("beat_bgs", {}).get(idx)
    if b:
        bg = bg_image(*b)
    return frame_at(bg, beats[idx][1], t - f0 * dur, (f1 - f0) * dur, words, ct=t)


def render_scene(args):
    """Render one scene to an mp4 (no audio). args: dict with scene spec + timings + out path."""
    sc, dur, words, out = args["scene"], args["dur"], args["words"], args["out"]
    n = max(1, round(dur * FPS))
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", out],
        stdin=subprocess.PIPE)
    if sc.get("end_card"):
        img = Image.new("RGB", (W, H), (0, 0, 0))
        d = ImageDraw.Draw(img)
        f1 = ImageFont.truetype("/usr/share/fonts/opentype/inter/InterDisplay-Black.otf", 120)
        f2 = ImageFont.truetype("/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf", 52)
        d.text((W / 2, H * 0.46), "SUBSCRIBE", font=f1, fill=(255, 255, 255), anchor="mm")
        d.text((W / 2, H * 0.53), sc["end_card"], font=f2, fill=(255, 229, 0), anchor="mm")
        raw = img.tobytes()
        for _ in range(n):
            proc.stdin.write(raw)
        proc.stdin.close()
        proc.wait()
        return out
    bg = bg_image(sc.get("bg", "day"), sc.get("ground"), sc.get("ground_y", 1080))
    layers = sc["layers"]
    for i in range(n):
        frame = frame_scene(sc, bg, i / FPS, dur, words)
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    proc.wait()
    return out
