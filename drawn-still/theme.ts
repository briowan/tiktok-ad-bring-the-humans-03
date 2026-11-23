// theme.ts
// Konstanta visual, safe zone, palet per beat, preset spring, penanda hit musik,
// dan generator grain deterministik ringan (tanpa feTurbulence).

export const VIDEO = {
  WIDTH: 1080,
  HEIGHT: 1920,
  FPS: 30,
  DURATION_FRAMES: 450,
  BPM: 120, // 15 frame per quarter-note beat
} as const;

// Badge resmi ffmpeg: x=120, y=272. End card ffmpeg resmi menimpa 375–450 (12.5s).
// SAFE_INNER memberi margin tambahan 20px agar push-in kamera (hingga 1.05x–1.09x)
// tidak pernah mendorong konten kritis keluar dari x: 120–960 dan y >= 440.
export const SAFE_ZONE = {
  LEFT: 120,
  RIGHT: 960,
  WIDTH: 840,
  TOP: 440,
  BOTTOM: 1660,
  INNER_LEFT: 140,
  INNER_WIDTH: 800,
  INNER_TOP: 472,
  BADGE_X: 120,
  BADGE_Y: 272,
} as const;

export type BeatId =
  | 'HOOK'
  | 'META'
  | 'ARENA'
  | 'TARUHAN'
  | 'PUNCHLINE'
  | 'TENANG';

export interface BeatRange {
  id: BeatId;
  start: number;
  end: number;
}

export const BEATS: Record<BeatId, BeatRange> = {
  HOOK: { id: 'HOOK', start: 0, end: 60 },
  META: { id: 'META', start: 60, end: 135 },
  ARENA: { id: 'ARENA', start: 135, end: 240 },
  TARUHAN: { id: 'TARUHAN', start: 240, end: 315 },
  PUNCHLINE: { id: 'PUNCHLINE', start: 315, end: 375 },
  TENANG: { id: 'TENANG', start: 375, end: 450 },
};

export const BEAT_ORDER: BeatId[] = [
  'HOOK',
  'META',
  'ARENA',
  'TARUHAN',
  'PUNCHLINE',
  'TENANG',
];

export type RGB = readonly [number, number, number];

export interface BeatPalette {
  bgBase: RGB;
  orbA: RGB;
  orbB: RGB;
  orbC: RGB;
  gridColor: RGB;
  accent: string;
  accentSecondary: string;
  gradeTop: RGB;
  gradeBottom: RGB;
  gradeOpacity: number;
  vignetteStrength: number;
}

