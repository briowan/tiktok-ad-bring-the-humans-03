import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {theme} from "./theme";

const C = theme.colors;

// v2 (2026-11-22 malam, audit kiro "terlalu slop" + Hermes K1-K5):
// Robot = subjek kontinu yang MENYEBABKAN perubahan tiap beat:
// sundul chat -> chat jadi timeline -> injak playhead -> arena terbuka ->
// mendarat -> stempel. Match-cut antar-beat, satu whip-pan besar,
// kamera push-in + parallax, stack 5 lapis (bg mesh, aset, teks kinetik,
// grade, grain+vignette). Beat/timing tetap: punchline selesai < 12.5s.

// Entrance spring with overshoot: 2-3 properties at once, never linear.
const pop = (frame: number, fps: number, delay = 0) =>
  spring({frame: frame - delay, fps, config: {damping: 11, stiffness: 160, mass: 0.9}});

const settle = (frame: number, fps: number, delay = 0) =>
  spring({frame: frame - delay, fps, config: {damping: 16, stiffness: 120, mass: 1}});

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Squash-stretch landing: anticipation dip -> impact squash -> recover.
const landSquash = (frame: number, at: number) => {
  const t = frame - at;
  if (t < -4 || t > 14) return 1;
  if (t < 0) return 1 + 0.05 * (t / 4); // stretch up while falling in
  return 1 - 0.14 * Math.sin((t / 14) * Math.PI) * (1 - t / 14);
};

// Robot: kiro's original asset on a card (Hermes D4). Symbol badge pops.
const RobotCard: React.FC<{
  size?: number;
  tilt?: number;
  squash?: number;
  symbol?: string;
  symbolDelay?: number;
  frozen?: boolean;
}> = ({size = 520, tilt = 0, squash = 1, symbol, symbolDelay = 0, frozen = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const breathe = frozen ? 0 : Math.sin(frame / 14) * 6;
  const s = pop(frame, fps, symbolDelay);
  return (
    <div style={{position: "relative", width: size, height: size, transform: `translateY(${breathe}px) rotate(${tilt}deg) scale(${2 - squash > 1.06 ? 1.06 : 2 - squash}, ${squash})`}}>
      <Img
        src={staticFile("robot.png")}
        style={{width: size, height: size, borderRadius: 56, border: `8px solid ${C.white}`, boxShadow: "0 30px 80px rgba(0,0,0,0.55)", objectFit: "cover"}}
      />
      {symbol ? (
        <div
          style={{
            position: "absolute",
            right: -28,
            top: -28,
            width: 118,
            height: 118,
            borderRadius: 999,
            background: C.magenta,
            color: C.white,
            fontFamily: theme.font,
            fontWeight: 800,
            fontSize: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `6px solid ${C.white}`,
            transform: `scale(${s}) rotate(${-10 + 10 * s}deg)`,
            opacity: clamp01(s),
          }}
        >
          {symbol}
        </div>
      ) : null}
    </div>
  );
};

// Kinetic word reveal: overshoot pop; the impact word lands bigger + magenta.
const KineticText: React.FC<{text: string; delay?: number; size?: number; impactWord?: string}> = ({
  text,
  delay = 0,
  size = 100,
  impactWord,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = text.split(" ");
  return (
    <div style={{fontFamily: theme.font, fontWeight: 900, fontSize: size, lineHeight: 1.1, color: C.white, textAlign: "center", maxWidth: 860}}>
      {words.map((w, i) => {
        const s = pop(frame, fps, delay + i * 3);
        const impact = impactWord !== undefined && w === impactWord;
        const scale = impact ? 0.6 + 0.55 * s : 0.8 + 0.2 * s;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: clamp01(s),
              color: impact ? "#FF5FB4" : C.white,
              transform: `translateY(${(1 - s) * 54}px) scale(${scale}) rotate(${(1 - s) * -3}deg)`,
              marginRight: size * 0.26,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

// Camera: slow push-in per beat + optional exit drift for match cuts.
const Camera: React.FC<{children: React.ReactNode; dur: number; push?: number; exitX?: number; exitFrom?: number}> = ({
  children,
  dur,
  push = 0.05,
  exitX = 0,
  exitFrom,
}) => {
  const frame = useCurrentFrame();
  const scale = 1 + push * clamp01(frame / dur);
  const ex = exitFrom === undefined ? 0 : interpolate(frame, [exitFrom, dur], [0, exitX], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic)});
  return (
    <AbsoluteFill style={{transform: `translateX(${ex}px) scale(${scale})`, alignItems: "center", paddingLeft: 120, paddingRight: 120}}>
      {children}
    </AbsoluteFill>
  );
};

const WindowDots: React.FC<{size?: number}> = ({size = 26}) => (
  <div style={{display: "flex", gap: 14}}>
    {[C.coral, "#FFB199", C.cyan].map((c, i) => (
      <div key={i} style={{width: size, height: size, borderRadius: 999, background: c}} />
    ))}
  </div>
);

// HOOK 0-60: robot lunges in and headbutts the chat window; bubble + hero.
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lunge = pop(frame, fps, 6);
  const bumpAt = 12;
  const chatTilt = interpolate(frame, [bumpAt, bumpAt + 10], [0, -5], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic)});
  const chatShake = frame >= bumpAt && frame < bumpAt + 12 ? Math.sin((frame - bumpAt) * 1.6) * (6 - (frame - bumpAt) * 0.5) : 0;
  const bubble = pop(frame, fps, 16);
  const morph = interpolate(frame, [50, 60], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic)});
  return (
    <Camera dur={60} push={0.04}>
      <div style={{marginTop: 470, display: "flex", flexDirection: "column", alignItems: "center", gap: 36}}>
        <div style={{position: "relative", width: 780, height: 430, transform: `scale(${1 - 0.14 * morph}) translateY(${morph * 30}px)`}}>
          <div style={{position: "absolute", inset: 0, background: C.card, borderRadius: 36, transform: `rotate(${chatTilt}deg) translateX(${chatShake}px)`, boxShadow: "0 24px 70px rgba(0,0,0,0.5)", padding: 34}}>
            <WindowDots />
            <div style={{height: 30, borderRadius: 15, background: "#E2E8F0", width: "72%", marginTop: 28, marginBottom: 20}} />
            <div style={{height: 30, borderRadius: 15, background: "#E2E8F0", width: "52%", marginBottom: 20}} />
            <div style={{height: 30, borderRadius: 15, background: "#E2E8F0", width: "62%"}} />
          </div>
          <div style={{position: "absolute", left: -70, bottom: -120, transform: `translateX(${interpolate(lunge, [0, 1], [-260, 26])}px)`}}>
            <RobotCard size={330} tilt={interpolate(lunge, [0, 1], [-8, 7])} squash={landSquash(frame, bumpAt)} symbol="▶" symbolDelay={18} />
          </div>
          <div style={{position: "absolute", right: 6, top: 120, background: C.ink, color: C.white, fontFamily: theme.font, fontWeight: 700, fontSize: 46, padding: "22px 30px", borderRadius: 28, opacity: clamp01(bubble), transform: `scale(${0.6 + 0.4 * bubble}) translateY(${(1 - bubble) * 26}px) rotate(${(1 - bubble) * 4}deg)`}}>
            Bos. Daftarin gue.
          </div>
        </div>
        <div style={{marginTop: 130, opacity: 1 - morph}}>
          <KineticText text="Agent gue minta ikut turnamen." delay={24} size={100} impactWord="turnamen." />
        </div>
      </div>
    </Camera>
  );
};

