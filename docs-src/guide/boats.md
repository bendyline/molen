# Boats, passengers and water

Boats use a dedicated deterministic hull solver and the same driver/passenger seat contract as
cars and aircraft. The entities pack supplies eight powered watercraft: speedboat, sailboat
(using its auxiliary motor), fishing boat, tug, container ship, bulk carrier, passenger ferry and
car ferry. Their handling, draft, helm, boarding points and passenger seats live in their types.

## In Earth view and World Explorer

Earth view's **Boat** button launches a speedboat on nearby mapped water. In World Explorer,
press **B** near water (or open it with `?boat=1`). **W/S** apply forward/reverse thrust,
**A/D** steer, **Space** applies opposing thrust, and holding **Shift** drops anchor once speed
falls below walking pace. Release Shift to weigh anchor. **V** changes helm/chase view. Walk up
to a stopped boat's boarding point and press **E** to board; E leaves only beside a reachable,
clear shore or dock. A boat coasts when power is released; it has no road brakes. Reverse
thrust takes time to stop it, and steering reverses when backing up.

The hull samples water across its footprint, preventing its bow and sides from crossing land.
Missing water tiles pause it. Known depth below its draft grounds it. Earth uses the rendered
water polygons and their actual elevations, including inland lakes. Elevation DEMs are not
bathymetry: when depth is unavailable, the host checks water coverage without inventing a depth.
A host can supply measured depths through `waterAt`.

Swells lift, pitch and roll the hull, and turns produce a small bank. Currents carry an unanchored
boat; the helm needs forward motion or propeller wash to turn. Rendered water uses the same
analytic swell slopes and simulation time as the hull. The shoreline polygons stay flat: this
version adds moving normals, not displaced surf, breaking waves, tides or a fluid simulation.
Wind-driven sailing, capsize/damage, deck walking, and carrying loose cars/cargo are not included.

## Host API

`mountEarthView` accepts `water: { waves, current }`. Empty `waves` gives calm water;
`current` is `[east, south]` in meters per second. Each swell has `amplitude` and `wavelength`
in meters, `direction` in radians (zero towards +Z/south), and propagation `speed` in m/s.
The default is mild coastal chop with no current. A host can author stronger seas and currents
for a route or challenge; these are authored conditions, not live ocean observations.

```ts
const view = await mountEarthView({
  canvas, terrain, content, camera,
  water: {
    waves: [{ amplitude: 0.4, wavelength: 22, direction: 0.7, speed: 4 }],
    current: [0.5, 0],
  },
});
view.setMode('drive', { vehicle: 'molen.entities.watercraft.speedboat', force: true });
```

Boats use the existing `drive` navigation mode. `vehicleStatus()` distinguishes `kind: 'boat'`
and includes `anchored` and `grounded`, alongside speed, heading, camera view and streaming status.
For a persistent boat, call `view.vehicles.spawn({ type, latitude, longitude, heading })`, await
`whenPlaced(id)`, and call `board(id, { force: true })`. It survives release and frame re-anchoring.
Use `view.actors.setBehaviour(actor, { kind: 'board', vehicle: id })` for a passenger, and
`{ kind: 'alight' }` to leave by the same stopped, dry-exit rules. See [actors](earth-view.md#actors-companions-and-npcs).

Hosts composing a viewer directly can use `EarthVehicles.spawn`, `spawnNear`, `board`, `unmount`
and `boatTypeIds`, with the same `water` settings and optional `waterAt` callback. `EarthWater`
provides the rendered-water sampler. Its `sync()` refreshes visible mesh coverage after streaming.
The callback receives absolute metric X/Z in the current terrain frame, not longitude/latitude.

## Headless simulation

Import from `@bendyline/molen-kernel/boats`; no DOM or three.js is required.

```ts
import { installBoats, driveBoat } from '@bendyline/molen-kernel/boats';
import { mountEntity, unmountEntity } from '@bendyline/molen-kernel/vehicles';

export function setup(world) {
  installBoats(world, {
    waterAt: (x, z) => ({ height: 0, depth: 8 }),
    conditions: { waves: [], current: [0.3, 0] },
  });
  // Scene entities supply 'launch' (a boat type) and 'person' (with a transform).
  world.registerCommand('board', () => mountEntity(world, 'person', 'launch'));
  world.registerCommand('helm', (_world, command) => driveBoat(world, 'person', command.payload));
  world.registerCommand('alight', () => unmountEntity(world, 'person', {
    groundHeight: (x, z) => dockHeightAt(x, z), // undefined where there is no dry exit
  }));
}
```

Declare the commands normally. Helm payloads contain `throttle` and `steering` in [-1,1] and
`anchor: boolean`. A passenger cannot change the helm. `mountEntity(world, actor, boat, seatId)`
reserves an exclusive seat, and shared seat following carries the rider through the full hull
rotation. Optional `mountable.entries` allow boarding at a gangway far below a raised helm;
`exits` specify local deck-height foot positions. Passenger entry/exit preserves driver input.

`waterAt` returns `{ height, depth?, current? }`, `null` for dry ground, and `undefined` for
unloaded coverage. Surface height is the mean datum; the solver adds waves. Per-point current
replaces the global current. `canOccupy(position, yaw, spec, id)` adds collision checks against
docks, bridges and other boats. Without it, only water coverage and depth constrain motion.
`conditions` may instead come from a world's registered `water` component. `boat`, `boatInput`
and `boatState` are registered components, saved with seats and transforms in snapshots. Restore
the same environment and systems to replay. Ambient vessels keep their route solver until a host
explicitly turns one into a player vessel; the hull system skips `ambientAgent` entities.

`stepBoat`, `boatSupport`, `initialBoatState`, and `sampleWaves` are also public for custom hosts.
Only one motion solver should own a boat's transform; do not attach a car solver or rigid body too.
