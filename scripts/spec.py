# spec.py out.png wav... : stacked log-frequency spectrograms (0-12 kHz), loudness curve, 5 s ticks. Env: PXS (px per s), T0, T1 (s)
import sys, wave, numpy as np
from PIL import Image, ImageDraw
def load(p):
    w = wave.open(p); n = w.getnframes(); sr = w.getframerate(); ch = w.getnchannels()
    x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32).reshape(-1, ch).mean(1) / 32768
    return x, sr
out, files = sys.argv[1], sys.argv[2:]
import os
PXS = int(os.environ.get('PXS', 8))  # pixels per second
T0 = float(os.environ.get('T0', 0)); T1 = float(os.environ.get('T1', 1e9))
rows = []
for p in files:
    x, sr = load(p); x = x[int(T0 * sr):int(min(T1, len(x) / sr) * sr)]; dur = len(x) / sr
    hop = sr // PXS; win = 8192
    nfr = int(dur * PXS)
    fr = np.stack([x[i * hop:i * hop + win] if i * hop + win <= len(x) else np.zeros(win) for i in range(nfr)]) * np.hanning(win)
    S = np.abs(np.fft.rfft(fr, axis=1)); f = np.fft.rfftfreq(win, 1 / sr)
    edges = np.geomspace(120, 12000, 121)
    B = np.stack([S[:, (f >= a) & (f < b)].mean(1) for a, b in zip(edges[:-1], edges[1:])], 1)
    B = np.nan_to_num(B, nan=1e-7); D = 20 * np.log10(B + 1e-7); D = np.clip((D - D.max() + 70) / 70, 0, 1)
    img = (np.flipud(D.T) * 255).astype(np.uint8)
    im = Image.fromarray(img).convert('RGB'); d = ImageDraw.Draw(im)
    rms = np.sqrt((fr ** 2).mean(1)); db = 20 * np.log10(rms + 1e-9)
    pts = [(i, int(119 - np.clip((v + 40) / 40, 0, 1) * 119)) for i, v in enumerate(db)]
    d.line(pts, fill=(255, 210, 0), width=1)
    for s in range(0, int(dur), 5): d.line([(s * PXS, 0), (s * PXS, 6)], fill=(0, 255, 255)); d.text((s * PXS + 2, 0), str(int(s + T0)), fill=(0, 255, 255))
    lab = Image.new('RGB', (im.width, 14), (30, 30, 30)); ImageDraw.Draw(lab).text((4, 1), p.split('/')[-1], fill=(255, 255, 255))
    rows += [lab, im]
W = max(r.width for r in rows); H = sum(r.height for r in rows)
S = Image.new('RGB', (W, H)); y = 0
for r in rows: S.paste(r, (0, y)); y += r.height
S.save(out)
