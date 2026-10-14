"""Video 1 - 'Real Estate Investment P.1' (Mr. Krabs & the metal boxes). Dollar version."""
from engine import L
import chars as C
import props as P

CX = 540


def K(x=CX, y=820, w=760, **kw):
    anim = kw.pop("anim", "pop")
    delay = kw.pop("delay", 0.0)
    delay_f = kw.pop("delay_f", None)
    asset = C.krabs(**kw)
    # keep the whole sprite (claws included) inside the visible frame, even after the zoom
    factor = asset[2]
    maxw = 2 * min(x - 110, 1080 - 110 - x)
    if w * factor > maxw:
        w = maxw / factor
    return L(asset, x, y, w, anim=anim, delay=delay, delay_f=delay_f, bob=6, shadow=True)


def SB(x, y, w=380, anim="pop", delay=0.0, delay_f=None, flip=False):
    return L(C.spongebob(flip=flip), x, y, w, anim=anim, delay=delay, delay_f=delay_f, bob=6, shadow=True)


def X(x, y, w=240, **kw):
    """Red cross overlay."""
    return L(P.icon_cross(), x, y, w, anim="pop", **kw)


def prop(asset, x, y, w, **kw):
    return L(asset, x, y, w, **kw)


SCENES = [
    # 1 hook + title
    dict(say="Mr. Krabs knew the best way to build wealth was real estate.",
         text="Mr. Krabs knew the best way to build wealth was real estate.",
         layers=[prop(P.coin_tower(7), 840, 780, 400, delay=0.3), prop(P.icon_house(), 840, 400, 240, anim="drop", delay=0.9),
                 K(380, 900, 700, pose="point", mouth="smile", lid=0.15),
                 prop(P.caption_title("Real Estate\nInvestment P.1"), 540, 330, 860, anim="fade", until=2.8)]),
    # 2
    dict(say="But he hated dealing with tenants.", text="But he hated dealing with tenants.",
         layers=[prop(P.queue(3, False), 700, 470, 760, anim="right", delay=0.3),
                 K(CX, 1000, 720, pose="hips", mouth="frown", lid=0.45, tilt=10, sweat=True)]),
    # 3
    dict(say="Renting apartments is a headache.", text="Renting apartments is a headache.",
         layers=[prop(P.building(label="FOR RENT"), 800, 700, 360), K(310, 940, 700, pose="shrug", mouth="frown", lid=0.35, sweat=True)]),
    # 4
    dict(say="Buy one, and your phone rings at two A.M., because the toilet exploded.",
         text="Buy one, and your phone rings at 2 A.M. because the toilet exploded.", bg="night",
         layers=[prop(P.clock("2 AM", face="#222"), 220, 480, 330), prop(P.phone(), 600, 820, 640, wiggle=3),
                 prop(P.toilet_bubble(), 780, 380, 560, delay_f=0.55)]),
    # 5
    dict(say="So Mr. Krabs bought an empty patch of gravel behind a highway outside Dallas.",
         text="So Mr. Krabs bought an empty patch of gravel behind a highway outside Dallas.", ground="gravel", ground_y=1000,
         layers=[prop(P.sign(["EMPTY LOT", "DALLAS, TX"]), 820, 640, 380), K(330, 880, 700, pose="gesture", mouth="smile", lid=0.1)]),
    # 6
    dict(say="No walls. No roof. No plumbing. Just mud and a fence.", text="No walls. No roof. No plumbing. Just mud and a fence.",
         ground="mud", ground_y=1200,
         layers=[prop(P.icon_wall(), 230, 470, 250), prop(P.icon_roof(), 540, 470, 250, delay_f=0.18), prop(P.icon_pipe(), 850, 470, 250, delay_f=0.36),
                 X(230, 470, delay_f=0.12), X(540, 470, delay_f=0.30), X(850, 470, delay_f=0.48),
                 K(CX, 960, 640, pose="hips", mouth="smirk", lid=0.3, delay_f=0.6)]),
    # 7
    dict(say="He paid eighty thousand dollars.", text="He paid $80,000.", ground="mud", ground_y=1250,
         layers=[prop(P.tag("$80,000", "MUDDY LOT"), 540, 560, 900, anim="drop"), K(CX, 1020, 600, pose="rub", mouth="smile", delay_f=0.4)]),
    # 8
    dict(say="The seller thought it was worthless.", text="The seller thought it was worthless.",
         layers=[prop(P.person("#555", None, hat="#333"), 280, 740, 420), prop(P.sign(["SOLD"]), 780, 700, 380, delay_f=0.3),
                 prop(P.thought_dollar(), 290, 380, 330, anim="none")]),
    # 9
    dict(say="Mr. Krabs saw a gold mine.", text="Mr. Krabs saw a gold mine.",
         layers=[prop(P.stars_burst(), CX, 820, 900, anim="fade"), K(CX, 840, 780, pose="up", mouth="grin", dollar=True)]),
    # 10
    dict(say="He bought twenty steel shipping containers,", text="He bought twenty steel shipping containers,", ground="mud", ground_y=1150,
         layers=[prop(P.container_grid(4, 5), CX, 640, 900)]),
    # 11
    dict(say="one gate, and a keypad.", text="One gate, and a keypad.", ground="mud", ground_y=1050,
         layers=[prop(P.gate(), CX, 700, 900)]),
    # 12
    dict(say="Total cost: forty-five thousand dollars.", text="Total cost: $45,000.",
         layers=[prop(P.calc("TOTAL BUILD COST", "$45,000"), CX, 760, 560, anim="drop")]),
    # 13
    dict(say="He rented them out as storage units, for a hundred and twenty dollars a month each.",
         text="He rented them out as storage units for $120 a month each.",
         layers=[prop(P.container("7"), CX, 560, 700), prop(P.tag("$120", "PER MONTH"), CX, 940, 700, delay_f=0.5)]),
    # 14
    dict(say="Within four months, all twenty were full.", text="Within four months, all twenty were full.",
         layers=[prop(P.months(4, 4), CX, 430, 900), prop(P.sign(["20 / 20", "FULL"]), CX, 920, 440, delay_f=0.6)]),
    # 15
    dict(say="Twenty units at a hundred and twenty dollars is twenty-four hundred dollars a month,",
         text="Twenty units at $120 is $2,400 a month,",
         layers=[prop(P.calc("MONTHLY REVENUE", "$2,400"), 700, 700, 470), K(290, 1000, 600, pose="rub", mouth="grin", delay_f=0.2)]),
    # 16
    dict(say="from steel boxes sitting in the mud.", text="from steel boxes sitting in the mud.", ground="mud", ground_y=1020,
         layers=[prop(P.container_grid(2, 3), CX, 580, 900), prop(P.mud_splash(), 300, 1000, 380, delay_f=0.4), prop(P.mud_splash(), 800, 1050, 320, delay_f=0.5)]),
    # 17
    dict(say="No toilets. No complaints. Boxes don't call you when something breaks.",
         text="No toilets. No complaints. Boxes don't call you when something breaks.",
         layers=[prop(P.icon_toilet(False), 230, 440, 230), prop(P.icon_form(), 540, 440, 230, delay_f=0.12), prop(P.phone(False), 850, 440, 260, delay_f=0.3),
                 X(230, 440, delay_f=0.10), X(540, 440, delay_f=0.22), X(850, 440, delay_f=0.46),
                 K(CX, 960, 620, pose="cross", mouth="smirk", lid=0.45, tilt=4, delay_f=0.55)]),
    # 18
    dict(say="He also sold insurance for ten dollars a month, per unit.", text="He also sold insurance for $10 a month per unit.",
         layers=[prop(P.sign(["INSURANCE", "$10 / MO"]), 440, 720, 520), prop(P.icon_check(), 800, 560, 200, delay_f=0.5)]),
    # 19
    dict(say="Another two hundred dollars, for doing nothing.", text="Another $200, for doing nothing.",
         layers=[prop(P.bill_stack(4, "+$200 / MONTH"), CX, 520, 760), K(CX, 1170, 600, pose="cross", mouth="smirk", lid=0.55, delay_f=0.35)]),
    # 20
    dict(say="Then SpongeBob rented unit seven, to store four hundred jellyfish nets.",
         text="Then SpongeBob rented unit 7 to store 400 jellyfish nets.",
         layers=[prop(P.container("7", door="open"), 700, 780, 560), prop(P.nets(4), 860, 440, 360, delay_f=0.55), SB(250, 860, 420, anim="left")]),
    # 21
    dict(say="In month three, SpongeBob stopped paying.", text="In month three, SpongeBob stopped paying.",
         layers=[prop(P.wallet_empty(), 780, 560, 420), prop(P.calendar("MONTH 3", "RENT DUE"), 800, 1000, 340, delay_f=0.4), SB(290, 840, 440, flip=True)]),
    # 22
    dict(say="With an apartment tenant, that means lawyers, court dates, and months of waiting.",
         text="With an apartment tenant, that means lawyers, court dates, and months of waiting.",
         layers=[prop(P.judge_bench(), CX, 520, 900), prop(P.stack_papers(5), 270, 1030, 420, delay_f=0.45), prop(P.clock("MONTHS", face="#fff"), 830, 980, 270, delay_f=0.6)]),
    # 23
    dict(say="But storage is different. The contract lets the owner sell the contents after written notice.",
         text="But storage is different. The contract lets the owner sell the contents after written notice.",
         layers=[prop(P.contract(), 300, 720, 520), K(790, 860, 640, pose="gesture", mouth="smirk", lid=0.25, delay_f=0.4)]),
    # 24
    dict(say="Mr. Krabs sent three letters. The last one gave SpongeBob fourteen days to pay.",
         text="Mr. Krabs sent three letters. The last one gave SpongeBob 14 days to pay.",
         layers=[prop(P.envelope("", True, "#fff", badge="1"), 190, 520, 330), prop(P.envelope("", True, "#fff", badge="2"), 540, 520, 330, delay_f=0.2),
                 prop(P.envelope("14 DAYS", True, "#ffd9d4", badge="3"), 890, 520, 330, delay_f=0.38),
                 K(CX, 1020, 520, pose="point", mouth="smile", delay_f=0.55)]),
    # 25
    dict(say="Nobody came.", text="Nobody came.",
         layers=[prop(P.clock("NO SHOW", face="#fff"), 860, 440, 300), K(CX, 860, 780, pose="shrug", mouth="flat", lid=0.5, sweat=True)]),
    # 26
    dict(say="So Mr. Krabs held an auction. The nets sold for nine hundred dollars.",
         text="So Mr. Krabs held an auction. The nets sold for $900.",
         layers=[K(CX, 700, 640, pose="up", mouth="grin"), prop(P.podium(), CX, 1060, 720), prop(P.sold_banner("SOLD $900"), CX, 300, 700, anim="drop", delay_f=0.6)]),
    # 27
    dict(say="He kept the three hundred sixty dollars owed, and sent the five hundred forty dollar surplus back to SpongeBob.",
         text="He kept the $360 owed, and sent the $540 surplus back to SpongeBob.",
         layers=[prop(P.bill_stack(2, "$360 KEPT"), 290, 540, 470), prop(P.bill_stack(4, "$540 BACK"), 790, 540, 470, delay_f=0.45),
                 K(290, 980, 520, pose="gesture", mouth="smile", delay_f=0.1), SB(800, 960, 360, delay_f=0.6)]),
    # 28
    dict(say="By the next morning, unit seven had a new tenant.", text="By the next morning, unit 7 had a new tenant.",
         layers=[prop(P.container("7", door="open"), CX, 560, 760), prop(P.queue(2), CX, 1000, 560, delay_f=0.35)]),
    # 29
    dict(say="Then Mr. Krabs noticed the waiting list. So he built twenty more units.",
         text="Then Mr. Krabs noticed the waiting list. So he built twenty more units.",
         layers=[prop(P.notebook_waitlist(), 290, 700, 450), prop(P.container_grid(2, 3), 770, 700, 520, delay_f=0.5), K(CX, 1140, 380, pose="rub", mouth="grin", delay_f=0.2)]),
    # 30
    dict(say="Then a second site. Then a third.", text="Then a second site. Then a third.",
         layers=[prop(P.map_pins(1), CX, 700, 900, until_f=0.38), prop(P.map_pins(2), CX, 700, 900, delay_f=0.38, until_f=0.7, anim="none"),
                 prop(P.map_pins(3), CX, 700, 900, delay_f=0.7, anim="none")]),
    # 31
    dict(say="Today he owns six sites, a hundred and forty units, and earns nineteen thousand six hundred dollars every single month.",
         text="Today he owns six sites, 140 units, and earns $19,600 every single month.",
         layers=[prop(P.site_blocks(6), CX, 470, 900), prop(P.tag("$19,600", "PER MONTH"), CX, 1000, 800, delay_f=0.55)]),
    # 32
    dict(say="No boilers. No leaking roofs. No bedrooms.", text="No boilers. No leaking roofs. No bedrooms.",
         layers=[prop(P.icon_boiler(), 230, 440, 220), prop(P.icon_roof(), 540, 440, 230, delay_f=0.2), prop(P.icon_bed(), 850, 440, 260, delay_f=0.4),
                 X(230, 440, delay_f=0.14), X(540, 440, delay_f=0.34), X(850, 440, delay_f=0.54),
                 K(CX, 960, 620, pose="cross", mouth="smirk", lid=0.4, delay_f=0.6)]),
    # 33
    dict(say="Mr. Krabs just owns metal boxes in the mud.", text="Mr. Krabs just owns metal boxes in the mud.", ground="mud", ground_y=1180,
         layers=[prop(P.container(color_idx=2), 700, 700, 760), K(360, 930, 700, pose="hips", mouth="smirk", lid=0.3), prop(P.mud_splash(), 560, 1220, 360)]),
    # 34
    dict(say="And those boxes pay for everything.", text="And those boxes pay for everything.",
         layers=[prop(P.money_rain(), CX, 560, 1100, anim="drop"), K(CX, 900, 760, pose="up", mouth="grin", dollar=True, delay_f=0.2), SB(180, 1120, 280, delay_f=0.5)]),
    # end card
    dict(end_card="Part 2 coming soon", say=None, text="", layers=[]),
]


