# Weather and physical atmosphere

The singleton `weather` component describes atmospheric conditions independently of the
`environment` component's Earth or authored sky. Clouds, precipitation and visibility are
separate axes. Overcast need not rain; temperature never silently selects rain versus snow.
There is no forecast service, browser geolocation request, or implicit host clock.

Add this entity to a `molen/scene@3` manifest:

```json
{
  "id": "conditions",
  "components": {
    "weather": {
      "atmosphere": {
        "temperatureK": 282.15,
        "pressurePa": 100200,
        "relativeHumidity": 0.95,
        "windVelocity": [7, 0, 3],
        "referenceAltitude": 0,
        "gasConstant": 287.05
      },
      "clouds": { "type": "stratus", "coverage": 0.98, "density": 0.95, "baseAltitude": 1600, "thickness": 1200, "scale": 16000 },
      "precipitation": { "kind": "rain", "intensity": 0.7 },
      "visibility": 4500,
      "seed": 1
    }
  }
}
```

One weather entity is supported: the first entity carrying the component wins. Changes,
component removal and keyframe replacement propagate through the snapshot/delta path.
Weather participates in state hashes, checkpoints and replays.

## Units and profiles

`WeatherData`, `weatherSchema`, `resolveWeather`, `WeatherProfile` and `weatherProfile` are
exported by `@bendyline/molen-schema`. The client re-exports the types, resolver and presets.
`weatherProfile('sunny' | 'partly-cloudy' | 'overcast' | 'rain' | 'storm' | 'snow' | 'fog')`
returns fresh editable data. `resolveWeather(data)` supplies defaults and copies nested values. Validate
external data with `weatherSchema.parse` before using it in typed code.

| Parameter | Meaning |
| --- | --- |
| `atmosphere.model` | `standard` (default): layered Earth atmosphere; `isothermal`: uniform temperature, including alternate-world use. |
| `atmosphere.moistAir` | Apply humidity's ideal-gas density correction; default false for dry reference air. |
| `atmosphere.temperatureK` | Kelvin at the reference altitude; default 288.15 K (15 °C). |
| `atmosphere.pressurePa` | Absolute pressure at the reference altitude; default 101325 Pa. Zero allows vacuum. |
| `atmosphere.relativeHumidity` | 0–1; stored for consumers, independent of precipitation. |
| `atmosphere.windVelocity` | World XYZ velocity in m/s; +X east and -Z north in Earth worlds. A velocity toward a direction, not a meteorological "from" bearing. |
| `atmosphere.referenceAltitude` | Absolute world Y where temperature/pressure apply, default 0 m. |
| `atmosphere.gasConstant` | Specific gas constant, default 287.05 J/(kg·K) for dry air; configurable for other worlds. |
| `clouds.type` | `cumulus` (default): separate fair-weather heaps; `stratocumulus`: a lumpy, closed layer; `stratus`: a flat grey sheet; `cumulonimbus`: towering storm cells with anvil tops (give them a deep layer). |
| `clouds.coverage`, `density` | Independent 0–1 controls: the share of the sky the layer covers (1 closes it) and its optical density. |
| `clouds.baseAltitude`, `thickness`, `scale` | Absolute base Y and depth of the layer, and the horizontal pattern repeat size, in meters. |
| `clouds.cirrus`, `cirrusAltitude` | Coverage 0–1 of a thin, wispy high cirrus layer (default 0) and its absolute Y (default 9000 m). Independent of the main layer. |
| `precipitation.kind`, `intensity` | Explicit none/rain/snow and 0–1 visual intensity; not calibrated mm/hour. |
| `visibility` | Approximate visual fade distance in meters, independent of clouds and precipitation. |
| `wind.referenceHeight` | Height above ground in meters where `windVelocity` applies; default 10. |
| `wind.shear` | Power-law exponent of wind speed with height, to 600 m; default 0 (uniform). About 0.14 over open country, 0.3 over cities. |
| `wind.turbulence` | 0–1 intensity; default 0. About 0.15 light chop, 0.4 moderate, 0.8 severe. |
| `wind.gusts` | 0–1 along-wind gust swing as a fraction of the mean wind; default 0. |
| `wind.terrain` | 0–1 strength of slope flow: lift up windward hillsides, sink and rougher air in the lee; default 0. |

