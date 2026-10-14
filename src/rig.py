"""Puppet rig for the supplied Mr. Krabs artwork.

The three supplied PNGs are cut into moving parts (eye stalks, raised claw, ...) at fixed pixel
boxes. Pupils are repainted on the stalks so he can look around, blink, squint, glare or get
dollar-sign eyes. Nothing of his body is redrawn: every pixel except the pupils comes from the
supplied images.
"""
import math, os
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageChops

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
FONT = "/usr/share/fonts/opentype/inter/Inter-Black.otf"

# core = cleared from the base and moved as a part; ext = region copied into the part (overlap)
SPEC = {
    "wave": dict(
        stalks=[dict(core=(326, 0, 406, 300), ext=(326, 0, 406, 322), pivot=(366, 298), side="L", pupil=(368, 208), prx=11, pry=18),
                dict(core=(407, 0, 496, 300), ext=(407, 0, 496, 322), pivot=(452, 298), side="R", pupil=(441, 209), prx=11, pry=18)],
        parts=[dict(name="armL", core=(0, 120, 243, 485), ext=(0, 120, 262, 485), pivot=(243, 447)),
               dict(name="clawR", core=(575, 412, 794, 720), ext=(555, 412, 794, 720), pivot=(566, 432))],
        feet=(0.5, 0.98)),
    "fold": dict(
        stalks=[dict(core=(212, 0, 314, 412), ext=(212, 0, 314, 432), pivot=(284, 410), side="L", pupil=(277, 298), prx=17, pry=28),
                dict(core=(345, 0, 432, 408), ext=(345, 0, 432, 428), pivot=(388, 406), side="R", pupil=(386, 291), prx=17, pry=28)],
        parts=[], feet=(0.5, 0.98)),
    "money": dict(stalks=[], parts=[dict(name="clawR", core=(540, 0, 830, 300), ext=(540, 0, 830, 318), pivot=(650, 300))],
                  feet=(0.5, 0.98)),
}


def _sample(im, xy):
    return im.getpixel(xy)[:3]


