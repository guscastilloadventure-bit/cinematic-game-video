---
name: cinematic-game-video
description: Make movie-quality videos of a browser game (ads, trailers, hype films, teasers, launch videos, social clips). Each one is filmed frame by frame from the real game build. It gets picture quality well above the game's, believable physics in every shot, a beat-synced soundtrack (a score composed to the cut or a royalty-free track) and a slam title card. Use this whenever the user asks for an ad, trailer, hype video, promo, teaser or sizzle reel, or says "make a video of my game". Also use it to fix, re-cut, re-render or re-time such a video, or to change its opening or first frame. It applies even when the user doesn't say "cinematic" and whatever the genre (shooter, racer, flyer, toy, puzzle).
---

# Cinematic game video

Film a game the way a studio cuts a trailer, from the real build of the game: the game's own engine simulates
everything (characters, bullets, physics, effects, HUD), a film director scripts the cast and the cameras, and every frame
is rendered offline with motion blur, depth of field and a film grade, then cut to music on the beat.

This skill came out of the STUFFED ad (2026-10-21, `~/claude/stuffed-ad`, its README has the whole story). The tools here
are generalized from it and were tested on that film.

## The quality bar (what the owner reviews)

- **One story that makes sense.** One match, one run, one race, one flight, start to finish, the same characters all
  the way through. What the story shows depends on the brief:
  - CLAUDE.md's standard walks through how the game works, in order (menus, modes, rewards, the action, results);
  - the owner has since asked for gameplay-only, not-jumbled ads (STUFFED, 10-21) and for little story trailers
    without the lobby (10-20).

  Decide from his words, and ask if they don't say.
- **Gameplay shots may look exactly like the game** (the real HUD, the real camera). **Cinematic shots must look far
  better than the game**: 4K capture, the densest models, film lighting, real depth of field. If a cinematic shot looks
  like a screenshot, it is not done. See `references/quality.md`.
- **Physics must be believable in every shot.** Nothing runs into someone and keeps pushing, nothing floats, nothing
  pops or snaps, every jump has a run-up and an arc, every hit moves the body along the shot. A viewer reads fake
  physics as unprofessional at once. This is checked by numbers, not by eye: see "Physics" below and
  `references/physics.md`.
- **The opening is the most important shot**, and the first frame has to stop a scrolling thumb (see
  `references/craft.md`).
- **The music decides the cut**: cuts on downbeats, the big moment on the drop, the title slam on the last hit.
- **The house rules in `~/.claude/CLAUDE.md` apply on top of this skill**: the video rules (the QuickCombat standard:
  every point of view, no captions or text overlays, the heavy angular title card with the link, about 40 s), the audio
  rules (no game SFX except what the owner has since allowed, no noise or harsh synths, measure before delivery), no
  em dashes anywhere a viewer can read, game audio never out loud (muted Chromes only), and finished videos go on the
  personal site. Read those rules each time; they change.

## Physics: write the choreography as if it were real

When you script a shot, you are the stunt coordinator. Before writing an `act(t)`, work out where everyone is, how
fast they move and where they will be when the shot cuts. The game's own movement speeds are the speeds; gravity is
the game's gravity.

1. **Bodies never press together** unless the shot is about the contact. Two characters closing on each other stop
   (or the shot cuts) while they are still clearly apart; the game's push-apart is not a performance.
2. **Mind the pre-roll.** Scripts also run during the pre-roll (`t < 0`); a `move` there moves people before the
   first frame. For things that start still, gate it (`move: t > -0.2 ? [...] : [0, 0]`). For things that never stop
   (a flyer, a car at speed), start them back along their path by pre-roll x speed so they reach their mark at t = 0.
3. **A leap needs a run-up**: sprint, take off a few metres out, rise, peak, fall. If the game's jump is too small for
   the shot, give one film-strength jump (`vel.y` once at take-off), never a hover. Slow motion is a time ramp over the
   real arc (`speed(t)`), never a freeze.
4. **Aim and draw move like arms.** A gun (or any held tool) swings from where it was to the new target; a drawn gun
   comes from low across the body (the middle) out to the side. The director smooths every puppet's aim
   (`swing`, default 10/s); the game's own draw animation must do the same (see `references/porting.md`).
