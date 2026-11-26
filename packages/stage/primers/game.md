### Writing a Molen game (molen/game@1)

A game is one JSON document. You choose the pieces and how many of each, pick a layout, and say how to win and lose. Molen draws a level the player can finish and builds the 3D scene, the controls (arrow keys or WASD, Space to jump, R to play again), the camera, the score and lives display, and the rules for each kind of piece.

```json
{ "format": "molen/game@1", "name": "Title", "kind": "top-down", "layout": "garden",
  "pieces": { "P": { "role": "player" }, "o": { "role": "pickup", "count": 3 } },
  "win": { "collect": "all" }, "lose": { "lives": 3 } }
```

- `kind`: "top-down" (seen from above) or "platformer" (seen from the side; the player runs left to right, jumps and falls).
- `layout`: the level Molen draws. Top-down: "garden" (open ground with a few hedges), "maze" (narrow corridors), "arena" (an open walled square). Platformer: "level" (ground with gaps to jump over).
  To adjust it, give an object instead: `{ "archetype": "maze", "size": "large", "loops": "many", "corridors": "wide", "seed": "b" }`. Every field but `archetype` is optional:
  - garden: `hedges` few, some or many
  - maze: `loops` none, few or many; `corridors` narrow or wide
  - arena: `pillars` none, few or many
  - level: `gaps` few, some or many; `hills` flat, rolling or steep; `ledges` none, some or many
  - any: `size` small, medium, large or `[columns, rows]`; `seed` any word, for a different level with the same choices.
- `size` (optional): "small", "medium" (the default) or "large".
- `look`: morning, noon, evening, night or overcast.
- `pieces`: one character each. Each piece has a `role`:
  - `player` (there is always exactly one),
  - `pickup` (collected by touching it; `points` optional), `goal` (touching it can win),
  - `key` (touching it opens every `door`), `door` (Molen puts it in front of the goal, and the key somewhere else),
  - `hazard` (touching it costs a life; the player starts again where they began; in a level, falling into a gap does too),
  - `wall` (only to choose the walls' color; the layout makes the walls).
  `count`: how many Molen places (default 1). Optional: `figure` (human.adult, human.child, human.elder, dog, cat, horse, deer, cow, sheep) or `shape` (box, sphere, cylinder), `color` "#rrggbb", `speed` (meters per second).
  Hazards can `move`: "still" (default), "patrol" (back and forth), "chase" (follows the player) or "wander".
- `win`: any of `"collect": "all"` (every pickup), `"reach": "goal"`, `"survive": seconds`. With both collect and reach, the goal counts only after every pickup is taken.
- `lose`: `{ "lives": n }`.
- `spawn` (optional): `[ { "piece": "e", "every": seconds, "max": n } ]` keeps adding that piece at the edges.
- `text` (optional): `{ "title": "...", "win": "...", "lose": "..." }`.
- `map` (optional, instead of `layout`): draw the level yourself as rows of characters, "." for empty floor.

Example: Lantern Run. Reach the lantern while two moths wander the dark garden.

```json
{ "format": "molen/game@1", "name": "Lantern Run", "kind": "top-down", "layout": "garden", "size": "small", "look": "night",
  "pieces": {
    "P": { "role": "player", "figure": "human.child", "speed": 5 },
    "#": { "role": "wall", "color": "#4a4e69" },
    "m": { "role": "hazard", "shape": "sphere", "color": "#c9ada7", "move": "wander", "speed": 2, "count": 2 },
    "L": { "role": "goal", "color": "#ffd166" } },
  "win": { "reach": "goal" }, "lose": { "lives": 2 },
  "text": { "title": "Lantern Run", "win": "You found the light.", "lose": "The moths got you." } }
```

Reply with the JSON only, in ```json fences.
