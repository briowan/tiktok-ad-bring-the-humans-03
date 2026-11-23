#!/bin/sh
# Build the final TikTok ad: Remotion clip + official press-pack badge and
# referral end card (recipe from https://make.fun/press/llms.txt).
# Usage: ./build.sh [clip.mp4] [out.mp4]
set -eu
CLIP="${1:-out/clip.mp4}"
OUT="${2:-out/final.mp4}"
CODE="a32zxe96"
FONT="${FONT:-../tiktok-work/JetBrainsMono-Bold.ttf}"
CARD="${CARD:-../tiktok-work/press/makefun-card-9x16-transparent.webm}"
BADGE="${BADGE:-../tiktok-work/press/makefun-badge-9x16.png}"
W=1080 H=1920 LEN=2.5 REST=1.433 CX=210 CY=1232 CW=5 CH=78 MID=1271 SIZE=62
HOLD=0
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$CLIP")
T=$(awk "BEGIN{print $D+$HOLD-$LEN}")
mkdir -p "$(dirname "$OUT")"
ffmpeg -y -i "$CLIP" -c:v libvpx-vp9 -i "$CARD" -i "$BADGE" -filter_complex "
[0:v]scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H,setsar=1,fps=60,tpad=stop_mode=clone:stop_duration=$HOLD[base];
[base][2:v]overlay=enable='lt(t,$T)',format=yuva420p,split[clip][soft];
[soft]gblur=sigma=28,eq=saturation=0.35,fade=t=in:st=$T:d=0.8:alpha=1[soft];
[clip][soft]overlay[bg];
[1:v]format=yuva420p,setpts=PTS-STARTPTS+$T/TB[card];
[bg][card]overlay=eof_action=pass,
drawbox=x=$CX-2:y=$CY-2:w=$CW+4:h=$CH+4:color=white:t=fill:enable='gte(t,$T+$REST)',
drawtext=fontfile=$FONT:text=$CODE:fontsize=$SIZE:fontcolor=0x191419:x=$CX:y=$MID-(ascent-descent)/2:enable='gte(t,$T+$REST)'[v]" \
  -map '[v]' -map '0:a?' -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -movflags +faststart "$OUT"
echo "built $OUT (clip ${D}s, card at ${T}s)"
ffmpeg -y -i "$OUT" -frames:v 1 out/first.png
ffmpeg -y -sseof -0.1 -i "$OUT" -frames:v 1 out/last.png
echo "QC frames: out/first.png out/last.png"
