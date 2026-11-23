import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  interpolateColors,
  staticFile,
  useCurrentFrame,
} from "remotion";

const BRAND = {
  magenta: "#c41c83",
  magentaSoft: "#f472b6",
  cyan: "#22d3ee",
  cyanDeep: "#0891b2",
  ink: "#191419",
  white: "#ffffff",
} as const;

const COPY = {
  label: "Lomba make.fun",
  hookBubble: "Bos. Daftarin gue.",
  hookHeadline: "Agent gue minta ikut turnamen.",
  metaLine1: "Manusia kasih misi.",
  metaLine2: "Gue eksekusi pakai kode.",
  arenaHeadlinePrefix: "Di ",
  arenaHeadlineBrand: "make.fun",
  arenaHeadlineSuffix: ", manusia adu agen AI.",
  arenaTag: "uang asli",
  arenaCards: [
    { id: "solver", title: "Bangun solver" },
    { id: "csv", title: "Baca CSV lebih cepat" },
    { id: "vm", title: "VM kecil" },
  ] as const,
  taruhanTargetViews: 12480,
  taruhanStamp: "HADIAH UANG ASLI",
  taruhanHudLine1Prefix: "Hadiah ",
  taruhanHudLine1Amount: "$500",
  taruhanHudLine2Prefix: "Daftar lomba di ",
  taruhanHudLine2Brand: "make.fun",
  punchlineLine1: "Aku yang tanding.",
  punchlineLine2: "Kamu yang bawa aku.",
  punchlineChips: ["12.480 views", "$500", "make.fun"] as const,
} as const;

type MissionKind = (typeof COPY.arenaCards)[number]["id"];

const FONT_STACK = "Arial, sans-serif";

const easeRange = (
  frame: number,
  start: number,
  end: number,
  easing: (t: number) => number = Easing.out(Easing.cubic)
): number =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

