# Trailer craft

## Which brief

Read the request and memory before choosing:

- **How it works / hype video:** CLAUDE.md's standard (QuickCombat hype v2). Walk through the whole thing in order:
  menus and lobby, the side games or modes, the reward screen, who's playing, then the action and the results.
- **Gameplay ad:** "pretty much just show gameplay", "all make sense", "not jumbled" (STUFFED ad, 10-21). One match,
  no menus, 3 or 4 features inside the story.
- **Story trailer:** a little story with a running gag and a punchline, no lobby, bullet time and macros (STUFFED
  hype v2, 10-20).

If the words don't settle it, ask one question before writing a shot list.

## The structure that works for a 40 s game ad

From Derek Lieu's trailer analyses, presskit.gg and ad-platform guidance, and the owner's reviews:

| Time | Beat | STUFFED example |
|---|---|---|
| 0 to 2.5 s | **Establishing still** (the first frame): the world at its most beautiful, wide and locked off, the setup visible, in near silence | Redrock Canyon at sunset, the rope bridge across the gap, a squad small on each rim |
| 2.5 to 4 s | **Cold-open hit** on the first downbeat: one close detail, sold in one image (cute and dangerous) | the pump racked, the shell spinning out, then up to the face |
| 3 to 7 s | **The dip**: who and where, at half energy | the squad walks out of the sun; the rivals wait across the canyon |
| ~7 s | **The bars open**: the full frame and the gameplay begin together | first contact on the rope bridge, real HUD |
| 7 to 15 s | **Escalation in story order** | knocked off the bridge, the epic chest, the new gun |
| 15 to 18 s | **Suckback**: the music thins, a held breath | the grenade arc, the grenade in the air |
| 18 s | **The drop**: the biggest visual on the downbeat | the blast, bears thrown |
| 18 to 31 s | **Full energy**, every point of view, faster cuts | DMR, a scope glint, the 8x scope, a charge, an aerial, the boss's LMG, teammates down |
| 31 to 40 s | **The last point**: a standoff, close-ups, the climax in bullet time | a bridge standoff, two eye close-ups, a run-up leap, the boss off the bridge, the game's win card |
| 40 s | **Title slam** on the last hit, the link, held about 3 s | STUFFED |

Shot lengths shrink as energy rises: about 2 s, then 1.5 s, then 1 s, then 0.5 s on fills.

## Tropes worth copying

For any genre:

- **The game's biggest move as a slow-motion showcase:** a super, a dive and pull-up, a drift, a boost. Use the game's
  own cutscene for it if it has one (CLAUDE.md).
- **Every point of view:**
  - first person from the characters (an owner favourite);
  - over the shoulder;
  - orbits and low angles;
  - the real HUD view.
- **Sharper than the game** where it counts: faces, the hero's gear, light (`quality.md`).
- A cold-open close-up timed to a music hit: a rack, a reload, a key turn, an engine start, a wing unfolding.

Shooter-flavoured, but they translate:
- A slow-motion squad walk toward the camera, backlit.
- One loot-open moment (Fortnite's chest): one, not three.
- A follow-cam on a thrown or launched object, then the slow-motion payoff.
- A hard cut into a scope, mirror or HUD view.
- The music stopping for a beat right before the drop.
- Comic failure: someone knocked off a ledge, a flop. It sells chaos and fun without gore.
- The game's own UI for one second (a mode card, the win screen): it proves it is real gameplay.
- Hold the last hero shot, then slam the title.

## What to avoid

- A logo or a black screen at the start, or an establishing shot that is dull or long: it must be the best view in
  the game, held 2 to 3 s, then the first hit.
- A feature list, every mode, every menu: the owner asked for "all make sense" and "not jumbled".
- Dissolves and random transitions; constant slow motion; constant maximum intensity with no low.
- Footage that does not look like the game: the gameplay shots must be the real game.
- Text overlays and captions (the owner's rule). The game's own UI is fine.
- Letterbox bars that come and go.

## The first frame (social feeds)

The owner posts to Twitter/X. A feed shows frame one before and while the video autoplays (muted), and loops short
videos. His direction (2026-10-22, after trying both): **frame one is a still, wide, cinematic establishing shot of
the map**, the way real trailers open, not close-up action. "In close-up action shots, it doesn't look good as the
first frame. The first frame has to actually look cool and wide and really display the visual", and it should make you
"interested in what's about to happen".

What worked (STUFFED v4, `vista`):

- the map's best view, wide and locked off (a barely-there push-in, clouds and idle breathing the only motion);
- the setup readable in it: the two squads small on either rim, facing each other across the rope bridge;
- low camera, sky in the top third, the action line on the lower third, 2.39:1 bars like the rest of the cold open;
- real depth of field: the far wall and the near low-poly rocks soft, the subjects sharp (at 45 m+ the bokeh needs
  to be large, about 4, with a focus range wide enough for both squads);
- held 2.5 s in near silence (the track's pickup note lands inside it), then a hard cut on the first downbeat into the
  cold-open hit.

How it was cut in without a re-render: give the next shot `t0` so its frames match the finished video, give every
later shot its old `seed` (adding a shot shifts the random seeds otherwise), shift the soundtrack by the new frames,
and `splice <newFrames> 150 <old.mp4> <out.mp4> ... 99` (keep the old video from frame 99).

Tried and rejected: a 0.5 s full-frame close-up of the climax as frame one (v3). A dark letterboxed macro as frame
one (v2) read as nothing at feed size. Never a single-frame poster flash: it strobes on every loop.

## Keeping it coherent

- One cast with names, looks and team colours that never change, and the same map.
- Shots in story order. Open on the world, not on a flash-forward of the climax (the owner rejected that).
- Continuity between consecutive shots: positions, weapons (if the hero picks up a new gun, every later shot has
  it), damage, time of day.
- Pick 3 or 4 features that the story uses (a loot upgrade, a throwable, a scope, the win screen) and leave the rest.

## Length and pacing

About 40 s (the owner's standard), 60 fps, around 20 to 25 shots. Keep a beat sheet in the README: each shot's
beat, what happens and what the music does there.
