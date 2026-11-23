// Synthesize the ad's sound bed + SFX as one 15s WAV (no downloads).
// Timed to the locked beats; kept low so the ad still reads muted.
import {writeFileSync} from "node:fs";

const SR = 48000;
const DUR = 15;
const N = SR * DUR;
const buf = new Float32Array(N);

const add = (t0, dur, fn) => {
  const start = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  for (let i = 0; i < len && start + i < N; i++) {
    buf[start + i] += fn(i / SR, i / len);
  }
};

// Soft pad bed: two detuned sines, slow swell, very low.
add(0, DUR, (t) => {
  const swell = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.08 * t);
  return 0.035 * swell * (Math.sin(2 * Math.PI * 196 * t) + 0.6 * Math.sin(2 * Math.PI * 294 * t));
});

const pop = (t0, freq = 620, gain = 0.22) =>
  add(t0, 0.12, (t, p) => gain * Math.sin(2 * Math.PI * (freq * (1 - 0.55 * p)) * t) * (1 - p) ** 2);

const whoosh = (t0, gain = 0.16) => {
  let seed = 22222;
  add(t0, 0.45, (t, p) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const noise = seed / 0x40000000 - 1;
    return gain * noise * Math.sin(Math.PI * p) ** 2 * (0.4 + 0.6 * p);
  });
};

const thump = (t0) =>
  add(t0, 0.28, (t, p) => 0.4 * Math.sin(2 * Math.PI * 82 * t) * Math.exp(-9 * t) * (1 - p * 0.3));

const tick = (t0) => add(t0, 0.05, (t, p) => 0.12 * Math.sin(2 * Math.PI * 1560 * t) * (1 - p));

// HOOK 0-2s: robot bump + bubble.
pop(0.35, 300, 0.3);
pop(1.0, 720, 0.2);
// META 2-4.5s: shrink whoosh + playhead ticks.
whoosh(2.0);
tick(2.6); tick(3.1); tick(3.6); tick(4.1);
// ARENA 4.5-8s: widen whoosh + card pops (stagger).
whoosh(4.5, 0.2);
pop(5.0, 560); pop(5.7, 600); pop(6.4, 640); pop(7.1, 680);
// TARUHAN 8-10.5s: stamp + views meter ticks accelerating.
thump(8.5);
for (let i = 0; i < 8; i++) tick(9.1 + i * 0.16);
// PUNCHLINE 10.5-12.5s: freeze gap, then one pop (ends before card at 12.5s).
pop(11.2, 520, 0.26);

// Normalize softly to -1 dBFS peak.
let peak = 0;
for (const v of buf) peak = Math.max(peak, Math.abs(v));
const scale = peak > 0 ? 0.89 / peak : 1;

const out = Buffer.alloc(44 + N * 2);
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 2, 4); out.write("WAVE", 8);
out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20);
out.writeUInt16LE(1, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 2, 28);
out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
out.write("data", 36); out.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) {
  const s = Math.max(-1, Math.min(1, buf[i] * scale));
  out.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
}
writeFileSync(new URL("./out/sfx.wav", import.meta.url), out);
console.log(`sfx.wav written (${DUR}s, peak ${peak.toFixed(3)})`);
