# Films and games as authoring documents

`@bendyline/molen-stage` gives a language model two small documents to write: a short film
(`molen/film@1`) and a simple game (`molen/game@1`). Each compiles into an ordinary data-only
`molen/scene@3`, with no scripts, that plays and renders like any other scene.

The model makes the choices: who is in the film and what they do, or which pieces a game has and
how it is won. The compiler does what models get wrong: where things stand, when they move, what
the camera frames, how a level is laid out, and the rules of play. The documents exist because a
small model writes valid raw scenes but poor films and unplayable games; see the
[authoring-layer proposal](https://github.com/bendyline/molen/blob/main/specs/authoring-layer.md)
for the measurements.

## Install and compile

```sh
npm install @bendyline/molen-stage @bendyline/molen-kernel @bendyline/molen-figures
```

```ts
import { compileGame, lintGame } from '@bendyline/molen-stage';
import { buildDataWorld } from '@bendyline/molen-kernel/data';
import { installFigures } from '@bendyline/molen-figures/kernel';

const result = compileGame(doc);
if (!result.ok) {
  console.log(result.formatted); // the issues, in Molen's usual format: give these back to the model
} else {
  const world = buildDataWorld(result.scene, { capabilities: [(w) => installFigures(w)] });
  world.stepN(300);
}
```

`compileFilm` works the same way and returns `info.lengthTicks` (30 ticks a second).

A host that takes whatever a model wrote can use `checkDocument` instead: it reads the `format`,
compiles a film or game, validates a `molen/scene@3` with the figures vocabulary and refuses one
that carries scripts, and returns the scene, the lint notices and a one-line summary (`a film
"The Meeting" 9.0 s long with 3 cast members and 1 prop`), or the issues and their formatted
block.
`lintFilm` and `lintGame` return what a viewer or a play test would notice, as notices: a
subject out of frame or behind a prop, cast standing inside each other, a game nobody can lose.

## The film document

```json
{ "format": "molen/film@1", "name": "The Meeting", "look": "evening",
  "set": { "ground": "plaza", "props": [ { "id": "fountain", "shape": "fountain", "at": [0, 0] } ] },
  "marks": { "west": [-8, 3], "east": [3, 3] },
  "cast": [
    { "id": "ana", "preset": "human.adult", "at": "west" },
    { "id": "ben", "preset": "human.adult", "at": "east" } ],
  "beats": [
    { "at": 0, "who": "ben", "do": "look-at", "target": "ana" },
    { "at": 1, "who": "ana", "do": "walk-to", "target": "ben", "seconds": 5 } ],
  "shots": [
    { "at": 0, "kind": "wide", "on": ["ana", "ben"] },
    { "at": 6, "kind": "close", "on": ["ana", "ben"] } ],
  "captions": [ { "at": 0.5, "seconds": 3, "text": "Saturday, nine o'clock." } ] }
```

Times are seconds; places are marks, prop or cast ids, or `[x, z]` ground points. The compiled
scene carries its camera as an inline `cameraTrack` (each shot after the first starts with a
cut), its captions in the `hud` block, and its timing as `cues` and `path` components. What the
compiler takes care of:

- A prop placed at another prop stands on it, and stays on its footprint.
- Nobody starts or stops inside a prop. A walk stops a step short of the person it goes to and
  steps around anyone in the way.
- A shot of something moving follows it. A close shot on two people becomes a two-shot from
  across the line between them. A push-in ends on, and a pull-out starts from, the first subject.
- `look` presets light every frame; a figure looking at someone looks at their face.

## The game document

```json
{ "format": "molen/game@1", "name": "Coin Garden", "kind": "top-down",
  "layout": { "archetype": "garden", "size": "small", "hedges": "some" },
  "pieces": {
    "P": { "role": "player", "figure": "human.child", "speed": 5 },
    "o": { "role": "pickup", "count": 5 },
    "x": { "role": "hazard", "figure": "dog", "move": "patrol", "speed": 2 } },
  "win": { "collect": "all" }, "lose": { "lives": 3 } }
```

`layout` names an archetype (`garden`, `maze`, `arena` for top-down games; `level` for a
platformer) or adjusts one:

| Archetype | Knobs |
| --- | --- |
| all | `size` (`small`, `medium`, `large` or `[columns, rows]`), `seed` |
| `garden` | `hedges`: `few`, `some`, `many` |
| `maze` | `loops`: `none`, `few`, `many`; `corridors`: `narrow`, `wide` |
| `arena` | `pillars`: `none`, `few`, `many` |
| `level` | `gaps`: `few`, `some`, `many`; `hills`: `flat`, `rolling`, `steep`; `ledges`: `none`, `some`, `many` |

A drawn `map` (rows of piece characters, `.` for floor) is the alternative for a model that wants
full control; a map whose pickup, key or goal the player cannot reach is refused, with the row and
column named.

The compiled scene follows a fixed contract, so a player or a play test can drive any game:

- the player entity is `player`, and pieces are tagged by role (`pickup`, `key`, `door`, `goal`,
  `hazard`);
- the commands are `move { dir: [x, y] }`, `jump { held }` and `restart` (a host rebuilds the
  world on restart);
- the events are `win`, `lose`, `hit`, `pickup` and `key`;
- the `game` entity's `vars` hold `score`, `lives`, `status` (`playing`, `won`, `lost`) and, for a
  survival game, `left` (seconds).

Rules, triggers and movers are the data components described in
[Rules and choreography as data](https://molen.dev/guide/play-data.html).

## Primers

`filmPrimer`, `gamePrimer` and `scenePrimer` are prompt blocks of about 600 to 700 words, each
with one worked example, that teach a model to write a film, a game, or a data-only scene by
hand. They also ship in the docs bundle as `llms-mini.txt`. Give a model the primer, ask for the
document, and give it back the compiler's `formatted` issues if the first answer does not
compile.