export const BEAT_PALETTES: Record<BeatId, BeatPalette> = {
  HOOK: {
    bgBase: [7, 11, 24],
    orbA: [36, 108, 255],
    orbB: [184, 255, 59],
    orbC: [40, 224, 255],
    gridColor: [90, 175, 255],
    accent: '#B8FF3B',
    accentSecondary: '#38E8FF',
    gradeTop: [46, 130, 255],
    gradeBottom: [10, 18, 42],
    gradeOpacity: 0.22,
    vignetteStrength: 0.62,
  },
  META: {
    bgBase: [6, 15, 22],
    orbA: [16, 185, 148],
    orbB: [42, 226, 255],
    orbC: [164, 255, 72],
    gridColor: [52, 245, 164],
    accent: '#34F5A4',
    accentSecondary: '#38E8FF',
    gradeTop: [22, 195, 165],
    gradeBottom: [6, 18, 30],
    gradeOpacity: 0.24,
    vignetteStrength: 0.64,
  },
  ARENA: {
    bgBase: [11, 10, 28],
    orbA: [118, 72, 255],
    orbB: [255, 184, 48],
    orbC: [184, 255, 59],
    gridColor: [164, 132, 255],
    accent: '#FFB830',
    accentSecondary: '#B8FF3B',
    gradeTop: [130, 82, 255],
    gradeBottom: [28, 12, 34],
    gradeOpacity: 0.25,
    vignetteStrength: 0.66,
  },
  TARUHAN: {
    bgBase: [14, 12, 16],
    orbA: [255, 196, 46],
    orbB: [255, 84, 73],
    orbC: [44, 220, 142],
    gridColor: [255, 206, 86],
    accent: '#FFD447',
    accentSecondary: '#FF5A4E',
    gradeTop: [255, 180, 52],
    gradeBottom: [36, 10, 16],
    gradeOpacity: 0.28,
    vignetteStrength: 0.72,
  },
  PUNCHLINE: {
    bgBase: [5, 10, 20],
    orbA: [198, 255, 61],
    orbB: [42, 232, 255],
    orbC: [76, 118, 255],
    gridColor: [198, 255, 61],
    accent: '#C6FF3D',
    accentSecondary: '#2EE8FF',
    gradeTop: [184, 255, 59],
    gradeBottom: [12, 24, 58],
    gradeOpacity: 0.32,
    vignetteStrength: 0.76,
  },
  TENANG: {
    bgBase: [6, 9, 18],
    orbA: [24, 56, 118],
    orbB: [24, 96, 116],
    orbC: [18, 32, 68],
    gridColor: [72, 118, 188],
    accent: '#7EC8FF',
    accentSecondary: '#58E0C0',
    gradeTop: [22, 54, 110],
    gradeBottom: [4, 7, 15],
    gradeOpacity: 0.16,
    vignetteStrength: 0.58,
  },
};

export const COLORS = {
  inkWhite: '#F7FAFF',
  inkMuted: 'rgba(226, 236, 255, 0.74)',
  surfaceDark: 'rgba(10, 15, 28, 0.88)',
  surfaceCard: 'rgba(13, 19, 36, 0.90)',
  borderSubtle: 'rgba(255, 255, 255, 0.14)',
  moneyGreen: '#2DF59A',
  gold: '#FFD447',
  stampRed: '#FF4B4B',
} as const;

export const FONTS = {
  display:
    "'Inter', 'Plus Jakarta Sans', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif",
  sans: "'Inter', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', ui-monospace, SFMono-Regular, monospace",
} as const;

export const SPRING_PRESETS = {
  // Overshoot kinetik untuk kata dampak & badge pop
  pop: { damping: 8.5, stiffness: 300, mass: 0.72 },
  // Masuk teks normal cepat dan rapat
  textIn: { damping: 14, stiffness: 265, mass: 0.7 },
  // Slam kartu & stempel
  slam: { damping: 10.5, stiffness: 340, mass: 0.78 },
  // Pemulihan whip-pan kamera
  whip: { damping: 13, stiffness: 240, mass: 0.75 },
  // Gerakan halus / tenang
  soft: { damping: 20, stiffness: 120, mass: 1.0 },
} as const;

export interface MusicHit {
  frame: number;
  beat: BeatId;
  weight: 'hard' | 'medium' | 'accent' | 'build' | 'release';
  cue: string;
}