5. **Every hit has a cause and a consequence**: knockback along the shot, harder for bigger hits; things fall with
   gravity, bounce and settle; casings eject; debris persists. No hitstop on film.
6. **Enough sub-frames** (K 8 to 12) so fast motion blurs instead of strobing.
7. **Verify by the numbers.** `node render.mjs --events` runs a physics audit over every frame of every shot and writes
   `out/audit.json`. It checks:
   - `touch`: bodies pressed together;
   - `blocked`: trying to move, but not moving;
   - `jitter`: vibrating in place;
   - `hover`: off the ground and not falling;
   - `teleport`: moved more than its velocity explains;
   - `sink`: below the ground;
   - `snap`: aim turned faster than an arm;
   - `camera`: a camera at or under the terrain.

   It must come back clean, or every item left must be intended and allowed in that shot
   (`contact: [['a', 'b']]`, `allow: ['hover']`). `--trace <shot> <castKey>` prints position, speed and ground
   clearance per frame to find the cause. The audit caught the STUFFED v1 bridge collision that the owner flagged.
   For flyers, vehicles or anything not shaped like a person, tune it with `AUDIT_CONFIG` in shots.js
   (`references/physics.md`).

## Workflow

Work in a new project folder, e.g. `~/claude/<game>-ad/`: `game/` (a snapshot of the game), the scripts, `out/`,
`scout/`, `frames/`, a README. Check free disk first (`df -h /System/Volumes/Data`); 4K renders stream to disk
(below) but the outputs are hundreds of MB.

1. **Take the newest game.** "Based on the most recent version" means the newest code, which may be ahead of the live
   site: compare the live bundle with the working tree. Copy the working tree to `game/` (`rsync` without
   node_modules/dist/art, then `cp -cR` node_modules, an APFS clone), add `postprocessing` and `n8ao`
   (`references/porting.md` has versions), `git init` and commit so your edits stay visible. The film never touches
   the real game.
2. **Check what was made before.** Look in memory and `~/claude/` for earlier films of the same game (`<game>-hype`,
   `<game>-ad`...). Read their README's "shot list to avoid" and never reuse a scene. The CLAUDE.md reference project
   (`~/claude/quickcombat-hype`) and the STUFFED ad are the models.
   **Then research briefly** and write the story and the beat plan. `references/craft.md` has the structure that works
   (cold open, dip, build, suckback, drop, climax, title) and the tropes. Delegate web research to one cheaper
   subagent; keep the brief tight.
3. **Music.** Two kinds, both in `references/music-and-sound.md`:
   - **The default:** a score composed to the shot grid under the CLAUDE.md audio rules (sine and triangle only),
     rendered offline in a muted Chrome.
   - **When the owner names a genre** ("rock music, find some uncopyrighted stuff"): a royalty-free recorded track.
     Check its license, analyze it (`scripts/beats.py`, `bars.py`, `spec.py`), and plan the edit on its bar grid.

   Either way the cut follows the music's grid: where the drop and the last hit land in the film.
4. **Port the rig** (`references/porting.md`): the `?film` hooks in the game, copy `templates/film/*` into
   `game/src/film/`, rewrite the game-specific parts of `film.js` (stage, drive, resetWorld, knockouts), write
   `shots.js` (start from `examples/stuffed-ad-shots.js`). Every shot is `[name, beat, beats]` on the music's grid.
5. **Look-dev loop.** Run `scripts/studio.mjs` (a long-lived muted Chrome on the dev server) and
   `scripts/scoutall.sh shot ...` for contact sheets; read the sheet, not every still. Fix framing, timing and staging,
   then render full-quality stills of every cinematic shot and do the quality pass (`references/quality.md`). Spend
   the most care on the opening.
6. **Audit the physics** (`node render.mjs --events`), fix until clean, re-check the stills you changed.
7. **Sound.** By the CLAUDE.md rules, no game sound effects unless the owner has asked for them for this kind of
   video. He asked for real gun noises in shooter trailers (10-20) and realistic car sounds in car ads (10-05); check
   memory. When they are wanted, the same `--events` pass writes `out/events.json` (every cue, its camera distance and
   the slow-motion speed). Write a mix config and run `scripts/mix.py` (needs numpy + scipy in a venv), then
   `measure.py` and the CLAUDE.md audio checks.
