import React, { useEffect, useMemo } from "react";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// ============================================================================
// Shared Visual Tokens, Curves & Studio Scale (Aligned with DWorlds.tsx)
// ============================================================================

const BRAND = {
  magenta: "#c41c83",
  magentaBright: "#e12896",
  cyan: "#22d3ee",
  cyanSoft: "#67e8f9",
  emerald: "#10d998",
  emeraldBright: "#2ef0b4",
  gold: "#d8b458",
  goldBright: "#e8c86a",
  ceramic: "#eeecf2",
  aluminum: "#d5d9e3",
  slate: "#2b3044",
} as const;

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN = Easing.in(Easing.cubic);
const EASE_IN_OUT = Easing.inOut(Easing.cubic);

const CLAMP = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

// World coordinates matching DWorlds pedestal scale
const FLOOR_Y = -1.35;
const PEDESTAL_TOP_R = 1.98;
const PEDESTAL_BOT_R = 2.18;
const PEDESTAL_H = 0.24;
const PEDESTAL_CENTER_Y = FLOOR_Y + PEDESTAL_H / 2; // -1.23
const PEDESTAL_DECK_Y = FLOOR_Y + PEDESTAL_H; // -1.11

const GRID_ROWS = 4;
const GRID_COLS = 4;
const GRID_PITCH = 0.5;
const DIORAMA_SCALE = 1.12;

type StudioTone = "light" | "dark";

export interface TaskWorldProps {
  frame: number;
  tone?: StudioTone;
  withCamera?: boolean;
}

// ============================================================================
// Pure Procedural Geometry & Non-Text Studio Textures
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

// Upright extruded beveled block: exact outer footprint (totalW x totalD), bottom at y = 0
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

// Sculpted 3D Checkmark geometry with smooth filleted corners and deep bevels
const createCheckmarkGeometry = (): THREE.ExtrudeGeometry => {
  const pts: ReadonlyArray<readonly [number, number]> = [
    [-0.668, 0.048], // short-leg outer tip
    [-0.184, -0.437], // outer elbow
    [0.668, 0.416], // long-leg outer tip
    [0.492, 0.592], // long-leg inner tip
    [-0.184, -0.083], // inner elbow
    [-0.492, 0.224], // short-leg inner tip
  ];

  const filletRadius = 0.045;
  const shape = new THREE.Shape();
  const n = pts.length;

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    const vpx = prev[0] - curr[0];
    const vpy = prev[1] - curr[1];
    const lenP = Math.hypot(vpx, vpy);

    const vnx = next[0] - curr[0];
    const vny = next[1] - curr[1];
    const lenN = Math.hypot(vnx, vny);

    const r = Math.min(filletRadius, lenP * 0.35, lenN * 0.35);

    const inX = curr[0] + (vpx / lenP) * r;
    const inY = curr[1] + (vpy / lenP) * r;
    const outX = curr[0] + (vnx / lenN) * r;
    const outY = curr[1] + (vny / lenN) * r;

    if (i === 0) {
      shape.moveTo(inX, inY);
    } else {
      shape.lineTo(inX, inY);
    }
    shape.quadraticCurveTo(curr[0], curr[1], outX, outY);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.042,
    bevelSize: 0.036,
    bevelSegments: 6,
    curveSegments: 16,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
};

