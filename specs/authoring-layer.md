# Authoring layer: films and games as data

## Summary

Two small authoring documents, `molen/film@1` and `molen/game@1`, that a language model can
write and that Molen compiles into an ordinary `molen/scene@3`. Behind them, the kernel gains
choreography and rules of play as data (cues, rules, paths, movers, triggers, a controller,
variables), so a compiled scene needs no scripts. A new package, `@bendyline/molen-stage`,
owns the two formats, their compilers, a lint, and short primers generated from the schemas.

## Problem

Molen's scene format is open enough to describe almost anything, and that is what makes it
hard for a small model. A probe in November 2026 (Gemma 4 12B, Qwen 3.5 4B, Gemma 4 26B)
measured it:

- With a 1,600-token primer, models write **valid** scenes nearly every time, and still
  **poor films**: walkers stop inside the person they walk to, flags sit inside towers,
  "evening" renders black, subjects fall outside the shot. A validator cannot see any of it.
- Anything timed needs a script: tweens start at tick 0, there is no path or delay, and no
  "at tick N do this".
- Games are worse. Rules of play (pickups, damage, score, spawning, enemies, winning and
  losing) exist only as scripts. Touch detection is distance checks in script. Score and
  lives on screen are page code. A 4B model asked for a scene plus rules script made **0 of
  12** playable games: five answers were not JSON (raw line breaks in the script string), most
  of the rest threw on their first tick and faulted the world for good.
- A model-written script runs with the host's authority, needs `eval` (no phones), and one
  thrown error stops the world.

Prototype compilers for a film document and a game document, emitting `scene@3`, changed
that on the same models and briefs:

| | Raw Molen | Document |
|---|---|---|
| Films: meetings where nobody collides (12B) | 0 of 3 | 3 of 3 |
| Films: frames with readable light (12B) | 9 of 12 | 12 of 12 |
| Games a bot can win and lose (4B) | 0 of 12 | 11 of 12 |
| Games a bot can win and lose (12B) | 5 of 12 | 12 of 12 |

The game result needed one reshaping: when the model drew its own text map, the 4B model
made 2 of 12 playable games and no model at any size drew a platformer a runner could
finish. Naming a **layout archetype** and letting code draw the level fixed both. The
prototypes used one fixed, hand-written rules script; this proposal replaces it with data.

## Desired behavior

### 1. The film document

```json
{ "format": "molen/film@1", "name": "The Meeting", "look": "evening", "length": 12,
  "set": { "ground": "plaza",
           "props": [ { "id": "fountain", "shape": "fountain", "at": "center" },
                      { "id": "bench", "shape": "bench", "at": [4, -3] } ] },
  "marks": { "west": [-8, 3], "east": [3, 3] },
  "cast": [
    { "id": "ana", "preset": "human.adult", "colors": { "top": "#c0392b" }, "at": "west" },
    { "id": "ben", "preset": "human.adult", "colors": { "top": "#2e86de" }, "at": "east" },
    { "id": "rex", "preset": "dog", "at": [5, -1] } ],
  "beats": [
    { "at": 0, "who": "ben", "do": "look-at", "target": "ana" },
    { "at": 1, "who": "ana", "do": "walk-to", "target": "ben", "seconds": 5 },
    { "at": 7, "who": "rex", "do": "sit" } ],
  "shots": [
    { "at": 0, "kind": "wide", "on": ["ana", "ben"] },
    { "at": 6, "kind": "close", "on": ["ana", "ben"] },
    { "at": 9, "kind": "push-in", "on": "rex" } ],
  "captions": [ { "at": 0.5, "seconds": 3, "text": "Saturday, nine o'clock." } ] }
```

Times are seconds, places are marks, prop or cast ids, or `[x, z]` ground points. There are no
rotations, ticks or heights. The compiler supplies what the probe showed models cannot:

- A prop placed at another prop stands on it (a flag on a tower) and stays on its footprint.
- Nobody starts or stops inside a prop. A walk stops a step short of the person it goes to
  and steps around anyone in the way. At the same moment, people sit and look before anyone
  walks toward them.
