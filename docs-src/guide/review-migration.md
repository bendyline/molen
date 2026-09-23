# Engine review fixes: migration notes

The F01-F16 fixes tighten existing contracts and make browser, headless, and replay behavior
agree. No git history or golden images were rewritten as part of these changes.

- **Script language:** scene scripts are authored as `.ts` and type-erased at load (Node 22.13+
  for the loader; `molenScripts()` in Vite for browser hosts). `.js` scripts keep working, and
  inline `code` stays JavaScript. Run `molen types gen` to write the declarations a script is
  checked against, then `molen scripts check`.
- **Script global:** the injected verb set is `molen`, not `api` — `molen.on`, `molen.get`,
  `molen.patch`. No alias is kept: referencing `api` throws and the error names the rename.
- **New projects:** `molen new` now resolves the generated type registry in its browser Worker.
  Existing projects should import and pass their resolved types to `buildWorld(manifest, setup,
  { types })`; see the generated `src/scene.ts` and `src/worker.ts` for the complete pattern.
- **Script state:** put durable values in `molen.state` or components and declare `checkpoint:
  "state"`; see [scripting](scripting.md). Arbitrary JavaScript closures are not serializable.
- **Validation:** custom vocabularies are scoped. Do not rely on `validate` registering schemas
  globally. Unsupported schemas and built-in overrides fail. Invalid final prefab/type merges
  and invalid script patches also fail; fix the reported pointer before running the scene.
- **Commands:** scripts attach handlers only to declared commands. Add missing declarations to
  `scene.commands` (or `world.declareCommand` before programmatic `installScripting`).
- **Replay:** queued commands, entity order, and plugin state participate in hashes. Re-record
  old expectations after upgrading; `$world` diff entries identify continuation metadata.
- **Animation:** live rendering and capture use simulation ticks. Speed and loop mapping apply
  once. To pause, write `animation: { ...previous, paused: true, pausedAtTick: molen.tick }`; to
  resume continuously, clear `paused` and advance `startTick` by the paused duration. If
  `pausedAtTick` is omitted, a paused clip holds its start pose. Unrelated renderable updates
  preserve playback, and late-loaded assets acquire the current pose immediately.
- **Character movement:** an entity with `character`, `kinematicBody`, and a circle `collider`
  uses one collision solver for displacement, sliding, and vertical movement. Character intent
  runs before kinematics, with ground reconciliation afterward. A character without a
  kinematic body retains its simple ground-only mover. Systems accept `priority` within their
  phase (lower first, equal priorities preserve registration order); character preparation uses
  -100 and ground reconciliation uses 100.
- **Physics scale:** Rapier colliders now apply positive uniform `transform.scale`, including
  offsets, asset geometry, and heightfields. Changing scale rebuilds the collider while keeping
  the rigid body and velocity. Nonuniform, zero, or negative physical scales fail with a
  diagnostic; bake them into collision geometry. Pure visual entities still support per-axis
  scale. This first implementation intentionally requires uniform scale for all physical shapes.
- **Terrain rays:** the final partial segment is bisected, including rays shorter than one
  march step. Hit points lie on the ray and agree with reported distances. Invalid inputs and
  exhausted `maxRaySteps` budgets throw rather than returning a false miss or skipping unchecked
  terrain. Ray marching is still sampled: choose a step appropriate to terrain feature size.

The generated-project browser test is part of `test:golden`, so CI exercises a real Worker,
entity creation, and keyboard input in addition to the CLI smoke loop.
