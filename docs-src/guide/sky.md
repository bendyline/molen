# Earth and authored skies

Put `sky` on the singleton `environment` component to render a clear sky, Sun, Moon and
stars, with lighting that follows the Sun and lunar phase. It works in live clients, snapshot
viewers, `molen shot`, and `molen frames`, on WebGL and WebGPU. Scenes without `sky` retain
their existing environment behavior. No external texture or astronomy service is required.

## Author an Earth sky

```json
{
  "id": "environment",
  "components": {
    "environment": {
      "sky": {
        "mode": "earth",
        "observer": { "latitude": 47.6, "longitude": -122.3, "elevation": 50 },
        "time": { "epochMs": 1718942400000, "scale": 60 },
        "stars": { "magnitudeLimit": 6, "intensity": 1 },
        "lighting": { "sunIntensity": 3, "moonIntensity": 0.12 }
      },
      "toneMapping": "agx",
      "shadows": "medium"
    }
  }
}
```

The clock is `epochMs + simulationSeconds × scale × 1000`, where simulation seconds are
`tick / tickRate`. `epochMs` is UTC Unix milliseconds at tick zero. `scale: 1` advances at
simulation speed, `60` advances a minute per simulation second, `0` freezes, and negative
values rewind. Captures seek directly to the requested tick; no accumulated browser frame
time is needed. Rendering samples a stable one-second UTC grid; the pure ephemeris API uses
the exact supplied time. Pausing or resynchronizing the simulation also pauses or seeks the sky.

Latitude is degrees north, longitude degrees east (west is negative), elevation is meters above
sea level. Molen uses +X east, +Y up and -Z north. `observer.northOffsetDeg` rotates geographic
north clockwise toward +X for worlds with another orientation. Location is explicit; the engine
does not request geolocation or infer it from arbitrary entity coordinates. For a large Earth
world, the host should update the observer when moving to a different geographic region.

To start at the current time, supply it once **in the host**, before loading the manifest:

```ts
const sky = {
  mode: 'earth' as const,
  observer: { latitude: 47.6, longitude: -122.3 },
  time: { epochMs: Date.now(), scale: 1 },
};
```

Store that epoch with the scene to reproduce it later. Scene scripts cannot read `Date`;
they can patch the environment's sky data in response to commands. Changing speed without a
jump requires rebasing `epochMs` so that the new clock has the same UTC value at the current tick.
Timezone and daylight-saving conversion belongs in the host UI; the renderer only consumes UTC.

## Renderer API and astronomical queries

```ts
import { applyEnvironment, evaluateEarthSky, starDirection } from '@bendyline/molen-client';

applyEnvironment(viewer.renderer, { sky, toneMapping: 'agx' });
viewer.renderFrame(); // Live clients and snapshots supply their own simulation time.

const state = evaluateEarthSky(Date.parse('2024-03-25T05:00:00Z'), sky.observer);
console.log(state.sun.altitudeDeg, state.sun.azimuthDeg);
console.log(state.moon.illuminatedFraction, state.moon.phase);
const sirius = starDirection(101.287, -16.716, state);
```

Standalone `Renderer` hosts call `renderer.setEnvironmentTime(simulationSeconds)` before
`renderer.render()` to drive the clock themselves.
For a time slider over a live or snapshot viewer, call
`renderer.setEnvironmentTimeOverride(simulationSeconds)` to preview the sky without seeking
the world. Pass `undefined` to resume the viewer's clock. The override uses the sky's configured
epoch and scale, just like simulation time. `renderer.sky?.setObserver(observer)` moves an Earth
observer without rebuilding geometry; the next render updates the ephemeris.

`evaluateEarthSky` is a pure CPU query; it needs neither DOM nor GPU. Directions point toward
each body. Azimuth runs clockwise from geographic north, regardless of `northOffsetDeg`.
The Moon's `phase` runs from 0 (new), through 0.25 (first quarter), 0.5 (full), to 0.75 (last
quarter). `illuminatedFraction` is 0–1. Returned diameters are apparent angular degrees.
`renderer.sky?.frame` exposes the current rendering sample, including daylight and star visibility.
These are client calculations using native floating-point math, outside the kernel state hash.

When enabled, sky lighting replaces `environment.ambient` and `environment.sun`. Configure
`sky.lighting.sunIntensity`, `moonIntensity`, `dayAmbient`, `nightAmbient` and `castShadow`
instead. Sunlight fades around the horizon; moonlight depends on altitude, phase and darkness.
Only the Sun casts a sky shadow in phase 1. Shadows also require `environment.shadows` and
scene geometry that casts/receives shadows; their local frustum follows the camera.
`sun.visible`/`moon.visible` control the disks independently of lighting. Use the corresponding
light intensity to disable illumination. `sun.size` and `moon.size` are visual multipliers;
the default 1 preserves real angular size. Larger values help stylized scenes and small displays.