- Shot kinds (`wide`, `establishing`, `medium`, `close`, `push-in`, `pull-out`, `orbit`,
  `follow`, `over-the-shoulder`) become camera keyframes framed on the subjects' bounds; a new
  shot is a cut. A close shot on two people becomes a two-shot taken across the
  line between them. A shot of something moving follows it.
- `look` presets set sky, sun, ambient light and exposure so a frame is always readable.
- A figure looking at someone aims at their head. A floor is a thin box, never a plane.

### 2. The game document

```json
{ "format": "molen/game@1", "name": "Coin Garden", "kind": "top-down", "look": "noon",
  "layout": { "archetype": "garden", "size": "small", "hedges": "some" },
  "pieces": {
    "P": { "role": "player", "figure": "human.child", "speed": 5 },
    "o": { "role": "pickup", "shape": "sphere", "color": "#ffd166", "count": 5 },
    "x": { "role": "hazard", "figure": "dog", "move": "patrol", "speed": 2 } },
  "win": { "collect": "all" }, "lose": { "lives": 3 },
  "text": { "title": "Coin Garden", "win": "You made it!", "lose": "Try again." } }
```

- **`kind`**: `top-down` or `platformer`.
- **`layout`**: an archetype name, or an object that names one and customizes it. Archetypes
  for the first version: `garden` (open ground, hedges), `maze` (corridors), `arena` (open
  walled square), `level` (platformer ground with gaps). Knobs are words a small model can
  choose, and every one is optional:

  | Archetype | Knobs |
  |---|---|
  | all | `size` (`small`, `medium`, `large`, or `[columns, rows]`), `seed` (any string or number, for a different level with the same choices) |
  | `garden` | `hedges`: `few`, `some`, `many` |
  | `maze` | `loops`: `none`, `few`, `many`; `corridors`: `narrow`, `wide` |
  | `arena` | `pillars`: `none`, `few`, `many` |
  | `level` | `gaps`: `few`, `some`, `many`; `hills`: `flat`, `rolling`, `steep`; `ledges`: `none`, `some`, `many` |

  A stronger model may instead draw a text `map` (one character per cell, as in the pieces);
  a drawn map is checked, never repaired.
- **`pieces`**: one character each, with a `role` (`player`, `wall`, `pickup`, `goal`, `key`,
  `door`, `hazard`), a `count` for generated layouts, and optional `figure` or `shape`,
  `color`, `speed`, `points`, and for hazards `move` (`still`, `patrol`, `chase`, `wander`).
- **`win`**: any of `collect: "all"`, `reach: "goal"`, `survive: seconds`. With both collect and
  reach, the goal counts only after every pickup is taken. **`lose`**: `{ "lives": n }`.
- **`spawn`**: `[ { "piece": "e", "every": seconds, "max": n } ]` keeps adding a piece at the
  edges.

The compiler supplies the floor, walls, camera, keyboard and on-screen controls, the rule for
each role (a pickup scores and disappears, a key opens every door, a hazard costs a life and
returns the player to the start, the goal wins), score, lives and messages on screen, and
restart. What it had to learn from real answers, each now a rule of the generator:

- A maze has loops so a patrolling guard never blocks the only route; guards start off the
  main route; the key lies far from the door, and the door is the only way to the goal.
- A platformer's gaps are as wide as this runner can jump, the ground never changes height
  beside a gap, spike traps sit on level ground, and a runner is never slower than 4 m/s.
- In a survival game a chaser moves at most 0.6 times the player's speed, and arrivals stop
  once the arena is full (one enemy per 20 open cells).
- Every piece asked for is placed, or the level is drawn again from another seed.

### 3. Choreography and rules as data (kernel)

New core components, all owner `kernel/gameplay`, all integer-tick state inside the
component, so they are in the state hash, keyframes and replays like `timer` and `tween`.

