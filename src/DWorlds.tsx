import React, { useEffect, useMemo } from "react";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// ============================================================================
// Shared Visual Tokens, Timing Curves & World Scale (Pedestal radius ~ 2.0)
// ============================================================================

const BRAND = {
  magenta: "#c41c83",
  magentaBright: "#e12896",
  cyan: "#22d3ee",
  cyanSoft: "#67e8f9",
  gold: "#d8b458",
  goldBright: "#e8c86a",
  goldDeep: "#b99136",
  ceramic: "#eeecf2",
  ceramicSoft: "#e5e2ec",
  aluminum: "#d5d9e3",
  titanium: "#b9c0cf",
  graphite: "#3e3c48",
  graphiteDark: "#2a2934",
  slate: "#232736",
  obsidian: "#131522",
} as const;

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN = Easing.in(Easing.cubic);
const EASE_IN_OUT = Easing.inOut(Easing.cubic);

const CLAMP = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const FONT_DISPLAY =
  '"Plus Jakarta Sans", "Satoshi", "General Sans", "Inter", "SF Pro Display", "Helvetica Neue", sans-serif';

// Consistent world coordinates across every scene (pedestal radius ~ 2.0)
const FLOOR_Y = -1.35;
const PEDESTAL_TOP_R = 1.98;
const PEDESTAL_BOT_R = 2.18;
const PEDESTAL_H = 0.24;
const PEDESTAL_CENTER_Y = FLOOR_Y + PEDESTAL_H / 2; // -1.23
const PEDESTAL_DECK_Y = FLOOR_Y + PEDESTAL_H; // -1.11

type StudioTone = "light" | "dark";
type AllowedPlaqueLabel = "SOLVER" | "CSV" | "TINY VM";

// ============================================================================
// Exported Prop Interfaces
// ============================================================================

export interface StudioBgProps {
  frame: number;
  tone?: StudioTone;
  withLights?: boolean;
}

export interface AgentTokenProps {
  frame: number;
  scale?: number;
  spin?: number;
  ringGlow?: number;
  ringFlatness?: number;
}

export interface SlotSceneProps {
  frame: number;
  tone?: StudioTone;
  withCamera?: boolean;
}

export interface MazeWorldProps {
  frame: number;
  tone?: StudioTone;
  withCamera?: boolean;
}

export interface CsvWorldProps {
  frame: number;
  tone?: StudioTone;
  withCamera?: boolean;
}

export interface VmWorldProps {
  frame: number;
  tone?: StudioTone;
  withCamera?: boolean;
}

export interface CoinFieldProps {
  frame: number;
  tone?: StudioTone;
  withCamera?: boolean;
}

// ============================================================================
// Synchronous Procedural Geometry & CanvasTexture Helpers (Zero Async Loaders)
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

// Upright extruded beveled block: exact outer footprint (totalW x totalD), bottom at y = 0, top at y = totalH
const createUprightBeveledBlockGeometry = (
  totalW: number,
  totalD: number,
  totalH: number,
  cornerR: number,
  bevel: number,
  bevelSegments = 4
): THREE.ExtrudeGeometry => {
  const safeBevel = Math.min(
    bevel,
    totalW * 0.25,
    totalD * 0.25,
    totalH * 0.35
  );
  const innerW = Math.max(0.01, totalW - safeBevel * 2);
  const innerD = Math.max(0.01, totalD - safeBevel * 2);
  const extrudeDepth = Math.max(0.01, totalH - safeBevel * 2);
  const innerR = Math.max(0.005, cornerR - safeBevel);

  const shape = createRoundedRectShape(innerW, innerD, innerR);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeDepth,
    bevelEnabled: true,
    bevelThickness: safeBevel,
    bevelSize: safeBevel,
    bevelSegments,
    curveSegments: 16,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, safeBevel, 0);
  geo.computeVertexNormals();
  return geo;
};

