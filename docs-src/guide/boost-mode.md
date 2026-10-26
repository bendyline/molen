# Boost mode

Boost mode makes people and vehicles travel at **4× normal speed**. It starts off. In Earth view,
press **T** while walking, driving or piloting to toggle it, or use the host API:

```ts
const view = await mountEarthView({ ...options, boostMode: true });
view.setBoostMode(false);
view.on('boostchange', ({ enabled }) => updateBoostButton(enabled));
console.log(view.boostMode);
```

The setting persists across navigation changes and geographic re-anchors. It covers walking and
running, companions and NPC actors, cars, cycles, boats, fixed-wing aircraft, helicopters and
powered-lift aircraft. Ambient traffic and pedestrians also use it, including trains and vessels.
Software controls can trigger the same toggle with the `nav-boost` navigation action.

This is a travel assist. At a given power setting, a plane that cruises at 250 knots travels at
about 1,000 knots in boost mode. Acceleration and translation scale together; steering, flight
controls, engine spool, gear/flap travel and the world clock keep their normal response times.
The flight solver uses normal handling speeds for aerodynamic forces, stalls and overspeed
limits, then reports the boosted velocity, airspeed, equivalent airspeed and Mach. A 4× speed
readout therefore does not by itself trigger a stall, excessive lift or an overspeed warning.
Aircraft climb and descent are boosted too. Ground vehicles retain their ordinary suspension
and gravity; people retain their normal jump height. Waves and buoyancy keep their normal timing.
Wind and water currents stay in world meters per second.

Changing modes immediately rescales travel velocity without changing position, attitude or
throttle. This is useful for returning to normal speed near a destination. Collision and
terrain-coverage checks still apply; missing terrain pauses movement instead of allowing a
vehicle to travel through an unloaded area. Braking takes roughly the same time, so stopping
distances and turn radii are longer at boosted speed.

## Headless worlds and scenes

Author one `boostMode` component on a settings entity:

```json
{ "id": "travel-settings", "components": { "boostMode": { "enabled": true } } }
```

Or change it through the kernel:

```ts
import { isBoostMode, setBoostMode } from '@bendyline/molen-kernel/world';

setBoostMode(world, true);
console.log(isBoostMode(world));
```

The built-in character, vehicle, aircraft, boat and ambient systems read it each tick. It is ECS
state, so checkpoints preserve it. For deterministic input replay, invoke the setter from a
registered command handler, or patch the settings component from a scene command script.

Direct `stepVehicle`, `stepAircraft` and `stepBoat` callers can pass `boostMode: true` in their
environment. Installed vehicle systems and `installCharacterController` accept the same optional
override; leaving it unset follows the world's setting. A standalone client `WalkController`
has a mutable `boostMode` property.

Vehicle, aircraft, boat and ambient state carry an optional, kernel-owned `boosted` flag so
switching modes and restoring snapshots do not apply the multiplier twice. Their speed fields
remain actual travel speeds in m/s. Autopilots comparing telemetry against unboosted authored
specifications should divide speed by `boostSpeedMultiplier(state.boosted)`, exported alongside
`BOOST_SPEED_MULTIPLIER` from `@bendyline/molen-schema`. Leave the flag intact when copying state.
