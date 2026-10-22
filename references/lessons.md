# Lessons (traps that already cost hours)

**Render and output**
- **A missing query param rendered the wrong level.** The studio passed `map=canyon` but `render.mjs` didn't, so a
  whole 75-minute render came out on the default map. Make film mode force the story's map in the game's boot code,
  and check one frame of the final render before walking away.
- **The disk filled up mid-render** (100%, from old projects' frames). 2,600 4K JPEGs are about 4 GB. Use
  `stream-render.sh` + `sencode` (frames are encoded and deleted as they land). Check `df` first. Never delete the
  owner's project files to make room; ask.
- **Never render from the dev server.** An edit anywhere hot-reloads the page mid-render. `render.mjs` renders a
  frozen `vite build` served by `vite preview`; the studio uses the dev server for look-dev only.
- **Other sessions share the Mac.** Choose your own ports (dev/preview and CDP per tool), kill only your own ports
  (`lsof -ti tcp:<port>`), run one heavy browser job at a time, and run long jobs in the background with caffeinate.
- **Stills from the delivered MP4, not the frames:** `thumbs` (AVAssetImageGenerator) plus a `grid.py` sheet catches
  encoding, muxing and wrong-map mistakes the scout stills cannot.
- **To change only the opening, don't re-render the whole film.** Keep the later shots' frames identical (the
  shot's `t0`) and `splice` new first frames into the finished video.

**Staging**
- **Pre-roll movement.** Scripts run during the pre-roll with negative `t`; ungated `move` puts people in the wrong
  place by frame 1 (a runner already past the shooter, a charge already colliding).
- **Bodies colliding** look fine in stills and wrong in motion. Run the physics audit (`--events`) and read `touch`
  and `blocked`.
- **Semi-automatic weapons** need the trigger released between shots: `fire: true` fires once, during the pre-roll.
- **Interact windows** must latch on state (container open, item in hand), not on a time window: sub-steps vary and
  the action fired several times (a gun swapped back and forth).
- **Fake input** for HUD shots must have every method the HUD calls (STUFFED added `showGrenades()` and `touchRoot`
  between versions).
- **The game's effects are tuned for 1/20 s glimpses:** film versions must be bigger and longer (`fxfilm.js`), and
  pooled effects must be pruned during silent catch-up passes, or two effects share one slot and one jumps to the
  wrong place.
- **An explosion's point light** washes a dark character out to tan for a few frames. It is not a palette bug.

**Look**
- **Letterbox toggling:** bars defaulted to "on for cinematic, off for HUD", so they flicked on and off ten times. Open
  them once and keep the frame.
- **Macros inside the model:** a camera a few centimetres from fur sits inside the shells. Pull back to where the
  surface reads, and check the action is in frame (the pump stroke, the shell's path).
- **Dust motes read as snow** when big or bright. Keep them tiny, warm and dim, and only in backlit shots.
- **Fur, LOD and anisotropy** need film-only overrides in the game's code (tier, fur shells, texture filtering); the
  director cannot fix them from outside.

**Looks physically impossible (STUFFED v5 audit, 2026-10-22; the owner spotted the first two)**
- **Props on narrow ledges read as floating.** The canyon's rope bridges stood on 2.4 m rock tongues that fell away on
  both sides, so the deck ends and posts seemed to hang in the air. Check every bridge, platform and ladder end from
  the side and below. Fix in the film copy: landings on stringers with legs into the rock, posts carried into the
  ground, ropes staked behind (STUFFED `anchorBridges()` in shots.js).
- **Grass on cliffs floats.** Shader grass sampling a coarse height map stands at rim height beside a cliff face.
  Cull grass where any neighbour within a metre differs by more than ~0.2 m (STUFFED foliage.js).
- **AI bots in a cinematic shot** walk off ledges and get stuck against rocks. Script every body you can see.
- **Game hit flashes** (a white tint on the hit body) read as a lighting glitch on film, and slow motion stretches
  them. Keep them in HUD shots only; let the debris show the hit.
- **Cameras need clearance:** at least ~0.3 m from the ground, decks and posts. The audit's `camera` check flags
  anything under 0.12 m. Walk the camera path past every prop near it.

**Process**
- **Scout with contact sheets**, not single stills, and read full-size frames only where detail matters (the opening,
  the title, close-ups). It is far cheaper.
- **Use a cheaper model for research and file-finding subagents**, and keep judgement work (staging, look, the edit)
  in the main session.
- **A full render takes a long time.** STUFFED at 4K ran 1.2 to 2.6 s per frame (about an hour for 43 s) on the M4
  with other sessions running. Time 60 frames of your own film first. Batch every fix before re-rendering, and send
  the owner stills while it runs if he asks to see it.