# ---------------------------------------------------------------------------
# Long narration lines get a second (or third) picture, like the source videos
# cut every ~2 seconds. beats = [(fraction_of_scene, layers)].
def _beats(i, beats, base=None, bgs=None):
    if base is not None:
        SCENES[i]["layers"] = base
    SCENES[i]["beats"] = beats
    if bgs:
        SCENES[i]["beat_bgs"] = bgs


_beats(3, [(0.5, [prop(P.toilet_bubble(), CX, 520, 820), K(CX, 1080, 540, pose="up", mouth="open", sweat=True)])],
       base=[prop(P.clock("2 AM", face="#222"), 220, 480, 330), prop(P.phone(), 600, 820, 640, wiggle=3)],
       bgs={1: ("night", None, 1080)})
_beats(4, [(0.5, [prop(P.map_pins(1), CX, 640, 900)])],
       base=[prop(P.sign(["EMPTY LOT", "DALLAS, TX"]), 820, 640, 380), K(330, 880, 700, pose="gesture", mouth="smile", lid=0.1)])
_beats(12, [(0.5, [prop(P.tag("$120", "PER MONTH"), CX, 620, 900), K(CX, 1200, 480, pose="rub", mouth="smile")])],
       base=[prop(P.container("7"), CX, 700, 860)])
