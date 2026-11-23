import React, { useEffect, useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { AgentToken, CoinField, SlotScene, StudioBg } from "./DWorlds";
import { TaskWorld } from "./TaskWorld";

export const AD_TICKET_WIDTH = 1080;
export const AD_TICKET_HEIGHT = 1920;
export const AD_TICKET_FPS = 30;
export const AD_TICKET_DURATION = 450;

// ============================================================================
// Single Source of Truth — Verbatim Copy (Zero Additions / Mutations)
// ============================================================================

const COPY = {
  prizeHeadline: "$500 CASH PRIZE POOL",
  prizeSub: "AI AGENT COMPETITION",
  enterHeadline: "You enter your AI agent.",
  taskHeadline: "It tackles coding challenges.",
  ctaHeadline: "Enter your AI agent on make.fun.",
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
  prize: { from: 0, duration: 75 }, // f0..f74
  enter: { from: 75, duration: 90 }, // f75..f164
  task: { from: 165, duration: 90 }, // f165..f254
  cta: { from: 255, duration: 120 }, // f255..f374
  tenang: { from: 375, duration: 75 }, // f375..f449
} as const;

// ============================================================================
// Brand Tokens, Typography & Deterministic Curves (Zero Linear)
// ============================================================================

const BRAND = {
  magenta: "#c41c83",
  magentaBright: "#e12896",
  cyan: "#22d3ee",
  gold: "#d8b458",
  goldBright: "#e8c86a",
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
const EASE_CONTINUOUS = Easing.bezier(0.28, 0.08, 0.62, 0.88);

const CLAMP = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

type BeatTone = "light" | "dark";

// ============================================================================
// Shared Three.js Camera Rig & CTA Studio Pedestal (useThree Only)
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

const createRadialShadowTexture = (
  rgb: readonly [number, number, number],
  peakAlpha: number
): THREE.Texture => {
  if (typeof document === "undefined") {
    const tex = new THREE.DataTexture(
      new Uint8Array([rgb[0], rgb[1], rgb[2], 0]),
      1,
      1
    );
    tex.needsUpdate = true;
    return tex;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const tex = new THREE.DataTexture(
      new Uint8Array([rgb[0], rgb[1], rgb[2], 0]),
      1,
      1
    );
    tex.needsUpdate = true;
    return tex;
  }
  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 122);
  grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${peakAlpha})`);
  grad.addColorStop(
    0.45,
    `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${peakAlpha * 0.54})`
  );
  grad.addColorStop(
    0.78,
    `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${peakAlpha * 0.14})`
  );
  grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

const CtaStudioPedestal: React.FC<{ frame: number }> = ({ frame }) => {
  const assets = useMemo(() => {
    const shadowTex = createRadialShadowTexture([26, 20, 26], 0.32);
    const glowTex = createRadialShadowTexture([196, 28, 131], 0.24);
    return { shadowTex, glowTex };
  }, []);

  useEffect(() => {
    return () => {
      assets.shadowTex.dispose();
      assets.glowTex.dispose();
    };
  }, [assets]);

  const trimPulse = 0.14 + Math.sin((frame / 28) * Math.PI) * 0.08;

  return (
    <group position={[0, -1.23, 0]}>
      {/* Tapered anodized graphite studio pedestal */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[1.98, 2.18, 0.24, 72]} />
        <meshStandardMaterial
          color="#44414e"
          metalness={0.48}
          roughness={0.36}
          envMapIntensity={1.45}
        />
      </mesh>

      {/* Machined foot collar */}
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <cylinderGeometry args={[2.17, 2.22, 0.04, 72]} />
        <meshStandardMaterial
          color="#302d38"
          metalness={0.78}
          roughness={0.26}
          envMapIntensity={1.4}
        />
      </mesh>

      {/* Satin top deck pad */}
      <mesh position={[0, 0.122, 0]} receiveShadow>
        <cylinderGeometry args={[1.9, 1.92, 0.018, 72]} />
        <meshStandardMaterial color="#54505e" metalness={0.34} roughness={0.44} />
      </mesh>

      {/* Brushed champagne-gold perimeter trim ring */}
      <mesh position={[0, 0.128, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.948, 0.034, 24, 96]} />
        <meshStandardMaterial
          color={BRAND.gold}
          emissive={BRAND.goldBright}
          emissiveIntensity={trimPulse}
          metalness={0.94}
          roughness={0.16}
          envMapIntensity={1.65}
        />
      </mesh>

      {/* Soft contact shadow on studio floor */}
      <mesh position={[0, -0.114, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.9, 4.9]} />
        <meshBasicMaterial
          map={assets.shadowTex}
          transparent
          depthWrite={false}
          opacity={0.86}
        />
      </mesh>

      {/* Subtle magenta studio bounce reflection */}
      <mesh position={[0, -0.11, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.0, 4.1]} />
        <meshBasicMaterial
          map={assets.glowTex}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.22}
        />
      </mesh>
    </group>
  );
};

const CTA_GEMS: ReadonlyArray<{
  pos: readonly [number, number, number];
  scale: number;
  color: string;
  phase: number;
  metalness: number;
  roughness: number;
}> = [
  { pos: [1.96, 0.62, -0.45], scale: 0.105, color: BRAND.magentaBright, phase: 0.4, metalness: 0.2, roughness: 0.12 },
  { pos: [-1.88, 0.34, 0.48], scale: 0.098, color: BRAND.magentaBright, phase: 1.5, metalness: 0.2, roughness: 0.12 },
  { pos: [1.72, -0.18, 0.62], scale: 0.11, color: BRAND.cyan, phase: 2.3, metalness: 0.18, roughness: 0.14 },
  { pos: [1.84, 1.38, -0.68], scale: 0.078, color: "#eeecf2", phase: 3.1, metalness: 0.16, roughness: 0.16 },
  { pos: [-1.72, 1.46, -0.72], scale: 0.074, color: BRAND.gold, phase: 4.0, metalness: 0.9, roughness: 0.16 },
];

// ============================================================================
// Shared Editorial Layers (Backdrop, Word Blur->Sharp Reveal, Grade & Grain)
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

const EditorialGradeAndGrain: React.FC<{
  tone: BeatTone;
  globalFrame: number;
  calm?: boolean;
}> = ({ tone, globalFrame, calm = false }) => {
  const isLight = tone === "light";
  const noiseSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.48'/%3E%3C/svg%3E")`;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          backgroundColor: isLight ? BRAND.magenta : BRAND.cyan,
          mixBlendMode: "soft-light",
          opacity: calm ? 0.025 : isLight ? 0.048 : 0.072,
        }}
      />
      <AbsoluteFill
        style={{
          background: isLight
            ? "linear-gradient(180deg, rgba(25,20,25,0.025) 0%, transparent 24%, transparent 76%, rgba(25,20,25,0.055) 100%)"
            : "linear-gradient(180deg, rgba(0,0,0,0.16) 0%, transparent 25%, transparent 72%, rgba(0,0,0,0.28) 100%)",
        }}
      />
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