8. **Render** with `scripts/stream-render.sh` (frames go straight into the video and are deleted, so a full 4K render
   needs almost no disk; it restarts a stalled renderer and resumes). Then `scripts/finish` muxes the soundtrack and
   makes the delivery sizes (2160p60 master, 1440p60, 1080p60).
9. **Review the actual file.**
   - Pull stills from the finished MP4 with `scripts/thumbs` (one per shot, plus the first frame and the title), make
     a sheet with `grid.py`, and look. Check the map, the letterbox, the opening, the title.
   - Measure the audio from the MP4 (`afconvert` to WAV, `measure.py`).
   - Confirm nothing played out loud: `pmset -g assertions | grep -A1 "Playing audio"` lists no Chrome.
   - Scan every word a viewer reads (the title, the link, game UI in HUD shots) for em dashes.
10. **Deliver.**
    - Send the 1080p, and say where the 4K is.
    - Add it to the personal site exactly as CLAUDE.md says: `tools/videos.txt`, `tools/webvideo`, an `<li>` in the
      game's folder of the Videos reel (newest first), `python3 build.py`, deploy, check the live URL.
    - Write the project README (the story, rig changes, the shot list to avoid next time) and a memory note.

Long jobs (renders, event passes on big films) run in the background; the harness wakes you when they finish. Pick
ports no other session uses (each render needs a dev/preview port and a CDP port) and kill only your own ports.

## Files in this skill

| Path | What it is |
|---|---|
| `templates/film/film.js` | The director: film clock, seeded randomness, puppets, sub-frames, speed ramps, cameras, letterbox, film lights, dust motes, title render, sound-cue log, physics audit, trace. Game-specific parts are marked at the top. |
| `templates/film/post.js` | Post chain: N8AO, depth of field, god rays, bloom, AgX, teal/warm grade, vignette, `AccumPass` (sub-frame averaging). |
| `templates/film/vclock.js` | Pins the page's timers and CSS animations to film time (HUD and menus animate frame-exactly). |
| `templates/film/title.js` | The heavy angular chrome-and-gold title (A-Z, 0-9, space, hyphen), slam, sparks, embers, light sweep, link. `TITLE = { word, link, fluff }` in shots.js. |
| `templates/film/fxfilm.js` | Shooter example: film-grade muzzle flashes, rounds riding bullets, tracers scaled to slow motion. |
| `examples/stuffed-ad-shots.js` | A complete 43 s shot list: cast, places, stagings, HUD shots, bullet time, chase cams, the leap with a run-up. |
| `examples/stuffed-ad-mix.json` | A complete `mix.py` config (track parts, gun samples, cues, booms). |
| `scripts/render.mjs`, `scripts/serve.mjs` | `--scout`, `--still`, `--events` (cues + physics audit), `--trace`, `--final`. Options for game dir, ports, query, DSF, and `--build`/`--serve` for games not built with Vite. |
| `scripts/studio.mjs`, `scripts/scoutall.sh` | Look-dev server and contact sheets. |
| `scripts/stream-render.sh`, `scripts/sencode.swift`, `scripts/finish.swift`, `scripts/thumbs.swift`, `scripts/splice.swift` | Disk-safe streaming render, muxing and scaling, stills from a video, swapping the first N frames of a finished video (`swiftc -O x.swift -o x`). |
| `scripts/beats.py`, `bars.py`, `spec.py`, `measure.py`, `mix.py`, `grid.py` | Music analysis, the soundtrack mixer, the audio check, contact sheets. |
| `scripts/cdp.mjs` | Muted, extension-free headless Chrome over CDP. |
| `references/porting.md` | Hooking a new game, the shot and cast API, adapting to non-shooter games. |
| `references/physics.md` | The realism checklist, the audit, choreography math, fixes. |
| `references/quality.md` | The cinema-quality pass for non-gameplay shots and the title. |
| `references/music-and-sound.md` | Royalty-free sources and licenses, analysis, the bar-grid edit, the mix config, audio rules. |
| `references/craft.md` | Trailer structure, tropes that work, what to avoid, the first frame. |
| `references/lessons.md` | Traps that already cost hours, and their fixes. |

Copy what a project needs into its folder (`cp scripts/* <project>/`, compile the Swift tools there) instead of
running from the skill folder: projects get edited, the skill stays clean.