_beats(14, [(0.45, [prop(P.calc("MONTHLY REVENUE", "$2,400"), 700, 700, 470), K(290, 1000, 600, pose="rub", mouth="grin")])],
       base=[prop(P.container_grid(4, 5), CX, 600, 900), prop(P.tag("20 x $120", "PER MONTH"), CX, 1020, 640, delay_f=0.3)])
_beats(16, [(0.62, [K(CX, 860, 760, pose="cross", mouth="smirk", lid=0.45, tilt=4)])],
       base=[prop(P.icon_toilet(False), 230, 540, 260), prop(P.icon_form(), 540, 540, 260, delay_f=0.12), prop(P.phone(False), 850, 540, 290, delay_f=0.3),
             X(230, 540, 280, delay_f=0.10), X(540, 540, 280, delay_f=0.22), X(850, 540, 280, delay_f=0.46)])
_beats(19, [(0.5, [prop(P.nets(4), CX, 620, 820), SB(300, 1040, 380, flip=True)])],
       base=[prop(P.container("7", door="open"), 700, 780, 560), SB(250, 860, 420, anim="left")])
_beats(21, [(0.55, [prop(P.clock("MONTHS", face="#fff"), CX, 620, 600), prop(P.stack_papers(6), CX, 1000, 760, delay_f=0.2)])],
       base=[prop(P.judge_bench(), CX, 620, 900), prop(P.stack_papers(5), 270, 1060, 420, delay_f=0.4)])