const createStudioEnvCanvasTexture = (tone: StudioTone): THREE.Texture => {
  if (typeof document === "undefined") {
    return tone === "light"
      ? createFallbackTexture(245, 240, 235, 255)
      : createFallbackTexture(22, 23, 36, 255);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return createFallbackTexture(220, 220, 225, 255);
  }

  const bg = ctx.createLinearGradient(0, 0, 0, 256);
  if (tone === "light") {
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(0.46, "#f4efe9");
    bg.addColorStop(0.76, "#dfd8cf");
    bg.addColorStop(1, "#c4bbb3");
  } else {
    bg.addColorStop(0, "#24283c");
    bg.addColorStop(0.45, "#151725");
    bg.addColorStop(0.76, "#0d0d17");
    bg.addColorStop(1, "#080810");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  // Overhead studio softbox
  const topBox = ctx.createRadialGradient(256, 30, 8, 256, 30, 170);
  topBox.addColorStop(
    0,
    tone === "light" ? "#ffffff" : "rgba(235,248,255,0.95)"
  );
  topBox.addColorStop(
    0.55,
    tone === "light" ? "rgba(255,252,248,0.65)" : "rgba(180,225,255,0.28)"
  );
  topBox.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = topBox;
  ctx.fillRect(0, 0, 512, 256);

  // Crisp vertical studio strip softboxes for realistic metal & clearcoat speculars
  ctx.fillStyle =
    tone === "light" ? "rgba(255,255,255,0.92)" : "rgba(235,250,255,0.88)";
  ctx.fillRect(66, 26, 36, 156);
  ctx.fillStyle =
    tone === "light" ? "rgba(255,246,238,0.86)" : "rgba(210,242,255,0.62)";
  ctx.fillRect(392, 32, 42, 142);

  // Subtle magenta & cyan brand rim bounce softboxes
  const rimMagenta = ctx.createRadialGradient(132, 120, 4, 132, 120, 92);
  rimMagenta.addColorStop(
    0,
    tone === "light" ? "rgba(196,28,131,0.32)" : "rgba(196,28,131,0.52)"
  );
  rimMagenta.addColorStop(1, "rgba(196,28,131,0)");
  ctx.fillStyle = rimMagenta;
  ctx.fillRect(0, 0, 512, 256);

  const rimCyan = ctx.createRadialGradient(380, 124, 4, 380, 124, 98);
  rimCyan.addColorStop(
    0,
    tone === "light" ? "rgba(34,211,238,0.25)" : "rgba(34,211,238,0.6)"
  );
  rimCyan.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = rimCyan;
  ctx.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

// Warm bullion-gold studio reflection map (zero cyan/blue so metallic gold never shifts olive-green)
const createWarmGoldEnvCanvasTexture = (): THREE.Texture => {
  if (typeof document === "undefined") {
    return createFallbackTexture(255, 212, 110, 255);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return createFallbackTexture(255, 212, 110, 255);
  }

  // Deep warm plum-obsidian base matching the dark magenta studio
  const bg = ctx.createLinearGradient(0, 0, 0, 256);
  bg.addColorStop(0, "#3b2334");
  bg.addColorStop(0.42, "#241322");
  bg.addColorStop(0.74, "#160b17");
  bg.addColorStop(1, "#0f0710");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  // Warm champagne-gold overhead softbox
  const topBox = ctx.createRadialGradient(256, 28, 10, 256, 28, 185);
  topBox.addColorStop(0, "#fff8e1");
  topBox.addColorStop(0.5, "rgba(255, 220, 128, 0.56)");
  topBox.addColorStop(1, "rgba(255, 196, 72, 0)");
  ctx.fillStyle = topBox;
  ctx.fillRect(0, 0, 512, 256);

  // Warm studio strip softboxes catching crisp golden specular gleams across spinning faces
  ctx.fillStyle = "rgba(255, 245, 212, 0.96)";
  ctx.fillRect(58, 22, 44, 166);
  ctx.fillStyle = "rgba(255, 224, 136, 0.9)";
  ctx.fillRect(234, 40, 38, 148);
  ctx.fillStyle = "rgba(255, 236, 178, 0.92)";
  ctx.fillRect(392, 26, 48, 160);

  // Warm amber bounce panels + subtle dark-magenta rim accent
  const warmBounceL = ctx.createRadialGradient(148, 134, 6, 148, 134, 110);
  warmBounceL.addColorStop(0, "rgba(255, 194, 66, 0.72)");
  warmBounceL.addColorStop(1, "rgba(255, 194, 66, 0)");
  ctx.fillStyle = warmBounceL;
  ctx.fillRect(0, 0, 512, 256);

  const warmBounceR = ctx.createRadialGradient(346, 138, 6, 346, 138, 105);
  warmBounceR.addColorStop(0, "rgba(255, 184, 54, 0.64)");
  warmBounceR.addColorStop(1, "rgba(255, 184, 54, 0)");
  ctx.fillStyle = warmBounceR;
  ctx.fillRect(0, 0, 512, 256);

  const rimMagenta = ctx.createRadialGradient(256, 188, 6, 256, 188, 115);
  rimMagenta.addColorStop(0, "rgba(218, 42, 146, 0.34)");
  rimMagenta.addColorStop(1, "rgba(218, 42, 146, 0)");
  ctx.fillStyle = rimMagenta;
  ctx.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

const createStudioBackdropTexture = (tone: StudioTone): THREE.Texture => {
  if (typeof document === "undefined") {
    return tone === "light"
      ? createFallbackTexture(244, 239, 232, 255)
      : createFallbackTexture(16, 15, 25, 255);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return createFallbackTexture(240, 236, 230, 255);
  }

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  if (tone === "light") {
    grad.addColorStop(0, "#faf7f3");
    grad.addColorStop(0.38, "#f5f0e9");
    grad.addColorStop(0.62, "#ece6de");
    grad.addColorStop(1, "#e5ded5");
  } else {
    grad.addColorStop(0, "#090910");
    grad.addColorStop(0.38, "#12111d");
    grad.addColorStop(0.64, "#1b1829");
    grad.addColorStop(1, "#0d0c16");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Soft overhead studio cyclorama key bloom
  const bloom = ctx.createRadialGradient(256, 210, 12, 256, 210, 210);
  if (tone === "light") {
    bloom.addColorStop(0, "rgba(255,255,255,0.68)");
    bloom.addColorStop(0.55, "rgba(255,250,245,0.22)");
    bloom.addColorStop(1, "rgba(255,255,255,0)");
  } else {
    bloom.addColorStop(0, "rgba(34,211,238,0.12)");
    bloom.addColorStop(0.55, "rgba(196,28,131,0.06)");
    bloom.addColorStop(1, "rgba(12,11,18,0)");
  }
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

const createFloorAlphaTexture = (): THREE.Texture => {
  if (typeof document === "undefined") {
    return createFallbackTexture(255, 255, 255, 255);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return createFallbackTexture(255, 255, 255, 255);
  }

  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.54, "#ffffff");
  grad.addColorStop(0.82, "#555555");
  grad.addColorStop(1, "#000000");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
};

const createFloorPatternTexture = (tone: StudioTone): THREE.Texture => {
  if (typeof document === "undefined") {
    return createFallbackTexture(0, 0, 0, 0);
  }
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return createFallbackTexture(0, 0, 0, 0);
  }

  ctx.clearRect(0, 0, size, size);

  // Fine architectural perspective grid lines
  ctx.strokeStyle =
    tone === "light"
      ? "rgba(85, 76, 86, 0.085)"
      : "rgba(186, 210, 235, 0.14)";
  ctx.lineWidth = 1.25;
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

  // Subtle concentric studio reflection rings
  ctx.strokeStyle =
    tone === "light"
      ? "rgba(255, 255, 255, 0.34)"
      : "rgba(34, 211, 238, 0.12)";
  ctx.lineWidth = 2;
  for (const r of [92, 148, 204]) {
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Soft radial edge mask so the floor pattern vanishes into the cyclorama
  ctx.globalCompositeOperation = "destination-in";
  const mask = ctx.createRadialGradient(256, 256, 24, 256, 256, 248);
  mask.addColorStop(0, "rgba(255,255,255,0.95)");
  mask.addColorStop(0.55, "rgba(255,255,255,0.55)");
  mask.addColorStop(0.86, "rgba(255,255,255,0.12)");
  mask.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
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

  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 122);
  grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${peakAlpha})`);
  grad.addColorStop(
    0.45,
    `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${peakAlpha * 0.56})`
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

// AgentToken front screen texture — ONLY allowed text: "AI AGENT" (zero stats/numbers)
const createAgentTokenFaceTexture = (): THREE.Texture => {
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

  // Deep obsidian-plum optical glass base
  const bg = ctx.createRadialGradient(256, 196, 18, 256, 256, 336);
  bg.addColorStop(0, "#35163a");
  bg.addColorStop(0.45, "#1c1223");
  bg.addColorStop(1, "#110c16");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Subtle magenta coordinate grid
  ctx.strokeStyle = "rgba(196, 28, 131, 0.22)";
  ctx.lineWidth = 1.5;
  for (let p = 32; p < size; p += 32) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Luminous rounded neon perimeter border
  ctx.save();
  ctx.shadowColor = "rgba(225, 40, 150, 0.85)";
  ctx.shadowBlur = 20;
  ctx.strokeStyle = BRAND.magentaBright;
  ctx.lineWidth = 5;
  drawRoundedRectPath(ctx, 56, 56, 400, 400, 44);
  ctx.stroke();
  ctx.restore();

  // Crisp cyan optical corner ticks
  ctx.strokeStyle = "rgba(34, 211, 238, 0.78)";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  const corners: Array<[number, number, number, number]> = [
    [92, 92, 1, 1],
    [420, 92, -1, 1],
    [92, 420, 1, -1],
    [420, 420, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * 24);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * 24, cy);
    ctx.stroke();
  }

  // Energy halo behind upper-center 3D crystal core
  const coreGlow = ctx.createRadialGradient(256, 198, 10, 256, 198, 118);
  coreGlow.addColorStop(0, "rgba(225, 40, 150, 0.82)");
  coreGlow.addColorStop(0.45, "rgba(196, 28, 131, 0.28)");
  coreGlow.addColorStop(0.78, "rgba(34, 211, 238, 0.14)");
  coreGlow.addColorStop(1, "rgba(17, 12, 22, 0)");
  ctx.fillStyle = coreGlow;
  ctx.fillRect(0, 0, size, size);

  // Lower dark frosted optical nameplate pill for "AI AGENT"
  ctx.fillStyle = "rgba(14, 11, 22, 0.78)";
  drawRoundedRectPath(ctx, 96, 324, 320, 86, 22);
  ctx.fill();

  ctx.strokeStyle = "rgba(225, 40, 150, 0.56)";
  ctx.lineWidth = 2.5;
  drawRoundedRectPath(ctx, 96, 324, 320, 86, 22);
  ctx.stroke();

  // Crisp display typography: strictly "AI AGENT"
  ctx.save();
  ctx.font = `800 50px ${FONT_DISPLAY}`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(225, 40, 150, 0.52)";
  ctx.shadowBlur = 12;
  ctx.fillText("AI AGENT", 256, 369);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

// Diorama plaque texture — ONLY allowed labels: "SOLVER" | "CSV" | "TINY VM"
const createPlaqueTexture = (
  label: AllowedPlaqueLabel,
  accentHex: string
): THREE.Texture => {
  if (typeof document === "undefined") {
    return createFallbackTexture(18, 22, 34, 255);
  }
  const w = 512;
  const h = 144;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return createFallbackTexture(18, 22, 34, 255);
  }

  // Deep obsidian-slate optical glass plate
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#171a29");
  bg.addColorStop(0.55, "#111422");
  bg.addColorStop(1, "#0b0d17");
  ctx.fillStyle = bg;
  drawRoundedRectPath(ctx, 0, 0, w, h, 28);
  ctx.fill();

  // Top studio glass specular wash
  const sheen = ctx.createLinearGradient(0, 0, 0, 68);
  sheen.addColorStop(0, "rgba(255,255,255,0.14)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  drawRoundedRectPath(ctx, 6, 6, w - 12, 62, 22);
  ctx.fill();

  // Subtle accent perimeter border
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.78;
  drawRoundedRectPath(ctx, 6, 6, w - 12, h - 12, 24);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Left & right geometric accent pips (pure geometry, zero numbers)
  ctx.save();
  ctx.shadowColor = accentHex;
  ctx.shadowBlur = 14;
  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.arc(42, h / 2, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w - 42, h / 2, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Bold high-contrast mobile-legible label text
  const fontSize = label === "TINY VM" ? 66 : label === "SOLVER" ? 72 : 78;
  ctx.save();
  ctx.font = `800 ${fontSize}px ${FONT_DISPLAY}`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = accentHex;
  ctx.shadowBlur = 10;
  ctx.fillText(label, w / 2, h / 2 + 2);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

// ============================================================================
// Shared Three.js Infrastructure (Deterministic, Zero Per-Frame Loop Hooks)
// ============================================================================

const CameraRig: React.FC<{
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
}> = ({ position, target, fov = 34 }) => {
  const { camera, invalidate, size } = useThree();

  // Smoothly adapt distance & vertical framing between 9:16 portrait and 16:9 landscape
  const aspect = size.width / Math.max(1, size.height);
  const portraitT = interpolate(aspect, [0.5625, 1.35], [1, 0], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  const distMul = 0.72 + 0.28 * portraitT;
  const targetY = target[1] - 0.28 * portraitT;
  const tx = target[0];
  const tz = target[2];

  const px = tx + (position[0] - tx) * distMul;
  const py = targetY + (position[1] - target[1]) * distMul;
  const pz = tz + (position[2] - tz) * distMul;

  // Synchronous update ensures headless single-frame renders match exact frame pose
  camera.position.set(px, py, pz);
  camera.lookAt(tx, targetY, tz);
  if (camera instanceof THREE.PerspectiveCamera && camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();

  useEffect(() => {
    camera.position.set(px, py, pz);
    camera.lookAt(tx, targetY, tz);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, invalidate, px, py, pz, tx, targetY, tz, fov]);

  return null;
};

const StudioEnvironment: React.FC<{
  tone: StudioTone;
  isPrimaryBg?: boolean;
}> = ({ tone, isPrimaryBg = false }) => {
  const { gl, scene } = useThree();

  const envRT = useMemo(() => {
    const equirect = createStudioEnvCanvasTexture(tone);
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
  }, [gl, tone]);

  const hasPrimary = Boolean(scene.userData.__dWorldsPrimaryTone);
  if (envRT && (isPrimaryBg || !hasPrimary)) {
    scene.environment = envRT.texture;
    if (isPrimaryBg) {
      scene.userData.__dWorldsPrimaryTone = tone;
    }
  }

  useEffect(() => {
    if (envRT) {
      if (isPrimaryBg) {
        scene.userData.__dWorldsPrimaryTone = tone;
        scene.environment = envRT.texture;
      } else if (!scene.userData.__dWorldsPrimaryTone) {
        scene.environment = envRT.texture;
      }
    }
    return () => {
      if (isPrimaryBg && scene.userData.__dWorldsPrimaryTone === tone) {
        delete scene.userData.__dWorldsPrimaryTone;
      }
      if (envRT) {
        if (scene.environment === envRT.texture) {
          scene.environment = null;
        }
        envRT.dispose();
      }
    };
  }, [scene, envRT, isPrimaryBg, tone]);

  return null;
};

// Shared Stage-1 Pedestal (radius ~ 2.0, resting cleanly on FLOOR_Y = -1.35)
const StudioPedestal: React.FC<{
  tone?: StudioTone;
  trimColor?: string;
  trimEmissive?: string;
  trimEmissiveIntensity?: number;
  floorGlowColor?: [number, number, number];
  floorGlowOpacity?: number;
  deckAccentRingColor?: string;
  deckAccentRingEmissive?: number;
}> = ({
  tone = "light",
  trimColor = BRAND.gold,
  trimEmissive = "#000000",
  trimEmissiveIntensity = 0,
  floorGlowColor,
  floorGlowOpacity = 0,
  deckAccentRingColor,
  deckAccentRingEmissive = 0,
}) => {
  const assets = useMemo(() => {
    const shadowTex = createContactShadowTexture(
      tone === "dark" ? [4, 5, 10] : [26, 20, 26],
      tone === "dark" ? 0.62 : 0.3
    );
    const glowTex = floorGlowColor
      ? createContactShadowTexture(floorGlowColor, 0.34)
      : null;
    return { shadowTex, glowTex };
  }, [
    tone,
    floorGlowColor ? floorGlowColor[0] : -1,
    floorGlowColor ? floorGlowColor[1] : -1,
    floorGlowColor ? floorGlowColor[2] : -1,
  ]);

  useEffect(() => {
    return () => {
      assets.shadowTex.dispose();
      if (assets.glowTex) {
        assets.glowTex.dispose();
      }
    };
  }, [assets]);

  return (
    <group position={[0, PEDESTAL_CENTER_Y, 0]}>
      {/* Main tapered anodized graphite pedestal disc (radius 1.98 .. 2.18) */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[PEDESTAL_TOP_R, PEDESTAL_BOT_R, PEDESTAL_H, 72]} />
        <meshStandardMaterial
          color={tone === "dark" ? "#2c3040" : "#44414e"}
          metalness={tone === "dark" ? 0.72 : 0.48}
          roughness={tone === "dark" ? 0.28 : 0.38}
          envMapIntensity={1.45}
        />
      </mesh>

      {/* Lower machined metallic foot collar */}
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <cylinderGeometry args={[2.17, 2.22, 0.04, 72]} />
        <meshStandardMaterial
          color={tone === "dark" ? "#1e212e" : "#302d38"}
          metalness={0.78}
          roughness={0.26}
          envMapIntensity={1.4}
        />
      </mesh>

      {/* Recessed matte-satin top stage pad */}
      <mesh position={[0, 0.122, 0]} receiveShadow>
        <cylinderGeometry args={[1.9, 1.92, 0.018, 72]} />
        <meshStandardMaterial
          color={tone === "dark" ? "#1e2230" : "#54505e"}
          metalness={0.34}
          roughness={0.44}
        />
      </mesh>

      {/* Perimeter brushed metallic / luminous trim ring */}
      <mesh position={[0, 0.128, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.948, 0.032, 24, 96]} />
        <meshStandardMaterial
          color={trimColor}
          emissive={trimEmissive}
          emissiveIntensity={trimEmissiveIntensity}
          metalness={trimEmissiveIntensity > 0.3 ? 0.62 : 0.94}
          roughness={0.16}
          envMapIntensity={1.55}
        />
      </mesh>

      {/* Optional inner recessed luminous energy track */}
      {deckAccentRingColor && (
        <mesh position={[0, 0.133, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.54, 0.016, 16, 84]} />
          <meshStandardMaterial
            color={deckAccentRingColor}
            emissive={deckAccentRingColor}
            emissiveIntensity={deckAccentRingEmissive}
            roughness={0.18}
            metalness={0.2}
          />
        </mesh>
      )}

      {/* Soft studio floor contact shadow directly beneath pedestal */}
      <mesh position={[0, -0.114, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.9, 4.9]} />
        <meshBasicMaterial
          map={assets.shadowTex}
          transparent
          depthWrite={false}
          opacity={0.88}
        />
      </mesh>

      {/* Optional subtle colored bounce aura on studio floor */}
      {assets.glowTex && floorGlowOpacity > 0.01 && (
        <mesh position={[0, -0.11, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.2, 4.2]} />
          <meshBasicMaterial
            map={assets.glowTex}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={floorGlowOpacity}
          />
        </mesh>
      )}
    </group>
  );
};

// Shared Sculpted 3D Diorama Nameplate Plaque mounted cleanly on pedestal front (enlarged for mobile legibility)
const DioramaPlaque: React.FC<{
  label: AllowedPlaqueLabel;
  accentColor: string;
}> = ({ label, accentColor }) => {
  const assets = useMemo(() => {
    const bodyShape = createRoundedRectShape(1.24, 0.36, 0.075);
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 0.042,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.014,
      bevelSegments: 4,
      curveSegments: 16,
    });
    bodyGeo.center();

    const bezelShape = createHollowRoundedFrameShape(
      1.21,
      0.33,
      0.068,
      1.13,
      0.26,
      0.046
    );
    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 3,
      curveSegments: 14,
    });
    bezelGeo.center();

    const faceTex = createPlaqueTexture(label, accentColor);

    return { bodyGeo, bezelGeo, faceTex };
  }, [label, accentColor]);

  useEffect(() => {
    return () => {
      assets.bodyGeo.dispose();
      assets.bezelGeo.dispose();
      assets.faceTex.dispose();
    };
  }, [assets]);

  return (
    <group position={[0, -1.07, 2.24]} rotation={[-0.24, 0, 0]} scale={1.32}>
      {/* Twin brushed-aluminum mounting struts anchoring plaque to pedestal bevel */}
      <mesh position={[-0.38, -0.02, -0.09]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.024, 0.024, 0.16, 16]} />
        <meshStandardMaterial color={BRAND.aluminum} metalness={0.9} roughness={0.18} />
      </mesh>
      <mesh position={[0.38, -0.02, -0.09]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.024, 0.024, 0.16, 16]} />
        <meshStandardMaterial color={BRAND.aluminum} metalness={0.9} roughness={0.18} />
      </mesh>

      {/* Beveled anodized housing */}
      <mesh geometry={assets.bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#232635"
          metalness={0.62}
          roughness={0.28}
          clearcoat={0.72}
          clearcoatRoughness={0.16}
          envMapIntensity={1.45}
        />
      </mesh>

      {/* Brushed aluminum outer bezel */}
      <mesh geometry={assets.bezelGeo} position={[0, 0, 0.036]}>
        <meshStandardMaterial
          color={BRAND.aluminum}
          metalness={0.88}
          roughness={0.2}
          envMapIntensity={1.55}
        />
      </mesh>

      {/* Optical glass plaque face */}
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[1.14, 0.285]} />
        <meshPhysicalMaterial
          map={assets.faceTex}
          emissiveMap={assets.faceTex}
          emissive="#ffffff"
          emissiveIntensity={0.82}
          roughness={0.08}
          metalness={0.08}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
        />
      </mesh>
    </group>
  );
};

// Shared depth-parallax floating faceted gem confetti (Stage-1 signature accent)
const GemConfetti: React.FC<{
  frame: number;
  gems: ReadonlyArray<{
    pos: [number, number, number];
    scale: number;
    color: string;
    phase: number;
    metalness: number;
    roughness: number;
  }>;
  impulseY?: number;
}> = ({ frame, gems, impulseY = 0 }) => {
  return (
    <group>
      {gems.map((g, idx) => {
        const dy =
          Math.sin((frame / 24) * Math.PI + g.phase) * 0.065 +
          impulseY * (0.65 + (idx % 3) * 0.25);
        return (
          <mesh
            key={idx}
            position={[g.pos[0], g.pos[1] + dy, g.pos[2]]}
            rotation={[g.phase + frame * 0.02, g.phase * 1.35 + frame * 0.026, 0.22]}
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
  );
};

// ============================================================================
// 1. StudioBg — Soft Gradient Studio Cyclorama + Subtle Reflective Floor
// ============================================================================

export const StudioBg: React.FC<StudioBgProps> = ({
  frame,
  tone = "light",
  withLights = false,
}) => {
  const assets = useMemo(() => {
    const backdropTex = createStudioBackdropTexture(tone);
    const floorAlphaTex = createFloorAlphaTexture();
    const floorPatternTex = createFloorPatternTexture(tone);
    const softHaloTex = createContactShadowTexture(
      tone === "light" ? [255, 252, 248] : [34, 211, 238],
      tone === "light" ? 0.55 : 0.2
    );
    return { backdropTex, floorAlphaTex, floorPatternTex, softHaloTex };
  }, [tone]);

  useEffect(() => {
    return () => {
      assets.backdropTex.dispose();
      assets.floorAlphaTex.dispose();
      assets.floorPatternTex.dispose();
      assets.softHaloTex.dispose();
    };
  }, [assets]);

  const domeDriftY = Math.sin(frame / 42) * 0.06;
  const haloDriftX = Math.sin(frame / 36) * 0.75;
  const haloDriftY = Math.cos(frame / 48) * 0.32;
  const keySweepX = interpolate(frame, [0, 90], [-4.8, 4.8], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  return (
    <group>
      <StudioEnvironment tone={tone} isPrimaryBg />

      {/* Subtle ambient fill so standalone AgentToken also reads cleanly */}
      <hemisphereLight
        args={
          tone === "light"
            ? ["#ffffff", "#e4dbd3", 0.34]
            : ["#b9e6ff", "#171422", 0.3]
        }
      />

      {withLights && (
        <>
          <directionalLight
            position={[keySweepX, 6.2, 6.8]}
            intensity={1.95}
            color={tone === "light" ? "#fffaf5" : "#eef8ff"}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-bias={-0.0004}
            shadow-camera-near={1}
            shadow-camera-far={30}
            shadow-camera-left={-4.5}
            shadow-camera-right={4.5}
            shadow-camera-top={4.5}
            shadow-camera-bottom={-4.5}
          />
          <directionalLight
            position={[-5.4, 3.2, -4.4]}
            intensity={1.1}
            color={tone === "light" ? "#d6f2ff" : BRAND.magenta}
          />
        </>
      )}

      {/* Smooth seamless studio cyclorama dome */}
      <mesh rotation={[0, domeDriftY, 0]} renderOrder={-10}>
        <sphereGeometry args={[32, 48, 32]} />
        <meshBasicMaterial
          map={assets.backdropTex}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Soft drifting back studio spotlight glow */}
      <mesh position={[haloDriftX, 1.3 + haloDriftY, -10.5]} renderOrder={-8}>
        <planeGeometry args={[16, 12]} />
        <meshBasicMaterial
          map={assets.softHaloTex}
          transparent
          opacity={tone === "light" ? 0.55 : 0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Subtle clearcoat reflective studio floor fading seamlessly at perimeter */}
      <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[20, 72]} />
        <meshPhysicalMaterial
          color={tone === "light" ? "#efeae3" : "#121422"}
          metalness={tone === "light" ? 0.08 : 0.24}
          roughness={tone === "light" ? 0.26 : 0.2}
          clearcoat={tone === "light" ? 0.62 : 0.84}
          clearcoatRoughness={tone === "light" ? 0.2 : 0.12}
          envMapIntensity={tone === "light" ? 0.98 : 1.38}
          alphaMap={assets.floorAlphaTex}
          transparent
        />
      </mesh>

      {/* Refined radial-faded floor specular rings & subtle architectural grid */}
      <mesh
        position={[0, FLOOR_Y + 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={-4}
      >
        <circleGeometry args={[14.5, 64]} />
        <meshBasicMaterial
          map={assets.floorPatternTex}
          transparent
          opacity={tone === "light" ? 0.85 : 0.9}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

// ============================================================================
// 2. AgentToken — Extruded Beveled Device + Glowing Core + Orbiting Rings
// ============================================================================

export const AgentToken: React.FC<AgentTokenProps> = ({
  frame,
  scale = 1,
  spin = 0,
  ringGlow = 0,
  ringFlatness = 0,
}) => {
  const assets = useMemo(() => {
    // 1. Extruded beveled pearl-ceramic rounded chassis (outer 1.17 x 1.17, front face z = +0.145)
    const bodyShape = createRoundedRectShape(1.04, 1.04, 0.24);
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.065,
      bevelSize: 0.065,
      bevelSegments: 8,
      curveSegments: 24,
    });
    bodyGeo.center();

    // 2. Brushed aluminum recessed inner bezel frame
    const bezelShape = createHollowRoundedFrameShape(
      0.92,
      0.92,
      0.16,
      0.78,
      0.78,
      0.095
    );
    const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.009,
      bevelSize: 0.009,
      bevelSegments: 4,
      curveSegments: 20,
    });
    bezelGeo.center();

    // 3. Sculpted beveled rear anodized X-arms (fits cleanly inside inner ring radius 0.772)
    const armShape = createRoundedRectShape(1.32, 0.17, 0.07);
    const armGeo = new THREE.ExtrudeGeometry(armShape, {
      depth: 0.052,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 4,
      curveSegments: 14,
    });
    armGeo.center();

    const screenTex = createAgentTokenFaceTexture();

    return { bodyGeo, bezelGeo, armGeo, screenTex };
  }, []);

  useEffect(() => {
    return () => {
      assets.bodyGeo.dispose();
      assets.bezelGeo.dispose();
      assets.armGeo.dispose();
      assets.screenTex.dispose();
    };
  }, [assets]);

  const spinRad = (spin * Math.PI) / 180;
  const clampedGlow = Math.max(0, Math.min(1.5, ringGlow));
  const flatBlend = Math.max(0, Math.min(1, ringFlatness));

  // Deterministic core life & orbiting ring dynamics driven solely by frame
  const corePulse = 1 + Math.sin((frame / 15) * Math.PI) * 0.06;
  const coreSpinY = 0.45 + frame * (0.042 + clampedGlow * 0.028);
  const coreSpinX = 0.3 + frame * 0.022;

  const subtleSwayY = Math.sin(frame * 0.045) * 0.08 * (1 - flatBlend * 0.85);
  const subtleTiltX = Math.cos(frame * 0.038) * 0.035 * (1 - flatBlend * 0.8);

  // Orbiting Ring A (magenta glossy glass-polymer): frames chassis without crossing "AI AGENT"
  const magentaRotX = 0.96 + flatBlend * 0.36 + Math.sin(frame * 0.04) * 0.08;
  const magentaRotY = 0.48 + frame * 0.022;
  const magentaRotZ = 0.24 - flatBlend * 0.14 + Math.cos(frame * 0.035) * 0.06;

  // Orbiting Ring B (brushed champagne gold) + tracking sphere
  const goldRotX = -0.92 - flatBlend * 0.34 + Math.cos(frame * 0.036) * 0.07;
  const goldRotY = -0.52 - frame * 0.018;
  const goldRotZ = -0.32 + flatBlend * 0.16;

  const beadAngle = -0.35 + frame * (0.055 + clampedGlow * 0.03);
  const beadX = Math.cos(beadAngle) * 0.96;
  const beadY = Math.sin(beadAngle) * 0.96;

  return (
    <group scale={scale} rotation={[subtleTiltX, subtleSwayY + spinRad, 0]}>
      {/* Matte anodized graphite rear X-arms */}
      <group position={[0, 0, -0.2]}>
        <mesh
          geometry={assets.armGeo}
          rotation={[0, 0, Math.PI / 4]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#3b3746" metalness={0.58} roughness={0.34} />
        </mesh>
        <mesh
          geometry={assets.armGeo}
          rotation={[0, 0, -Math.PI / 4]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#3b3746" metalness={0.58} roughness={0.34} />
        </mesh>
      </group>

      {/* Extruded beveled pearl-ceramic rounded chassis */}
      <mesh geometry={assets.bodyGeo} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={BRAND.ceramic}
          metalness={0.12}
          roughness={0.2}
          clearcoat={0.82}
          clearcoatRoughness={0.12}
          envMapIntensity={1.32}
        />
      </mesh>

      {/* Brushed aluminum inner bezel frame */}
      <mesh geometry={assets.bezelGeo} position={[0, 0, 0.145]} castShadow>
        <meshStandardMaterial
          color={BRAND.aluminum}
          metalness={0.88}
          roughness={0.18}
          envMapIntensity={1.55}
        />
      </mesh>

      {/* Recessed optical glass screen with "AI AGENT" canvas label */}
      <mesh position={[0, 0, 0.151]}>
        <planeGeometry args={[0.78, 0.78]} />
        <meshPhysicalMaterial
          map={assets.screenTex}
          emissiveMap={assets.screenTex}
          emissive="#ffffff"
          emissiveIntensity={0.68 + clampedGlow * 0.28}
          roughness={0.07}
          metalness={0.1}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
        />
      </mesh>

      {/* Upper-center luminous core aperture + faceted magenta crystal */}
      <group position={[0, 0.09, 0.164]}>
        <mesh>
          <torusGeometry args={[0.162, 0.017, 20, 64]} />
          <meshStandardMaterial
            color="#cfd4e0"
            metalness={0.92}
            roughness={0.15}
            envMapIntensity={1.6}
          />
        </mesh>
        <mesh position={[0, 0, 0.014]}>
          <torusGeometry args={[0.122, 0.01, 16, 56]} />
          <meshStandardMaterial
            color={BRAND.cyan}
            emissive={BRAND.cyan}
            emissiveIntensity={1.4 + clampedGlow * 0.95}
            roughness={0.18}
            metalness={0.2}
          />
        </mesh>
        <mesh
          position={[0, 0, 0.038]}
          rotation={[coreSpinX, coreSpinY, 0]}
          scale={corePulse}
        >
          <octahedronGeometry args={[0.092, 0]} />
          <meshPhysicalMaterial
            color="#ff55b8"
            emissive={BRAND.magentaBright}
            emissiveIntensity={1.7 + clampedGlow * 1.1}
            roughness={0.08}
            metalness={0.14}
            clearcoat={1.0}
          />
        </mesh>
        <pointLight
          position={[0, 0, 0.24]}
          intensity={0.95 * corePulse + clampedGlow * 1.15}
          distance={3.6}
          color={BRAND.magentaBright}
        />
      </group>

      {/* Ring A: Glossy magenta glass-polymer torus (inner R = 0.772 clears chassis & arms) */}
      <mesh
        rotation={[magentaRotX, magentaRotY, magentaRotZ]}
        castShadow
        receiveShadow
      >
        <torusGeometry args={[0.82, 0.048, 32, 96]} />
        <meshPhysicalMaterial
          color="#e42995"
          emissive={BRAND.magentaBright}
          emissiveIntensity={0.28 + clampedGlow * 1.35}
          metalness={0.14}
          roughness={0.07}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
          reflectivity={1.0}
          envMapIntensity={1.65}
        />
      </mesh>

      {/* Ring B: Brushed champagne-gold metallic torus + orbiting tracking sphere */}
      <group rotation={[goldRotX, goldRotY, goldRotZ]}>
        <mesh castShadow receiveShadow>
          <torusGeometry args={[0.96, 0.052, 32, 96]} />
          <meshStandardMaterial
            color={BRAND.gold}
            emissive={BRAND.goldBright}
            emissiveIntensity={clampedGlow * 0.55}
            metalness={0.93}
            roughness={0.16}
            envMapIntensity={1.8}
          />
        </mesh>
        <mesh position={[beadX, beadY, 0]} castShadow>
          <sphereGeometry args={[0.062, 24, 24]} />
          <meshStandardMaterial color="#262330" metalness={0.76} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
};

// ============================================================================
// 3. SlotScene — Glowing Pedestal Slot + AgentToken Glide & Overshoot Lock (75f)
// ============================================================================

const SLOT_DOCK_SCALE = 1.3;

export const SlotScene: React.FC<SlotSceneProps> = ({
  frame,
  tone = "light",
  withCamera = true,
}) => {
  const { fps } = useVideoConfig();

  // Reference choreography: 75 frames total, lock moment at ~frame 45
  const approachT = interpolate(frame, [0, 22], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const insertT = interpolate(frame, [22, 45], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });
  const holdT = interpolate(frame, [45, 75], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  // Tactile underdamped overshoot-settle spring at lock (frame ~45)
  const lockSpring = spring({
    frame: frame - 45,
    fps,
    config: { damping: 9.5, stiffness: 245, mass: 0.92 },
  });
  // Brief downward compression at impact that rebounds & settles cleanly to 0
  const lockDip =
    frame < 44
      ? 0
      : interpolate(frame, [44, 47, 52, 58], [0, -0.1, 0.036, 0], {
          easing: EASE_IN_OUT,
          ...CLAMP,
        });

  // Token vertical trajectory: hovers cleanly below top badge -> glides into dock -> locks with bounce
  const hoverFloat = Math.sin(frame * 0.14) * 0.045 * (1 - insertT);
  const startY = 1.32 - approachT * 0.26;
  const seatedY = 0.24;
  const tokenY = startY + (seatedY - startY) * insertT + hoverFloat + lockDip;

  // Token yaw aligns squarely to 0 deg before entering the slot
  const tokenSpinDeg = -34 * (1 - approachT) - 10 * (1 - insertT);

  // Orbiting rings smoothly gyro-flatten into an energized lock halo as token docks
  const ringFlatness = interpolate(frame, [26, 45], [0, 0.85], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  // Ring & slot ignition pulse at lock (~frame 45)
  const lockFlash = interpolate(frame, [43, 47, 58, 75], [0, 1.25, 0.82, 0.72], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const shockExpandT = interpolate(frame, [45, 64], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const shockOpacity = interpolate(frame, [45, 48, 64], [0, 0.92, 0], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  // Mechanical brushed-aluminum dock clamps open for entry then snap inward at lock
  const clampX =
    0.72 +
    interpolate(frame, [20, 38], [0, 0.12], { easing: EASE_OUT, ...CLAMP }) -
    lockSpring * 0.17;

  // Closer framing so pedestal fills width & locked AgentToken reads large and unmistakable
  const camX = -1.25 * (1 - approachT) + insertT * 0.38 + holdT * 0.72;
  const camY = 3.4 - insertT * 0.65 + holdT * 0.08 + lockDip * 0.45;
  const camZ = 14.0 - approachT * 0.35 - insertT * 0.45 - holdT * 0.3;

  const keySweepX = interpolate(frame, [0, 75], [-5.2, 5.2], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  const assets = useMemo(() => {
    const dockBaseGeo = createUprightBeveledBlockGeometry(1.66, 1.08, 0.18, 0.22, 0.032, 5);
    const cheekGeo = createUprightBeveledBlockGeometry(1.26, 0.16, 0.42, 0.06, 0.022, 4);
    const clampGeo = createUprightBeveledBlockGeometry(0.16, 0.42, 0.32, 0.045, 0.018, 4);
    const padShadowTex = createContactShadowTexture([24, 18, 28], 0.38);
    return { dockBaseGeo, cheekGeo, clampGeo, padShadowTex };
  }, []);

  useEffect(() => {
    return () => {
      assets.dockBaseGeo.dispose();
      assets.cheekGeo.dispose();
      assets.clampGeo.dispose();
      assets.padShadowTex.dispose();
    };
  }, [assets]);

  const slotGems = [
    { pos: [1.82, 0.96, -0.65] as [number, number, number], scale: 0.11, color: BRAND.magentaBright, phase: 0.5, metalness: 0.22, roughness: 0.12 },
    { pos: [-1.78, 0.54, 0.58] as [number, number, number], scale: 0.1, color: BRAND.cyan, phase: 1.6, metalness: 0.2, roughness: 0.14 },
    { pos: [1.65, -0.32, 0.95] as [number, number, number], scale: 0.088, color: BRAND.gold, phase: 2.5, metalness: 0.9, roughness: 0.16 },
    { pos: [-1.55, 1.38, -0.82] as [number, number, number], scale: 0.082, color: BRAND.ceramic, phase: 3.3, metalness: 0.18, roughness: 0.18 },
  ];

  const gemImpulseY = interpolate(frame, [45, 51, 68], [0, 0.16, 0.02], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const tokenShadowScale = interpolate(tokenY, [0.24, 1.32], [1.14, 0.66], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const tokenShadowOpacity = interpolate(tokenY, [0.24, 1.32], [0.66, 0.26], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  return (
    <group>
      {withCamera && (
        <CameraRig position={[camX, camY, camZ]} target={[0, -0.05, 0]} fov={34} />
      )}
      <StudioEnvironment tone={tone} />

      {/* Studio lighting: hemisphere + sweeping directional shadow key + rim + slot glow */}
      <hemisphereLight
        args={
          tone === "light"
            ? ["#ffffff", "#e5dcd4", 0.58]
            : ["#c4ecff", "#171422", 0.5]
        }
      />
      <directionalLight
        position={[keySweepX, 6.4, 6.8]}
        intensity={2.1}
        color={tone === "light" ? "#fffaf4" : "#eff8ff"}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
      />
      <directionalLight position={[-5.4, 3.0, -4.6]} intensity={1.2} color="#d7f3ff" />
      <pointLight
        position={[0, -0.52, 0.55]}
        intensity={0.9 + lockFlash * 2.1}
        distance={5.8}
        color={BRAND.magentaBright}
      />
      <pointLight
        position={[0, -0.68, -0.45]}
        intensity={0.65 + lockFlash * 1.1}
        distance={5.0}
        color={BRAND.cyan}
      />

      {/* Studio Pedestal (radius ~ 2.0) — rim ignites at lock */}
      <StudioPedestal
        tone={tone}
        trimColor={lockFlash > 0.2 ? BRAND.goldBright : BRAND.gold}
        trimEmissive={BRAND.magentaBright}
        trimEmissiveIntensity={lockFlash * 0.72}
        floorGlowColor={[225, 40, 150]}
        floorGlowOpacity={0.14 + lockFlash * 0.42}
        deckAccentRingColor={BRAND.cyan}
        deckAccentRingEmissive={0.55 + lockFlash * 1.75}
      />

      {/* Sculpted Dock Slot Cradle on Pedestal Deck */}
      <group position={[0, PEDESTAL_DECK_Y, 0]}>
        <group scale={SLOT_DOCK_SCALE}>
          {/* Dock main beveled plinth */}
          <mesh geometry={assets.dockBaseGeo} castShadow receiveShadow>
            <meshPhysicalMaterial
              color="#2b2e3d"
              metalness={0.58}
              roughness={0.3}
              clearcoat={0.62}
              clearcoatRoughness={0.18}
              envMapIntensity={1.45}
            />
          </mesh>

          {/* Front & back beveled dock slot cheeks forming physical insertion channel */}
          <mesh
            geometry={assets.cheekGeo}
            position={[0, 0.16, 0.32]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color={BRAND.ceramicSoft}
              metalness={0.14}
              roughness={0.22}
              clearcoat={0.78}
              clearcoatRoughness={0.12}
              envMapIntensity={1.3}
            />
          </mesh>
          <mesh
            geometry={assets.cheekGeo}
            position={[0, 0.16, -0.32]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color={BRAND.ceramicSoft}
              metalness={0.14}
              roughness={0.22}
              clearcoat={0.78}
              clearcoatRoughness={0.12}
              envMapIntensity={1.3}
            />
          </mesh>

          {/* Luminous top bevel guide rails on both cheeks */}
          <mesh position={[0, 0.585, 0.32]}>
            <boxGeometry args={[1.08, 0.022, 0.036]} />
            <meshStandardMaterial
              color={BRAND.cyanSoft}
              emissive={BRAND.cyan}
              emissiveIntensity={0.85 + lockFlash * 1.6}
              roughness={0.15}
            />
          </mesh>
          <mesh position={[0, 0.585, -0.32]}>
            <boxGeometry args={[1.08, 0.022, 0.036]} />
            <meshStandardMaterial
              color={BRAND.cyanSoft}
              emissive={BRAND.cyan}
              emissiveIntensity={0.85 + lockFlash * 1.6}
              roughness={0.15}
            />
          </mesh>

          {/* Recessed glowing optical slot core bed */}
          <mesh position={[0, 0.195, 0]}>
            <boxGeometry args={[1.18, 0.036, 0.42]} />
            <meshStandardMaterial
              color="#ff74c6"
              emissive={BRAND.magentaBright}
              emissiveIntensity={1.0 + lockFlash * 2.1}
              roughness={0.12}
            />
          </mesh>

          {/* Frosted optical glass diffuser lens over slot bed */}
          <mesh position={[0, 0.225, 0]}>
            <boxGeometry args={[1.22, 0.024, 0.46]} />
            <meshPhysicalMaterial
              color="#f0f9ff"
              transparent
              opacity={0.34}
              roughness={0.08}
              metalness={0.05}
              clearcoat={1.0}
              ior={1.48}
            />
          </mesh>

          {/* Sliding brushed-aluminum lock clamps (snap inward on lock) */}
          <mesh
            geometry={assets.clampGeo}
            position={[-clampX, 0.16, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={BRAND.aluminum}
              metalness={0.9}
              roughness={0.18}
              envMapIntensity={1.6}
            />
          </mesh>
          <mesh
            geometry={assets.clampGeo}
            position={[clampX, 0.16, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={BRAND.aluminum}
              metalness={0.9}
              roughness={0.18}
              envMapIntensity={1.6}
            />
          </mesh>
        </group>

        {/* Expanding luminous lock shock-ring sweeping across the pedestal deck */}
        {shockOpacity > 0.01 && (
          <mesh
            position={[0, 0.05, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={0.75 + shockExpandT * 1.25}
          >
            <torusGeometry args={[1.0, 0.026, 16, 80]} />
            <meshBasicMaterial
              color={BRAND.magentaBright}
              transparent
              opacity={shockOpacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* Dynamic hover shadow projected onto pedestal deck */}
        <mesh
          position={[0, 0.015, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={tokenShadowScale}
        >
          <planeGeometry args={[2.55, 2.05]} />
          <meshBasicMaterial
            map={assets.padShadowTex}
            transparent
            depthWrite={false}
            opacity={tokenShadowOpacity}
          />
        </mesh>
      </group>

      {/* Hero AgentToken sliding down into the glowing slot & locking large and clear */}
      <group position={[0, tokenY, 0]}>
        <AgentToken
          frame={frame}
          scale={1.22}
          spin={tokenSpinDeg}
          ringGlow={lockFlash}
          ringFlatness={ringFlatness}
        />
      </group>

      {/* Depth-parallax gem confetti reacting to lock impact */}
      <GemConfetti frame={frame} gems={slotGems} impulseY={gemImpulseY} />
    </group>
  );
};

// ============================================================================
// 4. MazeWorld — 3D Beveled Labyrinth Diorama + Moving Solver Token ("SOLVER")
// ============================================================================

// Verified 7x7 open-corridor path waypoints (col, row), 14 cells total, zero wall intersections
const MAZE_PITCH = 0.34;
const MAZE_WALL_T = 0.15;
const MAZE_DIORAMA_SCALE = 1.12;
const mazeCoord = (idx: number): number => (idx - 3) * MAZE_PITCH;

interface MazeSegment {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  lenCells: number;
  cumStart: number;
}

const MAZE_WAYPOINTS: ReadonlyArray<[number, number]> = [
  [1, 1],
  [3, 1],
  [3, 3],
  [1, 3],
  [1, 5],
  [5, 5],
  [5, 3],
];

const MAZE_SEGMENTS: ReadonlyArray<MazeSegment> = (() => {
  const segs: MazeSegment[] = [];
  let acc = 0;
  for (let i = 0; i < MAZE_WAYPOINTS.length - 1; i++) {
    const [c0, r0] = MAZE_WAYPOINTS[i];
    const [c1, r1] = MAZE_WAYPOINTS[i + 1];
    const lenCells = Math.abs(c1 - c0) + Math.abs(r1 - r0);
    segs.push({
      x0: mazeCoord(c0),
      z0: mazeCoord(r0),
      x1: mazeCoord(c1),
      z1: mazeCoord(r1),
      lenCells,
      cumStart: acc,
    });
    acc += lenCells;
  }
  return segs;
})();

const MAZE_TOTAL_CELLS = 14;

export const MazeWorld: React.FC<MazeWorldProps> = ({
  frame,
  tone = "dark",
  withCamera = true,
}) => {
  const { fps } = useVideoConfig();

  // Closer orbital camera glide filling frame width & keeping SOLVER plaque large on mobile
  const orbitT = interpolate(frame, [0, 90], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });
  const enterT = interpolate(frame, [0, 20], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const camX = -1.65 + orbitT * 3.3;
  const camY = 4.45 - enterT * 0.32 + Math.sin(orbitT * Math.PI) * 0.24;
  const camZ = 12.75 - enterT * 0.45 - orbitT * 0.22;

  const keySweepX = interpolate(frame, [0, 90], [-5.4, 5.4], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  // Solver progress along the 14-cell labyrinth path
  const travel = interpolate(frame, [5, 76], [0, MAZE_TOTAL_CELLS], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  let solverX = MAZE_SEGMENTS[0].x0;
  let solverZ = MAZE_SEGMENTS[0].z0;
  let solverHeading = 0;

  for (const seg of MAZE_SEGMENTS) {
    if (travel >= seg.cumStart) {
      const localFrac = Math.min(1, (travel - seg.cumStart) / seg.lenCells);
      solverX = seg.x0 + (seg.x1 - seg.x0) * localFrac;
      solverZ = seg.z0 + (seg.z1 - seg.z0) * localFrac;
      solverHeading = Math.atan2(seg.x1 - seg.x0, seg.z1 - seg.z0);
    }
  }

  // Celebratory pulse when solver reaches goal (col 5, row 3)
  const solvedBoost = interpolate(frame, [72, 82], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const wallRiseSpring = spring({
    frame: frame - 1,
    fps,
    config: { damping: 18, stiffness: 135, mass: 0.9 },
  });

  // Wall layout specs (exact non-overlapping joins, zero corridor blockage)
  const wallDefs = useMemo(
    () => [
      { key: "back", x: 0, z: -1.02, w: 2.19, d: MAZE_WALL_T, h: 0.42, outer: true },
      { key: "front", x: 0, z: 1.02, w: 2.19, d: MAZE_WALL_T, h: 0.42, outer: true },
      { key: "left", x: -1.02, z: 0, w: MAZE_WALL_T, d: 1.89, h: 0.42, outer: true },
      { key: "right", x: 1.02, z: 0, w: MAZE_WALL_T, d: 1.89, h: 0.42, outer: true },
      { key: "inA", x: -0.605, z: -0.34, w: 0.68, d: MAZE_WALL_T, h: 0.34, outer: false },
      { key: "inB", x: 0.605, z: -0.34, w: 0.68, d: MAZE_WALL_T, h: 0.34, outer: false },
      { key: "inC", x: 0.34, z: 0, w: MAZE_WALL_T, d: 0.53, h: 0.34, outer: false },
      { key: "inD", x: 0, z: 0.34, w: 0.83, d: MAZE_WALL_T, h: 0.34, outer: false },
    ],
    []
  );

  const assets = useMemo(() => {
    const boardGeo = createUprightBeveledBlockGeometry(2.46, 2.46, 0.1, 0.24, 0.025, 5);
    const wallGeos = wallDefs.map((wd) =>
      createUprightBeveledBlockGeometry(wd.w, wd.d, wd.h, 0.036, 0.016, 4)
    );
    return { boardGeo, wallGeos };
  }, [wallDefs]);

  useEffect(() => {
    return () => {
      assets.boardGeo.dispose();
      assets.wallGeos.forEach((g) => g.dispose());
    };
  }, [assets]);

  const localBoardTopY = 0.1;
  const goalX = mazeCoord(5);
  const goalZ = mazeCoord(3);
  const startX = mazeCoord(1);
  const startZ = mazeCoord(1);
  const solverHoverY = 0.06 + Math.sin(frame * 0.18) * 0.015;

  const mazeGems = [
    { pos: [1.78, 0.86, -0.75] as [number, number, number], scale: 0.098, color: BRAND.cyan, phase: 0.4, metalness: 0.22, roughness: 0.12 },
    { pos: [-1.75, 0.42, 0.65] as [number, number, number], scale: 0.092, color: BRAND.ceramic, phase: 1.7, metalness: 0.18, roughness: 0.16 },
    { pos: [1.54, 1.32, 0.55] as [number, number, number], scale: 0.076, color: BRAND.gold, phase: 2.8, metalness: 0.9, roughness: 0.16 },
  ];

  return (
    <group>
      {withCamera && (
        <CameraRig position={[camX, camY, camZ]} target={[0, -0.55, 0]} fov={34} />
      )}
      <StudioEnvironment tone={tone} />

      <hemisphereLight
        args={
          tone === "light"
            ? ["#ffffff", "#e2dad2", 0.56]
            : ["#c5ecff", "#171422", 0.52]
        }
      />
      <directionalLight
        position={[keySweepX, 6.8, 6.2]}
        intensity={2.1}
        color="#f6fbff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
      />
      <directionalLight
        position={[-5.2, 3.2, -4.6]}
        intensity={1.3}
        color={tone === "dark" ? BRAND.magenta : "#d4f2ff"}
      />
      <pointLight
        position={[
          solverX * MAZE_DIORAMA_SCALE,
          PEDESTAL_DECK_Y + (localBoardTopY + 0.48) * MAZE_DIORAMA_SCALE,
          solverZ * MAZE_DIORAMA_SCALE,
        ]}
        intensity={1.45 + solvedBoost * 0.9}
        distance={4.2}
        color={BRAND.cyan}
      />

      {/* Pedestal + SOLVER Diorama Plaque */}
      <StudioPedestal
        tone={tone}
        trimColor={BRAND.gold}
        floorGlowColor={[34, 211, 238]}
        floorGlowOpacity={0.22 + solvedBoost * 0.25}
        deckAccentRingColor={BRAND.cyan}
        deckAccentRingEmissive={0.65 + solvedBoost * 0.95}
      />
      <DioramaPlaque label="SOLVER" accentColor={BRAND.cyan} />

      {/* Enlarged Maze Diorama Assembly Anchored Cleanly on Pedestal Deck */}
      <group position={[0, PEDESTAL_DECK_Y, 0]} scale={MAZE_DIORAMA_SCALE}>
        {/* Maze Board Slab on Pedestal Deck */}
        <mesh geometry={assets.boardGeo} position={[0, 0, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#1e2230"
            metalness={0.56}
            roughness={0.34}
            clearcoat={0.55}
            clearcoatRoughness={0.22}
            envMapIntensity={1.35}
          />
        </mesh>

        {/* Extruded Beveled Maze Walls (grow cleanly on entrance) */}
        <group
          position={[0, localBoardTopY, 0]}
          scale={[1, Math.max(0.05, wallRiseSpring), 1]}
        >
          {wallDefs.map((wd, idx) => (
            <mesh
              key={wd.key}
              geometry={assets.wallGeos[idx]}
              position={[wd.x, 0, wd.z]}
              castShadow
              receiveShadow
            >
              <meshPhysicalMaterial
                color={wd.outer ? BRAND.ceramic : "#dfe2ee"}
                metalness={wd.outer ? 0.14 : 0.2}
                roughness={wd.outer ? 0.2 : 0.24}
                clearcoat={0.78}
                clearcoatRoughness={0.14}
                envMapIntensity={1.35}
              />
            </mesh>
          ))}

          {/* 4 Brushed-titanium architectural corner pins */}
          {[
            [-1.08, -1.08],
            [1.08, -1.08],
            [-1.08, 1.08],
            [1.08, 1.08],
          ].map(([cx, cz], i) => (
            <mesh key={i} position={[cx, 0.23, cz]} castShadow>
              <cylinderGeometry args={[0.044, 0.044, 0.46, 20]} />
              <meshStandardMaterial
                color={BRAND.aluminum}
                metalness={0.92}
                roughness={0.16}
                envMapIntensity={1.7}
              />
            </mesh>
          ))}
        </group>

        {/* Luminous Cyan Path Trail Drawn Progressively Behind Moving Solver */}
        <group position={[0, localBoardTopY + 0.01, 0]}>
          {/* Origin marker pad */}
          <mesh position={[startX, 0, startZ]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.105, 0.014, 12, 32]} />
            <meshStandardMaterial color={BRAND.gold} metalness={0.92} roughness={0.18} />
          </mesh>

          {MAZE_SEGMENTS.map((seg, i) => {
            const frac = Math.max(
              0,
              Math.min(1, (travel - seg.cumStart) / seg.lenCells)
            );
            if (frac <= 0.005) {
              return null;
            }
            const dx = seg.x1 - seg.x0;
            const dz = seg.z1 - seg.z0;
            const isHoriz = Math.abs(dx) > Math.abs(dz);
            const fullDist = isHoriz ? Math.abs(dx) : Math.abs(dz);
            const curDist = fullDist * frac;
            const midX = seg.x0 + (dx * frac) / 2;
            const midZ = seg.z0 + (dz * frac) / 2;
            return (
              <mesh key={i} position={[midX, 0.005, midZ]}>
                <boxGeometry
                  args={[
                    isHoriz ? curDist + 0.05 : 0.055,
                    0.014,
                    isHoriz ? 0.055 : curDist + 0.05,
                  ]}
                />
                <meshStandardMaterial
                  color={BRAND.cyanSoft}
                  emissive={BRAND.cyan}
                  emissiveIntensity={1.25 + solvedBoost * 0.7}
                  roughness={0.18}
                />
              </mesh>
            );
          })}

          {/* Goal beacon crystal at (5, 3) */}
          <group position={[goalX, 0.01, goalZ]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.125, 0.016, 14, 36]} />
              <meshStandardMaterial
                color={BRAND.cyanSoft}
                emissive={BRAND.cyan}
                emissiveIntensity={1.0 + solvedBoost * 1.6}
                roughness={0.16}
              />
            </mesh>
            <mesh
              position={[0, 0.16 + Math.sin(frame * 0.14) * 0.025, 0]}
              rotation={[0.4, frame * 0.05, 0.25]}
              scale={0.072 + solvedBoost * 0.032}
            >
              <octahedronGeometry args={[1, 0]} />
              <meshPhysicalMaterial
                color="#ff72c4"
                emissive={BRAND.magentaBright}
                emissiveIntensity={1.25 + solvedBoost * 1.4}
                clearcoat={1.0}
                roughness={0.08}
              />
            </mesh>
          </group>
        </group>

        {/* Moving Mini Solver Token Navigating the Labyrinth */}
        <group
          position={[solverX, localBoardTopY + solverHoverY, solverZ]}
          rotation={[0, solverHeading, 0]}
        >
          {/* Sculpted metallic-ceramic mini token base */}
          <mesh castShadow>
            <cylinderGeometry args={[0.118, 0.126, 0.088, 32]} />
            <meshPhysicalMaterial
              color={BRAND.ceramic}
              metalness={0.16}
              roughness={0.18}
              clearcoat={0.9}
              envMapIntensity={1.45}
            />
          </mesh>
          {/* Tilted micro champagne-gold orbit collar */}
          <mesh
            position={[0, 0.02, 0]}
            rotation={[Math.PI / 2 + 0.35, frame * 0.08, 0]}
          >
            <torusGeometry args={[0.142, 0.014, 14, 40]} />
            <meshStandardMaterial
              color={BRAND.gold}
              metalness={0.94}
              roughness={0.15}
              envMapIntensity={1.75}
            />
          </mesh>
          {/* Glowing cyan core crystal */}
          <mesh
            position={[0, 0.11, 0]}
            rotation={[frame * 0.05, frame * 0.09, 0]}
            scale={1 + solvedBoost * 0.2}
          >
            <octahedronGeometry args={[0.072, 0]} />
            <meshPhysicalMaterial
              color={BRAND.cyanSoft}
              emissive={BRAND.cyan}
              emissiveIntensity={1.85 + solvedBoost * 1.1}
              roughness={0.06}
              clearcoat={1.0}
            />
          </mesh>
        </group>
      </group>

      <GemConfetti frame={frame} gems={mazeGems} />
    </group>
  );
};

// ============================================================================
// 5. CsvWorld — 3D Beveled Row/Column Grid Lifting in a Traveling Wave ("CSV")
// ============================================================================

const CSV_ROWS = 5;
const CSV_COLS = 5;
const CSV_PITCH = 0.41;
const CSV_DIORAMA_SCALE = 1.12;

export const CsvWorld: React.FC<CsvWorldProps> = ({
  frame,
  tone = "light",
  withCamera = true,
}) => {
  const { fps } = useVideoConfig();

  // Closer orbital camera glide filling frame width & keeping CSV plaque large on mobile
  const orbitT = interpolate(frame, [0, 90], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });
  const enterT = interpolate(frame, [0, 18], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const camX = 1.65 - orbitT * 3.3;
  const camY = 4.35 - enterT * 0.28 + Math.sin(orbitT * Math.PI) * 0.22;
  const camZ = 12.8 - enterT * 0.45 - orbitT * 0.25;

  const keySweepX = interpolate(frame, [0, 90], [5.2, -5.2], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  const assets = useMemo(() => {
    const trayGeo = createUprightBeveledBlockGeometry(2.46, 2.46, 0.11, 0.24, 0.025, 5);
    const tileGeo = createUprightBeveledBlockGeometry(0.325, 0.325, 0.22, 0.062, 0.022, 5);
    const capGeo = createUprightBeveledBlockGeometry(0.245, 0.245, 0.026, 0.04, 0.007, 3);
    return { trayGeo, tileGeo, capGeo };
  }, []);

  useEffect(() => {
    return () => {
      assets.trayGeo.dispose();
      assets.tileGeo.dispose();
      assets.capGeo.dispose();
    };
  }, [assets]);

  const localTrayTopY = 0.11;

  // Smooth floating translucent glass scan bar drifting across rows
  const scanRowZ = Math.sin(frame * 0.085) * 0.88;

  const csvGems = [
    { pos: [-1.78, 0.94, -0.58] as [number, number, number], scale: 0.1, color: BRAND.cyan, phase: 0.7, metalness: 0.2, roughness: 0.14 },
    { pos: [1.76, 0.45, 0.62] as [number, number, number], scale: 0.095, color: BRAND.magentaBright, phase: 1.9, metalness: 0.22, roughness: 0.12 },
    { pos: [1.56, 1.34, -0.65] as [number, number, number], scale: 0.08, color: BRAND.gold, phase: 2.9, metalness: 0.9, roughness: 0.16 },
  ];

  // Precompute deterministic 5x5 cells
  const cells: Array<{ row: number; col: number; x: number; z: number }> = [];
  for (let row = 0; row < CSV_ROWS; row++) {
    for (let col = 0; col < CSV_COLS; col++) {
      cells.push({
        row,
        col,
        x: (col - (CSV_COLS - 1) / 2) * CSV_PITCH,
        z: (row - (CSV_ROWS - 1) / 2) * CSV_PITCH,
      });
    }
  }

  return (
    <group>
      {withCamera && (
        <CameraRig position={[camX, camY, camZ]} target={[0, -0.48, 0]} fov={34} />
      )}
      <StudioEnvironment tone={tone} />

      <hemisphereLight
        args={
          tone === "light"
            ? ["#ffffff", "#e5dcd4", 0.58]
            : ["#c5ecff", "#171422", 0.52]
        }
      />
      <directionalLight
        position={[keySweepX, 6.6, 6.4]}
        intensity={2.1}
        color={tone === "light" ? "#fffaf4" : "#eef8ff"}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
      />
      <directionalLight position={[5.0, 3.0, -4.6]} intensity={1.2} color="#d7f3ff" />
      <pointLight
        position={[
          0,
          PEDESTAL_DECK_Y + (localTrayTopY + 0.95) * CSV_DIORAMA_SCALE,
          scanRowZ * CSV_DIORAMA_SCALE,
        ]}
        intensity={1.1}
        distance={5.2}
        color={BRAND.cyan}
      />

      {/* Pedestal + CSV Diorama Plaque */}
      <StudioPedestal
        tone={tone}
        trimColor={BRAND.gold}
        floorGlowColor={[34, 211, 238]}
        floorGlowOpacity={0.2}
        deckAccentRingColor={BRAND.cyan}
        deckAccentRingEmissive={0.62}
      />
      <DioramaPlaque label="CSV" accentColor={BRAND.cyan} />

      {/* Enlarged CSV Diorama Assembly Anchored Cleanly on Pedestal Deck */}
      <group position={[0, PEDESTAL_DECK_Y, 0]} scale={CSV_DIORAMA_SCALE}>
        {/* Anodized Matrix Base Tray */}
        <mesh geometry={assets.trayGeo} position={[0, 0, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#222534"
            metalness={0.6}
            roughness={0.32}
            clearcoat={0.58}
            clearcoatRoughness={0.2}
            envMapIntensity={1.4}
          />
        </mesh>

        {/* Brushed-aluminum row & column alignment rails on tray border */}
        <mesh position={[0, localTrayTopY + 0.015, -1.12]} castShadow>
          <boxGeometry args={[2.04, 0.028, 0.044]} />
          <meshStandardMaterial
            color={BRAND.gold}
            metalness={0.93}
            roughness={0.16}
            envMapIntensity={1.7}
          />
        </mesh>
        <mesh position={[-1.12, localTrayTopY + 0.015, 0]} castShadow>
          <boxGeometry args={[0.044, 0.028, 2.04]} />
          <meshStandardMaterial
            color={BRAND.aluminum}
            metalness={0.9}
            roughness={0.18}
            envMapIntensity={1.6}
          />
        </mesh>

        {/* 5x5 Beveled 3D Data Grid Lifting Alternately in a Traveling Wave */}
        <group position={[0, localTrayTopY, 0]}>
          {cells.map(({ row, col, x, z }) => {
            const isHeaderRow = row === 0;
            const isKeyCol = col === 0 && !isHeaderRow;

            // Staggered spring entrance along diagonal
            const staggerDelay = (row + col) * 1.6;
            const popSpring = spring({
              frame: frame - staggerDelay,
              fps,
              config: { damping: 16, stiffness: 155, mass: 0.88 },
            });

            // Traveling alternating wave across rows and columns (smoothstepped, non-linear)
            const wavePhase = frame * 0.145 - row * 0.72 - col * 0.58;
            const rawWave = 0.5 + 0.5 * Math.sin(wavePhase);
            const smoothWave = rawWave * rawWave * (3 - 2 * rawWave);

            const baseRest = isHeaderRow ? 0.08 : 0.02;
            const liftAmp = isHeaderRow ? 0.34 : 0.52;
            const lift = (baseRest + smoothWave * liftAmp) * popSpring;
            const tileTiltX = Math.cos(wavePhase) * 0.055 * popSpring;
            const tileTiltZ = -Math.sin(wavePhase) * 0.045 * popSpring;

            // Focused crest glow: only cells near the crest illuminate clearly
            const crestGlow = Math.max(0, (smoothWave - 0.62) / 0.38) * popSpring;

            return (
              <group key={`${row}-${col}`} position={[x, 0, z]}>
                {/* Recessed glowing under-socket pad revealed when tile rises */}
                <mesh position={[0, 0.008, 0]}>
                  <boxGeometry args={[0.25, 0.012, 0.25]} />
                  <meshStandardMaterial
                    color={isHeaderRow ? BRAND.goldBright : BRAND.cyanSoft}
                    emissive={isHeaderRow ? BRAND.gold : BRAND.cyan}
                    emissiveIntensity={0.28 + crestGlow * 1.35}
                    roughness={0.2}
                  />
                </mesh>

                {/* Telescoping brushed-chrome actuator piston staying strictly above tray floor */}
                {lift > 0.02 && (
                  <mesh position={[0, lift / 2, 0]} castShadow>
                    <cylinderGeometry args={[0.042, 0.048, lift, 18]} />
                    <meshStandardMaterial
                      color={BRAND.aluminum}
                      metalness={0.94}
                      roughness={0.16}
                      envMapIntensity={1.7}
                    />
                  </mesh>
                )}

                {/* Sculpted beveled 3D cell block */}
                <group
                  position={[0, lift, 0]}
                  rotation={[tileTiltX, 0, tileTiltZ]}
                  scale={Math.max(0.05, popSpring)}
                >
                  <mesh geometry={assets.tileGeo} castShadow receiveShadow>
                    {isHeaderRow ? (
                      <meshStandardMaterial
                        color="#2f3344"
                        metalness={0.78}
                        roughness={0.22}
                        envMapIntensity={1.55}
                      />
                    ) : isKeyCol ? (
                      <meshStandardMaterial
                        color={BRAND.aluminum}
                        metalness={0.86}
                        roughness={0.2}
                        envMapIntensity={1.55}
                      />
                    ) : (
                      <meshPhysicalMaterial
                        color={BRAND.ceramic}
                        metalness={0.12}
                        roughness={0.2}
                        clearcoat={0.84}
                        clearcoatRoughness={0.1}
                        envMapIntensity={1.35}
                      />
                    )}
                  </mesh>

                  {/* Optical glass / gold accent cap plate on top of each tile */}
                  <mesh geometry={assets.capGeo} position={[0, 0.218, 0]}>
                    {isHeaderRow ? (
                      <meshStandardMaterial
                        color={BRAND.gold}
                        emissive={BRAND.goldBright}
                        emissiveIntensity={crestGlow * 0.42}
                        metalness={0.94}
                        roughness={0.15}
                        envMapIntensity={1.8}
                      />
                    ) : (
                      <meshPhysicalMaterial
                        color={crestGlow > 0.2 ? BRAND.cyanSoft : "#d4edf8"}
                        emissive={BRAND.cyan}
                        emissiveIntensity={0.08 + crestGlow * 1.1}
                        metalness={0.1}
                        roughness={0.08}
                        clearcoat={1.0}
                        transparent
                        opacity={0.75 + crestGlow * 0.25}
                      />
                    )}
                  </mesh>
                </group>
              </group>
            );
          })}

          {/* Sleek floating translucent glass scan bar hovering across active rows */}
          <group position={[0, 0.88, scanRowZ]}>
            <mesh>
              <boxGeometry args={[2.16, 0.036, 0.095]} />
              <meshPhysicalMaterial
                color="#d8f6ff"
                emissive={BRAND.cyan}
                emissiveIntensity={0.45}
                transparent
                opacity={0.34}
                roughness={0.05}
                clearcoat={1.0}
                ior={1.5}
                depthWrite={false}
              />
            </mesh>
            <mesh position={[-1.1, 0, 0]} castShadow>
              <cylinderGeometry args={[0.034, 0.034, 0.11, 18]} />
              <meshStandardMaterial color={BRAND.aluminum} metalness={0.94} roughness={0.15} />
            </mesh>
            <mesh position={[1.1, 0, 0]} castShadow>
              <cylinderGeometry args={[0.034, 0.034, 0.11, 18]} />
              <meshStandardMaterial color={BRAND.aluminum} metalness={0.94} roughness={0.15} />
            </mesh>
          </group>
        </group>
      </group>

      <GemConfetti frame={frame} gems={csvGems} />
    </group>
  );
};

// ============================================================================
// 6. VmWorld — 3D Instruction Stack Building One by One ("TINY VM")
// ============================================================================

const VM_DIORAMA_SCALE = 1.16;

const VM_BLOCK_SPECS: ReadonlyArray<{
  startFrame: number;
  kind: "ceramic" | "slate" | "aluminum" | "obsidian" | "hero";
  notchWidth: number;
  notchOffsetX: number;
}> = [
  { startFrame: 4, kind: "slate", notchWidth: 0.44, notchOffsetX: -0.18 },
  { startFrame: 14, kind: "ceramic", notchWidth: 0.56, notchOffsetX: 0.12 },
  { startFrame: 24, kind: "aluminum", notchWidth: 0.36, notchOffsetX: -0.22 },
  { startFrame: 34, kind: "obsidian", notchWidth: 0.62, notchOffsetX: 0.05 },
  { startFrame: 44, kind: "ceramic", notchWidth: 0.48, notchOffsetX: -0.12 },
  { startFrame: 54, kind: "hero", notchWidth: 0.54, notchOffsetX: 0 },
];

export const VmWorld: React.FC<VmWorldProps> = ({
  frame,
  tone = "dark",
  withCamera = true,
}) => {
  const { fps } = useVideoConfig();

  // Closer framing as the 6 instruction blocks stack upward, keeping TINY VM plaque crisp
  const buildT = interpolate(frame, [0, 75], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });
  const enterT = interpolate(frame, [0, 18], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const camX = -1.55 + buildT * 3.1;
  const camY = 3.25 + buildT * 0.85 - (1 - enterT) * 0.15;
  const camZ = 13.2 - enterT * 0.45 - buildT * 0.3;

  const keySweepX = interpolate(frame, [0, 90], [-5.2, 5.2], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  const assets = useMemo(() => {
    const baseSocketGeo = createUprightBeveledBlockGeometry(1.74, 1.74, 0.15, 0.2, 0.028, 5);
    const blockGeo = createUprightBeveledBlockGeometry(1.28, 1.02, 0.22, 0.11, 0.024, 5);
    const spacerGeo = createUprightBeveledBlockGeometry(0.92, 0.72, 0.055, 0.08, 0.01, 3);
    const pointerShape = createHollowRoundedFrameShape(1.46, 1.2, 0.16, 1.37, 1.11, 0.12);
    const pointerGeo = new THREE.ExtrudeGeometry(pointerShape, {
      depth: 0.032,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 3,
      curveSegments: 16,
    });
    pointerGeo.center();
    pointerGeo.rotateX(Math.PI / 2);

    return { baseSocketGeo, blockGeo, spacerGeo, pointerGeo };
  }, []);

  useEffect(() => {
    return () => {
      assets.baseSocketGeo.dispose();
      assets.blockGeo.dispose();
      assets.spacerGeo.dispose();
      assets.pointerGeo.dispose();
    };
  }, [assets]);

  const localStackBaseY = 0.15;
  const blockPitch = 0.265;

  // Smoothly step the instruction pointer collar upward to follow the newest arrived block
  let pointerLevel = 0;
  for (let i = 1; i < VM_BLOCK_SPECS.length; i++) {
    const stepT = interpolate(
      frame,
      [VM_BLOCK_SPECS[i].startFrame, VM_BLOCK_SPECS[i].startFrame + 9],
      [0, 1],
      { easing: EASE_OUT, ...CLAMP }
    );
    pointerLevel += stepT;
  }
  const localPointerY = localStackBaseY + 0.14 + pointerLevel * blockPitch;
  const pointerVisible = interpolate(frame, [2, 9], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  // Crown completion pulse when block #6 lands (~frame 60)
  const stackDonePulse = interpolate(frame, [58, 66], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const railPositions: ReadonlyArray<[number, number]> = [
    [-0.78, -0.78],
    [0.78, -0.78],
    [-0.78, 0.78],
    [0.78, 0.78],
  ];

  const vmGems = [
    { pos: [1.78, 1.18, -0.62] as [number, number, number], scale: 0.102, color: BRAND.magentaBright, phase: 0.6, metalness: 0.22, roughness: 0.12 },
    { pos: [-1.74, 0.68, 0.56] as [number, number, number], scale: 0.09, color: BRAND.cyan, phase: 1.8, metalness: 0.2, roughness: 0.14 },
    { pos: [1.58, -0.18, 0.88] as [number, number, number], scale: 0.082, color: BRAND.gold, phase: 2.7, metalness: 0.9, roughness: 0.16 },
  ];

  return (
    <group>
      {withCamera && (
        <CameraRig position={[camX, camY, camZ]} target={[0, -0.18, 0]} fov={34} />
      )}
      <StudioEnvironment tone={tone} />

      <hemisphereLight
        args={
          tone === "light"
            ? ["#ffffff", "#e2dad2", 0.56]
            : ["#c5ecff", "#171422", 0.5]
        }
      />
      <directionalLight
        position={[keySweepX, 6.8, 6.4]}
        intensity={2.15}
        color="#f4faff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
      />
      <directionalLight position={[-5.2, 3.0, -4.4]} intensity={1.35} color={BRAND.magenta} />
      <pointLight
        position={[
          0,
          PEDESTAL_DECK_Y + (localPointerY + 0.1) * VM_DIORAMA_SCALE,
          0.85 * VM_DIORAMA_SCALE,
        ]}
        intensity={1.35 + stackDonePulse * 0.8}
        distance={5.0}
        color={BRAND.magentaBright}
      />
      <pointLight
        position={[
          0,
          PEDESTAL_DECK_Y + (localStackBaseY + 0.3) * VM_DIORAMA_SCALE,
          -0.8 * VM_DIORAMA_SCALE,
        ]}
        intensity={0.8}
        distance={4.6}
        color={BRAND.cyan}
      />

      {/* Pedestal + TINY VM Diorama Plaque */}
      <StudioPedestal
        tone={tone}
        trimColor={BRAND.gold}
        floorGlowColor={[225, 40, 150]}
        floorGlowOpacity={0.22 + stackDonePulse * 0.24}
        deckAccentRingColor={BRAND.magentaBright}
        deckAccentRingEmissive={0.7 + stackDonePulse * 1.1}
      />
      <DioramaPlaque label="TINY VM" accentColor={BRAND.magentaBright} />

      {/* Enlarged VM Execution Stack Assembly Anchored Cleanly on Pedestal Deck */}
      <group position={[0, PEDESTAL_DECK_Y, 0]} scale={VM_DIORAMA_SCALE}>
        {/* Machined Base Execution Socket */}
        <mesh geometry={assets.baseSocketGeo} position={[0, 0, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#232736"
            metalness={0.68}
            roughness={0.28}
            clearcoat={0.65}
            clearcoatRoughness={0.16}
            envMapIntensity={1.5}
          />
        </mesh>

        {/* Four Brushed-Chrome Corner Guide Rails + Frosted Glass Side Baffles */}
        <group position={[0, localStackBaseY, 0]}>
          {railPositions.map(([rx, rz], i) => (
            <group key={i} position={[rx, 0, rz]}>
              <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.036, 0.036, 2.04, 24]} />
                <meshStandardMaterial
                  color="#dce3ee"
                  metalness={0.96}
                  roughness={0.13}
                  envMapIntensity={1.85}
                />
              </mesh>
              {/* Chamfered gold rail crown cap */}
              <mesh position={[0, 2.06, 0]} castShadow>
                <cylinderGeometry args={[0.026, 0.044, 0.055, 24]} />
                <meshStandardMaterial
                  color={BRAND.gold}
                  metalness={0.94}
                  roughness={0.15}
                  envMapIntensity={1.8}
                />
              </mesh>
            </group>
          ))}

          {/* Left & right thin clearcoated glass side baffles for genuine depth refraction */}
          <mesh position={[-0.78, 0.96, 0]} renderOrder={3}>
            <boxGeometry args={[0.016, 1.82, 1.46]} />
            <meshPhysicalMaterial
              color="#d8f2ff"
              transparent
              opacity={0.13}
              roughness={0.05}
              metalness={0.1}
              clearcoat={1.0}
              ior={1.5}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0.78, 0.96, 0]} renderOrder={3}>
            <boxGeometry args={[0.016, 1.82, 1.46]} />
            <meshPhysicalMaterial
              color="#d8f2ff"
              transparent
              opacity={0.13}
              roughness={0.05}
              metalness={0.1}
              clearcoat={1.0}
              ior={1.5}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* Six Sculpted 3D Instruction Blocks Stacking Up One by One */}
        <group position={[0, localStackBaseY, 0]}>
          {VM_BLOCK_SPECS.map((spec, idx) => {
            const dropSpring = spring({
              frame: frame - spec.startFrame,
              fps,
              config: { damping: 13.5, stiffness: 185, mass: 0.86 },
            });
            const appearOpacity = interpolate(
              frame,
              [spec.startFrame - 1, spec.startFrame + 3],
              [0, 1],
              { easing: EASE_OUT, ...CLAMP }
            );

            if (appearOpacity <= 0.01) {
              return null;
            }

            const restY = 0.04 + idx * blockPitch;
            const dropOffsetY = (1 - dropSpring) * 1.45;
            const entryYaw = (1 - dropSpring) * (idx % 2 === 0 ? 0.24 : -0.24);
            const blockScale = 0.78 + 0.22 * Math.min(1.06, dropSpring);

            const pipLit = interpolate(
              frame,
              [spec.startFrame + 5, spec.startFrame + 11],
              [0.15, 1.55],
              { easing: EASE_OUT, ...CLAMP }
            );

            const isHero = spec.kind === "hero";

            return (
              <group
                key={idx}
                position={[0, restY + dropOffsetY, 0]}
                rotation={[0, entryYaw, 0]}
                scale={blockScale}
              >
                {/* Recessed mechanical bus-spacer beneath block */}
                <mesh geometry={assets.spacerGeo} position={[0, -0.042, 0]} castShadow>
                  <meshStandardMaterial color="#181b27" metalness={0.76} roughness={0.28} />
                </mesh>

                {/* Main beveled instruction block chassis */}
                <mesh geometry={assets.blockGeo} castShadow receiveShadow>
                  {spec.kind === "ceramic" ? (
                    <meshPhysicalMaterial
                      color={BRAND.ceramic}
                      metalness={0.12}
                      roughness={0.2}
                      clearcoat={0.82}
                      clearcoatRoughness={0.12}
                      envMapIntensity={1.35}
                    />
                  ) : spec.kind === "aluminum" ? (
                    <meshStandardMaterial
                      color={BRAND.aluminum}
                      metalness={0.88}
                      roughness={0.18}
                      envMapIntensity={1.6}
                    />
                  ) : spec.kind === "slate" ? (
                    <meshPhysicalMaterial
                      color="#313649"
                      metalness={0.62}
                      roughness={0.28}
                      clearcoat={0.65}
                      envMapIntensity={1.45}
                    />
                  ) : spec.kind === "obsidian" ? (
                    <meshPhysicalMaterial
                      color="#1b1f2e"
                      metalness={0.58}
                      roughness={0.26}
                      clearcoat={0.74}
                      envMapIntensity={1.45}
                    />
                  ) : (
                    <meshPhysicalMaterial
                      color="#2a1834"
                      emissive={BRAND.magenta}
                      emissiveIntensity={0.22 + stackDonePulse * 0.25}
                      metalness={0.48}
                      roughness={0.18}
                      clearcoat={0.92}
                      envMapIntensity={1.6}
                    />
                  )}
                </mesh>

                {/* Pure-geometry machined opcode notch bar on front face (zero text) */}
                <mesh position={[spec.notchOffsetX, 0.11, 0.515]}>
                  <boxGeometry args={[spec.notchWidth, 0.048, 0.022]} />
                  <meshStandardMaterial
                    color={isHero ? BRAND.gold : BRAND.aluminum}
                    metalness={0.9}
                    roughness={0.18}
                  />
                </mesh>

                {/* Front optical execution status pip */}
                <mesh position={[-0.48, 0.11, 0.518]}>
                  <sphereGeometry args={[0.028, 16, 16]} />
                  <meshStandardMaterial
                    color={isHero ? "#ff72c4" : BRAND.cyanSoft}
                    emissive={isHero ? BRAND.magentaBright : BRAND.cyan}
                    emissiveIntensity={pipLit + (isHero ? stackDonePulse * 0.9 : 0)}
                    roughness={0.12}
                  />
                </mesh>

                {/* Brushed-gold side bus pin accent strips */}
                <mesh position={[-0.646, 0.11, 0]}>
                  <boxGeometry args={[0.022, 0.052, 0.56]} />
                  <meshStandardMaterial color={BRAND.gold} metalness={0.93} roughness={0.16} />
                </mesh>
                <mesh position={[0.646, 0.11, 0]}>
                  <boxGeometry args={[0.022, 0.052, 0.56]} />
                  <meshStandardMaterial color={BRAND.gold} metalness={0.93} roughness={0.16} />
                </mesh>

                {/* Crowning glowing magenta core crystal on the top hero block */}
                {isHero && (
                  <mesh
                    position={[0, 0.34 + Math.sin(frame * 0.14) * 0.02, 0]}
                    rotation={[0.35 + frame * 0.02, frame * 0.05, 0.18]}
                    scale={0.105 * Math.min(1, dropSpring)}
                  >
                    <octahedronGeometry args={[1, 0]} />
                    <meshPhysicalMaterial
                      color="#ff6ac2"
                      emissive={BRAND.magentaBright}
                      emissiveIntensity={1.65 + stackDonePulse * 0.85}
                      roughness={0.07}
                      clearcoat={1.0}
                    />
                  </mesh>
                )}
              </group>
            );
          })}
        </group>

        {/* Luminous Instruction Pointer Collar Tracking the Top of the Stack */}
        {pointerVisible > 0.02 && (
          <mesh
            geometry={assets.pointerGeo}
            position={[0, localPointerY, 0]}
            scale={0.94 + pointerVisible * 0.06}
          >
            <meshStandardMaterial
              color="#ff6ec4"
              emissive={BRAND.magentaBright}
              emissiveIntensity={1.35 + stackDonePulse * 0.75}
              roughness={0.14}
              metalness={0.28}
            />
          </mesh>
        )}
      </group>

      <GemConfetti frame={frame} gems={vmGems} />
    </group>
  );
};

// ============================================================================
// 7. CoinField — Blank Rimmed Gold Coins Orbiting an Empty Pedestal (Zero Text)
// ============================================================================

interface CoinSpec {
  orbitR: number;
  baseY: number;
  baseAngle: number;
  orbitSpeed: number;
  spinY: number;
  tiltAmp: number;
  phase: number;
  scale: number;
}

// 16 deterministic multi-tier coin orbits (inner, mid, foreground/background parallax)
const COIN_SPECS: ReadonlyArray<CoinSpec> = [
  // Inner floating ring (6 coins)
  { orbitR: 1.12, baseY: -0.34, baseAngle: 0.25, orbitSpeed: 0.022, spinY: 0.075, tiltAmp: 0.36, phase: 0.4, scale: 0.95 },
  { orbitR: 1.28, baseY: 0.24, baseAngle: 1.32, orbitSpeed: 0.02, spinY: -0.068, tiltAmp: 0.32, phase: 1.2, scale: 1.04 },
  { orbitR: 1.08, baseY: 0.76, baseAngle: 2.38, orbitSpeed: 0.024, spinY: 0.082, tiltAmp: 0.4, phase: 2.1, scale: 0.92 },
  { orbitR: 1.34, baseY: -0.22, baseAngle: 3.45, orbitSpeed: 0.019, spinY: -0.072, tiltAmp: 0.34, phase: 3.0, scale: 1.02 },
  { orbitR: 1.18, baseY: 0.48, baseAngle: 4.52, orbitSpeed: 0.021, spinY: 0.066, tiltAmp: 0.38, phase: 3.9, scale: 0.98 },
  { orbitR: 1.38, baseY: 0.98, baseAngle: 5.56, orbitSpeed: 0.018, spinY: -0.078, tiltAmp: 0.3, phase: 4.7, scale: 0.9 },

  // Mid hero orbit ring (6 coins)
  { orbitR: 1.78, baseY: 0.14, baseAngle: 0.72, orbitSpeed: 0.015, spinY: -0.064, tiltAmp: 0.34, phase: 0.8, scale: 1.14 },
  { orbitR: 1.94, baseY: 0.82, baseAngle: 1.78, orbitSpeed: 0.014, spinY: 0.07, tiltAmp: 0.38, phase: 1.7, scale: 1.08 },
  { orbitR: 1.72, baseY: -0.44, baseAngle: 2.86, orbitSpeed: 0.016, spinY: -0.058, tiltAmp: 0.32, phase: 2.6, scale: 1.12 },
  { orbitR: 2.02, baseY: 0.44, baseAngle: 3.92, orbitSpeed: 0.013, spinY: 0.062, tiltAmp: 0.36, phase: 3.5, scale: 1.16 },
  { orbitR: 1.84, baseY: 1.24, baseAngle: 4.96, orbitSpeed: 0.015, spinY: -0.074, tiltAmp: 0.32, phase: 4.3, scale: 1.04 },
  { orbitR: 1.96, baseY: -0.14, baseAngle: 5.98, orbitSpeed: 0.014, spinY: 0.068, tiltAmp: 0.35, phase: 5.2, scale: 1.1 },

  // Outer depth-parallax accent coins passing both in front & behind pedestal (4 coins)
  { orbitR: 2.34, baseY: 1.44, baseAngle: 0.12, orbitSpeed: 0.011, spinY: 0.056, tiltAmp: 0.28, phase: 1.0, scale: 0.88 },
  { orbitR: 2.42, baseY: -0.5, baseAngle: 1.65, orbitSpeed: 0.01, spinY: -0.06, tiltAmp: 0.32, phase: 2.3, scale: 0.96 },
  { orbitR: 2.38, baseY: 0.66, baseAngle: 3.24, orbitSpeed: 0.012, spinY: 0.058, tiltAmp: 0.3, phase: 3.7, scale: 0.92 },
  { orbitR: 2.28, baseY: 1.12, baseAngle: 4.78, orbitSpeed: 0.011, spinY: -0.062, tiltAmp: 0.34, phase: 5.0, scale: 0.94 },
];

export const CoinField: React.FC<CoinFieldProps> = ({
  frame,
  tone = "dark",
  withCamera = true,
}) => {
  const { fps } = useVideoConfig();
  const { gl } = useThree();

  // Smooth cinematic studio orbit framing the empty pedestal & floating coin halo
  const orbitT = interpolate(frame, [0, 90], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });
  const enterT = interpolate(frame, [0, 20], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const camX = -1.75 + orbitT * 3.5;
  const camY = 4.1 - enterT * 0.28 + Math.sin(orbitT * Math.PI) * 0.22;
  const camZ = 15.8 - enterT * 0.52 - orbitT * 0.25;

  const keySweepX = interpolate(frame, [0, 90], [-5.6, 5.6], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  // Dedicated warm golden studio PMREM reflection map so coins render true warm gold against dark magenta
  const coinEnvRT = useMemo(() => {
    const equirect = createWarmGoldEnvCanvasTexture();
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
  }, [gl]);

  useEffect(() => {
    return () => {
      if (coinEnvRT) {
        coinEnvRT.dispose();
      }
    };
  }, [coinEnvRT]);

  // Shared blank rimmed coin geometries (ZERO logos, ZERO symbols, ZERO numbers, ZERO text)
  const coinGeos = useMemo(() => {
    const outerRimTorus = new THREE.TorusGeometry(0.256, 0.027, 20, 48);
    outerRimTorus.rotateX(Math.PI / 2);

    const outerBand = new THREE.CylinderGeometry(0.272, 0.272, 0.044, 48);
    const innerRecessedDisc = new THREE.CylinderGeometry(0.236, 0.236, 0.03, 48);

    const bevelStepRing = new THREE.TorusGeometry(0.238, 0.009, 12, 48);
    bevelStepRing.rotateX(Math.PI / 2);

    return { outerRimTorus, outerBand, innerRecessedDisc, bevelStepRing };
  }, []);

  useEffect(() => {
    return () => {
      coinGeos.outerRimTorus.dispose();
      coinGeos.outerBand.dispose();
      coinGeos.innerRecessedDisc.dispose();
      coinGeos.bevelStepRing.dispose();
    };
  }, [coinGeos]);

  // Shared warm yellow-gold bullion materials (warm emissive + tuned metalness/roughness + warm envMap)
  const coinMats = useMemo(() => {
    const coinEnvTex = coinEnvRT ? coinEnvRT.texture : null;
    const rimMat = new THREE.MeshStandardMaterial({
      color: "#ffd859",
      emissive: "#e8a820",
      emissiveIntensity: 0.32,
      metalness: 0.78,
      roughness: 0.16,
      envMap: coinEnvTex,
      envMapIntensity: coinEnvTex ? 1.38 : 0.9,
    });
    const faceMat = new THREE.MeshStandardMaterial({
      color: "#f7c948",
      emissive: "#d99818",
      emissiveIntensity: 0.26,
      metalness: 0.72,
      roughness: 0.24,
      envMap: coinEnvTex,
      envMapIntensity: coinEnvTex ? 1.2 : 0.8,
    });
    const innerStepMat = new THREE.MeshStandardMaterial({
      color: "#ffe680",
      emissive: "#f0b429",
      emissiveIntensity: 0.36,
      metalness: 0.8,
      roughness: 0.13,
      envMap: coinEnvTex,
      envMapIntensity: coinEnvTex ? 1.48 : 0.95,
    });
    return { rimMat, faceMat, innerStepMat };
  }, [coinEnvRT]);

  useEffect(() => {
    return () => {
      coinMats.rimMat.dispose();
      coinMats.faceMat.dispose();
      coinMats.innerStepMat.dispose();
    };
  }, [coinMats]);

  const goldGems = [
    { pos: [2.25, 1.52, -0.82] as [number, number, number], scale: 0.088, color: "#ffd859", phase: 0.5, metalness: 0.78, roughness: 0.16 },
    { pos: [-2.22, 1.24, -0.54] as [number, number, number], scale: 0.082, color: BRAND.ceramic, phase: 1.9, metalness: 0.2, roughness: 0.16 },
    { pos: [-1.88, -0.42, 1.15] as [number, number, number], scale: 0.074, color: "#f7c948", phase: 3.1, metalness: 0.76, roughness: 0.18 },
  ];

  const rimPulse = 0.28 + Math.sin((frame / 20) * Math.PI) * 0.12;
  const coinEnvTex = coinEnvRT ? coinEnvRT.texture : null;

  return (
    <group>
      {withCamera && (
        <CameraRig position={[camX, camY, camZ]} target={[0, -0.35, 0]} fov={34} />
      )}
      <StudioEnvironment tone={tone} />

      <hemisphereLight
        args={
          tone === "light"
            ? ["#ffffff", "#e5dcd4", 0.58]
            : ["#ffe8b0", "#261224", 0.68]
        }
      />
      {/* Warm sweeping studio key light catching brushed gold rims & faces */}
      <directionalLight
        position={[keySweepX, 6.8, 6.8]}
        intensity={2.45}
        color="#fff2cf"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
      />
      {/* Warm golden front-left fill so spinning coin faces stay rich yellow-gold */}
      <directionalLight position={[-4.8, 3.2, 5.2]} intensity={1.3} color="#ffd478" />
      {/* Subtle dark-magenta studio back-rim light for dramatic separation without cyan shift */}
      <directionalLight position={[5.0, 3.4, -4.8]} intensity={1.15} color="#e848a8" />
      {/* Warm golden radiance suspended above empty pedestal */}
      <pointLight
        position={[0, 0.45, 0.85]}
        intensity={2.0 + rimPulse * 0.75}
        distance={7.5}
        color="#ffc84a"
      />

      {/* Empty Sculptural Pedestal (radius ~ 2.0, zero text, warm brushed-gold inlay) */}
      <StudioPedestal
        tone={tone}
        trimColor="#ffd859"
        trimEmissive="#e08c18"
        trimEmissiveIntensity={0.32 + rimPulse * 0.48}
        floorGlowColor={[248, 198, 72]}
        floorGlowOpacity={0.28}
      />

      {/* Subtle concentric warm brushed-gold architectural inlay on the empty pedestal deck */}
      <mesh
        position={[0, PEDESTAL_DECK_Y + 0.012, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[1.18, 0.015, 16, 72]} />
        <meshStandardMaterial
          color="#f7c948"
          emissive="#c97f10"
          emissiveIntensity={0.22}
          metalness={0.78}
          roughness={0.2}
          envMap={coinEnvTex}
          envMapIntensity={1.3}
        />
      </mesh>
      <mesh
        position={[0, PEDESTAL_DECK_Y + 0.012, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[0.62, 0.011, 14, 56]} />
        <meshStandardMaterial
          color="#e2a82e"
          emissive="#b86f0e"
          emissiveIntensity={0.2}
          metalness={0.76}
          roughness={0.22}
          envMap={coinEnvTex}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* 16 Blank Rimmed Gold Coins Floating & Tumbling Around the Empty Pedestal */}
      <group>
        {COIN_SPECS.map((c, idx) => {
          const bloomSpring = spring({
            frame: frame - idx * 1.2,
            fps,
            config: { damping: 16, stiffness: 135, mass: 0.9 },
          });

          const r = c.orbitR * (0.42 + 0.58 * bloomSpring);
          const angle = c.baseAngle + frame * c.orbitSpeed;
          const x = Math.cos(angle) * r;
          const z = Math.sin(angle) * r;
          const bobY = Math.sin(frame * 0.075 + c.phase) * 0.09;
          const y = -0.85 + (c.baseY + 0.85) * bloomSpring + bobY * bloomSpring;

          // Coin orientation: tilted near vertical so face & raised edge gleam as it rotates
          const rotX = Math.PI / 2 + Math.sin(frame * 0.055 + c.phase) * c.tiltAmp;
          const rotY = c.phase + frame * c.spinY;
          const rotZ = Math.cos(frame * 0.048 + c.phase) * 0.22;
          const s = c.scale * Math.max(0.05, bloomSpring);

          return (
            <group
              key={idx}
              position={[x, y, z]}
              rotation={[rotX, rotY, rotZ]}
              scale={s}
            >
              {/* Raised milled-profile outer gold rim */}
              <mesh
                geometry={coinGeos.outerRimTorus}
                material={coinMats.rimMat}
                castShadow
              />
              {/* Outer metallic edge band */}
              <mesh
                geometry={coinGeos.outerBand}
                material={coinMats.rimMat}
                castShadow
              />
              {/* Blank recessed satin-gold inner faces (front & back, zero markings) */}
              <mesh
                geometry={coinGeos.innerRecessedDisc}
                material={coinMats.faceMat}
                receiveShadow
              />
              {/* Crisp specular inner lip bevel rings on top & bottom face */}
              <mesh
                geometry={coinGeos.bevelStepRing}
                material={coinMats.innerStepMat}
                position={[0, 0.017, 0]}
              />
              <mesh
                geometry={coinGeos.bevelStepRing}
                material={coinMats.innerStepMat}
                position={[0, -0.017, 0]}
              />
            </group>
          );
        })}
      </group>

      <GemConfetti frame={frame} gems={goldGems} />
    </group>
  );
};
