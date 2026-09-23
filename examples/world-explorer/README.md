# World explorer

The standalone [sky observatory](sky.html) previews the reusable Earth/custom sky system without
loading terrain. Open `/sky.html` on the dev server for date/location controls, accelerated time,
Sun/Moon tracking, a full-moon preset and an authored fantasy world. See
[the sky guide](../../docs-src/guide/sky.md).

The terrain explorer includes a **00:00–24:00 time slider**, date picker and **Now** button.
It opens at noon today; scrubbing previews the Sun, Moon, stars and terrain lighting without
moving the camera or seeking vehicles. Times use the browser's explicitly labeled time zone,
including daylight saving; the sky follows the camera's geographic location. The Moon readout
shows its altitude, visibility above the horizon and illuminated fraction. Use the date picker
to explore different lunar phases. `?date=2024-03-25T05:00:00Z` opens a reproducible instant;
`?sky=daylight` retains the old fixed daylight rig for terrain image comparisons.

The Weather dropdown combines independent cloud, precipitation and visibility settings in
Sunny, Partly cloudy, Overcast, Rain, Snow and Fog profiles. Expand Weather details to mix
those variables and change temperature, pressure or wind. These conditions also drive the
aircraft simulation's wind and air density. Use `?weather=rain` to open a preset; `?freeze=1`
freezes cloud/particle motion. See [weather and atmosphere](../../docs-src/guide/weather.md).

The first camera frame does not wait for building textures. They prepare in background workers;
Human tiles wait for the shared material set before becoming visible, while Bare terrain, water,
sky and camera controls remain usable. A loading message indicates this preparation. Startup
milestones (milliseconds since navigation) are available in `#performance-status`'s
`data-startup` attribute, alongside the existing graphics diagnostics.

This browser example exercises molen's large-world terrain foundation in three modes:

1. bare streamed terrain;
2. terrain plus illustrative land-classification objects;
3. terrain plus illustrative roads and buildings.

Natural hydrology composes through all three modes and every available semantic detail level.
Vector lakes and waterways do not disappear when Human mode is disabled; only transportation and
buildings belong to that toggle. Real packages render water inside mapped features, without a
blanket sea-level plane that could turn missing terrain or inland lowlands into a false ocean.
The synthetic fixture retains its procedural sea-level plane.

Daylight haze softens distant terrain into the pale sky while preserving foreground detail.
At neighborhood heights it starts at 2 kilometres and reaches full coverage at 20 kilometres;
both distances extend with flight altitude and are capped inside the streamed range. Quality
changes preserve the atmosphere unless a shorter terrain range requires an earlier fade.

Run it from the repository root:

```sh
pnpm --filter @bendyline/molen-examples-world-explorer dev
```

Before `dev` and `build`, `scripts/build-content-packs.mjs` builds the repository's `content/`
directories into `public/packs/` with an `index.json`. The page opens the entities, style,
earth and sky packs in parallel: small packs arrive in one request each, and car and aircraft
models are range-read from the entities pack only when one is shown.

Run the repeatable browser navigation review (ten frames plus HUD probes and browser/network
diagnostics) after building `@bendyline/molen-tooling`:

```sh
pnpm --filter @bendyline/molen-examples-world-explorer play:visual
```

Artifacts land in `.artifacts/world-explorer/`, including `experience-run.json`. The scenario is
plain `molen/experience-play@1` data, so the same harness can host and play any built browser
sample rather than depending on World Explorer internals.

`test/visual/water-modes.play.json` is the focused Lake Sammamish regression: it captures Bare,
Land classes, and Human over the same large water body and checks browser/network diagnostics.
`test/visual/water-distance.play.json` flies north over the lake, then revisits the starting view
at economy quality to review shoreline coverage across movement and coarse terrain LOD. It waits
for all hydrology loads to settle before capturing each view.

`test/visual/residential-buildings.play.json` captures the residential neighborhood at High and
Economy quality, after terrain and semantic loads settle. Run it with `molen play` against the
built example to review the zoom-15 building detail and residential height/roof fallbacks.

With no query parameters, the example opens the bundled 21.7 MiB Sammamish package: Mapzen/USGS
elevation compiled to seam-safe PNG16 PMTiles plus a pinned Protomaps/OpenStreetMap regional vector
extract. A broad level 8-10 elevation overview surrounds the level 11-14 detail window, with
ancestor-derived fallback between them. Vectors continue through zoom 15 for individual building
footprints and unrounded heights; zoom-15 terrain reuses the zoom-14 DEM. Residential land use
and mapped parts guide building massing, with low pitched and taller flat residential roofs. Bare, land-classification, and human-feature modes
therefore share actual coordinates without exposing a hard regional edge at flyover altitude.

Pass `?synthetic=1` to use the deterministic in-memory fixture instead. That path keeps adaptive
coverage and semantic-layer transitions testable without network-derived data; its trees, roads,
and buildings are intentionally invented placeholders.

To open a compiled terrain package with camera-driven multi-level refinement, pass the URL of its
manifest:

```text
http://localhost:5225/?package=/earth/terrain-package.json&quality=balanced
```

