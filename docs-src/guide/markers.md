# World markers

`@bendyline/molen-client/markers` draws screen-sized billboards pinned to world positions: photo
pins, labels you render to images, waypoints. A marker keeps a constant on-screen size. It sits on
the ground, re-snapping as finer terrain streams in, hides behind hills and buildings through the
depth test, and can fade with distance. Markers are budgeted so the nearest or most important ones
draw, and `pick(x, y)` resolves a click or tap to a marker id.

```ts
import { composeMarkerImage, createMarkerLayer } from '@bendyline/molen-client/markers';
import { wgs84ToWorld } from '@bendyline/molen-terrain/kernel';

const markers = createMarkerLayer(viewer.renderer, {
  groundHeight: (x, z) => stream.sampleHeight(x, z),
  maxVisible: 200,
  fade: { near: 15_000, far: 40_000 },
});

const photo = await createImageBitmap(await (await fetch(thumbnailUrl)).blob());
const [x, z] = wgs84ToWorld(metersPerUnit, longitude, latitude);
markers.set([
  {
    id: 'space-needle',
    x,
    z,
    elevation: 2,
    image: composeMarkerImage(photo, { borderColor: '#c4a265' }),
    size: 64,
  },
]);

// each frame, after posing the camera:
markers.update(cameraPosition);

// on a tap (element-relative CSS pixels, e.g. NavigationInput.taps):
const id = markers.pick(tap.x, tap.y);
```

- **Coordinates** are absolute world meters, the same ones you give `setCamera`. The layer lives
  under `renderer.worldRoot`, so floating-origin rebasing moves it with everything else. Omit `y`
  to sit on the ground (`groundHeight` + `elevation`). Ground-snapped markers stay hidden until
  their ground height is known (`hideUntilGrounded`), so pins never jump from sea level.
- **Images** are canvases, bitmaps, image elements, or URLs. Markers that share an image share one
  texture, and `set` matches markers by id, so re-calling it with the same list costs nothing.
  `composeMarkerImage` cover-crops a photo into a rounded, bordered frame with a shadow and a
  pointer tail. The canvas's bottom-center is the pin point, which suits the default
  `anchor: 'bottom'`.
- **Budget:** `maxVisible` keeps the highest `priority`, then nearest, markers.
- `screenPosition(id)` places DOM callouts next to a marker. `projectWorldToScreen(renderer,
  position)` projects any world point the same way.

The layer never fetches anything you did not pass it, and it adds no draw calls when it is empty.