## Other worlds

The shared sky dome, twilight gradient, star sphere and celestial-body rendering can use authored
directions and colors without an Earth clock:

```ts
applyEnvironment(renderer, {
  sky: {
    mode: 'custom',
    sunBody: { direction: [-1, -0.12, -1], angularDiameterDeg: 1 },
    moonBody: { direction: [0.6, 0.45, -1], angularDiameterDeg: 7 },
    palette: {
      dayZenith: '#5f36a3', dayHorizon: '#e394b5', twilight: '#e37893',
      nightZenith: '#100720', nightHorizon: '#543156', moon: '#bee9d8'
    },
    starRotationDeg: [25, 40, 15]
  }
});
```

Directions must be nonzero; their length is ignored. The Moon's terminator follows the Sun's
direction. Omit `moonBody` for a moonless world. `starRotationDeg` is an XYZ Euler rotation in
degrees. The default custom sky reuses the Earth catalog's pattern; low-level `new SkyVisual(data,
{ stars })` accepts an authored star list with `direction`, `magnitude`, and optional hex `color`.
Attach its `lights` group to the world scene, call `update(seconds)` and `prepareCamera(camera)`,
and render its `scene`/`camera` as a background pass before your scene. Dispose it when removed.

`palette` also accepts `ground`, `sun`, and `moon`. `moon.earthshine` controls the dark side's
subtle visibility. Stars support `enabled`, `magnitudeLimit` (up to the catalog limit of 6.5),
`intensity` and visual angular `size`. Stars disappear below the horizon and fade through
twilight; a bright visible Moon reduces their contrast. Moon disks occlude stars behind them.

The clear-sky gradient is art directed, with a forward Sun glow. It is deliberately independent
of distance fog, haze, clouds and weather. Existing `environment.fog` still works on world
geometry; sky colors and lights do not configure it. The background has its own camera and clip
range, so it stays stable through floating-origin rebases, distant terrain and reversed depth.
Orthographic views use a 60° perspective sky oriented along the orthographic camera's view.

## Accuracy, sources and scope

The supported UTC date interval is 1900–2100. Sun and Moon positions use compact orbital
elements with the major lunar perturbations, ellipsoidal observer parallax and sidereal rotation.
The formula reference is Paul Schlyter's
[Computing planetary positions](https://www.stjarnhimlen.se/comp/ppcomp.html).
Regression fixtures independently compare geometric topocentric directions with
[Astronomy Engine](https://github.com/cosinekitty/astronomy): the included cases cover both
hemispheres, poles, solstices, equinox, phase changes, and the date-range endpoints. Their
tolerances are 0.03° for the Sun and 0.15° for the Moon; these are fixture tolerances, not a
guaranteed error bound over the entire interval.

The bundled 8,404 stars through visual magnitude 6.5 are numerical position/photometry records
from **Hoffleit, D. & Warren, W. H. Jr. (1991), Bright Star Catalogue, 5th Revised Edition
(Preliminary Version)**, [CDS V/50](https://cdsarc.cds.unistra.fr/ftp/V/50/), also described by
[NASA HEASARC](https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html).
The default magnitude cutoff is 6. Stellar colors approximate B−V; visual splat sizes are
exaggerated for visibility. J2000 coordinates receive precession and rotate with local sidereal
time. Proper motion, variability, stellar parallax and nutation are omitted. Regenerate the
numeric catalog with `packages/client/scripts/generate-star-catalog.mjs /path/to/catalog.gz`;
the generated header records its input checksum.

No atmospheric refraction, horizon dip, terrain horizon calculation, eclipses, planetary bodies,
Milky Way texture, lunar libration or photographic lunar map are modeled. The procedural lunar
surface is illustrative. Sunrise and sunset are geometric approximations; this is an experience
renderer, not a navigation or observational ephemeris. Layered clouds, precipitation, visibility
and physical atmospheric state live in the separate [weather component](weather.md).
Volumetric atmospheric scattering remains future work.

## Try it

Run `pnpm --filter @bendyline/molen-examples-world-explorer dev` and open
`http://localhost:5225/sky.html`. Choose a location, UTC date, time speed,
or the authored Amethyst world; drag to look around and use **Face Sun** / **Face Moon**.
**Use current time** reads the host clock once and starts normal time flow.
`?backend=webgl` / `?backend=webgpu` select a backend; `?hud=0` hides controls for capture.
The terrain explorer at `/index.html` includes a 24-hour slider, date picker and Now button.
It starts at noon today and shows times in the browser's labeled local time zone. Scrubbing
keeps the camera fixed while the sky, celestial bodies and scene lighting follow the selected
instant and camera location. Use `?date=2024-03-25T05:00:00Z` for a repeatable instant or
`?sky=daylight` for the legacy fixed daylight terrain comparison rig.
