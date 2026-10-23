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
pnpm install && pnpm dev:prepare
pnpm --filter @bendyline/molen-examples-earth-view dev
```

It reuses the World Explorer's terrain package and content packs (`publicDir` points at
`../world-explorer/public`). Development reuses prepared packs; run `pnpm dev:content` from the
root to refresh them after asset edits. Production `prebuild` still builds the packs. This sample
lists the World Explorer as a dev dependency so `pnpm -r build` builds the two in
order instead of regenerating the shared packs concurrently.

- **Orbit:** drag to rotate and tilt, wheel or pinch to zoom, right-drag or two fingers to pan.
- **Walk:** WASD to move, mouse-look, Space to jump, E next to a parked car to drive.
- **Drive:** W/S to drive, A/D to steer, V to switch views, E to get out.
- **Space Needle:** fly to Seattle, switch terrain packages and draw the indexed landmark.
- **Traffic:** show or hide ambient life: NPC cars on the mapped streets, pedestrians on the
  sidewalks, trains on rail lines and aircraft overhead.

`?mode=walk`, `?mode=drive` and `?mode=fly` start on foot, in a car or in the air,
`?lat=&lon=&range=` choose the first view, and `?ambient=0` turns ambient life off. For a Seattle
start, use `?lat=47.62051&lon=-122.3493&range=950`. `?companion=1` (try it with `?mode=walk`)
gives the walker a body, with V switching to a third-person camera, and adds a companion who
follows on foot, takes the passenger seat of whatever you drive off in, and steps out after you.
It is about forty lines at the end of `src/main.ts` over the view's actors API.
The [Seattle capture](captures/seattle-space-needle.png) records that view through the shipped
`mountEarthView` API, including the authored Space Needle model.

## Authoring map

Registered dioramas are enabled by default, starting at the mapped Eastlake football field.
Open `?diorama=football` (also `airport`, `little-league`, `fireworks`, `fair`, `market`) to visit it, or `?dioramas=0` to disable them. The lightweight placement
catalog is shared with World Explorer; scene scripts load only when a site is near. Geographic
anchors follow terrain refinement and survive package re-anchoring.

- `src/main.ts`: resolve a terrain package from the requested location, open the content packs, and call
  `mountEarthView` with worker factories. It then adds a `composeMarkerImage` pin, the credits
  and the mode buttons.
- `src/*.worker.ts`: one line each, `import '@bendyline/molen-earth/workers/<name>';`.

`mountEarthView` itself is covered by `packages/earth/test/earth-view.test.ts` (streaming, credits,
markers and walking over a procedural archive). This example has no browser test of its own.

Select a motorcycle, scooter or bicycle beside **Drive**, then press **Drive** to ride it. W powers,
S/Space brake, A/D steer, V switches rider/chase view and E dismounts once stopped. The avatar
sits on the saddle and follows the handlebars and pedals. A direct start is
`?mode=drive&vehicle=molen.entities.cycle.city_bicycle`.

The Boat button (or `?boat=1`) launches a speedboat on nearby mapped water. W/S thrust, A/D helm,
Space opposing thrust, hold Shift to anchor below walking speed, V helm/chase, E dry dockside exit.
