# Input profiles and joystick remapping

Molen maps physical controls to **named actions**, then actions to simulation commands. Profiles
are complete binding sets for use cases such as walking, driving, flying, or menus. The host
selects the profile when gameplay changes; an action name has no built-in physics behavior.

The core API is `InputMap` from `@bendyline/molen-client`. The optional
`@bendyline/molen-input-react` package provides a controlled, modifiable React editor. Hosts can
instead build their entire UI with the same profile and device APIs. React is not a dependency
of the core client.

## Browser support and device discovery

The default adapter polls `navigator.getGamepads()`, the browser facility for gamepads, joysticks,
wheels, pedals, and similar devices. It accepts raw indices even when `mapping` is empty; it
never assumes every device has an Xbox layout. Use HTTPS or localhost. The browser may require
a controller button press with the page focused before exposing devices. An iframe may also
need the embedding page's `gamepad` Permissions Policy permission. Only devices/controls exposed
by that browser and OS are available; Molen cannot discover missing hardware through this API.
See the [Gamepad specification](https://www.w3.org/TR/gamepad/) and
[MDN usage guide](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API).

`input.update()` obtains fresh snapshots; `input.devices()` returns detached copies with `id`,
`index`, `mapping`, raw `axes`, and raw `buttons` (`pressed` and `value`). Poll every animation
frame in a custom host. `mountExperience`/`applyInputRules` poll automatically (default 50 ms;
use `pollMs: 16` for more responsive controls). `gamepadStatus` reports `available`, `unavailable`,
or `blocked`. An available API can still have no detected devices.

Bindings may select an exact `device.id`, a browser `device.index`, both, or neither (any device).
Indices can change on reconnect; IDs are browser-provided and are not guaranteed unique. Let
users choose again when connecting identical devices or changing browsers. Omitted/missing
indices are neutral. Unplugging or losing API access releases the device's contributions.

A custom `getGamepads` callback can supply the same structural snapshots, so a host can adapt
another facility, such as a device-specific WebHID integration, without changing profiles or UI.
Molen does not itself request WebHID permission or implement device-specific HID reports.

## Software controls

On-screen controls feed the same actions as physical devices. `input.setVirtual(source, action,
value)` sets a named control's contribution, for example a touch stick pushing `move-forward` to
0.6, and `input.clearVirtual(source)` releases everything it drives. As with other devices, the
strongest contribution to an action wins. Software values persist until changed, and a reset
(focus loss, suspension, profile switch) releases them. `createTouchJoystick` in
[`@bendyline/molen-client/navigation`](navigation.md) is a ready-made stick built on this.

## Define and switch profiles

```ts
import { InputMap } from '@bendyline/molen-client';

const input = new InputMap({
  bindings: {},
  target: window,
  profile: 'walking',
  profiles: {
    walking: {
      bindings: { KeyW: 'forward', KeyS: 'back', Space: 'jump' },
      axes: [
        { axis: 1, action: 'forward', mode: 'negative' },
        { axis: 1, action: 'back', mode: 'positive' },
      ],
      buttons: [{ button: 0, action: 'jump' }],
    },
    driving: {
      bindings: { KeyA: 'left', KeyD: 'right', Space: 'brake' },
      axes: [{ axis: 0, action: 'right', deadZone: 0.08 }],
      buttons: [{ button: 1, action: 'brake' }],
    },
    flying: {
      bindings: { KeyF: 'flaps.up', KeyU: 'flaps.fullUp', KeyW: 'pitchDown' },
      axes: [
        { axis: 1, action: 'pitch', invert: true, deadZone: 0.08, curve: 1.5 },
        { axis: 3, action: 'throttle', mode: 'unit', invert: true },
      ],
      buttons: [
        { button: 4, action: 'flaps.up' },
        { button: 5, action: 'flaps.fullUp' },
      ],
    },
  },
});

// Call when boarding a plane. Use setProfile(undefined) to select the root bindings.
input.setProfile('flying');
input.update(); // repeat in your frame loop
const pitch = input.value('pitch') - input.value('pitchDown');
const off = input.onPress('flaps.fullUp', () => sendCommand('flaps', { position: 0 }));
// On host disposal: off(); input.dispose();
```

These indices are examples, not universal controller layouts. Use discovery/learning to bind
actual hardware. `getProfile(name)` returns a detached JSON-compatible profile (`getProfile()` reads the active one);
`defineProfile(name, profile)` validates and replaces it atomically. Pass `undefined` for the root
profile. `profileNames()` lists named profiles; `activeProfile` is the selection.
`onProfilesChanged` lets custom UI observe selection or definition changes.

Keyboard/mouse bindings retain the existing `KeyboardEvent.code` / `Mouse<button>` format.
Buttons produce 0 or 1 and support an analog press `threshold` (default 0.5). Multiple bindings
can feed the same action: the greatest absolute value wins, with keyboard winning ties. Releasing
one source does not release an action while another source still holds it. For signed keyboard
axes, map two named actions and subtract them, as in the example or the scalar emit rule below.
`isActive` means a nonzero value; `onPress` and `onRelease` detect zero/nonzero edges. Use numeric
values for continuous steering/pitch rather than treating analog axes as one-shot buttons.

Axis modes are `signed` (-1..1), `positive` or `negative` (one half of travel, 0..1), and `unit`
(full travel, 0..1 for throttles). Raw `min`, `center`, `max` calibrate travel; they must be ordered
`min < center < max`. `invert` reverses travel before selecting the mode. The rescaled `deadZone`
is 0.12 by default (0 for unit axes); `curve` is a positive exponent, default 1. Values beyond
calibrated endpoints are clamped. Use separate positive/negative bindings for existing `axis2d`
actions such as left/right, preserving analog strength.

Switching/replacing the active profile releases previous actions. Held keys/buttons must be
released before they can trigger their new mapping; axes resume from the next sample. `reset`
neutralizes actions, `setEnabled(false)` disables gameplay, and `suspend()` returns an idempotent
resume function for temporary menus/editors. Device discovery continues while suspended. DOM
bindings ignore form controls and editable elements; browser blur releases input and suspends
it until focus returns. Dispose removes listeners. Hosts with their own focus/visibility model
can call `setEnabled` or `suspend` explicitly.

## Scene data and replay

The scene `input` block accepts the same `profiles`, initial `profile`, `axes`, and `buttons`,
alongside the existing `bindings` and `emit`. `mountExperience` returns its live `input` map, so
hosts can switch profiles and apply saved overrides. Validate the complete scene using
`molen validate scene.json`; unknown actions/profile names and invalid calibration are reported.

```json
{
  "bindings": {},
  "profile": "flying",
  "profiles": {
    "flying": {
      "bindings": { "KeyF": "flaps.up", "KeyU": "flaps.fullUp", "KeyW": "pitchDown" },
      "axes": [{ "axis": 1, "action": "pitch", "invert": true }],
      "buttons": [{ "button": 4, "action": "flaps.up" }, { "button": 5, "action": "flaps.fullUp" }]
    }
  },
  "emit": [
    { "kind": "press", "action": "flaps.up", "command": "flaps", "payload": { "step": -1 } },
    { "kind": "press", "action": "flaps.fullUp", "command": "flaps", "payload": { "position": 0 } },
    { "kind": "axis", "action": "pitch", "negative": "pitchDown", "command": "pitch", "field": "value" }
  ]
}
```

This is the `input` block, not a full scene. Declare `flaps` and `pitch` under scene `commands`
and implement their handlers. The distinction between a step and an absolute position belongs
to those handlers; profiles merely choose the action/payload. Existing aircraft handlers that
only support a boolean flap position need game logic changes to support intermediate detents.

`axis` emits a numeric field (default `value`), optionally subtracting a `negative` action.
`axis2d` now uses analog strength too and retains its existing four-action shape. Values are
clamped to -1..1 and emitted only when changed; explicit resets send neutral values immediately.
Emit rules are shared across profiles: use distinct action names for profile-specific commands.

Device polling stays on the client. Only emitted commands cross into the kernel, so existing
command validation, recording, simulation and replay continue to work without browser devices.
Replay recorded commands, not live hardware samples.

## Optional React editor

Install `@bendyline/molen-input-react` alongside React 18 or 19. `InputRemapper` is controlled and
unstyled: hosts supply the profile, action labels and callbacks. It offers key/button/axis
learning, raw device readings, manual axis/button selection, thresholds, calibration, inversion,
dead zones, response curves, removal, and optional save/reset buttons. Escape cancels learning;
learning replaces existing mappings for that physical control, including an overlapping
"any controller" mapping. Use the manual Add controls for intentional multiple-action bindings.

```tsx
import { useState } from 'react';
import type { InputMap } from '@bendyline/molen-client';
import { InputRemapper, useInputDevices } from '@bendyline/molen-input-react';
import '@bendyline/molen-input-react/style.css'; // optional, responsive baseline

function Controls({ input }: { input: InputMap }) {
  const [name, setName] = useState('flying');
  const [profile, setProfile] = useState(() => input.getProfile(name));
  // Mount only while the controls menu is open. Cleanup resumes gameplay.
  const { devices, status } = useInputDevices(input, { suspend: true });
  return <>
    <label>Profile <select value={name} onChange={event => {
      setName(event.target.value);
      setProfile(input.getProfile(event.target.value));
    }}>
      {input.profileNames().map(name => <option key={name}>{name}</option>)}
    </select></label>
    <InputRemapper
      className="my-controls"
      value={profile}
      onChange={next => { input.defineProfile(name, next); setProfile(next); }}
      actions={[
        { id: 'pitch', label: 'Pitch' },
        { id: 'pitchDown', label: 'Pitch down' },
        { id: 'flaps.up', label: 'Flaps up one step' },
        { id: 'flaps.fullUp', label: 'Flaps fully up' },
      ]}
      devices={devices} status={status}
      onSave={() => localStorage.setItem(`controls:${name}`, JSON.stringify(profile))}
    />
  </>;
}
```

Supply an action list appropriate to the selected profile in a multi-mode host. Editing a profile
does not select it for gameplay; gameplay selects via `setProfile`. Restore defaults with
`onReset`, and load saved JSON through `defineProfile` (catch malformed or obsolete storage and
fall back to your defaults). Storage availability and schema/version migrations belong to the host.

The optional `style.css` provides a responsive baseline with low-specificity selectors.
Style fieldsets and `[data-binding="key"|"button"|"axis"]` rows under `className`. The package
includes `src/` so a host can copy/modify the component. A completely custom editor can use
`getProfile`, `defineProfile`, `devices`, `suspend`, and the exported `InputProfile` types with no
React dependency. No storage writes or permission prompts occur unless the host supplies them.
