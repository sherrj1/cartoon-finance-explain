"""Simulates how a 1080x1920 stream looks in the YouTube phone app: the player crops the sides (cover fit on a ~0.51 aspect
screen) and the app covers the top (~330 px) and the chat covers everything below ~1490. Red boxes mark the covered zones.
  python3 tools/phone-preview.py shots/03-drop-round1.png out.png"""
import sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
W, H = im.size
crop = 51
v = im.crop((crop, 0, W - crop, H))
d = ImageDraw.Draw(v, 'RGBA')
w = v.width
d.rectangle((0, 0, w, 100), fill=(255, 0, 0, 90))                     # status bar
d.rectangle((60, 150, 560, 250), fill=(255, 0, 0, 90))                # channel name
d.rectangle((690, 165, 850, 270), fill=(255, 0, 0, 90))               # bell
d.rectangle((40, 268, 260, 325), fill=(255, 0, 0, 90))                # claim xp
d.rectangle((0, 1495, w, H), fill=(255, 0, 0, 70))                    # live chat
v.save(out)
