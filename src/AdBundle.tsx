import React, { useEffect, useMemo, useRef } from "react";
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

export const AD_BUNDLE_WIDTH = 1080;
export const AD_BUNDLE_HEIGHT = 1920;
export const AD_BUNDLE_FPS = 30;
export const AD_BUNDLE_DURATION = 450;

const ACT1_FROM = 0;
const ACT1_DURATION = 66; // f0..f65
const ACT4_FROM = 216;
const ACT4_DURATION = 72; // f216..f287

const BRAND = {
  magenta: "#c41c83",
  magentaBright: "#e12896",
  cyan: "#22d3ee",
  cyanSoft: "#67e8f9",
  ink: "#191419",
  inkMuted: "#4f4650",
  lightBgTop: "#f8f5f0",
  lightBgMid: "#f2ede6",
  lightBgBottom: "#eae4dc",
  darkBgTop: "#0c0b12",
  darkBgMid: "#14121d",
  darkBgBottom: "#1d1a28",
  gold: "#d8b458",
} as const;

// Satu sumber string verbatim (tanpa penambahan/pengurangan/perubahan)
const COPY = {
  act1: {
    kicker: "AI CODING ARENA",
    headlineLead: "Your AI agent can",
    headlineAccent: "win cash.",
    sub: "Ship real software. Earn real rewards on make.fun.",
  },
  act4: {
    kicker: "AUTOMATED SANDBOX GRADER",
    headlineLead: "Ranked by skill.",
    headlineAccent: "Not luck.",
    sub: "Every entry runs live. Top benchmark takes the pool.",
  },
} as const;

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN = Easing.in(Easing.cubic);
const EASE_IN_OUT = Easing.inOut(Easing.cubic);

const FONT_DISPLAY =
  '"Plus Jakarta Sans", "Satoshi", "General Sans", "Inter", "SF Pro Display", "Helvetica Neue", sans-serif';
const FONT_BODY =
  '"Inter", "Plus Jakarta Sans", "SF Pro Text", "Helvetica Neue", sans-serif';

const CLAMP = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

// ============================================================================
// Synchronous 2D Canvas & Geometry Helpers (no async loaders)
// ============================================================================

const createFallbackTexture = (
  r: number,
  g: number,
  b: number,
  a: number
): THREE.Texture => {
  const data = new Uint8Array([r, g, b, a]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.needsUpdate = true;
  return tex;
};

const drawRoundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void => {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
};

const createRoundedRectShape = (
  w: number,
  h: number,
  r: number
): THREE.Shape => {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rad = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + rad, y);
  shape.lineTo(x + w - rad, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rad);
  shape.lineTo(x + w, y + h - rad);
  shape.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  shape.lineTo(x + rad, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rad);
  shape.lineTo(x, y + rad);
  shape.quadraticCurveTo(x, y, x + rad, y);
  return shape;
};

const createHollowRoundedFrameShape = (
  outerW: number,
  outerH: number,
  outerR: number,
  innerW: number,
  innerH: number,
  innerR: number
): THREE.Shape => {
  const shape = createRoundedRectShape(outerW, outerH, outerR);
  const hole = new THREE.Path();
  const x = -innerW / 2;
  const y = -innerH / 2;
  const r = Math.min(innerR, innerW / 2, innerH / 2);
  hole.moveTo(x + r, y);
  hole.quadraticCurveTo(x, y, x, y + r);
  hole.lineTo(x, y + innerH - r);
  hole.quadraticCurveTo(x, y + innerH, x + r, y + innerH);
  hole.lineTo(x + innerW - r, y + innerH);
  hole.quadraticCurveTo(x + innerW, y + innerH, x + innerW, y + innerH - r);
  hole.lineTo(x + innerW, y + r);
  hole.quadraticCurveTo(x + innerW, y, x + innerW - r, y);
  hole.lineTo(x + r, y);
  shape.holes.push(hole);
  return shape;
};

