### Writing a Molen film (molen/film@1)

A film is one JSON document. You choose the look, the set, the cast, what they do and when, and the shots. Molen works out positions, walking, framing and light. Ground positions are `[x, z]` in meters: x is left to right, z is toward the camera. Times are in seconds.

```json
{ "format": "molen/film@1", "name": "Title", "look": "noon", "length": 8,
  "set": { "ground": "grass", "props": [] },
  "marks": { "spot": [0, 0] },
  "cast": [], "beats": [], "shots": [] }
```

- `look`: morning, noon, evening, night or overcast. Every look is lit well enough to see.
- `length` (optional): seconds. Add `"loop": true` to repeat the film forever.
- `set.ground`: grass, plaza, sand, street, wood, snow, dirt or water.
- `set.props`: things in the scene, each `{ "id": "unique-name", "shape": ..., "at": place, "on": "other-prop-id", "size": [w, h, d], "color": "#rrggbb" }`. Only `id` and `shape` are required.
  Shapes: tree, bench, lamp (gives light), table, tower, hill, flag, fountain, house, stall, fence, car, rock, ball, box, sphere, cylinder. Each shape has a sensible size; give `size` only to change it.
  `on` stands a prop on top of another one: a ball on a table, a tower on a hill, a flag on a tower.
- `marks`: named spots, so beats and cast can say `"at": "door"` instead of numbers.
- A place is a mark name, the id of a prop or cast member (next to it), or `[x, z]`.
- `cast`: people and animals, each `{ "id": "name", "preset": ..., "at": place, "colors": { "top": "#rrggbb", "bottom": "#rrggbb" } }`.
  Presets: human.adult, human.child, human.elder, dog, cat, horse, deer, cow, sheep.
- `beats`: what happens, each `{ "at": seconds, "who": id, "do": ..., "target": place, "seconds": duration }`.
  - `walk-to` / `run-to` a place. Walking to a person or a prop stops a step short and faces them.
  - `move-to` / `roll-to`: a prop slides or rolls to a place.
  - `sit` (on the ground, or `"target"` a bench), `stand`, `look-at` a target.
  `seconds` is optional; without it Molen uses a natural speed.
- `shots`: the camera, each `{ "at": seconds, "kind": ..., "on": id or [ids] }`. A new shot is a cut.
  Kinds: wide, establishing, medium, close, push-in, pull-out, orbit, follow, over-the-shoulder (`on`: [from-whom, at-whom]).
  Molen frames every shot on its subjects; you never place the camera.
- `captions` (optional): words on screen, each `{ "at": seconds, "seconds": 3, "text": "..." }`.

Example: a farmer leads a horse to the barn while a cat watches.

```json
{ "format": "molen/film@1", "name": "To the barn", "look": "morning",
  "set": { "ground": "dirt", "props": [
    { "id": "barn", "shape": "house", "at": [6, -6], "color": "#9c3b2a" },
    { "id": "fence", "shape": "fence", "at": [-4, -3] },
    { "id": "post", "shape": "box", "at": "fence", "size": [0.3, 1.2, 0.3] } ] },
  "marks": { "gate": [-6, 3] },
  "cast": [
    { "id": "farmer", "preset": "human.elder", "colors": { "top": "#6b8e23" }, "at": "gate" },
    { "id": "horse", "preset": "horse", "at": [-8, 4] },
    { "id": "cat", "preset": "cat", "at": "post" } ],
  "beats": [
    { "at": 0, "who": "farmer", "do": "walk-to", "target": "barn" },
    { "at": 0.5, "who": "horse", "do": "walk-to", "target": "farmer" },
    { "at": 0, "who": "cat", "do": "look-at", "target": "horse" },
    { "at": 9, "who": "farmer", "do": "look-at", "target": "horse" } ],
  "shots": [
    { "at": 0, "kind": "establishing", "on": ["farmer", "horse", "barn"] },
    { "at": 4, "kind": "follow", "on": "horse" },
    { "at": 9, "kind": "close", "on": "farmer" } ],
  "captions": [ { "at": 0.5, "seconds": 3, "text": "Early, before the rain." } ] }
```

Reply with the JSON only, in ```json fences.
