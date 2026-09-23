# Authoring a capability package

Capabilities extend the engine without bloating the kernel. Two shipped packages are the
templates:

- **`@bendyline/molen-physics-rapier`** — a **kernel-only** plugin (no client half).
- **`@bendyline/molen-terrain`** — a **kernel + client** capability, split into subpath exports
  `@bendyline/molen-terrain/kernel` and `@bendyline/molen-terrain/client` (it has **no `.` export**).

## The pattern

1. **Pick your halves.** Pure simulation → kernel-only (like physics-rapier). Needs rendering →
   add a `/client` half that depends on `@bendyline/molen-client` (like terrain). Never let the
   kernel half import three.js or the DOM.

2. **Install onto a world.** Export an `install*(world, opts?)` that registers systems and (if
   stateful for snapshots) a snapshot provider. Give the system a name and unregister both in
   your `dispose()` (`world.removeSystem(name)`, `world.unregisterSnapshotProvider(name)`):

   ```ts
   export function installMyThing(world: World, opts?: MyOpts): void {
     world.addSystem((w, ctx) => { /* ... */ }, { phase: 'physics', name: 'my-thing' });
     // Opaque state that the legible ECS can't hold (solver warm-start, etc.):
     world.registerSnapshotProvider('my-thing', () => save(), (blob) => load(blob));
   }
   ```
   `installKinematics`, `installCharacterController`, and `installScripting` are concrete examples.

3. **Define components in `@bendyline/molen-schema`.** Register their data shape so `molen validate`
   and `molen components` know about them (and typos get did-you-mean):

   ```ts
   import { registerComponent } from '@bendyline/molen-schema';
   import { z } from 'zod';
   registerComponent('myBody', z.looseObject({ mass: z.number() }), {
     description: 'My rigid body.', owner: 'my-capability', examples: [{ mass: 1 }],
   });
   ```

4. **Register any file formats** with `registerSchema(kind, zod, meta)` — and add a
   `meta.validate(data)` for cross-field checks Zod can't express (cycles, dangling refs); see how
   `@bendyline/molen-materials` validates matgraph/pixelgrid.

5. **Keep determinism.** Kernel-side math goes through `dmath` (the `check-dmath` lint enforces it);
   route randomness through the world RNG. WASM stays behind an `await init()` and never enters the
   kernel core (it lives in the capability/tooling package — see physics-rapier).

6. **Reach scripts.** Export a `<thing>ScriptApi(handle): object` (a frozen bag of functions —
   see `rapierScriptApi`, `terrainScriptApi`) and hand it to `buildWorld` through the `physics` /
   `terrain` hooks or `scriptExtensions`; it appears as `molen.<name>.*` in every scene script.
   Tooling wires the built-in capabilities in `prepareSceneBuilder`; your own host does the same
   with `buildWorld(manifest, setup, { scriptExtensions: { mine: myScriptApi(handle) } })`.

7. **Ground and reads.** A capability that owns a height source registers it with
   `installTerrain(world, field)` (any object with `sampleHeight` + `normalAt`) so the character
   controller and kinematics find it. Component reads are frozen stored objects: compare
   references to detect change (`w.get(id, C) !== last`), never mutate them.

8. **Surface it to agents.** If you add an operation, put the logic in `@bendyline/molen-tooling`'s
   `src/ops/`, expose it on **both** the CLI and MCP server, and add an `OPS_CATALOG` entry so
   `molen describe` / `describe_op` document it. Add a guide here and link it from `llms.txt`.

## Conventions checklist

- Package name `@bendyline/molen-<thing>`; kernel/client halves as **subpath exports**, no `.`
  export if it has both halves.
- `isolatedDeclarations` on (every export explicitly typed); ESM-only; build with tsdown.
- Kernel halves run `node ../../scripts/check-dmath.mjs src` in their `lint` script.
- Ship a smoke test in each target environment for any WASM dep.
