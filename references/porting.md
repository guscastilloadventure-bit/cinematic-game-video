# Porting the film rig to a game

The rig assumes a three.js (or WebGL) game built with Vite whose world can be stepped by code. The film never edits
the real game: it runs on a snapshot in `game/`.

## 1. Snapshot

```
mkdir -p ~/claude/<game>-ad/game
rsync -a --exclude node_modules --exclude dist --exclude 'dist-*' --exclude deploy --exclude art --exclude .git ~/claude/<game>/ ~/claude/<game>-ad/game/
cp -cR ~/claude/<game>/node_modules ~/claude/<game>-ad/game/node_modules      # APFS clone: no extra disk
cd ~/claude/<game>-ad/game && npm i -D postprocessing@6.39.5 n8ao@2.0.1        # or cp -cR them from an older film project
git init -q && printf 'node_modules\ndist*\n' > .gitignore && git add -A && git commit -qm "snapshot of <game> <date>"
mkdir -p src/film && cp ~/.claude/skills/cinematic-game-video/templates/film/*.js src/film/
cp ~/.claude/skills/cinematic-game-video/scripts/* ~/claude/<game>-ad/
cd ~/claude/<game>-ad && for t in sencode finish thumbs; do swiftc -O $t.swift -o $t; done
```

Tested with three 0.186, postprocessing 6.39, n8ao 2.0, vite 8. Other three versions need a postprocessing release
that supports them; check its peer range. Commit the snapshot BEFORE adding hooks, so `git diff` shows exactly what
the film changed.

**Not built with Vite** (esbuild scripts, a plain folder): the director still loads as an ES module.

- `render.mjs --build '<the game's build command>' --serve <the built folder>` (served by `serve.mjs`).
- `studio.mjs` with `DEV_CMD='<a command that serves on $PORT>'` (live rebuilds) or `SERVE_DIR=<built folder>`
  (rebuild yourself after each edit).
