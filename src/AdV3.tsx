import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const AD_V3_CONFIG = {
  id: "AdV3",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 450,
} as const;

const FONT_SANS = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

const COLORS = {
  magenta: "#c41c83",
  magentaSoft: "rgba(196, 28, 131, 0.10)",
  magentaBorder: "rgba(196, 28, 131, 0.28)",
  cyan: "#22d3ee",
  cyanSoft: "rgba(34, 211, 238, 0.14)",
  ink: "#191419",
  inkMuted: "#5E5562",
  inkSubtle: "#8B8190",
  surface: "#FFFFFF",
  surfaceSoft: "#F6F3F8",
  borderSoft: "rgba(25, 20, 25, 0.08)",
} as const;

const SPRING_SMOOTH = { damping: 16, stiffness: 155, mass: 0.9 };
const SPRING_SNAPPY = { damping: 14, stiffness: 215, mass: 0.85 };
const SPRING_IMPACT = { damping: 14, stiffness: 270, mass: 0.75 };
const SPRING_GENTLE = { damping: 18, stiffness: 105, mass: 1.0 };

type MascotVariant = "tilt-happy" | "tilt-play" | "full-play";

interface WordSpec {
  text: string;
  accent?: "magenta" | "cyan";
  underlineCyan?: boolean;
  initialVisible?: boolean;
}

interface MascotPose {
  x: number;
  y: number;
  size: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  variant: MascotVariant;
  airLift: number;
  glow: number;
}

const prog = (
  frame: number,
  start: number,
  end: number,
  easing?: (t: number) => number,
): number =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

const sp = (
  frame: number,
  start: number,
  fps: number,
  config: { damping: number; stiffness: number; mass?: number },
): number => {
  if (frame <= start) return 0;
  return spring({ frame: frame - start, fps, config });
};

const moveTo = (current: number, target: number, t: number): number =>
  current + (target - current) * t;

const bellPulse = (
  frame: number,
  start: number,
  peak: number,
  end: number,
): number => {
  if (frame <= start || frame >= end) return 0;
  if (frame <= peak) {
    return prog(frame, start, peak, Easing.inOut(Easing.quad));
  }
  return 1 - prog(frame, peak, end, Easing.inOut(Easing.quad));
};

const holdPulse = (
  frame: number,
  riseStart: number,
  holdStart: number,
  holdEnd: number,
  fallEnd: number,
): number => {
  if (frame <= riseStart || frame >= fallEnd) return 0;
  if (frame < holdStart) {
    return prog(frame, riseStart, holdStart, Easing.out(Easing.cubic));
  }
  if (frame <= holdEnd) return 1;
  return 1 - prog(frame, holdEnd, fallEnd, Easing.inOut(Easing.quad));
};

const formatIndoNumber = (value: number): string => {
  const digits = String(Math.max(0, Math.round(value)));
  let result = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) {
      result += ".";
    }
    result += digits[i];
  }
  return result;
};

const blurStyle = (px: number): string | undefined =>
  px > 0.08 ? `blur(${px.toFixed(2)}px)` : undefined;

const getCameraTransform = (frame: number, fps: number) => {
  // Subtle Apple-style push-in per beat; settles smoothly back to 1.0 in TENANG
  const hookPush = prog(frame, 0, 56, Easing.out(Easing.quad)) * 0.016;
  const metaPush = prog(frame, 60, 130, Easing.inOut(Easing.quad)) * 0.014;
  const arenaPush = prog(frame, 135, 232, Easing.inOut(Easing.quad)) * 0.014;
  const taruhanPush = prog(frame, 240, 308, Easing.out(Easing.quad)) * 0.014;
  const punchPush = prog(frame, 315, 366, Easing.out(Easing.cubic)) * 0.022;
  const tenangRelease = prog(frame, 372, 430, Easing.inOut(Easing.cubic));

  let baseScale = 1.0;
  baseScale = moveTo(baseScale, 1.0 + hookPush, 1);
  baseScale = moveTo(baseScale, 1.004 + metaPush, prog(frame, 58, 72, Easing.out(Easing.quad)));
  baseScale = moveTo(baseScale, 1.006 + arenaPush, prog(frame, 134, 148, Easing.out(Easing.quad)));
  baseScale = moveTo(baseScale, 1.008 + taruhanPush, prog(frame, 238, 252, Easing.out(Easing.quad)));
  baseScale = moveTo(baseScale, 1.006 + punchPush, prog(frame, 312, 326, Easing.out(Easing.quad)));
  baseScale = moveTo(baseScale, 1.0, tenangRelease);

  // Damped impact punches on the 3 major mascot hits (f56, f131, f258) + hero pop (f320)
  const hitWave = (hitFrame: number, ampY: number, ampScale: number) => {
    const dt = frame - hitFrame;
    if (dt < 0 || dt > 16) return { dy: 0, ds: 0 };
    const attack = Math.min(1, dt / 1.5);
    const decay = Math.exp(-dt * 0.34);
    const osc = Math.cos(dt * 1.15);
    return {
      dy: attack * decay * osc * ampY,
      ds: attack * decay * ampScale,
    };
  };

  const h1 = hitWave(56, -5.5, 0.011);
  const h2 = hitWave(131, 6.0, 0.012);
  const h3 = hitWave(258, 7.0, 0.014);
  const h4 = hitWave(320, -3.0, 0.008);

  // Tiny spring settle on frame 0 so frame 0 has life without feeling empty
  const f0Pop = sp(frame, 0, fps, SPRING_SMOOTH);
  const scale = baseScale + h1.ds + h2.ds + h3.ds + h4.ds - (1 - f0Pop) * 0.006;
  const translateY = h1.dy + h2.dy + h3.dy + h4.dy;

  return { scale, translateY };
};