class KrabsRig:
    def __init__(self, kind, width):
        self.kind = kind
        src = Image.open(os.path.join(ASSETS, f"krabs_{kind}.png")).convert("RGBA")
        self.s = width / src.width
        spec = SPEC[kind]
        self.spec = spec
        self.size = (int(width), int(src.height * self.s))
        base = src.copy()
        self.parts = []   # dict(img, pivot, kind)
        # stalk green sample
        if spec["stalks"]:
            st = spec["stalks"][0]
            px, py = st["pupil"]
            self.green = _sample(src, (px - st["prx"] - 8, py - st["pry"] - 14))
        for st in spec["stalks"]:
            part = self._cut(src, base, st["core"], st["ext"])
            part.update(side=st["side"], pupil=st["pupil"], prx=st["prx"], pry=st["pry"], pivot=st["pivot"], kind="stalk")
            self.parts.append(part)
        for p in spec["parts"]:
            part = self._cut(src, base, p["core"], p["ext"])
            part.update(pivot=p["pivot"], kind=p["name"])
            self.parts.append(part)
        self.base = base.resize(self.size, Image.LANCZOS)
        for p in self.parts:
            ox, oy = p["off"]
            p["img_s"] = p["img"].resize((max(1, int(p["img"].width * self.s)), max(1, int(p["img"].height * self.s))), Image.LANCZOS)
            p["off_s"] = (ox * self.s, oy * self.s)
            p["piv_s"] = (p["pivot"][0] * self.s, p["pivot"][1] * self.s)

    @staticmethod
    def _cut(src, base, core, ext):
        part = src.crop(ext)
        mask_core = Image.new("L", src.size, 0)
        ImageDraw.Draw(mask_core).rectangle(core, fill=255)
        a = base.getchannel("A")
        base.putalpha(ImageChops.multiply(a, ImageChops.invert(mask_core)))
        return dict(img=part, off=(ext[0], ext[1]))

    # ------------------------------------------------------------------ pupils
    def _stalk_with_eye(self, p, look, lid, tilt, pscale, dollar, blink):
        img = p["img"].copy()
        ox, oy = p["off"]
        cx, cy = p["pupil"][0] - ox, p["pupil"][1] - oy
        rx, ry = p["prx"], p["pry"]
        k = 4  # supersample the little eye overlay
        w, h = img.size
        pad = int(max(rx, ry) * 2.2)
        box = (cx - pad, cy - pad, cx + pad, cy + pad)
        region = img.crop(box)
        big = region.resize((region.width * k, region.height * k), Image.LANCZOS)
        d = ImageDraw.Draw(big)
        c = pad * k
        # erase the original pupil: fill the (clean) interior of the stalk around it
        er = int(max(rx, ry) * 1.35 * k)
        d.ellipse((c - er * 0.8, c - er, c + er * 0.8, c + er), fill=self.green + (255,))
        lx, ly = look
        pcx, pcy = c + lx * k, c + ly * k
        if dollar:
            f = ImageFont.truetype(FONT, int(ry * 3.1 * k))
            d.text((pcx, pcy), "$", font=f, fill=(20, 140, 40, 255), anchor="mm", stroke_width=int(1.6 * k), stroke_fill=(10, 10, 10, 255))
        elif blink >= 0.98:
            d.arc((pcx - rx * k, pcy - ry * 0.35 * k, pcx + rx * k, pcy + ry * 0.55 * k), 20, 160, fill=(15, 15, 15, 255), width=int(3.2 * k))
        else:
            prx, pry = rx * pscale, ry * pscale * (1 - 0.85 * blink)
            d.ellipse((pcx - prx * k, pcy - pry * k, pcx + prx * k, pcy + pry * k), fill=(12, 12, 12, 255))
            # highlight
            hx, hy = pcx + prx * 0.28 * k, pcy - pry * 0.38 * k
            hr = max(2, prx * 0.30 * k)
            d.ellipse((hx - hr, hy - hr * 1.15, hx + hr, hy + hr * 1.15), fill=(255, 255, 255, 255))
            if lid > 0:
                inner = 1 if p["side"] == "L" else -1   # inner corner points to the face centre
                ytop = pcy - pry * k
                yb = ytop + lid * 2 * pry * k
                x0, x1 = c - rx * 2.6 * k, c + rx * 2.6 * k
                t = tilt * k
                # outer side higher, inner side lower when angry (tilt>0)
                xo, xi = (x0, x1) if inner == 1 else (x1, x0)
                poly = [(xo, yb - t), (xi, yb + t), (xi, ytop - 3 * pry * k), (xo, ytop - 3 * pry * k)]
                d.polygon(poly, fill=self.green + (255,))
                d.line([(xo, yb - t), (xi, yb + t)], fill=(15, 15, 15, 255), width=int(3.4 * k))
        small = big.resize(region.size, Image.LANCZOS)
        img.paste(small, box[:2])
        # keep alpha from the original piece (the eye never leaves the stalk)
        orig_a = p["img"].getchannel("A")
        img.putalpha(orig_a)
        return img.resize((max(1, int(img.width * self.s)), max(1, int(img.height * self.s))), Image.LANCZOS)

    # ------------------------------------------------------------------ frame
    def frame(self, t, mood="happy", phase=0.0):
        P = mood_params(mood, t + phase, self.kind)
        W, H = self.size
        canvas = Image.new("RGBA", (W + 2 * 90, H + 2 * 40), (0, 0, 0, 0))
        mx, my = 90, 40
        canvas.alpha_composite(self.base, (mx, my))
        for p in self.parts:
            kind = p["kind"]
            if kind == "stalk":
                ang = P["stL"] if p["side"] == "L" else P["stR"]
                img = self._stalk_with_eye(p, P["look"], P["lid"], P["tilt"], P["pscale"], P["dollar"], P["blink"])
            elif kind == "armL":
                ang, img = P["armL"], p["img_s"]
            elif kind == "clawR":
                ang, img = P["clawR"], p["img_s"]
            else:
                ang, img = 0, p["img_s"]
            self._paste_rot(canvas, img, p, ang, (mx, my))
        # whole-body squash & stretch anchored at the feet
        sx, sy = P["sx"], P["sy"]
        if abs(sx - 1) > 1e-3 or abs(sy - 1) > 1e-3:
            fx, fy = mx + W * 0.5, my + H * 0.98
            nw, nh = int(canvas.width * sx), int(canvas.height * sy)
            sc = canvas.resize((nw, nh), Image.BILINEAR)
            out = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
            out.paste(sc, (int(fx - fx * sx), int(fy - fy * sy)), sc)
            canvas = out
        dx = P["dx"]
        if dx:
            c2 = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
            c2.paste(canvas, (int(dx), 0), canvas)
            canvas = c2
        return canvas

    @staticmethod
    def _paste_rot(canvas, img, p, ang, margin):
        mx, my = margin
        ox, oy = p["off_s"]
        px, py = p["piv_s"]
        if abs(ang) < 0.05:
            canvas.paste(img, (int(mx + ox), int(my + oy)), img)
            return
        # pivot position inside the part image
        lx, ly = px - ox, py - oy
        R = int(math.hypot(max(lx, img.width - lx), max(ly, img.height - ly))) + 4
        pad = Image.new("RGBA", (2 * R, 2 * R), (0, 0, 0, 0))
        pad.paste(img, (int(R - lx), int(R - ly)), img)
        rot = pad.rotate(ang, resample=Image.BICUBIC, center=(R, R))
        dest = (int(mx + px - R), int(my + py - R))
        canvas.paste(rot, dest, rot)


