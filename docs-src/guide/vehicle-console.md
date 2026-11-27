# Vehicle console

The vehicle console gives phones and tablets on-screen controls drawn as the vehicle's own. Flying
a P-51, the stick under your left thumb is the P-51's stick, copied out of its cockpit model and
tilting as you push; its rudder pedals sit beside it, its throttle at the right edge with a gear
handle and a flap lever beside that, and its own airspeed and altitude dials between. A car shows
its steering wheel and pedals, a motorcycle its handlebars, a boat its helm, each with a
speedometer between. On foot the console is the plain two-circle stick with jump and use buttons.

Every part is drawn see-through at rest so the view stays clear, and goes solid under a thumb. The
controls work through the same navigation actions as keys and gamepads, and through the aircraft's
control session for levers, so a touch flies exactly as a keyboard does.

## Add it to an Earth view

Pass `console` to `mountEarthView` with the element around the canvas. It shows on touch devices
(any pointer that is coarse, which includes touchscreen laptops) and switches with the mode: the
flown aircraft, the driven vehicle, on foot, and nothing in orbit.

```ts
import { mountEarthView } from '@bendyline/molen-earth/client';

const view = await mountEarthView({
  canvas,
  // ...content, workers
  console: { container: stage }, // `touch: 'always'` shows it on every device
});
view.console?.layout; // where everything went
```

