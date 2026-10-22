# The cinema-quality pass

The owner's line (2026-10-21): gameplay shots may look exactly like the game; "for all the animations [cinematic
shots], the quality should be much higher". He also called the old title card "soft" and asked for a higher
resolution. This is the pass that took STUFFED from "looks like the game" to "looks like a trailer".

## Capture

- **4K capture** (`--dsf 2` on a 1920x1080 viewport = 3840x2160), downsampled with Lanczos for the 1440p and 1080p
  copies. Deliver the 2160p60 master too.
- **Sub-frames** K = 8 by default, 10 to 12 for close-ups, slow motion and fast pans. Each frame averages K jittered
  renders across a 180-degree shutter: real motion blur and clean edges, with no MSAA cost.
- **The game's best tier, pushed further:** shadow map 4096, LOD distances to infinity, the densest grass and foliage,
  more particles, max texture anisotropy.

## Models and materials

- **Characters at their best:** more fur shells and a little longer fur (STUFFED 9 to 24 shells, 1.25x length),
  smooth shading, the highest-poly variant. Never frame a face closer than the model can hold: if it facets, go
  head-and-shoulders or wider, or use depth of field (the CLAUDE.md video rules have the owner's version of this).
- **Avoid low-poly props in close-ups.** Faceted rocks and flat-shaded boxes read as "game" instantly. Reframe so the
  background is distant terrain and sky, and let depth of field soften it.
- Use the game's own models and textures for the gameplay shots: they must stay recognisably the game.

## Light

- **Backlight the heroes.** Put the camera on the far side from the sun (the sun or its glow in frame, god rays on),
  then add the film lights:
  - `lights: () => [{ cam: true, i: 0.6 to 0.8, color: warm, up: 0.2 to 0.35 }, { rim: true, i: 1.1 to 1.5, color: warm gold, up: 0.4 to 0.6 }]`;
  - `cam` is a soft fill from the camera side, so faces read;
  - `rim` comes from behind and outlines fur and silhouettes;
  - two directional lights are always in the scene at intensity 0, so changing them never recompiles a shader.
- **A sun the shots can use.** If terrain hides the sun, raise it for film (STUFFED canyon: y 0.2 to 0.36) or pick
  camera angles where it clears.
- **A tight shadow box on close-ups** (`shadow: 5` for a face, 10 to 16 for one or two people, 36 wide): crisp
  contact shadows instead of blurry blobs.
- **Sunlit dust** (`motes`) in backlit close shots: a few hundred tiny warm specks catching the light. Keep them tiny
  (point size about 0.002 to 0.005 x screen height at 1 m) and dim (`i` 0.5 to 1); big or bright motes read as snow.

## Lens and grade

- **Depth of field** on every cinematic shot: `focusOn` the subject, `bokeh` 1.0 to 1.6 for medium shots and 2 to 3.6
  for macros. It hides game-looking backgrounds and gives scale.
- **Handheld** noise of 0.002 to 0.007, more in action, less in macros, plus a kick on nearby shots.
- **Grade:** an S-curve in display gamma, saturation around 1.14, cool teal shadows against warm highlights (`cool`
  1.3, `warm` 0.6). A world that is all one colour (the orange canyon) needs the cool shadows most.
- **Bloom** with a threshold above 1: only real highlights glow, and nothing is hazy.
- **Letterbox:** 2.39:1 bars for the cold open, opened once into the full 16:9 frame where the action starts. Bars
  that come and go between shots look like a mistake.

## The opening (the most important shot)

STUFFED v2's 3.3 s opening is a good model:

1. silence;
2. a macro sliding along the hero's weapon in the low sun, the plush paw on the grip;
3. the pump racks on the first downbeat of the music, and the spent shell spins out toward the lens;
4. one continuous move back and up to the face, with the sun behind the head and the focus pulling from the gun to
   the eyes.

Detail, texture, light and a mechanical action on the beat. Frame by frame, check that the action you are selling is
actually in frame (the first try had the pump off-frame and the shell flying out of the top).

For social feeds, put a striking full-frame hook before it (see `craft.md`, "The first frame").

## The title card

`templates/film/title.js`:

- extruded angular letters, chrome faces with a sharp horizon line, clear-coated gold bevels, a 1024
  environment map for crisp reflections;
- the slam on the last hit, sparks, embers, a light sweep, the link fading in;
- rendered at 4K, with little smoke and bloom haze so the letters stay sharp;
- `TITLE = { word, link, fluff }` in shots.js. It spells A-Z, 0-9, spaces and hyphens, and long names shrink to fit.
- `fluff` is a 2x2 sprite atlas of the game's own debris that bursts from behind the letters.

Follow the owner's title rules in CLAUDE.md: heavy and rigid, not rounded, no em dashes, the link on the same screen.

## Look-dev routine

1. `studio.mjs` running, `scoutall.sh` contact sheets at scout quality for staging and framing.
2. Full-quality stills (`"scout": false` items, or `render.mjs --still`) of every cinematic shot at the key moments.
   Read them at full size for the opening and the title, as a sheet for the rest.
3. Compare against the bar above: is anything faceted, flat-lit, monotone, hazy or game-looking? Fix that before
   committing two hours of render.
