# Music and sound

## Which kind of soundtrack

Read the audio rules in `~/.claude/CLAUDE.md` first; they are the owner's standing rules and they change. As of
2026-10-21:

- **Synthesized scores** (the default when no genre is asked for): only sine and triangle voices, no noise, no
  sawtooth or square, no distortion, a clean limiter. Every video must pass `measure.py` (worst 0.25 s window under 1%
  of its energy above 6 kHz, max sample jump under 0.1). The QuickCombat and Banana FPS scores are the references.
- **A recorded track** when the owner asks for a genre ("rock music... go find some uncopyrighted stuff"). He liked
  Mixkit's "Carry On" for STUFFED and said to keep it. A real rock recording measures around 6% above 6 kHz on
  `measure.py` even through a 4 kHz lowpass (distorted guitars live at 2 to 5 kHz), so the 1% rule cannot apply. Leave
  the track as recorded, say so in the delivery note, and keep everything you add clean.
- **Game sounds:** CLAUDE.md says none, in every game. The owner has made specific exceptions since, recorded in
  memory:
  - real gun noises in shooter trailers (10-20: synced to the shots, pitched down in slow motion, through a lowpass
    bus);
  - realistic car sounds in car ads (10-05).

  Use game sounds only where such an exception covers the video. Never kill or knockout sounds, never noise-based
  effects (wind, water and engines rendered from noise all count). When unsure, leave them out and say so.

## Composing a score (the default)

The score is code: a WebAudio graph rendered with an OfflineAudioContext in a muted headless Chrome, written to the
film's beat grid so every hit lands on a cut. Start from a score that already passed the owner's rules:

- `~/claude/banana-fps-gungame/audio-page.js` (v2, the CLAUDE.md reference);
- `~/claude/quickcombat-hype` (the score the owner loved);
- `~/claude/stuffed-hype/score.js` + `audio.mjs` (the renderer, and gun samples mixed in).

Keep its instruments and limiter; write new parts on the film's bars: intro, build, breakdown, drop, the title hit
with a long sine sub-boom. Render it to a 48 kHz WAV and pass it to `mix.py` with no `parts` and `music_at: 0`, so
it lands as composed (plus any allowed cues). Run `measure.py` on the audio from the final MP4.

## Finding a royalty-free track (when the owner names a genre)

Delegate the search to one cheaper subagent with a tight brief: genre, energy, no vocals, no dubstep or glitch, the
licences that are acceptable, a new empty download folder, a SOURCES.md with title, artist, page, file URL, licence
and attribution for each file, and no opening or running anything downloaded.

| Source | Licence | Notes |
|---|---|---|
| Mixkit (`assets.mixkit.co/music/<id>/<id>.mp3`) | Mixkit Free: commercial video use, no credit | Not allowed inside games. Professional stock rock and hype tracks; direct URLs work |
| OpenGameArt | often CC0 (public domain) | Usable anywhere, including the game; quality varies; check each page's licence |
| Pixabay Music | Pixabay Content License | Cloudflare blocks scripted access; skip it, never bypass |
| Incompetech (Kevin MacLeod) | CC BY 4.0, credit line required | Tracks are claimed through YouTube Content ID; avoid for ads |
| Free Music Archive, ccMixter, Jamendo | per track | Many are non-commercial (NC); reject NC |

"Uncopyrighted" in the owner's words means free to use in the video: CC0 is literal, and Mixkit's or Pixabay's
licences are fine for a video. State the licence and any attribution in the delivery note and the project README.

## Analysing a track (no ears needed)

Decode first: `afconvert -f WAVE -d LEI16@48000 track.mp3 audio/music48.wav` (no ffmpeg on this Mac). Then:

- `spec.py out.png a.wav b.wav ...`: stacked spectrograms with a loudness curve. You can see the intro, stop-start
  riffs (vertical gaps), builds, breakdowns (a quieter band), drops and the ending (a held chord, a ring-out, a hard
  stop). Zoom with `PXS=18 T0=0 T1=70`.
- `beats.py a.wav [t0 t1]`: tempo and beat phase per section. Produced music sits on an integer BPM; check that the
  sections agree.
- `bars.py a.wav <bpm> <anchor>`: loudness per beat, one row per bar, counted from a downbeat you trust (the drop).
  Phrase structure, stop beats and fills show up as patterns.
- Refine the downbeat phase over the whole track at the fixed BPM (comb-fit the onset curve; STUFFED: first downbeat
  0.8038 s), because the edit depends on it.

A good ad track has an intro or stab section for the cold open, a build, a breakdown (the suckback), a drop, and an
ending with a final hit or held chord for the title. A track with all of that beats a better-sounding one without.

## The edit on the bar grid

- Lay the film's beat grid on the music's: film beat n = n * 60 / BPM, bars on multiples of 4. Every shot is
  `[name, beat, beats]`.
- Cut the track into parts, jumping whole phrases (8 or 4 bars) so the chords and riffs continue: intro, then the
  build, then (skipping the middle) the last full bars into the ending. STUFFED:
  `["start", 12, 4]` (the intro to bar -31 lands with its first downbeat on film beat 4), `[108, 168, 16]` (build,
  breakdown, drop at film beat 44), `[200, "end", 76]` (two full bars, the ending stabs, the final chord on beat 96).
- Splice on downbeats with 12 ms equal-power crossfades. If the music starts after a silent beat or two, that
  silence is the cold open.
- Put the drop on the biggest visual moment, the breakdown on the held breath (a grenade in the air, a scope finding
  its target), stop-start stabs on fast cuts, the final chord on the title slam. If the track stops dead, a sine
  sub-boom under the slam carries the title.

## `mix.py` config

`examples/stuffed-ad-mix.json` is complete. The fields:

| Field | Meaning |
|---|---|
| `bpm`, `beats` or `length` | the film's tempo and length (beats from the shot list, or seconds) |
| `music`, `first_downbeat`, `parts`, `crossfade`, `music_gain` | the track (48 kHz WAV), its beat 0 in seconds, `[music beat from or "start", to or "end", film beat]`, the splice fade |
| `music_at` | with no `parts`: the whole file starts at this film time (a composed score) |
| `events`, `event_key`, `event_sound` | `out/events.json`, the field naming the source (`wid`), and the map from that field to a sample name |
| `samples` | sample name to 48 kHz WAV path (the game's own sounds, decoded with afconvert) |
| `auto`, `auto_gain` | automatic weapons get this gain per shot, so a burst doesn't pile up |
| `sfx_gain`, `near`, `lowpass` | the bus level, the distance falloff (gain = near / (dist + 1.2)), the bus lowpass in Hz |
| `cues` | hand-placed samples: `{ sample, beat or at, align: "peak", gain, rate }` |
| `booms` | sine sub-booms: `{ beat or at, f0, f1, dur, gain }` |
| `ceiling_db`, `fade_out`, `out` | the limiter ceiling, the end fade, the output WAV |

Events already carry the camera distance and the slow-motion speed at that moment. A slowed sample plays at
`0.62 + 0.38 * speed`, so it sounds lower and longer in bullet time.

## Checks before delivery

```
afconvert -f WAVE -d LEI16@48000 out/<name>-1080p60.mp4 out/check.wav
python3 measure.py out/check.wav
```

- Report the numbers as they are. For a recorded track, say which part of the HF share comes from the music.
- Look at a spectrogram of the final mix (`spec.py`) to see the structure, the drop and the splices.
- Never play any of it out loud: every Chrome is muted, and checks are numbers and pictures.
