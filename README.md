# Cinematic game video

A Claude skill for making trailers, ads and hype films of a browser game. Claude films the real game build frame by
frame: cinematic shots in 4K with film lighting and depth of field, physics that hold up in every frame, a cut that
lands on the music, and a slam title card with the game's name.

## Install

**One-click download:** [cinematic-game-video.zip](https://github.com/guscastilloadventure-bit/cinematic-game-video/releases/latest/download/cinematic-game-video.zip)

**Claude Code:** clone it into your skills folder. Claude picks it up in the next session.

```
git clone https://github.com/guscastilloadventure-bit/cinematic-game-video ~/.claude/skills/cinematic-game-video
```

**Claude on the web or desktop:** upload the zip above as a custom skill in Claude's settings, under Skills.

Then ask for a video, for example:

```
Make a 40 second hype ad for my game. Rock music, super cinematic, mostly gameplay.
```

## What it does

- **Films the real game.** A director script boots a copy of the game, plays the cast like puppets on the game's own
  physics, and renders every frame offline with motion blur, depth of field and a film grade.
- **Physics that make sense.** Every shot is staged like a stunt: run-ups before leaps, guns that swing out from the
  body, knockback along the hit. An audit then checks every frame of every shot by the numbers. It flags bodies
  pressed together, bodies stuck or shaking, bodies floating, popping or sinking, aim snaps and cameras in the ground.
- **Better than the game.** Gameplay shots keep the real HUD. Cinematic shots get 4K capture, denser models, fill and
  rim light, tight shadows and sunlit dust.
- **Cut to the music.** It analyses a track's beats and bars, edits it on its phrase grid, lays sound cues on every
  shot, and lands the drop and the title on the right beats. It can also place a score composed to the cut.
- **Disk-safe 4K renders.** Frames stream straight into the video and are deleted, so a full film needs almost no
  disk, and a stalled render resumes where it stopped.
- **Any game.** Guides for shooters, racers, flyers and toys, builds with or without Vite, and a chrome-and-gold
  title card that spells any game name.

## What's inside

```
SKILL.md          the workflow, the quality bar, the physics rules
references/       porting a game, physics, quality, music and sound, trailer craft, lessons
templates/film/   film.js (director + physics audit), post.js, title.js, vclock.js, fxfilm.js
scripts/          render, studio, serve, stream-render, mix.py, music analysis, contact sheets,
                  and Swift encoders (sencode, finish, splice, thumbs)
examples/         a complete 43 s shot list and mix config from the STUFFED ad
```

## Requirements

A Mac with Google Chrome, Node 22 or later, Python 3 (numpy and scipy for the mixer) and the Xcode command line tools
for the Swift encoders. The game should be a WebGL or three.js browser game you have the source for. The skill was
built for one person's setup: it reads their house rules from `~/.claude/CLAUDE.md` and keeps projects in
`~/claude/`, so expect to adjust a few paths.

Built from the STUFFED "Redrock Showdown" ad.
