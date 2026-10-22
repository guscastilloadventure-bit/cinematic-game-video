# bars.py wav bpm anchor: per-beat loudness map, one row per bar, bars counted from the anchor downbeat
import sys, wave, numpy as np
w = wave.open(sys.argv[1]); sr = w.getframerate(); ch = w.getnchannels()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32).reshape(-1, ch).mean(1) / 32768
bpm, anchor = float(sys.argv[2]), float(sys.argv[3]); B = 60 / bpm
# low band (kick/bass) via a simple one-pole lowpass
lo = np.zeros_like(x); a = np.exp(-2 * np.pi * 150 / sr); acc = 0.0
from scipy.signal import lfilter
lo = lfilter([1 - a], [1, -a], x)
first = anchor - np.floor(anchor / (4 * B)) * 4 * B
nb = int((len(x) / sr - first) / B)
chars = ' .:-=+*#%@'
print(f'bar   time  | per beat: full-band level (1-4) / low-band level (1-4)')
for bar in range(nb // 4):
    row, lrow = '', ''
    for k in range(4):
        t = first + (bar * 4 + k) * B
        seg = x[int(t * sr):int((t + B) * sr)]; ls = lo[int(t * sr):int((t + B) * sr)]
        if len(seg) == 0: break
        d = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9); dl = 20 * np.log10(np.sqrt(np.mean(ls ** 2)) + 1e-9)
        row += chars[max(0, min(9, int((d + 30) / 3)))]; lrow += chars[max(0, min(9, int((dl + 36) / 3)))]
    rel = bar - round((anchor - first) / (4 * B))
    print(f'{rel:4d} {first + bar * 4 * B:6.2f}  |{row}|{lrow}|')