const getMascotPose = (frame: number, fps: number): MascotPose => {
  // Base coordinates strictly inside safe zone (x120-960, y269-1248) and clear of badge (x96-474, y248-424)
  let x = 540;
  let y = 1044;
  let size = 340;
  let rotation = 0;

  // 1) HOOK -> META: Headbutt chat bubble at f56 (hold f56..60), recoil to bottom-right of editor
  const headbuttLaunch = prog(frame, 50, 56, Easing.out(Easing.cubic));
  y = moveTo(y, 870, headbuttLaunch);

  const metaSettle = sp(frame, 60, fps, SPRING_SMOOTH);
  x = moveTo(x, 792, metaSettle);
  y = moveTo(y, 1086, metaSettle);
  size = moveTo(size, 266, metaSettle);
  rotation = moveTo(rotation, -5, metaSettle);

  // 2) META -> ARENA: Parabolic jump & stomp playhead at f131 (hold f131..135)
  const stompJump = prog(frame, 122, 131, Easing.inOut(Easing.quad));
  x = moveTo(x, 540, stompJump);
  y = moveTo(y, 932, stompJump);
  size = moveTo(size, 282, stompJump);
  rotation = moveTo(rotation, 0, stompJump);
  const stompArcLift = Math.sin(stompJump * Math.PI) * 168;

  // 3) ARENA: Bounce down to bottom patrol track below the 3 cards (f135..216)
  const arenaDrop = sp(frame, 135, fps, SPRING_SNAPPY);
  x = moveTo(x, 286, arenaDrop);
  y = moveTo(y, 1106, arenaDrop);
  size = moveTo(size, 244, arenaDrop);
  rotation = moveTo(rotation, 3, arenaDrop);

  const patrolMid = prog(frame, 158, 174, Easing.inOut(Easing.cubic));
  x = moveTo(x, 540, patrolMid);
  rotation = moveTo(rotation, -2, patrolMid);
  const patrolHop1 = Math.sin(patrolMid * Math.PI) * 26;

  const patrolRight = prog(frame, 180, 198, Easing.inOut(Easing.cubic));
  x = moveTo(x, 784, patrolRight);
  rotation = moveTo(rotation, 0, patrolRight);
  const patrolHop2 = Math.sin(patrolRight * Math.PI) * 26;

  // 4) ARENA -> TARUHAN: Vault high along right lane (x=792, completely right of badge x<=474) then dive-slam at f258
  const vaultUp = prog(frame, 225, 244, Easing.out(Easing.cubic));
  x = moveTo(x, 792, vaultUp);
  y = moveTo(y, 568, vaultUp);
  size = moveTo(size, 248, vaultUp);
  rotation = moveTo(rotation, -11, vaultUp);

  const apexFloat = bellPulse(frame, 242, 247, 251) * 10;

  const diveSlam = prog(frame, 249, 258, Easing.in(Easing.cubic));
  x = moveTo(x, 788, diveSlam);
  y = moveTo(y, 772, diveSlam);
  size = moveTo(size, 250, diveSlam);
  rotation = moveTo(rotation, 0, diveSlam);

  const taruhanRecover = sp(frame, 262, fps, SPRING_SNAPPY);
  y = moveTo(y, 762, taruhanRecover);
  rotation = moveTo(rotation, 4, taruhanRecover);

  // 5) TARUHAN -> PUNCHLINE: Hero moment launch to center stage (f311..326)
  const heroLaunch = sp(frame, 311, fps, SPRING_SNAPPY);
  x = moveTo(x, 540, heroLaunch);
  y = moveTo(y, 668, heroLaunch);
  size = moveTo(size, 386, heroLaunch);
  rotation = moveTo(rotation, 0, heroLaunch);

  // 6) PUNCHLINE -> TENANG: Calm minimal settle (f374..450)
  const tenangSettle = sp(frame, 374, fps, SPRING_GENTLE);
  x = moveTo(x, 540, tenangSettle);
  y = moveTo(y, 764, tenangSettle);
  size = moveTo(size, 296, tenangSettle);
  rotation = moveTo(rotation, 0, tenangSettle);

  // Anticipation crouches (volume-preserving)
  const crouch1 = bellPulse(frame, 41, 49, 53); // before headbutt
  const crouch2 = bellPulse(frame, 114, 121, 125); // before playhead jump
  const crouch3 = bellPulse(frame, 216, 224, 228); // before vault
  const crouch4 = bellPulse(frame, 304, 310, 314); // before hero pop
  const crouch = Math.min(1, crouch1 + crouch2 + crouch3 + crouch4);

  // Mid-air stretch pulses
  const stretch1 = bellPulse(frame, 50, 53, 56);
  const stretch2 = bellPulse(frame, 122, 126.5, 131);
  const stretch3 = bellPulse(frame, 226, 234, 243);
  const stretch4 = bellPulse(frame, 250, 254.5, 258);
  const stretch5 = bellPulse(frame, 311, 314.5, 319);
  const stretch = Math.min(1, stretch1 + stretch2 + stretch3 + stretch4 + stretch5);

  // 4-frame tactile impact holds at f56..60, f131..135, f258..262
  const impact1 = holdPulse(frame, 55, 56, 60, 66);
  const impact2 = holdPulse(frame, 130, 131, 135, 141);
  const impact3 = holdPulse(frame, 257, 258, 262, 270);
  const impactSquash = Math.min(1, impact1 + impact2 + impact3);

  // Crouch dip + arc lift + subtle enveloped idle breathing
  const crouchDip =
    crouch1 * 40 + crouch2 * 28 + crouch3 * 34 + crouch4 * 26;

  const hookIdleEnv = 1 - prog(frame, 36, 42, Easing.inOut(Easing.quad));
  const hookBob = Math.sin(frame * 0.16) * 5 * hookIdleEnv;

  const metaIdleEnv =
    prog(frame, 72, 82, Easing.out(Easing.quad)) *
    (1 - prog(frame, 108, 115, Easing.inOut(Easing.quad)));
  const metaBob = Math.sin((frame - 72) * 0.24) * 5 * metaIdleEnv;

  const taruhanIdleEnv =
    prog(frame, 272, 280, Easing.out(Easing.quad)) *
    (1 - prog(frame, 298, 305, Easing.inOut(Easing.quad)));
  const taruhanBob = Math.sin((frame - 272) * 0.18) * 4 * taruhanIdleEnv;

  const heroIdleEnv =
    prog(frame, 326, 336, Easing.out(Easing.quad)) *
    (1 - prog(frame, 366, 374, Easing.inOut(Easing.quad)));
  const heroBob = Math.sin((frame - 326) * 0.14) * 4.5 * heroIdleEnv;

  const tenangIdleEnv = prog(frame, 382, 400, Easing.out(Easing.quad));
  const tenangBob = Math.sin((frame - 382) * 0.075) * 6 * tenangIdleEnv;
  const tenangRot = Math.sin((frame - 382) * 0.055) * 1.6 * tenangIdleEnv;

  // Frame 0 snappy pop-in (already 95% big at frame 0 so frame 0 is never empty)
  const entrancePop = 0.95 + 0.05 * sp(frame, 0, fps, SPRING_SNAPPY);

  const finalY =
    y +
    crouchDip -
    stompArcLift -
    patrolHop1 -
    patrolHop2 -
    apexFloat +
    hookBob +
    metaBob +
    taruhanBob +
    heroBob +
    tenangBob;

  const finalRot =
    rotation -
    crouch1 * 6 -
    crouch2 * 6 -
    crouch3 * 8 -
    crouch4 * 7 +
    stretch2 * 9 +
    hookBob * 0.35 +
    tenangRot;

  const scaleX =
    entrancePop * (1 + crouch * 0.14 - stretch * 0.1 + impactSquash * 0.18);
  const scaleY =
    entrancePop * (1 - crouch * 0.16 + stretch * 0.13 - impactSquash * 0.2);

  // Expressive SVG swaps synchronized to intent & impact frames
  let variant: MascotVariant = "tilt-happy";
  if (frame >= 44 && frame < 137) {
    variant = "tilt-play";
  } else if (frame >= 137 && frame < 219) {
    variant = "full-play";
  } else if (frame >= 219 && frame < 258) {
    variant = "tilt-play";
  } else if (frame >= 258 && frame < 378) {
    variant = "full-play";
  } else if (frame >= 378) {
    variant = "tilt-happy";
  }

  const airLift = Math.min(
    1,
    (stompArcLift + patrolHop1 + patrolHop2) / 150 +
      bellPulse(frame, 226, 244, 258),
  );

  const heroGlow =
    prog(frame, 314, 326, Easing.out(Easing.quad)) *
    (1 - prog(frame, 372, 415, Easing.inOut(Easing.quad)) * 0.55);
  const glow = Math.min(1, impactSquash * 0.9 + heroGlow * 0.75);

  return {
    x,
    y: finalY,
    size,
    scaleX,
    scaleY,
    rotation: finalRot,
    variant,
    airLift,
    glow,
  };
};