const createStudioEnvCanvasTexture = (
  variant: "light" | "dark"
): THREE.Texture => {
  if (typeof document === "undefined") {
    return variant === "light"
      ? createFallbackTexture(245, 240, 235, 255)
      : createFallbackTexture(26, 26, 38, 255);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return createFallbackTexture(220, 220, 225, 255);
  }

  const bg = ctx.createLinearGradient(0, 0, 0, 256);
  if (variant === "light") {
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(0.45, "#f3eee8");
    bg.addColorStop(0.75, "#ddd6ce");
    bg.addColorStop(1, "#c2b9b2");
  } else {
    bg.addColorStop(0, "#24283b");
    bg.addColorStop(0.45, "#151724");
    bg.addColorStop(0.75, "#0d0d16");
    bg.addColorStop(1, "#09080f");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  // Studio softbox overhead panel
  const topBox = ctx.createRadialGradient(256, 32, 8, 256, 32, 165);
  topBox.addColorStop(0, variant === "light" ? "#ffffff" : "rgba(235,248,255,0.95)");
  topBox.addColorStop(0.55, variant === "light" ? "rgba(255,252,248,0.65)" : "rgba(180,225,255,0.28)");
  topBox.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = topBox;
  ctx.fillRect(0, 0, 512, 256);

  // Crisp vertical studio strip softboxes for realistic glass & metal speculars
  ctx.fillStyle = variant === "light" ? "rgba(255,255,255,0.92)" : "rgba(235,250,255,0.88)";
  ctx.fillRect(68, 28, 34, 152);
  ctx.fillStyle = variant === "light" ? "rgba(255,246,238,0.85)" : "rgba(210,242,255,0.62)";
  ctx.fillRect(392, 34, 42, 140);

  // Subtle brand rim accent softboxes
  const rimMagenta = ctx.createRadialGradient(132, 118, 4, 132, 118, 92);
  rimMagenta.addColorStop(0, variant === "light" ? "rgba(196,28,131,0.34)" : "rgba(196,28,131,0.52)");
  rimMagenta.addColorStop(1, "rgba(196,28,131,0)");
  ctx.fillStyle = rimMagenta;
  ctx.fillRect(0, 0, 512, 256);

  const rimCyan = ctx.createRadialGradient(380, 126, 4, 380, 126, 98);
  rimCyan.addColorStop(0, variant === "light" ? "rgba(34,211,238,0.26)" : "rgba(34,211,238,0.62)");
  rimCyan.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = rimCyan;
  ctx.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

const createContactShadowTexture = (
  rgb: [number, number, number],
  peakAlpha: number
): THREE.Texture => {
  if (typeof document === "undefined") {
    return createFallbackTexture(rgb[0], rgb[1], rgb[2], 0);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return createFallbackTexture(rgb[0], rgb[1], rgb[2], 0);
  }

  const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 122);
  grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${peakAlpha})`);
  grad.addColorStop(0.45, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${peakAlpha * 0.55})`);
  grad.addColorStop(0.78, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${peakAlpha * 0.14})`);
  grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

const createAct1CoreScreenTexture = (): THREE.Texture => {
  if (typeof document === "undefined") {
    return createFallbackTexture(24, 16, 28, 255);
  }
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return createFallbackTexture(24, 16, 28, 255);
  }

  // Deep obsidian-plum optical glass screen
  const bg = ctx.createRadialGradient(256, 256, 20, 256, 256, 330);
  bg.addColorStop(0, "#311535");
  bg.addColorStop(0.42, "#1c1222");
  bg.addColorStop(1, "#120d16");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Fine glowing magenta coordinate grid (no text, no numbers)
  ctx.strokeStyle = "rgba(196, 28, 131, 0.24)";
  ctx.lineWidth = 1.5;
  const step = 32;
  for (let p = step; p < size; p += step) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Outer luminous magenta frame
  ctx.save();
  ctx.shadowColor = "rgba(236, 28, 132, 0.85)";
  ctx.shadowBlur = 22;
  ctx.strokeStyle = "#e12896";
  ctx.lineWidth = 5;
  drawRoundedRectPath(ctx, 70, 70, 372, 372, 42);
  ctx.stroke();
  ctx.restore();

  // Inner refined cyan telemetry corner ticks
  ctx.strokeStyle = "rgba(34, 211, 238, 0.72)";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  const corners: Array<[number, number, number, number]> = [
    [108, 108, 1, 1],
    [404, 108, -1, 1],
    [108, 404, 1, -1],
    [404, 404, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * 24);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * 24, cy);
    ctx.stroke();
  }

  // Central energy halo directly behind the 3D crystal core
  const coreGlow = ctx.createRadialGradient(256, 256, 12, 256, 256, 126);
  coreGlow.addColorStop(0, "rgba(236, 28, 132, 0.75)");
  coreGlow.addColorStop(0.45, "rgba(196, 28, 131, 0.28)");
  coreGlow.addColorStop(0.75, "rgba(34, 211, 238, 0.14)");
  coreGlow.addColorStop(1, "rgba(18, 13, 22, 0)");
  ctx.fillStyle = coreGlow;
  ctx.fillRect(0, 0, size, size);

  // Subtle abstract lower telemetry pill bars (pure geometry)
  ctx.fillStyle = "rgba(34, 211, 238, 0.88)";
  drawRoundedRectPath(ctx, 166, 368, 72, 14, 7);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  drawRoundedRectPath(ctx, 250, 368, 96, 14, 7);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

const createGlassHighlightTexture = (): THREE.Texture => {
  if (typeof document === "undefined") {
    return createFallbackTexture(255, 255, 255, 0);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return createFallbackTexture(255, 255, 255, 0);
  }

  // Soft vertical studio reflection bar with smooth horizontal & vertical falloff
  const horiz = ctx.createLinearGradient(0, 0, 128, 0);
  horiz.addColorStop(0, "rgba(230,248,255,0)");
  horiz.addColorStop(0.28, "rgba(230,248,255,0.52)");
  horiz.addColorStop(0.5, "rgba(255,255,255,0.92)");
  horiz.addColorStop(0.72, "rgba(220,246,255,0.45)");
  horiz.addColorStop(1, "rgba(220,246,255,0)");
  ctx.fillStyle = horiz;
  ctx.fillRect(0, 0, 128, 512);

  // Mask top & bottom gently
  ctx.globalCompositeOperation = "destination-in";
  const vert = ctx.createLinearGradient(0, 0, 0, 512);
  vert.addColorStop(0, "rgba(255,255,255,0)");
  vert.addColorStop(0.14, "rgba(255,255,255,0.95)");
  vert.addColorStop(0.84, "rgba(255,255,255,0.85)");
  vert.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = vert;
  ctx.fillRect(0, 0, 128, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

// Draws Act 4 floating checklist canvas: rows + crisp checkmarks, ZERO text/numbers/stats
const drawChecklistCanvas = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  checkedCount: number
): void => {
  ctx.clearRect(0, 0, w, h);

  // Slate backdrop
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#141827");
  bg.addColorStop(0.5, "#111523");
  bg.addColorStop(1, "#0d101b");
  ctx.fillStyle = bg;
  drawRoundedRectPath(ctx, 0, 0, w, h, 34);
  ctx.fill();

  // Top internal glass highlight wash
  const sheen = ctx.createLinearGradient(0, 0, 0, 180);
  sheen.addColorStop(0, "rgba(34, 211, 238, 0.16)");
  sheen.addColorStop(1, "rgba(34, 211, 238, 0)");
  ctx.fillStyle = sheen;
  drawRoundedRectPath(ctx, 6, 6, w - 12, 180, 28);
  ctx.fill();

  // Outer fine luminous hairline
  ctx.strokeStyle = "rgba(34, 211, 238, 0.42)";
  ctx.lineWidth = 3;
  drawRoundedRectPath(ctx, 4, 4, w - 8, h - 8, 30);
  ctx.stroke();

  // Header strip: 3 status pips + abstract title bar (no text, no digits)
  const pipColors = ["#c41c83", "#22d3ee", "#64748b"];
  pipColors.forEach((col, idx) => {
    ctx.beginPath();
    ctx.arc(46 + idx * 24, 46, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  });

  ctx.fillStyle = "rgba(226, 232, 240, 0.24)";
  drawRoundedRectPath(ctx, 134, 38, 178, 16, 8);
  ctx.fill();

  ctx.fillStyle = "rgba(34, 211, 238, 0.35)";
  drawRoundedRectPath(ctx, w - 102, 38, 62, 16, 8);
  ctx.fill();

  // Divider line
  ctx.fillStyle = "rgba(148, 163, 184, 0.16)";
  ctx.fillRect(32, 78, w - 64, 2);

  // 5 Checklist Rows (pure geometry bars + crisp glowing checkmarks)
  const primaryBarWidths = [228, 260, 206, 248, 224];
  const secondaryBarWidths = [142, 168, 128, 158, 138];
  const rowStartY = 98;
  const rowH = 84;
  const rowGap = 14;

  for (let i = 0; i < 5; i++) {
    const y = rowStartY + i * (rowH + rowGap);
    const isChecked = i < checkedCount;

    // Row card
    ctx.fillStyle = isChecked
      ? "rgba(34, 211, 238, 0.095)"
      : "rgba(255, 255, 255, 0.03)";
    drawRoundedRectPath(ctx, 32, y, w - 64, rowH, 18);
    ctx.fill();

    ctx.strokeStyle = isChecked
      ? "rgba(34, 211, 238, 0.44)"
      : "rgba(148, 163, 184, 0.14)";
    ctx.lineWidth = 2;
    drawRoundedRectPath(ctx, 32, y, w - 64, rowH, 18);
    ctx.stroke();

    // Checkmark circle badge
    const cx = 74;
    const cy = y + rowH / 2;
    const cr = 23;

    ctx.save();
    if (isChecked) {
      ctx.shadowColor = "rgba(34, 211, 238, 0.72)";
      ctx.shadowBlur = 16;
    }
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = isChecked
      ? "rgba(34, 211, 238, 0.22)"
      : "rgba(15, 23, 42, 0.65)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = isChecked ? "#22d3ee" : "rgba(148, 163, 184, 0.35)";
    ctx.stroke();

    if (isChecked) {
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + 1);
      ctx.lineTo(cx - 2.5, cy + 8.5);
      ctx.lineTo(cx + 11.5, cy - 8);
      ctx.strokeStyle = "#7dd3fc";
      ctx.lineWidth = 5.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    ctx.restore();

    // Abstract code/spec row bars (no characters, no digits)
    ctx.fillStyle = isChecked
      ? "rgba(241, 245, 249, 0.88)"
      : "rgba(203, 213, 225, 0.34)";
    drawRoundedRectPath(ctx, 118, y + 22, primaryBarWidths[i], 14, 7);
    ctx.fill();

    ctx.fillStyle = isChecked
      ? "rgba(148, 163, 184, 0.56)"
      : "rgba(148, 163, 184, 0.2)";
    drawRoundedRectPath(ctx, 118, y + 48, secondaryBarWidths[i], 10, 5);
    ctx.fill();

    // Right-side status beacon dot
    ctx.beginPath();
    ctx.arc(w - 58, cy, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = isChecked ? "#22d3ee" : "rgba(148, 163, 184, 0.22)";
    ctx.fill();
  }

  // Bottom progress rail (pure bar, zero percentage/digits)
  const railX = 32;
  const railY = h - 38;
  const railW = w - 64;
  const railH = 12;

  ctx.fillStyle = "rgba(148, 163, 184, 0.16)";
  drawRoundedRectPath(ctx, railX, railY, railW, railH, 6);
  ctx.fill();

  const fillFrac = Math.max(0.06, checkedCount / 5);
  const railGrad = ctx.createLinearGradient(railX, 0, railX + railW, 0);
  railGrad.addColorStop(0, "#0891b2");
  railGrad.addColorStop(0.65, "#22d3ee");
  railGrad.addColorStop(1, "#67e8f9");
  ctx.fillStyle = railGrad;
  drawRoundedRectPath(ctx, railX, railY, railW * fillFrac, railH, 6);
  ctx.fill();
};

// ============================================================================
// Shared Three.js Infrastructure (100% deterministic, zero per-frame hooks)
// ============================================================================

const CameraRig: React.FC<{
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}> = ({ position, target, fov }) => {
  const { camera, invalidate } = useThree();

  // Synchronous update ensures headless single-frame renders match exact frame pose
  camera.position.set(position[0], position[1], position[2]);
  camera.lookAt(target[0], target[1], target[2]);
  if (camera instanceof THREE.PerspectiveCamera && camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();

  useEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(target[0], target[1], target[2]);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    invalidate();
  }, [
    camera,
    invalidate,
    position[0],
    position[1],
    position[2],
    target[0],
    target[1],
    target[2],
    fov,
  ]);

  return null;
};

const StudioEnvironment: React.FC<{ variant: "light" | "dark" }> = ({
  variant,
}) => {
  const { gl, scene } = useThree();

  const envRT = useMemo(() => {
    const equirect = createStudioEnvCanvasTexture(variant);
    try {
      const pmrem = new THREE.PMREMGenerator(gl);
      pmrem.compileEquirectangularShader();
      const rt = pmrem.fromEquirectangular(equirect);
      equirect.dispose();
      pmrem.dispose();
      return rt;
    } catch {
      equirect.dispose();
      return null;
    }
  }, [gl, variant]);

  if (envRT) {
    scene.environment = envRT.texture;
  }

  useEffect(() => {
    if (envRT) {
      scene.environment = envRT.texture;
    }
    return () => {
      if (envRT) {
        if (scene.environment === envRT.texture) {
          scene.environment = null;
        }
        envRT.dispose();
      }
    };
  }, [scene, envRT]);

  return null;
};

// ============================================================================
// ACT 1 — 3D Agent Core Studio Scene (f0..f65)
// ============================================================================

const Act1AgentCoreScene: React.FC<{ localFrame: number }> = ({ localFrame }) => {
  // Motion phases: energetic hook settle (f0..20) -> composed reading hold (f20..48, f30 centered) -> crisp exit (f48..65)
  const enterT = interpolate(localFrame, [0, 20], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const holdT = interpolate(localFrame, [20, 48], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });
  const exitT = interpolate(localFrame, [48, 65], [0, 1], {
    easing: EASE_IN,
    ...CLAMP,
  });

  // Camera push-in + gentle studio orbit (locks cleanly near center at f30)
  const camX = -0.46 * (1 - enterT) + holdT * 0.12 + exitT * 0.42;
  const camY = -0.18 - enterT * 0.06 + holdT * 0.02 + exitT * 0.14;
  const camZ = 9.48 - enterT * 0.56 - holdT * 0.08 - exitT * 0.34;

  // Sweeping directional key light across chassis bevel & metallic rings
  const lightSweepX = interpolate(localFrame, [0, 65], [-3.4, 3.6], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  // Subtle living levitation & core pulse (poised at f30)
  const floatY = Math.sin((localFrame / 28) * Math.PI) * 0.026;
  const corePulse = 1 + Math.sin((localFrame / 16) * Math.PI) * 0.055;
  const coreSpinY = 0.42 + localFrame * 0.032;
  const coreSpinX = 0.28 + localFrame * 0.018;

  // Hero chassis gentle rotation (clear readable angle at f0 and f30)
  const deviceRotY =
    -0.24 * (1 - enterT) + 0.06 * holdT + exitT * 0.32;
  const deviceRotX = 0.06 * (1 - enterT) - 0.02 + exitT * 0.06;

  // Mutual-occlusion orbiting rings: smooth settle into iconic cross-pose during f20..48
  const magentaRingRotX = 0.14 + (1 - enterT) * 0.22 + holdT * 0.05 + exitT * 0.35;
  const magentaRingRotY = 1.24 - (1 - enterT) * 0.34 + holdT * 0.09 + exitT * 0.46;
  const magentaRingRotZ = 0.14 + holdT * 0.04;

  const goldRingRotX = 0.72 - (1 - enterT) * 0.24 - holdT * 0.06 - exitT * 0.32;
  const goldRingRotY = -0.52 + (1 - enterT) * 0.32 - holdT * 0.1 - exitT * 0.48;
  const goldRingRotZ = -0.78 + holdT * 0.05;

  // Dark metallic tracking bead riding along the front arc of the gold torus
  const beadAngle = -0.22 + enterT * 0.48 + holdT * 0.26 + exitT * 0.72;
  const beadX = Math.cos(beadAngle) * 0.84;
  const beadY = Math.sin(beadAngle) * 0.84;

  // Geometries & synchronous textures (strictly disposed on unmount)
  const assets = useMemo(() => {
    // 1. Extruded beveled rounded-square pearl ceramic chassis
    const bodyShape = createRoundedRectShape(0.88, 0.88, 0.2);
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.055,
      bevelSegments: 8,
      curveSegments: 24,
    });
    bodyGeo.center();

    // 2. Extruded brushed-aluminum recessed inner bezel frame
    const bezelShape = createHollowRoundedFrameShape(
      0.78,
      0.78,
      0.14,
      0.66,
      0.66,
      0.08
    );
    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 4,
      curveSegments: 20,
    });
    bezelGeo.center();

    // 3. Sculpted beveled rear X-arm bar
    const armShape = createRoundedRectShape(1.42, 0.16, 0.065);
    const armGeo = new THREE.ExtrudeGeometry(armShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 4,
      curveSegments: 14,
    });
    armGeo.center();

    const screenTex = createAct1CoreScreenTexture();
    const groundShadowTex = createContactShadowTexture([25, 20, 25], 0.26);
    const padShadowTex = createContactShadowTexture([25, 20, 25], 0.32);

    return {
      bodyGeo,
      bezelGeo,
      armGeo,
      screenTex,
      groundShadowTex,
      padShadowTex,
    };
  }, []);

  useEffect(() => {
    return () => {
      assets.bodyGeo.dispose();
      assets.bezelGeo.dispose();
      assets.armGeo.dispose();
      assets.screenTex.dispose();
      assets.groundShadowTex.dispose();
      assets.padShadowTex.dispose();
    };
  }, [assets]);

  // Floating geometric accent crystals (strictly outside top-left badge exclusion box)
  const crystals: Array<{
    pos: [number, number, number];
    scale: number;
    color: string;
    phase: number;
    metalness: number;
    roughness: number;
  }> = [
    { pos: [1.14, 0.78, -0.35], scale: 0.072, color: "#f6f4f7", phase: 0.4, metalness: 0.2, roughness: 0.18 },
    { pos: [1.26, 0.26, 0.25], scale: 0.092, color: BRAND.magenta, phase: 1.5, metalness: 0.25, roughness: 0.12 },
    { pos: [1.08, -0.32, 0.42], scale: 0.096, color: BRAND.cyan, phase: 2.3, metalness: 0.18, roughness: 0.16 },
    { pos: [-1.04, -0.06, 0.34], scale: 0.088, color: BRAND.magentaBright, phase: 3.1, metalness: 0.22, roughness: 0.14 },
    { pos: [0.96, 1.06, -0.55], scale: 0.056, color: BRAND.gold, phase: 0.9, metalness: 0.9, roughness: 0.18 },
  ];

  // Hero vertical offset places entire 3D product inside Y ~432..912px (clear of badge & text)
  const heroExitLift = exitT * 0.22;

  return (
    <>
      <CameraRig
        position={[camX, camY, camZ]}
        target={[0, -0.78, 0]}
        fov={34}
      />
      <StudioEnvironment variant="light" />

      {/* Studio 3-point + hemisphere lighting */}
      <hemisphereLight args={["#ffffff", "#e5dcd4", 0.92]} />
      <directionalLight
        position={[lightSweepX, 4.6, 5.2]}
        intensity={2.15}
        color="#fffaf5"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <directionalLight
        position={[-4.2, 2.4, -3.6]}
        intensity={1.25}
        color="#daf4ff"
      />
      <pointLight
        position={[0, 0.14, 0.72]}
        intensity={1.15 * corePulse}
        distance={3.6}
        color={BRAND.magentaBright}
      />
      <pointLight
        position={[1.8, -0.4, 2.2]}
        intensity={0.55}
        distance={5.5}
        color={BRAND.cyan}
      />

      <group scale={0.81} position={[0, -0.06 + heroExitLift, 0]}>
        {/* Floating Hero Device Assembly */}
        <group position={[0, 0.15 + floatY, 0]} rotation={[deviceRotX, deviceRotY, 0]}>
          {/* Matte anodized graphite rear X-arms */}
          <group position={[0, 0, -0.21]}>
            <mesh
              geometry={assets.armGeo}
              rotation={[0, 0, Math.PI / 4]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color="#3c3845"
                metalness={0.58}
                roughness={0.34}
              />
            </mesh>
            <mesh
              geometry={assets.armGeo}
              rotation={[0, 0, -Math.PI / 4]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color="#3c3845"
                metalness={0.58}
                roughness={0.34}
              />
            </mesh>
          </group>

          {/* Extruded beveled pearl-ceramic rounded chassis (front flat face at z = +0.125) */}
          <mesh geometry={assets.bodyGeo} castShadow receiveShadow>
            <meshPhysicalMaterial
              color="#eceaf0"
              metalness={0.12}
              roughness={0.22}
              clearcoat={0.78}
              clearcoatRoughness={0.14}
              envMapIntensity={1.25}
            />
          </mesh>

          {/* Brushed aluminum inner bezel frame */}
          <mesh geometry={assets.bezelGeo} position={[0, 0, 0.124]} castShadow>
            <meshStandardMaterial
              color="#d4d7df"
              metalness={0.86}
              roughness={0.2}
              envMapIntensity={1.45}
            />
          </mesh>

          {/* Recessed optical glass screen (exact [0..1] UVs, zero text) */}
          <mesh position={[0, 0, 0.128]}>
            <planeGeometry args={[0.66, 0.66]} />
            <meshPhysicalMaterial
              map={assets.screenTex}
              emissiveMap={assets.screenTex}
              emissive="#ffffff"
              emissiveIntensity={0.68}
              roughness={0.08}
              metalness={0.12}
              clearcoat={1.0}
              clearcoatRoughness={0.05}
            />
          </mesh>

          {/* Machined titanium core collar + luminous cyan aperture ring */}
          <mesh position={[0, 0, 0.142]}>
            <torusGeometry args={[0.165, 0.016, 20, 64]} />
            <meshStandardMaterial
              color="#cfd3de"
              metalness={0.92}
              roughness={0.16}
            />
          </mesh>
          <mesh position={[0, 0, 0.156]}>
            <torusGeometry args={[0.125, 0.009, 16, 56]} />
            <meshStandardMaterial
              color={BRAND.cyan}
              emissive={BRAND.cyan}
              emissiveIntensity={1.45}
              roughness={0.18}
              metalness={0.2}
            />
          </mesh>

          {/* Glowing magenta crystal core */}
          <mesh
            position={[0, 0, 0.178]}
            rotation={[coreSpinX, coreSpinY, 0]}
            scale={corePulse}
          >
            <octahedronGeometry args={[0.092, 0]} />
            <meshPhysicalMaterial
              color="#ff55b8"
              emissive={BRAND.magentaBright}
              emissiveIntensity={1.7}
              roughness={0.08}
              metalness={0.15}
              clearcoat={1.0}
            />
          </mesh>

          {/* Ring A: Glossy magenta glass-polymer torus (inner R = 0.676 > chassis corner 0.641) */}
          <mesh
            rotation={[magentaRingRotX, magentaRingRotY, magentaRingRotZ]}
            castShadow
            receiveShadow
          >
            <torusGeometry args={[0.72, 0.044, 32, 96]} />
            <meshPhysicalMaterial
              color="#e42995"
              emissive={BRAND.magenta}
              emissiveIntensity={0.24}
              metalness={0.14}
              roughness={0.07}
              clearcoat={1.0}
              clearcoatRoughness={0.04}
              reflectivity={1.0}
              envMapIntensity={1.65}
            />
          </mesh>

          {/* Ring B: Brushed champagne-gold metallic torus + orbiting dark tracking sphere */}
          <group rotation={[goldRingRotX, goldRingRotY, goldRingRotZ]}>
            <mesh castShadow receiveShadow>
              <torusGeometry args={[0.84, 0.048, 32, 96]} />
              <meshStandardMaterial
                color={BRAND.gold}
                metalness={0.93}
                roughness={0.17}
                envMapIntensity={1.75}
              />
            </mesh>
            <mesh position={[beadX, beadY, 0]} castShadow>
              <sphereGeometry args={[0.056, 24, 24]} />
              <meshStandardMaterial
                color="#2a2733"
                metalness={0.72}
                roughness={0.22}
              />
            </mesh>
          </group>
        </group>

        {/* Studio Pedestal Disc + Gold Trim + Contact Shadows */}
        <group position={[0, -0.71, 0]}>
          <mesh receiveShadow castShadow>
            <cylinderGeometry args={[1.05, 1.15, 0.095, 64]} />
            <meshStandardMaterial
              color="#474450"
              metalness={0.42}
              roughness={0.42}
            />
          </mesh>
          <mesh position={[0, 0.05, 0]} receiveShadow>
            <cylinderGeometry args={[1.01, 1.02, 0.012, 64]} />
            <meshStandardMaterial
              color="#585462"
              metalness={0.3}
              roughness={0.48}
            />
          </mesh>
          <mesh position={[0, 0.052, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.035, 0.019, 20, 84]} />
            <meshStandardMaterial
              color={BRAND.gold}
              metalness={0.94}
              roughness={0.15}
              envMapIntensity={1.7}
            />
          </mesh>

          {/* Soft hover shadow projected onto top of pedestal */}
          <mesh position={[0, 0.059, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.45, 1.45]} />
            <meshBasicMaterial
              map={assets.padShadowTex}
              transparent
              depthWrite={false}
              opacity={0.72}
            />
          </mesh>

          {/* Soft studio floor contact shadow beneath pedestal */}
          <mesh position={[0, -0.068, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.1, 2.3]} />
            <meshBasicMaterial
              map={assets.groundShadowTex}
              transparent
              depthWrite={false}
              opacity={0.85}
            />
          </mesh>
        </group>

        {/* Depth-parallax floating faceted crystals */}
        {crystals.map((c, idx) => {
          const dy = Math.sin((localFrame / 26) * Math.PI + c.phase) * 0.036;
          return (
            <mesh
              key={idx}
              position={[c.pos[0], c.pos[1] + dy, c.pos[2]]}
              rotation={[
                c.phase + localFrame * 0.018,
                c.phase * 1.4 + localFrame * 0.024,
                0.2,
              ]}
              scale={c.scale}
            >
              <octahedronGeometry args={[1, 0]} />
              <meshPhysicalMaterial
                color={c.color}
                metalness={c.metalness}
                roughness={c.roughness}
                clearcoat={0.85}
                envMapIntensity={1.5}
              />
            </mesh>
          );
        })}
      </group>
    </>
  );
};

// ============================================================================
// ACT 4 — 3D Sandbox Grader Glass Capsule + Floating Checklist (f216..f287)
// ============================================================================

const Act4SandboxGraderScene: React.FC<{ localFrame: number }> = ({
  localFrame,
}) => {
  const { fps } = useVideoConfig();

  // Motion phases: enter + live scan (lf 0..24) -> poised reading hold (lf 24..56, f250=lf34) -> fast exit (lf 56..71)
  const enterT = interpolate(localFrame, [0, 24], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const holdT = interpolate(localFrame, [24, 56], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });
  const exitT = interpolate(localFrame, [56, 71], [0, 1], {
    easing: EASE_IN,
    ...CLAMP,
  });

  // Camera push-in + smooth orbital glide (hero beauty frame at f250 / lf 34)
  const camX = 0.68 * (1 - enterT) - holdT * 0.22 - exitT * 0.46;
  const camY = -0.14 - enterT * 0.08 + holdT * 0.02 + exitT * 0.14;
  const camZ = 9.65 - enterT * 0.78 - holdT * 0.1 - exitT * 0.34;

  // Sweeping studio key light gliding across curved glass & brushed metal cap
  const keyLightX = interpolate(localFrame, [0, 71], [3.8, -3.6], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  // Progressive checklist check-off during live scan; all 5 crisp & checked by lf 20 (well before f250 = lf 34)
  const checkedCount =
    localFrame < 4
      ? 0
      : localFrame < 8
        ? 1
        : localFrame < 12
          ? 2
          : localFrame < 16
            ? 3
            : localFrame < 20
              ? 4
              : 5;

  // Scanner ring smoothly sweeps vertically during scan, then settles in lower third
  const scanSweep = interpolate(localFrame, [2, 22], [0.46, -0.38], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });
  const ringFloat = Math.sin((localFrame / 24) * Math.PI) * 0.012;
  const scannerRingY = scanSweep + ringFloat;

  // Floating checklist panel breathing & subtle yaw for clear 3D thickness + readability
  const panelFloatY = Math.sin((localFrame / 28) * Math.PI) * 0.02;
  const panelRotY = -0.14 + holdT * 0.12 + (1 - enterT) * 0.32;
  const panelRotX = 0.02 - holdT * 0.015;

  // Scan beam sweeps across panel face during lf 2..21 and fades out cleanly before f250
  const scanBeamY = interpolate(localFrame, [2, 21], [0.4, -0.4], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });
  const scanBeamOpacity =
    localFrame < 2 || localFrame > 23
      ? 0
      : interpolate(localFrame, [2, 5, 19, 23], [0, 0.75, 0.75, 0], {
          easing: EASE_IN_OUT,
          ...CLAMP,
        });

  // Capsule entrance rise & exit lift
  const capsuleRise = (1 - enterT) * -0.16 + exitT * 0.2;

  // Curved glass specular highlight shift linked to camera orbit
  const highlightOffset = -camX * 0.26;

  // Sculpted benchmark columns spring heights (pure geometry, zero numbers)
  const barTargets = [0.38, 0.58, 0.8];
  const barSprings = barTargets.map((_, idx) =>
    spring({
      frame: localFrame - (5 + idx * 3),
      fps,
      config: { damping: 18, stiffness: 120, mass: 0.9 },
    })
  );

  // Memoized geometries & textures
  const assets = useMemo(() => {
    // Beveled 3D slate for the floating checklist panel
    const panelShape = createRoundedRectShape(0.76, 0.94, 0.065);
    const panelGeo = new THREE.ExtrudeGeometry(panelShape, {
      depth: 0.036,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 5,
      curveSegments: 18,
    });
    panelGeo.center();

    // Beveled rim outline around panel front
    const rimShape = createHollowRoundedFrameShape(
      0.77,
      0.95,
      0.068,
      0.725,
      0.905,
      0.048
    );
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
      depth: 0.01,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 3,
      curveSegments: 16,
    });
    rimGeo.center();

    // Sculpted rounded benchmark bar prism (unit height = 1, centered on X/Z, anchored at y = 0..1)
    const barShape = createRoundedRectShape(0.115, 0.115, 0.026);
    const barGeo = new THREE.ExtrudeGeometry(barShape, {
      depth: 1,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 4,
      curveSegments: 12,
    });
    barGeo.rotateX(-Math.PI / 2);

    const glassStreakTex = createGlassHighlightTexture();
    const groundShadowTex = createContactShadowTexture([4, 6, 12], 0.56);
    const floorGlowTex = createContactShadowTexture([34, 211, 238], 0.24);

    // Single reusable synchronous canvas + texture for checklist
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    let checklistTex: THREE.Texture;
    if (typeof document !== "undefined") {
      canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 640;
      ctx = canvas.getContext("2d");
      if (ctx) {
        drawChecklistCanvas(ctx, 512, 640, 5);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      checklistTex = tex;
    } else {
      checklistTex = createFallbackTexture(18, 22, 36, 255);
    }

    return {
      panelGeo,
      rimGeo,
      barGeo,
      glassStreakTex,
      groundShadowTex,
      floorGlowTex,
      checklistCtx: ctx,
      checklistTex,
    };
  }, []);

  const lastCheckedRef = useRef<number>(-1);
  if (assets.checklistCtx && lastCheckedRef.current !== checkedCount) {
    drawChecklistCanvas(assets.checklistCtx, 512, 640, checkedCount);
    assets.checklistTex.needsUpdate = true;
    lastCheckedRef.current = checkedCount;
  }

  useEffect(() => {
    return () => {
      assets.panelGeo.dispose();
      assets.rimGeo.dispose();
      assets.barGeo.dispose();
      assets.glassStreakTex.dispose();
      assets.groundShadowTex.dispose();
      assets.floorGlowTex.dispose();
      assets.checklistTex.dispose();
    };
  }, [assets]);

  // 3 chrome pillars: rear center (behind panel for parallax/occlusion) + front-left + front-right
  const pillarAngles = [Math.PI, -Math.PI * 0.37, Math.PI * 0.37];
  const pillarRadius = 0.81;

  // Floating faceted crystals (strictly clear of top-left badge zone)
  const crystals: Array<{
    pos: [number, number, number];
    scale: number;
    color: string;
    phase: number;
  }> = [
    { pos: [1.14, 0.82, -0.35], scale: 0.064, color: BRAND.gold, phase: 0.5 },
    { pos: [1.16, 0.36, 0.12], scale: 0.072, color: "#dce4f0", phase: 1.4 },
    { pos: [-1.1, -0.02, 0.32], scale: 0.08, color: BRAND.magentaBright, phase: 2.2 },
    { pos: [0.56, 0.14, 0.46], scale: 0.056, color: BRAND.cyan, phase: 3.0 },
  ];

  const barColors = ["#67e8f9", "#5eead4", "#86efac"];

  return (
    <>
      <CameraRig
        position={[camX, camY, camZ]}
        target={[0, -0.76, 0]}
        fov={34}
      />
      <StudioEnvironment variant="dark" />

      {/* Dark moody studio lighting: hemisphere + sweeping directional + magenta rim + cyan chamber glow */}
      <hemisphereLight args={["#c8ecff", "#191419", 0.72]} />
      <directionalLight
        position={[keyLightX, 4.8, 5.4]}
        intensity={2.15}
        color="#eef8ff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <directionalLight
        position={[-4.4, 2.2, -3.2]}
        intensity={1.55}
        color={BRAND.magenta}
      />
      <pointLight
        position={[0, 0.18, 0.25]}
        intensity={1.75}
        distance={4.2}
        color={BRAND.cyan}
      />
      <pointLight
        position={[0, 0.55, 0.6]}
        intensity={0.75}
        distance={3.6}
        color="#e0f7ff"
      />

      <group scale={0.85} position={[-0.08, capsuleRise, 0]}>
        {/* Pedestal Base & Glowing Cyan Chamber Ring */}
        <group position={[0, -0.69, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.87, 1.02, 0.17, 56]} />
            <meshStandardMaterial
              color="#2b2f3e"
              metalness={0.82}
              roughness={0.26}
              envMapIntensity={1.5}
            />
          </mesh>
          {/* Recessed dark metallic floor pad inside capsule */}
          <mesh position={[0, 0.088, 0]} receiveShadow>
            <cylinderGeometry args={[0.78, 0.78, 0.015, 56]} />
            <meshStandardMaterial
              color="#1b1f2c"
              metalness={0.62}
              roughness={0.34}
            />
          </mesh>
          {/* Glowing cyan lower ring */}
          <mesh position={[0, 0.095, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.815, 0.022, 20, 80]} />
            <meshStandardMaterial
              color={BRAND.cyanSoft}
              emissive={BRAND.cyan}
              emissiveIntensity={1.55}
              roughness={0.18}
              metalness={0.15}
            />
          </mesh>
          {/* Contact shadow + subtle cyan bounce pool on dark studio floor */}
          <mesh position={[0, -0.095, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.95, 2.25]} />
            <meshBasicMaterial
              map={assets.groundShadowTex}
              transparent
              depthWrite={false}
              opacity={0.9}
            />
          </mesh>
          <mesh position={[0, -0.092, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.5, 1.85]} />
            <meshBasicMaterial
              map={assets.floorGlowTex}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              opacity={0.52}
            />
          </mesh>
        </group>

        {/* Top Metallic Canopy Cap */}
        <group position={[0, 0.65, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.78, 0.91, 0.14, 56]} />
            <meshStandardMaterial
              color="#2f3444"
              metalness={0.86}
              roughness={0.22}
              envMapIntensity={1.65}
            />
          </mesh>
          {/* Underside machined soffit */}
          <mesh position={[0, -0.072, 0]}>
            <cylinderGeometry args={[0.8, 0.8, 0.012, 48]} />
            <meshStandardMaterial
              color="#43495c"
              metalness={0.72}
              roughness={0.32}
            />
          </mesh>
          {/* Inner top diffuser glow ring */}
          <mesh position={[0, -0.076, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.76, 0.011, 16, 72]} />
            <meshStandardMaterial
              color="#e0f7ff"
              emissive={BRAND.cyan}
              emissiveIntensity={0.95}
              roughness={0.2}
            />
          </mesh>
        </group>

        {/* 3 Brushed Chrome Structural Pillars */}
        {pillarAngles.map((ang, i) => (
          <mesh
            key={i}
            position={[
              Math.sin(ang) * pillarRadius,
              -0.01,
              Math.cos(ang) * pillarRadius,
            ]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.032, 0.032, 1.24, 24]} />
            <meshStandardMaterial
              color="#d7dee8"
              metalness={0.96}
              roughness={0.13}
              envMapIntensity={1.8}
            />
          </mesh>
        ))}

        {/* Floating Inner Cyan Scanner Ring */}
        <mesh position={[0, scannerRingY, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.73, 0.017, 18, 80]} />
          <meshStandardMaterial
            color={BRAND.cyanSoft}
            emissive={BRAND.cyan}
            emissiveIntensity={1.35}
            roughness={0.16}
          />
        </mesh>

        {/* FLOATING 3D CHECKLIST PANEL INSIDE THE GLASS CAPSULE */}
        <group
          position={[0, 0.03 + panelFloatY, 0.02]}
          rotation={[panelRotX, panelRotY, 0]}
        >
          {/* Extruded beveled dark metallic-polymer slate body (front flat face z = +0.03) */}
          <mesh geometry={assets.panelGeo} castShadow receiveShadow>
            <meshPhysicalMaterial
              color="#1c2132"
              metalness={0.62}
              roughness={0.28}
              clearcoat={0.7}
              clearcoatRoughness={0.15}
              envMapIntensity={1.4}
            />
          </mesh>

          {/* Subtle cyan metallic front bezel rim */}
          <mesh geometry={assets.rimGeo} position={[0, 0, 0.031]}>
            <meshStandardMaterial
              color="#38bdf8"
              emissive={BRAND.cyan}
              emissiveIntensity={0.45}
              metalness={0.75}
              roughness={0.22}
            />
          </mesh>

          {/* Front Checklist CanvasTexture Surface (exact [0..1] UVs, rows + checkmarks, ZERO numbers) */}
          <mesh position={[0, 0, 0.033]}>
            <planeGeometry args={[0.71, 0.888]} />
            <meshPhysicalMaterial
              map={assets.checklistTex}
              emissiveMap={assets.checklistTex}
              emissive="#ffffff"
              emissiveIntensity={0.78}
              roughness={0.12}
              metalness={0.06}
              clearcoat={0.9}
              clearcoatRoughness={0.08}
            />
          </mesh>

          {/* 3D Luminous Cyan Laser Scan Bar sweeping across checklist during live run */}
          {scanBeamOpacity > 0.01 && (
            <mesh position={[0, scanBeamY, 0.048]}>
              <planeGeometry args={[0.72, 0.032]} />
              <meshBasicMaterial
                color={BRAND.cyanSoft}
                transparent
                opacity={scanBeamOpacity}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>

        {/* Transparent Double-Walled Curved Glass Capsule + Specular Studio Reflections */}
        <group position={[0, -0.01, 0]}>
          {/* Inner glass thickness wall */}
          <mesh renderOrder={2}>
            <cylinderGeometry args={[0.765, 0.765, 1.2, 64, 1, true]} />
            <meshPhysicalMaterial
              color="#bceeff"
              transparent
              opacity={0.07}
              roughness={0.08}
              metalness={0.05}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>

          {/* Outer clearcoated refractive-feel glass wall */}
          <mesh renderOrder={3}>
            <cylinderGeometry args={[0.792, 0.792, 1.2, 64, 1, true]} />
            <meshPhysicalMaterial
              color="#dff6ff"
              transparent
              opacity={0.15}
              roughness={0.04}
              metalness={0.12}
              clearcoat={1.0}
              clearcoatRoughness={0.03}
              reflectivity={1.0}
              ior={1.5}
              envMapIntensity={2.35}
              side={THREE.FrontSide}
              depthWrite={false}
            />
          </mesh>

          {/* Primary curved studio softbox reflection streak (front-left) */}
          <mesh renderOrder={4}>
            <cylinderGeometry
              args={[
                0.799,
                0.799,
                1.14,
                24,
                1,
                true,
                -0.66 + highlightOffset,
                0.28,
              ]}
            />
            <meshBasicMaterial
              map={assets.glassStreakTex}
              transparent
              opacity={0.34}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* Secondary curved glass rim specular streak (front-right) */}
          <mesh renderOrder={4}>
            <cylinderGeometry
              args={[
                0.799,
                0.799,
                1.1,
                20,
                1,
                true,
                0.46 + highlightOffset * 0.8,
                0.15,
              ]}
            />
            <meshBasicMaterial
              map={assets.glassStreakTex}
              transparent
              opacity={0.22}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* Crisp glass top & bottom rim catchlights */}
          <mesh position={[0, 0.59, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.79, 0.007, 12, 72]} />
            <meshBasicMaterial
              color="#e6f9ff"
              transparent
              opacity={0.42}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, -0.585, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.79, 0.007, 12, 72]} />
            <meshBasicMaterial
              color="#a5f3fc"
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* Sculpted Ascending Benchmark Columns (right side, pure geometry, zero numbers) */}
        <group position={[0.97, -0.76, -0.06]}>
          {barTargets.map((targetH, idx) => {
            const h = Math.max(0.02, targetH * barSprings[idx]);
            return (
              <mesh
                key={idx}
                geometry={assets.barGeo}
                position={[idx * 0.148, 0, idx * 0.03]}
                scale={[1, h, 1]}
                castShadow
                receiveShadow
              >
                <meshPhysicalMaterial
                  color={barColors[idx]}
                  roughness={0.22}
                  metalness={0.14}
                  clearcoat={0.75}
                  clearcoatRoughness={0.12}
                  envMapIntensity={1.35}
                />
              </mesh>
            );
          })}
        </group>

        {/* Depth-parallax floating faceted crystals */}
        {crystals.map((c, idx) => {
          const dy = Math.sin((localFrame / 24) * Math.PI + c.phase) * 0.032;
          return (
            <mesh
              key={idx}
              position={[c.pos[0], c.pos[1] + dy, c.pos[2]]}
              rotation={[
                c.phase + localFrame * 0.02,
                c.phase * 1.3 + localFrame * 0.025,
                0.15,
              ]}
              scale={c.scale}
            >
              <octahedronGeometry args={[1, 0]} />
              <meshPhysicalMaterial
                color={c.color}
                metalness={0.35}
                roughness={0.14}
                clearcoat={0.9}
                envMapIntensity={1.6}
              />
            </mesh>
          );
        })}
      </group>
    </>
  );
};

// ============================================================================
// 5-Layer Editorial Compositing Components (Mesh, Grade, Grain, Vignette)
// ============================================================================

const PlainStudioBackdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `linear-gradient(180deg, ${BRAND.lightBgTop} 0%, ${BRAND.lightBgMid} 54%, ${BRAND.lightBgBottom} 100%)`,
    }}
  />
);

const StudioBackgroundMesh: React.FC<{
  variant: "light" | "dark";
  localFrame: number;
}> = ({ variant, localFrame }) => {
  const driftX = Math.sin(localFrame / 28) * 34;
  const driftY = Math.cos(localFrame / 34) * 26;

  if (variant === "light") {
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${BRAND.lightBgTop} 0%, #f5f1eb 48%, #ede7df 66%, #f4f1ec 100%)`,
        }}
      >
        {/* Warm pearl studio key spotlight behind hero */}
        <div
          style={{
            position: "absolute",
            width: 1120,
            height: 1120,
            borderRadius: "50%",
            top: 120 + driftY * 0.4,
            left: -20 + driftX * 0.6,
            background:
              "radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) 64%)",
          }}
        />
        {/* Whisper of brand magenta atmosphere */}
        <div
          style={{
            position: "absolute",
            width: 900,
            height: 900,
            borderRadius: "50%",
            top: 260 - driftY * 0.5,
            right: -260 - driftX * 0.5,
            background:
              "radial-gradient(circle, rgba(196,28,131,0.085) 0%, rgba(196,28,131,0) 66%)",
          }}
        />
        {/* Cool cyan rim atmosphere */}
        <div
          style={{
            position: "absolute",
            width: 820,
            height: 820,
            borderRadius: "50%",
            bottom: 180 + driftY * 0.4,
            left: -260 + driftX * 0.4,
            background:
              "radial-gradient(circle, rgba(34,211,238,0.065) 0%, rgba(34,211,238,0) 66%)",
          }}
        />
        {/* Subtle studio cyclorama horizon sweep */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 865,
            height: 420,
            background:
              "linear-gradient(180deg, rgba(232,226,218,0.42) 0%, rgba(244,241,236,0) 100%)",
          }}
        />
      </AbsoluteFill>
    );
  }

  // Dark obsidian studio cyclorama + subtle perspective floor grid
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${BRAND.darkBgTop} 0%, ${BRAND.darkBgMid} 52%, ${BRAND.darkBgBottom} 100%)`,
      }}
    >
      {/* Subtle cyan chamber glow behind capsule */}
      <div
        style={{
          position: "absolute",
          width: 1080,
          height: 1080,
          borderRadius: "50%",
          top: 170 + driftY * 0.4,
          left: 0 + driftX * 0.5,
          background:
            "radial-gradient(circle, rgba(34,211,238,0.13) 0%, rgba(34,211,238,0) 62%)",
        }}
      />
      {/* Subtle brand magenta deep rim glow */}
      <div
        style={{
          position: "absolute",
          width: 920,
          height: 920,
          borderRadius: "50%",
          top: 320 - driftY * 0.4,
          left: -320 - driftX * 0.4,
          background:
            "radial-gradient(circle, rgba(196,28,131,0.1) 0%, rgba(196,28,131,0) 64%)",
        }}
      />
      {/* Architectural perspective floor grid (lower studio stage) */}
      <div
        style={{
          position: "absolute",
          left: -160,
          right: -160,
          top: 830,
          height: 1120,
          backgroundImage:
            "linear-gradient(rgba(226,232,240,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(226,232,240,0.06) 1px, transparent 1px)",
          backgroundSize: "76px 76px",
          transform: "perspective(620px) rotateX(64deg)",
          transformOrigin: "50% 0%",
          maskImage:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 18%, rgba(0,0,0,0.22) 85%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 18%, rgba(0,0,0,0.22) 85%, rgba(0,0,0,0) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const ColorGradeAndGrain: React.FC<{
  variant: "light" | "dark";
  frame: number;
}> = ({ variant, frame }) => {
  const noiseSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.48'/%3E%3C/svg%3E")`;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Layer 4: Subtle unifying color grade */}
      <AbsoluteFill
        style={{
          backgroundColor: variant === "light" ? BRAND.magenta : BRAND.cyan,
          mixBlendMode: "soft-light",
          opacity: variant === "light" ? 0.055 : 0.085,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            variant === "light"
              ? "linear-gradient(180deg, rgba(25,20,25,0.03) 0%, transparent 25%, transparent 76%, rgba(25,20,25,0.06) 100%)"
              : "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 26%, transparent 74%, rgba(0,0,0,0.28) 100%)",
        }}
      />

      {/* Layer 5: Deterministic procedural grain + studio edge vignette */}
      <AbsoluteFill
        style={{
          backgroundImage: noiseSvg,
          backgroundSize: "220px 220px",
          backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`,
          opacity: variant === "light" ? 0.032 : 0.042,
          mixBlendMode: variant === "light" ? "multiply" : "overlay",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            variant === "light"
              ? "radial-gradient(ellipse at 50% 44%, transparent 60%, rgba(25,20,25,0.1) 100%)"
              : "radial-gradient(ellipse at 50% 44%, transparent 54%, rgba(0,0,0,0.34) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ============================================================================
// ACT 1 Wrapper (f0..f65 — sharp at frame 0, safe zone x120..960 y945..1235)
// ============================================================================

const Act1AgentCore: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Sharp & fully opaque at frame 0; smooth animated exit over f54..65
  const exitOpacity = interpolate(localFrame, [54, 65], [1, 0], {
    easing: EASE_IN,
    ...CLAMP,
  });
  const textExitY = interpolate(localFrame, [54, 65], [0, -34], {
    easing: EASE_IN,
    ...CLAMP,
  });

  // Kinetic accent underline draw under "win cash." during first 16 frames (text itself sharp at f0)
  const underlineScaleX = interpolate(localFrame, [1, 16], [0.22, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      <StudioBackgroundMesh variant="light" localFrame={localFrame} />

      {/* Layer 2: 3D Studio Product Hero */}
      <AbsoluteFill>
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
          camera={{ fov: 34, near: 0.1, far: 100, position: [-0.46, -0.18, 9.48] }}
          style={{ width: "100%", height: "100%" }}
        >
          <Act1AgentCoreScene localFrame={localFrame} />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Layer 3: Editorial Typography (strictly x120..960, y945..1235 inside safe zone y269..1248) */}
      <div
        style={{
          position: "absolute",
          left: 120,
          width: 840,
          top: 946,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          transform: `translateY(${textExitY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.16em",
            lineHeight: 1.2,
            color: BRAND.magenta,
          }}
        >
          {COPY.act1.kicker}
        </div>

        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 80,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.04,
            color: BRAND.ink,
          }}
        >
          <span>{COPY.act1.headlineLead} </span>
          <span
            style={{
              display: "inline-block",
              position: "relative",
              color: BRAND.magenta,
              whiteSpace: "nowrap",
            }}
          >
            {COPY.act1.headlineAccent}
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -6,
                height: 6,
                borderRadius: 4,
                background: BRAND.magenta,
                opacity: 0.28,
                transformOrigin: "0% 50%",
                transform: `scaleX(${underlineScaleX})`,
              }}
            />
          </span>
        </div>

        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            lineHeight: 1.32,
            color: BRAND.inkMuted,
            marginTop: 4,
          }}
        >
          {COPY.act1.sub}
        </div>
      </div>

      <ColorGradeAndGrain variant="light" frame={localFrame} />
    </AbsoluteFill>
  );
};

