# Reusable entities

The `molen.entities` content pack is Molen's curated entity collection. It builds on the existing
`renderable.kind: "gltf"`, `molen/asset@1`, `molen/types@1`, and `molen/project@1` contracts;
there is no second entity or asset runtime.

The initial nature collection contains pine, fir, oak, birch, shrub, and boulder models under the
stable `molen.entities.*` namespace. Every model is a deterministic texture-free GLB with a
hash-verified sidecar, meter-scale bounds, a conservative collision hull, and a type definition.
The npm package `@bendyline/molen-entities` carries only the id lists and helpers, no models or
type documents. Get the pack itself into a project with:

```sh
npx molen pack fetch https://molen.dev/packs/index.json molen.entities
```

That downloads the zip into `packs/` and pins it in project.json's `packs`, so `molen validate`,
`sim run` and the other ops resolve `molen.entities.*` types (`molen project info` lists them).
Serve the same zip with your app for the browser. The headless capture ops (`shot`, `drive`,
`frames`) draw only the models in the project's own `assets` today, so a pack model renders in the
browser through the asset provider below but not yet in a CLI capture. The pack's
source is [`content/entities/`](https://github.com/bendyline/molen/tree/main/content/entities) in
the engine repository, where its gallery scene is both an example and a headless render check.

Every concrete thing is authored as a [logical source bundle](source-bundles.md) under
[`content/entities/source/<category>/<thing>/`](https://github.com/bendyline/molen/tree/main/content/entities/source). Its local `source.json` inventories the definition,
model master or recipe, scripts, textures, sounds, and documentation. The package generator builds
the aggregate registry and gallery from those bundles; the aggregate files are compatibility and
runtime outputs, not a second authoring authority.

Bind the pack to a browser client through its asset provider:

```ts
import { createClient } from '@bendyline/molen-client';
import { createPackSet, openPack } from '@bendyline/molen-pack';

// Wherever the app hosts the pack. Models are range-read only when a scene uses them.
const entities = await openPack('/packs/molen.entities.zip');
const client = await createClient(link, {
  assets: { provider: createPackSet([entities]).assetProvider() },
});
```

The entity type id and renderable asset ref are identical, such as
`molen.entities.tree.conifer.pine`. For the type definitions, list the pack in the project's
`packs` (see [Projects & types](project.md)); the CLI then resolves every `molen.entities.*` type.
In code, read the documents the manifest `provides` as `types` and pass them to
`createTypeLibrary` from `@bendyline/molen-kernel/content`.

In the engine repository, run `molen asset list` in `content/entities`, `molen types check --project
content/entities/project.json`, or render `content/entities/scenes/gallery.scene.json` with
`molen shot`. The package generator is deterministic and its build fails when a checked-in GLB,
sidecar, types document, project, or gallery scene is stale.
## Aircraft collection

`molen.entities.aircraft.p51d` and `molen.entities.aircraft.oh6` add the Mustang and OH-6
helicopter, including GLBs, flight components and pilot seats. The pack's asset provider
serves them like any other model. See [Aircraft](aircraft.md) for world-view controls, physics and integration.

## Transit and background traffic

`molen.entities.transit.bus` is a 12 m city bus, `molen.entities.transit.lightrail` a 27 m
two-section light-rail car, and `molen.entities.aircraft.airliner` a narrow-body airliner. They are
models for background traffic, not mountable vehicles. [Ambient life](ambient-life.md) spawns them
through their `ambientRole` component, as it does the pack's road vehicles and the two aircraft above.
In the engine repository, `content/entities/scenes/transit.scene.json` shows them side by side.

## Road, cycle and water fleets

The road fleet has eleven mountable models. Alongside compact, sedan, SUV, pickup and van,
`molen.entities.vehicle.*` includes `sports_coupe`, `station_wagon`, `electric_hatchback`,
`taxi`, `offroad` and `box_truck`. They expose the usual wheel pivots, paint material, driver
seat and vehicle tuning, and join the ambient car pool.

`molen.entities.cycle.*` contains `standard_motorcycle`, `cruiser_motorcycle`, `motor_scooter`,
`city_bicycle`, `road_bicycle` and `cargo_bicycle`. These are rideable through the same vehicle/mount API as cars, with self-balancing
handling, saddle poses, animated steering and bicycle pedals. See [Riding cycles](vehicles.md#riding-cycles).
They do not spawn as ambient traffic or in car parking bays.

`molen.entities.watercraft.*` contains `speedboat`, `sailboat`, `fishing_boat`, `tugboat`,
`container_ship`, `bulk_carrier`, `passenger_ferry` and `car_ferry`. Their origin is **Y=0 at
the waterline**, with the hull extending below it. The two ferries have `ambientRole.role:
"ferry"`; the other vessels have `role: "boat"`. See [water traffic](ambient-life.md#water-traffic)
for routing and terminal stops. Each type also supplies a powered `boat` and driver/passenger
seats for [player boating](boats.md), swells, currents and dockside boarding. The sailboat uses
its auxiliary motor.

The id helpers `MOLEN_CYCLE_ENTITY_IDS` and `MOLEN_WATERCRAFT_ENTITY_IDS` enumerate the new
collections. All are in `MOLEN_ENTITY_IDS` and the pack's type documents.

In the engine repository, `content/entities/scenes/fleet.scene.json` displays the road and
cycle models; `content/entities/scenes/harbor.scene.json` displays the water fleet with moving
ferries. Each new bundle has an editable `models/recipe.json`; the shared authoring capability
`packages/entities/scripts/generate-fleet.mjs --ids=sports-coupe,tugboat` rebuilds selected
models. It preserves an artist-edited master that no longer matches its generator pin.
After importing, `node packages/entities/scripts/capture-fleet.mjs` renders four views of each
model and both demo scenes; `--ids=sports-coupe,tugboat` narrows the review to selected models.
