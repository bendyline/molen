# molen.sounds

The default sound pack: a `molen/soundbank@1` document (`sounds.soundbank.json`) naming about 280
sounds and the MP3 clips it points at; the sound profiles that voice every `molen.entities`
vehicle, aircraft, train and boat (`sound-profiles.json`); the Earth soundscape catalog that says
where and when each ambience bed plays (`soundscape.json`); and curated birdsong
(`birdsong.json`). Every recording is CC0 1.0, and the generated sounds are the project's own,
dedicated CC0, so an app built on it owes no attribution; [NOTICE.md](NOTICE.md) still credits
each source. See the audio guide (`docs-src/guide/audio.md`) for how experiences use it, and
[SOUNDS-V2.md](SOUNDS-V2.md) for the plan this pack follows and what is still open.

| Group | Sounds |
| --- | --- |
| `ambience.*` | rain, thunder, wind, birds (park, forest and eight regional recordings), crickets, river, city traffic, dungeon |
| `world.*` | about 110 beds: regional birds, night insects and frogs, cicadas, wind (also in pines and grass), gusts, surf, lakes, harbors, rain, rivers, city and residential traffic, motorways, pedestrian and level-crossing signals, crowds |
| `vehicle.*` | petrol, V8, diesel and heavy-diesel engines idling and under load; motorcycle, V-twin, scooter, tuk-tuk and snowmobile engines; electric drive whine and warning hum; tires on asphalt and gravel, skids, body wind, cabin road noise; car, truck and scooter horns; air brakes, doors, wipers; bicycle, skateboard and ski rolling |
| `aircraft.*` | flat and radial pistons and their cabin, the P-51's Merlin, small and large turboprops and their cabin, airliner thrust and cabin, fighter idle and afterburner, generated turbine whine, jet roar and reheat, propeller buzz, airflow, runway roll, stall and gear horns; five kinds of helicopter and their cabin; piston and turbine starts; touchdown chirps, flap and gear motors |
| `rail.*`, `boat.*` | a diesel locomotive, North American and European horns, bell, wheels, tram ride, bell and traction hum; outboard, inboard and ship engines, ship horn, hull wash, rigging, lapping |
| `street.*` | horns, sirens (North America, Europe, Japan), a motorcycle and a bus going by, a dog, crows (North America, Japan) |
| `footstep.*` | grass, concrete, wood, snow, carpet, stone, gravel, sand, dirt, leaves, mud and metal (43 clips) |
| `impact.*` | metal heavy/light, wood, soft, punch, glass, bell, explosion |
| `foley.*`, `weapon.*` | doors, latch, creak, coins; blade draw, slash, chop, laser |
| `game.*`, `sting.*`, `ui.*` | jump, pickup, power-up, zap; short jingles; clicks, confirm, error, toggles |
| `music.*` | two calm ambient tracks, dungeon, racing, heroic and arena chiptunes |

## Where each bed plays

