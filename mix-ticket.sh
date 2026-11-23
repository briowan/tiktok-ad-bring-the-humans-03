#!/bin/bash
# Audio mix Entry Ticket: bed15 (120BPM) + SFX saja (text-first, tanpa VO).
set -e
cd "$(dirname "$0")"
ffmpeg -y -v error -f lavfi -i "sine=frequency=880:duration=0.09" -af "volume='exp(-t*30)':eval=frame,highpass=f=300" out/sfx-pop.wav
ffmpeg -y -v error -f lavfi -i "anoisesrc=d=0.35:c=white:a=0.5" -af "bandpass=f=1200:w=800,volume='sin(3.14159*t/0.35)':eval=frame" out/sfx-whoosh.wav
ffmpeg -y -v error -f lavfi -i "sine=frequency=90:duration=0.3" -af "volume='exp(-t*12)':eval=frame,lowpass=f=300" out/sfx-thump.wav
ffmpeg -y -v error -f lavfi -i "sine=frequency=1320:duration=0.25" -af "volume='exp(-t*10)':eval=frame" out/sfx-ding.wav
# tap/enter f75=2.50->2.43 whoosh; lock ~f120=4.00->3.92 pop; task f165=5.50->5.43 whoosh;
# centang ~f240=8.00->7.93 ding; CTA f255=8.50->8.43 thump
ffmpeg -y -v error \
 -i out/audio-bed15.wav \
 -i out/sfx-whoosh.wav -i out/sfx-whoosh.wav \
 -i out/sfx-pop.wav \
 -i out/sfx-ding.wav \
 -i out/sfx-thump.wav \
 -filter_complex "\
[0:a]volume=0.8[bed];\
[1:a]adelay=2430|2430,volume=0.7[w1];\
[2:a]adelay=5430|5430,volume=0.7[w2];\
[3:a]adelay=3920|3920,volume=0.9[p1];\
[4:a]adelay=7930|7930,volume=0.8[d1];\
[5:a]adelay=8430|8430,volume=1.0[t1];\
[bed][w1][w2][p1][d1][t1]amix=inputs=6:duration=first:normalize=0,volume=2.5dB,alimiter=limit=0.84:attack=5:release=50[a]" \
 -map "[a]" -t 15 out/audio-ticket.wav
echo MIX_OK
