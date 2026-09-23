# Reusable entities

The `molen.entities` content pack is molen's curated entity collection. It builds on the existing
`renderable.kind: "gltf"`, `molen/asset@1`, `molen/types@1`, and `molen/project@1` contracts;
there is no second entity or asset runtime.

The initial nature collection contains pine, fir, oak, birch, shrub, and boulder models under the
stable `molen.entities.*` namespace. Every model is a deterministic texture-free GLB with a
hash-verified sidecar, meter-scale bounds, a conservative collision hull, and a type definition.
Its source is `content/entities/` in the repository; the npm package
`@bendyline/molen-entities` carries only the id lists and helpers, no models or type documents. The
gallery scene is both an example and a headless render check.

Every concrete thing is authored as a [logical source bundle](source-bundles.md) under
`content/entities/source/<category>/<thing>/`. Its local `source.json` inventories the definition,
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

From the repository, run `molen asset list` in `content/entities`, `molen types check --project
content/entities/project.json`, or render `content/entities/scenes/gallery.scene.json` with
`molen shot`. The package generator is deterministic and its build fails when a checked-in GLB,
sidecar, types document, project, or gallery scene is stale.
## Aircraft collection

`molen.entities.aircraft.p51d` and `molen.entities.aircraft.oh6` add the Mustang and OH-6
helicopter, including GLBs, flight components and pilot seats. The pack's asset provider
serves them like any other model. See [Aircraft](aircraft.md) for world-view controls, physics and integration.
