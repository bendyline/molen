# @bendyline/molen-entities

Ids and helpers for Molen's curated entity collection: trees, a shrub and a boulder, the P-51D and
OH-6 aircraft, and five road vehicles. The models and type documents themselves are content, not
code: they ship as the `molen.entities` content pack.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

![The nature collection rendered by Molen](https://raw.githubusercontent.com/bendyline/molen/main/packages/entities/docs/gallery.png)

## Install

```sh
npm i @bendyline/molen-entities @bendyline/molen-pack
```

Node >= 22.13, ESM only, one `.` export. The package itself is a few kilobytes of ids and
functions; load the `molen.entities` pack from wherever your app hosts it with
`@bendyline/molen-pack`.

## Use

```ts
import { createClient } from '@bendyline/molen-client';
import { createTypeLibrary } from '@bendyline/molen-kernel/content';
import { molenAircraft } from '@bendyline/molen-entities';
import { createPackSet, openPack } from '@bendyline/molen-pack';

const entities = await openPack('/packs/molen.entities.zip'); // wherever your app hosts it

// Models: the pack serves them to the client by asset id.
const client = await createClient(link, {
  assets: { provider: createPackSet([entities]).assetProvider() },
});

// Types: the pack's type documents as a library.
const types = createTypeLibrary(
  await Promise.all((entities.manifest.provides.types ?? []).map((p) => entities.readJson(p))),
);
const mustang = molenAircraft(types, 'molen.entities.aircraft.p51d').spec;
```

The renderable refs and type ids are identical, for example `molen.entities.tree.conifer.pine`. In
a project, list the pack in `project.json` `packs` and scenes can use the types by id. Each model is
a deterministic glTF with a `molen/asset@1` sidecar (bounds and collision hull): Y-up,
meter-scaled, rooted at ground level.

## What's in it

| Export | For |
| --- | --- |
| `MOLEN_ENTITY_IDS`, `MolenEntityId` | Every id in the pack |
| `MOLEN_AIRCRAFT_ENTITY_IDS`, `MOLEN_VEHICLE_ENTITY_IDS` | The aircraft and vehicle ids, with typed unions |
| `molenAircraft(types, id)`, `molenVehicle(types, id)` | Resolved `aircraft` and `vehicle` component data from a type library |
| `createMolenEntitiesAssetIndex(baseUrl)` | A client `assets.index` for the pack's files extracted to a static directory (`molen pack extract`) |

## Status

0.x, on one fixed version line with every other `@bendyline/molen-*` package. The pack's version
moves separately; entity ids are stable.

The aircraft depict real types by their public designations (P-51D Mustang, OH-6) as original
low-poly models; the pack's NOTICE carries the trademark statement.

![Mustang and OH-6 aircraft rendered in Molen](https://raw.githubusercontent.com/bendyline/molen/main/packages/entities/docs/aircraft.png)

## Docs

- [Reusable entities](https://molen.dev/guide/entities): binding the pack, and how the sources are
  authored and regenerated in the repository
- [Aircraft](https://molen.dev/guide/aircraft): controls, flight physics and cockpit instruments
- [Mountable vehicles](https://molen.dev/guide/vehicles)
- [Projects and content packs](https://molen.dev/guide/project)

MIT © Bendyline LLC