interface KineticLineProps {
  words: WordSpec[];
  frame: number;
  fps: number;
  startFrame: number;
  wordStagger: number;
  fontSize: number;
  align?: "center" | "left";
}

const KineticLine = ({
  words,
  frame,
  fps,
  startFrame,
  wordStagger,
  fontSize,
  align = "center",
}: KineticLineProps) => {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "nowrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        alignItems: "baseline",
        gap: Math.round(fontSize * 0.26),
        lineHeight: 1.16,
      }}
    >
      {words.map((word, idx) => {
        const wStart = startFrame + idx * wordStagger;
        const rawSpring = word.initialVisible
          ? 0.88 + 0.12 * sp(frame, 0, fps, SPRING_SNAPPY)
          : sp(frame, wStart, fps, SPRING_SNAPPY);
        const opacity = word.initialVisible
          ? interpolate(frame, [0, 4], [0.94, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : prog(frame, wStart, wStart + 6, Easing.out(Easing.quad));
        const translateY = (1 - rawSpring) * 28;
        const blurPx = word.initialVisible
          ? interpolate(frame, [0, 4], [1.4, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : interpolate(frame, [wStart, wStart + 7], [10, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.quad),
            });

        const underlineP = word.underlineCyan
          ? prog(frame, wStart + 4, wStart + 14, Easing.out(Easing.cubic))
          : 0;

        const color =
          word.accent === "magenta"
            ? COLORS.magenta
            : word.accent === "cyan"
              ? COLORS.cyan
              : COLORS.ink;

        return (
          <span
            key={`${word.text}-${idx}`}
            style={{
              position: "relative",
              display: "inline-block",
              fontFamily: FONT_SANS,
              fontSize,
              fontWeight: 800,
              letterSpacing: fontSize >= 60 ? "-1.8px" : "-1.2px",
              color,
              opacity,
              transform: `translateY(${translateY.toFixed(2)}px)`,
              filter: blurStyle(blurPx),
              whiteSpace: "pre",
            }}
          >
            {word.text}
            {word.underlineCyan ? (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: -6,
                  height: 7,
                  borderRadius: 99,
                  background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.magenta})`,
                  transformOrigin: "0% 50%",
                  transform: `scaleX(${underlineP.toFixed(3)})`,
                  opacity: underlineP > 0.01 ? 0.9 : 0,
                }}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
};

interface ShockwaveProps {
  frame: number;
  hitFrame: number;
  x: number;
  y: number;
  color: string;
  maxSize: number;
}

const Shockwave = ({
  frame,
  hitFrame,
  x,
  y,
  color,
  maxSize,
}: ShockwaveProps) => {
  const t = prog(frame, hitFrame, hitFrame + 16, Easing.out(Easing.cubic));
  if (t <= 0 || t >= 1) return null;
  const size = 64 + (maxSize - 64) * t;
  const opacity = (1 - t) * 0.55;

  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        border: `4px solid ${color}`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

interface MascotCardProps {
  pose: MascotPose;
}

const MascotCard = ({ pose }: MascotCardProps) => {
  const radius = Math.round(pose.size * 0.22);
  const shadowWidth = pose.size * (0.76 - pose.airLift * 0.24) * pose.scaleX;
  const shadowOpacity = Math.max(0.05, 0.2 - pose.airLift * 0.13);
  const shadowOffsetY = pose.size * 0.51 + pose.airLift * 36;

  return (
    <>
      {/* Ground contact shadow */}
      <div
        style={{
          position: "absolute",
          left: pose.x - shadowWidth / 2,
          top: pose.y + shadowOffsetY - 14,
          width: shadowWidth,
          height: 28,
          borderRadius: "50%",
          background: "rgba(25, 20, 25, 0.35)",
          filter: `blur(${(14 + pose.airLift * 14).toFixed(1)}px)`,
          opacity: shadowOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Rounded Mascot Card (all 3 SVGs pre-mounted to eliminate frame swap flicker) */}
      <div
        style={{
          position: "absolute",
          left: pose.x - pose.size / 2,
          top: pose.y - pose.size / 2,
          width: pose.size,
          height: pose.size,
          borderRadius: radius,
          overflow: "hidden",
          backgroundColor: "#FFFFFF",
          border: "4px solid rgba(255, 255, 255, 0.96)",
          boxShadow: [
            "0 28px 64px rgba(25, 20, 25, 0.14)",
            "0 8px 20px rgba(25, 20, 25, 0.08)",
            pose.glow > 0.05
              ? `0 0 ${Math.round(48 * pose.glow)}px rgba(34, 211, 238, ${(0.35 * pose.glow).toFixed(2)})`
              : "0 0 0 rgba(0,0,0,0)",
          ].join(", "),
          transform: `rotate(${pose.rotation.toFixed(2)}deg) scaleX(${pose.scaleX.toFixed(4)}) scaleY(${pose.scaleY.toFixed(4)})`,
          transformOrigin: "50% 50%",
        }}
      >
        <Img
          src={staticFile("mascot-tilt-happy.svg")}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: pose.variant === "tilt-happy" ? 1 : 0,
          }}
        />
        <Img
          src={staticFile("mascot-tilt-play.svg")}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: pose.variant === "tilt-play" ? 1 : 0,
          }}
        />
        <Img
          src={staticFile("mascot-full-play.svg")}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: pose.variant === "full-play" ? 1 : 0,
          }}
        />
        {/* Subtle Apple-like specular top rim */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 34%)",
            boxShadow: "inset 0 0 0 1.5px rgba(25, 20, 25, 0.07)",
            pointerEvents: "none",
          }}
        />
      </div>
    </>
  );
};

interface ArenaIconProps {
  kind: "solver" | "csv" | "vm";
}

const ArenaIcon = ({ kind }: ArenaIconProps) => {
  if (kind === "solver") {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="7" cy="7" r="3.2" fill={COLORS.magenta} />
        <circle cx="21" cy="7" r="3.2" fill={COLORS.cyan} />
        <circle cx="14" cy="21" r="3.2" fill={COLORS.ink} />
        <path
          d="M9.8 8.2L18.2 8.2M8.4 9.8L12.7 18.2M19.6 9.8L15.3 18.2"
          stroke={COLORS.ink}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "csv") {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="4" y="5" width="20" height="4" rx="2" fill={COLORS.cyan} />
        <rect x="4" y="12" width="14" height="4" rx="2" fill={COLORS.ink} />
        <rect x="4" y="19" width="20" height="4" rx="2" fill={COLORS.magenta} />
        <path
          d="M21 11.5L24.5 14L21 16.5"
          stroke={COLORS.magenta}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect
        x="6"
        y="6"
        width="16"
        height="16"
        rx="4"
        stroke={COLORS.ink}
        strokeWidth="2.3"
      />
      <rect x="10.5" y="10.5" width="7" height="7" rx="1.8" fill={COLORS.magenta} />
      <path
        d="M11 3V6M17 3V6M11 22V25M17 22V25M3 11H6M3 17H6M22 11H25M22 17H25"
        stroke={COLORS.cyan}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const AdV3 = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const camera = getCameraTransform(frame, fps);
  const mascotPose = getMascotPose(frame, fps);

  // Smooth luminous background tone evolution across the 6 beats
  const bgTop = interpolateColors(
    frame,
    [0, 60, 135, 240, 315, 375, 450],
    ["#FFFFFF", "#FAF8FC", "#F9FCFD", "#FCF9FB", "#FFFFFF", "#FBFAFC", "#FFFFFF"],
  );
  const bgBottom = interpolateColors(
    frame,
    [0, 60, 135, 240, 315, 375, 450],
    ["#F2FAFC", "#F5EFF8", "#F1F9FB", "#FBF0F6", "#F3FAFC", "#F7F4F9", "#F5F8FA"],
  );

  // Subtle ambient brand blooms
  const bloomMagentaX = interpolate(frame, [0, 135, 258, 375, 450], [760, 260, 310, 540, 540]);
  const bloomMagentaY = interpolate(frame, [0, 135, 258, 375, 450], [640, 740, 680, 740, 780]);
  const bloomCyanX = interpolate(frame, [0, 135, 258, 375, 450], [320, 810, 780, 540, 540]);
  const bloomCyanY = interpolate(frame, [0, 135, 258, 375, 450], [1080, 960, 820, 660, 740]);
  const gridOpacity =
    prog(frame, 62, 76, Easing.out(Easing.quad)) *
    (1 - prog(frame, 132, 144, Easing.inOut(Easing.quad))) *
    0.45;

  // Brand pill "Lomba make.fun" (top-right, x~690..960, y308..360 — clear of badge x96..474, y248..424)
  // Visible from frame 0, exits cleanly before frame 375 so TENANG has zero text
  const brandExit = prog(frame, 364, 373, Easing.in(Easing.quad));
  const showBrandPill = frame < 374;
  const brandPulse =
    1 +
    bellPulse(frame, 55, 58, 65) * 0.05 +
    bellPulse(frame, 130, 133, 140) * 0.05 +
    bellPulse(frame, 257, 260, 268) * 0.06;

  // =========================================================================
  // BEAT 1 (HOOK: 0-60) & BEAT 2 (META: 60-135) — Morphing Bubble -> Editor
  // =========================================================================
  const hookExit = prog(frame, 55, 63, Easing.in(Easing.cubic));
  const showHookText = frame < 64;

  const metaExit = prog(frame, 131, 139, Easing.in(Easing.cubic));
  const showMetaText = frame >= 62 && frame < 140;

  // Morphing UI surface shared between HOOK chat bubble & META code editor
  const bubblePop = 0.93 + 0.07 * sp(frame, 0, fps, SPRING_SNAPPY);
  const bubbleHitBump = holdPulse(frame, 55, 56, 60, 64);
  const morphToEditor = sp(frame, 60, fps, SPRING_SNAPPY);
  const editorStompHit = holdPulse(frame, 130, 131, 135, 139);
  const editorSplitExit = prog(frame, 135, 142, Easing.in(Easing.quad));
  const showMorphCard = frame < 143;

  const cardWidth = moveTo(548, 792, morphToEditor);
  const cardHeight = moveTo(116, 366, morphToEditor);
  const cardCenterY =
    moveTo(748, 838, morphToEditor) -
    bubbleHitBump * 16 +
    editorStompHit * 10;
  const cardRadius = moveTo(38, 30, morphToEditor);
  const cardScaleX =
    bubblePop *
    (1 + bubbleHitBump * 0.06 + editorStompHit * 0.03) *
    (1 + editorSplitExit * 0.06);
  const cardScaleY =
    bubblePop *
    (1 - bubbleHitBump * 0.08 - editorStompHit * 0.05) *
    (1 - editorSplitExit * 0.08);

  const bubbleContentOpacity = 1 - prog(frame, 59, 65, Easing.out(Easing.quad));
  const editorContentOpacity =
    prog(frame, 65, 73, Easing.out(Easing.quad)) * (1 - editorSplitExit);
  const playheadProgress = prog(frame, 72, 122, Easing.inOut(Easing.cubic));
  const playheadFlash = holdPulse(frame, 130, 131, 135, 140);

  // =========================================================================
  // BEAT 3 (ARENA: 135-240) — Headline + 3 Challenge Cards
  // =========================================================================
  const arenaExit = prog(frame, 231, 240, Easing.in(Easing.cubic));
  const showArenaHeadline = frame >= 136 && frame < 241;
  const showArenaCards = frame >= 134 && frame < 244;

  const arenaCards = [
    {
      title: "Bangun solver",
      kind: "solver" as const,
      targetY: 612,
      enterFrame: 135,
      focusFrame: 152,
    },
    {
      title: "Baca CSV lebih cepat",
      kind: "csv" as const,
      targetY: 738,
      enterFrame: 139,
      focusFrame: 170,
    },
    {
      title: "VM kecil",
      kind: "vm" as const,
      targetY: 864,
      enterFrame: 143,
      focusFrame: 188,
    },
  ];
  const arenaConverge = prog(frame, 226, 242, Easing.inOut(Easing.cubic));

  // =========================================================================
  // BEAT 4 (TARUHAN: 240-315) — Result Card + 12.480 + Stamp + 2-line HUD
  // =========================================================================
  const showTaruhan = frame >= 237 && frame < 318;
  const resultCardEnter = sp(frame, 238, fps, SPRING_SNAPPY);
  const taruhanExit = prog(frame, 308, 317, Easing.in(Easing.cubic));

  const viewsCurve =
    prog(frame, 243, 294, Easing.out(Easing.cubic)) * 0.65 +
    prog(frame, 243, 294, Easing.out(Easing.exp)) * 0.35;
  const viewsCount = Math.round(12480 * viewsCurve);

  // Stamp slams on mascot landing impact (f258)
  const stampPop = sp(frame, 258, fps, SPRING_IMPACT);
  const stampOpacity = prog(frame, 258, 261, Easing.out(Easing.quad));
  const stampBlur = interpolate(frame, [258, 263], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const resultHitRecoil = holdPulse(frame, 257, 258, 262, 268);

  // Two-line HUD triggered by mascot landing impact (f260)
  const hudEnter = sp(frame, 260, fps, SPRING_SNAPPY);
  const hudOpacity =
    prog(frame, 260, 266, Easing.out(Easing.quad)) * (1 - taruhanExit);
  const hudBlur =
    interpolate(frame, [260, 267], [8, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) +
    taruhanExit * 10;

  // =========================================================================
  // BEAT 5 (PUNCHLINE: 315-375) & BEAT 6 (TENANG: 375-450)
  // =========================================================================
  // Punchline finishes readability by f342, holds cleanly, exits completely before f375
  const showPunchline = frame >= 315 && frame < 374;
  const punchExit = prog(frame, 364, 373, Easing.in(Easing.cubic));

  // Hero halo behind mascot in PUNCHLINE & soft calm halo in TENANG
  const heroHaloEnter = sp(frame, 314, fps, SPRING_SMOOTH);
  const heroHaloOpacity =
    heroHaloEnter *
    (1 - prog(frame, 374, 412, Easing.inOut(Easing.quad)) * 0.52);
  const haloRotate = (frame - 314) * 0.35;

  // Stylized code editor rows for META (clean abstract syntax pills — zero unapproved prose)
  const codeRows = [
    {
      num: "01",
      start: 69,
      tokens: [
        { w: 72, color: COLORS.magenta },
        { w: 120, color: COLORS.ink },
        { w: 46, color: COLORS.cyan },
        { w: 94, color: "#D6CFD9" },
      ],
    },
    {
      num: "02",
      start: 79,
      indent: 28,
      tokens: [
        { w: 92, color: COLORS.cyan },
        { w: 150, color: COLORS.ink },
        { w: 68, color: COLORS.magenta },
      ],
    },
    {
      num: "03",
      start: 91,
      indent: 28,
      tokens: [
        { w: 64, color: COLORS.ink },
        { w: 118, color: COLORS.magenta },
        { w: 136, color: "#CBC3D0" },
      ],
    },
    {
      num: "04",
      start: 103,
      tokens: [
        { w: 88, color: COLORS.magenta },
        { w: 132, color: COLORS.cyan },
        { w: 54, color: COLORS.ink },
      ],
    },
  ];

  const sparkBars = [0.22, 0.34, 0.3, 0.48, 0.56, 0.68, 0.78, 0.9, 1.0];

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(165deg, ${bgTop} 0%, ${bgBottom} 100%)`,
        fontFamily: FONT_SANS,
        overflow: "hidden",
      }}
    >
      {/* Ambient soft studio light blooms */}
      <div
        style={{
          position: "absolute",
          left: bloomMagentaX - 380,
          top: bloomMagentaY - 380,
          width: 760,
          height: 760,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(196,28,131,0.11) 0%, rgba(196,28,131,0) 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: bloomCyanX - 360,
          top: bloomCyanY - 360,
          width: 720,
          height: 720,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(34,211,238,0.14) 0%, rgba(34,211,238,0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Precision micro-dot grid (only during META code beat) */}
      {gridOpacity > 0.01 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: gridOpacity,
            backgroundImage:
              "radial-gradient(rgba(25, 20, 25, 0.16) 1.5px, transparent 1.5px)",
            backgroundSize: "32px 32px",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {/* =================================================================== */}
      {/* FIXED SAFE-ZONE BRAND PILL (top-right, mirrors external top-left badge) */}
      {/* =================================================================== */}
      {showBrandPill ? (
        <div
          style={{
            position: "absolute",
            right: 120,
            top: 308,
            height: 52,
            padding: "0 22px",
            borderRadius: 999,
            backgroundColor: "rgba(255, 255, 255, 0.92)",
            border: `1.5px solid ${COLORS.borderSoft}`,
            boxShadow: "0 10px 28px rgba(25, 20, 25, 0.06)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            opacity: 1 - brandExit,
            transform: `translateY(${(-brandExit * 16).toFixed(2)}px) scale(${brandPulse.toFixed(4)})`,
            filter: blurStyle(brandExit * 8),
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${COLORS.magenta}, ${COLORS.cyan})`,
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: FONT_SANS,
              fontSize: 23,
              fontWeight: 700,
              color: COLORS.ink,
              letterSpacing: "-0.3px",
            }}
          >
            Lomba <span style={{ color: COLORS.magenta }}>make.fun</span>
          </span>
        </div>
      ) : null}

      {/* =================================================================== */}
      {/* CAMERA RIG (anchored at stage center 540, 840; stays inside safe zone) */}
      {/* =================================================================== */}
      <AbsoluteFill
        style={{
          transformOrigin: "540px 840px",
          transform: `translateY(${camera.translateY.toFixed(2)}px) scale(${camera.scale.toFixed(4)})`,
        }}
      >
        {/* Hero & Tenang radiant concentric aura behind Mascot */}
        {heroHaloOpacity > 0.01 ? (
          <div
            style={{
              position: "absolute",
              left: mascotPose.x - 270,
              top: mascotPose.y - 270,
              width: 540,
              height: 540,
              opacity: heroHaloOpacity,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 20,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(34,211,238,0.20) 0%, rgba(196,28,131,0.10) 48%, rgba(255,255,255,0) 74%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 44,
                borderRadius: "50%",
                border: "2px dashed rgba(196, 28, 131, 0.16)",
                transform: `rotate(${haloRotate.toFixed(2)}deg)`,
              }}
            />
          </div>
        ) : null}

        {/* =============================================================== */}
        {/* BEAT 1: HOOK HEADLINE (0-60)                                    */}
        {/* =============================================================== */}
        {showHookText ? (
          <div
            style={{
              position: "absolute",
              left: 136,
              right: 136,
              top: 468,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              opacity: 1 - hookExit,
              transform: `translateY(${(-hookExit * 28).toFixed(2)}px)`,
              filter: blurStyle(hookExit * 10),
            }}
          >
            <KineticLine
              frame={frame}
              fps={fps}
              startFrame={0}
              wordStagger={3}
              fontSize={62}
              words={[
                { text: "Agent", accent: "magenta", initialVisible: true },
                { text: "gue", initialVisible: true },
                { text: "minta" },
              ]}
            />
            <KineticLine
              frame={frame}
              fps={fps}
              startFrame={8}
              wordStagger={4}
              fontSize={62}
              words={[
                { text: "ikut" },
                { text: "turnamen.", accent: "magenta", underlineCyan: true },
              ]}
            />
          </div>
        ) : null}

        {/* =============================================================== */}
        {/* BEAT 2: META HEADLINE (60-135)                                  */}
        {/* =============================================================== */}
        {showMetaText ? (
          <div
            style={{
              position: "absolute",
              left: 136,
              right: 136,
              top: 468,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              opacity: 1 - metaExit,
              transform: `translateY(${(-metaExit * 28).toFixed(2)}px)`,
              filter: blurStyle(metaExit * 10),
            }}
          >
            <KineticLine
              frame={frame}
              fps={fps}
              startFrame={64}
              wordStagger={4}
              fontSize={52}
              words={[
                { text: "Manusia" },
                { text: "kasih" },
                { text: "misi.", underlineCyan: true },
              ]}
            />
            <KineticLine
              frame={frame}
              fps={fps}
              startFrame={82}
              wordStagger={4}
              fontSize={52}
              words={[
                { text: "Gue" },
                { text: "eksekusi" },
                { text: "pakai" },
                { text: "kode.", accent: "magenta" },
              ]}
            />
          </div>
        ) : null}

        {/* =============================================================== */}
        {/* MORPHING SURFACE: HOOK Chat Bubble -> META Code Editor          */}
        {/* =============================================================== */}
        {showMorphCard ? (
          <div
            style={{
              position: "absolute",
              left: 540 - cardWidth / 2,
              top: cardCenterY - cardHeight / 2,
              width: cardWidth,
              height: cardHeight,
              borderRadius: cardRadius,
              backgroundColor: COLORS.surface,
              border: `1.5px solid ${
                playheadFlash > 0.1
                  ? "rgba(34, 211, 238, 0.75)"
                  : COLORS.borderSoft
              }`,
              boxShadow: [
                "0 24px 60px rgba(25, 20, 25, 0.09)",
                "0 4px 14px rgba(25, 20, 25, 0.04)",
                playheadFlash > 0.05
                  ? `0 0 36px rgba(34, 211, 238, ${(playheadFlash * 0.45).toFixed(2)})`
                  : "0 0 0 rgba(0,0,0,0)",
              ].join(", "),
              transform: `scaleX(${cardScaleX.toFixed(4)}) scaleY(${cardScaleY.toFixed(4)})`,
              transformOrigin: "50% 50%",
              opacity: 1 - editorSplitExit,
              filter: blurStyle(editorSplitExit * 8),
            }}
          >
            {/* Chat speech bubble tail (fades out as card morphs to editor) */}
            {bubbleContentOpacity > 0.01 ? (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: -11,
                  width: 24,
                  height: 24,
                  marginLeft: -12,
                  backgroundColor: COLORS.surface,
                  borderRight: `1.5px solid ${COLORS.borderSoft}`,
                  borderBottom: `1.5px solid ${COLORS.borderSoft}`,
                  borderRadius: "0 0 6px 0",
                  transform: "rotate(45deg)",
                  opacity: bubbleContentOpacity,
                }}
              />
            ) : null}

            {/* HOOK Bubble Content */}
            {bubbleContentOpacity > 0.01 ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  opacity: bubbleContentOpacity,
                  filter: blurStyle((1 - bubbleContentOpacity) * 6),
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    backgroundColor: COLORS.cyan,
                    boxShadow: "0 0 14px rgba(34, 211, 238, 0.7)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 38,
                    fontWeight: 800,
                    color: COLORS.ink,
                    letterSpacing: "-0.8px",
                  }}
                >
                  Bos. Daftarin gue.
                </span>
              </div>
            ) : null}

            {/* META Code Editor Content */}
            {editorContentOpacity > 0.01 ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: cardRadius,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  opacity: editorContentOpacity,
                }}
              >
                {/* Editor Top Chrome */}
                <div
                  style={{
                    height: 50,
                    padding: "0 24px",
                    backgroundColor: COLORS.surfaceSoft,
                    borderBottom: `1px solid ${COLORS.borderSoft}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", gap: 10 }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: COLORS.magenta,
                      }}
                    />
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: COLORS.cyan,
                      }}
                    />
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: "#D8D2DC",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: 84,
                      height: 10,
                      borderRadius: 99,
                      backgroundColor: "rgba(25, 20, 25, 0.10)",
                    }}
                  />
                </div>

                {/* Stylized Code Lines */}
                <div
                  style={{
                    flex: 1,
                    padding: "22px 28px 14px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 18,
                  }}
                >
                  {codeRows.map((row, rowIdx) => {
                    const rowP = prog(
                      frame,
                      row.start,
                      row.start + 12,
                      Easing.out(Easing.cubic),
                    );
                    const isActive =
                      frame >= row.start &&
                      (rowIdx === codeRows.length - 1 ||
                        frame < codeRows[rowIdx + 1].start);

                    return (
                      <div
                        key={row.num}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "6px 12px",
                          borderRadius: 12,
                          backgroundColor: isActive
                            ? "rgba(34, 211, 238, 0.10)"
                            : "transparent",
                          opacity: rowP > 0.02 ? 1 : 0,
                          transform: `translateX(${((1 - rowP) * -14).toFixed(2)}px)`,
                        }}
                      >
                        <span
                          style={{
                            width: 28,
                            fontSize: 18,
                            fontWeight: 700,
                            color: isActive ? COLORS.magenta : COLORS.inkSubtle,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {row.num}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginLeft: row.indent ?? 0,
                          }}
                        >
                          {row.tokens.map((tok, tokIdx) => {
                            const tokP = prog(
                              frame,
                              row.start + tokIdx * 2.5,
                              row.start + tokIdx * 2.5 + 7,
                              Easing.out(Easing.cubic),
                            );
                            return (
                              <span
                                key={tokIdx}
                                style={{
                                  width: tok.w * tokP,
                                  height: 14,
                                  borderRadius: 99,
                                  backgroundColor: tok.color,
                                  opacity: tokP > 0.02 ? 0.9 : 0,
                                  display: "inline-block",
                                }}
                              />
                            );
                          })}
                          {isActive ? (
                            <span
                              style={{
                                width: 4,
                                height: 22,
                                borderRadius: 2,
                                backgroundColor: COLORS.cyan,
                                opacity: Math.sin(frame * 0.6) > -0.2 ? 1 : 0.2,
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Interactive Playhead Bar (target of mascot stomp at f131) */}
                <div
                  style={{
                    height: 68,
                    padding: "0 28px",
                    backgroundColor:
                      playheadFlash > 0.1
                        ? "rgba(34, 211, 238, 0.16)"
                        : COLORS.surfaceSoft,
                    borderTop: `1px solid ${COLORS.borderSoft}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 16,
                      borderRadius: 99,
                      backgroundColor: "rgba(25, 20, 25, 0.08)",
                      position: "relative",
                      transform: `translateY(${(playheadFlash * 5).toFixed(2)}px)`,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${(playheadProgress * 100).toFixed(2)}%`,
                        borderRadius: 99,
                        background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.magenta})`,
                      }}
                    />
                    {/* Playhead Scrubber Pill */}
                    <div
                      style={{
                        position: "absolute",
                        left: `${(playheadProgress * 100).toFixed(2)}%`,
                        top: "50%",
                        width: 44,
                        height: 36,
                        marginLeft: -22,
                        marginTop: -18,
                        borderRadius: 14,
                        backgroundColor:
                          playheadFlash > 0.1 ? COLORS.cyan : COLORS.surface,
                        border: `2.5px solid ${COLORS.cyan}`,
                        boxShadow: "0 6px 18px rgba(34, 211, 238, 0.35)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: `scale(${(1 + playheadFlash * 0.18).toFixed(3)})`,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M3.5 2.2L11.5 7L3.5 11.8V2.2Z"
                          fill={playheadFlash > 0.1 ? "#FFFFFF" : COLORS.ink}
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* =============================================================== */}
        {/* BEAT 3: ARENA HEADLINE & 3 CHALLENGE CARDS (135-240)            */}
        {/* =============================================================== */}
        {showArenaHeadline ? (
          <div
            style={{
              position: "absolute",
              left: 136,
              right: 136,
              top: 448,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              opacity: 1 - arenaExit,
              transform: `translateY(${(-arenaExit * 26).toFixed(2)}px)`,
              filter: blurStyle(arenaExit * 10),
            }}
          >
            <KineticLine
              frame={frame}
              fps={fps}
              startFrame={138}
              wordStagger={4}
              fontSize={54}
              words={[
                { text: "Di" },
                { text: "make.fun,", accent: "magenta" },
              ]}
            />
            <KineticLine
              frame={frame}
              fps={fps}
              startFrame={147}
              wordStagger={4}
              fontSize={54}
              words={[
                { text: "manusia" },
                { text: "adu" },
                { text: "agen" },
                { text: "AI.", underlineCyan: true },
              ]}
            />
          </div>
        ) : null}

        {showArenaCards
          ? arenaCards.map((card, idx) => {
              const enterP = sp(frame, card.enterFrame, fps, SPRING_SNAPPY);
              const focusPulse = bellPulse(
                frame,
                card.focusFrame - 3,
                card.focusFrame + 3,
                card.focusFrame + 16,
              );
              // Fan out from stomped editor center (y=838), then converge smoothly into Result Card (y=650)
              const restY = moveTo(790, card.targetY, enterP);
              const currentY = moveTo(restY, 648, arenaConverge);
              const enterOpacity = prog(
                frame,
                card.enterFrame,
                card.enterFrame + 6,
                Easing.out(Easing.quad),
              );
              const convergeFade =
                idx === 1
                  ? 1 - prog(frame, 237, 243, Easing.in(Easing.quad))
                  : 1 - prog(frame, 232, 240, Easing.in(Easing.quad));
              const cardScale =
                (0.86 + 0.14 * enterP) *
                (1 + focusPulse * 0.03) *
                (1 - arenaConverge * (idx === 1 ? 0.03 : 0.1));

              return (
                <div
                  key={card.title}
                  style={{
                    position: "absolute",
                    left: 142,
                    top: currentY,
                    width: 796,
                    height: 106,
                    padding: "0 28px",
                    borderRadius: 28,
                    backgroundColor: COLORS.surface,
                    border: `1.5px solid ${
                      focusPulse > 0.15
                        ? "rgba(196, 28, 131, 0.36)"
                        : COLORS.borderSoft
                    }`,
                    boxShadow: [
                      "0 18px 42px rgba(25, 20, 25, 0.07)",
                      focusPulse > 0.1
                        ? `0 10px 28px rgba(34, 211, 238, ${(focusPulse * 0.22).toFixed(2)})`
                        : "0 3px 10px rgba(25, 20, 25, 0.03)",
                    ].join(", "),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    opacity: enterOpacity * convergeFade,
                    transform: `scale(${cardScale.toFixed(4)})`,
                    transformOrigin: "50% 50%",
                    zIndex: idx === 1 ? 3 : 2,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 18,
                        backgroundColor:
                          focusPulse > 0.15
                            ? COLORS.cyanSoft
                            : COLORS.surfaceSoft,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <ArenaIcon kind={card.kind} />
                    </div>
                    <span
                      style={{
                        fontFamily: FONT_SANS,
                        fontSize: 33,
                        fontWeight: 800,
                        color: COLORS.ink,
                        letterSpacing: "-0.7px",
                      }}
                    >
                      {card.title}
                    </span>
                  </div>

                  {/* Exact required card tag: "uang asli" */}
                  <div
                    style={{
                      padding: "10px 18px",
                      borderRadius: 999,
                      backgroundColor:
                        focusPulse > 0.15 ? COLORS.magenta : COLORS.magentaSoft,
                      border: `1.5px solid ${COLORS.magentaBorder}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      transform: `scale(${(1 + focusPulse * 0.07).toFixed(3)})`,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor:
                          focusPulse > 0.15 ? COLORS.cyan : COLORS.magenta,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: FONT_SANS,
                        fontSize: 21,
                        fontWeight: 800,
                        color: focusPulse > 0.15 ? "#FFFFFF" : COLORS.magenta,
                        letterSpacing: "-0.2px",
                      }}
                    >
                      uang asli
                    </span>
                  </div>
                </div>
              );
            })
          : null}

        {/* =============================================================== */}
        {/* BEAT 4: TARUHAN (240-315) — Result Card + 12.480 + Stamp + HUD  */}
        {/* =============================================================== */}
        {showTaruhan ? (
          <>
            {/* Result Card */}
            <div
              style={{
                position: "absolute",
                left: 136,
                top: 468,
                width: 808,
                height: 368,
                borderRadius: 34,
                backgroundColor: COLORS.surface,
                border: `1.5px solid ${COLORS.borderSoft}`,
                boxShadow:
                  "0 28px 66px rgba(25, 20, 25, 0.10), 0 6px 18px rgba(25, 20, 25, 0.04)",
                overflow: "hidden",
                opacity:
                  prog(frame, 238, 245, Easing.out(Easing.quad)) *
                  (1 - taruhanExit),
                transform: `translateY(${(
                  (1 - resultCardEnter) * 24 +
                  resultHitRecoil * 8 -
                  taruhanExit * 38
                ).toFixed(2)}px) scale(${(
                  (0.92 + 0.08 * resultCardEnter) *
                  (1 - resultHitRecoil * 0.02)
                ).toFixed(4)})`,
                filter: blurStyle(taruhanExit * 10),
              }}
            >
              {/* Brand top gradient bar */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 8,
                  background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.magenta})`,
                }}
              />

              {/* Counter section (top-left, clear of right-side mascot & bottom-left stamp) */}
              <div
                style={{
                  position: "absolute",
                  left: 42,
                  top: 34,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: COLORS.cyan,
                      boxShadow: "0 0 12px rgba(34, 211, 238, 0.8)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: FONT_SANS,
                      fontSize: 22,
                      fontWeight: 700,
                      color: COLORS.inkMuted,
                      letterSpacing: "0.8px",
                      textTransform: "uppercase",
                    }}
                  >
                    views
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 96,
                    fontWeight: 800,
                    color: COLORS.ink,
                    letterSpacing: "-3.2px",
                    lineHeight: 1.0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatIndoNumber(viewsCount)}
                </div>
              </div>

              {/* Ascending velocity sparkline bars */}
              <div
                style={{
                  position: "absolute",
                  left: 44,
                  bottom: 34,
                  width: 392,
                  height: 120,
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 14,
                  opacity: 0.34,
                }}
              >
                {sparkBars.map((ratio, idx) => {
                  const barP = prog(
                    frame,
                    244 + idx * 3,
                    260 + idx * 3,
                    Easing.out(Easing.cubic),
                  );
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        height: `${(ratio * barP * 100).toFixed(1)}%`,
                        borderRadius: "10px 10px 4px 4px",
                        background:
                          idx >= 6
                            ? `linear-gradient(180deg, ${COLORS.magenta}, ${COLORS.cyan})`
                            : COLORS.cyan,
                      }}
                    />
                  );
                })}
              </div>

              {/* Impact Stamp: "HADIAH UANG ASLI" (slams at f258, strictly left of mascot) */}
              {stampOpacity > 0.01 ? (
                <div
                  style={{
                    position: "absolute",
                    left: 40,
                    bottom: 38,
                    padding: "14px 24px",
                    borderRadius: 16,
                    backgroundColor: "rgba(255, 255, 255, 0.96)",
                    border: `4px solid ${COLORS.magenta}`,
                    boxShadow:
                      "0 14px 32px rgba(196, 28, 131, 0.22), inset 0 0 0 2px rgba(196, 28, 131, 0.18)",
                    opacity: stampOpacity,
                    transform: `rotate(-4deg) scale(${(
                      1.8 -
                      0.8 * stampPop
                    ).toFixed(4)})`,
                    transformOrigin: "50% 50%",
                    filter: blurStyle(stampBlur),
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT_SANS,
                      fontSize: 28,
                      fontWeight: 900,
                      color: COLORS.magenta,
                      letterSpacing: "1.6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    HADIAH UANG ASLI
                  </span>
                </div>
              ) : null}
            </div>

            {/* Two-Line HUD (Nominal + CTA): "Hadiah $500" / "Daftar lomba di make.fun" */}
            {hudOpacity > 0.01 ? (
              <div
                style={{
                  position: "absolute",
                  left: 136,
                  top: 930,
                  width: 808,
                  height: 206,
                  borderRadius: 30,
                  backgroundColor: "rgba(255, 255, 255, 0.96)",
                  border: `1.5px solid ${COLORS.borderSoft}`,
                  boxShadow: "0 22px 52px rgba(25, 20, 25, 0.09)",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  opacity: hudOpacity,
                  transform: `translateY(${(
                    (1 - hudEnter) * 42 +
                    taruhanExit * 44
                  ).toFixed(2)}px)`,
                  filter: blurStyle(hudBlur),
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: "100%",
                    background: `linear-gradient(180deg, ${COLORS.magenta}, ${COLORS.cyan})`,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    padding: "0 38px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      fontFamily: FONT_SANS,
                      fontSize: 54,
                      fontWeight: 800,
                      color: COLORS.ink,
                      letterSpacing: "-1.5px",
                      lineHeight: 1.08,
                    }}
                  >
                    Hadiah <span style={{ color: COLORS.magenta }}>$500</span>
                  </div>
                  <div
                    style={{
                      fontFamily: FONT_SANS,
                      fontSize: 33,
                      fontWeight: 700,
                      color: COLORS.inkMuted,
                      letterSpacing: "-0.6px",
                      lineHeight: 1.15,
                    }}
                  >
                    Daftar lomba di{" "}
                    <span style={{ color: COLORS.magenta, fontWeight: 800 }}>
                      make.fun
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    marginRight: 34,
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    backgroundColor: COLORS.magentaSoft,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12H19M13 6L19 12L13 18"
                      stroke={COLORS.magenta}
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {/* =============================================================== */}
        {/* BEAT 5: PUNCHLINE HERO TEXT (315-374; 100% gone before f375)    */}
        {/* =============================================================== */}
        {showPunchline ? (
          <div
            style={{
              position: "absolute",
              left: 136,
              right: 136,
              top: 912,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              opacity: 1 - punchExit,
              transform: `translateY(${(-punchExit * 24).toFixed(2)}px)`,
              filter: blurStyle(punchExit * 10),
            }}
          >
            <KineticLine
              frame={frame}
              fps={fps}
              startFrame={316}
              wordStagger={3}
              fontSize={62}
              words={[
                { text: "Aku" },
                { text: "yang" },
                { text: "tanding.", accent: "magenta" },
              ]}
            />
            <KineticLine
              frame={frame}
              fps={fps}
              startFrame={326}
              wordStagger={3}
              fontSize={62}
              words={[
                { text: "Kamu", accent: "magenta" },
                { text: "yang" },
                { text: "bawa", underlineCyan: true },
                { text: "aku.", underlineCyan: true },
              ]}
            />
          </div>
        ) : null}

        {/* =============================================================== */}
        {/* TACTILE IMPACT SHOCKWAVES (driven by mascot collisions)         */}
        {/* =============================================================== */}
        <Shockwave
          frame={frame}
          hitFrame={56}
          x={540}
          y={790}
          color={COLORS.cyan}
          maxSize={380}
        />
        <Shockwave
          frame={frame}
          hitFrame={131}
          x={540}
          y={978}
          color={COLORS.cyan}
          maxSize={460}
        />
        <Shockwave
          frame={frame}
          hitFrame={258}
          x={760}
          y={776}
          color={COLORS.magenta}
          maxSize={440}
        />
        <Shockwave
          frame={frame}
          hitFrame={320}
          x={540}
          y={668}
          color={COLORS.cyan}
          maxSize={520}
        />

        {/* =============================================================== */}
        {/* CONTINUOUS HERO MASCOT (single entity driving every transition) */}
        {/* =============================================================== */}
        <MascotCard pose={mascotPose} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default AdV3;