Presets are starting points, not classifications that constrain these independent parameters.
Partly cloudy is cumulus under some cirrus, overcast a closed stratocumulus deck, rain and snow
stratus, and storm scattered cumulonimbus 7 km deep with heavy rain.
Every preset includes a `wind` block: light chop and gusts for sunny skies, rougher air in rain,
and nearly still, strongly sheared air in fog.

## Simulation and physics

Scripts read and update the ordinary component:

```ts
const current = molen.get('conditions', 'weather');
if (current) molen.patch('conditions', 'weather', {
  atmosphere: { ...current.atmosphere, temperatureK: 271.15 }
});
```

Typed systems use `Weather`, `weatherOf(world)` and `sampleAtmosphere(data, altitude, gravity?)`
from `@bendyline/molen-kernel`. The sample contains `temperatureK`, `pressurePa`, `densityKgM3`,
`relativeHumidity`, `windVelocity` and `speedOfSound`. It uses deterministic math and the
US Standard Atmosphere 1976 lower-atmosphere lapse layers, with geometric-to-geopotential
altitude conversion, anchored to authored reference temperature/pressure. The supported range
is -2 to 100 km; values beyond it sample the nearest endpoint. Gravity defaults to 9.80665 m/s².
`model: 'isothermal'` retains the former uniform-temperature hydrostatic profile.
Dry ideal-gas density is the default; `moistAir: true` adds a water-vapor correction using
relative humidity and saturation vapor pressure. This does not select rain/snow or simulate fluid flow.

`installAircraft` reads the world's weather each physics tick. Wind changes airspeed, and
temperature/pressure change aerodynamic density. Explicit `AircraftEnvironment.weather`
overrides the component; explicit `wind` overrides its wind with a uniform velocity. `stepAircraft`
accepts the same optional weather value and a `time`. Without weather, aircraft use the dry
standard atmosphere. Ground friction and character temperature exposure are
not implicitly changed.

## Wind shear, turbulence and gusts

The `wind` block shapes the air around the mean `windVelocity`. `windField(weather)` returns its
deterministic field, and `sampleWind(weather, position, time, groundHeight?)` samples it, both
from `@bendyline/molen-kernel`:

```ts
import { sampleWind, weatherOf } from '@bendyline/molen-kernel';

world.addSystem((w, ctx) => {
  const weather = weatherOf(w);
  if (!weather) return;
  // Air velocity in m/s at a point, on the world clock, over the world's terrain.
  const air = sampleWind(weather, [0, 120, 0], ctx.tick * ctx.dt, (x, z) => ground(x, z));
});
```

- **Shear.** The mean wind's horizontal speed follows `(height / referenceHeight) ^ shear` with
  height above the ground beneath the point, up to 600 m. Below the reference height it is
  lighter.
- **Turbulence.** Eddies from 20 m to 1.2 km across, with the -5/3 energy spectrum of real air,
  are carried downwind with the mean wind and slowly evolve. Their strength grows with
  `turbulence` and with wind speed, comes in patches a few kilometers across, fades above the
  1 km boundary layer, and near the ground loses its vertical part.
- **Gusts.** Along-wind speed swings of up to `gusts` times the mean, in fronts a few hundred
  meters apart that sweep past with the wind.
- **Terrain.** With a ground-height function, wind blowing up a slope rises and wind blowing
  down one sinks, fading over a few hundred meters of height; the lee side is also rougher.

The field is a pure function of the weather, the point and simulation time, so it needs no state
in snapshots and consumes no simulation random numbers; `seed` varies the pattern. Two aircraft
crossing the same air feel the same bump, and a replay feels every bump again. The renderer's
clouds and precipitation still drift with the mean wind; audio's wind level follows the mean too.

## Rendering and clocks

The normal client mirrors weather automatically. Standalone hosts can call:

```ts
import { weatherProfile } from '@bendyline/molen-client';
viewer.renderer.setWeather(weatherProfile('partly-cloudy'));
viewer.renderer.setWeatherTimeOverride(20); // absolute preview seconds
viewer.renderer.setWeatherTimeOverride(undefined); // resume simulation time
viewer.renderer.setWeather(undefined); // remove weather effects
```

