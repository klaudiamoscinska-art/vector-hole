# GG-UI-02 stage 1: builds the vortex comparison from the recorded frames
# (design/ui2/vortex/frames): one animation and one film strip per skin, the
# variants side by side, every column the same frame of the same seeded round.
#   python3 design/ui2/tools/vortex-compose.py
import os, sys, glob
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
VX = os.path.join(HERE, '..', 'vortex')
FR = os.path.join(VX, 'frames')
LABELS = {'v0': 'W0 obecny', 'v1': 'W1 odwrócony', 'v2': 'W2 spójny lej', 'v3': 'W3 tylko gracz'}
SKIN_NAMES = {'rainbow': 'Horyzont', 'krysztal': 'Kryształ', 'pink': 'Gorący Róż', 'pryzmat': 'Pryzmat'}
def font(size):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()
def label(img, text, size=15):
    d = ImageDraw.Draw(img); f = font(size)
    w = d.textlength(text, font=f)
    d.rectangle([0, 0, w + 14, size + 10], fill=(4, 16, 29))
    d.text((7, 4), text, font=f, fill=(80, 240, 250))
    return img
for skin in SKIN_NAMES:
    vids = [v for v in LABELS if os.path.exists(os.path.join(FR, f'{skin}-{v}-00.png'))]
    if not vids: continue
    n = len(glob.glob(os.path.join(FR, f'{skin}-v0-*.png')))
    S = 260  # px per cell in the animation
    frames = []
    for f in range(n):
        row = Image.new('RGB', (S * len(vids) + 4 * (len(vids) - 1), S), (4, 16, 29))
        for i, v in enumerate(vids):
            im = Image.open(os.path.join(FR, f'{skin}-{v}-{f:02d}.png')).convert('RGB').resize((S, S), Image.LANCZOS)
            row.paste(label(im, LABELS[v], 13), (i * (S + 4), 0))
        frames.append(row)
    frames[0].save(os.path.join(VX, f'anim-{skin}.webp'), save_all=True, append_images=frames[1:], duration=66, loop=0, quality=68, method=4)
    # single-variant animations (for the gallery's own switcher)
    for v in vids:
        fs = [Image.open(os.path.join(FR, f'{skin}-{v}-{f:02d}.png')).convert('RGB').resize((300, 300), Image.LANCZOS) for f in range(n)]
        fs[0].save(os.path.join(VX, f'anim-{skin}-{v}.webp'), save_all=True, append_images=fs[1:], duration=66, loop=0, quality=70, method=4)
    # film strip: 6 frames, 3 apart (0.1 s), one row per variant
    pick = [8, 11, 14, 17, 20, 23]
    C = 200
    strip = Image.new('RGB', (C * len(pick) + 2 * (len(pick) - 1), (C + 2) * len(vids)), (4, 16, 29))
    for r, v in enumerate(vids):
        for c, f in enumerate(pick):
            im = Image.open(os.path.join(FR, f'{skin}-{v}-{f:02d}.png')).convert('RGB').resize((C, C), Image.LANCZOS)
            if c == 0: label(im, LABELS[v], 12)
            strip.paste(im, (c * (C + 2), r * (C + 2)))
    strip.save(os.path.join(VX, f'strip-{skin}.jpg'), quality=80)
    print('composed', skin, vids, n, 'frames')
