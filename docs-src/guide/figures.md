# Figures: humans, bipeds and quadrupeds

`@bendyline/molen-figures` renders stylized people and animals and moves them: a **kernel half**
(`/kernel`: descriptors and presets, canonical rigs and sockets, deterministic gait and pose
evaluation, locomotion state, attachments) and a **client half** (`/client`: the `figure`
renderable kind that generates a skinned body from the descriptor and poses it every frame).
Two host-side subpaths sit beside them: `/look`, a player's or character's look as named
catalogue options, and `/designer`, the pieces of a character designer with a turntable preview
(see [Figure looks and the character designer](figure-looks.md)).
Humans use modeled facial relief (jaw, cheeks, nose, lips, eyelids and ears), shaped palms
and fingers, fitted clothing with collars, pockets and buttons, and rounded shoes. The
target is the readable polygonal realism of early open-world games. Surfaces share one
vertex-color material; no external texture downloads are required. See the figure rules in
[3D art guidelines](3d-art-guidelines.md).

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
| `proportions` | multipliers: `legRatio`, `armRatio`, `torsoRatio`, `headScale`, `neckLength`, `neckPitch`, `shoulderWidth`, `hipWidth`, `bodyLength`, `tailLength`, `earSize`, `snoutLength`; humans also `waist` (0.7–1.3), `bust` (0–1.5, else the body form's), `belly` (0–1) and `seat` (hip, seat and thigh fullness, 0.8–1.3) |
| `features` | `form`, `hair`, `hairTexture`, `facialHair`, `hands`, `sleeves`, `legs`, `top`, `footwear`, the [accessories](#accessories) (`headwear`, `eyewear`, `neckwear`, `backwear`, `earwear`, `wristwear`, `bag`), `tail`, `ears`, `horns`, `feet`, `mane` (see [Appearance](#appearance)) |
| `palette` | `#rrggbb`: `skin` (fur/hide for animals), `hair`, `eyes`, `top`, `bottom`, `shoes`, `accent`, `markings`, `outer` (a jacket or coat; absent: `top`), and one per accessory under its name |
| `head` | humans: a head `preset` (`01`–`12`) and/or shape parameters (see [Heads](#heads)) |
| `seed` | detail jitter only (symmetry-safe) |

Every rig stands with its feet at y = 0 and its reference point exactly at `height`, whatever
the overrides. Bodies come in three detail tiers. The default human uses roughly 7,500 triangles
near, 2,200 at medium distance and 1,100 for the rigid distant tier; the most detailed styling
(locs or braids, a beard, a coat or hoodie over a skirt, sandals) stays within 9,000, 2,600 and
1,200, and with every accessory worn at once within 9,700, 3,000 and 1,300. The six animal
presets use about 4,100–6,500 near,
2,100–2,900 medium and 1,100–1,500 distant triangles. The client
picks a tier by camera distance unless `lod` pins one. Near humans include separate fingers
with the default `hands: "fingers"`; `hands: "mitten"` keeps a joined finger silhouette. Medium
and distant hands merge the fingers while retaining the thumb. Facial details and clothing
use the canonical joint hierarchy, so gait, IK and attachment APIs are unchanged. The biped
rest pose holds the arms five degrees from vertical; idle adds a slight elbow bend, leaving
the hands beside the thighs. Idle rotates each forearm along the elbow-to-wrist axis so the
back of the hand angles forward, with small wrist flexion and gently curled fingers. Walking,
running and sitting use smaller forearm rotations. The rigid distant mesh retains the resting
hand orientation; fingers remain a fixed curved shape on the hand joint. Shared shoulder vertices and blended skin weights connect the
torso to the sleeves without separate shoulder caps.

Human proportions follow adult anthropometric means, as fractions of `height`: the head is 0.13
(about 7.5 heads tall), the chin sits at 0.87 and the shoulder joints at 0.80, 0.2 apart. The
neck is about 0.072 across and leaves the shoulders on a slanted line: the notch at the front of
the collar sits at 0.83, the sides at 0.85 and the back at 0.865, about level with the chin, so
the neck shows a few centimeters in front and less behind. It sits toward the back of the
shoulders and leans forward to the skull. The chest is about 0.19 across and 0.135 deep, the
waist 0.17 across, and the outside of the arms about 0.27. The shoulder line falls steeply off
the neck, flattens over the shoulder joint and rounds into the upper arm. Children keep their
larger head.

### Appearance

| Feature | Values | Notes |
|---|---|---|
| `form` | `neutral`, `masculine`, `feminine` | Shoulder and hip width, waist, chest depth, neck and arm thickness, jaw, brow and lips. Feminine adults have a bust and plain shirt fronts. Ignored by quadrupeds. |
| `hair` | `none`, `buzz`, `balding`, `cap`, `crop`, `bob`, `long`, `ponytail`, `bun`, `afro`, `shoulder`, `fade`, `mohawk`, `topknot`, `puffs`, `braids`, `rows`, `locs` | `cap` is the short default; `balding` keeps a fringe above and behind the ears; `long` falls down the back past the shoulder blades; `shoulder` stops at the shoulders; `fade` blends close sides into a fuller top; `mohawk` is a ridge over buzzed sides; `topknot` and `puffs` gather hair on the crown; `braids` hang down the back; `rows` are close braided rows; `locs` hang as rope-like locks. Braids show at near and medium detail, locks at near detail. |
| `hairTexture` | `straight` (default), `wavy`, `curly`, `coily` | Loose hair only: volume off the scalp, fuller ends on hanging lengths and a rougher silhouette near. Pulled-back styles (`buzz`, `ponytail`, `bun`, `braids`, `rows`, …) keep their shape; gathered ones (`bun`, `topknot`, `puffs`) swell a little. |
| `facialHair` | `none`, `stubble`, `mustache`, `beard` | Drawn in `palette.hair`. Adults and elders only. |
| `sleeves` | `none`, `short`, `long` | Sleeve length of any top. |
| `top` | `shirt` (default), `tee`, `tank`, `polo`, `sweater`, `hoodie`, `jacket`, `coat`, `dress` | See [Garments](#garments). |
| `legs` | `shorts`, `long`, `skirt`, `slim`, `wide`, `cropped` | A knee-length skirt in `palette.bottom` over bare legs. It sways with the stride; seated, it follows the thighs. `slim` trousers taper below the knee, `wide` ones flare to the ankle, `cropped` ones end at mid-calf. |
| `footwear` | `shoe` (default), `sneaker`, `boot`, `sandal` | In `palette.shoes`. Sneakers have a thick pale sole; boots a darker sole and a shaft up the shin, over trousers or a bare leg; sandals a sole and straps under the bare foot (a band of color below near detail). |

Hair that falls past the neck (long hair, a ponytail, braids, locks) blends from the head joint
toward the chest, so it stays on the back when the head turns.

### Garments

A top is drawn by the same lofted torso, so garments never add a second body: each changes the
collar, the front, how loosely the torso and sleeves sit, and what hangs below the waist.

| `top` | Collar and front | Below the waist |
|---|---|---|
| `shirt` (default) | Collar band and points, buttoned placket, breast pockets (near, without a bust) | Tucked in over the belt |
| `tee`, `tank` | Crew neck (pair `tank` with `sleeves: "none"`) | Tucked in |
| `polo` | Collar points, a short placket | Tucked in |
| `sweater` | Crew neck, a little looser | A ribbed band over the belt |
| `hoodie` | A hood lying folded behind the neck, drawstrings and a front pouch (near) | A ribbed band |
| `jacket`, `coat` | Open in a V to the top button, showing the shirt in `palette.top`; lapels near | To the hip, or to mid-thigh following the thighs |
| `dress` | Crew neck | A knee-length skirt in `palette.top` over bare legs, whatever `legs` says |

Jackets and coats color their torso and sleeves with `palette.outer`. Hems below the waist
continue the torso's own bottom ring and follow the thighs like the skirt, so they stay closed
over trousers and skirts on every body shape. Omitting `top` and `footwear` draws exactly the
bodies of earlier releases; naming `shoe` draws the same shoes.

### Accessories

Accessories are part of the same skinned mesh (the `gear` mesh group), each riding the joint it
sits on, and absent unless named. Each takes its color from the palette key of its own name,
with a default when that is absent.

| Feature | Values | Notes |
|---|---|---|
| `headwear` | `cap`, `beanie`, `sunhat` | The hair tucks under the band, whatever the style: below it the hair shows as usual, above it only the hat; a topknot or puffs hide under the hat and a bun sits low at the nape. |
| `eyewear` | `glasses`, `sunglasses` | Frames in `palette.eyewear`, the arms over the ears. Far off only sunglasses show. |
| `neckwear` | `scarf` | A roll round the neck (over a hood too) with one end down the chest. |
| `backwear` | `backpack` | Straps over the shoulders onto the chest. Long hair and braids fall over the pack. |
| `earwear` | `headphones` | Cups over the hair at the ears and a band over the crown, clear of the hair and any hat. Under a sun hat's brim the band is left out. |
| `wristwear` | `watch` | On the left wrist, over a long sleeve; near and medium detail. |
| `bag` | `crossbody` | At the right hip, the strap across the chest and back over the left shoulder. |

Without accessories a body is unchanged, byte for byte.

### Heads

Without a `head`, a human face follows its body form (a squarer jaw and stronger brow, or a
narrower jaw and fuller lips), as it always has. A `head` sets the face itself, independent of the
body form, from fourteen parameters, each -1 to 1 with 0 the reference head: `faceWidth`, `jaw`,
`chin`, `cheeks`, `cheekbones`, `brow`, `noseBridge`, `noseWidth`, `noseTip`, `eyeSpacing`,
`eyeSize`, `eyeTilt`, `lips` and `crown`. A head `preset` (`01`–`12`) starts from one of twelve
shapes, and parameters given beside it override it:

```json
{ "preset": "human.adult", "head": { "preset": "05", "lips": 0.2 } }
```

`01` is the reference head. The others spread over the parameters so that no two move together (a
broad nose does not come with full lips); they are numbered, not named, because they are shapes,
not people. A head changes only where vertices sit, so every head has the same triangle count.

### Seated riders

A rider whose legs are too short for a cycle's pedals or footrests slides forward and down the
saddle until they reach. The slide is fitted once, from every pedal position, so it does not
change through a revolution, and a rider who already reaches stays where the saddle puts them.
`cycleRiderPose` reports the contacts as `riding.reach`. Hands keep to the grips through the IK
alone: very short riders (about 1.5 m) can leave a grip at full steering lock.

Quadrupeds have species-shaped ribcages, tucked or full bellies, muscular shoulders and haunches,
and shaped joints. Dogs and cats have rounded paws with separate near/medium toes; horses have
single hooves, while cows, deer and sheep have split hooves. Continuous skull/muzzle surfaces,
eyelids, nostrils, lips and cupped ears replace the primitive heads. Cats have forward-facing eyes
and near-tier whiskers; horses have a crest mane and hanging hair tail; cows have surface coat
patches and a tufted tail; deer have branching antlers; sheep have a lightly rippled fleece.
Palette and feature overrides still apply. The same 27-joint hierarchy drives all animal tiers;
the distant tier is rigid and removes the small facial, toe and hair details. Animal proportions
give the torso depth while keeping the withers at `height` and soles at ground level. Heads are
carried above the withers on necks that turn into the skull's own axis, so the crest arches into
the poll and the throat curves under the jaw. Head width and depth are set per species (a horse's
head is about 0.4 of its length across, a cat's nearly as wide as long), and horses and deer stand
on slim cannon bones below heavier forearms.

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

Pedestrians in [ambient life](ambient-life.md) are figures moved this way: the ambient kernel
writes their transform along footways and `speedSource: 'transform'` animates the gait. The Earth
view, whose world steps on the main thread without the figures systems, poses its pedestrians,
[actors](earth-view.md#actors-companions-and-npcs) and the walker's avatar client-side with the
same `evaluatePose` from `@bendyline/molen-figures/client` (sitting in vehicle seats with the `eye`
anchor, and turning heads with `worldToFigure` look targets). Cycle drivers use a `pelvis`
anchor and `cycleRiderPose(vehicle, state, seat)` to reach the handlebars and pedals; the kernel,
figure kind and Earth avatar share that contact solver.

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

- Fingers share the hand joint; individual finger articulation and facial expressions are not
  implemented. Hair is a solid modeled surface attached to the head, with no strand physics.
- Clothing and skin use palette colors, without scanned skin textures or cloth simulation.
- Foot planting on uneven ground and quadruped IK are not evaluated yet.
- Imported skinned glTF figures and `molen figure bake` (skinned GLB export) are later phases.
- Accessories follow kernel-evaluated sockets at tick rate; fast hand swings can lag a few
  centimeters between ticks.
