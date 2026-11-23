import React, { useEffect } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  AgentToken,
  CoinField,
  CsvWorld,
  MazeWorld,
  SlotScene,
  StudioBg,
  VmWorld,
} from "./DWorlds";

export const AD_BUNDLE_D_WIDTH = 1080;
export const AD_BUNDLE_D_HEIGHT = 1920;
export const AD_BUNDLE_D_FPS = 30;
export const AD_BUNDLE_D_DURATION = 450;

// ============================================================================
// Single Source of Truth — Verbatim Locked Copy (Zero Additions/Mutations)
// ============================================================================

const COPY = {
  label: "make.fun contest",
  hookHeadline: "How good is your AI agent?",
  taruhanHeadline: "$500 PRIZE POOL",
  punchlineHeadline: "Enter your AI agent on make.fun.",
} as const;

const splitVerbatim = (
  source: string,
  accent: string
): readonly [string, string, string] => {
  const idx = source.indexOf(accent);
  if (idx === -1) {
    return [source, "", ""];
  }
  return [
    source.slice(0, idx),
    source.slice(idx, idx + accent.length),
    source.slice(idx + accent.length),
  ];
};

// ============================================================================
// Timeline Constants (1080x1920, 30fps, 450 frames = f0..f449)
// ============================================================================

const TIMELINE = {
  hook: { from: 0, duration: 60 }, // f0..f59
  meta: { from: 60, duration: 75 }, // f60..f134 (lock ~f105 global = lf 45)
  arenaMaze: { from: 135, duration: 35 }, // f135..f169
  arenaCsv: { from: 170, duration: 35 }, // f170..f204
  arenaVm: { from: 205, duration: 35 }, // f205..f239
  taruhan: { from: 240, duration: 75 }, // f240..f314
  punchline: { from: 315, duration: 60 }, // f315..f374
  tenang: { from: 375, duration: 75 }, // f375..f449
} as const;

// ============================================================================
// Brand Tokens, Typography & Deterministic Curves (No Easing.quart, No Linear)
// ============================================================================

const BRAND = {
  magenta: "#c41c83",
  magentaBright: "#e12896",
  cyan: "#22d3ee",
  ink: "#191419",
  white: "#ffffff",
  lightBgTop: "#faf7f3",
  lightBgMid: "#f3eee7",
  lightBgBottom: "#e7e0d7",
  darkBgTop: "#090910",
  darkBgMid: "#12111d",
  darkBgBottom: "#1a1728",
} as const;

const FONT_DISPLAY =
  '"Plus Jakarta Sans", "Satoshi", "General Sans", "Inter", "SF Pro Display", "Helvetica Neue", sans-serif';

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN = Easing.in(Easing.cubic);
const EASE_IN_OUT = Easing.inOut(Easing.cubic);
const EASE_SLAM = Easing.bezier(0.16, 1, 0.3, 1);
// Non-linear continuous dolly curve with strong velocity all the way to the cut
const EASE_CONTINUOUS = Easing.bezier(0.28, 0.08, 0.62, 0.88);

const CLAMP = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

type BeatTone = "light" | "dark";

// ============================================================================
// Shared Three.js Camera Rig (Deterministic Synchronous + Effect Sync)
// ============================================================================

interface BeatCameraRigProps {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov?: number;
}

