#!/bin/bash
# Audio Mix Style v2: soundtrack bundle digeser +113ms agar beat jatuh di cut 1.5s.
set -e
cd "$(dirname "$0")"
ffmpeg -y -v error -f lavfi -i "sine=frequency=880:duration=0.09" -af "volume='exp(-t*30)':eval=frame,highpass=f=300" out/sfx-pop.wav
ffmpeg -y -v error -f lavfi -i "anoisesrc=d=0.35:c=white:a=0.5" -af "bandpass=f=1200:w=800,volume='sin(3.14159*t/0.35)':eval=frame" out/sfx-whoosh.wav
ffmpeg -y -v error -f lavfi -i "sine=frequency=90:duration=0.3" -af "volume='exp(-t*12)':eval=frame,lowpass=f=300" out/sfx-thump.wav
ffmpeg -y -v error -f lavfi -i "sine=frequency=1320:duration=0.25" -af "volume='exp(-t*10)':eval=frame" out/sfx-ding.wav
ffmpeg -y -v error \
 -i out/bundle-128bpm.wav \
 -i out/sfx-whoosh.wav -i out/sfx-whoosh.wav -i out/sfx-whoosh.wav -i out/sfx-whoosh.wav -i out/sfx-whoosh.wav \
 -i out/sfx-pop.wav -i out/sfx-ding.wav -i out/sfx-thump.wav \
 -filter_complex "\
[0:a]adelay=113|113,volume=1.15[bed];\
[1:a]adelay=1543|1543,volume=0.6[w1];\
[2:a]adelay=3043|3043,volume=0.6[w2];\
[3:a]adelay=5043|5043,volume=0.6[w3];\
[4:a]adelay=7043|7043,volume=0.6[w4];\
[5:a]adelay=11043|11043,volume=0.6[w5];\
[6:a]adelay=6533|6533,volume=0.8[p1];\
[7:a]adelay=8533|8533,volume=0.7[d1];\
[8:a]adelay=9043|9043,volume=0.9[t1];\
[bed][w1][w2][w3][w4][w5][p1][d1][t1]amix=inputs=9:duration=first:normalize=0,volume=2dB,alimiter=limit=0.84:attack=5:release=50[a]" \
 -map "[a]" -t 15 out/audio-mix2.wav
echo MIX_OK