Add `&level=13` to pin a single archive level for fixed-grid diagnostics. Adaptive semantic layers
have inclusive detail-level bounds. Trees, roads, and buildings appear on sufficiently detailed
displayed tiles; hydrology also covers coarse horizon tiles when the sidecar supplies them.

The manifest must validate as `molen/terrain-package@1`; its elevation archive must be PMTiles v3
containing PNG16 height tiles. See `docs-src/guide/terrain.md` for the package and client APIs.
Real packages that declare `profile: "protomaps-basemap@1"` on their MVT landcover/features blocks
automatically enable the layer controls. The example opens and validates those PMTiles sidecars,
normalizes Protomaps geometry, and never overlays its invented trees, roads, or buildings onto real
coordinates. Undeclared profiles and PNG8 classification remain bare rather than being guessed.

Use `?lat=47.6163&lon=-122.0356` to choose a camera reference and `quality=economy|balanced|high`
to select portable streaming budgets. `?alt=17000&pitch=-0.35` reproduces a high-altitude camera;
`yaw` and `pitch` are radians. The HUD exposes attribution, adaptive level/error state, fallback
counts, resident samples, geometry memory, triangle/draw estimates, instances, failures, and
evictions. A separate location panel stays visible in Fly and Walk modes, even with `hud=0`.
It reports the package name, live WGS84 latitude/longitude to seven decimal places, camera
altitude, compass heading, and yaw/pitch in radians. These are absolute world coordinates and
remain correct after floating-origin resets. Include this panel in screenshots of odd behavior;
its `lat`, `lon`, `alt`, `yaw`, and `pitch` values identify the camera position and view direction.
Local-coordinate packages show local X/Z instead of WGS84 coordinates.

Rebuild the bundled regional package with the pinned official `go-pmtiles` executable:

```sh
pnpm --filter @bendyline/molen-examples-world-explorer data:sammamish -- \
  --pmtiles-cli /path/to/pmtiles
```

The builder downloads only the declared bounding box, adds a shared east/south border sample to
each elevation tile, emits source and license sidecars, and hashes every package file. It is a
small real-data fixture; the size-preset production pipeline lives outside this repository.

## Data attribution

The bundled package is third-party open data and is **not** covered by the repository's MIT
license. The vector tiles are an ODbL 1.0 Derivative Database — share-alike — and the archive also
carries CC BY 4.0 landcover. Per-source terms and the required credit strings are in
[the package's LICENSES.md](public/terrain/sammamish/LICENSES.md), the machine-readable
[SOURCES.json](public/terrain/sammamish/SOURCES.json), and the repository root
[NOTICE](../../NOTICE.md).

When a real package is loaded the app renders a small always-visible credit in the top-right corner
(`#credit`), outside `#hud`, so that `hud=0` — used by captures and embeds — does not hide it: ODbL
and the OSM Foundation attribution guidelines require the credit to be readable without any user
interaction. It shows the head of each `attribution[]` entry, up to the first `;`, and the HUD's
"Data attribution" list keeps the full strings. The synthetic fixture has no third-party data to
credit, so the corner stays empty there — which is also why the committed goldens (all
`?synthetic=1`) carry no overlay text.

## Surface rendering styles

Human mode includes a Surfaces selector for Modern traffic, Circa 1910, and Simple surfaces.
The Surface details controls customize markings, sidewalks, crossings, streetlights, signals,
parked cars, and inferred parking. Changes preserve the camera and buildings and update the URL.
Circa 1910 changes the surface treatment of the present-day map; it does not reconstruct history.

See [Surface styles and parameterized line features](../../docs-src/guide/surface-rendering.md) for the shared rendering API, parking inference rules, budgets, and rail/utility profile examples.

Performance defaults to **Auto (device)**: six tiers respond to frame time and resident buffer
pressure, controlling render resolution, terrain refinement/range, concurrency, cache sizes,
vegetation/building LOD, and surface decorations. Manual presets switch live without moving the
camera. Object detail follows projected screen size with hysteresis; buildings retain their roof
and wall shapes while distant materials and facade details simplify. Spatial cells improve
frustum culling. The live viewer requests multisample antialiasing on both graphics backends so
geometry and surface-marking edges stay smoother when Auto lowers the drawing-buffer resolution;
use `?antialias=0` only for a controlled performance comparison. Worldgen textures already use
mipmaps and anisotropic filtering. Worldgen, land-cover and road/parking construction run in
separate workers.

The performance HUD reports frame/p90 and optional asynchronous GPU timing, actual rendered
draws/triangles, resolution and memory budgets. Streaming selection runs at 10 Hz; navigation runs
every frame. Walking collision rebuilds only for nearby changes or movement. Frustum culling and
depth testing are active; terrain/hill occlusion culling is not implemented. See
[Adaptive rendering performance](../../docs-src/guide/adaptive-performance.md) for controls,
budget limits, worker fallbacks, timing APIs and implementation boundaries.

The reusable store identity library and mapped street furniture can be reviewed with
`?synthetic=1&stores=1&style=default`, or replayed using `test/visual/store-library.play.json`.
See the [recognizable places guide](../../docs-src/guide/recognizable-places.md) and
[3D art guidelines](../../docs-src/guide/3d-art-guidelines.md) for catalog and material conventions.