// Daftar frame hit resmi (grid 120 BPM = 15f/beat + sinkopasi 8th-note).
// Dipakai untuk pulse visual di Lapis 4 sekaligus panduan bed synth Brio.
export const MUSIC_HITS: MusicHit[] = [
  { frame: 0, beat: 'HOOK', weight: 'hard', cue: 'Kick + sub drop-in, Robot meluncur masuk' },
  { frame: 7, beat: 'HOOK', weight: 'accent', cue: 'Rim/pop, Robot mendarat + bubble "Bos. Daftarin gue."' },
  { frame: 15, beat: 'HOOK', weight: 'medium', cue: 'Snare/synth stab, hero text HOOK mulai stagger' },
  { frame: 30, beat: 'HOOK', weight: 'hard', cue: 'Downbeat accent, kata dampak "turnamen." pop' },
  { frame: 45, beat: 'HOOK', weight: 'build', cue: 'Filter sweep / riser menuju whip-pan META' },

  { frame: 60, beat: 'META', weight: 'hard', cue: 'Whip-pan cut + kick, Robot mendarat kiri + terminal masuk' },
  { frame: 68, beat: 'META', weight: 'accent', cue: 'Stab pendek, kata "misi." pop' },
  { frame: 75, beat: 'META', weight: 'accent', cue: 'Hi-hat/blip terminal eksekusi baris kode' },
  { frame: 90, beat: 'META', weight: 'hard', cue: 'Kick + bass switch, baris "Gue eksekusi pakai kode." masuk' },
  { frame: 105, beat: 'META', weight: 'medium', cue: 'Snare/chime, kode 100% + badge ▶ pop' },
  { frame: 120, beat: 'META', weight: 'build', cue: 'Riser naik + Robot crouch persiapan lompat vertikal' },

  { frame: 135, beat: 'ARENA', weight: 'hard', cue: 'Whip-pan UP + kick, header "Di make.fun..." masuk' },
  { frame: 150, beat: 'ARENA', weight: 'hard', cue: 'Slam Card 1 "Bangun solver" + tag "uang asli" + Robot mendarat' },
  { frame: 173, beat: 'ARENA', weight: 'hard', cue: 'Slam Card 2 "Baca CSV lebih cepat" + Robot hop + badge $ pop' },
  { frame: 195, beat: 'ARENA', weight: 'hard', cue: 'Slam Card 3 "VM kecil" + Robot hop + badge ▶ pop' },
  { frame: 210, beat: 'ARENA', weight: 'accent', cue: 'Synth arp lock-in ketiga kartu' },
  { frame: 225, beat: 'ARENA', weight: 'build', cue: 'Spotlight sweep + Z-punch riser menuju TARUHAN' },

  { frame: 240, beat: 'TARUHAN', weight: 'hard', cue: 'Match-cut Z-punch, Kartu Hasil + Views counter tancap gas' },
  { frame: 255, beat: 'TARUHAN', weight: 'hard', cue: 'Heavy impact, stempel "HADIAH UANG ASLI" menghantam kartu' },
  { frame: 270, beat: 'TARUHAN', weight: 'medium', cue: 'Stab, teks "Lomba ini: views terbanyak menang." masuk' },
  { frame: 285, beat: 'TARUHAN', weight: 'hard', cue: 'Kick + coin shimmer, kata "menang." + puncak views counter' },
  { frame: 300, beat: 'TARUHAN', weight: 'build', cue: 'Snare roll / suction drop menuju PUNCHLINE' },

  { frame: 315, beat: 'PUNCHLINE', weight: 'hard', cue: 'MAIN DROP: snap-zoom, Robot hero tengah + "Aku yang tanding."' },
  { frame: 330, beat: 'PUNCHLINE', weight: 'accent', cue: 'Off-beat synth stab menahan tensi' },
  { frame: 345, beat: 'PUNCHLINE', weight: 'hard', cue: 'CLIMAX PEAK: "Kamu yang bawa aku." + shockwave + dual badge' },
  { frame: 360, beat: 'PUNCHLINE', weight: 'accent', cue: 'Shimmer ekor klimaks sebelum turun' },

  { frame: 375, beat: 'TENANG', weight: 'release', cue: 'Cutoff / reverb tail bersih; end card resmi ffmpeg mulai 12.5s' },
];

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const mixRgb = (a: RGB, b: RGB, t: number): RGB => {
  const k = clamp01(t);
  return [
    Math.round(lerp(a[0], b[0], k)),
    Math.round(lerp(a[1], b[1], k)),
    Math.round(lerp(a[2], b[2], k)),
  ] as const;
};

