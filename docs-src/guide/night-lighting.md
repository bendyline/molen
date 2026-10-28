# Night lighting

Earth views light occupied windows and street fixtures as the Sun sets. World Explorer and
`mountEarthView` share the same smooth transition: off above +2° solar altitude, fully on below
−6°. Date, location and time-of-day changes use the sky's Sun position, so a city's lights follow
its local night even when the controls display your own time zone.

## Buildings and existing models

Generated buildings already identify their glass as the `window` material slot. The client adds
a compact emission layer on those actual panes. About 55% illuminate, with a deterministic mix
of warm and neutral whites and brightness levels. Each whole pane stays either on or off;
the pattern does not flicker with time, material loading or floating-origin shifts. The same
layer follows all three resident building detail levels. Silhouette boxes without windows stay
unlit.

Authored static GLB structures opt in through material metadata. Existing
`extras.molenSurface.slot: "window"` bindings are recognized automatically. For glass or lamp
faces with other materials, add this to the glTF **material's** extras:

```json
{
  "molenNightLight": {
    "kind": "window",
    "occupancy": 0.55,
    "color": "#ffe4b0"
  }
}
```

Use `kind: "lamp"` for a permanently occupied fixture (default occupancy 1). `color` is optional;
omitting it gives the warm/neutral mix. An occupancy of 0 disables the layer. Model generators
should emit separate, disconnected glass panes for independent room occupancy. Connected glass
sheets illuminate as one surface. Mark only the emitting faces, not a combined wall-and-window
material. These tags also work on source-derived runtime LODs when those LODs retain the extras.

No window locations are guessed from a model's name, base colour or bounding box. Untagged
landmarks need a generator change to identify the intended glass or fixture faces. The light
layer follows the model's hierarchy, placement, clipping and lifetime; the original daytime
materials are retained.

## Roads and signals

Modern surfaces place lamps along paved streets with sidewalks and at intersections. Placement
is bounded, terrain-aware and avoids mapped buildings and water. Long blocks get fixtures at roughly 28 m intervals, alternating sides.
Bridges, tunnels and unpaved roads do not receive inferred block lighting. Explicit
`tags.lit: "no"` disables block lamps. The existing surface style and `details.streetlights`
control whether fixtures are generated; historic and unlit styles keep their own choices.

Each surface tile batches illuminated lamp heads and soft pavement pools. Pools follow terrain
height, fade with dusk and share the fixtures' distance culling. Earth hosts also use sixteen
real warm point lights selected from visible street fixtures near the camera and the ground it
looks toward. They illuminate building walls, parked cars, moving vehicles and other lit
materials. The fixed pool keeps shader light counts stable as tiles stream. These lights do
not cast additional shadows; walls do not occlude them. Distant lamps keep their batched glow
and pavement pools beyond the real-light budget.

Traffic lenses remain self-lit in both daytime and nighttime and keep their simulation-driven
signal phases. Mapped props that replace inferred fixtures still need their own model lighting
metadata; arbitrary tagged model lamps currently emit without creating a point light.

## Cars

Active traffic and the driven car get white headlights and red tail lights, including when
stopped at a signal. Lenses follow vehicle dimensions and the full chassis rotation, through
proxy/model changes and floating-origin shifts. Braking brightens the rear lenses. Four nearby
cars also receive forward, downward-aimed spotlights, with the driven car taking priority.
Their beams illuminate pavement, walls and vehicles ahead. Parked, unoccupied cars keep their
lamps off and receive light from their surroundings. Hidden/despawned traffic loses its lights.

Traffic lenses are two instanced batches, capped at 512 cars, and all artificial lighting fades
out at dawn. No light changes the deterministic simulation.

`details.maxStreetlightsPerTile` gives lamps their own budget (default
1.5 × `maxFixturesPerTile`, normally 240), so block lighting does not take parking spaces away.
Worker and direct surface generation produce the same placement and light pools. Fresh tiles
and style replacements inherit the current night factor immediately.

## Custom hosts

`createEarthWorldgen(...).setNightFactor(factor)` and
`TerrainSurfaceRenderer.setNightFactor(factor)` accept 0..1. Compute that factor with
`earthNightFactor(sunAltitudeDeg)` from `@bendyline/molen-earth/client`. Fixed daylight hosts
can leave the default 0. Direct surface objects use `updateTerrainStreetLights(object, factor)`.

Lower-level worldgen hosts can create `NightWindowLighting` from
`@bendyline/molen-worldgen/client`, assign it to their material set's `nightWindows`, and pass it
to `StructureModelLibrary` or `StructureLodStreamer` as `nightWindows`. Dispose the controller
after its building/model objects; model eviction retains the shared emission material.
Compose real spill and traffic lighting with `EarthNightLighting` from
`@bendyline/molen-earth/client`. Construct it with `{ root, world, surface, sampleHeight }`,
where `root` uses absolute simulation coordinates (normally the terrain stream object).
Pass `vehicleHeights` from the ambient content catalog for matching traffic model heights.
Call `update({ camera, direction, factor, drivenVehicleId })` each frame and dispose it before
its root. `TerrainSurfaceRenderer.visitStreetLights` exposes only attached, visible source tiles.
Both graphics backends use standard materials and lights, without shader injection.