`soundscape.json` (`molen/earth-soundscape@1`, the pack's `soundscape` role) gives every World
bed its category, bounds near where it was recorded, its months on the local calendar, the
temperatures it needs, and its habitats or settlement, with the recording page and range
sources as evidence. Earth audio plays, per category, the most specific bed that belongs at the
listener's place, season and hour; a place no bed covers stays quiet in that category. Insect
and frog beds follow a climate estimate (`packages/earth/src/client/climate.ts`), not the weather
preset's temperature. Three older beds have no entry and never play outdoors: a cricket recorded
inside a sink, cicadas with an ambulance siren, and birds at an animal park. The
`earth:category:*` / `earth:region:*` tags below remain for packs without a catalog.

## Vehicle voices

`sound-profiles.json` (`molen/sound-profiles@1`, the `sound-profiles` role) is written by
`node content/sounds/tools/profiles.mjs`, which reads the `molen.entities` type documents, puts each
type in one of about 40 families by its spec (propulsion, reheat, engine count, body style,
powertrain), and lists the type ids so driven, parked and traffic copies share a voice. Rerun it
after adding vehicle or aircraft types; `--list` prints each type's family. Several voices stand
in for aircraft no CC0 recording exists of: the Black Hawk and the Chinook are medium and
two-blade helicopter recordings pitched down, the Osprey a large turboprop with rotor buzz, and
jets are a recorded idle, thrust or afterburner under generated whine and roar.

## Generated sounds

`tools/synth.mjs` writes the loops no recording does well: turbine whine, jet roar and reheat,
propeller buzz, airflow and body wind, tire and runway rumble, stall and gear horns, electric
drive whine and warning hum, traction hum and bicycle tires. Each is computed from a fixed seed,
is exactly 2^18 samples long and periodic by construction, so it loops with no crossfade
(`"periodic": true`). Their origins in `sources.json` carry `"synth": "<recipe>"`; `fetch.mjs`
generates them instead of downloading. They are the project's own work, dedicated CC0.

## Finding recordings

`tools/survey.mjs` searches Freesound (CC0 filter on) and BigSoundBank (all CC0), shows a
recording's author, licence block, place and description, downloads it (`get`), measures its
loudness over time (`measure`) and finds a steady loop window (`steady`). `add` reads the page
again, refuses anything that is not CC0 1.0, and writes the origin with page, author, licence
URL, date and SHA-256. Before adding, read the description: leave out recordings the uploader did
not make (taken from a video, spliced from other people's sounds, synthesized for a real-world
target), recordings with music or intelligible speech, and recordings whose place cannot be told
for a regional bed. Then listen.

A loop cut from a pass-by, a start-up or a takeoff run glides in pitch and swells or fades, so it
replays an engine "spooling down" every few seconds. `tools/drift.mjs` measures that:
`bank [prefix...]` ranks every built loop by how far it wanders from its first second (pitch glide,
spectral centroid, level; generated loops stay within about 180 cents and 1.5 dB), and
`window <origin> <seconds>` finds the steadiest stretch of a recording, ignoring quiet parts. A
recipe's clip reads `duration + crossfade` seconds from `start`, so search for that length.

## World soundscape (tag-based fallback)

The World soundscape inventory has **100 sound choices**: 88 recorded ambience beds and 12 walking
surfaces, totaling 131 distinct MP3 clips. These sit alongside the pack's existing vehicle, aircraft,
interface and music sounds. All 100 have distinct source audio; variants are not counted as
extra sound choices. The complete inventory and per-clip source recipes are in `sources.json`.

The `earth:category:*` and `earth:region:*` tags drive World playback. Birds favor daylight and
the morning; crickets and frogs favor warm nights, while cicadas favor warm days. Rain reduces
wildlife. Latitude and longitude select broad recording palettes for Europe, North America,
Latin America, Africa, Asia and Oceania, with global weather/water fallbacks. These palettes
are not exact species-range maps. Polar locations suppress birds and insects. A `birdsong`
catalog replaces the broad bird palettes with curated coverage; the default pack includes eight
additional regional recordings, described below.

Ocean beds require a mapped shoreline within 600 m; river beds require nearby flowing water.
Road distance, mapped ground material and snow/rain choose traffic and footsteps. An enclosed
cockpit reduces outdoor ambience to 18%, with a gradual transition; open boats and exterior
cameras retain outside sound. Ground ambience requires a known terrain height and fades with altitude. The mix uses one recording
per category, staggered rotation every 83–119 seconds, five-second crossfades, conservative
gains and a master peak compressor. Audio remains independent of wildlife rendering density.

Footsteps follow horizontal walking distance, skip jumps/teleports/camera bob, and vary clip,
pitch and gain. Hosts can override the floor material for interiors and bridge decks; without
mapped material, walking falls back to grass or pavement. The decoded-audio cache retains
96 MiB of recent clips, allowing active/fading voices to finish before eviction.

## Pipeline

The Vancouver traffic-light recording keeps its existing ID but uses `earth:category:crossing`.
It is audible only near mapped/rendered signals; ordinary traffic uses the other road beds.
Doors and wipers follow actuator motion, and the tire chirp follows paved airplane touchdowns.
Flap and landing-gear motor loops follow actual travel, including reversals and partial flap
settings. Fixed gear and instant mechanisms stay silent. The motor clips are generic servo
recordings by [vacuumfan7072](https://freesound.org/people/vacuumfan7072/sounds/264592/) and
[Burningmonkey](https://freesound.org/people/Burningmonkey/sounds/322021/), both verified CC0;
they are foley rather than recordings of specific aircraft hydraulic systems.
The tire sound is rubber-on-tile foley and the sliding sound is a general door recording, not
recordings of specific aircraft or vans. Their CC0 source pages, authors, license verification
dates (2026-10-29), source hashes and exact trims are in `sources.json`; the generated credits
are in [NOTICE.md](NOTICE.md). The audio guide documents rotor loading and playback rules.

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

Per-clip `highpass` removes low-frequency wind/traffic before normalization; it does not remove
every background sound. Downloaded originals stay in the ignored `.cache/` directory.

## Regional birdsong

`birdsong.json` is provided under the pack's `birdsong` role. Earth audio loads it alongside the
bank and selects recordings using the listener's WGS84 location, observed habitat, the scene's
sky date, and the sun's altitude. Dawn and dusk follow local sunlight, not the computer's clock.
The monthly gains are authored activity estimates, with northern and southern seasons specified
separately; they are not occurrence probabilities or a migration simulation.

The first batch contains mourning dove (temperate North America), American robin (Great Lakes
and northeastern North America), common blackbird (western Europe), Perth kookaburras,
Japanese bush warbler (central Honshu), and local mixed choruses from the central Amazon,
Knysna forest and northern Mauritius. Mixed choruses stay near their documented recording
areas because their background species cannot safely be generalized to an entire continent.
Source pages and ecological references are recorded in `sources.json`, `NOTICE.md`, and each
profile's `evidence`/`coverage` fields. The eight recording licenses were checked as CC0 on
2026-10-23. The reference sites inform the selection; their own recordings are not bundled.

These are conservative playback areas, not surveyed range polygons. Coverage is intentionally
incomplete: a loaded catalog gives silence where no profile fits, rather than the legacy park
chorus everywhere. No nocturnal species recordings are included yet. Older sound packs without
a catalog use broad bird palettes when present, or legacy generic birds. Altitude, rain, street
masking and vehicle suppression
also apply to the new recordings.

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