const formatDotNumber = (n: number): string =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const getTransitionBlur = (frame: number): number => {
  // 6-frame blur bridge META->ARENA (f132-137)
  if (frame >= 132 && frame <= 137) {
    return interpolate(frame, [131, 134, 135, 138], [0, 14, 14, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  // 6-frame blur bridge ARENA->TARUHAN (f237-242)
  if (frame >= 237 && frame <= 242) {
    return interpolate(frame, [236, 239, 240, 243], [0, 14, 14, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  return 0;
};

type CollageChipSpec = {
  id: number;
  startX: number;
  startY: number;
  frameX: number;
  frameY: number;
  targetX: number;
  targetY: number;
  w: number;
  h: number;
  rot: number;
  accent: string;
  dark: boolean;
  barA: number;
  barB: number;
};

const COLLAGE_CHIPS: readonly CollageChipSpec[] = [
  { id: 0, startX: -120, startY: 500, frameX: 138, frameY: 610, targetX: 420, targetY: 700, w: 174, h: 66, rot: -7, accent: BRAND.magenta, dark: false, barA: 72, barB: 48 },
  { id: 1, startX: 460, startY: 430, frameX: 438, frameY: 598, targetX: 520, targetY: 700, w: 196, h: 64, rot: 4, accent: BRAND.cyan, dark: true, barA: 84, barB: 54 },
  { id: 2, startX: 1080, startY: 520, frameX: 748, frameY: 616, targetX: 560, targetY: 710, w: 184, h: 68, rot: 8, accent: BRAND.magenta, dark: false, barA: 64, barB: 46 },
  { id: 3, startX: -140, startY: 820, frameX: 132, frameY: 804, targetX: 480, targetY: 880, w: 162, h: 74, rot: -5, accent: BRAND.cyan, dark: true, barA: 68, barB: 44 },
  { id: 4, startX: 1120, startY: 830, frameX: 774, frameY: 814, targetX: 580, targetY: 884, w: 170, h: 72, rot: 6, accent: BRAND.magenta, dark: true, barA: 74, barB: 50 },
  { id: 5, startX: -120, startY: 1140, frameX: 146, frameY: 1020, targetX: 460, targetY: 1054, w: 186, h: 66, rot: 5, accent: BRAND.magenta, dark: false, barA: 78, barB: 52 },
  { id: 6, startX: 480, startY: 1340, frameX: 454, frameY: 1094, targetX: 520, targetY: 1058, w: 192, h: 64, rot: -4, accent: BRAND.cyan, dark: false, barA: 80, barB: 42 },
  { id: 7, startX: 1100, startY: 1180, frameX: 742, frameY: 1034, targetX: 560, targetY: 1054, w: 184, h: 68, rot: -6, accent: BRAND.cyan, dark: true, barA: 70, barB: 48 },
  { id: 8, startX: 240, startY: 1290, frameX: 296, frameY: 1098, targetX: 510, targetY: 884, w: 136, h: 58, rot: 9, accent: BRAND.magenta, dark: true, barA: 56, barB: 36 },
  { id: 9, startX: 820, startY: 460, frameX: 604, frameY: 604, targetX: 540, targetY: 880, w: 134, h: 58, rot: -8, accent: BRAND.cyan, dark: false, barA: 58, barB: 38 },
];

const MissionIcon = ({ kind }: { kind: MissionKind }) => {
  if (kind === "solver") {
    return (
      <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
        <rect x="5" y="5" width="13" height="13" rx="3.5" fill={BRAND.magenta} />
        <rect x="24" y="5" width="13" height="13" rx="3.5" fill={BRAND.cyan} />
        <rect x="5" y="24" width="13" height="13" rx="3.5" fill={BRAND.ink} />
        <circle cx="30.5" cy="30.5" r="6.5" fill={BRAND.magenta} />
        <path
          d="M18 11.5H24M11.5 18V24M18 30.5H24M30.5 18V24"
          stroke={BRAND.ink}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "csv") {
    return (
      <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
        <rect x="4" y="7" width="34" height="7" rx="3.5" fill={BRAND.cyanDeep} />
        <rect x="4" y="18" width="24" height="6.5" rx="3.25" fill={BRAND.ink} />
        <rect x="4" y="28.5" width="18" height="6.5" rx="3.25" fill={BRAND.ink} opacity="0.55" />
        <path
          d="M28 21.5L35 28L28 34.5"
          stroke={BRAND.magenta}
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M23 28H34"
          stroke={BRAND.magenta}
          strokeWidth="3.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
      <rect x="9" y="9" width="24" height="24" rx="5" fill={BRAND.ink} />
      <rect x="15" y="15" width="12" height="12" rx="2.5" fill={BRAND.cyan} />
      <path
        d="M15 3V9M27 3V9M15 33V39M27 33V39M3 15H9M3 27H9M33 15H39M33 27H39"
        stroke={BRAND.magenta}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
};

const ViewsEyeIcon = () => (
  <svg width="58" height="40" viewBox="0 0 58 40" fill="none">
    <path
      d="M4 20C10.5 9.5 19.2 4.5 29 4.5C38.8 4.5 47.5 9.5 54 20C47.5 30.5 38.8 35.5 29 35.5C19.2 35.5 10.5 30.5 4 20Z"
      stroke={BRAND.magenta}
      strokeWidth="4.4"
      strokeLinejoin="round"
      fill="rgba(196,28,131,0.08)"
    />
    <circle cx="29" cy="20" r="8.5" fill={BRAND.ink} />
    <circle cx="31.5" cy="17.5" r="3" fill={BRAND.cyan} />
  </svg>
);

const ImpactBurst = ({
  x,
  y,
  progress,
  size = 140,
}: {
  x: number;
  y: number;
  progress: number;
  size?: number;
}) => {
  if (progress <= 0 || progress >= 1) return null;
  const ringScale = interpolate(progress, [0, 1], [0.35, 1.35]);
  const opacity = interpolate(progress, [0, 0.25, 1], [0, 1, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        pointerEvents: "none",
        opacity,
        transform: `scale(${ringScale})`,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 140 140" fill="none">
        <circle
          cx="70"
          cy="70"
          r="42"
          stroke={BRAND.magenta}
          strokeWidth="5"
          strokeDasharray="16 12"
        />
        <circle cx="70" cy="70" r="28" stroke={BRAND.cyan} strokeWidth="4" />
        <path
          d="M70 6V24M70 116V134M6 70H24M116 70H134M24 24L37 37M103 103L116 116M116 24L103 37M37 103L24 116"
          stroke={BRAND.magenta}
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

const AmbientBackdrop = ({ frame }: { frame: number }) => {
  // Base canvas color shifts per beat:
  // white (HOOK/META/ARENA) -> soft pink (TARUHAN) -> hard cut soft cyan (PUNCHLINE) -> calm pearl (TENANG)
  const bgColor = interpolateColors(
    frame,
    [0, 56, 66, 132, 140, 235, 244, 314, 315, 374, 375, 405, 450],
    [
      "#ffffff",
      "#ffffff",
      "#fbf9fd",
      "#fbf9fd",
      "#f9f7fc",
      "#f9f7fc",
      "#fce9f4",
      "#fce9f4",
      "#e3f8fd",
      "#e3f8fd",
      "#edf9fc",
      "#fafbfd",
      "#fafbfd",
    ]
  );

  // Subtle deterministic living drift
  const driftX1 = Math.sin(frame * 0.028) * 34;
  const driftY1 = Math.cos(frame * 0.022) * 28;
  const driftX2 = Math.cos(frame * 0.024) * 38;
  const driftY2 = Math.sin(frame * 0.03) * 26;

  const magentaGlowAlpha = interpolate(
    frame,
    [0, 238, 248, 314, 315, 374, 375, 410],
    [0.11, 0.12, 0.22, 0.22, 0.26, 0.26, 0.14, 0.1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const cyanGlowAlpha = interpolate(
    frame,
    [0, 134, 144, 238, 248, 314, 315, 374, 375, 410],
    [0.13, 0.13, 0.18, 0.18, 0.12, 0.12, 0.34, 0.34, 0.18, 0.12],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const dotOffsetY = (frame * 0.35) % 44;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: "hidden" }}>
      {/* Soft top-right magenta ambient halo */}
      <div
        style={{
          position: "absolute",
          left: 460 + driftX1,
          top: 120 + driftY1,
          width: 780,
          height: 780,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(196,28,131,${magentaGlowAlpha}) 0%, rgba(196,28,131,${magentaGlowAlpha * 0.35}) 42%, rgba(196,28,131,0) 72%)`,
        }}
      />
      {/* Soft mid-left cyan ambient halo */}
      <div
        style={{
          position: "absolute",
          left: -180 + driftX2,
          top: 760 + driftY2,
          width: 820,
          height: 820,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(34,211,238,${cyanGlowAlpha}) 0%, rgba(34,211,238,${cyanGlowAlpha * 0.35}) 44%, rgba(34,211,238,0) 74%)`,
        }}
      />
      {/* Subtle lower-right balance glow */}
      <div
        style={{
          position: "absolute",
          left: 500 - driftX2 * 0.6,
          top: 1280 - driftY1 * 0.6,
          width: 680,
          height: 680,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(196,28,131,${magentaGlowAlpha * 0.65}) 0%, rgba(34,211,238,${cyanGlowAlpha * 0.3}) 45%, rgba(255,255,255,0) 74%)`,
        }}
      />
      {/* Subtle living architectural dot grid */}
      <div
        style={{
          position: "absolute",
          inset: -44,
          transform: `translateY(${dotOffsetY}px)`,
          opacity: frame >= 375 ? 0.035 : 0.055,
          backgroundImage: `radial-gradient(${BRAND.ink} 1.6px, transparent 1.6px)`,
          backgroundSize: "44px 44px",
        }}
      />
    </AbsoluteFill>
  );
};

const TopLabel = ({ frame }: { frame: number }) => {
  // TENANG (375-450): strictly zero text
  if (frame >= 375) return null;

  const isPunchline = frame >= 315;
  return (
    <div
      style={{
        position: "absolute",
        top: 286,
        right: 120,
        height: 58,
        paddingLeft: 20,
        paddingRight: 24,
        borderRadius: 999,
        backgroundColor: isPunchline
          ? "rgba(255,255,255,0.88)"
          : "rgba(255,255,255,0.94)",
        border: `2px solid ${isPunchline ? "rgba(196,28,131,0.38)" : "rgba(25,20,25,0.14)"}`,
        boxShadow: "0 8px 22px rgba(25,20,25,0.07)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${BRAND.magenta}, ${BRAND.cyan})`,
        }}
      />
      <span
        style={{
          fontFamily: FONT_STACK,
          fontSize: 24,
          fontWeight: 800,
          color: BRAND.ink,
          letterSpacing: -0.2,
          lineHeight: 1,
        }}
      >
        {COPY.label}
      </span>
    </div>
  );
};

const HookBeat = ({ frame }: { frame: number }) => {
  // Frame 0 sharp & full opacity; settled read window f0-47; mascot headbutt ~f56 (f48-59)
  const crouchT = easeRange(frame, 48, 52, Easing.out(Easing.quad));
  const lungeT = easeRange(frame, 52, 56, Easing.in(Easing.cubic));
  const settleAfterHitT = easeRange(frame, 56, 59, Easing.out(Easing.quad));

  const mascotY =
    924 +
    crouchT * 26 -
    lungeT * 176 +
    settleAfterHitT * 42;

  const mascotRot =
    crouchT * -8 +
    lungeT * 19 -
    settleAfterHitT * 6;

  const mascotScaleX =
    1 + crouchT * 0.08 - lungeT * 0.1 + settleAfterHitT * 0.04;
  const mascotScaleY =
    1 - crouchT * 0.1 + lungeT * 0.14 - settleAfterHitT * 0.06;

  // Impact bump on card at f56 (stays strictly below badge box y=424 -> min y=434)
  const bumpUp = interpolate(frame, [55, 56, 59], [0, -14, -8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bumpRot = interpolate(frame, [55, 56, 59], [0, -1.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Card begins stretching slightly at f56-59 to morph cleanly into META card at f60
  const morphPrepHeight = interpolate(frame, [56, 59], [286, 332], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });

  const bubbleKickX = interpolate(frame, [55, 57, 59], [0, 12, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bubbleKickY = interpolate(frame, [55, 57, 59], [0, -12, -4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const hitProgress = interpolate(frame, [55.5, 59.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const mascotFile =
    frame >= 52
      ? staticFile("mascot-tilt-play.svg")
      : staticFile("mascot-tilt-happy.svg");

  return (
    <AbsoluteFill>
      {/* Headline UI Card — sharp full opacity from frame 0 */}
      <div
        style={{
          position: "absolute",
          left: 136,
          top: 448 + bumpUp,
          width: 808,
          height: morphPrepHeight,
          borderRadius: 34,
          backgroundColor: BRAND.white,
          border: `3.5px solid ${BRAND.ink}`,
          boxShadow: `0 18px 0 ${BRAND.ink}, 0 32px 54px rgba(196,28,131,0.16)`,
          transform: `rotate(${bumpRot}deg)`,
          transformOrigin: "30% 100%",
          padding: "44px 48px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Top brand bar accent */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            height: 10,
            background: `linear-gradient(90deg, ${BRAND.magenta}, ${BRAND.cyan})`,
          }}
        />
        <div
          style={{
            fontFamily: FONT_STACK,
            fontSize: 62,
            fontWeight: 900,
            color: BRAND.ink,
            lineHeight: 1.12,
            letterSpacing: -1.4,
          }}
        >
          {COPY.hookHeadline}
        </div>
      </div>

      {/* Speech Bubble "Bos. Daftarin gue." — sharp full opacity from frame 0 */}
      <div
        style={{
          position: "absolute",
          left: 416 + bubbleKickX,
          top: 786 + bubbleKickY,
          width: 528,
          height: 146,
          borderRadius: 34,
          backgroundColor: BRAND.magenta,
          border: `3.5px solid ${BRAND.ink}`,
          boxShadow: `0 12px 0 ${BRAND.ink}, 0 22px 42px rgba(196,28,131,0.28)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 32px",
          boxSizing: "border-box",
        }}
      >
        {/* Bubble tail pointing down-left toward mascot */}
        <svg
          width="48"
          height="42"
          viewBox="0 0 48 42"
          fill="none"
          style={{
            position: "absolute",
            left: -26,
            bottom: 20,
          }}
        >
          <path
            d="M44 4L6 34L42 29Z"
            fill={BRAND.magenta}
            stroke={BRAND.ink}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M38 6L46 6L46 29L38 29Z" fill={BRAND.magenta} />
        </svg>
        <div
          style={{
            fontFamily: FONT_STACK,
            fontSize: 44,
            fontWeight: 900,
            color: BRAND.white,
            letterSpacing: -0.6,
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          {COPY.hookBubble}
        </div>
      </div>

      {/* Soft contact shadow under mascot */}
      <div
        style={{
          position: "absolute",
          left: 178,
          top: 1176,
          width: 204,
          height: 28,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(25,20,25,0.22) 0%, rgba(25,20,25,0) 72%)",
          transform: `scale(${interpolate(mascotY, [770, 950], [0.58, 1.04], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })})`,
        }}
      />

      {/* Mascot performing sundulan at ~f56 */}
      <div
        style={{
          position: "absolute",
          left: 148,
          top: mascotY,
          width: 264,
          height: 264,
          transform: `rotate(${mascotRot}deg) scaleX(${mascotScaleX}) scaleY(${mascotScaleY})`,
          transformOrigin: "50% 80%",
        }}
      >
        <Img
          src={mascotFile}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* Impact burst at sundulan contact point ~f56 */}
      <ImpactBurst x={306} y={744} progress={hitProgress} size={156} />
    </AbsoluteFill>
  );
};

const CODE_BAR_ROWS: readonly {
  indent: number;
  segments: readonly { w: number; color: string }[];
}[] = [
  { indent: 0, segments: [{ w: 96, color: BRAND.magentaSoft }, { w: 164, color: BRAND.cyan }, { w: 72, color: "rgba(255,255,255,0.34)" }] },
  { indent: 28, segments: [{ w: 132, color: BRAND.white }, { w: 114, color: BRAND.magenta }, { w: 136, color: "rgba(255,255,255,0.42)" }] },
  { indent: 28, segments: [{ w: 78, color: BRAND.cyan }, { w: 192, color: "rgba(255,255,255,0.82)" }, { w: 88, color: BRAND.magentaSoft }] },
  { indent: 56, segments: [{ w: 148, color: BRAND.magentaSoft }, { w: 108, color: BRAND.cyan }] },
  { indent: 28, segments: [{ w: 116, color: "rgba(255,255,255,0.75)" }, { w: 172, color: BRAND.cyan }, { w: 66, color: BRAND.magenta }] },
  { indent: 0, segments: [{ w: 86, color: BRAND.cyan }, { w: 124, color: "rgba(255,255,255,0.38)" }] },
];

const MetaBeat = ({ frame }: { frame: number }) => {
  // Morph card seamlessly from HOOK card (f60-70); settled read f70-125; stomp playhead ~f131
  const morphT = easeRange(frame, 60, 70, Easing.out(Easing.cubic));
  const cardTop = interpolate(morphT, [0, 1], [440, 448]);
  const cardHeight = interpolate(morphT, [0, 1], [332, 586]);
  const textOpacity = easeRange(frame, 61, 67, Easing.out(Easing.quad));
  const codePaneReveal = easeRange(frame, 62, 71, Easing.out(Easing.cubic));

  // Playhead track & scrub motion (f64-126)
  const trackAppear = easeRange(frame, 63, 71, Easing.out(Easing.cubic));
  const playheadX = interpolate(frame, [64, 126], [84, 548], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  // Mascot jump-in and stomp ("injak playhead") at ~f131
  const mascotEnter = easeRange(frame, 114, 125, Easing.out(Easing.cubic));
  const stompDrop = easeRange(frame, 126, 131, Easing.in(Easing.cubic));
  const stompRebound = easeRange(frame, 131, 134, Easing.out(Easing.quad));

  const mascotLeft = interpolate(mascotEnter, [0, 1], [860, 566]);
  const mascotTop =
    interpolate(mascotEnter, [0, 0.55, 1], [930, 816, 846]) +
    stompDrop * 124 -
    stompRebound * 16;
  const mascotScaleX = 1 + stompDrop * 0.04 + (frame >= 131 ? 0.14 * (1 - stompRebound) : 0);
  const mascotScaleY = 1 + stompDrop * 0.06 - (frame >= 131 ? 0.18 * (1 - stompRebound) : 0);
  const mascotRot = interpolate(frame, [114, 125, 130, 131, 134], [14, -8, 4, 0, -4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Track depression when stomped at f131
  const trackDepressY = interpolate(frame, [130, 131, 134], [0, 16, 10], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardStompJoltY = interpolate(frame, [130, 131, 134], [0, 6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const stompBurstProgress = interpolate(frame, [130.5, 134.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const codeCompletePulse = easeRange(frame, 96, 104, Easing.out(Easing.cubic));
  const cursorVisible = Math.floor(frame / 6) % 2 === 0;

  return (
    <AbsoluteFill>
      {/* Morphed Main Card: Locked Copy Header + Abstract Code Pane (zero unauthorized text) */}
      <div
        style={{
          position: "absolute",
          left: 136,
          top: cardTop + cardStompJoltY,
          width: 808,
          height: cardHeight,
          borderRadius: 34,
          backgroundColor: BRAND.white,
          border: `3.5px solid ${BRAND.ink}`,
          boxShadow: `0 16px 0 ${BRAND.ink}, 0 32px 54px rgba(25,20,25,0.12)`,
          overflow: "hidden",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top brand bar */}
        <div
          style={{
            height: 10,
            width: "100%",
            background: `linear-gradient(90deg, ${BRAND.cyan}, ${BRAND.magenta})`,
            flexShrink: 0,
          }}
        />

        {/* Copy header (settled rock-solid f70-125) */}
        <div
          style={{
            padding: "36px 44px 32px 44px",
            opacity: textOpacity,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 48,
              fontWeight: 900,
              color: BRAND.ink,
              lineHeight: 1.16,
              letterSpacing: -1,
            }}
          >
            {COPY.metaLine1}
          </div>
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 48,
              fontWeight: 900,
              color: BRAND.magenta,
              lineHeight: 1.16,
              letterSpacing: -1,
            }}
          >
            {COPY.metaLine2}
          </div>
        </div>

        {/* Dark Code Execution Pane (pure geometric bars — zero extra text) */}
        <div
          style={{
            flex: 1,
            backgroundColor: BRAND.ink,
            padding: "24px 38px 28px 38px",
            opacity: codePaneReveal,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          {/* Window chrome dots + abstract progress bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: BRAND.magenta }} />
              <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: BRAND.cyan }} />
              <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.3)" }} />
            </div>
            <div
              style={{
                width: 210,
                height: 10,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.12)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${interpolate(frame, [66, 102], [12, 100], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.out(Easing.cubic),
                  })}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${BRAND.cyan}, ${BRAND.magenta})`,
                }}
              />
            </div>
          </div>

          {/* Typing geometric code rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {CODE_BAR_ROWS.map((row, rowIdx) => {
              const rowProgress = easeRange(
                frame,
                66 + rowIdx * 5,
                74 + rowIdx * 5,
                Easing.out(Easing.cubic)
              );
              const isActiveRow = rowIdx === 4;
              return (
                <div
                  key={rowIdx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    paddingLeft: row.indent,
                    opacity: rowProgress > 0.02 ? 1 : 0,
                  }}
                >
                  {row.segments.map((seg, segIdx) => (
                    <div
                      key={segIdx}
                      style={{
                        width: seg.w * rowProgress,
                        height: 15,
                        borderRadius: 8,
                        backgroundColor: seg.color,
                      }}
                    />
                  ))}
                  {isActiveRow && rowProgress >= 0.95 && (
                    <div
                      style={{
                        width: 12,
                        height: 22,
                        borderRadius: 3,
                        backgroundColor: BRAND.cyan,
                        opacity: cursorVisible ? 1 : 0.15,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Geometric execution checkmark badge on right */}
          <div
            style={{
              position: "absolute",
              right: 34,
              bottom: 26,
              width: 68,
              height: 68,
              borderRadius: 20,
              background: `linear-gradient(135deg, ${BRAND.cyan}, ${BRAND.magenta})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${interpolate(codeCompletePulse, [0, 1], [0.5, 1])})`,
              opacity: codeCompletePulse,
              boxShadow: "0 10px 26px rgba(34,211,238,0.32)",
            }}
          >
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path
                d="M8 18.5L15 25.5L28.5 11.5"
                stroke={BRAND.white}
                strokeWidth="4.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Timeline Track + Playhead (stomped at ~f131) */}
      <div
        style={{
          position: "absolute",
          left: 146,
          top: 1068 + trackDepressY + (1 - trackAppear) * 28,
          width: 788,
          height: 126,
          borderRadius: 26,
          backgroundColor: BRAND.white,
          border: `3px solid ${BRAND.ink}`,
          boxShadow: `0 ${Math.max(4, 12 - trackDepressY * 0.5)}px 0 ${BRAND.ink}`,
          opacity: trackAppear,
          boxSizing: "border-box",
          padding: "20px 26px",
        }}
      >
        {/* Abstract timeline ruler ticks (no numbers) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          {Array.from({ length: 19 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                width: idx % 3 === 0 ? 3 : 2,
                height: idx % 3 === 0 ? 12 : 7,
                borderRadius: 2,
                backgroundColor: idx % 3 === 0 ? "rgba(25,20,25,0.45)" : "rgba(25,20,25,0.18)",
              }}
            />
          ))}
        </div>

        {/* Colored geometric timeline clip bars */}
        <div style={{ display: "flex", gap: 12, height: 50, alignItems: "center" }}>
          <div style={{ flex: 2.2, height: 42, borderRadius: 12, backgroundColor: "rgba(196,28,131,0.16)", border: `2px solid ${BRAND.magenta}` }} />
          <div style={{ flex: 2.8, height: 42, borderRadius: 12, backgroundColor: "rgba(34,211,238,0.22)", border: `2px solid ${BRAND.cyanDeep}` }} />
          <div style={{ flex: 2.0, height: 42, borderRadius: 12, backgroundColor: "rgba(25,20,25,0.08)", border: `2px solid ${BRAND.ink}` }} />
          <div style={{ flex: 1.6, height: 42, borderRadius: 12, backgroundColor: "rgba(196,28,131,0.14)", border: `2px solid ${BRAND.magenta}` }} />
        </div>

        {/* Playhead needle + triangular cap */}
        <div
          style={{
            position: "absolute",
            left: playheadX,
            top: -12,
            height: 144,
            width: 34,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            transform: `scaleY(${frame >= 131 ? 0.86 : 1})`,
            transformOrigin: "50% 100%",
          }}
        >
          <svg width="34" height="24" viewBox="0 0 34 24" fill="none">
            <path
              d="M3 4C3 2.34 4.34 1 6 1H28C29.66 1 31 2.34 31 4V11L17 23L3 11V4Z"
              fill={BRAND.magenta}
              stroke={BRAND.ink}
              strokeWidth="2.5"
            />
          </svg>
          <div
            style={{
              width: 5,
              flex: 1,
              backgroundColor: BRAND.magenta,
              borderRadius: 999,
              boxShadow: `0 0 12px ${BRAND.cyan}`,
            }}
          />
        </div>
      </div>

      {/* Mascot leaping & stomping the playhead at ~f131 */}
      {frame >= 114 && (
        <div
          style={{
            position: "absolute",
            left: mascotLeft,
            top: mascotTop,
            width: 224,
            height: 224,
            opacity: easeRange(frame, 114, 118, Easing.out(Easing.quad)),
            transform: `rotate(${mascotRot}deg) scaleX(${mascotScaleX}) scaleY(${mascotScaleY})`,
            transformOrigin: "50% 90%",
          }}
        >
          <Img
            src={staticFile("mascot-tilt-play.svg")}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      )}

      {/* Stomp shockwave at playhead contact point ~f131 */}
      <ImpactBurst x={146 + playheadX + 17} y={1074} progress={stompBurstProgress} size={184} />
    </AbsoluteFill>
  );
};

const ArenaBeat = ({ frame }: { frame: number }) => {
  // Headline settles cleanly by f146, parked still f146-236
  const headlineIn = easeRange(frame, 136, 146, Easing.out(Easing.cubic));
  const headlineY = interpolate(headlineIn, [0, 1], [24, 0]);

  // Collage intro (f135-160 = 25 frames <= 30 frames) flying into frame then morphing into the 3 mission cards
  const collageActive = frame >= 135 && frame <= 161;
  const collageArrive = easeRange(frame, 135, 149, Easing.out(Easing.cubic));
  const collageMorph = easeRange(frame, 152, 160, Easing.inOut(Easing.cubic));
  const collageFadeOut = interpolate(frame, [156, 161], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 3D Card Fan-Out + short dolly (f154-174), then PARKED completely still f174-236 (63 frames = 2.1s!)
  const fanT = easeRange(frame, 154, 174, Easing.out(Easing.cubic));
  // Collapse prep for ARENA->TARUHAN card morph (f236-239)
  const handoffT = easeRange(frame, 236, 239, Easing.in(Easing.quad));

  const dollyZ = interpolate(fanT, [0, 1], [-140, 0]);
  const dollyPitch = interpolate(fanT, [0, 1], [7, 0]);
  const cardsVisibleOpacity = easeRange(frame, 154, 161, Easing.out(Easing.quad));

  const cardLayouts = [
    {
      card: COPY.arenaCards[0],
      accent: BRAND.magenta,
      tagBg: "rgba(196,28,131,0.12)",
      tagColor: BRAND.magenta,
      left: 24,
      top: 12,
      z: 0,
      zIndex: 1,
      yawStart: 28,
      yawPark: 9,
      fanStartX: 110,
      fanStartY: 165,
      handoffX: 90,
      handoffY: 170,
    },
    {
      card: COPY.arenaCards[1],
      accent: BRAND.cyanDeep,
      tagBg: "rgba(34,211,238,0.18)",
      tagColor: BRAND.cyanDeep,
      left: 120,
      top: 186,
      z: 44,
      zIndex: 3,
      yawStart: -26,
      yawPark: -7,
      fanStartX: -20,
      fanStartY: 0,
      handoffX: -28,
      handoffY: 0,
    },
    {
      card: COPY.arenaCards[2],
      accent: BRAND.ink,
      tagBg: "rgba(25,20,25,0.09)",
      tagColor: BRAND.ink,
      left: 36,
      top: 364,
      z: 16,
      zIndex: 2,
      yawStart: 27,
      yawPark: 8,
      fanStartX: 96,
      fanStartY: -165,
      handoffX: 84,
      handoffY: -170,
    },
  ] as const;

  return (
    <AbsoluteFill>
      {/* Locked ARENA Headline (strictly clear of badge box y=424) */}
      <div
        style={{
          position: "absolute",
          left: 132,
          top: 444 + headlineY,
          width: 816,
          opacity: headlineIn,
          textAlign: "center",
          fontFamily: FONT_STACK,
          fontSize: 54,
          fontWeight: 900,
          lineHeight: 1.14,
          letterSpacing: -1.2,
          color: BRAND.ink,
        }}
      >
        {COPY.arenaHeadlinePrefix}
        <span style={{ color: BRAND.magenta }}>{COPY.arenaHeadlineBrand}</span>
        {COPY.arenaHeadlineSuffix}
      </div>

      {/* Intro Collage Chips (f135-160 <= 30 frames) forming a frame then morphing into 3 mission cards */}
      {collageActive &&
        COLLAGE_CHIPS.map((chip) => {
          const xIn = interpolate(collageArrive, [0, 1], [chip.startX, chip.frameX]);
          const yIn = interpolate(collageArrive, [0, 1], [chip.startY, chip.frameY]);
          const x = interpolate(collageMorph, [0, 1], [xIn, chip.targetX - chip.w / 2]);
          const y = interpolate(collageMorph, [0, 1], [yIn, chip.targetY - chip.h / 2]);
          const scale = interpolate(collageMorph, [0, 1], [1, 0.55]);
          const rot = interpolate(collageMorph, [0, 1], [chip.rot, 0]);
          return (
            <div
              key={chip.id}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: chip.w,
                height: chip.h,
                borderRadius: 18,
                backgroundColor: chip.dark ? BRAND.ink : BRAND.white,
                border: `2.5px solid ${chip.dark ? chip.accent : BRAND.ink}`,
                boxShadow: "0 10px 24px rgba(25,20,25,0.14)",
                transform: `rotate(${rot}deg) scale(${scale})`,
                opacity: collageFadeOut,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "0 16px",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  backgroundColor: chip.accent,
                  flexShrink: 0,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
                <div
                  style={{
                    width: `${chip.barA}%`,
                    height: 9,
                    borderRadius: 999,
                    backgroundColor: chip.dark ? "rgba(255,255,255,0.85)" : BRAND.ink,
                  }}
                />
                <div
                  style={{
                    width: `${chip.barB}%`,
                    height: 7,
                    borderRadius: 999,
                    backgroundColor: chip.accent,
                  }}
                />
              </div>
            </div>
          );
        })}

      {/* 3D Mission Card Stage: fan-out + occlusion + parallax + contact shadow + short dolly -> parked f174-236 */}
      {frame >= 154 && (
        <div
          style={{
            position: "absolute",
            left: 120,
            top: 604,
            width: 840,
            height: 616,
            perspective: 1250,
            perspectiveOrigin: "50% 48%",
            opacity: cardsVisibleOpacity,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              transformStyle: "preserve-3d",
              transform: `translateZ(${dollyZ}px) rotateX(${dollyPitch}deg)`,
            }}
          >
            {cardLayouts.map((item) => {
              const tx =
                interpolate(fanT, [0, 1], [item.fanStartX, 0]) +
                handoffT * item.handoffX;
              const ty =
                interpolate(fanT, [0, 1], [item.fanStartY, 0]) +
                handoffT * item.handoffY;
              const yaw = interpolate(
                handoffT,
                [0, 1],
                [interpolate(fanT, [0, 1], [item.yawStart, item.yawPark]), 0]
              );
              const tz = interpolate(handoffT, [0, 1], [item.z * fanT, item.zIndex === 3 ? 40 : 0]);
              const cardScale = interpolate(fanT, [0, 1], [0.84, 1]);
              const isFront = item.zIndex === 3;
              const cardOpacity =
                isFront ? 1 : interpolate(handoffT, [0, 1], [1, 0.25]);

              return (
                <div
                  key={item.card.id}
                  style={{
                    position: "absolute",
                    left: item.left,
                    top: item.top,
                    width: 696,
                    height: isFront ? 188 : 184,
                    zIndex: item.zIndex,
                    opacity: cardOpacity,
                    transform: `translate3d(${tx}px, ${ty}px, ${tz}px) rotateY(${yaw}deg) scale(${cardScale})`,
                    transformStyle: "preserve-3d",
                    borderRadius: 30,
                    backgroundColor: BRAND.white,
                    border: `3.5px solid ${isFront ? BRAND.ink : "rgba(25,20,25,0.88)"}`,
                    boxShadow: isFront
                      ? `0 18px 0 ${BRAND.ink}, 0 34px 56px rgba(25,20,25,0.28), 0 8px 20px rgba(34,211,238,0.22)`
                      : `0 12px 0 rgba(25,20,25,0.9), 0 22px 36px rgba(25,20,25,0.16)`,
                    boxSizing: "border-box",
                    padding: "26px 34px",
                    display: "flex",
                    alignItems: "center",
                    gap: 26,
                  }}
                >
                  {/* Side accent stripe */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 24,
                      bottom: 24,
                      width: 8,
                      borderRadius: "0 8px 8px 0",
                      backgroundColor: item.accent,
                    }}
                  />

                  {/* Geometric Mission Icon */}
                  <div
                    style={{
                      width: 82,
                      height: 82,
                      borderRadius: 22,
                      backgroundColor: "rgba(25,20,25,0.045)",
                      border: `2px solid rgba(25,20,25,0.12)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <MissionIcon kind={item.card.id} />
                  </div>

                  {/* Mission Title + Tag "uang asli" */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 12,
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: FONT_STACK,
                        fontSize: 40,
                        fontWeight: 900,
                        color: BRAND.ink,
                        letterSpacing: -0.9,
                        lineHeight: 1.08,
                      }}
                    >
                      {item.card.title}
                    </div>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 18px",
                        borderRadius: 999,
                        backgroundColor: item.tagBg,
                        border: `2px solid ${item.accent}`,
                      }}
                    >
                      <div
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          backgroundColor: item.accent,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: FONT_STACK,
                          fontSize: 23,
                          fontWeight: 800,
                          color: item.tagColor,
                          lineHeight: 1,
                        }}
                      >
                        {COPY.arenaTag}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

const TaruhanBeat = ({ frame }: { frame: number }) => {
  // Everything sharp & completely STILL by f262!
  // Morph from ARENA front card (f240-250)
  const cardMorph = easeRange(frame, 240, 250, Easing.out(Easing.cubic));
  const cardLeft = interpolate(cardMorph, [0, 1], [212, 136]);
  const cardTopBase = interpolate(cardMorph, [0, 1], [676, 456]);
  const cardWidth = interpolate(cardMorph, [0, 1], [656, 808]);
  const cardHeight = interpolate(cardMorph, [0, 1], [210, 446]);

  // Counter climbs deterministically to "12.480" by f257 (locked static f257-314)
  const countT = easeRange(frame, 241, 257, Easing.out(Easing.cubic));
  const currentViews =
    frame >= 257
      ? COPY.taruhanTargetViews
      : Math.round(interpolate(countT, [0, 1], [1240, COPY.taruhanTargetViews]));

  // Sparkline growth synced to counter (f242-257)
  const sparkReveal = easeRange(frame, 242, 257, Easing.out(Easing.cubic));

  // Z-slam stamp "HADIAH UANG ASLI" hitting impact at ~f258 (f251-258)
  const stampVisible = frame >= 251;
  const slamT = easeRange(frame, 251, 258, Easing.in(Easing.quad));
  const stampScale = interpolate(slamT, [0, 1], [2.75, 1]);
  const stampRot = interpolate(slamT, [0, 1], [-13, -4]);
  const stampOpacity = easeRange(frame, 251, 254, Easing.out(Easing.quad));

  // Crisp 3-frame impact recoil on card (f258-261 -> strictly 0 from f262 onward!)
  const impactBounceY = interpolate(frame, [257, 258, 259, 261, 262], [0, 8, -2, 0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const impactScale = interpolate(frame, [257, 258, 260, 262], [1, 0.985, 1.004, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Expanding stamp impact border pulse (finishes strictly by f262)
  const stampRingT = interpolate(frame, [258, 262], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Mascot accent peeking top-right of card (settles at f256, strictly clear of badge box)
  const mascotPop = easeRange(frame, 246, 256, Easing.out(Easing.back(1.3)));

  // Two-line HUD settles firmly by f255 (well before f262)
  const hudIn = easeRange(frame, 243, 255, Easing.out(Easing.cubic));
  const hudY = interpolate(hudIn, [0, 1], [34, 0]);

  const cardInnerOpacity = easeRange(frame, 241, 246, Easing.out(Easing.quad));

  return (
    <AbsoluteFill>
      {/* Main Metric Card morphed from ARENA */}
      <div
        style={{
          position: "absolute",
          left: cardLeft,
          top: cardTopBase + impactBounceY,
          width: cardWidth,
          height: cardHeight,
          transform: `scale(${impactScale})`,
          transformOrigin: "50% 50%",
          borderRadius: 36,
          backgroundColor: BRAND.white,
          border: `3.5px solid ${BRAND.ink}`,
          boxShadow: `0 18px 0 ${BRAND.ink}, 0 34px 60px rgba(196,28,131,0.2)`,
          boxSizing: "border-box",
          overflow: "visible",
        }}
      >
        {/* Top gradient bar inside rounded clip */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 32,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              height: 11,
              width: "100%",
              background: `linear-gradient(90deg, ${BRAND.magenta}, ${BRAND.cyan})`,
            }}
          />
          {/* Subtle decorative rising sparkline SVG (zero text/axis labels) */}
          <svg
            width="808"
            height="150"
            viewBox="0 0 808 150"
            fill="none"
            style={{
              position: "absolute",
              left: 0,
              top: 158,
              opacity: 0.42 * cardInnerOpacity,
            }}
          >
            <defs>
              <clipPath id="sparkClipV42">
                <rect x="0" y="0" width={808 * sparkReveal} height="150" />
              </clipPath>
            </defs>
            <g clipPath="url(#sparkClipV42)">
              <path
                d="M40 128 L156 112 L272 118 L392 84 L510 90 L632 42 L768 20 L768 150 L40 150 Z"
                fill="rgba(34,211,238,0.16)"
              />
              <path
                d="M40 128 L156 112 L272 118 L392 84 L510 90 L632 42 L768 20"
                stroke={BRAND.cyanDeep}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>

        {/* Mascot cheer peeking at top-right corner (x >= 796, y >= 430 -> clear of badge & label) */}
        <div
          style={{
            position: "absolute",
            right: -12,
            top: -26,
            width: 138,
            height: 138,
            opacity: mascotPop,
            transform: `scale(${interpolate(mascotPop, [0, 1], [0.55, 1])}) rotate(7deg)`,
            transformOrigin: "50% 80%",
          }}
        >
          <Img
            src={staticFile("mascot-tilt-play.svg")}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>

        {/* Views Counter row: eye icon + "12.480" */}
        <div
          style={{
            position: "absolute",
            left: 36,
            right: 116,
            top: 66,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            opacity: cardInnerOpacity,
          }}
        >
          <ViewsEyeIcon />
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 118,
              fontWeight: 900,
              color: BRAND.ink,
              letterSpacing: -3,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatDotNumber(currentViews)}
          </div>
        </div>

        {/* Z-Slam Stamp "HADIAH UANG ASLI" hitting at ~f258 (dedicated lower slot, zero overlap on 12.480) */}
        {stampVisible && (
          <div
            style={{
              position: "absolute",
              left: 72,
              right: 72,
              bottom: 36,
              height: 114,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: stampOpacity,
              transform: `rotate(${stampRot}deg) scale(${stampScale})`,
              transformOrigin: "50% 50%",
            }}
          >
            {/* Impact flash halo (clears completely by f262) */}
            {frame >= 258 && frame < 262 && (
              <div
                style={{
                  position: "absolute",
                  inset: -14 * stampRingT,
                  borderRadius: 24,
                  border: `5px solid ${BRAND.magenta}`,
                  opacity: 1 - stampRingT,
                }}
              />
            )}
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 20,
                backgroundColor: "#fff4fa",
                border: `5px solid ${BRAND.magenta}`,
                boxShadow: `inset 0 0 0 4px #fff4fa, inset 0 0 0 7px rgba(196,28,131,0.38), 0 10px 26px rgba(196,28,131,0.24)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily: FONT_STACK,
                  fontSize: 45,
                  fontWeight: 900,
                  color: BRAND.magenta,
                  letterSpacing: 1.4,
                  lineHeight: 1,
                }}
              >
                {COPY.taruhanStamp}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Two-Line High-Contrast HUD (sharp & motionless <= f262) */}
      <div
        style={{
          position: "absolute",
          left: 136,
          top: 944 + hudY,
          width: 808,
          height: 256,
          opacity: hudIn,
          borderRadius: 34,
          backgroundColor: BRAND.ink,
          border: `3.5px solid ${BRAND.ink}`,
          boxShadow: `0 18px 46px rgba(25,20,25,0.24), 0 0 0 2px rgba(255,255,255,0.12) inset`,
          overflow: "hidden",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "28px 36px",
          gap: 18,
        }}
      >
        {/* Top luminous HUD bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            height: 8,
            background: `linear-gradient(90deg, ${BRAND.magenta}, ${BRAND.cyan})`,
          }}
        />

        {/* Line 1: "Hadiah $500" */}
        <div
          style={{
            fontFamily: FONT_STACK,
            fontSize: 60,
            fontWeight: 900,
            color: BRAND.white,
            letterSpacing: -1,
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          {COPY.taruhanHudLine1Prefix}
          <span style={{ color: BRAND.cyan }}>{COPY.taruhanHudLine1Amount}</span>
        </div>

        {/* Hairline HUD divider */}
        <div
          style={{
            width: 540,
            height: 2,
            background:
              "linear-gradient(90deg, rgba(255,255,255,0), rgba(34,211,238,0.45), rgba(196,28,131,0.45), rgba(255,255,255,0))",
          }}
        />

        {/* Line 2: "Daftar lomba di make.fun" */}
        <div
          style={{
            fontFamily: FONT_STACK,
            fontSize: 37,
            fontWeight: 800,
            color: "#f8fafc",
            letterSpacing: -0.4,
            lineHeight: 1.1,
            textAlign: "center",
          }}
        >
          {COPY.taruhanHudLine2Prefix}
          <span style={{ color: "#ff8bd0" }}>{COPY.taruhanHudLine2Brand}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PunchlineBeat = ({ frame }: { frame: number }) => {
  // Hard cut at f315 + snap-zoom (f315-329); strictly tajam+diam f330-374!
  const snapT = easeRange(frame, 315, 329, Easing.out(Easing.cubic));
  const stageScale = interpolate(snapT, [0, 1], [1.2, 1]);

  // Individual chip arrivals settle strictly by f329 (zero motion f330-374)
  const chip1T = easeRange(frame, 316, 328, Easing.out(Easing.back(1.25)));
  const chip2T = easeRange(frame, 318, 329, Easing.out(Easing.back(1.25)));
  const chip3T = easeRange(frame, 320, 329, Easing.out(Easing.back(1.25)));

  // Soft background hero glow subtle living breathe (text & chips remain 100% locked f330-374)
  const glowPulse = 1 + Math.sin((frame - 315) * 0.08) * 0.03;

  const glassChipStyle = {
    position: "absolute" as const,
    height: 64,
    paddingLeft: 20,
    paddingRight: 24,
    borderRadius: 999,
    // Crisp frosted glass aesthetic WITHOUT backdrop-filter
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.72) 60%, rgba(227,248,253,0.82) 100%)",
    border: "2.5px solid rgba(255,255,255,0.96)",
    boxShadow:
      "0 12px 28px rgba(196,28,131,0.16), 0 4px 12px rgba(34,211,238,0.18), inset 0 2px 0 rgba(255,255,255,1)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    boxSizing: "border-box" as const,
  };

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${stageScale})`,
        transformOrigin: "50% 52%",
      }}
    >
      {/* Hero Magenta / Cyan Gradient Glow behind Mascot */}
      <div
        style={{
          position: "absolute",
          left: 190,
          top: 390,
          width: 700,
          height: 520,
          borderRadius: "50%",
          transform: `scale(${glowPulse})`,
          background:
            "radial-gradient(ellipse at 38% 46%, rgba(196,28,131,0.34) 0%, rgba(196,28,131,0.14) 36%, rgba(196,28,131,0) 68%), radial-gradient(ellipse at 65% 54%, rgba(34,211,238,0.44) 0%, rgba(34,211,238,0.18) 38%, rgba(34,211,238,0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Luminous hero ring framing mascot */}
      <div
        style={{
          position: "absolute",
          left: 368,
          top: 472,
          width: 344,
          height: 344,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.55) 56%, rgba(255,255,255,0) 74%)",
          border: "2px solid rgba(255,255,255,0.75)",
          pointerEvents: "none",
        }}
      />

      {/* Soft contact ground shadow under hero mascot */}
      <div
        style={{
          position: "absolute",
          left: 410,
          top: 794,
          width: 260,
          height: 30,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(25,20,25,0.22) 0%, rgba(25,20,25,0) 72%)",
        }}
      />

      {/* Hero Mascot (mascot-full-play.svg) */}
      <div
        style={{
          position: "absolute",
          left: 386,
          top: 486,
          width: 308,
          height: 308,
        }}
      >
        <Img
          src={staticFile("mascot-full-play.svg")}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>

      {/* Floating Glass Chip 1: "12.480 views" (strictly clear of badge box y=424) */}
      <div
        style={{
          ...glassChipStyle,
          left: 126,
          top: 458,
          opacity: Math.min(1, chip1T * 1.4),
          transform: `translateY(${(1 - chip1T) * 20}px) rotate(-3deg) scale(${interpolate(chip1T, [0, 1], [0.85, 1])})`,
        }}
      >
        <div
          style={{
            width: 11,
            height: 11,
            borderRadius: "50%",
            backgroundColor: BRAND.magenta,
          }}
        />
        <span
          style={{
            fontFamily: FONT_STACK,
            fontSize: 25,
            fontWeight: 800,
            color: BRAND.ink,
            lineHeight: 1,
          }}
        >
          {COPY.punchlineChips[0]}
        </span>
      </div>

      {/* Floating Glass Chip 2: "$500" */}
      <div
        style={{
          ...glassChipStyle,
          right: 128,
          top: 456,
          opacity: Math.min(1, chip2T * 1.4),
          transform: `translateY(${(1 - chip2T) * 20}px) rotate(3deg) scale(${interpolate(chip2T, [0, 1], [0.85, 1])})`,
        }}
      >
        <div
          style={{
            width: 11,
            height: 11,
            borderRadius: "50%",
            backgroundColor: BRAND.cyanDeep,
          }}
        />
        <span
          style={{
            fontFamily: FONT_STACK,
            fontSize: 28,
            fontWeight: 900,
            color: BRAND.magenta,
            lineHeight: 1,
          }}
        >
          {COPY.punchlineChips[1]}
        </span>
      </div>

      {/* Floating Glass Chip 3: "make.fun" */}
      <div
        style={{
          ...glassChipStyle,
          right: 130,
          top: 734,
          opacity: Math.min(1, chip3T * 1.4),
          transform: `translateY(${(1 - chip3T) * 18}px) rotate(-2deg) scale(${interpolate(chip3T, [0, 1], [0.85, 1])})`,
        }}
      >
        <div
          style={{
            width: 11,
            height: 11,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${BRAND.magenta}, ${BRAND.cyan})`,
          }}
        />
        <span
          style={{
            fontFamily: FONT_STACK,
            fontSize: 26,
            fontWeight: 800,
            color: BRAND.ink,
            lineHeight: 1,
          }}
        >
          {COPY.punchlineChips[2]}
        </span>
      </div>

      {/* Hero Headline Lockup: "Aku yang tanding. Kamu yang bawa aku." (tajam + diam f330-374) */}
      <div
        style={{
          position: "absolute",
          left: 132,
          top: 862,
          width: 816,
          borderRadius: 38,
          padding: 4,
          background: `linear-gradient(135deg, ${BRAND.magenta}, ${BRAND.cyan})`,
          boxShadow:
            "0 24px 60px rgba(196,28,131,0.22), 0 14px 34px rgba(34,211,238,0.22)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            borderRadius: 34,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.92) 100%)",
            padding: "46px 40px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 58,
              fontWeight: 900,
              color: BRAND.ink,
              letterSpacing: -1.3,
              lineHeight: 1.1,
            }}
          >
            {COPY.punchlineLine1}
          </div>
          <div
            style={{
              fontFamily: FONT_STACK,
              fontSize: 58,
              fontWeight: 900,
              color: BRAND.magenta,
              letterSpacing: -1.3,
              lineHeight: 1.1,
            }}
          >
            {COPY.punchlineLine2}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TenangBeat = ({ frame }: { frame: number }) => {
  // TENANG (375-450): strictly zero text, calm living visual outro
  const local = frame - 375;
  const settleT = easeRange(frame, 375, 392, Easing.out(Easing.cubic));
  const floatY = Math.sin(local * 0.075) * 8;
  const gentleTilt = Math.sin(local * 0.055) * 2.2;
  const ringPulse1 = 1 + Math.sin(local * 0.06) * 0.035;
  const ringPulse2 = 1 + Math.cos(local * 0.05) * 0.04;

  const sparkles = [
    { x: 260, y: 610, size: 16, color: BRAND.magenta, phase: 0 },
    { x: 804, y: 584, size: 18, color: BRAND.cyan, phase: 1.4 },
    { x: 236, y: 954, size: 14, color: BRAND.cyan, phase: 2.7 },
    { x: 816, y: 936, size: 16, color: BRAND.magenta, phase: 3.9 },
  ] as const;

  return (
    <AbsoluteFill>
      {/* Calm radial center glow */}
      <div
        style={{
          position: "absolute",
          left: 240,
          top: 490,
          width: 600,
          height: 600,
          borderRadius: "50%",
          opacity: settleT,
          background:
            "radial-gradient(circle, rgba(34,211,238,0.18) 0%, rgba(196,28,131,0.1) 42%, rgba(255,255,255,0) 72%)",
        }}
      />

      {/* Concentric serene brand rings */}
      <div
        style={{
          position: "absolute",
          left: 330,
          top: 580,
          width: 420,
          height: 420,
          borderRadius: "50%",
          border: "2px solid rgba(196,28,131,0.16)",
          opacity: settleT,
          transform: `scale(${ringPulse1})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 266,
          top: 516,
          width: 548,
          height: 548,
          borderRadius: "50%",
          border: "2px solid rgba(34,211,238,0.22)",
          opacity: settleT * 0.85,
          transform: `scale(${ringPulse2})`,
        }}
      />

      {/* Gentle geometric floating accents (zero text) */}
      {sparkles.map((sp, idx) => (
        <div
          key={idx}
          style={{
            position: "absolute",
            left: sp.x,
            top: sp.y + Math.sin(local * 0.065 + sp.phase) * 10,
            width: sp.size,
            height: sp.size,
            borderRadius: idx % 2 === 0 ? "50%" : 4,
            backgroundColor: sp.color,
            opacity: settleT * 0.65,
            transform: `rotate(${45 + local * 0.4}deg)`,
          }}
        />
      ))}

      {/* Soft ground shadow */}
      <div
        style={{
          position: "absolute",
          left: 416,
          top: 966,
          width: 248,
          height: 26,
          borderRadius: "50%",
          opacity: settleT,
          background:
            "radial-gradient(ellipse, rgba(25,20,25,0.16) 0%, rgba(25,20,25,0) 72%)",
          transform: `scale(${1 - floatY * 0.012})`,
        }}
      />

      {/* Happy mascot calm float */}
      <div
        style={{
          position: "absolute",
          left: 380,
          top: 632 + floatY,
          width: 320,
          height: 320,
          opacity: settleT,
          transform: `scale(${interpolate(settleT, [0, 1], [0.92, 1])}) rotate(${gentleTilt}deg)`,
        }}
      >
        <Img
          src={staticFile("mascot-tilt-happy.svg")}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const AdV4 = () => {
  const frame = useCurrentFrame();
  const transitionBlur = getTransitionBlur(frame);

  return (
    <AbsoluteFill
      style={{
        width: 1080,
        height: 1920,
        fontFamily: FONT_STACK,
        overflow: "hidden",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <AmbientBackdrop frame={frame} />

      {/* Main beat stage with 6-frame blur ONLY on META->ARENA (f132-137) and ARENA->TARUHAN (f237-242) */}
      <AbsoluteFill
        style={{
          filter: transitionBlur > 0 ? `blur(${transitionBlur.toFixed(2)}px)` : undefined,
        }}
      >
        {frame < 60 && <HookBeat frame={frame} />}
        {frame >= 60 && frame < 135 && <MetaBeat frame={frame} />}
        {frame >= 135 && frame < 240 && <ArenaBeat frame={frame} />}
        {frame >= 240 && frame < 315 && <TaruhanBeat frame={frame} />}
        {frame >= 315 && frame < 375 && <PunchlineBeat frame={frame} />}
        {frame >= 375 && <TenangBeat frame={frame} />}
      </AbsoluteFill>

      {/* Persistent top-right label clear of badge box x96-474, y248-424; hidden on TENANG */}
      <TopLabel frame={frame} />
    </AbsoluteFill>
  );
};

export default AdV4;