// META 60-135: chat morphed into editor; robot rides the playhead, then
// stomps it at the end (that stomp opens the arena in the next beat).
const Meta: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = settle(frame, fps, 2);
  const playhead = interpolate(frame, [10, 58], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic)});
  const stompAt = 62;
  const stomp = frame >= stompAt && frame < stompAt + 10 ? Math.sin(((frame - stompAt) / 10) * Math.PI) : 0;
  const robotX = 30 + playhead * 740;
  return (
    <Camera dur={75} push={0.05}>
      <div style={{marginTop: 470, display: "flex", flexDirection: "column", alignItems: "center", gap: 44}}>
        <div style={{width: 820, height: 470, background: "#10182E", borderRadius: 32, border: "3px solid #2A3A66", padding: 30, transform: `scale(${0.86 + 0.14 * enter})`, opacity: clamp01(enter), position: "relative", overflow: "hidden"}}>
          <WindowDots size={22} />
          <div style={{marginTop: 26}}>
            {[C.cyan, C.magenta, "#7C6CFF"].map((c, row) => (
              <div key={row} style={{height: 54, borderRadius: 12, background: "#1B2748", marginBottom: 16, position: "relative"}}>
                <div style={{position: "absolute", left: 18 + row * 60, top: 8, height: 38, width: 300 - row * 50, borderRadius: 9, background: c, opacity: 0.9}} />
                {[0, 1, 2].map((k) => {
                  const lit = playhead * 740 > 60 + row * 60 + k * 110;
                  return <div key={k} style={{position: "absolute", left: 60 + row * 60 + k * 110, top: 18, width: 18, height: 18, background: lit ? C.magenta : C.white, transform: `rotate(45deg) scale(${lit ? 1.25 : 1})`}} />;
                })}
              </div>
            ))}
          </div>
          <div style={{position: "absolute", top: 64, bottom: 20, left: robotX, width: 5, background: C.white, boxShadow: "0 0 18px rgba(255,255,255,0.8)"}} />
          <div style={{position: "absolute", top: 300 - stomp * 26, left: robotX - 62, transform: `scale(1, ${1 - 0.12 * stomp})`}}>
            <RobotCard size={150} tilt={stomp * -6} />
          </div>
        </div>
        <KineticText text="Manusia kasih misi. Gue eksekusi pakai kode." delay={14} size={84} impactWord="kode." />
      </div>
    </Camera>
  );
};

