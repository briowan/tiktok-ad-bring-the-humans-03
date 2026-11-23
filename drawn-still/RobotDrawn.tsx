// RobotDrawn.tsx
// Varian robot gambar-ulang SVG dengan 5 state mata untuk persetujuan still kiro (D4 Hermes).
// PENTING: Komponen ini TIDAK dipakai di render utama (Ad.tsx). Hanya dipanggil di Still terpisah pada Root.tsx.

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS, FONTS } from './theme';

export type RobotEyeState = 'eager' | 'focus' | 'hype' | 'smug' | 'calm';

export interface RobotDrawnProps {
  eyeState?: RobotEyeState;
  size?: number;
  accentColor?: string;
  frame?: number;
  badge?: '▶' | '$' | null;
  idPrefix?: string;
}

const EYE_CONFIG: Record<
  RobotEyeState,
  { accent: string; label: string; beatHint: string }
> = {
  eager: { accent: '#B8FF3B', label: 'EAGER', beatHint: 'HOOK' },
  focus: { accent: '#34F5A4', label: 'FOCUS', beatHint: 'META' },
  hype: { accent: '#FFB830', label: 'HYPE', beatHint: 'ARENA / PUNCHLINE' },
  smug: { accent: '#FFD447', label: 'SMUG', beatHint: 'TARUHAN' },
  calm: { accent: '#7EC8FF', label: 'CALM', beatHint: 'TENANG' },
};

const renderEyes = (
  state: RobotEyeState,
  accent: string,
  glowFilterId: string
): React.ReactNode => {
  switch (state) {
    case 'eager':
      // Mata bulat besar berbinar siap ikut turnamen
      return (
        <g filter={`url(#${glowFilterId})`}>
          <rect x={118} y={132} width={44} height={52} rx={20} fill={accent} />
          <rect x={198} y={132} width={44} height={52} rx={20} fill={accent} />
          <circle cx={133} cy={147} r={8} fill="#FFFFFF" />
          <circle cx={213} cy={147} r={8} fill="#FFFFFF" />
          <circle cx={148} cy={166} r={3.5} fill="#FFFFFF" opacity={0.8} />
          <circle cx={228} cy={166} r={3.5} fill="#FFFFFF" opacity={0.8} />
          {/* Mulut kecil antusias */}
          <path
            d="M 164 196 Q 180 208 196 196"
            fill="none"
            stroke={accent}
            strokeWidth={5}
            strokeLinecap="round"
          />
        </g>
      );

    case 'focus':
      // Visor menyipit fokus eksekusi kode
      return (
        <g filter={`url(#${glowFilterId})`}>
          <polygon points="112,146 164,154 162,172 114,170" fill={accent} />
          <polygon points="248,146 196,154 198,172 246,170" fill={accent} />
          <rect x={124} y={156} width={16} height={5} rx={2} fill="#FFFFFF" />
          <rect x={220} y={156} width={16} height={5} rx={2} fill="#FFFFFF" />
          {/* Garis mulut datar tegas + kursor kode */}
          <line
            x1={164}
            y1={196}
            x2={188}
            y2={196}
            stroke={accent}
            strokeWidth={4.5}
            strokeLinecap="round"
          />
          <rect x={193} y={190} width={7} height={12} rx={1.5} fill="#FFFFFF" />
        </g>
      );

    case 'hype':
      // Mata chevron/bintang penuh energi untuk ARENA & PUNCHLINE
      return (
        <g filter={`url(#${glowFilterId})`}>
          <path
            d="M 114 168 L 138 138 L 162 168"
            fill="none"
            stroke={accent}
            strokeWidth={11}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 198 168 L 222 138 L 246 168"
            fill="none"
            stroke={accent}
            strokeWidth={11}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Kilatan energi kecil */}
          <path
            d="M 180 128 L 184 137 L 193 141 L 184 145 L 180 154 L 176 145 L 167 141 L 176 137 Z"
            fill="#FFFFFF"
          />
          {/* Senyum lebar siap tanding */}
          <path
            d="M 154 190 Q 180 212 206 190 Z"
            fill={accent}
            stroke={accent}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </g>
      );

    case 'smug':
      // Setengah terpejam percaya diri (TARUHAN hadiah uang asli)
      return (
        <g filter={`url(#${glowFilterId})`}>
          <path
            d="M 116 156 L 164 148 L 164 172 Q 140 182 116 172 Z"
            fill={accent}
          />
          <path
            d="M 196 148 L 244 156 L 244 172 Q 220 182 196 172 Z"
            fill={accent}
          />
          <circle cx={146} cy={163} r={5} fill="#FFFFFF" />
          <circle cx={214} cy={163} r={5} fill="#FFFFFF" />
          {/* Smirk miring */}
          <path
            d="M 162 197 Q 184 205 204 190"
            fill="none"
            stroke={accent}
            strokeWidth={5}
            strokeLinecap="round"
          />
        </g>
      );

    case 'calm':
      // Lengkungan lembut tenang untuk TENANG
      return (
        <g filter={`url(#${glowFilterId})`}>
          <path
            d="M 120 162 Q 140 148 160 162"
            fill="none"
            stroke={accent}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <path
            d="M 200 162 Q 220 148 240 162"
            fill="none"
            stroke={accent}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <path
            d="M 168 194 Q 180 201 192 194"
            fill="none"
            stroke={accent}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.85}
          />
        </g>
      );
  }
};

