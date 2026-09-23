# @bendyline/molen-schema

The data formats every other Molen package reads and writes: schemas, a validator whose errors
are meant to be fixable, and the component vocabulary. Depends on nothing but Zod.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-schema
```

ESM only, Node >= 22.13. No DOM and no filesystem access, so it runs unchanged in a page, a Worker
and Node.

## Use

Every document carries a `"format": "molen/<kind>@<n>"` envelope. `validate` returns the typed
document, or an error block with a JSON Pointer, what was expected, and an example fix:

```ts
import { validate } from '@bendyline/molen-schema';

const result = validate('scene', {
  format: 'molen/scene@3',
  name: 'arena',
  entities: [{ id: 'player', components: { transform: { pos: [0, 1] } } }],
});

if (result.ok) {
  console.log(`${result.value.entities.length} entities`, result.notices ?? []);
} else {
  console.error(result.formatted);
}
```

```
✖ scene "arena" failed validation (1 issue)

1. /entities/0/components/transform/pos
   Too small: expected array to have >=3 items
   expected: array of at least 3
   received: [0,1]
   hint:     e.g. "transform": {"pos":[0,1.5,-3],"rot":[0,0,0,1]}
   docs:     schemas/components.md
```

Notices are advisory and do not block: a misspelled component name is accepted as a custom
component and reported with a did-you-mean.

## What's in it

| Export | For |
|---|---|
| `validate` / `validateByKind` / `detectKind` | validating a document; `validate` is typed over the ten core kinds |
| `formatIssues` / `blockingIssues` / `noticeIssues` | the error block above, and splitting errors from advisories |
| `listComponents` / `getComponent` / `registerComponent` / `createComponentRegistry` | the component vocabulary validation checks against |
| `listSchemas` / `getSchema` / `registerSchema` / `registerLegacySchema` | the format registry a capability package adds its own kinds to |
| `resolvePrefab` / `resolveEntityComponents` / `deepMergeJson` / `buildTypeIndex` / `resolveType` | layering data: prefab `extends`, registry types, entity overrides |
| `SceneManifest`, `Keyframe`, `Delta`, `Command`, `ReplayFixture`, `ProjectManifest`, `AssetSidecar`, `MessageLink` | the types, including the kernel/client message protocol |
| `@bendyline/molen-schema/schemas/*` | the emitted JSON Schema files (`scene.schema.json`, …) for editors and other languages |

Core kinds: `scene`, `prefab`, `command`, `keyframe`, `delta`, `replay`, `assert`, `project`,
`types`, `asset`. Capability packages register more (terrain, matgraph, figure, …).

## Status

0.x, and the formats are beta. A format is versioned in its own envelope and bumped rather than
migrated — `molen/scene@3` is the current scene — though `validate` still accepts any registered
older version, upgrades it in place, and returns a deprecation notice. Expect kinds and component
fields to be added, and the package API to move with the engine's single version line.

## Docs

- [Scene manifest](https://molen.dev/schemas/scene) — `molen/scene@3`, the format most documents are
- [Component vocabulary](https://molen.dev/schemas/components) — every component, with units and axis conventions
- [All formats](https://molen.dev/schemas/) — each with its JSON Schema and a valid example
- [API reference](https://molen.dev/api/schema/index)

MIT © Bendyline LLC
