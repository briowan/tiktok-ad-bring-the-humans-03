// One theme object for the whole ad (haidrrrry rule: single theme).
// make.fun brand colours come from the press pack, used as they are.
export const theme = {
  colors: {
    bg: "#0B1020",
    bg2: "#141B33",
    ink: "#191419",
    magenta: "#c41c83",
    white: "#ffffff",
    cyan: "#00C6FF",
    blue: "#0072FF",
    coral: "#FF0844",
    muted: "#9AA7C7",
    card: "#FFFFFF",
    cardInk: "#0F172A",
  },
  font: "Inter, Helvetica, Arial, sans-serif",
  heroSize: 92,
  subSize: 54,
  // Critical content stays inside TikTok's safe zone (x120-960, y269-1248)
  // and clear of the press-pack badge box (x120 y272, 330x128, +24px).
  safe: {left: 120, right: 960, top: 440, bottom: 1248},
} as const;