export const rgbCss = (c: RGB, alpha = 1): string =>
  alpha >= 1
    ? `rgb(${c[0]}, ${c[1]}, ${c[2]})`
    : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha.toFixed(3)})`;

export const getBeatAtFrame = (frame: number): BeatId => {
  if (frame < BEATS.META.start) return 'HOOK';
  if (frame < BEATS.ARENA.start) return 'META';
  if (frame < BEATS.TARUHAN.start) return 'ARENA';
  if (frame < BEATS.PUNCHLINE.start) return 'TARUHAN';
  if (frame < BEATS.TENANG.start) return 'PUNCHLINE';
  return 'TENANG';
};

// Interpolasi palet halus 6 frame di sekitar batas beat agar grade & mesh mengalir organik
export const getBlendedPalette = (frame: number): BeatPalette => {
  const blendHalf = 3;
  const cuts: Array<{ at: number; from: BeatId; to: BeatId }> = [
    { at: BEATS.META.start, from: 'HOOK', to: 'META' },
    { at: BEATS.ARENA.start, from: 'META', to: 'ARENA' },
    { at: BEATS.TARUHAN.start, from: 'ARENA', to: 'TARUHAN' },
    { at: BEATS.PUNCHLINE.start, from: 'TARUHAN', to: 'PUNCHLINE' },
    { at: BEATS.TENANG.start, from: 'PUNCHLINE', to: 'TENANG' },
  ];

  for (const cut of cuts) {
    if (frame >= cut.at - blendHalf && frame <= cut.at + blendHalf) {
      const t = clamp01((frame - (cut.at - blendHalf)) / (blendHalf * 2));
      const pA = BEAT_PALETTES[cut.from];
      const pB = BEAT_PALETTES[cut.to];
      return {
        bgBase: mixRgb(pA.bgBase, pB.bgBase, t),
        orbA: mixRgb(pA.orbA, pB.orbA, t),
        orbB: mixRgb(pA.orbB, pB.orbB, t),
        orbC: mixRgb(pA.orbC, pB.orbC, t),
        gridColor: mixRgb(pA.gridColor, pB.gridColor, t),
        accent: t < 0.5 ? pA.accent : pB.accent,
        accentSecondary: t < 0.5 ? pA.accentSecondary : pB.accentSecondary,
        gradeTop: mixRgb(pA.gradeTop, pB.gradeTop, t),
        gradeBottom: mixRgb(pA.gradeBottom, pB.gradeBottom, t),
        gradeOpacity: lerp(pA.gradeOpacity, pB.gradeOpacity, t),
        vignetteStrength: lerp(pA.vignetteStrength, pB.vignetteStrength, t),
      };
    }
  }

  return BEAT_PALETTES[getBeatAtFrame(frame)];
};

// PRNG deterministik ringan (Mulberry32)
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Alternatif grain MURAH & DETERMINISTIK (pengganti feTurbulence full-canvas):
// Satu tile SVG 112x112 berisi 160 bintik monokrom di-raster SEKALI oleh Chromium,
// lalu di-repeat via CSS background + digeser transform translate3d tiap 2 frame (15fps film-gate).
const buildGrainTileDataUri = (size = 112, seed = 20261122): string => {
  const rand = mulberry32(seed);
  const rects: string[] = [];
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const w = rand() > 0.78 ? 2 : 1;
    const h = rand() > 0.84 ? 2 : 1;
    const light = rand() > 0.48;
    const op = (0.14 + rand() * 0.34).toFixed(2);
    rects.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${
        light ? '#fff' : '#000'
      }" fill-opacity="${op}"/>`
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rects.join(
    ''
  )}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

export const GRAIN_TILE_SIZE = 112;
export const GRAIN_TILE_URI = buildGrainTileDataUri(GRAIN_TILE_SIZE, 20261122);

// Offset langkah tiap 2 frame (15fps analog cadence), 100% deterministik
export const getGrainOffset = (frame: number): { x: number; y: number } => {
  const step = Math.floor(frame / 2);
  const rand = mulberry32(918273 + step * 7919);
  return {
    x: -Math.floor(rand() * GRAIN_TILE_SIZE),
    y: -Math.floor(rand() * GRAIN_TILE_SIZE),
  };
};
