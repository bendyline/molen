# 03 — Data Format Specs

Draft schemas for every wire and file format. Source of truth at implementation time is Zod
in `@bendyline/molen-schema` with JSON Schemas generated at build
([07-tooling-and-testing.md §2](07-tooling-and-testing.md)); the drafts below are normative
for shape and semantics. Conventions shared by all formats:

- Every document carries a `format` envelope: `"molen/<kind>@<int>"`. Integer version,
  breaking-change bump, hard descriptive mismatch errors. No silent migration pre-1.0.
- All vectors are arrays: `Vec3 = [x,y,z]`, `Quat = [x,y,z,w]`. Colors are `"#rrggbb"` or
  `"#rrggbbaa"` strings.
- Entity IDs are strings: runtime-spawned `"e<seq>"`, or authored names (`"player"`) which
  must not match `/^e\d+$/` (validator-enforced).
- Validation failures must say what's wrong, where (JSON Pointer), and what valid looks like
  — error formatter spec in [07 §2.2](07-tooling-and-testing.md).

## 1. Scene manifest — `molen/scene@1`

The root document an experience boots from. Instantiates into ECS state.

```jsonc
{
  "format": "molen/scene@1",
  "name": "arena",
  "seed": "arena-demo-1",            // world RNG seed (string or number)
  "tickRate": 30,                    // immutable for the world's lifetime
  "lateCommands": "rewrite",         // "rewrite" | "reject" (04 §3.3)
  "keyframeInterval": 60,            // ticks between keyframes

  "prefabs": {                       // inline, or "$ref": "prefabs/goblin.prefab.json"
    "goblin": {
      "components": {
        "transform":  { "pos": [0, 0, 0], "rot": [0, 0, 0, 1] },
        "health":     { "hp": 10 },
        "renderable": { "kind": "gltf", "ref": "models/goblin.glb",
                        "materialRef": "materials/goblin.pixelgrid.json" },
        "collider":   { "shape": "circle", "radius": 0.4, "layer": 1, "mask": 1 }
      }
    }
  },

  "entities": [                      // instantiated at tick 0, in order
    { "id": "player", "prefab": "goblin",
      "overrides": { "transform": { "pos": [5, 0, 5] }, "health": { "hp": 100 } } },
    { "id": "gate-west", "components": { "transform": { "pos": [-20, 0, 0] } } }
  ],

  "scripts": [                       // sandboxed game logic, manifest order = registration order
    { "id": "spawner", "src": "scripts/spawner.js", "config": { "interval": 30 } }
  ],

  "terrain": { "$ref": "terrain/island.terrain.json" },   // optional, capability-owned

  "camera": { "mode": "free-fly", "start": { "pos": [0, 50, 80], "lookAt": [0, 0, 0] } },

  "input": {                         // client-side bindings → named actions
    "bindings": { "KeyW": "move.forward", "KeyS": "move.back", "Mouse0": "select" }
  }
}
```

**Prefab** (`molen/prefab@1` when standalone): `{ "format", "components": { <name>: <data> } }`.
Components are pure JSON data. Unknown component names are allowed (stored raw; only systems
that reference them need handles) — agents can invent components freely.

## 2. Command envelope — `molen/command@1`

```jsonc
{
  "kind": "command",
  "seq": 17,             // per-source monotonic; dedupe + total ordering
  "source": "local",     // peer/agent id; "local" single-player, "agent:test-1" from tooling
  "tick": 1234,          // requested execution tick (client-stamped)
  "type": "move-order",  // must have a registered handler + schema
  "payload": { "entity": "unit-7", "to": [12, 0, 44] }
}
```

Semantics: schema-validated on receipt (invalid → `command-rejected` event carrying
`(source, seq)` + formatted error; never queued, so replay logs contain only valid commands);
executed at the start of the target tick sorted by `(source, seq)`; late commands re-stamped
per the world's `lateCommands` policy with `tickExecuted` recorded
([04 §3](04-kernel-design.md)).

**Event** (kernel-emitted, appears in deltas and the event log):
`{ "type": "unit-died", "payload": { ... } }`. Reserved types: `command-rejected`,
`tick-overrun`, `collision`, `terrain.residencyAck`.

## 3. Keyframe — `molen/keyframe@1`

A keyframe **is** the save-file format, the replay seek index entry, and the snapshot-viewer
input. Entity-major layout (what humans and agents want to read).

```jsonc
{
  "kind": "keyframe",
  "v": 1,
  "engine": "0.3.0",
  "tick": 1230,
  "tickRate": 30,
  "seed": "arena-demo-1",
  "nextEntitySeq": 43,                       // entity-ID counter is snapshot state
  "rng": { "algo": "sfc32", "state": [738291, 102, 99182, 4] },
  "entities": {
    "player": { "transform": { "pos": [0,1,0], "rot": [0,0,0,1] }, "health": { "hp": 80 } },
    "e42":    { "transform": { "pos": [9,0,3], "rot": [0,0,0,1] }, "lifetime": { "ticksLeft": 12 } }
  },
  "plugins": {                               // opaque per-plugin blobs (e.g. Rapier, 04 §7)
    "rapier": { "version": "0.14.0", "blob": "<base64>" }
  }
}
```

