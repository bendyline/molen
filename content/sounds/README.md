# molen.sounds

The default sound pack: a `molen/soundbank@1` document (`sounds.soundbank.json`) naming 63
sounds, and the MP3 clips it points at. Every recording is CC0 1.0, so an app built on it owes no
attribution; [NOTICE.md](NOTICE.md) still credits each source. See the audio guide
(`docs-src/guide/audio.md`) for how experiences use it.

| Group | Sounds |
| --- | --- |
| `ambience.*` | rain, thunder, wind, birds (park and forest), crickets, river, city traffic, dungeon |
| `vehicle.*`, `aircraft.*` | petrol and diesel engine idles, start, stop, accelerate, horn, doors; a Rolls-Royce Merlin (the P-51's engine) and a helicopter hover |
| `footstep.*` | grass, concrete, wood, snow, carpet, stone (several variations each) |
| `impact.*` | metal heavy/light, wood, soft, punch, glass, bell, explosion |
| `foley.*`, `weapon.*` | doors, latch, creak, coins; blade draw, slash, chop, laser |
| `game.*`, `sting.*`, `ui.*` | jump, pickup, power-up, zap; short jingles; clicks, confirm, error, toggles |
| `music.*` | two calm ambient tracks, dungeon, racing, heroic and arena chiptunes |

## Pipeline

`sources.json` is the source of truth. It lists every origin (site, author, page, download URL,
license) and every sound (which clips, trims, crossfade loops, bus, gain, spatial defaults).
Two scripts turn it into the pack, in the engine repository:

```sh
node content/sounds/tools/fetch.mjs     # download the CC0 originals into content/sounds/.cache/
node content/sounds/tools/build.mjs     # trim, loop, normalize, encode audio/*.mp3, write the bank + NOTICE
npx molen audio check content/sounds/sounds.soundbank.json
molen pack build content/sounds --out-dir dist-packs
```

`build.mjs` needs `ffmpeg` and `ffprobe` with `libmp3lame`. It makes loops seamless by
crossfading each clip's tail into its head, sets `loopStart`/`loopEnd` clear of MP3 encoder
padding, targets -20 LUFS for ambience and -18 LUFS for music and engines, and peak-normalizes
one-shots. Unchanged recipes are skipped; `--force` rebuilds everything.

## Adding sounds

Only CC0 recordings go in this pack (the bank's `license` policy rejects anything else).
Good sources:

- **[Freesound](https://freesound.org)** — the largest CC0 library, and the source of this pack's
  engine recordings. Filter searches (and API queries) with `license:"Creative Commons 0"`.
  `sources.json` points at a sound's high-quality preview (`cdn.freesound.org/previews/…-hq.mp3`),
  which downloads without an account; original files need an API key.
- **[Kenney](https://kenney.nl/assets/category:Audio)** — CC0 packs of UI, impacts, footsteps and
  jingles.
- **[OpenGameArt](https://opengameart.org/art-search-advanced)** — filter by license CC0; check
  each page, since many items carry CC-BY or GPL instead.
- **Generated audio** (ElevenLabs sound effects, Stable Audio Open) — record the prompt and
  generator in `source` and check the generator's license terms for your use.

Avoid the BBC Sound Effects archive (non-commercial RemArc licence) and bundles such as Sonniss
GDC that forbid redistribution as a library. CC-BY material (for example Kevin MacLeod's music)
is fine in your own app with credit, in a bank without the CC0 policy, but not here.

To add a sound, add an origin and a sound entry to `sources.json` and rerun both scripts, or use
`molen audio import <file> --id <id> --bank content/sounds/sounds.soundbank.json --license CC0-1.0
--source <url>` for a one-off (then mirror it in `sources.json` so the next build keeps it).
