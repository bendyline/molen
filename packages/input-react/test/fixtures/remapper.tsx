import { type InputGamepad, InputMap } from '@bendyline/molen-client';
import type { InputProfile } from '@bendyline/molen-schema';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { InputRemapper, useInputDevices } from '../../src/index';

declare global {
  interface Window {
    pads: InputGamepad[];
    saved: InputProfile | undefined;
    controls: InputMap;
  }
}
window.pads = [
  {
    id: 'Test flight stick',
    index: 2,
    mapping: '',
    connected: true,
    axes: Array(8).fill(0),
    buttons: [{ pressed: false, value: 0 }],
  },
];
const defaults: InputProfile = {
  bindings: { KeyF: 'flaps.up' },
  buttons: [{ button: 0, action: 'flaps.fullUp' }],
  axes: [{ action: 'pitch', axis: 1 }],
};
Object.defineProperty(navigator, 'getGamepads', { value: () => window.pads });
window.controls = new InputMap({ ...defaults, target: window });
function Editor() {
  const [profile, setProfile] = useState(defaults);
  const { devices, status } = useInputDevices(window.controls, { suspend: true });
  const change = (next: InputProfile): void => {
    window.controls.defineProfile(undefined, next);
    setProfile(next);
  };
  return (
    <InputRemapper
      value={profile}
      onChange={change}
      actions={[
        { id: 'flaps.up', label: 'Flaps up one step' },
        { id: 'flaps.fullUp', label: 'Flaps fully up' },
        { id: 'pitch', label: 'Pitch' },
      ]}
      devices={devices}
      status={status}
      onSave={() => {
        window.saved = profile;
      }}
      onReset={() => change(structuredClone(defaults))}
    />
  );
}
createRoot(document.getElementById('root') as HTMLElement).render(<Editor />);
