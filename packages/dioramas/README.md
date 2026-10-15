# @bendyline/molen-dioramas

Bounded scripted set pieces for Molen: a football game, market, fair or other small performance
that plays when its place is nearby and its host-selected schedule is active.

- `/kernel`: `createDiorama` runs an ordinary `molen/scene@3` in a separate deterministic world,
  with local bounds, an entity budget and the figures capability.
- `/client`: `DioramaDirector` manages proximity, schedules and asynchronous cancellation;
  `createDioramaVisual` attaches an instance to a three.js root; `loadDioramaScene` fetches trusted
  scene JSON and its JavaScript sources on demand.

The scripting runtime loads on first activation. Leaving range disposes an instance; returning
restarts from its seed. Content is separate from this package. The first example is a scripted
football stadium with players, spectators and a scoreboard.

See the [dioramas guide](https://molen.dev/guide/dioramas) for authoring, Earth placement,
lifecycles and prototype limits. Scripts run with the normal Molen host authority; bounds and
budgets are authoring guards, not a sandbox.