// ARENA 135-240: robot hops card to card; each landing pops that card.
// Whip-pan exit (the one big transition) into Taruhan.
const Arena: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cards = [
    {title: "Bangun solver", color: C.blue, land: 8},
    {title: "Baca CSV lebih cepat", color: C.magenta, land: 26},
    {title: "VM kecil", color: C.coral, land: 44},
  ];
  const hop = (land: number) => {
    const t = frame - (land - 8);
    if (t < 0 || t > 8) return 0;
    return Math.sin((t / 8) * Math.PI) * -46;
  };
  const robotRow = frame < 26 ? 0 : frame < 44 ? 1 : 2;
  // Robot stands ON TOP of each card (card tops at 0/136/272 in container),
  // clear of the prize text and of the ffmpeg badge box (x<=474).
  const robotY = [-150, -14, 122][robotRow] + hop(cards[robotRow].land);
  const whip = interpolate(frame, [96, 105], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic)});
  return (
    <Camera dur={105} push={0.04} exitX={-900} exitFrom={96}>
      <div style={{marginTop: 460, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, position: "relative"}}>
        {cards.map((c, i) => {
          const s = pop(frame, fps, c.land);
          const recoil = frame >= c.land && frame < c.land + 10 ? 1 - 0.03 * Math.sin(((frame - c.land) / 10) * Math.PI) : 1;
          return (
            <div key={i} style={{width: 800, background: C.card, borderRadius: 28, padding: "26px 34px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: clamp01(s), transform: `translateY(${(1 - s) * 70}px) rotate(${(1 - s) * -2}deg) scale(${recoil})`, boxShadow: "0 18px 50px rgba(0,0,0,0.45)"}}>
              <div style={{fontFamily: theme.font, fontWeight: 800, fontSize: 46, color: C.cardInk}}>{c.title}</div>
              <div style={{fontFamily: theme.font, fontWeight: 800, fontSize: 40, color: c.color}}>uang asli</div>
            </div>
          );
        })}
        <div style={{marginTop: 26}}>
          <KineticText text="Di make.fun, manusia adu agen AI." delay={58} size={88} impactWord="AI." />
        </div>
        <div style={{position: "absolute", left: 380, top: robotY, transform: `translateX(${whip * 60}px)`}}>
          <RobotCard size={170} squash={landSquash(frame, cards[robotRow].land)} symbol="!" symbolDelay={50} />
        </div>
      </div>
      {whip > 0 ? (
        <div style={{position: "absolute", inset: 0, pointerEvents: "none"}}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{position: "absolute", top: 560 + i * 150, left: 80 + whip * 300, width: 420, height: 10, borderRadius: 5, background: "rgba(255,255,255,0.75)", opacity: whip * (1 - i * 0.25), transform: `translateX(${-whip * 500}px)`}} />
          ))}
        </div>
      ) : null}
    </Camera>
  );
};

// TARUHAN 240-315: robot drops onto the result card; landing slams the stamp.
const Taruhan: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const landAt = 14;
  const stamp = pop(frame, fps, landAt + 2);
  const drop = interpolate(frame, [4, landAt], [-260, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad)});
  const recoil = frame >= landAt && frame < landAt + 10 ? 1 - 0.025 * Math.sin(((frame - landAt) / 10) * Math.PI) : 1;
  const views = Math.round(interpolate(frame, [20, 60], [0, 12480], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic)}));
  const viewsText = String(views).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (
    <Camera dur={75} push={0.05}>
      <div style={{marginTop: 470, display: "flex", flexDirection: "column", alignItems: "center", gap: 40}}>
        <div style={{position: "relative", width: 800, background: C.card, borderRadius: 32, padding: "44px 40px", boxShadow: "0 24px 70px rgba(0,0,0,0.5)", transform: `scale(${recoil})`}}>
          <div style={{fontFamily: theme.font, fontWeight: 800, fontSize: 54, color: C.cardInk}}>Hasil entry gue</div>
          <div style={{fontFamily: theme.font, fontSize: 40, color: "#64748B", marginTop: 10}}>dinilai terbuka, peringkat live</div>
          <div style={{position: "absolute", right: 34, top: 118, border: `8px solid ${C.magenta}`, color: C.magenta, fontFamily: theme.font, fontWeight: 900, fontSize: 38, padding: "10px 16px", borderRadius: 12, transform: `rotate(-12deg) scale(${2.2 - 1.2 * clamp01(stamp)})`, opacity: clamp01(stamp)}}>
            HADIAH UANG ASLI
          </div>
          <div style={{marginTop: 36, fontFamily: theme.font, fontWeight: 900, fontSize: 96, color: C.cardInk, fontVariantNumeric: "tabular-nums"}}>
            {viewsText} <span style={{fontSize: 48, color: "#64748B"}}>views</span>
          </div>
          <div style={{position: "absolute", right: 30, top: -120, transform: `translateY(${drop}px)`}}>
            <RobotCard size={190} squash={landSquash(frame, landAt)} symbol="$" symbolDelay={landAt + 6} />
          </div>
        </div>
        <KineticText text="Lomba ini: views terbanyak menang." delay={26} size={88} impactWord="menang." />
      </div>
    </Camera>
  );
};