## 4. Delta — `molen/delta@1`

Produced every tick via write-API dirty tracking; whole-component replacement granularity
(rationale in [04 §4.3](04-kernel-design.md)).

```jsonc
{
  "kind": "delta",
  "v": 1,
  "tick": 1234,
  "baseTick": 1233,
  "spawned":   { "e43": { "transform": { "pos": [1,0,1], "rot": [0,0,0,1] } } },
  "destroyed": ["e17"],
  "changed":   { "player": { "transform": { "pos": [0.1,1,0], "rot": [0,0,0,1] } } },
  "removedComponents": { "e9": ["burning"] },
  "events": [ { "type": "unit-died", "payload": { "entity": "e17" } } ]
}
```

Invariant (property-tested): `applyDelta(delta(a→b), a) === b`. One shared `applyDelta`
implementation serves the client mirror store, replay scrubbing, and tests.

## 5. Replay fixture — `molen/replay@1`

Determinism makes `{initial keyframe, command log}` the complete, smallest replay artifact.

```jsonc
{
  "format": "molen/replay@1",
  "engine": "0.3.0",
  "scene": "scenes/arena.scene.json",        // or inline "initialKeyframe": { ... }
  "seed": "arena-demo-1",
  "ticks": 300,
  "commands": [
    { "kind": "command", "seq": 1, "source": "local", "tick": 45,
      "tickExecuted": 46, "type": "spawn-wave", "payload": { "count": 5 } }
  ],
  "expected": { "stateHash": "sha256:9f2c…", "eventCount": 112 }
}
```

Hashing: SHA-256 over canonical binary serialization — entities sorted by id, component keys
sorted lexicographically, numbers as raw IEEE-754 64-bit bits, strings UTF-8 length-prefixed
([07 §5.2](07-tooling-and-testing.md)). On mismatch the harness bisects to
`firstDivergentTick` with a component-level diff.

## 6. Assertion document — `molen/assert@1`

Used by `molen sim run --assert`, the MCP `run_simulation` tool, and Vitest via
`@bendyline/molen-kernel/testing`. Selector DSL: `#id` · `tag:name` · `has:component` · conjunction by
space · value paths `.health.hp`, `.transform.pos[1]`.

```jsonc
{
  "format": "molen/assert@1",
  "assertions": [
    { "select": "tag:player .transform.pos[1]", "op": "approx", "value": 0, "tol": 0.01 },
    { "select": "tag:enemy",                    "op": "count",  "value": 0 },
    { "select": "has:health .health.hp",        "op": "all_gte", "value": 1 },
    { "event": "player_died",                   "op": "never" },
    { "event": "wave_cleared",                  "op": "count", "value": 10 }
  ]
}
```

Ops: `eq, approx, gt, gte, lt, lte, count, exists, all_<op>, any_<op>`; event ops:
`occurred, never, count, at_tick`. Failures report selector, expected, actual, and matching
entity ids in the standard formatted-error style.

## 7. Pixel-grid texture — `molen/pixelgrid@1` (material rung 2)

```jsonc
{
  "format": "molen/pixelgrid@1",
  "size": [16, 16],                       // [w,h]; max 256×256
  "palette": {
    ".": "transparent",                   // or "#rrggbb"/"#rrggbbaa"; ≤64 entries
    "B": "#6b4a2b",                       // keys are single Unicode code points
    "b": "#8a6238",
    "X": "#3a2a18"
  },
  "rows": [                               // exactly h strings of exactly w code points
    "XXXXXXXXXXXXXXXX",
    "XBBBBBBbBBBBBBbX"
    // …
  ],
  "slots": { "baseColor": true, "emissive": false },
  "filter": "nearest"                     // default; "linear" allowed but discouraged
}
```

Rasterization rules (normative): 1 char = 1 texel; nearest mag/min filter; **mipmaps off**;
sRGB for baseColor, linear for masks; `transparent` ⇒ `alphaTest: 0.5` cutout. Validation
errors must quote row/column and the palette: *"row 7 has 15 chars, expected 16; char 'Q' at
row 3 col 9 not in palette — palette keys are: . B b X"*.

## 8. Procedural material graph — `molen/matgraph@1` (rung 4)

CPU-rasterized to textures in v1; nodes are pure per-UV functions
([06 §4](06-materials-and-assets.md) for the node vocabulary and determinism rules).