interface WordBlurRevealProps {
  text: string;
  localFrame: number;
  startFrame: number;
  staggerFrames: number;
  wordDuration: number;
  fontSize: number;
  baseColor: string;
  accentColor: string;
  accentWordIndices: ReadonlyArray<number>;
  accentTextShadow?: string;
  align?: "left" | "center";
  columnGapPx?: number;
  rowGapPx?: number;
  letterSpacing?: string;
  lineHeight?: number;
  baseTextShadow?: string;
}

const WordBlurReveal: React.FC<WordBlurRevealProps> = ({
  text,
  localFrame,
  startFrame,
  staggerFrames,
  wordDuration,
  fontSize,
  baseColor,
  accentColor,
  accentWordIndices,
  accentTextShadow,
  align = "left",
  columnGapPx = 20,
  rowGapPx = 6,
  letterSpacing = "-0.03em",
  lineHeight = 1.08,
  baseTextShadow,
}) => {
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: align === "center" ? "center" : "flex-start",
        columnGap: columnGapPx,
        rowGap: rowGapPx,
        fontFamily: FONT_DISPLAY,
        fontSize,
        fontWeight: 800,
        letterSpacing,
        lineHeight,
      }}
    >
      {words.map((word, idx) => {
        const wStart = startFrame + idx * staggerFrames;
        const wEnd = wStart + wordDuration;
        const t = interpolate(localFrame, [wStart, wEnd], [0, 1], {
          easing: EASE_OUT,
          ...CLAMP,
        });
        const settled = t >= 0.999;
        const isAccent = accentWordIndices.includes(idx);

        const blurPx = settled ? 0 : (1 - t) * 14;
        const shiftY = settled ? 0 : (1 - t) * 20;
        const scale = settled ? 1 : 0.94 + t * 0.06;

        return (
          <span
            key={idx}
            style={{
              display: "inline-block",
              color: isAccent ? accentColor : baseColor,
              textShadow: isAccent ? accentTextShadow : baseTextShadow,
              opacity: settled ? 1 : t,
              filter: settled ? "none" : `blur(${blurPx.toFixed(2)}px)`,
              transform: settled
                ? "none"
                : `translateY(${shiftY.toFixed(2)}px) scale(${scale.toFixed(4)})`,
              whiteSpace: "nowrap",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ============================================================================
// BEAT 1 — PRIZE (f0..f74): CoinField Hero + "$500 CASH PRIZE POOL" + Sub
// ("$500" 100% sharp at f0; rest resolves blur->sharp <= f15, then still)
// ============================================================================

const PrizeBeat: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Continuous cinematic push-in + orbital parallax across all 75 frames
  const pushT = interpolate(localFrame, [0, 74], [0, 1], {
    easing: EASE_CONTINUOUS,
    ...CLAMP,
  });

  // 2-frame exit whip (lf 72..74) paired with 2-frame arrival in ENTER (= 4f whip total)
  const exitWhipT = interpolate(localFrame, [72, 74], [0, 1], {
    easing: EASE_IN,
    ...CLAMP,
  });

  const camX = -1.9 + pushT * 3.8;
  const camY = 2.45 - pushT * 0.85;
  const camZ = 14.6 - pushT * 3.4;
  const targetY = -0.62 + pushT * 0.14;

  // Offset CoinField frame so all 16 gold coins are already bloomed & gleaming at f0
  const coinFrame = 28 + localFrame * 1.05;

  // Verbatim split: "$500" sharp & full at f0; "CASH PRIZE POOL" resolves blur->sharp by f14
  const [, amountText, restRaw] = splitVerbatim(COPY.prizeHeadline, "$500");
  const restHeadline = restRaw.trimStart();

  // Sub "AI AGENT COMPETITION" resolves blur->sharp at lf 7..15 (<= f15), then still
  const subT = interpolate(localFrame, [7, 15], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const subSettled = subT >= 0.999;
  const subBlurPx = subSettled ? 0 : (1 - subT) * 12;
  const subY = subSettled ? 0 : (1 - subT) * 18;

  const barScaleX = interpolate(localFrame, [5, 14], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const canvasScale = 1 + exitWhipT * 0.055;
  const canvasShiftY = -exitWhipT * 34;
  const textExitY = -exitWhipT * 28;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackdropFallback tone="dark" />

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
            toneMappingExposure: 1.08,
          }}
          camera={{ fov: 34, near: 0.1, far: 100, position: [-1.9, 2.45, 14.6] }}
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

      {/* Focused radial readability scrim behind hero typography so coins gleam at edges */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 84% 46% at 50% 42%, rgba(9,9,16,0.68) 0%, rgba(9,9,16,0.34) 58%, rgba(9,9,16,0) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Full-screen hero typography strictly inside safe zone x120..960 y520..1030 (clear of badge y248..424) */}
      <div
        style={{
          position: "absolute",
          left: 120,
          width: 840,
          top: 520,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          transform: textExitY === 0 ? "none" : `translateY(${textExitY}px)`,
        }}
      >
        {/* "$500" — 100% sharp, opaque & zero-blur from frame 0 (single hero glow) */}
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 204,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 0.94,
            color: BRAND.cyan,
            fontVariantNumeric: "tabular-nums",
            textShadow:
              "0 0 56px rgba(34, 211, 238, 0.42), 0 12px 36px rgba(0, 0, 0, 0.55)",
          }}
        >
          {amountText}
        </div>

        {/* Remaining headline "CASH PRIZE POOL" resolves blur->sharp <= f14, then completely still */}
        <div style={{ marginTop: 18, width: 840 }}>
          <WordBlurReveal
            text={restHeadline}
            localFrame={localFrame}
            startFrame={2}
            staggerFrames={2}
            wordDuration={8}
            fontSize={84}
            baseColor={BRAND.white}
            accentColor={BRAND.white}
            accentWordIndices={[]}
            align="center"
            columnGapPx={24}
            rowGapPx={4}
            letterSpacing="-0.025em"
            lineHeight={1.04}
            baseTextShadow="0 8px 28px rgba(0, 0, 0, 0.52)"
          />
        </div>

        {/* Brand gradient divider bar */}
        <div
          style={{
            width: 220,
            height: 6,
            borderRadius: 4,
            marginTop: 28,
            marginBottom: 24,
            background: `linear-gradient(90deg, ${BRAND.magenta} 0%, ${BRAND.cyan} 100%)`,
            transformOrigin: "50% 50%",
            transform: `scaleX(${barScaleX})`,
          }}
        />

        {/* Sub "AI AGENT COMPETITION" resolves blur->sharp <= f15, then still */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "13px 30px",
            borderRadius: 999,
            background: "rgba(15, 14, 26, 0.72)",
            border: "1.5px solid rgba(255, 255, 255, 0.22)",
            fontFamily: FONT_DISPLAY,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "0.16em",
            lineHeight: 1.2,
            color: BRAND.white,
            whiteSpace: "nowrap",
            opacity: subSettled ? 1 : subT,
            filter: subSettled ? "none" : `blur(${subBlurPx.toFixed(2)}px)`,
            transform: subSettled ? "none" : `translateY(${subY.toFixed(2)}px)`,
          }}
        >
          {COPY.prizeSub}
        </div>
      </div>

      <EditorialGradeAndGrain
        tone="dark"
        globalFrame={TIMELINE.prize.from + localFrame}
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// BEAT 2 — ENTER (f75..f164): SlotScene (Glide + Lock) + "You enter your AI agent."
// ============================================================================

const EnterBeat: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // 2-frame arrival completing PRIZE->ENTER 4-frame whip
  const enterWhipT = interpolate(localFrame, [0, 2], [1, 0], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  // 2-frame lateral whip-out into TASK (paired with 2-frame arrival in TASK = 4f whip)
  const exitWhipT = interpolate(localFrame, [87, 89], [0, 1], {
    easing: EASE_IN,
    ...CLAMP,
  });

  // Portrait-calibrated continuous studio orbit framing SlotScene above bottom headline
  const orbitT = interpolate(localFrame, [0, 89], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });
  const lockPushT = interpolate(localFrame, [44, 89], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const camX = -1.45 + orbitT * 2.75;
  const camY = 2.85 - orbitT * 0.42;
  const camZ = 16.5 - orbitT * 0.65 - lockPushT * 0.55;

  const canvasScale = 1 + enterWhipT * 0.05 + exitWhipT * 0.095;
  const canvasShiftX = -exitWhipT * 46;
  const canvasShiftY = enterWhipT * 30;
  const textExitX = -exitWhipT * 38;

  const underlineScaleX = interpolate(localFrame, [17, 25], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackdropFallback tone="light" />

      <AbsoluteFill
        style={{
          transform: `translate(${canvasShiftX}px, ${canvasShiftY}px) scale(${canvasScale})`,
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
          camera={{ fov: 34, near: 0.1, far: 100, position: [-1.45, 2.85, 16.5] }}
          style={{ width: "100%", height: "100%" }}
        >
          <BeatCameraRig
            position={[camX, camY, camZ]}
            target={[0, -1.48, 0]}
            fov={34}
          />
          <StudioBg frame={localFrame} tone="light" />
          <SlotScene frame={localFrame} tone="light" withCamera={false} />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Soft light studio lower readability wash */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 960,
          bottom: 0,
          background:
            "linear-gradient(180deg, rgba(243,238,231,0) 0%, rgba(243,238,231,0.68) 32%, rgba(235,229,221,0.92) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Verbatim headline strictly inside safe zone x120..960 y1044..1216 */}
      <div
        style={{
          position: "absolute",
          left: 120,
          width: 840,
          top: 1044,
          transform: textExitX === 0 ? "none" : `translateX(${textExitX}px)`,
        }}
      >
        <WordBlurReveal
          text={COPY.enterHeadline}
          localFrame={localFrame}
          startFrame={3}
          staggerFrames={3}
          wordDuration={9}
          fontSize={76}
          baseColor={BRAND.ink}
          accentColor={BRAND.magenta}
          accentWordIndices={[3, 4]}
          accentTextShadow="0 0 26px rgba(196, 28, 131, 0.22)"
          columnGapPx={20}
          rowGapPx={6}
        />
        <div
          style={{
            width: 148,
            height: 6,
            borderRadius: 4,
            marginTop: 14,
            background: BRAND.magenta,
            opacity: 0.36,
            transformOrigin: "0% 50%",
            transform: `scaleX(${underlineScaleX})`,
          }}
        />
      </div>

      <EditorialGradeAndGrain
        tone="light"
        globalFrame={TIMELINE.enter.from + localFrame}
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// BEAT 3 — TASK (f165..f254): TaskWorld (90f) + "It tackles coding challenges."
// ============================================================================

const TaskBeat: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // 2-frame lateral arrival completing ENTER->TASK 4-frame whip
  const enterWhipT = interpolate(localFrame, [0, 2], [1, 0], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  // 2-frame exit punch into CTA (paired with 2-frame arrival in CTA = 4f cut)
  const exitWhipT = interpolate(localFrame, [87, 89], [0, 1], {
    easing: EASE_IN,
    ...CLAMP,
  });

  const canvasScale = 1 + enterWhipT * 0.095 + exitWhipT * 0.055;
  const canvasShiftX = enterWhipT * 46;
  const canvasShiftY = -exitWhipT * 30;
  const textExitY = -exitWhipT * 26;

  const underlineScaleX = interpolate(localFrame, [15, 23], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackdropFallback tone="dark" />

      <AbsoluteFill
        style={{
          transform: `translate(${canvasShiftX}px, ${canvasShiftY}px) scale(${canvasScale})`,
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
            toneMappingExposure: 1.08,
          }}
          camera={{ fov: 34, near: 0.1, far: 100, position: [-2.05, 3.45, 15.6] }}
          style={{ width: "100%", height: "100%" }}
        >
          {/* TaskWorld drives its own continuous frame-based 3D camera & diorama */}
          <StudioBg frame={localFrame} tone="dark" />
          <TaskWorld frame={localFrame} tone="dark" withCamera />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Dark lower readability gradient keeping white + cyan headline crisp */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 940,
          bottom: 0,
          background:
            "linear-gradient(180deg, rgba(9,9,16,0) 0%, rgba(9,9,16,0.62) 32%, rgba(9,9,16,0.88) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Verbatim headline strictly inside safe zone x120..960 y1044..1212 */}
      <div
        style={{
          position: "absolute",
          left: 120,
          width: 840,
          top: 1044,
          transform: textExitY === 0 ? "none" : `translateY(${textExitY}px)`,
        }}
      >
        <WordBlurReveal
          text={COPY.taskHeadline}
          localFrame={localFrame}
          startFrame={3}
          staggerFrames={3}
          wordDuration={9}
          fontSize={74}
          baseColor={BRAND.white}
          accentColor={BRAND.cyan}
          accentWordIndices={[2, 3]}
          accentTextShadow="0 0 34px rgba(34, 211, 238, 0.34)"
          baseTextShadow="0 6px 24px rgba(0, 0, 0, 0.45)"
          columnGapPx={20}
          rowGapPx={6}
        />
        <div
          style={{
            width: 156,
            height: 6,
            borderRadius: 4,
            marginTop: 14,
            background: BRAND.cyan,
            opacity: 0.45,
            transformOrigin: "0% 50%",
            transform: `scaleX(${underlineScaleX})`,
          }}
        />
      </div>

      <EditorialGradeAndGrain
        tone="dark"
        globalFrame={TIMELINE.task.from + localFrame}
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// BEAT 4 — CTA (f255..f374): Upright Large AgentToken on Pedestal + Static CTA
// (Brief pop lf 0..14, then 100% sharp & still through f374; hard cut -> TENANG)
// ============================================================================

const CtaBeat: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // 2-frame arrival completing TASK->CTA 4-frame cut punch
  const cutPunch = interpolate(localFrame, [0, 2], [0.045, 0], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const settleT = interpolate(localFrame, [0, 20], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const poiseT = interpolate(localFrame, [20, 119], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  // Hero studio camera glides smoothly while framing upright AgentToken on pedestal
  const camX = 0.72 * (1 - settleT) - poiseT * 0.46;
  const camY = 1.48 - settleT * 0.12 - poiseT * 0.08;
  const camZ = 14.5 - settleT * 0.45 - poiseT * 0.35;

  const tokenFloatY = Math.sin((localFrame / 32) * Math.PI) * 0.032;
  const tokenSpinDeg = 18 * (1 - settleT) - poiseT * 7;
  const ringGlow =
    interpolate(localFrame, [0, 18], [0.78, 0.44], {
      easing: EASE_OUT,
      ...CLAMP,
    }) +
    Math.sin((localFrame / 28) * Math.PI) * 0.06;

  // Brief crisp pop (lf 0..14), then strictly 100% sharp & motionless through lf 119 (f374)
  const popSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 260, mass: 0.75 },
  });
  const popDone = localFrame >= 15;
  const headlineOpacity = popDone
    ? 1
    : interpolate(localFrame, [0, 7], [0, 1], {
        easing: EASE_OUT,
        ...CLAMP,
      });
  const headlineBlur = popDone
    ? 0
    : interpolate(localFrame, [0, 9], [10, 0], {
        easing: EASE_OUT,
        ...CLAMP,
      });
  const headlineScale = popDone ? 1 : 0.91 + popSpring * 0.09;
  const headlineY = popDone ? 0 : (1 - popSpring) * 24;

  const underlineScaleX = interpolate(localFrame, [5, 14], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const [leadText, domainText, tailText] = splitVerbatim(
    COPY.ctaHeadline,
    "make.fun."
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <BackdropFallback tone="light" />

      <AbsoluteFill
        style={{
          transform: cutPunch === 0 ? "none" : `scale(${1 + cutPunch})`,
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
          camera={{ fov: 34, near: 0.1, far: 100, position: [0.72, 1.48, 14.5] }}
          style={{ width: "100%", height: "100%" }}
        >
          <BeatCameraRig
            position={[camX, camY, camZ]}
            target={[0, -1.48, 0]}
            fov={34}
          />
          <StudioBg frame={localFrame} tone="light" withLights />
          <hemisphereLight args={["#ffffff", "#e8dfd6", 0.48]} />
          <pointLight
            position={[-2.2, 0.35, 2.6]}
            intensity={0.5}
            distance={7.2}
            color={BRAND.cyan}
          />

          {/* Sculptural studio pedestal directly beneath upright AgentToken */}
          <CtaStudioPedestal frame={localFrame} />

          {/* Upright large hero AgentToken poised above pedestal */}
          <group position={[0, 0.28 + tokenFloatY, 0]}>
            <AgentToken
              frame={localFrame + 10}
              scale={1.24}
              spin={tokenSpinDeg}
              ringGlow={ringGlow}
              ringFlatness={0}
            />
          </group>

          {/* Subtle floating studio gem accents */}
          <group>
            {CTA_GEMS.map((g, idx) => {
              const dy = Math.sin((localFrame / 26) * Math.PI + g.phase) * 0.06;
              return (
                <mesh
                  key={idx}
                  position={[g.pos[0], g.pos[1] + dy, g.pos[2]]}
                  rotation={[
                    g.phase + localFrame * 0.018,
                    g.phase * 1.3 + localFrame * 0.022,
                    0.2,
                  ]}
                  scale={g.scale}
                >
                  <octahedronGeometry args={[1, 0]} />
                  <meshPhysicalMaterial
                    color={g.color}
                    metalness={g.metalness}
                    roughness={g.roughness}
                    clearcoat={0.88}
                    clearcoatRoughness={0.1}
                    envMapIntensity={1.6}
                  />
                </mesh>
              );
            })}
          </group>
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Soft light studio lower wash separating CTA headline cleanly */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 960,
          bottom: 0,
          background:
            "linear-gradient(180deg, rgba(243,238,231,0) 0%, rgba(243,238,231,0.72) 32%, rgba(235,229,221,0.94) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Single CTA headline strictly inside safe zone x120..960 y1038..1206 — sharp & still f270..f374 */}
      <div
        style={{
          position: "absolute",
          left: 120,
          width: 840,
          top: 1038,
          opacity: headlineOpacity,
          filter:
            headlineBlur <= 0.05
              ? "none"
              : `blur(${headlineBlur.toFixed(2)}px)`,
          transform: popDone
            ? "none"
            : `translateY(${headlineY.toFixed(2)}px) scale(${headlineScale.toFixed(4)})`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 70,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
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
              textShadow: "0 0 28px rgba(196, 28, 131, 0.25)",
            }}
          >
            {domainText}
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -7,
                height: 6,
                borderRadius: 4,
                background: BRAND.magenta,
                opacity: 0.36,
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
        globalFrame={TIMELINE.cta.from + localFrame}
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// BEAT 5 — TENANG (f375..f449): Calm StudioBg End-Card Plate (Strictly Zero Text)
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

      <EditorialGradeAndGrain
        tone="light"
        globalFrame={TIMELINE.tenang.from + localFrame}
        calm
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// Root Composition — AdTicket (1080x1920, 30fps, 450 frames)
// ============================================================================

export const AdTicket: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence
        from={TIMELINE.prize.from}
        durationInFrames={TIMELINE.prize.duration}
      >
        <PrizeBeat />
      </Sequence>

      <Sequence
        from={TIMELINE.enter.from}
        durationInFrames={TIMELINE.enter.duration}
      >
        <EnterBeat />
      </Sequence>

      <Sequence
        from={TIMELINE.task.from}
        durationInFrames={TIMELINE.task.duration}
      >
        <TaskBeat />
      </Sequence>

      <Sequence
        from={TIMELINE.cta.from}
        durationInFrames={TIMELINE.cta.duration}
      >
        <CtaBeat />
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

export default AdTicket;
