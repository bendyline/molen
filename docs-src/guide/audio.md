# Sound and music

Sound in Molen is data. A sound bank names the clips, three components say when and where they
play, and scripts can fire one-shots with `molen.audio.play`. The client's audio director reads
all of it every frame and plays the result through Web Audio. Nothing about playback touches the
simulation, so sound never changes a state hash, and `molen audio plan` shows what a scene would
play without opening a browser.

## The pieces

| Piece | Where it lives | What it does |
| --- | --- | --- |
| `molen/soundbank@1` | a content pack (`provides.soundbank`) or a file beside the scene | Sound ids → clip files, loop points, gain, pitch range, bus, spatial defaults and provenance |
| `audioEnvironment` | one entity in the scene | Ambience layers, music playlist, event → sound mappings, footsteps, bus gains |
| `audioSource` | any entity | An emitter: loops follow the entity, pitch and gain follow signals, one-shots fire on triggers |
| `audioZone` | any entity | Area ambience that fades in as the listener approaches a sphere or box |
| `molen.audio.*` | scene scripts | `play`, `stop` and `music`, emitted as `audio.*` events |
| `@bendyline/molen-client/audio` | the page | `createAudioLayer` loads banks and plays what the rules ask for |

The `molen.sounds` content pack carries 63 CC0 sounds (ambience, vehicles, footsteps, impacts,
foley, UI, stings and six music tracks). Fetch it into a project with:

```sh
npx molen pack fetch https://molen.dev/packs/index.json molen.sounds --out-dir public/packs
```

That writes `public/packs/index.json` and pins the pack in `project.json`, so CLI ops such as
`molen audio plan` find the bank without flags.

## Annotate a scene

Add one entity with an `audioEnvironment`. This one plays rain while it rains, birds on sunny
days, music throughout, and a crash sound on the `crash` event your script emits:

```json
{
  "id": "audio",
  "components": {
    "audioEnvironment": {
      "buses": { "music": 0.5 },
      "ambience": [
        {
          "sound": "ambience.rain",
          "when": { "weather.precipitation.kind": "rain" },
          "gainFrom": { "signal": "weather.precipitation.intensity", "curve": [[0, 0], [1, 1]] }
        },
        { "sound": "ambience.birds", "when": { "sky.daylight": { "min": 0.35 } }, "fadeS": 4 }
      ],
      "music": { "playlist": ["music.ambient.first-light", "music.ambient.lifewave"], "mode": "shuffle" },
      "events": { "crash": { "sound": "impact.metal.heavy" } }
    }
  }
}
```

Give a moving thing its own voice with `audioSource`. The engine below follows the car, and its
pitch and loudness follow the car's state:

```json
{
  "id": "player",
  "components": {
    "transform": { "pos": [0, 0.5, 0] },
    "audioSource": {
      "sound": "vehicle.engine.car",
      "pitchFrom": { "signal": "vehicleState.speed", "curve": [[0, 0.8], [30, 1.7]] },
      "gainFrom": { "signal": "vehicleInput.throttle", "curve": [[0, 0.5], [1, 1]] }
    }
  }
}
```

Put the `audioSource` on an entity type and every instance gets it. The `molen.entities` vehicles
and aircraft carry their engines this way: cars run `vehicle.engine.car` or
`vehicle.engine.diesel` only while someone drives them (`"when": { "self.occupied": true }`), with
pitch from `vehicleState.speed` and gain from `vehicleInput.throttle`. The P-51 (a Merlin) and the
OH-6 take pitch and gain from `aircraftState.rpm`, so they are silent until the engine starts and
spool up and down with it. A loop whose gain is zero holds no voice.

Fire one-shots from a script when something happens that no component describes:

```ts
molen.onCommand('attack', () => {
  molen.audio.play('weapon.slash');
});
if (delivered === total) molen.audio.play('sting.win');
const alarm = molen.audio.play('ui.error', { entity: 'door', loop: true });
molen.audio.stop(alarm, 0.5);
molen.audio.music('music.dungeon');
```

