# The headless agent dev loop

You can build and verify a complete experience with no human and no browser window, using only
the `molen` CLI (the MCP server exposes the same operations). Every step returns structured,
fixable text.

## 1. Author

Write a scene manifest as JSON. Minimal example (`scene.json`):

```json
{
  "format": "molen/scene@3",
  "name": "demo",
  "seed": "demo-1",
  "tickRate": 30,
  "entities": [
    { "id": "a", "components": {
      "transform": { "pos": [0, 0, 0], "rot": [0, 0, 0, 1] },
      "renderable": { "kind": "primitive", "ref": "box", "materialRef": "palette:#4363d8" }
    } }
  ]
}
```

Entities can also instantiate project-registry types (`"type": "train.locomotive"`) — see
[project.md](project.md). A scene that takes input declares its `commands` (optionally with a
JSON Schema payload) and an `input` block; scripts handle them with `molen.onCommand`.

Add game logic as **scene-data `scripts`** right in the manifest (deterministic, no
build step — see [scripting.md](scripting.md)); a **setup module** (`export function
setup(world, manifest) { … }` or a `defineExperience({...})` result) adds ECS systems in other
phases. With `"setup"` in project.json every op loads it automatically. The fastest start is `molen new <name>`, which scaffolds a full
project (project.json + scene + type registry + setup + `cmds.json`/`checks.json`). Ops accept
project scene names too: `molen sim run main --ticks 30`.

## 2. Validate (the inner loop — cheap, do it constantly)

```
molen validate scene.json
```

On failure you get the exact JSON Pointer, what was expected, what was found, and often a
did-you-mean. Fix and repeat until clean.

## 3. Simulate N ticks headlessly

```
molen sim run scene.json --ticks 300 --setup ./setup.mjs --hash
```

Runs the kernel in-process in Node (no Worker), printing the final tick, a deterministic state
hash, and the event count. The hash is identical across runs of the same build; how far it travels
across machines depends on which subsystems the scene uses, and the command prints the level for
the scene's physics engine on the last line. See [determinism.md](determinism.md).

## 4. Assert on world state

Author an assertion document (`checks.json`) and pass `--assert`:

```json
{ "format": "molen/assert@1", "assertions": [
  { "select": "has:renderable", "op": "count", "value": 1 },
  { "select": "#a .transform.pos[1]", "op": "approx", "value": 0, "tol": 0.01 }
] }
```

```
molen sim run scene.json --ticks 300 --setup ./setup.mjs --assert checks.json
```

Selectors: `#id`, `tag:name`, `has:component`, space-separated conjunction, and value paths
like `.health.hp` or `.transform.pos[1]`. The command exits non-zero if any assertion fails.

## 5. Screenshot (then look at it)

```
molen shot scene.json --ticks 300 --setup ./setup.mjs --camera 0,6,24 --look 0,0,0 --size 1280x720 --out shot.png
```

Renders one deterministic frame in headless Chromium and writes a PNG plus a stats block
(entities rendered, draw calls, triangles). The stats alone often tell you whether the scene is
right; read the PNG when you need to judge appearance.

## 6. PLAY it (drive: commands in, frames out)

```
molen drive scene.json --actions actions.json --out-dir shots/ --assert checks.json
```

`actions.json` is a tick-ordered array: `[{ "at": 0, "screenshot": "start" },
{ "at": 1, "command": { "type": "move", "payload": { "dir": [1, 0] } } },
{ "at": 60, "screenshot": "after" }]`. One deterministic pass: same seed + same actions =
identical frames and hash, so a played session doubles as a scenario regression test. Over MCP
(`drive_scene`) the frames come back as **images** — look at what you did. Assets get the same
treatment: `molen asset shot <id> --out-dir d` renders turntable angles of an imported model
(`screenshot_asset` over MCP), and `molen types test` smoke-tests every registry type
standalone (validates, spawns, simulates).

## 7. Iterate

Edit the JSON or setup module and go back to step 2 — or keep
`molen sim watch scene.json --ticks 300 --assert checks.json` running: it reruns on every file
change and reports what moved (hash flip, event delta, assertion transitions). The same
commands run in CI, so local green equals CI green.

For full browser experiences whose behavior includes pointer input, wall-clock rendering, or
streamed content, use `molen play` after the headless checks. Its declarative scenario holds keys,
drags the render surface, waits for visible telemetry to settle, and emits screenshots plus a run
manifest. See [experience-playback.md](experience-playback.md).

## Debugging determinism

Determinism is the engine's headline guarantee, and it has its own feedback surface. The contract
itself — what reproduces at which level, what breaks it, and what is not promised — is in
[determinism.md](determinism.md). To debug a specific run, record a `*.replay.json` fixture
(scene + command log), then:

```
molen replay demo.replay.json --setup ./setup.mjs            # ✓ matches, or localizes divergence
molen replay demo.replay.json --setup ./setup.mjs --record   # (re)record expected hashes
```

On a mismatch you don't get "hash differs" — you get one of:

- **non-deterministic**: "state first diverges at tick N" with a component-level diff. Cause is
  almost always `Math.random`, `Date`/`performance`, or Set/Map iteration order in your code.
  Route randomness through `molen.rng` / the world RNG and math through `molen.math` (dmath).
- **behavior-drift**: the build is deterministic but differs from the recording (an intentional
  engine/content change, or a regression). Re-record with `--record` if intended.

`molen diff a.keyframe.json b.keyframe.json` gives a component-level diff between two snapshots.


## Checkpoints and continuation hashes

Keyframes now include `entityOrder` and `commands` (accepted future commands, source sequence
cursors, and late-command policy). Older keyframes without these optional fields still parse:
order falls back to object keys and the command queue is empty. Restore into the same
`STATE_FORMAT` and tick rate, with the same systems, type vocabulary, script ids, and plugin
providers. The package version is metadata that rides along in the keyframe and is never compared,
so an upgrade that did not change simulation semantics keeps your keyframes and recorded replays
valid — see [Upgrades and save files](determinism.md#upgrades-and-save-files). See
[scripting](scripting.md#state-that-survives-saveload-and-replay) for script state requirements.

`stateHash` version 2 covers entity creation order, tick rate, queued commands and deduplication,
RNG, allocator, components, and plugin snapshots, including physics state. Equal hashes assume
identical systems and host configuration. Re-record replay expectations with
`molen replay <fixture> --record` whenever `STATE_FORMAT` is bumped or the behaviour changes on
purpose; pinned hashes intentionally differ then. A changed future command can now diverge
immediately, before its effect becomes visible. `molen diff` reports continuation differences under
the reserved `$world` pseudo-entity as well as ordinary component differences.

`molen replay` uses the surrounding project's `setup` by default, just like simulation and
capture; an explicit `--setup` overrides it. The installed tooling package includes the guide
bundle, so `molen docs search` works from projects outside the engine checkout.
