# Figures: humans, bipeds and quadrupeds

`@bendyline/molen-figures` renders stylized people and animals and moves them: a **kernel half**
(`/kernel`: descriptors and presets, canonical rigs and sockets, deterministic gait and pose
evaluation, locomotion state, attachments) and a **client half** (`/client`: the `figure`
renderable kind that generates a skinned body from the descriptor and poses it every frame).
The look is deliberately left of the uncanny valley: readable silhouettes, color blocks for
clothing, disc eyes, no mouths or fingers, gently faceted surfaces (see the figure rules in
[3D art guidelines](3d-art-guidelines.md)).

Naming note: this is **not** `@bendyline/molen-kernel/kinematics` (the 2.5D collision layer) and
not `/character` (the gravity/jump mover). Figures sit on top of whatever moves an entity.

## Quick start

A human with a hat, walking under the character controller:

```json
{
  "format": "molen/scene@3",
  "name": "hello-figures",
  "tickRate": 60,
  "physics": { "engine": "kinematics", "character": true },
  "entities": [
    {
      "id": "npc-1",
      "components": {
        "transform": { "pos": [0, 0, 0], "rot": [0, 0, 0, 1] },
        "renderable": { "kind": "figure", "ref": "procedural" },
        "figure": { "preset": "human.adult", "height": 1.7, "palette": { "top": "#3b6ea5" } },
        "character": { "speed": 1.4, "jumpSpeed": 6, "gravity": 20, "vy": 0, "grounded": true },
        "moveIntent": { "dir": [1, 0], "jump": false },
        "collider": { "shape": "circle", "radius": 0.35, "layer": 1, "mask": 1 },
        "kinematicBody": { "vel": [0, 0, 0], "slide": true }
      }
    },
    {
      "id": "npc-1-hat",
      "components": {
        "transform": { "pos": [0, 0, 0], "rot": [0, 0, 0, 1] },
        "renderable": { "kind": "primitive", "ref": "cylinder", "materialRef": "palette:#39747d", "primitive": { "size": [0.3, 0.12, 0.3] } },
        "parent": { "id": "npc-1" },
        "figureAttachment": { "socket": "head.top", "offset": { "pos": [0, 0.06, 0] } }
      }
    }
  ]
}
```

`molen validate`, `molen sim run --ticks 120 --hash`, and `molen shot` work unchanged: tooling
installs the figures systems on every world, and the capture page renders the `figure` kind. In a
browser host, pass the kind to the client and the systems to the world:

```ts
import { mountExperience } from '@bendyline/molen-client';
import { figureKind } from '@bendyline/molen-figures/client';
await mountExperience({ link: worker, scene, canvas, kinds: [figureKind()] });

// worker.ts
import { buildWorld } from '@bendyline/molen-kernel';
import { figuresScriptApi, installFigures } from '@bendyline/molen-figures/kernel';
const world = buildWorld(scene, setup, {
  capabilities: [(w) => ({ figures: figuresScriptApi(installFigures(w)) })],
});
```

## Components

| Component | Owner | Purpose |
|---|---|---|
| `figure` | you | What the figure is: `preset` plus descriptor overrides, and how it faces (`facing`, `turnRate`, `speedSource`, `blendTicks`). |
| `figureIntent` | you (optional) | Control: a forced `mode`, a `lookAt` target, joint `overrides`, `ik` goals. |
| `figureState` | kernel | Locomotion state: `mode`, quantized `speed`, `strideRate`, tick-anchored `phaseAt`/`phaseAtTick`, `modeAtTick`, `prevMode`. Read it; never write it. |
| `figureAttachment` | you | On a child entity with `parent`: which `socket` to follow, an `offset`, and which `anchor` of the child sits on the socket. |

The renderable is `{ "kind": "figure", "ref": "procedural", "lod"?: "auto" | 0 | 1 | 2 }`.
`materialRef` is ignored for figures; colors come from the descriptor palette.

## Descriptor and presets

A descriptor is a preset plus overrides. `molen figure presets` lists them; `molen schema get
figure` prints the full shape (the `molen/figure@1` file format wraps the same fields with a
`format` envelope for `molen validate` and `molen figure preview`).