def mood_params(mood, t, kind):
    """Per-frame pose parameters for a mood. Everything is smooth (sines / eased)."""
    s = math.sin
    tau = 2 * math.pi
    P = dict(stL=0.0, stR=0.0, armL=0.0, clawR=0.0, look=(0, 0), lid=0.0, tilt=0.0, pscale=1.0, dollar=False,
             sx=1.0, sy=1.0, dx=0.0, blink=0.0)
    amp = 1.0 if kind != "fold" else 0.7
    # periodic blink
    bt = (t % 3.1)
    if bt < 0.14:
        P["blink"] = 1.0 if 0.03 < bt < 0.11 else 0.5
    if mood == "happy":
        P["stL"] = 4.5 * amp * s(tau * 0.8 * t)
        P["stR"] = 4.5 * amp * s(tau * 0.8 * t + 0.9)
        P["armL"] = 11 * s(tau * 1.5 * t)
        P["clawR"] = 3 * s(tau * 1.1 * t)
        P["look"] = (3 * s(tau * 0.33 * t), 1.5 * s(tau * 0.5 * t))
        P["sy"] = 1 + 0.012 * s(tau * 1.1 * t); P["sx"] = 1 - 0.006 * s(tau * 1.1 * t)
    elif mood == "excited":
        P["stL"] = 9 * amp * s(tau * 2.2 * t)
        P["stR"] = 9 * amp * s(tau * 2.2 * t + 1.3)
        P["armL"] = 18 * s(tau * 2.6 * t)
        P["clawR"] = 6 * s(tau * 2.4 * t)
        P["look"] = (0, -3)
        P["sy"] = 1 + 0.05 * abs(s(tau * 1.5 * t)); P["sx"] = 1 - 0.025 * abs(s(tau * 1.5 * t))
    elif mood == "shock":
        P["pscale"] = 0.6
        P["stL"] = -3 * amp + 1.5 * s(tau * 9 * t)
        P["stR"] = 3 * amp + 1.5 * s(tau * 9 * t + 1)
        P["armL"] = -16 + 3 * s(tau * 8 * t)
        P["sy"] = 1.05; P["sx"] = 0.97
        P["dx"] = 3 * s(tau * 13 * t)
    elif mood == "sad":
        P["stL"] = 26 * amp + 3 * s(tau * 0.5 * t)
        P["stR"] = -(26 * amp + 3 * s(tau * 0.5 * t + 1))
        P["lid"] = 0.45; P["tilt"] = -6
        P["look"] = (0, 5)
        P["armL"] = 12 + 2 * s(tau * 0.6 * t)
        P["sy"] = 1 - 0.02 * (0.5 + 0.5 * s(tau * 0.5 * t)); P["sx"] = 1 + 0.01
    elif mood == "angry":
        P["stL"] = -9 * amp + 2 * s(tau * 3 * t)
        P["stR"] = 9 * amp - 2 * s(tau * 3 * t)
        P["lid"] = 0.38; P["tilt"] = 12
        P["look"] = (0, 2)
        P["armL"] = 7 * s(tau * 5 * t)
        P["clawR"] = 5 * s(tau * 6 * t)
        P["dx"] = 2.6 * s(tau * 17 * t)
        P["sy"] = 1 + 0.015 * s(tau * 6 * t)
    elif mood == "smug":
        P["stL"] = 4 * amp * s(tau * 0.5 * t) - 5
        P["stR"] = 4 * amp * s(tau * 0.5 * t + 1) + 5
        P["lid"] = 0.42; P["tilt"] = 0
        P["look"] = (7, 1)
        P["armL"] = 6 * s(tau * 0.8 * t)
        P["sy"] = 1 + 0.01 * s(tau * 0.7 * t)
    elif mood == "greedy":
        P["dollar"] = True
        P["stL"] = 11 * amp * s(tau * 2.0 * t)
        P["stR"] = 11 * amp * s(tau * 2.0 * t + 1.6)
        P["armL"] = 12 * s(tau * 2.4 * t)
        P["clawR"] = 5 * s(tau * 2.2 * t)
        P["look"] = (0, 0)
        P["sy"] = 1 + 0.04 * abs(s(tau * 1.3 * t)); P["sx"] = 1 - 0.02 * abs(s(tau * 1.3 * t))
    elif mood == "think":
        P["look"] = (-7, -9)
        P["stL"] = 2
        P["stR"] = 15 + 2 * s(tau * 0.7 * t)
        P["lid"] = 0.2
        P["armL"] = -6 + 2 * s(tau * 0.6 * t)
        P["sy"] = 1 + 0.008 * s(tau * 0.8 * t)
    elif mood == "scan":
        P["look"] = (11 * s(tau * 0.9 * t), 0)
        P["stL"] = 5 * amp * s(tau * 0.9 * t); P["stR"] = 5 * amp * s(tau * 0.9 * t)
        P["armL"] = 4 * s(tau * 1.0 * t)
    elif mood == "proud":
        P["stL"] = -3; P["stR"] = 3
        P["lid"] = 0.25; P["look"] = (0, -4)
        P["armL"] = -8 + 3 * s(tau * 0.8 * t)
        P["sy"] = 1.025; P["sx"] = 0.99
    # Eye stalks stay straight and parallel (as drawn); at most a tiny shared sway, like a head bob.
    st_amp = {"excited": 2.4, "greedy": 2.0, "shock": 0.0, "angry": 0.0}.get(mood, 1.3)
    P["stL"] = P["stR"] = st_amp * s(tau * 0.8 * t)
    return P
