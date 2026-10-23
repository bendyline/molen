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

## Bendy transit and background traffic

`molen.entities.transit.bus` is a 12 m city bus, `molen.entities.transit.lightrail` a 27 m
two-section light-rail car, and `molen.entities.aircraft.airliner` a narrow-body airliner. Their
display names are **Bendy Bus**, **Bendy Light Rail** and **Bendy Small Airliner**. All three
are mountable: the bus uses the road solver, light rail supports traction/braking/reversing
on a straight track with steering locked, and the airliner uses the assisted twin-engine
airplane solver with gear and flap controls. The airliner's thrust is an approximation, not
a dedicated turbofan simulation. Player rail controls do not yet follow curved network routes;
ambient rail consists retain their existing network following.
[Ambient life](ambient-life.md) also spawns them through their `ambientRole` component.
In the engine repository, `content/entities/scenes/transit.scene.json` shows them side by side.

## Road, cycle and water fleets

The Bendy road fleet has eleven mountable models. Alongside compact, sedan, SUV, pickup and van,
`molen.entities.vehicle.*` includes `sports_coupe`, `station_wagon`, `electric_hatchback`,
`taxi`, `offroad` and `box_truck`. They expose the usual wheel pivots, paint material, driver
seat and vehicle tuning, and join the ambient car pool.

All generic road, cycle, water and transit display names use the **Bendy** house brand.
Asset/type IDs remain stable. P-51D Mustang and OH-6 retain their real identities. Models follow
the [close-view vehicle detail standard](medium-fi.md#controllable-vehicles-close-view-fidelity).

Forty additional U.S. market reference vehicles retain their manufacturer/model/year identities,
including `molen.entities.vehicle.ford_f_150_2025`, `molen.entities.vehicle.toyota_prius_2024`,
`molen.entities.vehicle.tesla_model_3_2025` and `molen.entities.vehicle.ford_mustang_2024`.
`MOLEN_US_VEHICLE_ENTITY_IDS` enumerates this collection; it is also included in
`MOLEN_VEHICLE_ENTITY_IDS` and `MOLEN_ENTITY_IDS`. All forty support the same boarding,
steering, braking, reversing and exiting API as the Bendy cars. They provide named wheel and
steering pivots, driving cabins and ambient car roles.

These are polygonal interpretations with rounded authoring dimensions and simplified trim,
not manufacturer CAD reproductions. Handling is tuned for play; digital display graphics are
illustrative, while the driving HUD supplies live telemetry and analog speed needles are bound
where present. The 2024 Model Y represents the original body, not the later refresh.
See the repository's [complete roster](https://github.com/bendyline/molen/blob/main/content/entities/US-VEHICLES.md).
`content/entities/scenes/us-vehicles.scene.json` places all forty in a showroom. Their recipes
live beside the Bendy recipes and use the same targeted generation/import/capture workflow.

> [!NOTE]
> The reference vehicles, the Winnebago View and the P-51D and OH-6 are identified by their real
> manufacturer, model and year names so you know what each interpretation depicts. The names are
> identification only: the geometry carries no maker emblem, wordmark, model lettering or
> logo-shaped grille (a plain chrome badge and a fictional `MLN` plate stand in), and the pack's
> MIT license grants no trademark rights. The names are their owners' marks, used without
> affiliation or endorsement; whether a descriptive use here stays descriptive in your product is
> your own call. Every mountable type's spec therefore carries a name-free `genericLabel`
> (`Full-size pickup`, `Light observation helicopter`) and, for wheeled vehicles, a generic
> `bodyStyle` (`pickup`, `suv`, `motorhome`, `bicycle`, …), and `view.vehicleStatus()` reports
> both, so a host can show, filter or relabel the fleet without any real name. The pack's
> `NOTICE.md` and the repository
> [NOTICE](https://github.com/bendyline/molen/blob/main/NOTICE.md) record the details.

A second collection adds forty varied vehicles from **2005–2024**, with two models from each
year: city cars, retro hatchbacks, wagons, roadsters, coupes, sedans, cargo vans, pickups and
off-road vehicles. `MOLEN_VARIETY_VEHICLE_ENTITY_IDS` enumerates these IDs, also present in
the main vehicle/entity helpers. Examples include `molen.entities.vehicle.smart_fortwo_2009`,
`molen.entities.vehicle.mazda_mx_5_miata_2016` and
`molen.entities.vehicle.mercedes_benz_sprinter_2019`. All forty use the same driving API.
The [variety roster](https://github.com/bendyline/molen/blob/main/content/entities/VARIETY-VEHICLES.md)
records each selected year and body configuration; `content/entities/scenes/variety-vehicles.scene.json`
is its showroom. Open-top models have fixed lowered roofs, and cargo vans have enclosed load
compartments. Doors and roofs do not animate. The same reference-model limitations above apply.

The regional expansion adds 24 drivable reference vehicles for China, Japan, Korea, Europe,
South America and Africa, exposed by `MOLEN_REGIONAL_VEHICLE_ENTITY_IDS`. Most are model year
2024; the four-door Wuling Hongguang MINI EV is 2025. They share the same vehicle API, and
`content/entities/scenes/regional-vehicles.scene.json` displays the collection. The pack provides
the small regional fleet catalog used by Earth traffic and parking. See
[Regional vehicle fleets](regional-fleets.md) for selection, downloads, memory budgets and coverage.

Two additional reference vehicles are the white **2012 MINI Cooper Countryman**
(`molen.entities.vehicle.mini_cooper_countryman_2012`) and dark gray **2019 Acura MDX**
(`molen.entities.vehicle.acura_mdx_2019`). Their default and ambient paint palettes preserve
those colors. They share the driving API and appear in the main vehicle/entity helpers.
`content/entities/scenes/mini-acura.scene.json` displays them beside the existing green
2013 MINI Cooper (`molen.entities.vehicle.mini_cooper_2013`). See the
[MINI and Acura roster](https://github.com/bendyline/molen/blob/main/content/entities/MINI-ACURA.md).

Six motorhomes add two Class Cs, three Class As and one Class B. The **2022 Winnebago View 24D**
uses `molen.entities.vehicle.winnebago_view_2022`; the other five are Bendy designs.
`MOLEN_RV_ENTITY_IDS` enumerates them, also included in the main vehicle/entity helpers.
They share the driving API, with longer wheelbases, driver-eye cabins, detailed coach fittings,
and wheel/steering/instrument bindings. The largest Class A has an additional tag axle.
Their low-frequency `bus` ambient role selects large road traffic and excludes ordinary
curbside parking. Furnishings are visual geometry; doors, awnings and slideouts stay closed
in a touring configuration. The [RV roster](https://github.com/bendyline/molen/blob/main/content/entities/RVS.md)
records IDs and dimensions; `content/entities/scenes/rvs.scene.json` is the repository showroom.

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
Those captures stay local. `node packages/entities/scripts/preview-fleet.mjs` then composes the
tracked summary artifacts from them: a `preview.png` beside each source bundle (exterior and
operator view, linked from its README) and the per-collection contact sheets under
`content/entities/`, such as `us-vehicles-preview.png`.
