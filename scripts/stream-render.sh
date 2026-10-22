#!/bin/zsh
# stream-render.sh [render.mjs options]: the whole film into out/video.mp4 while never holding more than a few frames
# on disk. sencode turns frames into the video as they land and deletes them; a stalled or crashed renderer restarts
# and skips what is already encoded (frames/done.txt).
#   TOTAL=<frames> OUT_W=3840 OUT_H=2160 FPS=60 BITRATE=90000000 ./stream-render.sh --q 'map=canyon' --port 8976 --cdp 9976
# TOTAL is the film's frame count (render.mjs prints it as "film ready: N frames"). The first pass builds the game;
# restarts reuse that build. Afterwards: ./finish out/video.mp4 out/soundtrack.wav out/<name>-2160p60.mp4 (and scaled copies).
cd "$(dirname "$0")"
: ${TOTAL:?set TOTAL to the film frame count}
OUT_W=${OUT_W:-3840}; OUT_H=${OUT_H:-2160}; FPS=${FPS:-60}; BITRATE=${BITRATE:-90000000}
PORT=8976; CDP=9976
for ((i = 1; i <= $#; i++)); do [ "${@[i]}" = --port ] && PORT=${@[i+1]}; [ "${@[i]}" = --cdp ] && CDP=${@[i+1]}; done
mkdir -p frames out
find frames -name "f*.jpg" -delete; rm -f frames/done.txt
caffeinate -i ./sencode frames out/video.mp4 $OUT_W $OUT_H $FPS $BITRATE $TOTAL > out/sencode.log 2>&1 &
ENC=$!
first=1
while kill -0 $ENC 2>/dev/null; do
  if [ $first = 1 ]; then caffeinate -i node render.mjs --final "$@" >> out/render.log 2>&1; first=0
  else echo "restart $(date +%T)" >> out/render.log; caffeinate -i node render.mjs --final --nobuild "$@" >> out/render.log 2>&1; fi
  # only this render's own ports: other sessions' Chromes share the machine
  lsof -ti tcp:$CDP | xargs kill 2>/dev/null; lsof -ti tcp:$PORT | xargs kill 2>/dev/null
  kill -0 $ENC 2>/dev/null && sleep 3
done
wait $ENC
tail -1 out/sencode.log
