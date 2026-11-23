import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Spike 3D — 1 beat tersulit (TARUHAN) + awal PUNCHLINE freeze.
// 105 frame @30fps. Jalur A: CSS-3D. Aturan Hermes+agy:
// - tanpa backdrop-filter/filter/opacity<1 di leluhur preserve-3d
// - yaw dibatasi <=30deg, teks kunci HUD 2D tegak saat dibaca (Move-Settle-Read)
// - bayangan kontak mengikat robot ke kartu

const MAGENTA = "#c41c83";
const CYAN = "#22d3ee";
const INK = "#070B14";

const MascotCard: React.FC<{src: string; size: number}> = ({src, size}) => {
  const layers = [0, -3, -6, -9, -12];
  const bright = [1, 0.82, 0.64, 0.48, 0.34];
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        transformStyle: "preserve-3d",
      }}
    >
      {layers.map((z, i) => (
        <Img
          key={z}
          src={staticFile(src)}
          style={{
            position: "absolute",
            inset: 0,
            width: size,
            height: size,
            borderRadius: 48,
            transform: `translateZ(${z}px)`,
            filter: `brightness(${bright[i]})`,
          }}
        />
      ))}
    </div>
  );
};

export const Spike3D: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // --- Robot drop (landing local f14) + squash-stretch ---
  const drop = spring({frame, fps, config: {damping: 14, stiffness: 120, mass: 0.9}});
  const robotY = interpolate(drop, [0, 1], [-620, 0]);
  const squash =
    frame >= 14 && frame <= 24
      ? interpolate(frame, [14, 18, 24], [0.78, 1.06, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const heightAboveCard = interpolate(drop, [0, 1], [1, 0]);
  const shadowScale = interpolate(heightAboveCard, [0, 1], [1, 0.45]);
  const shadowOpacity = interpolate(heightAboveCard, [0, 1], [0.55, 0.18]);

  // --- Stamp slam (local f16-26, from camera Z) ---
  const stampP = spring({
    frame: frame - 16,
    fps,
    config: {damping: 16, stiffness: 200, mass: 0.7},
  });
  const stampZ = interpolate(stampP, [0, 1], [900, 30]);
  const stampScale = interpolate(stampP, [0, 1], [2.4, 1]);
  const stampVisible = frame >= 16;

  // --- Views counter (local f20-50) ---
  const views = Math.round(
    interpolate(frame, [20, 50], [0, 12480], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const viewsText = views.toLocaleString("id-ID");

  // --- Camera: move only during transitions, still during reads ---
  const camX = interpolate(frame, [0, 14, 60, 75, 90], [10, 4, 4, 0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const camY = interpolate(frame, [0, 14, 60, 75, 90], [-14, -6, -6, 0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const camZ = interpolate(frame, [0, 14, 75, 90], [-160, 0, 0, 60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- Punchline snap-turn (local f75-104) ---
  const isPunchline = frame >= 75;
  const snapSquash =
    frame >= 76 && frame <= 84
      ? interpolate(frame, [76, 79, 84], [1, 0.55, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const mascotSrc = frame >= 79 ? "mascot-tilt-happy.svg" : "mascot-tilt-play.svg";
  const breathe = isPunchline ? 1 + Math.sin((frame - 75) / 9) * 0.012 : 1;

  const taruhanTextIn = interpolate(frame, [24, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const punchTextIn = interpolate(frame, [82, 88], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{backgroundColor: INK, fontFamily: "Arial, sans-serif"}}>
      {/* 2D glow layer (di luar stage 3D) */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 700px 500px at 20% 15%, rgba(34,211,238,0.20), transparent 70%), radial-gradient(ellipse 800px 600px at 85% 80%, rgba(196,28,131,0.22), transparent 70%)",
        }}
      />

      {/* Stage 3D */}
      <AbsoluteFill style={{perspective: 1200}}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transform: `translateZ(${camZ}px) rotateX(${camX}deg) rotateY(${camY}deg)`,
          }}
        >
          {/* Grid floor */}
          <div
            style={{
              position: "absolute",
              left: -400,
              top: 980,
              width: 1880,
              height: 1200,
              transform: "rotateX(62deg) translateZ(-260px)",
              backgroundImage:
                "linear-gradient(rgba(34,211,238,0.16) 2px, transparent 2px), linear-gradient(90deg, rgba(34,211,238,0.16) 2px, transparent 2px)",
              backgroundSize: "90px 90px",
            }}
          />

          {/* Result card (fake glass, tanpa backdrop-filter) */}
          <div
            style={{
              position: "absolute",
              left: 150,
              top: 620,
              width: 780,
              height: 520,
              transform: "translateZ(-40px) rotateX(5deg)",
              transformStyle: "preserve-3d",
              backgroundColor: "rgba(10,16,32,0.78)",
              border: `3px solid ${CYAN}`,
              borderRadius: 36,
              boxShadow: "0 0 60px rgba(34,211,238,0.35)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 36,
                background:
                  "linear-gradient(115deg, rgba(255,255,255,0.14) 0%, transparent 45%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 44,
                left: 0,
                right: 0,
                textAlign: "center",
                color: "#94a3b8",
                fontSize: 40,
                fontWeight: 700,
                letterSpacing: 6,
              }}
            >
              HASIL SEMENTARA
            </div>
            <div
              style={{
                position: "absolute",
                top: 120,
                left: 0,
                right: 0,
                textAlign: "center",
                color: "#ffffff",
                fontSize: 110,
                fontWeight: 900,
                fontFamily: "'Courier New', monospace",
              }}
            >
              {viewsText}
            </div>
            <div
              style={{
                position: "absolute",
                top: 260,
                left: 0,
                right: 0,
                textAlign: "center",
                color: CYAN,
                fontSize: 44,
                fontWeight: 700,
              }}
            >
              views organik
            </div>

            {/* Contact shadow di permukaan kartu */}
            <div
              style={{
                position: "absolute",
                left: 240,
                top: 10,
                width: 300,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "#000000",
                opacity: shadowOpacity,
                transform: `scale(${shadowScale})`,
              }}
            />

            {/* Stamp */}
            {stampVisible && (
              <div
                style={{
                  position: "absolute",
                  left: 90,
                  top: 358,
                  width: 600,
                  padding: "18px 0",
                  textAlign: "center",
                  border: `8px solid ${MAGENTA}`,
                  borderRadius: 18,
                  color: MAGENTA,
                  fontSize: 64,
                  fontWeight: 900,
                  letterSpacing: 2,
                  transform: `translateZ(${stampZ}px) rotate(-7deg) scale(${stampScale})`,
                  backgroundColor: "rgba(196,28,131,0.10)",
                }}
              >
                HADIAH UANG ASLI
              </div>
            )}
          </div>

          {/* Robot */}
          <div
            style={{
              position: "absolute",
              left: 330,
              top: 170,
              transformStyle: "preserve-3d",
              transform: `translateY(${robotY}px) scaleY(${squash * breathe}) scaleX(${snapSquash})`,
            }}
          >
            <MascotCard src={mascotSrc} size={420} />
          </div>
        </div>
      </AbsoluteFill>

      {/* HUD 2D — teks kunci tegak, terkunci saat dibaca */}
      {!isPunchline && (
        <div
          style={{
            position: "absolute",
            left: 90,
            right: 90,
            top: 1280,
            textAlign: "center",
            opacity: taruhanTextIn,
            color: "#ffffff",
            fontSize: 84,
            fontWeight: 900,
            lineHeight: 1.15,
            textShadow: "0 4px 24px rgba(0,0,0,0.8)",
          }}
        >
          Lomba ini: views terbanyak{" "}
          <span style={{color: MAGENTA}}>menang.</span>
        </div>
      )}
      {isPunchline && (
        <div
          style={{
            position: "absolute",
            left: 90,
            right: 90,
            top: 1280,
            textAlign: "center",
            opacity: punchTextIn,
            color: "#ffffff",
            fontSize: 92,
            fontWeight: 900,
            lineHeight: 1.15,
            textShadow: "0 4px 24px rgba(0,0,0,0.8)",
          }}
        >
          Aku yang tanding.
          <br />
          Kamu yang <span style={{color: MAGENTA}}>bawa aku.</span>
        </div>
      )}
    </AbsoluteFill>
  );
};