const BeatCameraRig: React.FC<BeatCameraRigProps> = ({
  position,
  target,
  fov = 34,
}) => {
  const { camera, invalidate } = useThree();
  const [px, py, pz] = position;
  const [tx, ty, tz] = target;

  // Synchronous update guarantees exact camera pose on single-frame headless renders
  camera.position.set(px, py, pz);
  camera.lookAt(tx, ty, tz);
  if (camera instanceof THREE.PerspectiveCamera && camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();

  useEffect(() => {
    camera.position.set(px, py, pz);
    camera.lookAt(tx, ty, tz);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, invalidate, px, py, pz, tx, ty, tz, fov]);

  return null;
};

// ============================================================================
// Shared Editorial Layers (Backdrop Fallback, Contest Label, Grade & Grain)
// ============================================================================

const BackdropFallback: React.FC<{ tone: BeatTone }> = ({ tone }) => (
  <AbsoluteFill
    style={{
      background:
        tone === "light"
          ? `linear-gradient(180deg, ${BRAND.lightBgTop} 0%, ${BRAND.lightBgMid} 54%, ${BRAND.lightBgBottom} 100%)`
          : `linear-gradient(180deg, ${BRAND.darkBgTop} 0%, ${BRAND.darkBgMid} 54%, ${BRAND.darkBgBottom} 100%)`,
    }}
  />
);

// Strictly inside safe zone x120..960 y269..1248 & clear of badge box x96..474 y248..424
// Anchored top-right at x~685..960, y292..340 — lowercase "make.fun contest" preserved verbatim
const ContestLabel: React.FC<{ tone: BeatTone }> = ({ tone }) => {
  const isLight = tone === "light";
  return (
    <div
      style={{
        position: "absolute",
        top: 292,
        right: 120,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 22px",
        borderRadius: 999,
        background: isLight
          ? "rgba(255, 252, 248, 0.8)"
          : "rgba(14, 13, 24, 0.74)",
        border: isLight
          ? "1.5px solid rgba(25, 20, 25, 0.14)"
          : "1.5px solid rgba(255, 255, 255, 0.16)",
        boxShadow: isLight
          ? "0 8px 24px rgba(25, 20, 25, 0.06)"
          : "0 10px 28px rgba(0, 0, 0, 0.34)",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: isLight ? BRAND.magenta : BRAND.cyan,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.02em",
          lineHeight: 1.2,
          color: isLight ? BRAND.ink : "#f8fafc",
          whiteSpace: "nowrap",
        }}
      >
        {COPY.label}
      </span>
    </div>
  );
};

const EditorialGradeAndGrain: React.FC<{
  tone: BeatTone;
  globalFrame: number;
  calm?: boolean;
  gradeColor?: string;
}> = ({ tone, globalFrame, calm = false, gradeColor }) => {
  const isLight = tone === "light";
  const resolvedGradeColor = gradeColor ?? (isLight ? BRAND.magenta : BRAND.cyan);
  const noiseSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.48'/%3E%3C/svg%3E")`;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Layer 4: Subtle unifying brand grade */}
      <AbsoluteFill
        style={{
          backgroundColor: resolvedGradeColor,
          mixBlendMode: "soft-light",
          opacity: calm ? 0.025 : isLight ? 0.048 : 0.075,
        }}
      />
      <AbsoluteFill
        style={{
          background: isLight
            ? "linear-gradient(180deg, rgba(25,20,25,0.025) 0%, transparent 24%, transparent 76%, rgba(25,20,25,0.055) 100%)"
            : "linear-gradient(180deg, rgba(0,0,0,0.16) 0%, transparent 25%, transparent 72%, rgba(0,0,0,0.28) 100%)",
        }}
      />

      {/* Layer 5: Deterministic procedural grain + studio edge vignette */}
      <AbsoluteFill
        style={{
          backgroundImage: noiseSvg,
          backgroundSize: "220px 220px",
          backgroundPosition: `${(globalFrame * 7) % 220}px ${(globalFrame * 13) % 220}px`,
          opacity: calm ? 0.02 : isLight ? 0.028 : 0.036,
          mixBlendMode: isLight ? "multiply" : "overlay",
        }}
      />
      <AbsoluteFill
        style={{
          background: isLight
            ? "radial-gradient(ellipse at 50% 45%, transparent 60%, rgba(25,20,25,0.09) 100%)"
            : "radial-gradient(ellipse at 50% 45%, transparent 54%, rgba(0,0,0,0.34) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// BEAT 1 — HOOK (f0..f59): Enlarged AgentToken Hero + Sharp f0 Headline
// ============================================================================

const HookBeat: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const glideT = interpolate(localFrame, [0, 57], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });
  // Crisp 2-frame exit whip (lf 58..59) paired with 2-frame entry in META = 4f whip total
  const exitWhipT = interpolate(localFrame, [57, 59], [0, 1], {
    easing: EASE_IN,
    ...CLAMP,
  });

  // Slightly closer camera + enlarged AgentToken dominating center-top like act-01,
  // clearing badge box x96-474 y248-424 and ContestLabel x685-960 y292-340
  const camX = -0.52 + glideT * 0.88;
  const camY = 0.2 - glideT * 0.05;
  const camZ = 8.15 - glideT * 0.47;

  const tokenFloatY = Math.sin((localFrame / 28) * Math.PI) * 0.03;
  const tokenSpinDeg = -10 + glideT * 18;
  const ringGlow = 0.24 + glideT * 0.22;

  // Headline is 100% sharp & full opacity at frame 0 (zero blur, zero fade/slide in)
  const underlineScaleX = interpolate(localFrame, [1, 15], [0.22, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const [leadText, accentText, tailText] = splitVerbatim(
    COPY.hookHeadline,
    "AI agent?"
  );

  const canvasScale = 1 + exitWhipT * 0.055;
  const canvasShiftY = -exitWhipT * 36;
  const textExitY = -exitWhipT * 32;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackdropFallback tone="light" />

      <AbsoluteFill
        style={{
          transform: `translateY(${canvasShiftY}px) scale(${canvasScale})`,
        }}
      >
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          camera={{ fov: 34, near: 0.1, far: 100, position: [-0.52, 0.2, 8.15] }}
          style={{ width: "100%", height: "100%" }}
        >
          <BeatCameraRig
            position={[camX, camY, camZ]}
            target={[0, -0.58, 0]}
            fov={34}
          />
          <StudioBg frame={localFrame} tone="light" withLights />
          <hemisphereLight args={["#ffffff", "#e8dfd6", 0.46]} />
          <pointLight
            position={[2.2, -0.35, 2.5]}
            intensity={0.48}
            distance={6.8}
            color={BRAND.cyan}
          />
          <group position={[0, tokenFloatY, 0]}>
            <AgentToken
              frame={localFrame}
              scale={1.08}
              spin={tokenSpinDeg}
              ringGlow={ringGlow}
              ringFlatness={0}
            />
          </group>
        </ThreeCanvas>
      </AbsoluteFill>

      <ContestLabel tone="light" />

      {/* Headline strictly in safe zone x120..960 y1036..1218 (sharp at f0) */}
      <div
        style={{
          position: "absolute",
          left: 120,
          width: 840,
          top: 1036,
          transform: textExitY === 0 ? "none" : `translateY(${textExitY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 82,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.06,
            color: BRAND.ink,
          }}
        >
          <span>{leadText}</span>
          <span
            style={{
              display: "inline-block",
              position: "relative",
              color: BRAND.magenta,
              whiteSpace: "nowrap",
            }}
          >
            {accentText}
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -8,
                height: 6,
                borderRadius: 4,
                background: BRAND.magenta,
                opacity: 0.3,
                transformOrigin: "0% 50%",
                transform: `scaleX(${underlineScaleX})`,
              }}
            />
          </span>
          <span>{tailText}</span>
        </div>
      </div>

      <EditorialGradeAndGrain
        tone="light"
        globalFrame={TIMELINE.hook.from + localFrame}
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// BEAT 2 — META (f60..f134): SlotScene Glide + Lock (~f105 global, >=15f hold)
// ============================================================================

const MetaBeat: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // 2-frame whip arrival completing HOOK->META 4-frame whip cut
  const enterWhipT = interpolate(localFrame, [0, 2], [1, 0], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const canvasScale = 1 + enterWhipT * 0.045;
  const canvasShiftY = enterWhipT * 28;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackdropFallback tone="light" />

      <AbsoluteFill
        style={{
          transform: `translateY(${canvasShiftY}px) scale(${canvasScale})`,
        }}
      >
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          camera={{ fov: 34, near: 0.1, far: 100, position: [-1.25, 3.4, 14.0] }}
          style={{ width: "100%", height: "100%" }}
        >
          {/* SlotScene mounts its own portrait-calibrated CameraRig & studio lights */}
          <StudioBg frame={localFrame} tone="light" />
          <SlotScene frame={localFrame} tone="light" withCamera />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* No big headline in META — contest label only */}
      <ContestLabel tone="light" />

      <EditorialGradeAndGrain
        tone="light"
        globalFrame={TIMELINE.meta.from + localFrame}
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// BEAT 3 — ARENA (f135..f239): 3 Worlds x 35f (1 ThreeCanvas per world)
// ============================================================================

interface ArenaWorldBeatProps {
  world: "maze" | "csv" | "vm";
  tone: BeatTone;
  globalFrom: number;
  whipIn: "punch" | "right";
  whipOut: "left" | "none";
}

const ArenaWorldBeat: React.FC<ArenaWorldBeatProps> = ({
  world,
  tone,
  globalFrom,
  whipIn,
  whipOut,
}) => {
  const localFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Crisp <=4-frame cut/whip mechanics (2f in / 2f out -> zero exposed canvas edge)
  const inT = interpolate(localFrame, [0, whipIn === "punch" ? 3 : 2], [1, 0], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const outT =
    whipOut === "left"
      ? interpolate(localFrame, [32, 34], [0, 1], {
          easing: EASE_IN,
          ...CLAMP,
        })
      : 0;

  const translateX =
    (whipIn === "right" ? inT * 46 : 0) - (whipOut === "left" ? outT * 46 : 0);
  const scale =
    1 +
    (whipIn === "punch" ? inT * 0.045 : inT * 0.095) +
    (whipOut === "left" ? outT * 0.095 : 0);

  // Remap 35-frame local window across each world's complete 3D choreography:
  // - MazeWorld: f10..83.1 (walls risen on cut-in -> solver completes 14-cell path & beacon pulse)
  // - CsvWorld:  f10..79.7 (populated wave + trailing corner pop -> full traveling wave & orbit)
  // - VmWorld:   f4..70.3  (block #1 drops immediately -> all 6 blocks + hero crown land cleanly)
  const worldFrame =
    world === "maze"
      ? 10 + localFrame * 2.15
      : world === "csv"
        ? 10 + localFrame * 2.05
        : 4 + localFrame * 1.95;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackdropFallback tone={tone} />

      <AbsoluteFill
        style={{
          transform: `translateX(${translateX}px) scale(${scale})`,
        }}
      >
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: tone === "light" ? 1.05 : 1.08,
          }}
          camera={{ fov: 34, near: 0.1, far: 100, position: [0, 4.0, 12.8] }}
          style={{ width: "100%", height: "100%" }}
        >
          <StudioBg frame={localFrame} tone={tone} />
          {world === "maze" && (
            <MazeWorld frame={worldFrame} tone={tone} withCamera />
          )}
          {world === "csv" && (
            <CsvWorld frame={worldFrame} tone={tone} withCamera />
          )}
          {world === "vm" && (
            <VmWorld frame={worldFrame} tone={tone} withCamera />
          )}
        </ThreeCanvas>
      </AbsoluteFill>

      {/* 3D diorama plaques already display "SOLVER" / "CSV" / "TINY VM" */}
      <ContestLabel tone={tone} />

      <EditorialGradeAndGrain tone={tone} globalFrame={globalFrom + localFrame} />
    </AbsoluteFill>
  );
};

// ============================================================================
// BEAT 4 — TARUHAN (f240..f314): CoinField + "$500 PRIZE POOL" Slam & Push-In
// ============================================================================

const TaruhanBeat: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Continuous camera dolly push-in + orbital parallax across all 75 frames
  // (No >30-frame window is ever static or near-identical)
  const pushT = interpolate(localFrame, [0, 74], [0, 1], {
    easing: EASE_CONTINUOUS,
    ...CLAMP,
  });

  // Brief impact micro-jolt synced to "$500" slam hit (settled by lf 13)
  const slamCameraJolt = interpolate(
    localFrame,
    [1, 5, 13],
    [0, -0.14, 0],
    { easing: EASE_OUT, ...CLAMP }
  );

  // Entry 3-frame hard-cut impact scale punch on canvas
  const cutPunch = interpolate(localFrame, [0, 3], [0.045, 0], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  // Custom camera overrides CoinField's gentle default camera to guarantee strong continuous push-in
  const camX = -1.85 + pushT * 3.9;
  const camY = 2.55 - pushT * 1.1 + slamCameraJolt;
  const camZ = 16.2 - pushT * 4.8;
  const targetY = -1.46 + pushT * 0.1;

  // Offset CoinField local time so coins are already mid-bloom at cut-in and orbit throughout
  const coinFrame = 10 + localFrame * 1.15;

  // Headline slam starts f241..245 (within f240..248), 100% sharp & still by f259 (<= f262)
  const amountOpacity = interpolate(localFrame, [1, 6], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const amountScale = interpolate(localFrame, [1, 10, 15], [1.28, 0.985, 1], {
    easing: EASE_SLAM,
    ...CLAMP,
  });
  const amountY = interpolate(localFrame, [1, 10, 15], [-28, 3, 0], {
    easing: EASE_SLAM,
    ...CLAMP,
  });

  const poolOpacity = interpolate(localFrame, [5, 10], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const poolScale = interpolate(localFrame, [5, 14, 19], [1.16, 0.99, 1], {
    easing: EASE_SLAM,
    ...CLAMP,
  });
  const poolY = interpolate(localFrame, [5, 14, 19], [30, -2, 0], {
    easing: EASE_SLAM,
    ...CLAMP,
  });

  const barScaleX = interpolate(localFrame, [8, 19], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const [, amountText, restRaw] = splitVerbatim(COPY.taruhanHeadline, "$500");
  const poolText = restRaw.trimStart();

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackdropFallback tone="dark" />

      <AbsoluteFill style={{ transform: `scale(${1 + cutPunch})` }}>
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.08,
          }}
          camera={{ fov: 34, near: 0.1, far: 100, position: [-1.85, 2.55, 16.2] }}
          style={{ width: "100%", height: "100%" }}
        >
          <BeatCameraRig
            position={[camX, camY, camZ]}
            target={[0, targetY, 0]}
            fov={34}
          />
          <StudioBg frame={localFrame} tone="dark" />
          <CoinField frame={coinFrame} tone="dark" withCamera={false} />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Subtle lower studio contrast scrim keeping "$500 PRIZE POOL" crisp during push-in */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 860,
          bottom: 0,
          background:
            "linear-gradient(180deg, rgba(9,9,16,0) 0%, rgba(9,9,16,0.52) 28%, rgba(9,9,16,0.82) 100%)",
          pointerEvents: "none",
        }}
      />

      <ContestLabel tone="dark" />

      {/* Headline strictly in safe zone x120..960 y972..1204 — settled sharp+still at lf 19 (f259 <= f262) */}
      <div
        style={{
          position: "absolute",
          left: 120,
          width: 840,
          top: 972,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 128,
            fontWeight: 800,
            letterSpacing: "-0.035em",
            lineHeight: 0.96,
            color: BRAND.cyan,
            fontVariantNumeric: "tabular-nums",
            textShadow: "0 0 42px rgba(34, 211, 238, 0.36)",
            opacity: amountOpacity,
            transform: `translateY(${amountY}px) scale(${amountScale})`,
          }}
        >
          {amountText}
        </div>

        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 78,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.04,
            color: BRAND.white,
            opacity: poolOpacity,
            transform: `translateY(${poolY}px) scale(${poolScale})`,
          }}
        >
          {poolText}
        </div>

        <div
          style={{
            width: 196,
            height: 5,
            borderRadius: 4,
            marginTop: 8,
            background: `linear-gradient(90deg, ${BRAND.magenta} 0%, ${BRAND.cyan} 100%)`,
            transformOrigin: "50% 50%",
            transform: `scaleX(${barScaleX})`,
          }}
        />
      </div>

      {/* Magenta dark-studio grade preserves warm gold coin hue (no cyan shift) */}
      <EditorialGradeAndGrain
        tone="dark"
        gradeColor={BRAND.magenta}
        globalFrame={TIMELINE.taruhan.from + localFrame}
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// BEAT 5 — PUNCHLINE (f315..f374): Enlarged AgentToken Hero + CTA Still f330..374
// ============================================================================

const PunchlineBeat: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Crisp 3-frame entry scale punch on cut from dark TARUHAN -> light PUNCHLINE
  const cutPunch = interpolate(localFrame, [0, 3], [0.04, 0], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const settleT = interpolate(localFrame, [0, 15], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const poiseT = interpolate(localFrame, [15, 59], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  // Slightly closer hero presentation matching HookBeat & act-01 while clearing badge box & headline
  const camX = 0.52 * (1 - settleT) - poiseT * 0.14;
  const camY = 0.22 - settleT * 0.04 - poiseT * 0.02;
  const camZ = 8.4 - settleT * 0.42 - poiseT * 0.2;

  // AgentToken opens gracefully out of docked flat ring posture & turns squarely to camera
  const tokenFloatY = Math.sin((localFrame / 30) * Math.PI) * 0.026;
  const tokenSpinDeg = 24 * (1 - settleT) - poiseT * 4;
  const ringFlatness = 0.44 * (1 - settleT) + 0.06;
  const ringGlow =
    interpolate(localFrame, [0, 14], [0.92, 0.52], {
      easing: EASE_OUT,
      ...CLAMP,
    }) -
    poiseT * 0.08;

  // Headline enters lf 0..14 (f315..329), then stays 100% still & sharp across lf 15..59 (f330..374)
  const leadT = interpolate(localFrame, [0, 10], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const ctaT = interpolate(localFrame, [4, 14], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const underlineScaleX = interpolate(localFrame, [6, 14], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const [leadText, ctaText, tailText] = splitVerbatim(
    COPY.punchlineHeadline,
    "make.fun."
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackdropFallback tone="light" />

      <AbsoluteFill style={{ transform: `scale(${1 + cutPunch})` }}>
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          camera={{ fov: 34, near: 0.1, far: 100, position: [0.52, 0.22, 8.4] }}
          style={{ width: "100%", height: "100%" }}
        >
          <BeatCameraRig
            position={[camX, camY, camZ]}
            target={[0, -0.58, 0]}
            fov={34}
          />
          <StudioBg frame={localFrame} tone="light" withLights />
          <hemisphereLight args={["#ffffff", "#e8dfd6", 0.46]} />
          <pointLight
            position={[-2.1, -0.25, 2.4]}
            intensity={0.44}
            distance={6.5}
            color={BRAND.cyan}
          />
          <group position={[0, tokenFloatY, 0]}>
            <AgentToken
              frame={localFrame}
              scale={1.08}
              spin={tokenSpinDeg}
              ringGlow={ringGlow}
              ringFlatness={ringFlatness}
            />
          </group>
        </ThreeCanvas>
      </AbsoluteFill>

      <ContestLabel tone="light" />

      {/* Headline strictly in safe zone x120..960 y1000..1240 — 100% static & sharp f330..374 */}
      <div
        style={{
          position: "absolute",
          left: 120,
          width: 840,
          top: 1000,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 74,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            color: BRAND.ink,
          }}
        >
          <span
            style={{
              display: "inline",
              opacity: leadT,
            }}
          >
            {leadText}
          </span>
          <span
            style={{
              display: "inline-block",
              position: "relative",
              color: BRAND.magenta,
              whiteSpace: "nowrap",
              textShadow: "0 0 28px rgba(196, 28, 131, 0.24)",
              opacity: ctaT,
              transform:
                ctaT === 1
                  ? "none"
                  : `translateY(${(1 - ctaT) * 20}px) scale(${0.96 + ctaT * 0.04})`,
            }}
          >
            {ctaText}
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -7,
                height: 6,
                borderRadius: 4,
                background: BRAND.magenta,
                opacity: 0.34,
                transformOrigin: "0% 50%",
                transform: `scaleX(${underlineScaleX})`,
              }}
            />
          </span>
          <span>{tailText}</span>
        </div>
      </div>

      <EditorialGradeAndGrain
        tone="light"
        globalFrame={TIMELINE.punchline.from + localFrame}
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// BEAT 6 — TENANG (f375..f449): Calm StudioBg End-Card Plate (Zero Text)
// ============================================================================

const TenangBeat: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const driftT = interpolate(localFrame, [0, 74], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  const camX = -0.18 + driftT * 0.36;
  const camY = 0.56 - driftT * 0.06;
  const camZ = 9.4 - driftT * 0.4;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackdropFallback tone="light" />

      <AbsoluteFill>
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.04,
          }}
          camera={{ fov: 34, near: 0.1, far: 100, position: [-0.18, 0.56, 9.4] }}
          style={{ width: "100%", height: "100%" }}
        >
          <BeatCameraRig
            position={[camX, camY, camZ]}
            target={[0, -0.55, 0]}
            fov={34}
          />
          <StudioBg frame={localFrame * 0.5} tone="light" withLights />
          <hemisphereLight args={["#ffffff", "#ece4dc", 0.36]} />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Strictly zero text, zero label, zero badge — clean official ffmpeg end-card plate */}
      <EditorialGradeAndGrain
        tone="light"
        globalFrame={TIMELINE.tenang.from + localFrame}
        calm
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// Root Composition — AdBundleD (1080x1920, 30fps, 450 frames)
// ============================================================================

export const AdBundleD: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence
        from={TIMELINE.hook.from}
        durationInFrames={TIMELINE.hook.duration}
      >
        <HookBeat />
      </Sequence>

      <Sequence
        from={TIMELINE.meta.from}
        durationInFrames={TIMELINE.meta.duration}
      >
        <MetaBeat />
      </Sequence>

      <Sequence
        from={TIMELINE.arenaMaze.from}
        durationInFrames={TIMELINE.arenaMaze.duration}
      >
        <ArenaWorldBeat
          world="maze"
          tone="dark"
          globalFrom={TIMELINE.arenaMaze.from}
          whipIn="punch"
          whipOut="left"
        />
      </Sequence>

      <Sequence
        from={TIMELINE.arenaCsv.from}
        durationInFrames={TIMELINE.arenaCsv.duration}
      >
        <ArenaWorldBeat
          world="csv"
          tone="light"
          globalFrom={TIMELINE.arenaCsv.from}
          whipIn="right"
          whipOut="left"
        />
      </Sequence>

      <Sequence
        from={TIMELINE.arenaVm.from}
        durationInFrames={TIMELINE.arenaVm.duration}
      >
        <ArenaWorldBeat
          world="vm"
          tone="dark"
          globalFrom={TIMELINE.arenaVm.from}
          whipIn="right"
          whipOut="none"
        />
      </Sequence>

      <Sequence
        from={TIMELINE.taruhan.from}
        durationInFrames={TIMELINE.taruhan.duration}
      >
        <TaruhanBeat />
      </Sequence>

      <Sequence
        from={TIMELINE.punchline.from}
        durationInFrames={TIMELINE.punchline.duration}
      >
        <PunchlineBeat />
      </Sequence>

      <Sequence
        from={TIMELINE.tenang.from}
        durationInFrames={TIMELINE.tenang.duration}
      >
        <TenangBeat />
      </Sequence>
    </AbsoluteFill>
  );
};

export default AdBundleD;