`molen.emit` works too: any event type listed under `audioEnvironment.events` plays its sound, at
the entity or position the payload names (`payload.entity`, `payload.position`, or `payload.a` for
collisions), or at the listener.

## Rules

Every rule is a small piece of data the director re-evaluates each frame.

| Field | Meaning |
| --- | --- |
| `when` | All conditions must hold. A value means equality, a list means any of, `{ "min", "max" }` is an inclusive range, `{ "exists": true }` tests presence |
| `gainFrom`, `pitchFrom` | `{ signal, curve, smoothS? }`: a piecewise-linear curve of `[input, output]` points, clamped at both ends. A list of them multiplies, so a sound can fade with height and with distance at once |
| `triggerFrom` | `{ signal, every?, onChange?, sound? }`: a one-shot each time the signal advances by `every` (footsteps by distance) or changes |
| `startTick` | Play once at that tick; changing it plays again |
| `fadeS` | Fade time for ambience layers (default 1.5 s) |

Sounds that come from the ground, such as birds in the trees or traffic on the roads, should get
quieter as the listener rises. List one curve for height and another for distance to the source:

```json
{
  "sound": "ambience.city.traffic",
  "gainFrom": [
    { "signal": "listener.heightAboveGround", "curve": [[3, 1], [30, 0.7], [100, 0.3], [300, 0.08], [500, 0]] },
    { "signal": "host.streetDistance", "curve": [[0, 1], [40, 0.55], [120, 0.2], [250, 0]] }
  ]
}
```

A layer turns on after its condition has held for 0.25 s and off after it has failed for 1 s, and
numeric ranges widen by 5% while a layer plays. A signal hovering at a threshold therefore never
makes a sound flicker.

## Signals

