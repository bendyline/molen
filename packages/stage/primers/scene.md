### Writing a Molen scene (molen/scene@3)

A Molen scene is one JSON document. Y is up, units are meters, and time is counted in ticks: with "tickRate": 30, 30 ticks are one second.

```json
{ "format": "molen/scene@3", "name": "short-name", "seed": "any-text", "tickRate": 30,
  "entities": [], "camera": { "mode": "fixed", "position": [0, 4, 12] } }
```

Each entity is `{ "id": "unique-id", "components": { ... } }`. Use only these components:

- `transform`: `{ "pos": [x, y, z] }`, the center of the object. Leave out rotation.
- `renderable` for a shape: `{ "kind": "primitive", "ref": "box" | "sphere" | "cylinder", "materialRef": "palette:#rrggbb", "primitive": { "size": [x, y, z] } }`. Size is in meters: box = width, height, depth; sphere = diameter in x; cylinder = diameter in x, height in y. A shape is centered on pos, so a box 2 m tall standing on the ground has pos y = 1. A floor is a thin box: size [40, 0.1, 40] at pos y = -0.05.
- `renderable` for a person or animal: `{ "kind": "figure" }` together with
  `figure`: `{ "preset": "human.adult" | "human.child" | "human.elder" | "dog" | "cat" | "horse" | "deer" | "cow" | "sheep", "palette": { "top": "#rrggbb", "bottom": "#rrggbb" } }`.
  A figure stands with its feet at pos (y = 0 on the ground). It walks or runs, and turns to face where it goes, on its own whenever it moves.
- `figureIntent` (optional, with a figure): `{ "mode": "sit" }`, or `{ "lookAt": { "entity": "other-id" } }` (it looks at their face).
- `path`, walking somewhere: `{ "points": [[x, y, z]], "speed": 1.3, "delay": 30 }`. It starts from where the entity stands, after `delay` ticks; `speed` is meters per second. Use `"ticks": 90` instead of `speed` to arrive in that time.
- `cues`, things that happen later, on one entity with id "director": `{ "cues": [ { "tick": 150, "do": [ { "figure": { "target": "#ana", "mode": "sit" } } ] } ] }`. An action can also be `{ "path": { "target": "#ben", "points": [[2, 0, 1]], "speed": 1.3 } }` or `{ "figure": { "target": "#ben", "lookAt": "#ana" } }`.
- `light`: `{ "type": "point", "color": "#ffdca8", "intensity": 2, "range": 12 }`.
- `environment`, on one entity with id "env" and no other components: `{ "preset": "evening", "shadows": "medium" }`. Presets: morning, noon, evening, night, overcast; every one is lit well enough to see.

Scene camera: `{ "mode": "fixed", "position": [x, y, z], "lookAt": [x, y, z] }`, or to follow an entity `{ "mode": "follow", "entity": "id", "offset": [0, 3, 8], "lookOffset": [0, 1, 0] }`.

A camera move goes in the same document as `cameraTrack`:

```json
{ "cameraTrack": { "easing": "smooth", "keyframes": [
  { "tick": 0, "position": [-6, 6, 16], "lookAt": [-4, 1, 3] },
  { "tick": 150, "position": [2, 2.2, 8], "lookAt": [0, 1.4, 3], "cut": true } ] } }
```

`"cut": true` jumps to that keyframe instead of moving to it.

Example scene: a person walks to a fountain where a friend waits, then sits down.

```json
{ "format": "molen/scene@3", "name": "plaza", "seed": "plaza-1", "tickRate": 30,
  "entities": [
    { "id": "env", "components": { "environment": { "preset": "noon", "shadows": "medium" } } },
    { "id": "ground", "components": { "transform": { "pos": [0, -0.05, 0] }, "renderable": { "kind": "primitive", "ref": "box", "materialRef": "palette:#b9b1a3", "primitive": { "size": [40, 0.1, 40] } } } },
    { "id": "fountain", "components": { "transform": { "pos": [0, 0.4, 0] }, "renderable": { "kind": "primitive", "ref": "cylinder", "materialRef": "palette:#8a8f99", "primitive": { "size": [3, 0.8, 3] } } } },
    { "id": "ana", "components": { "transform": { "pos": [-8, 0, 3] }, "renderable": { "kind": "figure" }, "figure": { "preset": "human.adult", "palette": { "top": "#c0392b", "bottom": "#2f2f38" } }, "path": { "points": [[-1.2, 0, 3]], "speed": 1.3 } } },
    { "id": "ben", "components": { "transform": { "pos": [1, 0, 3] }, "renderable": { "kind": "figure" }, "figure": { "preset": "human.adult", "palette": { "top": "#2e86de", "bottom": "#3d3d3d" } }, "figureIntent": { "lookAt": { "entity": "ana" } } } },
    { "id": "director", "components": { "cues": { "cues": [ { "tick": 210, "do": [ { "figure": { "target": "#ana", "mode": "sit" } } ] } ] } } }
  ],
  "camera": { "mode": "fixed", "position": [0, 4, 14], "lookAt": [0, 1, 2] } }
```

Reply with the JSON only, in ```json fences.
