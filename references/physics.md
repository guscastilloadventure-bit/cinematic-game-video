# Physics and motion realism

The owner's words (2026-10-21): when you code a shot, the physics have to be kind of real, "that way it's not
unprofessional". After the STUFFED v1 he flagged two things:

- a character who "runs and keeps on running into someone, and it makes no sense";
- a leap onto an enemy that came from running into him instead of from a run-up.

Both were invisible in scout stills and obvious in motion. So: script like a stunt coordinator, then check by numbers.

## The checklist (every shot)

**Space**
- Bodies stay apart unless the shot is about contact. Two characters approaching each other: the shot cuts, or one
  stops, while they are still at least a body-width plus a step apart. The game pushing them apart is not acting.
- Nothing intersects the world: no feet in rock, no gun through a wall, no camera inside a prop (watch for
  foreground objects a near camera clips, like grass, posts and railings).
- Everyone starts where the previous shot left them when shots are continuous (the bridge charge and the leap share
  positions), or the cut is clearly to a new place.

**Time**
- Scripts run during the pre-roll with negative `t`. Gate movement (`t > -0.2`) so nobody arrives early. The v1
  flop shot had the runner already past the shooter at frame 1.
- Speeds are the game's speeds (STUFFED: run 4.8 m/s, sprint 8.2). Work out distances before writing positions:
  `x(t) = x0 + v * t`.
- Slow motion is `speed(t)` over real simulated time, never a freeze or a hold. Ramp in and out (`speedRamp`). No
  hitstop on film.

**Gravity and arcs**
- Jumps: take-off speed `vy`, airtime `2 * vy / g`, apex `vy^2 / (2g)`, forward travel `vx * airtime`. STUFFED:
  g = 20, game jump 6.4 m/s (0.64 s, 1.0 m apex), film leap 9.2 m/s (0.92 s, 2.1 m apex) from a sprint at 8 m/s, so
  take off about 4.6 m before the target. Set a film-strength jump once at take-off (`vel.y`, `grounded = false`);
  never hold someone in the air.
- Things that fall keep falling: casings, magazines, debris and knocked-out bodies follow gravity, bounce a little,
  then settle (`stepLoose` in the example).
- A body off the ground with no vertical speed is standing on something. If that something is another character's
  head, the shot is wrong.

**Cause and effect**
- Knockback goes along the hit direction, scaled by the weapon (a shotgun throws, a pistol nudges), with a lift and
  a slide to a stop. Off a ledge it tumbles (`noCollide` plus spin) and lands.