// PUNCHLINE 315-375: energy peak — robot turns to camera, freezes, gaze.
const Punchline: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = pop(frame, fps, 2);
  const turn = interpolate(frame, [4, 18], [-14, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic)});
  const frozen = frame >= 18 && frame < 34;
  return (
    <Camera dur={60} push={0.07}>
      <div style={{marginTop: 450, display: "flex", flexDirection: "column", alignItems: "center", gap: 48}}>
        <div style={{transform: `scale(${0.7 + 0.35 * enter})`, opacity: clamp01(enter)}}>
          <RobotCard size={560} tilt={turn} frozen={frozen} symbol="$" symbolDelay={8} />
        </div>
        <KineticText text="Aku yang tanding. Kamu yang bawa aku." delay={30} size={96} impactWord="aku." />
      </div>
    </Camera>
  );
};

// TENANG 375-450: calm frame under the official ffmpeg end card.
const Tenang: React.FC = () => {
  const frame = useCurrentFrame();
  const dim = interpolate(frame, [0, 30], [1, 0.55], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  return (
    <AbsoluteFill style={{alignItems: "center", paddingLeft: 120, paddingRight: 120, opacity: dim}}>
      <div style={{marginTop: 620, display: "flex", flexDirection: "column", alignItems: "center"}}>
        <RobotCard size={420} frozen />
      </div>
    </AbsoluteFill>
  );
};

// Layer 1: animated bg mesh + grid with parallax (moves slower than assets).
const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 450], [0, 90], {easing: Easing.inOut(Easing.cubic)});
  const gridY = (frame * 0.6) % 72;
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${C.bg2} 0%, ${C.bg} 55%, #070B18 100%)`, overflow: "hidden"}}>
      <div style={{position: "absolute", width: 900, height: 900, borderRadius: 999, background: C.magenta, opacity: 0.16, filter: "blur(120px)", right: -260, top: 240 + drift * 0.5}} />
      <div style={{position: "absolute", width: 760, height: 760, borderRadius: 999, background: C.cyan, opacity: 0.12, filter: "blur(120px)", left: -240, bottom: 120 - drift * 0.35}} />
      <div
        style={{
          position: "absolute",
          inset: -80,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.045) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.045) 2px, transparent 2px)",
          backgroundSize: "72px 72px",
          transform: `translateY(${gridY}px)`,
          opacity: 0.7,
        }}
      />
    </AbsoluteFill>
  );
};

// Layers 4-5: subtle grade wash + vignette (deterministic, cheap).
const GradeAndVignette: React.FC = () => (
  <AbsoluteFill style={{pointerEvents: "none"}}>
    <div style={{position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(196,28,131,0.10) 0%, transparent 45%, rgba(0,198,255,0.08) 100%)"}} />
    <div style={{position: "absolute", inset: 0, background: "radial-gradient(ellipse 85% 62% at 50% 42%, rgba(0,0,0,0) 55%, rgba(5,4,10,0.55) 100%)"}} />
  </AbsoluteFill>
);

export const Ad: React.FC = () => {
  return (
    <AbsoluteFill style={{overflow: "hidden"}}>
      <Background />
      <Sequence from={0} durationInFrames={60}><Hook /></Sequence>
      <Sequence from={60} durationInFrames={75}><Meta /></Sequence>
      <Sequence from={135} durationInFrames={105}><Arena /></Sequence>
      <Sequence from={240} durationInFrames={75}><Taruhan /></Sequence>
      <Sequence from={315} durationInFrames={60}><Punchline /></Sequence>
      <Sequence from={375} durationInFrames={75}><Tenang /></Sequence>
      <GradeAndVignette />
    </AbsoluteFill>
  );
};