export const RobotDrawn: React.FC<RobotDrawnProps> = ({
  eyeState = 'eager',
  size = 380,
  accentColor,
  frame = 0,
  badge = null,
  idPrefix,
}) => {
  const accent = accentColor ?? EYE_CONFIG[eyeState].accent;
  const uid = `rd-${idPrefix ?? eyeState}`;
  const hoverY = Math.sin(frame * 0.14) * 5;
  const thrusterScale = 0.92 + Math.sin(frame * 0.45) * 0.12;

  return (
    <svg
      width={size}
      height={Math.round(size * (420 / 360))}
      viewBox="0 0 360 420"
      style={{ overflow: 'visible', display: 'block' }}
    >
      <defs>
        <linearGradient id={`${uid}-shell`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#263352" />
          <stop offset="52%" stopColor="#141C33" />
          <stop offset="100%" stopColor="#0A0F1F" />
        </linearGradient>
        <linearGradient id={`${uid}-visor`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#070B16" />
          <stop offset="100%" stopColor="#10182E" />
        </linearGradient>
        <radialGradient id={`${uid}-aura`} cx="50%" cy="48%" r="52%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-flame`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="35%" stopColor={accent} />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="4.5"
            floodColor={accent}
            floodOpacity="0.8"
          />
        </filter>
      </defs>

      {/* Halo belakang */}
      <circle cx={180} cy={195} r={148} fill={`url(#${uid}-aura)`} />

      {/* Bayangan lantai */}
      <ellipse cx={180} cy={394} rx={74} ry={14} fill="rgba(0,0,0,0.45)" />

      <g transform={`translate(0, ${hoverY})`}>
        {/* Plasma hover thruster */}
        <g
          transform={`translate(180, 344) scale(1, ${thrusterScale}) translate(-180, -344)`}
        >
          <path
            d="M 156 340 L 180 388 L 204 340 Z"
            fill={`url(#${uid}-flame)`}
            opacity={0.9}
          />
        </g>

        {/* Antena */}
        <line
          x1={180}
          y1={78}
          x2={180}
          y2={36}
          stroke="#4E6496"
          strokeWidth={8}
          strokeLinecap="round"
        />
        <circle cx={180} cy={30} r={14} fill={accent} filter={`url(#${uid}-glow)`} />
        <circle cx={176} cy={26} r={4.5} fill="#FFFFFF" opacity={0.9} />

        {/* Tangan kiri & kanan */}
        <rect
          x={52}
          y={246}
          width={36}
          height={74}
          rx={18}
          fill={`url(#${uid}-shell)`}
          stroke="#3E5382"
          strokeWidth={3}
          transform="rotate(14 70 283)"
        />
        <rect
          x={272}
          y={246}
          width={36}
          height={74}
          rx={18}
          fill={`url(#${uid}-shell)`}
          stroke="#3E5382"
          strokeWidth={3}
          transform="rotate(-14 290 283)"
        />

        {/* Badan / Torso */}
        <rect
          x={106}
          y={240}
          width={148}
          height={108}
          rx={38}
          fill={`url(#${uid}-shell)`}
          stroke={accent}
          strokeOpacity={0.55}
          strokeWidth={3}
        />
        {/* Core emblem dada (▶) */}
        <rect
          x={142}
          y={266}
          width={76}
          height={54}
          rx={16}
          fill="#090E1C"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={2}
        />
        <polygon
          points="171,280 198,293 171,306"
          fill={accent}
          filter={`url(#${uid}-glow)`}
        />

        {/* Ear-pods samping kepala */}
        <rect
          x={56}
          y={130}
          width={24}
          height={68}
          rx={12}
          fill="#1B2744"
          stroke={accent}
          strokeWidth={3}
        />
        <rect
          x={280}
          y={130}
          width={24}
          height={68}
          rx={12}
          fill="#1B2744"
          stroke={accent}
          strokeWidth={3}
        />

        {/* Kepala utama */}
        <rect
          x={74}
          y={76}
          width={212}
          height={164}
          rx={52}
          fill={`url(#${uid}-shell)`}
          stroke={accent}
          strokeWidth={4}
        />
        {/* Highlight atas kepala */}
        <path
          d="M 118 90 L 242 90"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={5}
          strokeLinecap="round"
        />

        {/* Layar Visor OLED */}
        <rect
          x={96}
          y={104}
          width={168}
          height={114}
          rx={32}
          fill={`url(#${uid}-visor)`}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={2.5}
        />
        {/* Refleksi kaca diagonal */}
        <path
          d="M 114 114 L 154 114 L 122 152 L 106 152 Z"
          fill="rgba(255,255,255,0.06)"
        />

        {/* State mata ekspresif */}
        {renderEyes(eyeState, accent, `${uid}-glow`)}

        {/* Badge opsional */}
        {badge && (
          <g transform="translate(274, 62) rotate(10)">
            <rect
              x={0}
              y={0}
              width={54}
              height={54}
              rx={16}
              fill={accent}
              stroke="#FFFFFF"
              strokeWidth={3}
            />
            <text
              x={27}
              y={37}
              textAnchor="middle"
              fill="#07101E"
              fontFamily={FONTS.display}
              fontSize={30}
              fontWeight={900}
            >
              {badge}
            </text>
          </g>
        )}
      </g>
    </svg>
  );
};

// Contact sheet 5 state mata untuk persetujuan still kiro (D4 Hermes).
// Render lewat: npx remotion still RobotDrawnApprovalStill out/robot-drawn-still.png
export const RobotDrawnApprovalSheet: React.FC = () => {
  const states: RobotEyeState[] = ['eager', 'focus', 'hype', 'smug', 'calm'];
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#070B16',
        padding: '90px 72px',
        boxSizing: 'border-box',
        fontFamily: FONTS.display,
        color: COLORS.inkWhite,
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            letterSpacing: '0.14em',
            color: '#B8FF3B',
            marginBottom: 14,
          }}
        >
          D4 HERMES · STILL APPROVAL SHEET (NON-MAIN RENDER)
        </div>
        <div style={{ fontSize: 58, fontWeight: 900, letterSpacing: '-0.03em' }}>
          RobotDrawn.tsx — 5 Eye States
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 32,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {states.map((st) => {
          const meta = EYE_CONFIG[st];
          return (
            <div
              key={st}
              style={{
                width: 288,
                padding: '28px 20px 24px',
                borderRadius: 28,
                background: 'rgba(14, 21, 40, 0.9)',
                border: `2px solid ${meta.accent}66`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <RobotDrawn
                eyeState={st}
                size={220}
                idPrefix={`sheet-${st}`}
                badge={st === 'hype' ? '▶' : st === 'smug' ? '$' : null}
              />
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  color: meta.accent,
                  letterSpacing: '0.04em',
                }}
              >
                {meta.label}
              </div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 18,
                  color: COLORS.inkMuted,
                }}
              >
                {meta.beatHint}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 22,
          color: COLORS.inkMuted,
          textAlign: 'center',
        }}
      >
        Catatan: Render utama BringTheHumans03 memakai Robot.tsx (public/robot.png).
      </div>
    </AbsoluteFill>
  );
};
