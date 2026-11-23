import wave, struct, math, random

SR = 44100
DUR = 15.0
N = int(SR * DUR)
buf = [0.0] * N

def add(t0, samples, gain=1.0):
    i0 = int(t0 * SR)
    for i, s in enumerate(samples):
        j = i0 + i
        if 0 <= j < N:
            buf[j] += s * gain

def kick():
    n = int(SR * 0.28)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SR
        f = 160 * math.exp(-t * 18) + 48
        phase += 2 * math.pi * f / SR
        env = math.exp(-t * 9)
        out.append(math.sin(phase) * env)
    return out

def hat(open_=False):
    n = int(SR * (0.18 if open_ else 0.05))
    out = []
    prev = 0.0
    for i in range(n):
        t = i / SR
        x = random.uniform(-1, 1)
        hp = x - prev * 0.85
        prev = x
        out.append(hp * math.exp(-t * (28 if open_ else 90)))
    return out

def bass(freq, dur=0.42):
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        env = min(1.0, t * 40) * math.exp(-t * 3.2)
        out.append((math.sin(2 * math.pi * freq * t) + 0.3 * math.sin(4 * math.pi * freq * t)) * env)
    return out

def riser(dur=0.45):
    n = int(SR * dur)
    out = []
    prev = 0.0
    for i in range(n):
        t = i / SR
        x = random.uniform(-1, 1)
        hp = x - prev * (0.92 - 0.5 * t / dur)
        prev = x
        out.append(hp * (t / dur) ** 2)
    return out

K = kick(); H = hat(); HO = hat(True); R = riser()
BPM = 128
BEAT = 60 / BPM
OFF = 0.563  # beat grid aligned to cuts (0.45 + 0.113 delay)
bassline = [55.0, 55.0, 65.41, 55.0, 49.0, 55.0, 73.42, 65.41]  # A1 A1 C2 A1 G1 A1 D2 C2
cuts = [1.5, 3.0, 5.0, 7.0, 9.0, 11.0]

t = OFF
i = 0
while t < 12.4:
    add(t, K, 0.95)
    add(t + BEAT / 2, H, 0.32)
    add(t, bass(bassline[i % 8]), 0.5)
    if i % 4 == 3:
        add(t + BEAT * 0.75, HO, 0.3)
    t += BEAT
    i += 1

for c in cuts:
    add(c - 0.45, R, 0.5)
    add(c, K, 0.6)  # extra punch on cut

# outro: kicks fade 12.4 -> 14.5
t = 12.4
while t < 14.5:
    g = max(0.0, 1 - (t - 12.4) / 2.1)
    add(t, K, 0.8 * g)
    t += BEAT

peak = max(abs(x) for x in buf) or 1.0
scale = 0.89 / peak
w = wave.open("out/beat-synth.wav", "wb")
w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x * scale)) * 32767)) for x in buf))
w.close()
print("BEAT_OK peak", round(peak, 3))
