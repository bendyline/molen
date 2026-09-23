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

Presets are starting points, not classifications that constrain these independent parameters.

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
overrides the component; explicit `wind` overrides its wind. `stepAircraft` accepts the same
optional weather value. Without weather, aircraft retain their existing altitude-density
model exactly. Ground friction and character temperature exposure are not implicitly changed.

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
