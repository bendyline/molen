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
      "clouds": { "coverage": 0.98, "density": 0.95, "baseAltitude": 1600, "thickness": 1200, "scale": 16000 },
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
`weatherProfile('sunny' | 'partly-cloudy' | 'overcast' | 'rain' | 'snow' | 'fog')` returns fresh
editable data. `resolveWeather(data)` supplies defaults and copies nested values. Validate
external data with `weatherSchema.parse` before using it in typed code.

| Parameter | Meaning |
| --- | --- |
| `atmosphere.temperatureK` | Kelvin at the reference altitude; default 288.15 K (15 °C). |
| `atmosphere.pressurePa` | Absolute pressure at the reference altitude; default 101325 Pa. Zero allows vacuum. |
| `atmosphere.relativeHumidity` | 0–1; stored for consumers, independent of precipitation. |
| `atmosphere.windVelocity` | World XYZ velocity in m/s; +X east and -Z north in Earth worlds. A velocity toward a direction, not a meteorological "from" bearing. |
| `atmosphere.referenceAltitude` | Absolute world Y where temperature/pressure apply, default 0 m. |
| `atmosphere.gasConstant` | Specific gas constant, default 287.05 J/(kg·K) for dry air; configurable for other worlds. |
| `clouds.coverage`, `density` | Independent 0–1 coverage and optical density controls. |
| `clouds.baseAltitude`, `thickness`, `scale` | Absolute base Y, layer separation, and horizontal pattern repeat size in meters. |
| `precipitation.kind`, `intensity` | Explicit none/rain/snow and 0–1 visual intensity; not calibrated mm/hour. |
| `visibility` | Approximate visual fade distance in meters, independent of clouds and precipitation. |
| `wind.referenceHeight` | Height above ground in meters where `windVelocity` applies; default 10. |
| `wind.shear` | Power-law exponent of wind speed with height, to 600 m; default 0 (uniform). About 0.14 over open country, 0.3 over cities. |
| `wind.turbulence` | 0–1 intensity; default 0. About 0.15 light chop, 0.4 moderate, 0.8 severe. |
| `wind.gusts` | 0–1 along-wind gust swing as a fraction of the mean wind; default 0. |
| `wind.terrain` | 0–1 strength of slope flow: lift up windward hillsides, sink and rougher air in the lee; default 0. |

Presets are starting points, not classifications that constrain these independent parameters.
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
`relativeHumidity` and `windVelocity`. It uses deterministic math, ideal-gas density
`pressure / (gasConstant * temperature)` and an isothermal hydrostatic pressure profile.
Gravity defaults to 9.80665 m/s². Humidity is informational: there is no moist-air correction,
temperature lapse rate or fluid simulation.

`installAircraft` reads the world's weather each physics tick. Wind changes airspeed, and
temperature/pressure change aerodynamic density. Explicit `AircraftEnvironment.weather`
overrides the component; explicit `wind` overrides its wind with a uniform velocity. `stepAircraft`
accepts the same optional weather value and a `time`. Without weather, aircraft retain their
existing altitude-density model exactly. Ground friction and character temperature exposure are
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

Clouds use two wind-advected procedural layers at absolute world altitudes. They occlude
celestial bodies, tint through dusk/night, and reduce direct lighting. Rain and snow share a
bounded camera-local particle batch with wind drift. Seed/time sampling is deterministic;
floating-origin changes preserve world alignment. No simulation random numbers are consumed.

Standard materials work on WebGL and WebGPU, with up to two cloud draws and one precipitation
draw. Textures generate locally when needed; sunny startup generates no cloud noise and
allocates no particle batch. Animation follows simulation time independently of a sky-time
preview override, so pauses and captures remain repeatable.

Weather visibility temporarily limits scene fog; a nearer authored terrain fog limit and its
clear foreground are preserved when weather visibility reaches beyond that limit. Removing
weather restores the authored fog and lighting. Clouds are layered
surfaces, not ray-marched 3D volumes: flying through a layer does not simulate condensation.
Precipitation is a local visual field, including above cloud layers, without roof/terrain
collision, splash, accumulation or wet-material response.

## World explorer

The Weather dropdown includes Sunny / clear, Partly cloudy, Overcast, Rain, Snow and Fog.
Weather details mixes cloud coverage/density/altitude, precipitation, intensity, visibility,
temperature, pressure and wind, marking the profile Custom. Temperature and pressure controls
refer to sea level, displayed in °C and hPa and stored in kelvin and pascals. The same component
is installed in the explorer's vehicle/aircraft simulation.

Use `?weather=rain` or another preset id. Custom edits are session-local. `?freeze=1` freezes
weather motion for comparisons. The day slider changes lighting without moving the camera
or seeking precipitation animation. The legacy `?sky=daylight` path stays weather-free unless
a weather profile is explicitly requested.
