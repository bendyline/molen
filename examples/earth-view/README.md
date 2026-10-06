# Earth view

The [`@bendyline/molen-earth`](https://github.com/bendyline/molen/tree/main/packages/earth) facade on
one page. A single `mountEarthView` call asks a host resolver for Sammamish or Seattle terrain in a
metric frame, styles buildings and street surfaces from the content packs, and adds orbit, walk
and drive navigation with drivable parked cars. It also places a photo-pin marker by latitude and
longitude and shows the required data credits.

Play it at [molen.dev/play/earth-view](https://molen.dev/play/earth-view/).

## Run

In the engine repository:

```sh
pnpm install && pnpm -r build
pnpm --filter @bendyline/molen-examples-earth-view dev
```

It reuses the World Explorer's terrain package and content packs (`publicDir` points at
`../world-explorer/public`, and `predev`/`prebuild` build the packs), so it adds no data of its
own. It lists the World Explorer as a dev dependency only so `pnpm -r build` builds the two in
order instead of regenerating the shared packs concurrently.

- **Orbit:** drag to rotate and tilt, wheel or pinch to zoom, right-drag or two fingers to pan.
- **Walk:** WASD to move, mouse-look, Space to jump, E next to a parked car to drive.
- **Drive:** W/S to drive, A/D to steer, V to switch views, E to get out.
- **Space Needle:** fly to Seattle, switch terrain packages and draw the indexed landmark.
- **Traffic:** show or hide ambient life: NPC cars on the mapped streets, pedestrians on the
  sidewalks, trains on rail lines and aircraft overhead.

`?mode=walk`, `?mode=drive` and `?mode=fly` start on foot, in a car or in the air,
`?lat=&lon=&range=` choose the first view, and `?ambient=0` turns ambient life off. For a Seattle
start, use `?lat=47.62051&lon=-122.3493&range=950`.
The [Seattle capture](captures/seattle-space-needle.png) records that view through the shipped
`mountEarthView` API, including the authored Space Needle model.

## Authoring map

- `src/main.ts`: resolve a terrain package from the requested location, open the content packs, and call
  `mountEarthView` with worker factories. It then adds a `composeMarkerImage` pin, the credits
  and the mode buttons.
- `src/*.worker.ts`: one line each, `import '@bendyline/molen-earth/workers/<name>';`.

`mountEarthView` itself is covered by `packages/earth/test/earth-view.test.ts` (streaming, credits,
markers and walking over a procedural archive). This example has no browser test of its own.
