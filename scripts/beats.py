# beats.py wav [t0 t1]: tempo + first downbeat estimate from the spectral-flux onset curve
import sys, wave, numpy as np
w = wave.open(sys.argv[1]); sr = w.getframerate(); ch = w.getnchannels()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32).reshape(-1, ch).mean(1) / 32768
t0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0; t1 = float(sys.argv[3]) if len(sys.argv) > 3 else len(x) / sr
x = x[int(t0 * sr):int(t1 * sr)]
hop = 256; win = 1024; fr = sr / hop
F = np.lib.stride_tricks.sliding_window_view(x, win)[::hop] * np.hanning(win)
S = np.log1p(np.abs(np.fft.rfft(F, axis=1)) * 20)
on = np.maximum(0, np.diff(S, axis=0)).sum(1); on -= np.convolve(on, np.ones(32) / 32, 'same'); on = np.maximum(on, 0)
best = None
for bpm in np.arange(80, 180, 0.05):
    period = fr * 60 / bpm
    # comb score: mean onset at beat phases, best phase
    n = int(len(on) / period) - 1
    idx = (np.arange(n)[:, None] * period + np.arange(0, period, 1)[None, :]).astype(int)
    sc = on[idx].mean(0)
    p = sc.argmax(); s = sc[p] / (sc.mean() + 1e-9)
    if best is None or s > best[0]: best = (s, bpm, p / fr)
s, bpm, ph = best
print(f"{sys.argv[1].split('/')[-1]}  {t0:.0f}-{t1:.0f}s  bpm {bpm:.2f}  first beat at {t0 + ph:.3f}s  strength {s:.2f}")