```jsonc
{
  "format": "molen/matgraph@1",
  "size": [512, 512],                      // default 512², cap 2048²
  "seed": 1337,                            // splitmix → per-node sub-seeds by node id
  "nodes": [
    { "id": "n1", "type": "noise", "params": { "kind": "simplex", "octaves": 5, "scale": 4 } },
    { "id": "n2", "type": "ramp",  "input": "n1",
      "params": { "stops": [ { "t": 0, "color": "#4a4a52" },
                             { "t": 0.6, "color": "#6e6a63" },
                             { "t": 1, "color": "#9a948a" } ] } },
    { "id": "n3", "type": "levels", "input": "n1", "params": { "gamma": 1.6 } },
    { "id": "n4", "type": "height-to-normal", "input": "n1", "params": { "strength": 0.8 } }
  ],
  "outputs": { "baseColor": "n2", "roughness": "n3", "normal": "n4" }
  // valid output slots: baseColor, roughness, metalness, normal, emissive, ao
}
```

Cycles are a validation error naming the path: *"node 'a' → 'b' → 'a' forms a cycle"*.

## 9. UV paint sidecar — `molen/uvpaint@1` (rung 5)

Pairs with the template PNG; pipeline in [06 §6](06-materials-and-assets.md).

```jsonc
{
  "format": "molen/uvpaint@1",
  "model": "models/scout.glb",
  "atlasSize": [1024, 1024],
  "texelDensity": 128,                       // px per meter, achieved average
  "islands": [
    {
      "id": 1,
      "label": "head",                        // from mesh/primitive names; agent may edit
      "color": "#e6194b",                     // island fill color in the template image
      "uvBBox": [0.02, 0.05, 0.31, 0.40],     // [u0,v0,u1,v1]
      "pixelBBox": [20, 51, 317, 410],
      "areaPx": 31204,
      "meshPrimitive": { "mesh": "Scout", "primitive": 0 },
      "notes": ""                             // agent-authored painting instructions
    }
  ],
  "paintedImage": "scout_painted.png",        // filled in for the import step
  "importRules": { "maskToIslands": true, "dilationPx": 8 }
}
```

## 10. Terrain descriptor — `molen/terrain@2`

Conventions and the kernel/client split in [05 §5](05-client-design.md).

```jsonc
{
  "format": "molen/terrain@2",
  "name": "highlands",
  "origin": [0, 0],                   // world XZ of tile (0,0) corner
  "chunkSize": 128,                   // meters
  "tileResolution": 129,              // height samples per chunk edge (shared borders)
  "gridSize": [16, 16],               // chunks in X,Z → 2048 m × 2048 m world
  "height": { "min": 0, "max": 400 },
  "tiles": {
    "heightUrl": "tiles/h_{x}_{z}.png",      // 16-bit grayscale PNG
    "splatUrl": "tiles/s_{x}_{z}.png"        // RGBA8 PNG, optional
  },
  "layers": [                          // splat channel meaning, R→A; blending rules included
    { "name": "grass", "materialRef": "materials/grass.matgraph.json", "tiling": 8 },
    { "name": "rock",  "materialRef": "materials/rock.matgraph.json",  "tiling": 6,
      "auto": { "slopeMin": 0.6 } },   // optional height/slope auto-banding (terrain-owned,
    { "name": "snow",  "materialRef": "materials/snow.matgraph.json",  "tiling": 4,
      "auto": { "heightMin": 300 } }   //  NOT matgraph nodes — graphs stay pure-UV)
  ],
  "lod": { "levels": 4, "distanceBands": [256, 512, 1024, 2048], "skirts": true },
  "streaming": {
    "loadRadius": 3,
    "unloadRadius": 4,
    "maxConcurrentLoads": 4,
    "maxResidentTiles": 96
  },
  "collision": { "enabled": false }    // Phase 1 flyover default; Phase 2 turns it on
}
```

Height decode (normative): `height = min + (u16 / 65535) * (max - min)`.
Version 1 uses the same fields without `streaming`; it auto-upgrades to version 2 defaults.

## 11. SVG sidecar — `molen/svgmeta@1` (rung 3, optional)

```jsonc
{ "format": "molen/svgmeta@1", "rasterSize": [512, 512], "slots": { "baseColor": true } }
```

Sizing priority: sidecar → SVG width/height attrs rounded up to power-of-two → 512² default.
`<text>` elements are rejected with the fix in the error: *"convert text to paths before
import (no fonts ship with the engine)"*.

## 12. Screenshot request — `molen/shot@1` (tooling contract)

```jsonc
{
  "scene": "scenes/flyover.scene.json",
  "ticks": 90,
  "seed": 42,
  "camera": { "position": [120, 80, 200], "lookAt": [0, 0, 0],
              "projection": { "kind": "perspective", "fovDeg": 60 } },
              // or { "kind": "ortho", "viewHeight": 50 }
  "size": [1280, 720]
}
```

Response: PNG (path or base64) + stats block
`{ tick, drawCalls, triangles, entitiesRendered, chunksResident, warnings[] }` — the stats
often let an agent skip vision entirely. Deterministic capture settings are forced
([05 §6](05-client-design.md)).
