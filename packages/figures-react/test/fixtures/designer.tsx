import type { FigureDesignerChange } from '@bendyline/molen-figures/designer';
import { type FigureLook, randomFigureLook } from '@bendyline/molen-figures/look';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FigureDesigner } from '../../src/index';

declare global {
  interface Window {
    changes: FigureDesignerChange[];
    look: FigureLook;
    steer: string;
  }
}

window.changes = [];

function App() {
  const [look, setLook] = useState<FigureLook>(() => randomFigureLook('golden'));
  const [steer, setSteer] = useState<'masculine' | 'feminine' | 'unspecified'>('unspecified');
  window.look = look;
  window.steer = steer;
  return (
    <FigureDesigner
      look={look}
      steer={steer}
      onSteerChange={setSteer}
      onChange={(next, change) => {
        window.changes.push(change);
        setLook(next);
      }}
      strings={{
        'steer.label': 'Gender',
        'steer.masculine': 'Male',
        'steer.feminine': 'Female',
        'steer.unspecified': 'Non-binary',
      }}
      motion="reduced"
    />
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