| Field | Meaning |
|---|---|
| `preset` | `human.adult`, `human.child`, `human.elder`, `dog`, `cat`, `horse`, `deer`, `cow`, `sheep` |
| `height` | meters; bipeds to the head top, quadrupeds to the withers |
| `build` | -1 (slight) to 1 (heavy): limb and torso radii, shoulder width |
| `age` | `child`, `adult`, `elder` (elder adds a stoop) |
| `proportions` | multipliers: `legRatio`, `armRatio`, `torsoRatio`, `headScale`, `neckLength`, `neckPitch`, `shoulderWidth`, `hipWidth`, `bodyLength`, `tailLength`, `earSize`, `snoutLength` |
| `features` | `hair` (none/cap/bob/long), `hands`, `sleeves`, `legs`, `tail`, `ears`, `horns`, `feet`, `mane` |
| `palette` | `#rrggbb`: `skin` (fur/hide for animals), `hair`, `eyes`, `top`, `bottom`, `shoes`, `accent`, `markings` |
| `seed` | detail jitter only (symmetry-safe) |

Every rig stands with its feet at y = 0 and its reference point exactly at `height`, whatever
the overrides. Bodies come in three detail tiers (near about 1,000 to 1,500 triangles, medium,
and a rigid distant tier); the client picks a tier by camera distance unless `lod` pins one.

## Locomotion

The `figures-locomotion` system (late phase, before the hierarchy) reads whatever moves the
entity: `kinematicBody.vel`, then `character` + `moveIntent`, `platformBody`, a rapier
`velocity`, else transform deltas (`speedSource: 'transform'` forces the last; `'none'` freezes
it). It picks a mode (`idle`, `walk`, `run`, `jump`, `fall`; `sit` when `mounted`), a
quadruped gait (walk, trot, gallop by Froude number), a stride rate from the leg length, and
turns the figure toward its velocity (`facing: 'velocity'`, the default) at `turnRate` rad/s.
`facing: 'manual'` leaves `transform.rot` to you (rapier-driven bodies, strafing).

State is written only when something changes: speed is quantized to 0.05 m/s, the gait phase is
anchored to a tick, so a steadily walking figure sends no deltas. `figureIntent.mode` forces a
mode; `lookAt` aims the head at a point or an entity.

## Sockets and attachments

Sockets are named points on the rig, evaluated under the current pose. An entity with
`parent: { id: <figure> }` and `figureAttachment: { socket }` gets its `localTransform` from the
socket each tick (the kernel hierarchy composes the world transform, and destroying the figure
cascades). Anything renders there: a glTF hat, a primitive, another figure.

| Biped sockets | Quadruped sockets |
|---|---|
| `head.top`, `face`, `eyes`, `eye`, `ear.l`, `ear.r`, `neck`, `chest`, `back`, `hip.l`, `hip.r`, `hand.l`, `hand.r`, `foot.l`, `foot.r`, `pelvis` | `head.top`, `face`, `eyes`, `eye`, `mouth`, `neck`, `withers`, `saddle`, `back`, `tail.tip`, `foot.fl`, `foot.fr`, `foot.hl`, `foot.hr`, `pelvis` |

`anchor` chooses which point of the attached entity sits on the socket: `origin` (default),
`pelvis`, or `eye` (for figures seated on saddles and vehicle seats). Riders use the vehicle
mount contract: `molen.figures.mount(rider, horse)` adds a `mountable` with a `saddle` seat and
seats the rider; the `figures-riders` system keeps the rider on the animated saddle.

## Scripting: `molen.figures.*`

`setMode(id, mode | null)`, `lookAt(id, { pos } | { entity } | null)`, `pose(id, overrides | null)`,
`ik(id, goals | null)`, `attach(itemId, figureId, socket, offset?, anchor?)`, `detach(itemId)`,
`mount(riderId, figureId, seat?)`, `dismount(riderId)`, `socket(figureId, name)` (world pose),
`setDescriptor(id, patch)`, `joints(id)`, `sockets(id)`, `presets()`.

## Previews

```sh
molen figure presets
molen figure preview --lineup all --angles review --mode walk --out review.png
molen figure preview my.figure.json --angles 4 --out turntable.png
```

The MCP tools `figure_preview` (returns images) and `list_figure_presets` mirror these. The
`review` view set is the art-guideline review: front, three-quarter, rear, and a gameplay-distance
view.

## Determinism

The pose is a pure function `evaluatePose(rig, figureState, tick)` shared by both halves: the
kernel evaluates it only where it needs a socket (attachments, riders, `molen.figures.socket`), the
client at every frame. `figureState` and the attachment `localTransform`s are ordinary hashed
components; rigs, meshes and poses are derived. The client keeps the previous state until the
interpolated render tick reaches the tick a state changed on, so poses and transforms agree.

## Limits

- Hands are mittens (a thumb on the near tier with `hands: 'fingers'`); no faces beyond eyes and
  brows.
- Foot planting on uneven ground and quadruped IK are not evaluated yet.
- Imported skinned glTF figures and `molen figure bake` (skinned GLB export) are later phases.
- Accessories follow kernel-evaluated sockets at tick rate; fast hand swings can lag a few
  centimeters between ticks.
