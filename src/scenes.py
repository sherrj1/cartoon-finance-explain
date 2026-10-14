"""Video 1 - 'Real Estate Investment P.1' (Mr. Krabs & the metal boxes). Dollar version.

Every narration line is cut into 2-4 picture beats (new Krabs look / reaction every ~1.5-2 s).
A beat = (display text, [layers], optional camera, optional background).
Krabs always comes from the supplied artwork, rigged in rig.py (moods = expressions).
"""
import itertools, re
from engine import L
import chars as C
import props as P

CX = 540
_phase = itertools.count()


def _ph():
    return (next(_phase) * 0.37) % 1.0


# --------------------------------------------------------------------------- Krabs looks
def KW(mood, x=CX, y=880, w=700, flip=False, **kw):
    """Waving Krabs (full body)."""
    return L(None, x, y, w, rig=("wave", mood), flip=flip, phase=_ph(), shadow=kw.pop("shadow", True), **kw)


def KWc(mood, flip=False, **kw):
    """Waving Krabs, close-up (face + shoulders fill the frame)."""
    return L(None, CX, 1010, 1000, rig=("wave", mood), flip=flip, phase=_ph(), **kw)


def KF(mood, x=CX, y=880, w=420, flip=False, **kw):
    """Claws-folded Krabs (full body)."""
    return L(None, x, y, w, rig=("fold", mood), flip=flip, phase=_ph(), shadow=kw.pop("shadow", True), **kw)


def KFc(mood, flip=False, **kw):
    """Claws-folded Krabs, face close-up."""
    return L(None, CX, 880, 760, rig=("fold", mood), flip=flip, phase=_ph(), **kw)


def KM(mood, x=CX, y=860, w=820, flip=False, **kw):
    """Krabs lying on a pile of cash."""
    return L(None, x, y, w, rig=("money", mood), flip=flip, phase=_ph(), **kw)


def SB(x, y, w=380, anim="pop", flip=False, **kw):
    return L(C.spongebob(flip=flip), x, y, w, anim=anim, shadow=True, wiggle=2.5, **kw)


def p(asset, x, y, w, **kw):
    return L(asset, x, y, w, **kw)


def X(x, y, w=240, **kw):
    return L(P.icon_cross(), x, y, w, anim="pop", **kw)


def _weights(text):
    out = 0.0
    for t in text.split():
        out += len(re.sub(r"\W", "", t)) + 2.0 + (2.5 if t[-1] in ".!?:" else 1.2 if t[-1] == "," else 0)
    return out


def scene(say, segs, text=None, **kw):
    """segs: [(display_text, [layers], cam=None, bg=None)]. Beat start = share of the words before it."""
    texts = [s[0] for s in segs]
    tot = sum(_weights(t) for t in texts)
    beats, beat_bgs, cum = [], {}, 0.0
    bg0 = (kw.get("bg", "day"), kw.get("ground"), kw.get("ground_y", 1080))
    for i, s in enumerate(segs):
        if i > 0:
            beats.append((cum / tot, s[1], s[2] if len(s) > 2 and s[2] else None))
            beat_bgs[i] = s[3] if len(s) > 3 and s[3] else (kw.get("bg", "day"), None, 1080)
        cum += _weights(s[0])
    beats = [(f, ls, c) if c else (f, ls) for f, ls, c in beats]
    d = dict(say=say, text=text or " ".join(texts), layers=segs[0][1], beats=beats, beat_bgs=beat_bgs,
             cam_seed=len(SCENES) * 2, **kw)
    if len(segs[0]) > 2 and segs[0][2]:
        d["first_cam"] = segs[0][2]
    return d


SCENES = []
DAY = ("day", None, 1080)


def add(*a, **k):
    SCENES.append(scene(*a, **k))


