# mix.py <config.json>: the film's soundtrack -> a 48 kHz 16-bit stereo WAV. Needs numpy + scipy (use a venv).
# 1. Music: a recorded track cut into parts on its bar grid and laid on the film's beat grid, with short equal-power
#    crossfades at each splice (cut on downbeats, jump whole phrases, and a splice is inaudible); or, with no `parts`,
#    a whole score rendered offline (composed to the film's grid) placed at `music_at`.
# 2. Sound effects: the game's own samples on every cue the film logged (out/events.json from render.mjs --events),
#    louder when near the camera, pitched down in slow motion, through one lowpass bus (keeps the top end clean).
# 3. Hand-placed cues (a pump rack on a downbeat) and sine sub-booms (a blast on the drop, the title slam).
# 4. A clean look-ahead limiter, a short fade at the end.
# See references/music-and-sound.md for the config fields; examples/stuffed-ad-mix.json is a complete one.
import json, sys, wave
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.ndimage import maximum_filter1d, uniform_filter1d

C = json.load(open(sys.argv[1]))
SR = 48000
B = 60 / C['bpm']
FILM = C.get('length') or C['beats'] * B

def load(p):
    w = wave.open(p); ch = w.getnchannels()
    if w.getframerate() != SR: sys.exit(f'{p}: resample to 48 kHz first (afconvert -f WAVE -d LEI16@48000 in out.wav)')
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64).reshape(-1, ch) / 32768
    return x if ch == 2 else np.repeat(x, 2, 1)

out = np.zeros((int(FILM * SR) + SR, 2))

# ---- music
if C.get('music'):
    music = load(C['music']); end = len(music) / SR
    m0 = C.get('first_downbeat', 0.0)
    xf = C.get('crossfade', 0.012)
    # parts: [music beat from ("start" = 0 s), music beat to ("end"), film beat where it lands]. Beat 0 is the track's
    # first downbeat; with "start", the film beat is where that first downbeat lands (the pickup before it plays first).
    # no parts: the whole file at music_at seconds (a score composed to the film's grid and rendered offline)
    for mb0, mb1, fb in C.get('parts') or [['start', 'end', None]]:
        m_t0 = 0.0 if mb0 == 'start' else m0 + mb0 * B
        m_t1 = end if mb1 == 'end' else m0 + mb1 * B
        film_t0 = C.get('music_at', 0.0) if fb is None else fb * B - m0 if mb0 == 'start' else fb * B
        a = int((m_t0 - xf / 2) * SR); b = int((m_t1 + xf / 2) * SR)
        seg = music[max(0, a):min(len(music), b)].copy()
        n = int(xf * SR); ramp = np.sin(np.linspace(0, np.pi / 2, n)) ** 2
        if m_t0 > 0.01: seg[:n] *= ramp[:, None]
        if m_t1 < end - 0.01: seg[-n:] *= ramp[::-1, None]
        o = int((film_t0 - (m_t0 - max(0, m_t0 - xf / 2))) * SR)
        if o < 0: seg = seg[-o:]; o = 0
        out[o:o + len(seg)] += seg[:max(0, len(out) - o)] * C.get('music_gain', 1.0)

# ---- sound effects
samples = {}
def sample(name):
    if name not in samples:
        s = load(C['samples'][name]); e = np.abs(s).max(1)
        on = int(np.argmax(e > 0.3 * e.max()))          # start each sample on its attack
        samples[name] = s[max(0, on - int(0.004 * SR)):]
    return samples[name]

def add(bus, s, t, gain, rate=1.0):
    if rate != 1.0:   # slower playback: lower and longer (a slow-motion moment)
        idx = np.arange(0, len(s) - 1, rate)
        s = np.stack([np.interp(idx, np.arange(len(s)), s[:, c]) for c in range(2)], 1)
    o = int(t * SR)
    if o < 0 or o >= len(bus): return
    n = min(len(s), len(bus) - o)
    bus[o:o + n] += s[:n] * gain

sfx = np.zeros_like(out)
if C.get('events'):
    ev = json.load(open(C['events']))
    key, smap = C.get('event_key', 'wid'), C.get('event_sound', {})
    for e in ev:
        name = smap.get(e.get(key), e.get('snd') or e.get(key))
        if name not in C['samples']: continue
        near = min(1.0, C.get('near', 3.2) / (e.get('dist', 3) + 1.2))
        g = C.get('sfx_gain', 0.42) * max(0.07, near) * (C.get('auto_gain', 0.7) if e.get(key) in C.get('auto', []) else 1.0)
        rate = 0.62 + 0.38 * min(1, e.get('speed', 1))
        add(sfx, sample(name), e['t'], g, rate)
for c in C.get('cues', []):
    s = sample(c['sample']); at = c['at'] if 'at' in c else c['beat'] * B
    if c.get('align') == 'peak': at -= int(np.argmax(np.abs(s).max(1))) / SR   # its loudest moment on `at`
    add(sfx, s, at, c.get('gain', 0.5), c.get('rate', 1.0))
if C.get('lowpass'): sfx = sosfilt(butter(2, C['lowpass'], fs=SR, output='sos'), sfx, axis=0)

# ---- sine sub-booms (no noise, no distortion)
for bm in C.get('booms', []):
    n = int(bm.get('dur', 1.6) * SR); tt = np.arange(n) / SR
    f = bm.get('f1', 34) + (bm.get('f0', 62) - bm.get('f1', 34)) * np.exp(-tt * 3.0)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - np.exp(-tt * 400)) * np.exp(-tt * 3.2 / bm.get('dur', 1.6)) * bm.get('gain', 0.5)
    at = bm['at'] if 'at' in bm else bm['beat'] * B
    o = int(at * SR); out[o:o + n] += s[:max(0, min(n, len(out) - o)), None]

mix = out + sfx
# a clean look-ahead limiter
ceil = 10 ** (C.get('ceiling_db', -1) / 20)
pk = np.abs(mix).max(1); look = int(0.005 * SR)
g = uniform_filter1d(np.minimum(1.0, ceil / np.maximum(maximum_filter1d(pk, size=2 * look + 1), 1e-9)), size=look)
g = np.minimum(g, ceil / np.maximum(pk, 1e-9))
mix = (mix * g[:, None])[:int(FILM * SR)]
n = int(C.get('fade_out', 0.4) * SR)
if n: mix[-n:] *= np.linspace(1, 0, n)[:, None]
w = wave.open(C.get('out', 'out/soundtrack.wav'), 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
print(f"soundtrack {len(mix) / SR:.2f} s -> {C.get('out', 'out/soundtrack.wav')}; limiter min gain {20 * np.log10(g.min()):.2f} dB")