- Bundlers that ignore unknown files need the film modules imported from the boot file behind the `FILM` flag (a
  dynamic `import()` keeps them out of the game's own bundle).

## First boot: get `__film` ready before anything else

`render.mjs` and `studio.mjs` only talk to `window.__film`, which must provide:

- `ready`, `FRAMES`, `SHOTS` (`[{ name, f0, f1 }]`);
- `setK(k)`, `setScout(bool)`;
- `frame(i)` (simulate up to and render frame i);
- `look(cam, shotName)` (a free camera at a shot's state);
- `collect()` (the cue log), `audit()`, `trace(shot, keys)`.

The template's `film.js` imports STUFFED's modules, so it will not load as is in another game:

1. Point the imports and the `startFilm(H)` object at the new game's classes.
2. Stub `stage`, `drive`, `resetWorld` and the prototype overrides to no-ops.
3. Write a one-shot `shots.js` with a fixed camera over the world.
4. Boot until a scout still shows the world through the film's post chain.

Then fill in the game-specific parts one at a time, scouting after each.

## 2. Hooks in the game (all behind a `FILM` flag, so the snapshot still plays normally without `?film`)

In the boot file (STUFFED: `src/main.js`):

```js
const FILM = Q.has('film'); // the video: frame-locked director in src/film/film.js
// renderer: keep the drawing buffer so CDP screenshots read the finished frame
getContext('webgl2', { ..., preserveDrawingBuffer: FILM })
// quality tier: the best one, pushed further (the film renders offline, frame time does not matter)
if (FILM) Object.assign(tier, TIERS.high, { dpr: 4, shadowSize: 4096, shadowRange: 36, treeLod0: 85, grassRadius: 34, particles: 1.3, bearLod0: 1e9 });
// no game audio at all (the soundtrack is mixed offline; game audio never plays out loud)
ctx.audio = FILM ? new Proxy({}, { get: () => () => {} }) : new Audio(settings);
// the map/level/world the story happens in, unless the URL names another (a missing map param once cost a full render)
const mapId = MAPS[Q.get('map')] ? Q.get('map') : FILM ? 'canyon' : savedMap;
// textures: max anisotropy everywhere (grazing-angle ground and walls stay sharp at 4K)
t.anisotropy = FILM ? renderer.capabilities.getMaxAnisotropy() : usual;
// after boot and shader warm-up: hand off to the director instead of starting the frame loop
if (FILM) {
  hideLoadingScreen();
  const { startFilm } = await import('./film/film.js');
  window.__film = await startFilm({ THREE, ctx, state, menu, hud, input, showcase, progress, separate, menuUpdate, resize, Match, Player, Bear, WEAPONS, heightAt, party });
  return;
}
requestAnimationFrame(frame);
```

**Resolution:** many games cap the pixel ratio or the pixel count (for speed). Lift those caps in film mode, or
`--dsf 2` captures less than 4K. Check with a studio `evalOnly`:
`__film.ctx.renderer.getDrawingBufferSize(new __film.W.THREE.Vector2())` should report 3840x2160.

**The game's own look:** if the game has its own composer or look passes (volumetric light, fog, a custom grade),
reuse them in the film's chain instead of replacing them, so the film still looks like that game. Turn off anything
temporal (TAA, volumetric or reflection history, motion-vector reprojection): the film already averages jittered
sub-frames, and history smears across them.

Pull anything the director must call out of the frame loop into functions (STUFFED: `menuUpdate(dt)` for menu shots,
`separate()` for bodies pushing apart). Bypass first-visit gates (sign-in sheets, daily rewards, tutorials) with a URL
flag the game already has (`nogate=1`) or a film check, and mark tutorials done in localStorage.

Other film-only tweaks STUFFED needed (copy the pattern, not the numbers):

- **Light:** `world.js` `filmSky()` lifts the sun so it clears the canyon rim behind the characters (`sunY`, `sunI`,
  `hemiI`, `fogD` URL params for look-dev).
- **Detail:** `bearModel.js` uses 24 fur shells instead of 9, and fur 1.25x longer. Every game has its version: LOD
  distances to infinity, the densest grass, the highest-poly models.
- **Gun draw:** `bear.js` `_placeGun`: a drawn gun starts at low ready across the body and eases out to the shoulder:
  `dr = switchT / 0.42; drawK = smoothstep(dr); spr = max(sprint, drawK)`, with no dip and pop. Add the same to the
  real game if it snaps (the owner asked for it).

## 3. The director (`film.js`): what to rewrite per game

Generic, keep as is:

- the film clock (`FPS`, `frame(i)`, `subT`, `advanceFrame`);
- seeded `Math.random` per shot;
- `vclock`;
- sub-frames and `AccumPass`;
- `simTimeAt` (speed ramps);
- `placeCamera` (DOF, handheld, kick), `jitter`;
- letterbox, `filmLights` and motes;
- the title render;
- `collect()`, `auditFrame()`, `trace()`.

Game-specific, rewrite:

- **The hand-off object** (`startFilm(H)`) and what it imports (actor class, match/round class, player/camera class).
- **Prototype overrides** that make outcomes scriptable:
  - `damage`: cast members are immortal (clamped HP, they flinch and bleed debris) until their `mortalAt`;
  - `die`: film knockback along the hit, harder for big hits;
  - `update`: the knockback flight, landing, sliding to a stop.
  
  A racer needs the same idea for crashes, a flyer for stalls and hits.
- **`stage({ cast })`**: spawn the actors a shot needs at exact spots and facings, attach `b.film = { key, act, mortalAt,
  kb, ... }`, make one of them the player for HUD shots.
- **`drive(b, dt)`**: turn the cast member's `act(t)` command into the game's input state: move, sprint, jump, aim
  point, fire, reload, interact, throw. The aim smoothing (`swing`) lives here.
- **`resetWorld()`**: between shots, clear everything a previous shot left: projectiles, debris, decals, loot state,
  HUD feed and toasts, scores, AI.
- **`upkeep()`**: what the game's frame loop updated per rendered frame (foliage wind, water, sky follow, shadow
  focus, LOD).
- **`fakeInput`**: a stand-in for the game's input object in HUD shots. Give it every method the HUD and player call
  (STUFFED's needed `showTake`, `showGrenades`, `touchRoot`).

## 4. Shots (`shots.js`)

```js
export const BPM = 145;                       // the track's tempo; film beat n = n * 60 / BPM s
export const EDIT = [['open', 0, 8], ['squad', 8, 4], ..., ['title', 96, 9]];   // [name, start beat, length in beats]
export const BEATS = EDIT.at(-1)[1] + EDIT.at(-1)[2];
export const TITLE = { word: 'GAME NAME', link: 'game.vercel.app', fluff: (ctx) => debrisTexture };
export function makeShots(W) { ... return { open: {...}, squad: {...}, title: { title: true } }; }
```

A shot:

| Key | Meaning |
|---|---|
| `setup()` | stage the cast (`W.stage({ cast: [...] })`), place props, set scores |
| `act(t, b)` per cast member | returns `{ move: [wx, wz], sprint, jump, crouch, aim, yaw, pitch, fire, ads, reload, interact, grenHold, gren, turn, swing }`. `t` is simulated seconds since the shot's start; negative during the pre-roll |
| `cam(t, u)` | `{ pos, look, fov, focus or focusOn, bokeh, range, near, hand }`, where `t` is film seconds and `u` is 0..1 through the shot. Omit for HUD shots |
| `hud: true` | the game's own camera and HUD; the script steers the player's base yaw and pitch |
| `speed(t)` | sim seconds per film second (slow motion, ramps); use `speedRamp([[t, s], ...])` |
| `tick(t, dt)` | after the actors update: props, poses, forced events (a jump at an exact time, a grenade's fuse) |
| `pre` | pre-roll seconds (effects and rigs settle before frame 1) |
| `t0` | the shot's first `t0` seconds happen before the cut (insert a shot in front without changing this one's frames) |
| `K` | sub-frames (8 default, 10 to 12 for close-ups and fast motion) |
| `bars` | letterbox: 1 for 2.39:1, 0 for full 16:9, or a function (bars opening) |
| `shadow` | half-size of the sun's shadow box in metres (5 for a face, 14 for a group, 36 wide) |
| `lights(t)` | up to 2 film lights: `{ cam: true }` fill from the camera side, `{ rim: true }` from behind, `i`, `color`, `up`, `side` |
| `motes(t)` | sunlit dust: `{ c, r, i }` |
| `TITLE` (module export) | `{ word, link, fluff }`: `fluff(ctx)` returns a THREE texture holding a 2x2 atlas of light-coloured debris sprites (one piece per cell; the game's own particle texture usually works), or omit it |
| `AUDIT_CONFIG` (module export) | the physics audit's actors, ground, thresholds (`physics.md`); export `{}` to keep the defaults |
| `rays`, `rounds`, `tracer`, `flashScale` | god-ray strength, film bullets, tracer scale, flash scale |
| `contact`, `allow` | physics-audit exceptions for intended contact (see physics.md) |

The STUFFED example has helpers worth keeping:

- `orbit`, `ots`;
- `lowReady` (an aim point that holds a gun across the body);
- `pull(t, t0)` (one trigger pull);
- `speedRamp`, `chestItem` (put a chosen item in a container);
- `grenadePitch` (solve a throw onto a point);
- `look(b, yaw, pitch)` (head turn on top of the pose);
- `G`/`T` (a point at a height above the terrain / above the top surface).

## 5. Non-shooter games

The rig does not care about guns. Puppet whatever the game simulates:

- **Racer:** `act(t)` returns throttle, brake, steer and boost. Stage cars on the track at given offsets. Crashes go
  through the game's own wreck physics, with film knockback only if needed. HUD shots use the chase camera.
- **Flyer:** `act(t)` returns the game's own control inputs (climb, turn, flap, or a path for the game's autopilot
  to follow), never pose outputs like pitch or roll: the flight model turns inputs into attitude, which is why it
  looks real. Fast subjects (15 to 25 m/s) need cameras computed from the scripted path (or a dry run's trace) rather
  than chasing the subject's last position, and `S.focus` set to the subject so the shadow box follows it.
- **Toy or physics sandbox:** `act(t)` drives the cursor or pointer (draw a cursor sprite) and lets the real
  simulation respond.
- **Puzzle or menu game:** script real clicks on real UI with a drawn cursor (the STUFFED hype v1 did menus this way)
  and pin CSS animations with `vclock`.

Whatever it is, the same rules hold: the game's own physics does the motion, the script only gives inputs, and the
audit checks the result.