# 1 ---------------------------------------------------------------------------
add("Mr. Krabs knew the best way to build wealth was real estate.", [
    ("Mr. Krabs knew the best way", [p(P.coin_tower(7), 860, 800, 400, delay=0.3), p(P.icon_house(), 860, 420, 240, anim="drop", delay=0.8),
                                     KW("excited", 380, 900, 680),
                                     p(P.caption_title("Real Estate\nInvestment P.1"), 540, 330, 860, anim="fade")]),
    ("to build wealth was real estate.", [KM("greedy", CX, 850, 860), p(P.fx_sparkle(), 860, 520, 280, delay=0.3)]),
])
# 2
add("But he hated dealing with tenants.", [
    ("But he hated", [KFc("angry"), p(P.fx_anger(), 850, 420, 200, delay=0.25)]),
    ("dealing with tenants.", [p(P.queue(3, False), 640, 470, 760, anim="right", delay=0.1), KW("shock", 360, 1000, 600, flip=True),
                               p(P.fx_exclaim(), 760, 860, 120, delay=0.3)]),
])
# 3
add("Renting apartments is a headache.", [
    ("Renting apartments", [p(P.building(label="FOR RENT"), 800, 700, 360), KW("sad", 310, 940, 620)]),
    ("is a headache.", [KF("sad", CX, 870, 520), p(P.fx_sweat(), 800, 560, 130, delay=0.2), p(P.fx_zzz(), 280, 520, 200, delay=0.3)]),
])
# 4
add("Buy one, and your phone rings at two A.M., because the toilet exploded.", [
    ("Buy one, and your phone rings at 2 A.M.", [p(P.clock("2 AM", face="#222"), 220, 480, 330), p(P.phone(), 600, 820, 640, wiggle=3)]),
    ("because the toilet exploded.", [p(P.toilet_bubble(), CX, 500, 840, delay=0.0), KW("shock", CX, 1090, 500), p(P.fx_lines(), CX, 1000, 700, delay=0.2)]),
], bg="night")
# 5
add("So Mr. Krabs bought an empty patch of gravel behind a highway outside Dallas.", [
    ("So Mr. Krabs bought an empty patch of gravel", [p(P.sign(["EMPTY LOT", "DALLAS, TX"]), 820, 640, 380), KW("smug", 340, 880, 680)]),
    ("behind a highway outside Dallas.", [p(P.map_pins(1), CX, 620, 900), KF("scan", 300, 1130, 330, shadow=False)], "pan_l", DAY),
], ground="gravel", ground_y=1000)
# 6
add("No walls. No roof. No plumbing. Just mud and a fence.", [
    ("No walls. No roof.", [p(P.icon_wall(), 330, 470, 330), p(P.icon_roof(), 760, 470, 330, delay_f=0.4), X(330, 470, 330, delay_f=0.2), X(760, 470, 330, delay_f=0.6),
                            KF("angry", CX, 1010, 380)]),
    ("No plumbing.", [p(P.icon_pipe(), CX, 520, 420), X(CX, 520, 420, delay=0.3), KW("shock", CX, 1000, 520, flip=True)]),
    ("Just mud and a fence.", [p(P.mud_splash(), 300, 980, 380, delay=0.2), p(P.mud_splash(), 800, 1030, 320, delay=0.3), KFc("smug")], "in", ("day", "mud", 1200)),
], ground="mud", ground_y=1200)
# 7
add("He paid eighty thousand dollars.", [
    ("He paid", [KW("smug", CX, 900, 700, flip=True)]),
    ("$80,000.", [p(P.tag("$80,000", "MUDDY LOT"), CX, 560, 900, anim="drop"), KF("greedy", CX, 1040, 360)], "punch", ("day", "mud", 1250)),
], ground=None)
# 8
add("The seller thought it was worthless.", [
    ("The seller thought", [p(P.person("#555", None, hat="#333"), 280, 740, 420), p(P.thought_dollar(), 290, 380, 330, anim="none")]),
    ("it was worthless.", [p(P.sign(["SOLD"]), 790, 700, 380), KW("smug", 360, 940, 600, flip=True)]),
])
# 9
add("Mr. Krabs saw a gold mine.", [
    ("Mr. Krabs", [KFc("shock")]),
    ("saw a gold mine.", [p(P.stars_burst(), CX, 820, 900, anim="fade"), KM("greedy", CX, 860, 830), p(P.fx_sparkle(3), 880, 480, 300, delay=0.2)], "punch"),
])
# 10
add("He bought twenty steel shipping containers,", [
    ("He bought twenty", [KW("excited", CX, 900, 700)]),
    ("steel shipping containers,", [p(P.container_grid(4, 5), CX, 640, 900)]),
], ground="mud", ground_y=1150)
# 11
add("one gate, and a keypad.", [
    ("one gate,", [p(P.gate(), CX, 700, 900), KW("proud", 260, 1130, 380, shadow=False)]),
    ("and a keypad.", [p(P.gate(), 760, 560, 1100), KF("scan", 250, 1000, 360)], "pan_r"),
], ground="mud", ground_y=1050)
# 12
add("Total cost: forty-five thousand dollars.", [
    ("Total cost:", [KF("think", CX, 880, 520), p(P.fx_question(), 790, 560, 150, delay=0.2)]),
    ("$45,000.", [p(P.calc("TOTAL BUILD COST", "$45,000"), CX, 760, 560, anim="drop")], "punch"),
])
# 13
add("He rented them out as storage units, for a hundred and twenty dollars a month each.", [
    ("He rented them out as storage units,", [p(P.container("7"), CX, 700, 860), KW("happy", 260, 1130, 380, shadow=False)]),
    ("for $120 a month each.", [p(P.tag("$120", "PER MONTH"), CX, 620, 900), KF("greedy", CX, 1200, 480)], "punch"),
])
# 14
add("Within four months, all twenty were full.", [
    ("Within four months,", [p(P.months(4, 4), CX, 430, 900)]),
    ("all twenty were full.", [p(P.sign(["20 / 20", "FULL"]), 740, 700, 440), KW("excited", 330, 960, 640, flip=True)]),
])
# 15
add("Twenty units at a hundred and twenty dollars is twenty-four hundred dollars a month,", [
    ("Twenty units at $120", [p(P.container_grid(4, 5), CX, 600, 900), p(P.tag("20 x $120", "PER MONTH"), CX, 1020, 640, delay=0.3)]),
    ("is $2,400 a month,", [p(P.calc("MONTHLY REVENUE", "$2,400"), 720, 700, 470), KF("greedy", 290, 1000, 400)], "punch"),
])
# 16
add("from steel boxes sitting in the mud.", [
    ("from steel boxes", [p(P.container_grid(2, 3), CX, 580, 900)]),
    ("sitting in the mud.", [p(P.mud_splash(), 300, 1000, 380, delay=0.2), p(P.mud_splash(), 800, 1050, 320, delay=0.3), KW("smug", CX, 900, 640, flip=True)]),
], ground="mud", ground_y=1020)
# 17
add("No toilets. No complaints. Boxes don't call you when something breaks.", [
    ("No toilets.", [p(P.icon_toilet(False), CX, 520, 400), X(CX, 520, 400, delay=0.25), KW("angry", CX, 1060, 520)]),
    ("No complaints.", [p(P.icon_form(), CX, 520, 400), X(CX, 520, 400, delay=0.25), KF("angry", CX, 960, 420)]),
    ("Boxes don't call you when something breaks.", [p(P.phone(False), 600, 520, 520), X(600, 520, 420, delay=0.3), KW("smug", 340, 1000, 560)], "in"),
])
# 18
add("He also sold insurance for ten dollars a month, per unit.", [
    ("He also sold insurance", [p(P.sign(["INSURANCE", "$10 / MO"]), 440, 720, 520), KF("think", 830, 1000, 340)]),
    ("for $10 a month per unit.", [p(P.container(color_idx=3), CX, 600, 800), p(P.icon_check(), 800, 840, 240, delay=0.2), KW("happy", CX, 1160, 400, shadow=False)]),
])
# 19
add("Another two hundred dollars, for doing nothing.", [
    ("Another $200,", [p(P.bill_stack(4, "+$200 / MONTH"), CX, 560, 780)]),
    ("for doing nothing.", [KM("smug", CX, 860, 860), p(P.fx_zzz(), 860, 430, 220, delay=0.3)], "out"),
])
# 20
add("Then SpongeBob rented unit seven, to store four hundred jellyfish nets.", [
    ("Then SpongeBob rented unit 7,", [p(P.container("7", door="open"), 700, 780, 560), SB(250, 860, 420, anim="left")]),
    ("to store 400 jellyfish nets.", [p(P.nets(4), CX, 620, 820), SB(300, 1040, 380, flip=True), KW("scan", 800, 1100, 340, shadow=False)]),
])
# 21
add("In month three, SpongeBob stopped paying.", [
    ("In month three,", [p(P.calendar("MONTH 3", "RENT DUE"), 760, 720, 470), KF("think", 280, 960, 380)]),
    ("SpongeBob stopped paying.", [p(P.wallet_empty(), 780, 560, 420), SB(290, 860, 440, flip=True), p(P.fx_question(), 560, 450, 140, delay=0.4)], "pan_l"),
])
# 22
add("With an apartment tenant, that means lawyers, court dates, and months of waiting.", [
    ("With an apartment tenant,", [p(P.building(label="FOR RENT"), 780, 700, 360), KW("sad", 320, 950, 600)]),
    ("that means lawyers, court dates,", [p(P.judge_bench(), CX, 620, 900), p(P.stack_papers(5), 270, 1060, 420, delay=0.4)]),
    ("and months of waiting.", [p(P.clock("MONTHS", face="#fff"), 760, 620, 520), KF("sad", 300, 920, 440), p(P.fx_sweat(), 520, 600, 130, delay=0.2)], "out"),
])
# 23
add("But storage is different. The contract lets the owner sell the contents after written notice.", [
    ("But storage is different.", [KFc("smug", flip=True)]),
    ("The contract lets the owner", [p(P.contract(), 300, 720, 520), KW("proud", 780, 900, 640, flip=True)]),
    ("sell the contents after written notice.", [p(P.contract(), CX, 700, 780, wiggle=2), p(P.fx_sparkle(), 840, 400, 220, delay=0.3)], "punch"),
])
# 24
add("Mr. Krabs sent three letters. The last one gave SpongeBob fourteen days to pay.", [
    ("Mr. Krabs sent three letters.", [p(P.envelope("", True, "#fff", badge="1"), 190, 560, 330), p(P.envelope("", True, "#fff", badge="2"), 540, 560, 330, delay_f=0.3),
                                      p(P.envelope("", True, "#fff", badge="3"), 890, 560, 330, delay_f=0.6), KW("excited", CX, 1050, 500)]),
    ("The last one gave", [p(P.envelope("14 DAYS", True, "#ffd9d4", badge="3"), CX, 620, 860)], "punch"),
    ("SpongeBob 14 days to pay.", [SB(CX, 900, 460), KF("angry", 830, 1000, 330)]),
])
# 25
add("Nobody came.", [
    ("Nobody", [p(P.clock("NO SHOW", face="#fff"), 820, 440, 320), KF("scan", 330, 900, 460)]),
    ("came.", [KW("sad", CX, 880, 700), p(P.fx_sweat(), 790, 540, 140, delay=0.2)]),
])
# 26
add("So Mr. Krabs held an auction. The nets sold for nine hundred dollars.", [
    ("So Mr. Krabs held an auction.", [KW("excited", CX, 700, 640), p(P.podium(), CX, 1060, 720)]),
    ("The nets sold for $900.", [p(P.nets(4), 280, 640, 520), p(P.sold_banner("SOLD $900"), 700, 560, 760, anim="drop"), KF("greedy", 760, 1050, 380)], "punch"),
])
# 27
add("He kept the three hundred sixty dollars owed, and sent the five hundred forty dollar surplus back to SpongeBob.", [
    ("He kept the $360 owed,", [p(P.bill_stack(2, "$360 KEPT"), CX, 540, 760), KW("smug", CX, 1130, 460, shadow=False)]),
    ("and sent the $540 surplus", [p(P.bill_stack(4, "$540 BACK"), CX, 560, 760), KF("proud", CX, 1130, 330, shadow=False)]),
    ("back to SpongeBob.", [SB(CX, 780, 560), p(P.fx_sparkle(), 820, 480, 240, delay=0.3)]),
])
# 28
add("By the next morning, unit seven had a new tenant.", [
    ("By the next morning,", [p(P.clock("8 AM", face="#fff"), CX, 600, 520), KF("happy", 760, 1000, 380)]),
    ("unit 7 had a new tenant.", [p(P.container("7", door="open"), CX, 560, 760), p(P.queue(2), CX, 1000, 560, delay=0.3)]),
])
# 29
add("Then Mr. Krabs noticed the waiting list. So he built twenty more units.", [
    ("Then Mr. Krabs noticed the waiting list.", [p(P.notebook_waitlist(), 330, 720, 520), KW("scan", 800, 980, 520, flip=True)]),
    ("So he built twenty more units.", [p(P.container_grid(2, 3), CX, 640, 900), KF("greedy", CX, 1170, 380)]),
])
# 30
add("Then a second site. Then a third.", [
    ("Then a second site.", [p(P.map_pins(2), CX, 660, 900), KW("happy", 280, 1150, 380, shadow=False)]),
    ("Then a third.", [p(P.map_pins(3), CX, 660, 900, anim="none"), KF("excited", 820, 1130, 330, shadow=False)], "punch"),
])
# 31
add("Today he owns six sites, a hundred and forty units, and earns nineteen thousand six hundred dollars every single month.", [
    ("Today he owns six sites,", [p(P.site_blocks(6), CX, 640, 900)]),
    ("140 units, and earns", [p(P.container_grid(4, 5), CX, 600, 900), KW("proud", CX, 1130, 420, shadow=False)]),
    ("$19,600", [p(P.tag("$19,600", "PER MONTH"), CX, 620, 900, anim="drop"), KF("greedy", CX, 1190, 420)], "punch"),
    ("every single month.", [p(P.money_rain(), CX, 560, 1100, anim="drop"), KM("greedy", CX, 900, 820)]),
])
# 32
add("No boilers. No leaking roofs. No bedrooms.", [
    ("No boilers.", [p(P.icon_boiler(), CX, 500, 340), X(CX, 500, 340, delay=0.2), KW("smug", CX, 1050, 520, flip=True)]),
    ("No leaking roofs.", [p(P.icon_roof(), CX, 500, 340), X(CX, 500, 340, delay=0.2), KF("angry", CX, 950, 400)]),
    ("No bedrooms.", [p(P.icon_bed(), CX, 520, 400), X(CX, 520, 400, delay=0.2), KW("happy", CX, 1050, 520)]),
])
# 33
add("Mr. Krabs just owns metal boxes in the mud.", [
    ("Mr. Krabs just owns", [p(P.container(color_idx=2), 700, 700, 760), KW("proud", 360, 900, 680)]),
    ("metal boxes in the mud.", [p(P.container_grid(2, 3), CX, 600, 900), p(P.mud_splash(), 560, 1050, 360), KF("smug", CX, 1100, 360, shadow=False)]),
], ground="mud", ground_y=1180)
# 34
add("And those boxes pay for everything.", [
    ("And those boxes", [p(P.container_grid(2, 3), CX, 620, 900), KW("smug", CX, 1090, 520, shadow=False)]),
    ("pay for everything.", [p(P.money_rain(), CX, 560, 1100, anim="drop"), KM("greedy", CX, 900, 820), SB(170, 1120, 280, delay=0.3)], "punch"),
])
# end card
SCENES.append(dict(end_card="Part 2 coming soon", say=None, text="", layers=[]))
