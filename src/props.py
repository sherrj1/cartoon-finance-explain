"""SVG props: the 'explainer' half of every video (price tags, calculators, calendars...)."""
INK = "#161616"
PAPER = "#F3EBD3"
GREEN = "#2E8B3E"
FONT = "Inter, DejaVu Sans, sans-serif"


def S(w, h, inner):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{inner}</svg>', (w, h))


def T(x, y, s, size=40, fill=INK, weight=800, anchor="middle", extra=""):
    return (f'<text x="{x}" y="{y}" font-family="{FONT}" font-weight="{weight}" font-size="{size}" '
            f'text-anchor="{anchor}" fill="{fill}" {extra}>{s}</text>')


def box(x, y, w, h, fill, r=12, sw=6):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{INK}" stroke-width="{sw}"/>'


# ---------------------------------------------------------------- tags / signs / cards
def tag(big, sub, angle=-8):
    return S(620, 360, f'<g transform="rotate({angle} 310 180)">'
             f'<path d="M110 60 L560 60 L590 180 L560 300 L110 300 L60 250 L60 110 Z" fill="{PAPER}" stroke="{INK}" stroke-width="7"/>'
             f'<circle cx="105" cy="180" r="14" fill="#a9c0cc" stroke="{INK}" stroke-width="5"/>'
             f'<path d="M105 180 Q20 150 10 60" fill="none" stroke="{INK}" stroke-width="5"/>'
             + T(350, 200, big, 96) + T(350, 262, sub, 30, weight=700) + '</g>')


def sign(lines, board="#F3EBD3", color=INK, h=None, size=44):
    n = len(lines)
    bh = h or 60 + n * (size + 14)
    inner = (f'<rect x="196" y="{bh}" width="28" height="{520-bh}" fill="#6b4a2a" stroke="{INK}" stroke-width="6"/>'
             + box(30, 20, 360, bh - 10, board, 18, 7))
    for i, ln in enumerate(lines):
        inner += T(210, 20 + 30 + size + i * (size + 14), ln, size, color)
    return S(420, 520, inner)


def calc(label, amount):
    btn = ""
    for r in range(4):
        for c in range(4):
            btn += box(36 + c * 74, 250 + r * 62, 62, 50, "#d9dde0", 8, 4)
    return S(360, 560, box(10, 10, 340, 540, "#9aa5ad", 34, 8) +
             box(36, 40, 288, 160, "#b8d8a8", 12, 6) +
             T(180, 118, amount, 54 if len(amount) < 9 else 44, "#1e4d1e", 900) +
             T(180, 168, label, 22, "#1e4d1e", 800) + btn +
             box(36, 250 + 3 * 62, 62, 50, "#f2b632", 8, 4))


