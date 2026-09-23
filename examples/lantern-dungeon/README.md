# The Lantern Vault

Recover a brass key, unlock the north gate, and claim the lantern. Sentinels pursue you when they have line of sight. Melee strikes use a seeded d6 + 3 damage roll, with a cooldown and one healing potion. This is a small original fantasy adventure, with first-person aiming and a complete inventory/objective loop.

![The Lantern Vault](preview.png)

## Play

From the repository root, after `pnpm install` (engine dependencies build automatically):

```sh
pnpm dev:dungeon
```

WASD: walk/strafe. Left/Right: turn. Click the view for mouse look; Esc releases it. Space: attack. E: interact. H: drink your potion. R: restart.

## Authoring map

- `scene.json`: validated prefabs, level entities, component schemas, command payloads, input bindings, camera, physics, and gameplay configuration.
- `scripts/game.ts`: the complete game rules, with persistent state in components / `molen.state` and `checkpoint: "state"`.
- `src/scene.ts` and `src/worker.ts`: the same `buildWorld` path used by the CLI; no game-specific setup module.
- `src/main.ts`: HUD and browser presentation. It reads mirrored state and sends commands. No Three.js imports or simulation mutations.
- `commands.json` + `checks.json`: a short reproducible headless smoke scenario.
- `test/playthrough.test.js`: a bounded agent that wins with **only player commands**, then restarts. It never teleports entities or grants inventory.

Movement and sight queries use the lightweight XZ collision layer. Eye height is a local-space `follow` camera offset; pointer movement only emits validated `look` commands. Combat, inventory, enemy AI, and the gate tween stay in the sandboxed script. Change objectives in script config and enemy geometry/collision in the `sentinel` prefab.

## Verify

From the repository root:

```sh
node packages/tooling/dist/cli.mjs validate examples/lantern-dungeon/scene.json
node packages/tooling/dist/cli.mjs sim run examples/lantern-dungeon/scene.json --ticks 90 --commands examples/lantern-dungeon/commands.json --assert examples/lantern-dungeon/checks.json --hash
node packages/tooling/dist/cli.mjs shot examples/lantern-dungeon/scene.json --ticks 3 --out .artifacts/lantern-dungeon.png
pnpm --filter @bendyline/molen-examples-lantern-dungeon test:unit
pnpm --filter @bendyline/molen-examples-lantern-dungeon test:golden
```

Build before tests when engine code changes. The browser test plays the actual built Worker app,
checks HUD/state and diagnostics, exercises restart and resizing, and writes screenshots under
`.artifacts/`. The game ships 28 original GLB models, embedded PBR stone textures, animated creatures and a
3D sword/lantern view. No API keys, external asset hosts or runtime generation are required.
The browser test also verifies that all 28 models load successfully.

## Dungeon art kit

[Browse all 28 assets](asset-src/CATALOG.md) or read the [source, prompts and regeneration guide](asset-src/README.md).
The collection includes six creature designs, eight architectural modules and fourteen props/items.
The knight, wraith and mossback retain the original combat rules; the other creatures dress side rooms.
Warm braziers, teal relic light, beveled stonework, ceiling ribs and named glTF clips all use the public
Molen scene/component APIs. `project.json` also exposes `gallery`, a staged scene containing the full kit.

The [shared asset and startup contract](../ASSETS.md) explains editing masters, checked-in
runtime files and deployment. `pnpm -r build` produces this game's `dist/`; its `preview` script
serves that build. Relative URLs support hosting the same build beneath a subdirectory.