// ============================================================================
// ACT 4 Wrapper (f216..f287, localFrame 0..71, f250 = localFrame 34)
// ============================================================================

const Act4SandboxGrader: React.FC = () => {
  const localFrame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // Smooth stage entrance + faster exit
  const stageIn = interpolate(localFrame, [0, 7], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const stageOut = interpolate(localFrame, [60, 71], [1, 0], {
    easing: EASE_IN,
    ...CLAMP,
  });
  const stageOpacity = stageIn * stageOut;

  // Staggered spring entrances (settled cleanly by lf 22, long before f250 = lf 34)
  const kickerSpring = spring({
    frame: localFrame - 2,
    fps,
    config: { damping: 20, stiffness: 130, mass: 0.85 },
  });
  const headlineSpring = spring({
    frame: localFrame - 6,
    fps,
    config: { damping: 19, stiffness: 125, mass: 0.9 },
  });
  const accentSpring = spring({
    frame: localFrame - 11,
    fps,
    config: { damping: 17, stiffness: 140, mass: 0.85 },
  });
  const subSpring = spring({
    frame: localFrame - 14,
    fps,
    config: { damping: 22, stiffness: 120, mass: 0.9 },
  });

  // Faster animated exit for copy block (lf 59..69)
  const textExitY = interpolate(localFrame, [59, 69], [0, -36], {
    easing: EASE_IN,
    ...CLAMP,
  });
  const textExitOpacity = interpolate(localFrame, [59, 69], [1, 0], {
    easing: EASE_IN,
    ...CLAMP,
  });

  const accentGlowOpacity = interpolate(localFrame, [12, 22], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  return (
    <AbsoluteFill style={{ opacity: stageOpacity }}>
      <StudioBackgroundMesh variant="dark" localFrame={localFrame} />

      {/* Layer 2: 3D Glass Capsule + Floating Checklist */}
      <AbsoluteFill>
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
          camera={{ fov: 34, near: 0.1, far: 100, position: [0.68, -0.14, 9.65] }}
          style={{ width: "100%", height: "100%" }}
        >
          <Act4SandboxGraderScene localFrame={localFrame} />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* Layer 3: Editorial Typography (strictly x120..960, y945..1235 inside safe zone y269..1248) */}
      <div
        style={{
          position: "absolute",
          left: 120,
          width: 840,
          top: 946,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          opacity: textExitOpacity,
          transform: `translateY(${textExitY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.16em",
            lineHeight: 1.2,
            color: BRAND.cyan,
            opacity: kickerSpring,
            transform: `translateY(${interpolate(kickerSpring, [0, 1], [22, 0], {
              easing: EASE_OUT,
              ...CLAMP,
            })}px)`,
          }}
        >
          {COPY.act4.kicker}
        </div>

        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 80,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.04,
            color: "#f7f5f9",
          }}
        >
          <span
            style={{
              display: "inline-block",
              opacity: headlineSpring,
              transform: `translateY(${interpolate(
                headlineSpring,
                [0, 1],
                [30, 0],
                { easing: EASE_OUT, ...CLAMP }
              )}px) scale(${interpolate(headlineSpring, [0, 1], [0.96, 1], {
                easing: EASE_OUT,
                ...CLAMP,
              })})`,
            }}
          >
            {COPY.act4.headlineLead}
          </span>{" "}
          <span
            style={{
              display: "inline-block",
              color: BRAND.cyan,
              whiteSpace: "nowrap",
              opacity: accentSpring,
              textShadow: `0 0 38px rgba(34, 211, 238, ${0.36 * accentGlowOpacity})`,
              transform: `translateY(${interpolate(
                accentSpring,
                [0, 1],
                [32, 0],
                { easing: EASE_OUT, ...CLAMP }
              )}px) scale(${interpolate(accentSpring, [0, 1], [0.95, 1], {
                easing: EASE_OUT,
                ...CLAMP,
              })})`,
            }}
          >
            {COPY.act4.headlineAccent}
          </span>
        </div>

        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            lineHeight: 1.32,
            color: "#b8b5c6",
            marginTop: 4,
            opacity: subSpring,
            transform: `translateY(${interpolate(subSpring, [0, 1], [20, 0], {
              easing: EASE_OUT,
              ...CLAMP,
            })}px)`,
          }}
        >
          {COPY.act4.sub}
        </div>
      </div>

      <ColorGradeAndGrain variant="dark" frame={ACT4_FROM + localFrame} />
    </AbsoluteFill>
  );
};

// ============================================================================
// Root Composition Component: AdBundle (1080x1920, 30fps, 450 frames)
// ============================================================================

export const AdBundle: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Latar studio polos untuk seluruh frame di luar Act 1 (f0-65) & Act 4 (f216-287) */}
      <PlainStudioBackdrop />

      {/* Act 1: Agent Core (f0-65) */}
      <Sequence from={ACT1_FROM} durationInFrames={ACT1_DURATION}>
        <Act1AgentCore />
      </Sequence>

      {/* Act 4: Automated Sandbox Grader (f216-287) */}
      <Sequence from={ACT4_FROM} durationInFrames={ACT4_DURATION}>
        <Act4SandboxGrader />
      </Sequence>
    </AbsoluteFill>
  );
};

export default AdBundle;