Where the console shows, it takes the place of `touchJoystickContainer`'s plain stick. The flown
aircraft's dials appear in the chase view only, since the cockpit view has its own; a driven
vehicle's speedometer shows in every view, read in the view's `speedUnit` (`'km/h'` by default,
or `'mph'`; a boat's reads knots). Pass `gauges: false` to leave the dials out. `handed: 'left'`
mirrors the console, stick on the right.

## Use it with your own renderer

`@bendyline/molen-client/console` works with any host that has a `NavigationInputSource` and the
vehicle's visual. Tell it what the viewer is in with `setSubject`, and call `update` once per frame
after the frame renders (the dials copy the cockpit's posed meshes):

```ts
import { createVehicleConsole } from '@bendyline/molen-client/console';

const vehicleConsole = createVehicleConsole(stage, { input: input.map, focusTarget: canvas });
vehicleConsole.setSubject({
  kind: 'aircraft',
  visual, // from createAircraftVisual, posed by you each frame
  spec,
  session: () => cockpitSession(), // the pilot's controls: change({ control, value })
  gauges: view === 'chase',
});

function frame(now: number) {
  // ...simulate, pose the visual, render
  vehicleConsole.update(now);
}
```

The subject is an aircraft (`visual`, `spec`, a `session` that applies `applyAircraftControl`), a
vehicle (`visual` from `createVehicleVisual` and the vehicle's or boat's data; `gauges: true` shows
its speedometer, in `speedUnit`), `{ kind: 'walk' }`
or `{ kind: 'free' }` (a free camera with up and down buttons), or `undefined` to hide it. Calling
`setSubject` every frame is cheap: the same vehicle keeps its parts.

## What each vehicle shows

Each control is drawn from the best source the vehicle has:

1. **Its own part.** The console copies the control out of the model (`AircraftVisual.cockpit`
   lists an aircraft's modeled controls), shares its geometry and materials, and moves the copy
   with the same bindings and readings as the cockpit (`AircraftVisual.signals`,
   `VehicleVisual.signals`). Where a cockpit has two seats, the controls nearest the pilot's eye
   are used.
2. **A kit part.** Where the model has no part of its own, or only a placeholder from the bolted-on
   control module, the console draws a generic one: a gear handle with a wheel for a knob and
   gear lamps, a flap lever with a wing-shaped knob and notches, a throttle lever, an engine
   switch, a parking brake, car pedals and a handbrake, and a speedometer for every driven
   vehicle: a car's dashboard dial has no numerals, and a cycle or boat has none. Its face is
   numbered in the host's units a little past the vehicle's top speed (`speedometerScale`), with
   the speed in digits under the hub; `createSpeedometerView` in
   `@bendyline/molen-client/vehicles` builds one for any host.
3. **The plain stick and buttons.** On foot, on boards and skis, and for anything without a lever.

| Vehicle | Left | Right | Middle |
| --- | --- | --- | --- |
| Airplane | stick or yoke, rudder pedals | throttle, gear, flaps, engine, brakes, parking brake; mixture, propeller, speed brake and nozzle behind the drawer on a phone | airspeed and altitude dials in a chase view |
| Helicopter | cyclic, pedals | collective, engine | dials in a chase view |
| Car | steering wheel, pedals | handbrake | speedometer |
| Motorcycle, bicycle, snowmobile | handlebars | brake | speedometer |
| Boat | helm | anchor | speedometer (knots) |
| On foot | plain stick | jump, use | |

Mounted, two buttons at the top corner change the view and leave the vehicle; on foot, one changes
the view.

### Your own toolbar

A page with a toolbar of its own can offer those buttons there instead. Pass
`cornerButtons: false` (in `console` for an Earth view), then draw `view.console.buttons` (each has
a `label`, an SVG `icon` for a 24 x 24 view box and an `action`, and some a `hint` for a tooltip;
`buttonTip(button)` gathers them) and call `tap(action)` when one is
pressed, which presses and releases the action as the corner button would. The list follows the
subject, so read it again when the mode changes. A landscape phone's "more controls" button stays
in the corner.

```ts
const view = await mountEarthView({ canvas, console: { container: stage, cornerButtons: false } });
for (const button of view.console?.buttons ?? []) {
  toolbar.append(iconButton(button.label, button.icon, () => view.console?.tap(button.action)));
}
```

## Controls

- **Stick, wheel and handlebars** are the touch stick (`createTouchJoystick`, drawn invisible
  under the vehicle's part): `nav-forward`, `nav-back`, `nav-left`, `nav-right`.
- **Levers** follow the thumb's travel from where it landed, so touching one never makes it jump.
  The throttle stays where it is left, and moves every engine's lever together.
- **The gear handle** is a throw: drag it past halfway. On the ground the aircraft refuses it, and
  the handle shakes.
- **Flaps** settle on up, half and full.
- **Rudder pedals** slide sideways and center when the thumb lifts (`nav-yaw-left`,
  `nav-yaw-right`).
- **Switches** (engine, parking brake) toggle on a tap. **Brakes**, the car's pedals, the
  handbrake and the anchor work while held (`nav-jump`, `nav-sprint`).

Each control captures its own pointer, so the stick and the throttle work at the same time. The
zones refocus the canvas when touched, so keys keep working on a device with both.

## Tooltips

A mouse or pen resting on a control shows its name, how to work it, and the keys that do the same
("Throttle: drag up for more power", Z C), after a short pause, or at once when moving on from one
control to the next. The keys are read from the input map's active profile each time, so they
follow the mode and any remapping; pass an `input` without `getProfile` to leave them out. The
dials show their names too, when the host passed `focusTarget`: a dial lets touches through to the
world, so the console finds the one under a mouse over that element. A thumb has no hover, so a
phone never shows them.

Each deck item's `tip` (`label`, `hint`, `actions`) says what its tooltip shows; a button's comes
from the button. `itemTip(item)` reads either.

## Layout

The console fills its container and passes touches through between controls. It places controls
by importance:

- **The bottom row.** The stick goes in the bottom-left corner (its touch box keeps the plain
  stick's size and place, 144 pixels at 24 pixels in), and the throttle goes at the right edge,
  with the handles in from it.
- **The dials** go between, when they fit.
- **A landscape phone** keeps one row. What does not fit waits behind a "more controls" button at
  the top.
- **A portrait phone or a tablet** (shorter side 600 pixels or more, parts a quarter larger) takes
  a second row.

It publishes the room it takes as CSS custom properties on the container, so a page can lay out
around it:

| Property | Meaning |
| --- | --- |
| `--molen-console-height` | height of the strip from the bottom edge |
| `--molen-console-left`, `--molen-console-right` | width it takes along the bottom from each side |
| `--molen-console-buttons` | width of the button cluster in the top corner |

```css
#help { bottom: calc(26px + var(--molen-console-height, 0px)); }
```

To keep clear of a phone's notch and home indicator, set `--molen-console-inset-left`, `-right`,
`-top` and `-bottom` on the container, for example to `env(safe-area-inset-left)`.

## Drawing and cost

All parts draw into one transparent canvas along the bottom edge through one small WebGL context of
its own, not the main renderer. It draws only when something moved, faded or changed size, and
the dials at most 20 times a second; a console nobody touches costs no draws. Each part is a small
scene with its own camera: the throttle, handles and switches face you head-on from the
operator's seat, a little from above so a lever's travel shows (the kit's panels slope back to
face you square, the gear knob a wheel and the flap knob a wing toward you); the stick from the
seat behind it; pedals from the seat, their pads facing you and their tops leaning away. A thin
dark outline keeps parts readable over bright sky and snow. `prefers-reduced-motion` turns off the
fades.

Without WebGL the controls still work, drawn as labelled outlines, with the two-circle stick.

## Gotchas

- Call `update` after the frame renders: the dials copy world matrices the render poses.
- A copied part starts from the pose its bindings move it from, recorded when the visual was
  created, so it is right even if the live part has moved since.
- A stick, yoke or pair of pedals always moves the way the thumb does: forward for nose down,
  the right pedal forward for right rudder. The console measures each copy against the
  convention in the [vehicle interiors guide](vehicle-interiors.md) and reverses a channel a model
  binds the other way, so the console can move where a model's own cockpit does not.
- Pedals stand at one lean in the console whatever their model's: seen from above, an upright pad
  reads as leaning toward you. Each copy is measured (by its pad's broad face, or its arm for a
  plain tube) and turned about its middle until its top leans 33 degrees away.
