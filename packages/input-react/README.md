# Molen input React controls

Optional, controlled React UI for Molen keyboard and joystick profiles. The core client does not
require React. Install `@bendyline/molen-input-react` alongside React 18 or 19.

`InputRemapper` takes `value`, `onChange`, and an `actions` list. Optional `devices`, `status`,
`onSave`, and `onReset` provide live discovery and host-owned persistence. `useInputDevices(input,
{ suspend: true })` polls the shared InputMap and suspends gameplay while the editor is mounted.

The component uses semantic HTML without a CSS framework. Optionally import
`@bendyline/molen-input-react/style.css` for a responsive baseline, or style `className`, fieldsets and
`[data-binding]` rows. Source is included in the published package so hosts can copy and modify it.
For completely custom UI, use InputMap directly; no React component is required.

See [the input guide](../../docs-src/guide/input.md) for profiles, command emission, calibration,
persistence, browser requirements, and a complete integration example.
