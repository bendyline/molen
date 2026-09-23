# @bendyline/molen-input-react

Optional React controls for Molen input profiles: a controlled editor that lets players remap
keys, buttons and joystick axes, with live device discovery and calibration.

Part of [Molen](https://molen.dev), an AI-legible 3D experience engine: a deterministic headless
kernel, a three.js client, and a dev loop an agent can drive end to end.

## Install

```sh
npm i @bendyline/molen-input-react @bendyline/molen-client react
```

Node >= 22.13, ESM only, one `.` export plus an optional `./style.css`. React 18 or 19 and
`@bendyline/molen-client` are peers: the component edits the profiles of the client's `InputMap`.
The core client does not need React.

## Use

```tsx
import { useState } from 'react';
import type { InputMap } from '@bendyline/molen-client';
import { InputRemapper, useInputDevices } from '@bendyline/molen-input-react';
import '@bendyline/molen-input-react/style.css'; // optional, responsive baseline

function Controls({ input }: { input: InputMap }) {
  const [profile, setProfile] = useState(() => input.getProfile('flying'));
  // Mount only while the controls menu is open; unmounting resumes gameplay.
  const { devices, status } = useInputDevices(input, { suspend: true });
  return (
    <InputRemapper
      value={profile}
      onChange={(next) => {
        input.defineProfile('flying', next);
        setProfile(next);
      }}
      actions={[
        { id: 'pitch', label: 'Pitch' },
        { id: 'flaps.up', label: 'Flaps up one step' },
      ]}
      devices={devices}
      status={status}
      onSave={() => localStorage.setItem('controls:flying', JSON.stringify(profile))}
    />
  );
}
```

The editor is controlled: the host owns the profile, the action labels and persistence, and the
component never touches storage. Escape cancels learning a binding.

## What's in it

| Export | For |
| --- | --- |
| `InputRemapper` | Key, button and axis learning; raw device readings; thresholds, calibration, inversion, dead zones and response curves; optional save and reset buttons |
| `useInputDevices(input, { suspend })` | Polls the shared `InputMap` for connected devices and, with `suspend`, pauses gameplay input while the editor is mounted |
| `./style.css` | A responsive baseline with low-specificity selectors; or style `className`, fieldsets and `[data-binding]` rows yourself |

The package also publishes its `src/`, so a host can copy the component and change it. For a
completely custom editor, use the `InputMap` profile methods directly; no React is required.

## Status

0.x, on one fixed version line with every other `@bendyline/molen-*` package. The markup is
semantic HTML with no CSS framework.

## Docs

- [Input profiles and joysticks](https://molen.dev/guide/input): profiles, command emission,
  calibration, persistence, browser requirements and a complete integration example

MIT © Bendyline LLC
