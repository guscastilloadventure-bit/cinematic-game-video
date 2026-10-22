# grid.py out.jpg cols w img...  -> contact sheet with file names
import sys
from PIL import Image, ImageDraw
out, cols, w, files = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in files]
h = round(w * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * w, rows * h), (20, 20, 20))
d = ImageDraw.Draw(S)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * w, (i // cols) * h
    S.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    d.text((x + 6, y + 4), f.split('/')[-1], fill=(255, 255, 0))
S.save(out, quality=85)
