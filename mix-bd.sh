#!/bin/bash
# Audio mix untuk AdBundleD: bed 120BPM + VO Alex (D) + SFX synth di grid beat.
# SFX ditempatkan 2-3 frame sebelum hit visual.
set -e
cd "$(dirname "$0")"

# SFX synth (sama resep desk4): pop, whoosh, thump
ffmpeg -y -v error -f lavfi -i "sine=frequency=880:duration=0.09" -af "volume='exp(-t*30)':eval=frame,highpass=f=300" out/sfx-pop.wav
ffmpeg -y -v error -f lavfi -i "anoisesrc=d=0.35:c=white:a=0.5" -af "bandpass=f=1200:w=800,volume='sin(3.14159*t/0.35)':eval=frame" out/sfx-whoosh.wav
ffmpeg -y -v error -f lavfi -i "sine=frequency=90:duration=0.3" -af "volume='exp(-t*12)':eval=frame,lowpass=f=300" out/sfx-thump.wav

# Penempatan (detik): lock f105=3.50->3.42 pop; cuts f60=2.0->1.93 whoosh, f135=4.5->4.43 whoosh,
# f170=5.67->5.60 pop, f205=6.83->6.77 pop, f240=8.0->7.93 whoosh, $500 f255=8.5->8.42 thump,
# f315=10.5->10.43 whoosh
ffmpeg -y -v error \
 -i out/audio-v2.wav \
 -i out/voD-hook.mp3 \
 -i out/voD-punchline.mp3 \
 -i out/sfx-pop.wav -i out/sfx-pop.wav -i out/sfx-pop.wav \
 -i out/sfx-whoosh.wav -i out/sfx-whoosh.wav -i out/sfx-whoosh.wav -i out/sfx-whoosh.wav \
 -i out/sfx-thump.wav \
 -filter_complex "\
[0:a]volume=0.75[bed];\
[1:a]atempo=1.1,adelay=300|300[vo1];\
[2:a]atempo=1.25,adelay=9900|9900[vo2];\
[3:a]adelay=3420|3420,volume=0.9[p1];\
[4:a]adelay=5600|5600,volume=0.8[p2];\
[5:a]adelay=6770|6770,volume=0.8[p3];\
[6:a]adelay=1930|1930,volume=0.7[w1];\
[7:a]adelay=4430|4430,volume=0.7[w2];\
[8:a]adelay=7930|7930,volume=0.7[w3];\
[9:a]adelay=10430|10430,volume=0.7[w4];\
[10:a]adelay=8420|8420,volume=1.0[t1];\
[bed][vo1][vo2][p1][p2][p3][w1][w2][w3][w4][t1]amix=inputs=11:duration=first:normalize=0,alimiter=limit=0.95[a]" \
 -map "[a]" -t 15 out/audio-bd.wav

ffmpeg -v error -i out/audio-bd.wav -af loudnorm=print_format=json -f null - 2>&1 | grep -E "input_i|input_tp" || true
echo MIX_OK
