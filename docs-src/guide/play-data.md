# Rules and choreography as data

Timed motion and the rules of a game can be plain scene data, with no scripts. This page covers
the seven components that make that work (`cues`, `rules`, `path`, `mover`, `trigger`,
`controller`, `vars`), the scene `hud` block that puts values on screen, and the scripts-free
entry that builds such a scene.

A data-only scene runs no host code, so you can simulate and render a scene you did not write,
including one a language model wrote. It needs no `eval`, so it also runs where SES cannot. And a
broken rule reports an error event instead of stopping the world.

## The components

| Component | What it does |
| --- | --- |
| `vars` | A flat record of named numbers, strings and booleans: `{ "score": 0, "lives": 3, "status": "playing" }` |
| `cues` | Actions at a tick: `{ "cues": [ { "tick": 30, "do": [ ... ] } ], "loop": 360 }` |
| `rules` | Actions when a trigger fires and conditions hold |
| `path` | Move along waypoints at a `speed` (m/s) or over `ticks`, with `delay`, `easing` (`linear`, `smooth`) and `loop` (`none`, `loop`, `pingpong`) |
| `mover` | Steer in the XZ plane: `chase` or `flee` a `target`, or `wander` |
| `trigger` | A touch zone (`circle` or `box`, in the `xz` or `xy` plane) with `layer` and `mask` |
| `controller` | Bind the `move` and `jump` commands to the entity's body |

`tween` entries also take a `delay` in ticks.

### Paths and movers

A path runs from where the entity stands when it starts, through each point in order. Figures
walk and turn on their own when moved, so a path is all a person needs to walk somewhere:

```json
{ "id": "ana", "components": {
  "transform": { "pos": [-6, 0, 2] },
  "renderable": { "kind": "figure" },
  "figure": { "preset": "human.adult" },
  "path": { "points": [[1, 0, 2]], "speed": 1.3, "delay": 30 } } }
```

A mover writes `kinematicBody.vel` when the entity has one, so walls still stop it; otherwise it
moves the transform. `wander` picks one of eight compass headings from the world RNG every
`turnTicks` ticks.

### Triggers and touch

Each tick, every pair of `trigger` zones that overlap, lie in the same plane and whose layers
interact (`(a.mask & b.layer) || (b.mask & a.layer)`) emits `touch { a, b }`. The event repeats
every tick while they overlap. A trigger is separate from `collider`: a chasing enemy can have a
solid collider against walls and a touch zone against the player.

### The controller

```json
"controller": { "move": "move", "jump": "jump", "speed": 5 }
```

A `move` command's payload is `{ "dir": [x, y] }` (x east, y south on screen); a `jump` payload is
`{ "held": true | false }`. The controller writes whichever body the entity has:
`kinematicBody.vel` (scaled by `speed`), `platformIntent`, or `moveIntent`. Declare the commands
in the scene's `commands` and bind keys to them under `input`, as for scripts.

## Rules

```json
"rules": { "rules": [
  { "id": "pickup",
    "when": { "touch": ["#player", "tag:coin"] },
    "if": [ { "select": "#game.vars.status", "op": "eq", "value": "playing" } ],
    "do": [ { "destroy": "$b" },
            { "add": { "target": "#game", "component": "vars", "path": "score", "value": 1 } } ] },
  { "id": "win",
    "when": { "becomes": { "select": "tag:coin", "op": "count", "value": 0 } },
    "once": true,
    "do": [ { "set": { "target": "#game", "component": "vars", "path": "status", "value": "won" } },
            { "emit": { "event": "win" } } ] } ] }
```

**Triggers** (`when`, exactly one):

| Trigger | Fires |
| --- | --- |
| `{ "event": "hit", "from": "tag:enemy" }` | on a world event; `from` filters on the payload's `entity` and binds `$entity` |
| `{ "touch": ["#player", "tag:coin"] }` | while a match of the first overlaps a match of the second, either order; binds `$a` and `$b` |
| `{ "command": "restart" }` | when a declared command arrives |
| `{ "every": 30, "offset": 0 }` | every 30 ticks |
| `{ "tick": 1800 }` | once, at tick 1800 |
| `{ "becomes": <condition> }` | when the condition turns true |

**Conditions** (`if`, all must hold; and `becomes`) are the select assertions of
`molen/assert@1`: `{ "select": "...", "op": "...", "value": ... }`, with the ops `eq`, `approx`,
`gt`, `gte`, `lt`, `lte`, `count`, `exists`, the `all_` and `any_` forms, and `count_lt`,
`count_lte`, `count_gt`, `count_gte` to compare how many entities match.

Selectors are the usual `#id`, `tag:name` and `has:component`, with a value path after a dot
(`#game.vars.lives`). In a rule they may also name `$self` (the entity carrying the rules), `$a`
and `$b` (a touch), and `$entity` (an event's entity).

**Actions** (shared with `cues`, one key each):

| Action | Does |
| --- | --- |
| `set` | write a value: `{ "target", "component", "path"?, "value" }` |
| `add` | add to a number: `{ "target", "component", "path", "value" }` |
| `spawn` | create an entity from a scene prefab, `at` a point or `pick` one of several, optionally `awayFrom` a selector by `minDistance` |
| `destroy` | `"destroy": "$b"` |
| `emit` | emit a world event |
| `tween`, `path` | start a tween or a path on each target |
| `figure` | set a figure's `mode` or `lookAt` (an entity or a point; `null` clears) |
| `place` | teleport each target and stop its body |
| `timer` | schedule a timer event |
| `sound` | play a sound-bank id (emits `audio.play`) |

`target` defaults to `$self`.

### When rules run, and what happens when one fails

Rules run in the `late` phase after every other system. They take the tick's events in order
(touches, timers, path completions, commands), then the `every`, `tick` and `becomes` triggers,
then whatever those emitted, up to 16 rounds. A keyframe therefore never holds an event a rule
has not seen.

An action or condition that throws emits `rule-error { entity, rule, code, message }` and marks
that rule `disabled`. The tick carries on, and the rule never fires again. A rule's `fired`,
`was` and `disabled` fields are written by the kernel and live in the component, so they reach
the state hash and keyframes like a tween's progress.

## The HUD

```json
"hud": {
  "items": [ { "label": "Score", "value": "#game.vars.score" } ],
  "messages": [ { "when": { "select": "#game.vars.status", "op": "eq", "value": "won" },
                  "text": "You made it!", "detail": "Press R to play again" } ],
  "captions": [ { "tick": 15, "ticks": 90, "text": "Saturday, nine o'clock." } ],
  "title": { "text": "Coin Garden", "ticks": 90 } }
```

Values and conditions refer to one entity by id: `#id.component.path`. The client draws the HUD
as a DOM overlay (`evaluateHud` and `createHudOverlay` from `@bendyline/molen-client/hud`); it
never enters the state hash.

## Building a data-only scene

```ts
import { buildDataWorld } from '@bendyline/molen-kernel/data';

const world = buildDataWorld(manifest);
world.stepN(300);
```

`@bendyline/molen-kernel/data` builds a world without loading SES, and refuses a manifest whose
`scripts` (or whose types' scripts) are not empty, so a scene never runs with part of its
behavior missing.

## Determinism

Every system here reaches the state hash at the **Cross-platform** level: only `+ - * /`,
`sqrt`, `abs`, `min`, `max`, `clamp` and the seeded RNG touch state, easings are polynomial, and
wander headings are eight fixed directions. See
[Determinism](https://molen.dev/guide/determinism.html).
