#!/bin/zsh
# scoutall.sh shot [shot ...]: scout stills (no sub-frames) at three points of each shot through a running studio.mjs,
# then one contact sheet at scout/sheet.jpg. Env: CTRL (studio port, 8975), Q (extra query, e.g. map=canyon),
# FRACS ("0.15 0.55 0.92"), COLS (3), TW (tile width, 480). Read the sheet, not every still: it costs far fewer tokens.
cd "$(dirname "$0")"
CTRL=${CTRL:-8975}; FRACS=(${=FRACS:-0.15 0.55 0.92}); COLS=${COLS:-3}; TW=${TW:-480}
shots=($@)
[ ${#shots} = 0 ] && { echo "usage: scoutall.sh shot [shot ...]"; exit 2; }
items=""
for s in $shots; do for f in $FRACS; do items="$items{\"shot\":\"$s\",\"frac\":$f,\"scout\":true},"; done; done
curl -s --max-time 1800 localhost:$CTRL -d "{\"q\":\"${Q:-}\",\"items\":[${items%,}]}" | grep -v "ms$"
files=(); for s in $shots; do for f in $FRACS; do files+=(scout/${s}_$f.jpg); done; done
python3 grid.py scout/sheet.jpg $COLS $TW $files