const createContactShadowTexture = (
  rgb: readonly [number, number, number],
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

const createStudioEnvCanvasTexture = (tone: StudioTone): THREE.Texture => {
  if (typeof document === "undefined") {
    return tone === "light"
      ? createFallbackTexture(245, 240, 235, 255)
      : createFallbackTexture(20, 24, 38, 255);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return createFallbackTexture(20, 24, 38, 255);
  }

  const bg = ctx.createLinearGradient(0, 0, 0, 256);
  if (tone === "light") {
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(0.5, "#f3eee7");
    bg.addColorStop(1, "#c7beb6");
  } else {
    bg.addColorStop(0, "#21283d");
    bg.addColorStop(0.48, "#131726");
    bg.addColorStop(1, "#080912");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  // Soft overhead studio softbox + crisp vertical specular strips
  const topBox = ctx.createRadialGradient(256, 30, 8, 256, 30, 170);
  topBox.addColorStop(0, tone === "light" ? "#ffffff" : "rgba(232,252,255,0.95)");
  topBox.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = topBox;
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle =
    tone === "light" ? "rgba(255,255,255,0.9)" : "rgba(225,250,255,0.85)";
  ctx.fillRect(68, 28, 36, 152);
  ctx.fillStyle =
    tone === "light" ? "rgba(255,248,240,0.84)" : "rgba(180,250,235,0.62)";
  ctx.fillRect(392, 32, 40, 144);

  const rimCyan = ctx.createRadialGradient(376, 128, 6, 376, 128, 102);
  rimCyan.addColorStop(0, "rgba(34,211,238,0.55)");
  rimCyan.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = rimCyan;
  ctx.fillRect(0, 0, 512, 256);

  const rimEmerald = ctx.createRadialGradient(136, 126, 6, 136, 126, 98);
  rimEmerald.addColorStop(0, "rgba(16,217,152,0.45)");
  rimEmerald.addColorStop(1, "rgba(16,217,152,0)");
  ctx.fillStyle = rimEmerald;
  ctx.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

// ============================================================================
// Deterministic Hash & Table Cell Chaos Specs (100% Frame-Deterministic)
// ============================================================================

const detSigned = (seed: number): number => {
  const raw = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (raw - Math.floor(raw)) * 2 - 1;
};

interface TaskCellSpec {
  id: string;
  row: number;
  col: number;
  targetX: number;
  targetZ: number;
  scatterX: number;
  scatterY: number;
  scatterZ: number;
  scatterRotX: number;
  scatterRotY: number;
  scatterRotZ: number;
  phase: number;
  antStart: number;
  snapStart: number;
  isHeader: boolean;
  isKeyCol: boolean;
}

const TASK_CELL_SPECS: ReadonlyArray<TaskCellSpec> = (() => {
  const list: TaskCellSpec[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const idx = row * GRID_COLS + col;
      const targetX = (col - (GRID_COLS - 1) / 2) * GRID_PITCH;
      const targetZ = (row - (GRID_ROWS - 1) / 2) * GRID_PITCH;

      // Distinct deterministic elevation tiers prevent ugly mid-air block interpenetration
      const heightTier = (idx * 5 + 3) % (GRID_ROWS * GRID_COLS);
      const scatterX = targetX * 1.42 + detSigned(idx * 7 + 1) * 0.36;
      const scatterY = 0.42 + heightTier * 0.074 + detSigned(idx * 13 + 3) * 0.03;
      const scatterZ = targetZ * 1.38 + detSigned(idx * 11 + 2) * 0.34;

      const scatterRotX = detSigned(idx * 17 + 4) * 1.08;
      const scatterRotY = detSigned(idx * 19 + 5) * 1.42;
      const scatterRotZ = detSigned(idx * 23 + 6) * 1.06;

      const orderIdx = row * 2.15 + col * 1.15;
      const antStart = 6 + orderIdx * 1.15; // f6 .. f17.4
      const snapStart = antStart + 7; // f13 .. f24.4

      list.push({
        id: `${row}-${col}`,
        row,
        col,
        targetX,
        targetZ,
        scatterX,
        scatterY,
        scatterZ,
        scatterRotX,
        scatterRotY,
        scatterRotZ,
        phase: idx * 0.77 + 0.45,
        antStart,
        snapStart,
        isHeader: row === 0,
        isKeyCol: col === 0 && row > 0,
      });
    }
  }
  return list;
})();

const TASK_GEMS: ReadonlyArray<{
  pos: readonly [number, number, number];
  scale: number;
  color: string;
  phase: number;
  metalness: number;
  roughness: number;
}> = [
  { pos: [1.84, 1.02, -0.68], scale: 0.1, color: BRAND.emeraldBright, phase: 0.5, metalness: 0.2, roughness: 0.12 },
  { pos: [-1.82, 0.56, 0.62], scale: 0.095, color: BRAND.cyan, phase: 1.7, metalness: 0.2, roughness: 0.14 },
  { pos: [1.62, -0.22, 0.92], scale: 0.084, color: BRAND.gold, phase: 2.8, metalness: 0.9, roughness: 0.16 },
  { pos: [-1.58, 1.42, -0.78], scale: 0.082, color: BRAND.ceramic, phase: 3.6, metalness: 0.18, roughness: 0.16 },
];

// ============================================================================
// Deterministic CameraRig & Fallback StudioEnvironment (useThree Only)
// ============================================================================

const TaskCameraRig: React.FC<{
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov?: number;
}> = ({ position, target, fov = 34 }) => {
  const { camera, invalidate, size } = useThree();

  const aspect = size.width / Math.max(1, size.height);
  const portraitT = interpolate(aspect, [0.5625, 1.35], [1, 0], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  // Portrait-calibrated framing keeps pedestal & checkmark above bottom headline safe zone
  const distMul = 0.74 + 0.26 * portraitT;
  const tx = target[0];
  const ty = target[1] + (1 - portraitT) * 0.95;
  const tz = target[2];

  const px = tx + (position[0] - tx) * distMul;
  const py = ty + (position[1] - target[1]) * distMul;
  const pz = tz + (position[2] - tz) * distMul;

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

const TaskStudioEnvironment: React.FC<{ tone: StudioTone }> = ({ tone }) => {
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

  if (envRT && !scene.userData.__dWorldsPrimaryTone) {
    scene.environment = envRT.texture;
  }

  useEffect(() => {
    if (envRT && !scene.userData.__dWorldsPrimaryTone) {
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
// TaskWorld — 3D Table Diorama: Chaos -> Anticipation -> Overshoot -> Settle -> Checkmark
// (Reference Duration: 90 Frames, Strictly Zero Text / Numbers / Labels)
// ============================================================================

export const TaskWorld: React.FC<TaskWorldProps> = ({
  frame,
  tone = "dark",
  withCamera = true,
}) => {
  const { fps } = useVideoConfig();

  // Continuous cinematic 3D camera motion across the full 90-frame arc
  const orbitT = interpolate(frame, [0, 90], [0, 1], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });
  const settleLiftT = interpolate(frame, [48, 86], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  const camX = -2.05 + orbitT * 4.1;
  const camY = 3.45 - orbitT * 0.34 + Math.sin(orbitT * Math.PI) * 0.24;
  const camZ = 15.6 - orbitT * 0.92;
  const camTargetY = -1.68 + settleLiftT * 0.14;

  const keySweepX = interpolate(frame, [0, 90], [-5.4, 5.4], {
    easing: EASE_IN_OUT,
    ...CLAMP,
  });

  // Grid completion confirmation pulse (~f46..62)
  const gridDoneT = interpolate(frame, [45, 56], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const deckShockExpand = interpolate(frame, [48, 68], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const deckShockOpacity = interpolate(frame, [48, 52, 68], [0, 0.85, 0], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  // Giant 3D emerald-cyan checkmark pop (anticipation -> overshoot -> settle at f52..70)
  const checkSpring = spring({
    frame: frame - 52,
    fps,
    config: { damping: 10.2, stiffness: 205, mass: 0.86 },
  });
  const checkVisible = interpolate(frame, [51, 55], [0, 1], {
    easing: EASE_OUT,
    ...CLAMP,
  });
  const haloSpring = spring({
    frame: frame - 55,
    fps,
    config: { damping: 12, stiffness: 175, mass: 0.9 },
  });
  const checkFloatY = Math.sin((frame - 52) * 0.1) * 0.045 * checkVisible;
  const checkScale = Math.max(0.01, checkSpring * 1.12);
  const checkY = 0.72 + checkSpring * 0.56 + checkFloatY;
  const checkYaw = (1 - checkSpring) * -0.52 + Math.sin((frame - 52) * 0.055) * 0.08 * checkVisible;
  const checkTiltX = (1 - checkSpring) * 0.28;

  const gemImpulseY = interpolate(frame, [52, 58, 76], [0, 0.18, 0.02], {
    easing: EASE_OUT,
    ...CLAMP,
  });

  // Memoized procedural geometries & non-text radial shadow/glow maps
  const assets = useMemo(() => {
    const trayGeo = createUprightBeveledBlockGeometry(2.46, 2.46, 0.12, 0.24, 0.026, 5);
    const tileGeo = createUprightBeveledBlockGeometry(0.41, 0.41, 0.23, 0.068, 0.024, 5);
    const capGeo = createUprightBeveledBlockGeometry(0.315, 0.315, 0.028, 0.045, 0.008, 3);
    const checkGeo = createCheckmarkGeometry();
    const shadowTex = createContactShadowTexture(
      tone === "dark" ? [4, 5, 10] : [26, 20, 26],
      tone === "dark" ? 0.62 : 0.3
    );
    const glowTex = createContactShadowTexture([24, 224, 184], 0.38);
    return { trayGeo, tileGeo, capGeo, checkGeo, shadowTex, glowTex };
  }, [tone]);

  useEffect(() => {
    return () => {
      assets.trayGeo.dispose();
      assets.tileGeo.dispose();
      assets.capGeo.dispose();
      assets.checkGeo.dispose();
      assets.shadowTex.dispose();
      assets.glowTex.dispose();
    };
  }, [assets]);

  const localTrayTopY = 0.12;

  return (
    <group>
      {withCamera && (
        <TaskCameraRig
          position={[camX, camY, camZ]}
          target={[0, camTargetY, 0]}
          fov={34}
        />
      )}
      <TaskStudioEnvironment tone={tone} />

      {/* Studio lighting: hemisphere + sweeping shadow key + brand rim + completion bounce */}
      <hemisphereLight
        args={
          tone === "light"
            ? ["#ffffff", "#e4dbd3", 0.56]
            : ["#c5f0ff", "#151624", 0.52]
        }
      />
      <directionalLight
        position={[keySweepX, 6.8, 6.4]}
        intensity={2.15}
        color={tone === "light" ? "#fffaf4" : "#f2fbff"}
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
        color={tone === "dark" ? BRAND.magenta : "#d4f4ff"}
      />
      <pointLight
        position={[0, PEDESTAL_DECK_Y + 1.55, 0.75]}
        intensity={0.9 + gridDoneT * 1.1 + checkVisible * 1.45}
        distance={6.2}
        color={BRAND.emeraldBright}
      />
      <pointLight
        position={[0, PEDESTAL_DECK_Y + 0.55, -0.9]}
        intensity={0.75 + gridDoneT * 0.65}
        distance={5.2}
        color={BRAND.cyan}
      />

      {/* Sculptural Studio Pedestal (Radius ~ 2.0, Resting on FLOOR_Y = -1.35) */}
      <group position={[0, PEDESTAL_CENTER_Y, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[PEDESTAL_TOP_R, PEDESTAL_BOT_R, PEDESTAL_H, 72]} />
          <meshStandardMaterial
            color={tone === "dark" ? "#2c3040" : "#44414e"}
            metalness={tone === "dark" ? 0.72 : 0.48}
            roughness={tone === "dark" ? 0.28 : 0.38}
            envMapIntensity={1.45}
          />
        </mesh>

        <mesh position={[0, -0.1, 0]} receiveShadow>
          <cylinderGeometry args={[2.17, 2.22, 0.04, 72]} />
          <meshStandardMaterial
            color={tone === "dark" ? "#1e212e" : "#302d38"}
            metalness={0.78}
            roughness={0.26}
            envMapIntensity={1.4}
          />
        </mesh>

        <mesh position={[0, 0.122, 0]} receiveShadow>
          <cylinderGeometry args={[1.9, 1.92, 0.018, 72]} />
          <meshStandardMaterial
            color={tone === "dark" ? "#1e2230" : "#54505e"}
            metalness={0.34}
            roughness={0.44}
          />
        </mesh>

        {/* Champagne-gold outer rim catching completion glint */}
        <mesh position={[0, 0.128, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.948, 0.032, 24, 96]} />
          <meshStandardMaterial
            color={gridDoneT > 0.3 ? BRAND.goldBright : BRAND.gold}
            emissive={BRAND.emerald}
            emissiveIntensity={gridDoneT * 0.35}
            metalness={0.92}
            roughness={0.16}
            envMapIntensity={1.55}
          />
        </mesh>

        {/* Inner cyan-emerald luminous deck track */}
        <mesh position={[0, 0.133, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.56, 0.017, 16, 84]} />
          <meshStandardMaterial
            color={gridDoneT > 0.5 ? BRAND.emeraldBright : BRAND.cyan}
            emissive={gridDoneT > 0.5 ? BRAND.emerald : BRAND.cyan}
            emissiveIntensity={0.55 + gridDoneT * 1.35}
            roughness={0.18}
            metalness={0.2}
          />
        </mesh>

        {/* Floor contact shadow */}
        <mesh position={[0, -0.114, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.9, 4.9]} />
          <meshBasicMaterial
            map={assets.shadowTex}
            transparent
            depthWrite={false}
            opacity={0.88}
          />
        </mesh>

        {/* Emerald-cyan floor bounce aura */}
        <mesh position={[0, -0.11, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.4, 4.4]} />
          <meshBasicMaterial
            map={assets.glowTex}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={0.18 + gridDoneT * 0.32}
          />
        </mesh>
      </group>

      {/* 3D Table Diorama & Giant Checkmark Assembly Anchored on Pedestal Deck */}
      <group position={[0, PEDESTAL_DECK_Y, 0]} scale={DIORAMA_SCALE}>
        {/* Anodized Beveled Table Base Tray */}
        <mesh geometry={assets.trayGeo} position={[0, 0, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#202433"
            metalness={0.62}
            roughness={0.3}
            clearcoat={0.6}
            clearcoatRoughness={0.18}
            envMapIntensity={1.42}
          />
        </mesh>

        {/* Pure-geometry table header rail (gold) & index rail (brushed aluminum) */}
        <mesh position={[0, localTrayTopY + 0.015, -1.08]} castShadow>
          <boxGeometry args={[2.02, 0.028, 0.044]} />
          <meshStandardMaterial
            color={BRAND.gold}
            metalness={0.93}
            roughness={0.16}
            envMapIntensity={1.7}
          />
        </mesh>
        <mesh position={[-1.08, localTrayTopY + 0.015, 0]} castShadow>
          <boxGeometry args={[0.044, 0.028, 2.02]} />
          <meshStandardMaterial
            color={BRAND.aluminum}
            metalness={0.9}
            roughness={0.18}
            envMapIntensity={1.6}
          />
        </mesh>

        {/* Subtle recessed table divider grooves (pure geometry, zero text) */}
        {[-0.5, 0, 0.5].map((pos, i) => (
          <React.Fragment key={i}>
            <mesh position={[pos, localTrayTopY + 0.004, 0]}>
              <boxGeometry args={[0.016, 0.008, 1.94]} />
              <meshStandardMaterial
                color="#3b435c"
                emissive={BRAND.cyan}
                emissiveIntensity={0.15 + gridDoneT * 0.5}
                metalness={0.7}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0, localTrayTopY + 0.004, pos]}>
              <boxGeometry args={[1.94, 0.008, 0.016]} />
              <meshStandardMaterial
                color="#3b435c"
                emissive={BRAND.cyan}
                emissiveIntensity={0.15 + gridDoneT * 0.5}
                metalness={0.7}
                roughness={0.25}
              />
            </mesh>
          </React.Fragment>
        ))}

        {/* Four brushed-titanium corner pins */}
        {[
          [-1.08, -1.08],
          [1.08, -1.08],
          [-1.08, 1.08],
          [1.08, 1.08],
        ].map(([cx, cz], i) => (
          <mesh key={i} position={[cx, localTrayTopY + 0.036, cz]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.072, 20]} />
            <meshStandardMaterial
              color={BRAND.aluminum}
              metalness={0.92}
              roughness={0.16}
              envMapIntensity={1.7}
            />
          </mesh>
        ))}

        {/* Expanding luminous completion shock-ring on tray lock */}
        {deckShockOpacity > 0.01 && (
          <mesh
            position={[0, localTrayTopY + 0.04, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={0.72 + deckShockExpand * 1.15}
          >
            <torusGeometry args={[1.0, 0.024, 16, 80]} />
            <meshBasicMaterial
              color={BRAND.emeraldBright}
              transparent
              opacity={deckShockOpacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        )}

        {/* 4x4 Beveled Table Blocks: Chaotic -> Anticipation -> Overshoot -> Settle */}
        <group position={[0, localTrayTopY, 0]}>
          {TASK_CELL_SPECS.map((cell) => {
            // 1. Chaotic drift active until snap begins
            const chaosFade = interpolate(
              frame,
              [cell.snapStart, cell.snapStart + 5],
              [1, 0],
              { easing: EASE_OUT, ...CLAMP }
            );
            const driftY = Math.sin(frame * 0.16 + cell.phase) * 0.065 * chaosFade;
            const driftRot = Math.cos(frame * 0.13 + cell.phase) * 0.15 * chaosFade;

            // 2. Anticipation coil-up right before whipping into slot
            const antPull = interpolate(
              frame,
              [cell.antStart, cell.antStart + 5, cell.snapStart + 1],
              [0, 1, 0],
              { easing: EASE_IN_OUT, ...CLAMP }
            );

            const antX = cell.scatterX * (1 + 0.11 * antPull);
            const antZ = cell.scatterZ * (1 + 0.11 * antPull);
            const antY = cell.scatterY + driftY + 0.22 * antPull;
            const antRotX = cell.scatterRotX + driftRot + 0.24 * antPull;
            const antRotY = cell.scatterRotY - driftRot * 0.8 + 0.2 * antPull;
            const antRotZ = cell.scatterRotZ + driftRot * 0.7 - 0.22 * antPull;

            // 3. Underdamped spring: crisp snap -> natural overshoot -> clean settle
            const snapSpring = spring({
              frame: frame - cell.snapStart,
              fps,
              config: { damping: 11, stiffness: 205, mass: 0.85 },
            });
            const remain = 1 - snapSpring;

            const curX = cell.targetX + (antX - cell.targetX) * remain;
            const curZ = cell.targetZ + (antZ - cell.targetZ) * remain;
            const curRotX = antRotX * remain;
            const curRotY = antRotY * remain;
            const curRotZ = antRotZ * remain;

            // Vertical plunge + micro-rebound hop (never clips below y = 0)
            const plungeT = interpolate(
              frame,
              [cell.snapStart, cell.snapStart + 8],
              [0, 1],
              { easing: EASE_IN, ...CLAMP }
            );
            const reboundY = interpolate(
              frame,
              [
                cell.snapStart + 8,
                cell.snapStart + 11,
                cell.snapStart + 15,
                cell.snapStart + 19,
              ],
              [0, 0.082, 0.012, 0],
              { easing: EASE_OUT, ...CLAMP }
            );
            const curY = Math.max(0, antY * (1 - plungeT) + reboundY);

            // Tactile landing squash-and-stretch on impact
            const impactSquash = interpolate(
              frame,
              [
                cell.snapStart + 7,
                cell.snapStart + 9,
                cell.snapStart + 13,
                cell.snapStart + 18,
              ],
              [0, 1, -0.32, 0],
              { easing: EASE_OUT, ...CLAMP }
            );
            const scaleY = 1 + 0.075 * antPull - 0.14 * impactSquash;
            const scaleXZ = 1 - 0.035 * antPull + 0.08 * impactSquash;

            // Socket & cap confirmation glow when block locks + diagonal sheen at completion
            const lockGlow = interpolate(
              frame,
              [cell.snapStart + 7, cell.snapStart + 11, cell.snapStart + 22],
              [0, 1.45, 0.48],
              { easing: EASE_OUT, ...CLAMP }
            );
            const sweepDelay = 45 + (cell.row + cell.col) * 1.4;
            const doneWave = interpolate(
              frame,
              [sweepDelay, sweepDelay + 4, sweepDelay + 12],
              [0, 1, 0.42],
              { easing: EASE_OUT, ...CLAMP }
            );
            const capGlow = Math.max(lockGlow * 0.72, doneWave * 1.15);

            return (
              <React.Fragment key={cell.id}>
                {/* Target socket pad on table deck */}
                <mesh position={[cell.targetX, 0.006, cell.targetZ]}>
                  <boxGeometry args={[0.34, 0.012, 0.34]} />
                  <meshStandardMaterial
                    color={
                      cell.isHeader
                        ? BRAND.goldBright
                        : doneWave > 0.3
                          ? BRAND.emeraldBright
                          : BRAND.cyanSoft
                    }
                    emissive={
                      cell.isHeader
                        ? BRAND.gold
                        : doneWave > 0.3
                          ? BRAND.emerald
                          : BRAND.cyan
                    }
                    emissiveIntensity={0.22 + lockGlow * 0.95 + doneWave * 0.6}
                    roughness={0.2}
                  />
                </mesh>

                {/* Beveled 3D cell block */}
                <group
                  position={[curX, curY, curZ]}
                  rotation={[curRotX, curRotY, curRotZ]}
                  scale={[scaleXZ, scaleY, scaleXZ]}
                >
                  <mesh geometry={assets.tileGeo} castShadow receiveShadow>
                    {cell.isHeader ? (
                      <meshStandardMaterial
                        color={BRAND.slate}
                        metalness={0.8}
                        roughness={0.22}
                        envMapIntensity={1.55}
                      />
                    ) : cell.isKeyCol ? (
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
                        clearcoat={0.86}
                        clearcoatRoughness={0.1}
                        envMapIntensity={1.38}
                      />
                    )}
                  </mesh>

                  {/* Beveled optical cap plate */}
                  <mesh geometry={assets.capGeo} position={[0, 0.228, 0]}>
                    {cell.isHeader ? (
                      <meshStandardMaterial
                        color={BRAND.gold}
                        emissive={BRAND.goldBright}
                        emissiveIntensity={0.14 + doneWave * 0.45}
                        metalness={0.94}
                        roughness={0.15}
                        envMapIntensity={1.8}
                      />
                    ) : (
                      <meshPhysicalMaterial
                        color={
                          doneWave > 0.25 ? BRAND.emeraldBright : BRAND.cyanSoft
                        }
                        emissive={doneWave > 0.25 ? BRAND.emerald : BRAND.cyan}
                        emissiveIntensity={0.1 + capGlow * 0.92}
                        metalness={0.12}
                        roughness={0.08}
                        clearcoat={1.0}
                        transparent
                        opacity={0.82 + Math.min(0.18, capGlow * 0.16)}
                      />
                    )}
                  </mesh>
                </group>
              </React.Fragment>
            );
          })}
        </group>

        {/* Big Sculpted 3D Green/Cyan Checkmark Rising Above Completed Table */}
        {checkVisible > 0.01 && (
          <group
            position={[0, checkY, 0.05]}
            rotation={[checkTiltX, checkYaw, 0]}
            scale={checkScale}
          >
            {/* Primary beveled emerald-cyan 3D checkmark */}
            <mesh geometry={assets.checkGeo} castShadow receiveShadow>
              <meshPhysicalMaterial
                color={BRAND.emeraldBright}
                emissive={BRAND.emerald}
                emissiveIntensity={0.58 + checkVisible * 0.28}
                metalness={0.22}
                roughness={0.1}
                clearcoat={1.0}
                clearcoatRoughness={0.06}
                envMapIntensity={1.65}
              />
            </mesh>

            {/* Luminous cyan orbital halo framing the checkmark */}
            <mesh
              position={[0, 0.04, -0.14]}
              scale={Math.max(0.01, haloSpring)}
            >
              <torusGeometry args={[0.92, 0.032, 22, 84]} />
              <meshPhysicalMaterial
                color={BRAND.cyanSoft}
                emissive={BRAND.cyan}
                emissiveIntensity={1.05}
                metalness={0.25}
                roughness={0.1}
                clearcoat={1.0}
                envMapIntensity={1.6}
              />
            </mesh>
          </group>
        )}
      </group>

      {/* Depth-parallax studio gem confetti reacting to completion */}
      <group>
        {TASK_GEMS.map((g, idx) => {
          const dy =
            Math.sin((frame / 24) * Math.PI + g.phase) * 0.065 +
            gemImpulseY * (0.65 + (idx % 3) * 0.25);
          return (
            <mesh
              key={idx}
              position={[g.pos[0], g.pos[1] + dy, g.pos[2]]}
              rotation={[
                g.phase + frame * 0.02,
                g.phase * 1.35 + frame * 0.026,
                0.22,
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
    </group>
  );
};

export default TaskWorld;
