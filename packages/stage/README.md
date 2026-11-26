# @bendyline/molen-stage

Authoring documents a language model can write: a short film (`molen/film@1`) and a simple game
(`molen/game@1`), each compiled into an ordinary data-only `molen/scene@3` with no scripts, plus
a lint for each and short primers that teach them.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-stage
```

Node >= 22.13, ESM only, one `.` export. It depends on `@bendyline/molen-schema` and `zod` only:
it compiles and checks documents and never runs a scene. Run the compiled scene with
`buildDataWorld` from `@bendyline/molen-kernel/data`, which loads no script runtime, and add
`@bendyline/molen-figures` for the people and animals.

## Use

```ts
import { compileFilm, filmPrimer } from '@bendyline/molen-stage';

// Give a model filmPrimer as part of its prompt, then compile what it writes.
const result = compileFilm(answer);
if (!result.ok) console.log(result.formatted); // hand these issues back to the model
else console.log(result.scene.cameraTrack?.keyframes.length, result.info.lengthTicks);
```

| Export | What it does |
| --- | --- |
| `compileFilm(doc)`, `compileGame(doc)` | validate a document and compile it to a scene, or return its issues and a formatted block |
| `lintFilm(doc)`, `lintGame(doc)` | what a viewer or play test would notice: subjects out of frame or hidden, cast overlapping, a game that cannot be lost, an unreachable pickup |
| `generateLayout(name, kind, spec, pieces)` | draw a level from an archetype (`garden`, `maze`, `arena`, `level`) and its knobs |
| `filmPrimer`, `gamePrimer`, `scenePrimer` | prompt blocks of about 600 to 700 words, each with a worked example |
| `filmSchema`, `gameSchema` | the Zod schemas, also registered as the `film` and `game` kinds for `validateByKind` |

The documents, the compiler's staging and level rules, and the game contract (entity `player`,
role tags, the `move`, `jump` and `restart` commands, the `win` and `lose` events) are described
in [Films and games as authoring documents](https://molen.dev/guide/authoring-documents.html).