_beats(22, [(0.5, [prop(P.contract(), CX, 700, 760, wiggle=2)])],
       base=[prop(P.container(color_idx=1), 300, 640, 520), K(760, 900, 700, pose="gesture", mouth="smirk", lid=0.25)])
_beats(23, [(0.62, [prop(P.envelope("14 DAYS", True, "#ffd9d4", badge="3"), CX, 640, 860), SB(CX, 1080, 360, flip=True)])],
       base=[prop(P.envelope("", True, "#fff", badge="1"), 190, 560, 330), prop(P.envelope("", True, "#fff", badge="2"), 540, 560, 330, delay_f=0.2),
             prop(P.envelope("", True, "#ffd9d4", badge="3"), 890, 560, 330, delay_f=0.4)])
_beats(25, [(0.55, [prop(P.nets(4), CX, 520, 700), prop(P.sold_banner("SOLD $900"), CX, 960, 860, anim="drop")])],
       base=[K(CX, 700, 640, pose="up", mouth="grin"), prop(P.podium(), CX, 1060, 720)])
_beats(26, [(0.5, [prop(P.bill_stack(4, "$540 BACK"), CX, 560, 760), SB(CX, 1100, 360)])],
       base=[prop(P.bill_stack(2, "$360 KEPT"), CX, 540, 760), K(CX, 1190, 500, pose="gesture", mouth="smile")])
_beats(28, [(0.5, [prop(P.container_grid(2, 3), CX, 640, 900), K(CX, 1160, 380, pose="rub", mouth="grin")])],
       base=[prop(P.notebook_waitlist(), CX, 700, 560)])
_beats(30, [(0.4, [prop(P.tag("$19,600", "PER MONTH"), CX, 620, 900), K(CX, 1200, 440, pose="up", mouth="grin", dollar=True)]),
            (0.72, [prop(P.money_rain(), CX, 560, 1100, anim="drop"), K(CX, 900, 760, pose="up", mouth="grin", dollar=True, delay_f=0.2)])],
       base=[prop(P.site_blocks(6), CX, 640, 900)])
