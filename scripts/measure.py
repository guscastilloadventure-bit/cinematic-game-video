# measure.py <wav>: high-frequency share (one-pole high-pass at ~6 kHz) per 0.25 s window, plus click check
import wave, struct, math, sys
b = open(sys.argv[1], 'rb').read(); i = 12; sr = 48000; raw = b''
while i < len(b) - 8:   # walk the RIFF chunks (plain or WAVE_FORMAT_EXTENSIBLE), 16-bit stereo assumed
    cid, sz = b[i:i+4], struct.unpack('<I', b[i+4:i+8])[0]
    if cid == b'fmt ': sr = struct.unpack('<I', b[i+12:i+16])[0]
    if cid == b'data': raw = b[i+8:i+8+sz]
    i += 8 + sz + (sz & 1)
n = len(raw) // 4; x = struct.unpack('<%dh' % (n * 2), raw[:n * 4])
m = [(x[2*i] + x[2*i+1]) / 65536 for i in range(n)]
a = math.exp(-2 * math.pi * 6000 / sr); hp = 0; prev = 0; hop = sr // 4; worst = (0, 0); tot = 0; tothi = 0; jump = 0; wins = []
for i in range(n):
    v = m[i]; hp = a * (hp + v - prev); prev = v
    tot += v * v; tothi += hp * hp
    if i % hop == hop - 1:
        r = tothi / tot if tot > 1e-9 else 0; wins.append((round(i / sr, 2), round(100 * r, 3))); tot = tothi = 0
    if i: jump = max(jump, abs(m[i] - m[i - 1]))
peak = max(abs(v) for v in x) / 32768
rms = math.sqrt(sum(v * v for v in m) / n)
print('peak', round(peak, 3), 'rms dB', round(20 * math.log10(rms), 1), 'max sample jump', round(jump, 4))
print('HF>6k share %, worst windows:', sorted(wins, key=lambda t: -t[1])[:6])