| Signal | Value |
| --- | --- |
| `<component>.<field>` | A field of a component on the source's entity, e.g. `vehicleState.speed`, `aircraftState.rpm`, `transform.pos.1`. In `audioEnvironment` rules it reads the `listenerEntity` |
| `self.speed`, `self.distance`, `self.x/y/z` | The source entity's measured speed (m/s), distance travelled (m) and position |
| `self.occupied` | true while someone rides the source entity (an entity's `mounted` component names it) |
| `listener.speed`, `listener.distance`, `listener.x/y/z`, `listener.altitude` | The listener's speed, odometer and position |
| `listener.heightAboveGround` | What the host reports as the listener's height above the terrain (m); 0 when it reports nothing |
| `listener.mode`, `listener.grounded`, `listener.surface`, `listener.indoors` | What the host reports: walk, drive, fly, pilot or orbit; on the ground; the surface underfoot; inside a building |
| `weather.precipitation.kind`, `weather.precipitation.intensity`, `weather.windSpeed`, `weather.visibility`, `weather.clouds.coverage` | The scene's weather; a scene without weather reads as clear and calm |
| `sky.daylight`, `sky.starVisibility`, `sky.sunElevation` | The sky; a scene without a sky reads as day |
| `time.seconds` | Seconds since the audio layer started |
| `host.<name>` | Anything the page passes in, e.g. `host.urban` |

An unknown built-in signal is reported with a did-you-mean suggestion by `molen audio plan` and
in the browser console.

## Check it headlessly

`molen audio plan` runs the scene for N ticks, feeds the director, and prints what would play:

```sh
npx molen audio plan scene.json --ticks 300 --commands commands.json
```

```text
300 ticks at 30 Hz, banks: molen.sounds@1.0.0:sounds.soundbank.json
loops:
  [0 → end]      music.racing  bus music  peak 0.80  pitch 1.00
  [0 → end]      vehicle.engine.car @player  bus sfx  peak 0.61  pitch 0.75–1.36
one-shots (1):
  t=115    impact.metal.heavy  (sfx)
```

It reports unknown sound ids with a suggestion, and exits non-zero when it finds one. Pass
`--weather rain`, `--daylight 0.1`, `--mode walk` or `--listener <entity>` to hear other
conditions. `--json` prints the full report, and the `plan_audio` MCP tool returns the same.
Script sounds are ordinary events, so assertions work on them too:

```json
{ "format": "molen/assert@1", "assertions": [{ "event": "audio.play", "op": "occurred" }] }
```

## Play it in the browser

A page with a Worker kernel creates one layer, attaches it to the client, and updates it each
frame. Sound starts on the first click or key press, as browsers require.

```ts
import { mountExperience } from '@bendyline/molen-client';
import {
  attachAutoplayUnlock,
  createAudioLayer,
  loadPackSoundbanks,
} from '@bendyline/molen-client/audio';
import { createPackSet, openPack } from '@bendyline/molen-pack';

const { client } = await mountExperience({ link: worker, scene, canvas });
const index = await (await fetch('packs/index.json')).json();
const entry = index.packs['molen.sounds'];
const packs = createPackSet([await openPack(new URL(entry.file, new URL('packs/', location.href)).href)]);
const audio = createAudioLayer({
  banks: await loadPackSoundbanks(packs),
  provider: packs.assetProvider(),
  renderer: client.renderer, // the camera is the listener; weather and sky come from here too
});
audio.attachClient(client);
attachAutoplayUnlock(audio);
requestAnimationFrame(function frame(now) {
  audio.update(now);
  requestAnimationFrame(frame);
});
```

Every game sample does exactly this in its `src/audio.ts`. Hosts without a Worker kernel use
`audio.attachWorld(world)` for a main-thread `World`, or no source at all and pass the listener to
`update(now, { position, forward, mode, grounded, heightAboveGround })`. `setVolume`, `setMuted` and
`setBusGain('music', 0)` drive a settings menu.

`mountEarthView` plays the Earth soundscape on its own when its content includes the
`molen.sounds` pack: weather and time-of-day ambience, footsteps in walk mode, traffic near
streets, and engines on the cars and aircraft you board. Birds, crickets and traffic fade with
height above the terrain, and traffic also fades with distance from the nearest street. Pass `audio: false` to turn it off, and
use `view.audio` for volume. See [Earth view](earth-view.md).

## Make your own sounds

A sound bank is a JSON file beside its clips. Add clips with `molen audio import`, which copies the
file, hashes it, reads its duration, and records where it came from:

```sh
npx molen audio import rain.mp3 --id ambience.rain --bank sounds/sounds.soundbank.json \
  --license CC0-1.0 --source https://freesound.org/s/000000/ --loop \
  --description "Steady rain on leaves"
npx molen audio import step-2.mp3 --id footstep.wood --bank sounds/sounds.soundbank.json \
  --license CC0-1.0 --append
npx molen audio check sounds/sounds.soundbank.json
```

A bank with a later position in `banks` overrides sounds with the same id, so a project can
re-skin `molen.sounds` by shipping only the sounds it changes. Every entry records its license.
A bank with `"license": "CC0-1.0"` rejects anything else, which is how `molen.sounds` stays public
domain.

> [!TIP]
> MP3 plays in every browser. Ogg Vorbis does not decode in older Safari. Keep one-shots mono so
> they pan cleanly, and set `loopStart`/`loopEnd` a few milliseconds inside a loop so encoder
> padding never plays.

Good places to find sounds:

- **[Freesound](https://freesound.org)** — the largest library; filter to Creative Commons 0.
- **[Kenney](https://kenney.nl/assets/category:Audio)** — CC0 packs of UI, impacts, footsteps and
  jingles.
- **[OpenGameArt](https://opengameart.org/art-search-advanced)** — filter by license, then check
  each page, since many items are CC-BY or GPL.
- **Generated clips** (ElevenLabs sound effects, Stable Audio Open) — record the prompt and the
  generator in the entry's `source`, and check the service's terms for your use.

CC-BY sounds and music (Kevin MacLeod's, for example) are fine in your own bank if you show the
credit they require. Avoid the BBC Sound Effects archive (non-commercial licence) and libraries
that forbid redistribution.