def calendar(title, big, sub=None, checks=0):
    days = ""
    for i in range(35):
        x, y = 40 + (i % 7) * 48, 150 + (i // 7) * 42
        if i < 31:
            days += T(x + 20, y + 26, str(i + 1), 20, "#555", 700)
    for i in range(checks):
        x, y = 40 + (i % 7) * 48, 150 + (i // 7) * 42
        days += f'<circle cx="{x+20}" cy="{y+18}" r="17" fill="none" stroke="#c22" stroke-width="5"/>'
    h = 440
    return S(420, h + (60 if sub else 0),
             f'<path d="M110 20 L130 -2 M310 20 L290 -2" stroke="{INK}" stroke-width="6"/>' +
             box(20, 30, 380, 380, "#fff", 14, 7) + f'<rect x="20" y="30" width="380" height="90" rx="14" fill="#cf3b2c" stroke="{INK}" stroke-width="7"/>' +
             T(210, 72, title, 32, "#fff") + T(210, 108, big, 26, "#fff", 700) + days +
             (T(210, 460, sub, 28, INK, 800) if sub else ""))


def months(n, total=4):
    """Row of mini month cards with ticks (e.g. 'within four months')."""
    inner = ""
    for i in range(total):
        x = i * 150
        inner += box(x + 6, 20, 130, 150, "#fff", 10, 6) + f'<rect x="{x+6}" y="20" width="130" height="40" rx="10" fill="#cf3b2c" stroke="{INK}" stroke-width="6"/>'
        inner += T(x + 71, 49, f"MONTH {i+1}", 18, "#fff")
        if i < n:
            inner += f'<path d="M{x+36} 115 L{x+62} 142 L{x+108} 84" fill="none" stroke="{GREEN}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>'
    return S(610, 190, inner)


def envelope(text="", sealed=True, color="#fff", badge=None):
    inner = (box(20, 40, 360, 220, color, 10, 7) + f'<path d="M20 40 L200 170 L380 40" fill="none" stroke="{INK}" stroke-width="7" stroke-linejoin="round"/>')
    if sealed:
        inner += f'<circle cx="200" cy="170" r="26" fill="#c22" stroke="{INK}" stroke-width="5"/>'
    if text:
        inner += T(200, 250 + 0, text, 30, "#c22" if color == "#fff" else INK, 900)
    if badge:
        inner += f'<circle cx="360" cy="40" r="34" fill="#c22" stroke="{INK}" stroke-width="5"/>' + T(360, 52, badge, 34, "#fff", 900)
    return S(400, 300, inner)


def letters_row(last_text="14 DAYS"):
    inner = ""
    for i in range(3):
        col = "#fff" if i < 2 else "#ffd9d4"
        inner += f'<g transform="translate({i*330},0) scale(0.8)">' + envelope(f"#{i+1}", True, col, badge=str(i + 1))[0].split(">", 1)[1].rsplit("</svg>", 1)[0] + "</g>"
    inner += T(790, 275, last_text, 40, "#c22", 900)
    return S(1000, 310, inner)


# ---------------------------------------------------------------- containers & site
CONT_COLORS = ["#c0392b", "#2e6da4", "#e0a526", "#3f8f5a", "#7d5ba6", "#d9742e", "#5e7d8a"]


def container(num="", color=None, door="closed", color_idx=0, lock=True, w=300):
    c = color or CONT_COLORS[color_idx % len(CONT_COLORS)]
    ribs = "".join(f'<line x1="{x}" y1="42" x2="{x}" y2="198" stroke="#00000033" stroke-width="5"/>' for x in range(46, 290, 22))
    inner = box(8, 30, 284, 180, c, 6, 7) + ribs
    if door == "open":
        inner += (f'<rect x="60" y="48" width="180" height="150" fill="#2a1d14" stroke="{INK}" stroke-width="6"/>'
                  f'<polygon points="60,48 20,60 20,190 60,198" fill="{c}" stroke="{INK}" stroke-width="6"/>')
    else:
        inner += f'<rect x="70" y="48" width="160" height="150" fill="#00000022" stroke="{INK}" stroke-width="5"/><line x1="150" y1="48" x2="150" y2="198" stroke="{INK}" stroke-width="5"/>'
        inner += f'<rect x="132" y="108" width="8" height="40" fill="#ccc" stroke="{INK}" stroke-width="2"/><rect x="160" y="108" width="8" height="40" fill="#ccc" stroke="{INK}" stroke-width="2"/>'
        if lock:
            inner += f'<rect x="141" y="130" width="18" height="16" rx="3" fill="{ "#f2b632" }" stroke="{INK}" stroke-width="3"/>'
    if num:
        inner += f'<rect x="108" y="4" width="84" height="32" rx="6" fill="#fff" stroke="{INK}" stroke-width="5"/>' + T(150, 30, num, 26, INK, 900)
    return S(300, 220, inner)


def container_grid(rows=4, cols=5, nums=True, w=900):
    """rows x cols of container fronts, numbered."""
    cw, ch = 170, 125
    inner = ""
    n = 1
    for r in range(rows):
        for c in range(cols):
            col = CONT_COLORS[(r * 2 + c) % len(CONT_COLORS)]
            x, y = c * (cw + 12), r * (ch + 10)
            inner += (f'<g transform="translate({x},{y}) scale(0.567)">'
                      + container(str(n) if nums else "", col, lock=False)[0].split(">", 1)[1].rsplit("</svg>", 1)[0] + "</g>")
            n += 1
    W, H = cols * (cw + 12), rows * (ch + 10)
    return S(W, H, inner)


def gate():
    posts = "".join(f'<rect x="{x}" y="230" width="16" height="170" fill="#9aa5ad" stroke="{INK}" stroke-width="5"/>' for x in range(20, 300, 56))
    mesh = f'<rect x="20" y="250" width="270" height="6" fill="{INK}"/><rect x="20" y="300" width="270" height="6" fill="{INK}"/>'
    # boom barrier + keypad
    keys = "".join(box(402 + c * 34, 170 + r * 32, 28, 24, "#ddd", 4, 3) for r in range(3) for c in range(3))
    return S(620, 440,
             posts + mesh +
             f'<rect x="360" y="190" width="120" height="210" fill="#6b4a2a" stroke="{INK}" stroke-width="6"/>' +
             box(380, 130, 108, 200, "#2a3640", 10, 6) + box(394, 144, 80, 34, "#b8d8a8", 6, 3) + keys +
             # camera
             f'<rect x="545" y="150" width="14" height="250" fill="#9aa5ad" stroke="{INK}" stroke-width="5"/>'
             f'<rect x="505" y="130" width="80" height="34" rx="8" fill="#e8e8e8" stroke="{INK}" stroke-width="5"/>'
             f'<circle cx="510" cy="147" r="10" fill="#222" stroke="{INK}" stroke-width="3"/>'
             # boom
             f'<rect x="20" y="215" width="330" height="22" fill="#fff" stroke="{INK}" stroke-width="5"/>'
             + "".join(f'<rect x="{x}" y="215" width="30" height="22" fill="#d22"/>' for x in range(50, 340, 70)) +
             f'<rect x="20" y="215" width="330" height="22" fill="none" stroke="{INK}" stroke-width="5"/>')


# ---------------------------------------------------------------- icons
def icon_toilet(burst=True):
    return S(160, 200, f'<rect x="40" y="70" width="80" height="60" rx="10" fill="#fff" stroke="{INK}" stroke-width="6"/>'
             f'<path d="M30 130 Q80 190 130 130 Z" fill="#fff" stroke="{INK}" stroke-width="6"/>'
             + ("".join(f'<path d="M{x} 70 Q{x+8} 30 {x-4} 6" fill="none" stroke="#4aa3df" stroke-width="7" stroke-linecap="round"/>' for x in (60, 85, 110)) if burst else ""))


def icon_house():
    return S(140, 140, f'<polygon points="70,10 130,64 10,64" fill="#c0392b" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
             + box(24, 64, 92, 66, "#f0d9a0", 4, 6) + box(58, 92, 24, 38, "#6b4a2a", 2, 4))


def icon_wall():
    return S(140, 140, "".join(f'<rect x="{10 + (j*35 + (i%2)*17)%105}" y="{12 + i*30}" width="34" height="24" fill="#c0653a" stroke="{INK}" stroke-width="4"/>' for i in range(4) for j in range(3)))


def icon_roof():
    return S(140, 140, f'<polygon points="70,20 130,100 10,100" fill="#8b4a3a" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>')


def icon_pipe():
    return S(140, 140, f'<path d="M20 100 L20 50 L90 50 L90 20" fill="none" stroke="{INK}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>'
             f'<path d="M20 100 L20 50 L90 50 L90 20" fill="none" stroke="#9aa5ad" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>')


def icon_boiler():
    return S(140, 160, box(30, 20, 80, 120, "#cfd6db", 14, 6) + f'<circle cx="70" cy="60" r="16" fill="#fff" stroke="{INK}" stroke-width="5"/>'
             f'<line x1="70" y1="60" x2="80" y2="50" stroke="#c22" stroke-width="4"/>' + f'<rect x="50" y="100" width="40" height="20" fill="#888" stroke="{INK}" stroke-width="4"/>')


def icon_bed():
    return S(180, 130, box(10, 50, 160, 50, "#7aa6d0", 8, 6) + box(18, 30, 50, 28, "#fff", 8, 5) + box(14, 100, 12, 24, "#6b4a2a", 2, 4) + box(154, 100, 12, 24, "#6b4a2a", 2, 4))


def icon_form():
    return S(120, 150, box(10, 10, 100, 130, "#fff", 8, 6) + "".join(f'<line x1="26" y1="{40+i*24}" x2="94" y2="{40+i*24}" stroke="{INK}" stroke-width="5"/>' for i in range(4)))


def icon_cross(size=200, color="#d4141e"):
    return S(size, size, f'<line x1="22" y1="22" x2="{size-22}" y2="{size-22}" stroke="{INK}" stroke-width="42" stroke-linecap="round"/>'
             f'<line x1="{size-22}" y1="22" x2="22" y2="{size-22}" stroke="{INK}" stroke-width="42" stroke-linecap="round"/>'
             f'<line x1="22" y1="22" x2="{size-22}" y2="{size-22}" stroke="{color}" stroke-width="28" stroke-linecap="round"/>'
             f'<line x1="{size-22}" y1="22" x2="22" y2="{size-22}" stroke="{color}" stroke-width="28" stroke-linecap="round"/>')


def icon_check(size=160):
    return S(size, size, f'<path d="M20 {size*0.55} L{size*0.4} {size*0.85} L{size-14} 24" fill="none" stroke="{INK}" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>'
             f'<path d="M20 {size*0.55} L{size*0.4} {size*0.85} L{size-14} 24" fill="none" stroke="{GREEN}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>')


def bubble(inner_svg_content, w=420, h=360):
    """Thought bubble; content is raw SVG elements drawn inside a 300x230 area."""
    return S(w, h, f'<ellipse cx="{w/2}" cy="{h*0.4}" rx="{w*0.46}" ry="{h*0.36}" fill="#fff" stroke="{INK}" stroke-width="7"/>'
             f'<circle cx="{w*0.36}" cy="{h*0.84}" r="20" fill="#fff" stroke="{INK}" stroke-width="6"/>'
             f'<circle cx="{w*0.3}" cy="{h*0.95}" r="11" fill="#fff" stroke="{INK}" stroke-width="5"/>' + inner_svg_content)


def phone(ring=True):
    waves = "".join(f'<path d="M{x} 40 Q{x+14} 80 {x} 120" fill="none" stroke="{INK}" stroke-width="6" stroke-linecap="round"/>' for x in (36, 8)) + \
            "".join(f'<path d="M{x} 40 Q{x-14} 80 {x} 120" fill="none" stroke="{INK}" stroke-width="6" stroke-linecap="round"/>' for x in (324, 352)) if ring else ""
    return S(360, 300, waves +
             f'<path d="M70 70 Q180 10 290 70 L270 110 Q180 70 90 110 Z" fill="#c22" stroke="{INK}" stroke-width="7"/>'
             + box(70, 120, 220, 110, "#c22", 24, 7) + f'<circle cx="180" cy="175" r="38" fill="#fff" stroke="{INK}" stroke-width="6"/>'
             + "".join(f'<circle cx="{180+30*__import__("math").cos(a)}" cy="{175+30*__import__("math").sin(a)}" r="4" fill="{INK}"/>' for a in [i * 0.9 for i in range(7)]))


def clock(text="2 AM", size=280, face="#fff"):
    import math
    ticks = "".join(f'<line x1="{140+108*math.cos(i*math.pi/6)}" y1="{140+108*math.sin(i*math.pi/6)}" x2="{140+122*math.cos(i*math.pi/6)}" y2="{140+122*math.sin(i*math.pi/6)}" stroke="{INK}" stroke-width="6"/>' for i in range(12))
    return S(280, 340, f'<circle cx="140" cy="140" r="130" fill="{face}" stroke="{INK}" stroke-width="9"/>' + ticks +
             f'<line x1="140" y1="140" x2="140" y2="55" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>'
             f'<line x1="140" y1="140" x2="205" y2="165" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>'
             f'<circle cx="140" cy="140" r="9" fill="#c22"/>' + T(140, 322, text, 56, "#fff" if face != "#fff" else INK, 900))


def building(windows_lit=True, tall=True, label=None):
    rows = 5 if tall else 3
    h = rows * 80 + 70
    win = "".join(box(30 + c * 76, 40 + r * 80, 50, 56, "#ffe27a" if windows_lit and (r + c) % 3 else "#7ea0b8", 4, 4) for r in range(rows) for c in range(3))
    return S(290, h + 20, box(10, 10, 270, h, "#b9a38d", 6, 7) + win + box(110, h - 56, 70, 66, "#6b4a2a", 4, 5) +
             (box(60, h - 108, 170, 36, "#fff", 6, 4) + T(145, h - 80, label, 24, INK, 900) if label else ""))


def toilet_bubble():
    return bubble(
        '<g transform="translate(110,60) scale(1.0)">' + icon_toilet()[0].split(">", 1)[1].rsplit("</svg>", 1)[0] + "</g>"
        + '<g transform="translate(230,60) scale(0.9)">' + icon_pipe()[0].split(">", 1)[1].rsplit("</svg>", 1)[0] + "</g>")


# ---------------------------------------------------------------- money
def bill_stack(n=3, label=None, w=420):
    inner = ""
    for i in range(n):
        y = 190 - i * 34
        inner += (box(20, y, 380, 56, "#7cc27c", 8, 6) + f'<rect x="38" y="{y+10}" width="344" height="36" fill="none" stroke="#2e6a2e" stroke-width="3"/>'
                  + f'<circle cx="210" cy="{y+28}" r="14" fill="#a5dca5" stroke="#2e6a2e" stroke-width="3"/>' + T(210, y + 36, "$", 22, "#2e6a2e", 900))
        inner += f'<rect x="170" y="{y}" width="80" height="56" fill="#f2b632" opacity="0.9" stroke="{INK}" stroke-width="4"/>' if i == n - 1 else ""
    if label:
        inner += T(210, 262, label, 44, INK, 900)
    return S(420, 280, inner)


def coin_tower(h=7):
    inner = ""
    for i in range(h):
        y = 330 - i * 34
        inner += f'<ellipse cx="150" cy="{y+14}" rx="86" ry="26" fill="#c9951c" stroke="{INK}" stroke-width="5"/><rect x="64" y="{y-8}" width="172" height="22" fill="#e9b52e"/>' \
                 f'<ellipse cx="150" cy="{y-8}" rx="86" ry="26" fill="#f6cf4a" stroke="{INK}" stroke-width="5"/>'
    return S(300, 380, inner + T(150, 330 - (h - 1) * 34 - 2, "$", 36, "#a87a10", 900))


def money_rain():
    import random
    r = random.Random(7)
    inner = ""
    for i in range(14):
        x, y, a = r.randint(20, 380), r.randint(10, 300), r.randint(-40, 40)
        inner += (f'<g transform="translate({x},{y}) rotate({a})">' + box(0, 0, 80, 44, "#7cc27c", 6, 5) + T(40, 32, "$", 28, "#2e6a2e", 900) + "</g>")
    return S(460, 380, inner)


def wallet_empty():
    return S(360, 300, f'<path d="M40 90 L320 90 L320 250 L40 250 Z" fill="#8a5a2b" stroke="{INK}" stroke-width="8" stroke-linejoin="round"/>'
             f'<path d="M40 90 L180 20 L320 90" fill="#a56d34" stroke="{INK}" stroke-width="8" stroke-linejoin="round"/>'
             + box(236, 140, 110, 70, "#b3793c", 14, 6) + f'<circle cx="270" cy="175" r="10" fill="#f2b632" stroke="{INK}" stroke-width="3"/>'
             + "".join(f'<path d="M{x} {y} q10 -10 20 0 q-10 10 -20 0" fill="#444"/>' for x, y in ((90, 140), (150, 180))))


def moths():
    return ""


# ---------------------------------------------------------------- docs / legal / auction
def contract(highlight="SELL AFTER NOTICE"):
    lines = "".join(f'<line x1="50" y1="{80+i*34}" x2="{330 if i%3 else 280}" y2="{80+i*34}" stroke="#777" stroke-width="5"/>' for i in range(10) if i != 4)
    return S(380, 500, box(20, 20, 340, 460, "#fff", 8, 7) + T(190, 58, "STORAGE CONTRACT", 24, INK, 900) + lines +
             f'<rect x="38" y="{80+4*34-22}" width="304" height="40" fill="#ffe94d" stroke="#d0b400" stroke-width="3"/>' + T(190, 80 + 4 * 34 + 8, highlight, 24, INK, 900) +
             f'<circle cx="300" cy="430" r="22" fill="none" stroke="#2e6da4" stroke-width="5"/>' + T(300, 438, "✓", 22, "#2e6da4", 900))


def judge_bench():
    return S(640, 480,
             f'<circle cx="320" cy="140" r="64" fill="#f2c9a0" stroke="{INK}" stroke-width="7"/>'
             f'<path d="M250 112 Q320 20 390 112 Q320 76 250 112 Z" fill="#ddd" stroke="{INK}" stroke-width="6"/>'
             f'<rect x="250" y="190" width="140" height="90" rx="20" fill="#2a2a2a" stroke="{INK}" stroke-width="6"/>'
             f'<circle cx="298" cy="136" r="7" fill="{INK}"/><circle cx="344" cy="136" r="7" fill="{INK}"/><path d="M296 168 Q320 156 346 168" fill="none" stroke="{INK}" stroke-width="6"/>'
             + box(60, 270, 520, 180, "#8a5a2b", 12, 8) + T(320, 380, "COURT", 54, "#f2d9a0", 900) +
             f'<rect x="480" y="250" width="70" height="26" rx="6" fill="#6b4a2a" stroke="{INK}" stroke-width="5"/>')


def stack_papers(n=5):
    return S(380, 300, "".join(f'<g transform="rotate({(i%3-1)*3} 190 260)"><rect x="40" y="{210 - i*34}" width="300" height="46" fill="#fff" stroke="{INK}" stroke-width="5"/>'
                                f'<line x1="60" y1="{228 - i*34}" x2="300" y2="{228 - i*34}" stroke="#999" stroke-width="4"/></g>' for i in range(n)))


def podium(sold="SOLD $900"):
    return S(480, 520,
             f'<path d="M80 200 L400 200 L430 500 L50 500 Z" fill="#8a5a2b" stroke="{INK}" stroke-width="8" stroke-linejoin="round"/>'
             + box(130, 250, 220, 90, "#f3ebd3", 10, 6) + T(240, 312, "AUCTION", 46, INK, 900) +
             f'<g transform="rotate(-25 330 150)"><rect x="270" y="120" width="130" height="50" rx="10" fill="#7a4f27" stroke="{INK}" stroke-width="6"/>'
             f'<rect x="320" y="165" width="22" height="110" fill="#a06a35" stroke="{INK}" stroke-width="6"/></g>')


def sold_banner(text="SOLD $900"):
    return S(460, 140, f'<g transform="rotate(-6 230 70)">' + box(20, 30, 420, 90, "#d22", 10, 7) + T(230, 96, text, 54, "#fff", 900) + "</g>")


def nets(n=4):
    inner = ""
    for i in range(n):
        x = 50 + i * 70
        inner += (f'<line x1="{x}" y1="380" x2="{x+50}" y2="80" stroke="{INK}" stroke-width="16" stroke-linecap="round"/>'
                  f'<line x1="{x}" y1="380" x2="{x+50}" y2="80" stroke="#c89b5a" stroke-width="8" stroke-linecap="round"/>'
                  f'<ellipse cx="{x+54}" cy="62" rx="52" ry="42" fill="#cfeaf5" opacity="0.8" stroke="{INK}" stroke-width="6"/>'
                  f'<path d="M{x+14} 54 L{x+94} 70 M{x+24} 36 L{x+84} 88 M{x+54} 22 L{x+54} 102" stroke="#6aa0b8" stroke-width="3"/>')
    return S(50 + n * 70 + 80, 400, inner)


def jellyfish(size=150):
    return S(size, size, f'<path d="M20 80 Q20 15 75 15 Q130 15 130 80 Z" fill="#f4a0d0" stroke="{INK}" stroke-width="6"/>'
             + "".join(f'<path d="M{x} 80 q6 14 -4 28 q-8 12 2 26" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>' for x in (38, 62, 86, 110))
             + f'<circle cx="55" cy="45" r="6" fill="#fff" opacity="0.7"/>')


# ---------------------------------------------------------------- people / map / misc
def person(color="#555", box_color=None, size=1.0, hat=None):
    inner = (f'<circle cx="60" cy="40" r="28" fill="#f2c9a0" stroke="{INK}" stroke-width="5"/>'
             f'<path d="M20 160 Q20 80 60 80 Q100 80 100 160 Z" fill="{color}" stroke="{INK}" stroke-width="5"/>'
             f'<circle cx="50" cy="36" r="4" fill="{INK}"/><circle cx="72" cy="36" r="4" fill="{INK}"/>')
    if hat:
        inner += f'<path d="M30 28 Q60 -10 90 28 Z" fill="{hat}" stroke="{INK}" stroke-width="5"/>'
    if box_color:
        inner += box(30, 100, 70, 52, box_color, 4, 5) + f'<line x1="65" y1="100" x2="65" y2="152" stroke="{INK}" stroke-width="4"/>'
    return S(120, 170, inner)


def queue(n=6, with_boxes=True):
    cols = ["#2e6da4", "#cf3b2c", "#3f8f5a", "#7d5ba6", "#d9742e", "#5e7d8a", "#444"]
    inner = ""
    for i in range(n):
        inner += (f'<g transform="translate({i*108},{(i%2)*10})">' + person(cols[i % 7], "#c9a06a" if with_boxes else None, hat="#d33" if i % 3 == 0 else None)[0].split(">", 1)[1].rsplit("</svg>", 1)[0] + "</g>")
    return S(n * 108 + 30, 190, inner)


def map_pins(n=3):
    inner = (f'<path d="M30 60 Q120 10 240 40 Q380 20 470 90 Q500 230 440 330 Q330 410 190 380 Q60 360 40 250 Q10 140 30 60 Z" fill="#cfe3b0" stroke="{INK}" stroke-width="8"/>'
             f'<path d="M60 150 Q200 110 300 190 T440 250" fill="none" stroke="#6aa0d0" stroke-width="12" stroke-linecap="round"/>')
    pos = [(120, 190), (300, 130), (330, 300), (160, 300), (420, 190), (230, 220)]
    for i in range(n):
        x, y = pos[i]
        inner += (f'<g transform="translate({x},{y})"><line x1="0" y1="0" x2="0" y2="-80" stroke="{INK}" stroke-width="7"/>'
                  f'<path d="M0 -80 L70 -62 L0 -44 Z" fill="#d22" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
                  + T(18, -57, str(i + 1), 20, "#fff", 900, "middle") + "</g>")
    return S(510, 420, inner)


def site_blocks(n=6):
    inner = ""
    for i in range(n):
        x, y = (i % 3) * 330, (i // 3) * 230
        inner += f'<g transform="translate({x},{y})">' + box(0, 40, 300, 160, "#cfe3b0", 14, 7) + "".join(
            f'<g transform="translate({20+(j%3)*88},{70+(j//3)*60}) scale(0.28)">' + container(color_idx=j + i, lock=False)[0].split(">", 1)[1].rsplit("</svg>", 1)[0] + "</g>"
            for j in range(6)) + box(100, 0, 100, 40, "#fff", 8, 5) + T(150, 31, f"SITE {i+1}", 22, INK, 900) + "</g>"
    return S(960, 480, inner)


def trophy_money():
    return coin_tower(5)


def mud_splash():
    return S(300, 100, "".join(f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r*0.6}" fill="#5b4028"/>' for x, y, r in
                               [(40, 60, 30), (110, 50, 22), (170, 64, 36), (240, 52, 20), (80, 78, 14), (210, 80, 16)]))


def thought_dollar():
    return bubble(T(210, 160, "$ $ $", 90, GREEN, 900))


def stars_burst(color="#ffe94d", n=12, size=300):
    import math
    pts = []
    for i in range(n * 2):
        r = size / 2 * (1 if i % 2 == 0 else 0.62)
        a = math.pi * i / n
        pts.append(f"{size/2 + r*math.cos(a):.1f},{size/2 + r*math.sin(a):.1f}")
    return S(size, size, f'<polygon points="{" ".join(pts)}" fill="{color}" opacity="0.85"/>')


def caption_title(text, size=84):
    return S(900, 240, "".join(T(30, 90 + i * (size + 10), ln, size, "#D8141E", 900, "start") for i, ln in enumerate(text.split("\n"))))


def notebook_waitlist():
    return S(420, 520, box(20, 20, 380, 480, "#fff", 12, 8) + T(210, 76, "WAITING LIST", 38, INK, 900) +
             "".join(f'<line x1="50" y1="{130+i*54}" x2="370" y2="{130+i*54}" stroke="#777" stroke-width="5"/>' + T(60, 122 + i * 54, f"{i+1}.", 24, "#444", 800, "start") for i in range(7)))
