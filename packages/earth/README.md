# @bendyline/molen-earth

An embeddable real-world 3D view for [Molen](https://molen.dev): streamed terrain, worldgen
buildings and street surfaces, orbit/walk/drive navigation with drivable parked cars, map markers,
sky and haze, and adaptive quality — behind one `mountEarthView` call.

```sh
npm install @bendyline/molen-earth @bendyline/molen-client three
```

```ts
import { mountEarthView } from '@bendyline/molen-earth/client';

const view = await mountEarthView({
  canvas,
  terrain: await (await fetch('/terrain/terrain-package.json')).json(),
  baseUrl: new URL('/terrain/terrain-package.json', location.href),
  camera: { latitude: 47.6205, longitude: -122.3493, range: 1500 },
});
view.flyTo({ latitude: 37.8199, longitude: -122.4783, range: 2500 });
```

| Entry point | For |
|---|---|
| `./client` | `mountEarthView`, `loadEarthContent`, `openPacksFromIndex`, `createEarthWorldgen`, `EarthVehicles`, `createEarthSky`, `createEarthFog`, `earthPerformanceTier`, `earthCredits` |
| `./workers/elevation`, `./workers/landcover`, `./workers/surface`, `./workers/worldgen`, `./workers/material` | One-line worker entries: `import '@bendyline/molen-earth/workers/elevation';` in a module worker, passed to `mountEarthView({ workers })` |

Real-world data carries attribution obligations (ODbL for OpenStreetMap). `view.credits` lists
them; keep them visible. See the [Earth view guide](https://molen.dev/guide/earth-view).

MIT, © Bendyline LLC.
