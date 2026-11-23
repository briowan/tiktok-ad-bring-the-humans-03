// v2 audio: original synth beat bed (120bpm) synced to beat boundaries +
// SFX synced to v2 motion frames. No third-party samples (Hermes K4).
// Beat boundaries at 0 / 2.0 / 4.5 / 8.0 / 10.5 / 12.5s all land on the
// 0.5s grid, so kicks accent them naturally. Music ducks under the
// punchline freeze (11.1-11.5s) and resolves into the end card at 12.5s.
import {writeFileSync} from "node:fs";

const SR = 48000;
const DUR = 15;
const N = SR * DUR;
const buf = new Float32Array(N);
const F = (frame) => frame / 30;

const add = (t0, dur, fn) => {
  const start = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  for (let i = 0; i < len && start + i < N; i++) {
    buf[start + i] += fn(i / SR, i / len, start + i);
  }
};

let seed = 987654321;
const noise = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x40000000 - 1;
};

// Music envelope: full until freeze duck, out at card.
const musicGain = (t) => {
  if (t < 11.05) return 1;
  if (t < 11.5) return 0.25;
  if (t < 12.5) return 0.85;
  return Math.max(0, 0.85 - (t - 12.5) * 1.2);
};

const kick = (t0, gain = 0.5) =>
  add(t0, 0.22, (t, p, idx) => gain * musicGain(idx / SR) * Math.sin(2 * Math.PI * (120 - 70 * p) * t) * Math.exp(-14 * t));

const hat = (t0, gain = 0.07) =>
  add(t0, 0.05, (t, p, idx) => gain * musicGain(idx / SR) * noise() * (1 - p) ** 2);

const bass = (t0, freq = 55, gain = 0.16) =>
  add(t0, 0.24, (t, p, idx) => gain * musicGain(idx / SR) * Math.sign(Math.sin(2 * Math.PI * freq * t)) * 0.4 * Math.exp(-6 * t) + gain * 0.6 * musicGain(idx / SR) * Math.sin(2 * Math.PI * freq * t) * Math.exp(-6 * t));

// 120bpm grid: kick every 0.5s, hat offbeat, bass on 1 & 3.
for (let b = 0; b < 25; b++) {
  const t = b * 0.5;
  const boundary = [0, 2.0, 4.5, 8.0, 10.5].includes(t);
  kick(t, boundary ? 0.62 : 0.42);
  hat(t + 0.25);
  if (b % 2 === 0) bass(t, b % 8 === 6 ? 65.4 : 55);
}

// Soft pad underneath (kept from v1, lower).
add(0, DUR, (t, p, idx) => {
  const swell = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.08 * t);
  return 0.022 * musicGain(idx / SR) * swell * (Math.sin(2 * Math.PI * 196 * t) + 0.6 * Math.sin(2 * Math.PI * 294 * t));
});

const pop = (t0, freq = 620, gain = 0.2) =>
  add(t0, 0.12, (t, p) => gain * Math.sin(2 * Math.PI * (freq * (1 - 0.55 * p)) * t) * (1 - p) ** 2);

const whoosh = (t0, gain = 0.15, dur = 0.45) =>
  add(t0, dur, (t, p) => gain * noise() * Math.sin(Math.PI * p) ** 2 * (0.4 + 0.6 * p));

const thump = (t0, gain = 0.42) =>
  add(t0, 0.3, (t, p) => gain * Math.sin(2 * Math.PI * 80 * t) * Math.exp(-9 * t) * (1 - p * 0.3));

const tick = (t0, gain = 0.09) => add(t0, 0.05, (t, p) => gain * Math.sin(2 * Math.PI * 1560 * t) * (1 - p));

// HOOK: lunge bump f12, bubble f16.
thump(F(12), 0.3);
pop(F(16), 720, 0.18);
// META: morph whoosh f60, playhead ticks, stomp f122.
whoosh(F(60), 0.14);
for (let i = 0; i < 5; i++) tick(F(72 + i * 11));
thump(F(122), 0.34);
// ARENA: burst whoosh f135, card landings f143/161/179, whip f231.
whoosh(F(135), 0.18);
pop(F(143), 540); pop(F(161), 600); pop(F(179), 660);
whoosh(F(231), 0.22, 0.35);
// TARUHAN: stamp f254, counter ticks accelerating f260-300.
thump(F(254), 0.5);
for (let i = 0; i < 9; i++) tick(F(262 + i * 5));
// PUNCHLINE: turn whoosh f315, freeze gap, text pops f345/f355.
whoosh(F(315), 0.12, 0.6);
pop(F(345), 520, 0.22);
pop(F(355), 600, 0.2);

// Normalize to -1 dBFS peak.
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
writeFileSync(new URL("./out/audio-v2.wav", import.meta.url), out);
console.log(`audio-v2.wav written (${DUR}s, peak ${peak.toFixed(3)})`);
