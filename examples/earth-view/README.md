# Earth view

The [`@bendyline/molen-earth`](https://github.com/bendyline/molen/tree/main/packages/earth) facade on
one page. A single `mountEarthView` call streams the Sammamish, Washington terrain package in a
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

`?mode=walk` starts on foot, and `?lat=&lon=&range=` choose the first view.

## Authoring map

- `src/main.ts`: fetch the terrain manifest, open and load the content packs, and call
  `mountEarthView` with worker factories. It then adds a `composeMarkerImage` pin, the credits
  and the mode buttons.
- `src/*.worker.ts`: one line each, `import '@bendyline/molen-earth/workers/<name>';`.
- `test/golden/earth-view.golden.test.ts`: a real-browser run (software WebGL). It asserts that
  tiles stream at detail level 13 or finer with no failures, that the marker and credits exist,
  and that walking lands on the ground. It also records screenshots for review.