- **`tween[].delay`**: ticks to wait before a tween starts; `from` is read when it starts.
- **`path`**: move along waypoints.
  `{ "points": [[x, y, z], ...], "speed": 1.3 }` (meters per second) or
  `{ "points": [...], "ticks": 150, "easing": "smooth" }` (whole path in that time), with
  `delay`, `loop` (`none`, `loop`, `pingpong`) and `emitOnComplete`. The path runs from where
  the entity stands when it starts. Figures already walk and turn when moved.
- **`mover`**: steering. `{ "mode": "chase" | "flee" | "wander", "target": "#player",
  "speed": 3, "turnTicks": 60 }`. Writes `kinematicBody.vel` when the entity has one (so walls
  still stop it), otherwise moves the transform. Wander picks one of eight compass headings from
  the world RNG.
- **`trigger`**: a touch zone, separate from any collider.
  `{ "shape": "circle", "radius": 0.5, "plane": "xz", "layer": 2, "mask": 1 }` (or `box` with
  `halfExtents`; `plane: "xy"` for platformers). Each tick, every pair of triggers that overlap
  and whose layers interact emits `touch { a, b }` (creation order). A separate component,
  rather than a `sensor` flag on `collider` and `platformSolid`, because a chasing hazard needs
  a solid collider against walls **and** a touch zone against the player, and because one
  system then serves both engines and entities moved by `path`.
- **`controller`**: `{ "move": "move", "jump": "jump", "speed": 5, "enabled": true }` binds
  declared commands (`move { dir: [x, y] }`, `jump { held }`) to whichever body the entity has:
  `kinematicBody.vel`, `platformIntent`, or `moveIntent`.
