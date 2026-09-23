# Reusable entities

`@bendyline/molen-entities` is molen's curated content package. It builds on the existing
`renderable.kind: "gltf"`, `molen/asset@1`, `molen/types@1`, and `molen/project@1` contracts;
there is no second entity or asset runtime.

The initial nature collection contains pine, fir, oak, birch, shrub, and boulder models under the
stable `molen.entities.*` namespace. Every model is a deterministic texture-free GLB with a
hash-verified sidecar, meter-scale bounds, a conservative collision hull, and a type definition.
The package's gallery scene is both an example and a headless render check.

Every concrete thing is authored as a [logical source bundle](source-bundles.md) under
`packages/entities/source/<category>/<thing>/`. Its local `source.json` inventories the definition,
model master or recipe, scripts, textures, sounds, and documentation. The package generator builds
the aggregate registry and gallery from those bundles; the aggregate files are compatibility and
runtime outputs, not a second authoring authority.

Bind the library to a browser client with the normal asset index:

```ts
import { createClient } from '@bendyline/molen-client';
import { createMolenEntitiesAssetIndex } from '@bendyline/molen-entities';

const client = await createClient(link, {
  assets: { index: createMolenEntitiesAssetIndex() },
});
```

The entity type id and renderable asset ref are identical, such as
`molen.entities.tree.conifer.pine`. A project may consume the exported `project.json` and
`types/entities.types.json`, or merge their mappings into its own registry through the same normal
project workflow described in [Projects & types](project.md).

From the repository, run `molen asset list` in `packages/entities`, `molen types check --project
packages/entities/project.json`, or render `packages/entities/scenes/gallery.scene.json` with
`molen shot`. The package generator is deterministic and its build fails when a checked-in GLB,
sidecar, types document, project, or gallery scene is stale.
## Aircraft collection

`molen.entities.aircraft.p51d` and `molen.entities.aircraft.h500md` add the Mustang and OH-6
helicopter, including GLBs, flight components and pilot seats. The existing asset-index helper
includes them. See [Aircraft](aircraft.md) for world-view controls, physics and integration.