The cloud layer is a volume, ray-marched between `baseAltitude` and the top of the layer on
both backends: a weather map decides where clouds stand, a 3D billow noise carves them, and each
sample is lit by marching toward the sun (or moon), so cumulus have flat grey bases and bright,
rounded tops, a closed deck is lumpy underneath, and a low sun lights cloud bases from below.
You can fly over, under and into it; inside a cloud the view whites out. Cirrus are a flat sheet
of wind-combed streaks at `cirrusAltitude`. Clouds drift with the mean wind, cumulus slowly boil,
cirrus ride faster, and all of them occlude celestial bodies, tint through dusk and night, take
the scene's haze (less of it looking up, since haze lies near the ground) and reduce direct
lighting. Rain and snow share a bounded camera-local particle batch with wind drift. Seed/time
sampling is deterministic; floating-origin changes preserve world alignment. No simulation
random numbers are consumed.

`viewer.renderer.setCloudQuality('low' | 'medium' | 'high' | 'ultra')` (default `'medium'`) sets
the work per pixel: ray-march steps and light samples, edge erosion from `'high'`, and from
`'high'` cloud shadows. Cloud shadows project the cloud field along the sun onto every lit
surface, terrain, buildings and vehicles alike, and replace the even dimming of direct light that
cloud cover applies at lower qualities. The quality is uniform-driven, so changing it, even every
frame, rebuilds no shader. `mountEarthView` sets it from its performance tier: low at the two
lowest levels, medium up to Balanced, high and ultra above (with cloud shadows). Measured on a
1280x720 partly cloudy view, clouds cost about 0.5-0.7 ms of GPU time at low and 1.0-1.7 ms at
medium to ultra on an integrated laptop GPU, and 0.15-0.65 ms on a discrete one; looking out
from inside a cloud costs about twice that.

The deck is one draw (a camera-centred plane where view rays enter the layer, or nested shells
around a camera inside it, so nearer geometry hides it through the ordinary depth test), cirrus
one more and precipitation one. The noise is generated once per page, a few milliseconds per
frame, and the clouds appear when it is ready (about a second); sunny startup generates no cloud
noise and allocates no particle batch. Animation follows simulation time independently of a
sky-time preview override, so pauses and captures remain repeatable.

On WebGL, cloud shadows reach a lit material through three's lighting chunks. A material that
installs its own `onBeforeCompile` keeps them by calling the prototype's first:

```ts
material.onBeforeCompile = (shader, renderer) => {
  THREE.Material.prototype.onBeforeCompile.call(material, shader, renderer);
  // ...the material's own changes
};
```

On WebGPU every node material receives them through the directional lights.

Weather visibility temporarily limits scene fog; a nearer authored terrain fog limit and its
clear foreground are preserved when weather visibility reaches beyond that limit. Under a closed
deck the fog turns grey. Removing weather restores the authored fog and lighting. Clouds are a
visual volume: flying through one does not simulate icing, turbulence or condensation (wind
turbulence is the `wind` block's). Precipitation is a local visual field, including above cloud
layers, without roof/terrain collision, splash, accumulation or wet-material response.

## World explorer

The Weather dropdown includes Fair, Sunny / clear, Partly cloudy, Overcast, Rain, Thunderstorms,
Snow and Fog.
The explorer opens on Fair, its own preset: Sunny with scattered fair-weather cumulus (30%
coverage at 45% density, in 24 km cells rather than the default 16 km), so a street-level sky is
not a bare gradient and the layer breaks into separate clouds toward the horizon. Weather
details mixes cloud type, coverage, density, base, depth and cirrus, precipitation, intensity,
visibility, temperature, pressure and wind, marking the profile Custom. Cloud quality follows the
graphics quality; High casts cloud shadows. Temperature and pressure controls
refer to sea level, displayed in °C and hPa and stored in kelvin and pascals. The same component
is installed in the explorer's vehicle/aircraft simulation.

Use `?weather=rain` or another preset id. Custom edits are session-local. `?freeze=1` freezes
weather motion for comparisons. The day slider changes lighting without moving the camera
or seeking precipitation animation. The legacy `?sky=daylight` path stays weather-free unless
a weather profile is explicitly requested.