- **`vars`**: a flat record of numbers, strings and booleans (`score`, `lives`, `status`).
- **`cues`**: actions at a tick. `{ "cues": [ { "tick": 30, "do": [ ... ] } ], "loop": 360 }`.
- **`rules`**: actions on a trigger.

  ```json
  { "rules": [
    { "when": { "touch": ["#player", "tag:pickup"] },
      "if": [ { "select": "#game.vars.status", "op": "eq", "value": "playing" } ],
      "do": [ { "destroy": "$b" },
              { "add": { "target": "#game", "component": "vars", "path": "score", "value": 1 } } ] },
    { "when": { "becomes": { "select": "tag:pickup", "op": "count", "value": 0 } }, "once": true,
      "do": [ { "set": { "target": "#game", "component": "vars", "path": "status", "value": "won" } },
              { "emit": { "event": "win" } } ] } ] }
  ```

  Triggers (`when`, exactly one): `event` (any world event, optionally `from` a selector),
  `touch` (two selectors, either order; binds `$a` and `$b`), `command` (a declared command),
  `every` (ticks, with `offset`), `tick`, `becomes` (a condition turning true).
  Conditions (`if`, all must hold, and `becomes`) are the `molen/assert@1` select assertions,
  plus four new ops `count_lt`, `count_lte`, `count_gt`, `count_gte` that assertions gain
  too. Selectors may name `$self` (the entity carrying the rules), `$a`, `$b`, and `$entity`
  (an event payload's entity).

Actions, shared by cues and rules, one key each: `set`, `add` (a literal amount, or `from` a
selector's value, so a coin worth 3 adds 3), `spawn` (a scene prefab, `at` a
point or `pick` one of several, optionally `awayFrom` a selector by `minDistance`), `destroy`,
`emit`, `tween`, `path`, `figure` (`mode`, `lookAt`), `place` (teleport and stop the body),
`timer`, `sound`.

**A bad rule never stops the world.** An action or condition that throws emits
`rule-error { entity, rule, code, message }` and disables that rule (kernel-owned
`disabled`); the tick carries on. Rules run in the `late` phase after every other system, and
drain the events of the tick in order, with a cascade limit of 16 like the FSM. A keyframe
therefore never holds an unprocessed event.

A scripts-free entry, **`@bendyline/molen-kernel/data`**, builds a world from a data-only
manifest without loading SES, and refuses a manifest with `scripts`. A boundary test keeps
`ses` out of its import graph.

### 4. Scene format fixes

- **Camera track in the schema package**, registered with the other core formats.
  Keyframes gain `fov`, `cut` (jump to this pose instead of interpolating into it), and
  `relativeTo` (position and look-at are offsets from an entity, for tracking shots). A scene
  may carry the track inline as `cameraTrack`, so an answer is one document; frame export and
  playback use it when no other track is given.
- **`environment.preset`**: `morning`, `noon`, `evening`, `night`, `overcast` set sky, sun,
  ambient light, background and exposure; explicit fields still win.
- **`hud`** (scene block): readouts bound to values and messages keyed to a condition, plus
  timed captions.

  ```json
  "hud": { "items": [ { "label": "Score", "value": "#game.vars.score" } ],
           "messages": [ { "when": { "select": "#game.vars.status", "op": "eq", "value": "won" },
                           "text": "You made it!" } ],
           "captions": [ { "tick": 15, "ticks": 90, "text": "Saturday, nine o'clock." } ] }
  ```

  Values and conditions use the rules' selector and op vocabulary, limited to one entity by
  id (`#id.component.path`). The client draws the HUD as a DOM overlay; it never enters the
  state hash.
- **Traps defused.** `renderable.ref` may be omitted when the kind names a default (`figure`
  → `procedural`). A `plane` is documented as it renders, standing upright, and a plane whose
  size reads as a floor gets a validator hint toward a thin box. A figure's `lookAt` an
  entity that is itself a figure aims at its eyes, not its feet.

### 5. `@bendyline/molen-stage`

Depends on schema and `zod` only.

- `filmSchema`, `gameSchema`, registered through `registerSchema` so errors keep JSON pointers
  and did-you-mean.
- `compileFilm(doc)` and `compileGame(doc)`: a `scene@3` with no scripts (cues, rules, paths,
  movers, triggers, controller, vars, hud, inline camera track), or the issues.
- `lintFilm` and `lintGame`: who is off screen in which shot and cast that overlap (films);
  one player, unknown map letters, every pickup and the goal reachable, winning and losing both
  possible (games).
- `generateLayout(game)`: the archetypes above.
- Primers (`filmPrimer`, `gamePrimer`, `scenePrimer`, 600 to 700 words each, one worked
  example each), written by hand from the prompts the probe measured, embedded in the package
  and shipped as `llms-mini.txt`. A test fails when a primer leaves out a field or value of its
  schema or an example in it stops compiling, and the docs check fails when the embedded copy is
  stale. Hand-written rather than generated, because the measured wording is what small models
  succeeded with. Examples must differ from what a host asks for: the probe showed models copy
  them.

## Constraints

- **Determinism.** Every new kernel system reaches hashed state and is **Cross-platform**:
  `+ - * /`, `dmath.sqrt/abs/min/max/floor/clamp` and the seeded RNG only; easings are
  polynomial; wander headings are eight fixed directions. No new transcendental reaches state.
- **Data first.** Nothing a model writes is code. The compiled scene is data only and builds
  through `@bendyline/molen-kernel/data`.
- **Compatibility.** Every new field is optional and every new component is new, so existing
  scenes and replays are unchanged. `molen/cameratrack@1` gains optional fields only.
  `registerCameraTrackSchema()` stays as a no-op for existing callers.
- **Security.** A data-only scene runs no host code, so a host may simulate or render a
  model-written film or game without trusting it.

## Acceptance criteria

1. A compiled film and a compiled game validate, contain no `scripts`, and build through
   `@bendyline/molen-kernel/data`; importing that entry does not load `ses`.
2. Replay fixtures for a compiled game (a bot's command log) and a compiled film hash the same
   on two runs and after a keyframe restore mid-run.
3. A rule whose action throws emits `rule-error`, the world keeps stepping, and the rule does
   not fire again.
4. A test drives each archetype with a bot: it wins, and a careless bot loses.
5. `lintFilm` reports a cast member off screen in a shot; `lintGame` reports an unreachable
   pickup in a drawn map.
6. Each primer names every field and value of its schema and every example in it compiles; the
   embedded primers match their sources (`pnpm docs:check`).
7. `export_frames` renders a compiled film from its inline track with no separate track file.
