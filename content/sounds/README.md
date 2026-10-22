# molen.sounds

The default sound pack: a `molen/soundbank@1` document (`sounds.soundbank.json`) naming 157
sounds, and the MP3 clips it points at. Every recording is CC0 1.0, so an app built on it owes no
attribution; [NOTICE.md](NOTICE.md) still credits each source. See the audio guide
(`docs-src/guide/audio.md`) for how experiences use it.

| Group | Sounds |
| --- | --- |
| `ambience.*` | rain, thunder, wind, birds (park and forest), crickets, river, city traffic, dungeon |
| `world.*` | 88 regional bird, night insect/frog, daytime cicada, wind, gust, ocean, rain, river and traffic beds |
| `vehicle.*`, `aircraft.*` | petrol and diesel engine idles, start, stop, accelerate, horn, doors; a Rolls-Royce Merlin (the P-51's engine) and a helicopter hover |
| `footstep.*` | grass, concrete, wood, snow, carpet, stone, gravel, sand, dirt, leaves, mud and metal (43 clips) |
| `impact.*` | metal heavy/light, wood, soft, punch, glass, bell, explosion |
| `foley.*`, `weapon.*` | doors, latch, creak, coins; blade draw, slash, chop, laser |
| `game.*`, `sting.*`, `ui.*` | jump, pickup, power-up, zap; short jingles; clicks, confirm, error, toggles |
| `music.*` | two calm ambient tracks, dungeon, racing, heroic and arena chiptunes |

## World soundscape

World view uses **100 sound choices**: 88 independently recorded ambience beds and 12 walking
surfaces, totaling 131 distinct MP3 clips. These sit alongside the pack's existing vehicle, aircraft,
interface and music sounds. All 100 have distinct source audio; variants are not counted as
extra sound choices. The complete inventory and per-clip source recipes are in `sources.json`.

The `earth:category:*` and `earth:region:*` tags drive World playback. Birds favor daylight and
the morning; crickets and frogs favor warm nights, while cicadas favor warm days. Rain reduces
wildlife. Latitude and longitude select broad recording palettes for Europe, North America,
Latin America, Africa, Asia and Oceania, with global weather/water fallbacks. These palettes
are not exact species-range maps. Polar locations suppress birds and insects.

Ocean beds require a mapped shoreline within 600 m; river beds require nearby flowing water.
Road distance, mapped ground material and snow/rain choose traffic and footsteps. An enclosed
cockpit reduces outdoor ambience to 18%, with a gradual transition; open boats and exterior
cameras retain outside sound. Ground ambience fades with altitude. The mix uses one recording
per category, staggered rotation every 83–119 seconds, five-second crossfades, conservative
gains and a master peak compressor. Audio remains independent of wildlife rendering density.

Footsteps follow horizontal walking distance, skip jumps/teleports/camera bob, and vary clip,
pitch and gain. Hosts can override the floor material for interiors and bridge decks; without
mapped material, walking falls back to grass or pavement. The decoded-audio cache retains
96 MiB of recent clips, allowing active/fading voices to finish before eviction.

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
crossfading each clip's tail into its head. World clips add `loopPadding: 0.1`: a short repeated
guard outside the playback loop, with 5 ms boundary ramps to suppress residual clicks after
normalization. `loopStart`/`loopEnd` avoid encoder edges. The build targets -20 LUFS for ambience
and -18 LUFS for music and engines, and peak-normalizes
one-shots. Unchanged recipes are skipped; `--force` rebuilds everything.
Both scripts accept positional IDs for targeted work: `fetch.mjs <origin-id>` and
`build.mjs <sound-id>`. A targeted build preserves the other existing bank entries. World
recordings include a verified CC0 license URL/date and a SHA-256 source hash; fetching rejects
changed bytes. `downloadBytes` pins only the leading preview bytes needed by the trim, keeping
long field recordings small. Raw sources stay in the ignored `.cache/` directory.

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