- Explosions push everyone in range away from the blast (the game's own impulse) at the moment of the flash.
- A shot has a shooter, a muzzle flash, a travelling round, an impact and a reaction, in that order and at
  plausible distances.

**Bodies and hands**
- Aim swings like an arm (the director smooths every puppet's aim: `swing` default 10/s, slower for a heroic raise,
  faster for a snap shot up to about 18).
- Drawing or switching a held item: it comes from low across the body (the middle) out to the side and the shoulder,
  never popping into place. Fix it in the game's pose code if it snaps (`references/porting.md`).
- Interactions take time: searching a container, reloading, throwing. Latch on state, not on a time window (sub-steps
  vary in length, so a 0.06 s window fired several times and swapped a gun back and forth).
- Semi-automatic weapons need the trigger released between shots (`fire: t % 0.3 < 0.15`); holding it fires once.

**Camera**
- A camera moves like one: eased dolly, orbit and crane moves, a little handheld noise, a kick on nearby shots. No
  instant re-aims inside a shot.
- Keep enough sub-frames (K 8 to 12) that fast motion blurs instead of strobing.

## The audit

`node render.mjs --events` runs `auditFrame()` on every frame of every shot (simulation only, no rendering) and
writes `out/audit.json`:

| Kind | Fires when | Usual cause | Fix |
|---|---|---|---|
| `touch` | two live bodies within 0.78 m (and 1.5 m in height) for 0.12 s | running into someone; landing on a head | stop earlier, cut earlier, a different path |
| `blocked` | trying to move (the script asks, or its own velocity is over 2 m/s), moving under 30% of that for 0.25 s | pushing into a body or a wall | change the path or the timing |
| `jitter` | over 0.35 m of motion with under 0.12 m net in a 0.3 s window | vibrating against a wall, a body, or an AI stuck on geometry | move the spawn, the path, or the AI's goal |
| `hover` | over 0.25 m off the ground with vertical speed under 0.5 m/s for 0.12 s | standing on a body or prop; a missing gravity step | restage; check the jump code |
| `teleport` | moved over 0.15 m more in one frame than its own velocity explains (no velocity: over 13 m/s) | a position set by script; a collision or step-up pop | move by input, not by position; report game bugs |
| `sink` | 8 cm under the ground | a spawn under a deck; a missing collider | spawn on the top surface (`T()` helper) |
| `snap` | the aim turns faster than 26 rad/s | an aim point that jumped | use the smoothing; give a slower `swing` |
| `camera` | a cinematic camera less than 0.1 m above the terrain | a low camera on a slope; an orbit through a hill | lift it, or move it off the slope |

Times are simulated seconds (bullet time hides nothing). Every threshold and the game hooks live in `AC` above
`auditFrame` in film.js. Override them per game by exporting `AUDIT_CONFIG` from shots.js:

| Field | Default (people) | Adapt it |
|---|---|---|
| `actors()` | the game's characters | every moving body: cars, birds, companions |
| `key(b)`, `alive(b)`, `vel(b)`, `move(b)`, `aim(b)`, `eye` | the cast key, alive, the sim velocity, the scripted move size, the aim point, 1.3 m | whatever the game's objects expose; `aim: () => null` for things that don't aim |
| `ground(x, z, y)`, `terrain(x, z)` | top surface under a point, bare terrain height | the game's own ground or clearance functions |
| `touch`, `touchY`, `touchT` | 0.78 m, 1.5 m, 0.12 s | about the bodies' size: a 6 m wingspan flyer `touch: 4, touchY: 2`; cars about their length |
| `hover`, `hoverH`, `hoverT`, `hoverVy` | on, 0.25 m, 0.12 s, 0.5 m/s | `hover: false` for anything meant to be airborne |
| `jump`, `maxV` | 0.15 m per frame, 13 m/s | scale with the subject's speed: a flyer at 25 m/s `jump: 0.4` |
| `snap` | 26 rad/s | for vehicles, think of it as the heading or bank rate limit |
| `jitterT`, `jitterPath`, `jitterNet`, `camClear` | 0.3 s, 0.35 m, 0.12 m, 0.1 m | rarely |

For a game with a clearance function (a flyer in a gorge), add a check in `auditFrame` against it the same way
`sink` uses the ground. Cameras in tight spaces need the same check against walls.

An intended contact is allowed per shot: `contact: [['hero', 'grizz']]` (cast keys) or `allow: ['hover']` for a whole
kind. Write a comment saying why.

Tested on the STUFFED ad (2026-10-22):

- v1 flags `touch` hero+grizz in the bridge charge (30 frames) and the leap (56 frames), exactly what the owner
  saw.
- v2 raised three things, all real and none false:
  - a 0.19 m `teleport` when a runner steps from rock onto the bridge deck (a game movement bug);
  - an AI bot `jitter`ing against a rock at a cliff base in the aerial shot (it spawned off the mesa);
  - the leap's `camera` sitting 3 cm above the shelf rock at the bridge end.

## Tracing

`node render.mjs --trace <shot> <castKey> [castKey ...]` prints, per frame: frame number, film time, position,
horizontal speed, ground clearance, down/air. Read it like a stunt report: where they are at the cut, when they take
off, how high they go, whether two of them close in. Filter with `awk` instead of dumping it whole.

## Choreography patterns that look right

- **Charge:** both start at the ends, one runs and the other holds and fires. Cut before the gap closes.
- **Leap attack:** a sprint from at least 8 m, take-off about 4.6 m out, fire near the apex in bullet time; the
  target is knocked back before the attacker lands where he stood.
- **Grenade:** solve the throw onto a point (`grenadePitch`), let it bounce and roll; explode on a cut by giving the
  grenade an age so the fuse ends on the frame you want.
- **Knock-off-a-ledge:** shoot along the ledge, add a sideways impulse and `noCollide` after death, spin while
  airborne, land.
- **Squad walk:** a walk speed (not a sprint) in formation, everyone with the same heading, the camera dollying back
  at their pace.
