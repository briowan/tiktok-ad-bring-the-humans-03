#!/bin/bash
# Audio Mix Style: soundtrack bundle kiro 128 BPM + SFX di cut beat.
set -e
cd "$(dirname "$0")"
ffmpeg -y -v error -f lavfi -i "sine=frequency=880:duration=0.09" -af "volume='exp(-t*30)':eval=frame,highpass=f=300" out/sfx-pop.wav
ffmpeg -y -v error -f lavfi -i "anoisesrc=d=0.35:c=white:a=0.5" -af "bandpass=f=1200:w=800,volume='sin(3.14159*t/0.35)':eval=frame" out/sfx-whoosh.wav
ffmpeg -y -v error -f lavfi -i "sine=frequency=90:duration=0.3" -af "volume='exp(-t*12)':eval=frame,lowpass=f=300" out/sfx-thump.wav
ffmpeg -y -v error -f lavfi -i "sine=frequency=1320:duration=0.25" -af "volume='exp(-t*10)':eval=frame" out/sfx-ding.wav
# cuts: f45=1.50->1.43 w, f90=3.00->2.93 w, f150=5.00->4.93 w, lock~f195=6.50->6.42 pop,
# f210=7.00->6.93 w, centang~f255=8.50->8.42 ding, f270=9.00->8.93 thump, f330=11.00->10.93 w
ffmpeg -y -v error \
 -i out/bundle-128bpm.wav \
 -i out/sfx-whoosh.wav -i out/sfx-whoosh.wav -i out/sfx-whoosh.wav -i out/sfx-whoosh.wav -i out/sfx-whoosh.wav \
 -i out/sfx-pop.wav -i out/sfx-ding.wav -i out/sfx-thump.wav \
 -filter_complex "\
[0:a]volume=1.15[bed];\
[1:a]adelay=1430|1430,volume=0.6[w1];\
[2:a]adelay=2930|2930,volume=0.6[w2];\
[3:a]adelay=4930|4930,volume=0.6[w3];\
[4:a]adelay=6930|6930,volume=0.6[w4];\
[5:a]adelay=10930|10930,volume=0.6[w5];\
[6:a]adelay=6420|6420,volume=0.8[p1];\
[7:a]adelay=8420|8420,volume=0.7[d1];\
[8:a]adelay=8930|8930,volume=0.9[t1];\
[bed][w1][w2][w3][w4][w5][p1][d1][t1]amix=inputs=9:duration=first:normalize=0,volume=2dB,alimiter=limit=0.84:attack=5:release=50[a]" \
 -map "[a]" -t 15 out/audio-mix.wav
echo MIX_OK
