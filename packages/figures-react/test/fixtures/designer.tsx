import type { FigureDesignerChange } from '@bendyline/molen-figures/designer';
import { type FigureLook, randomFigureLook } from '@bendyline/molen-figures/look';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FigureDesigner } from '../../src/index';

declare global {
  interface Window {
    changes: FigureDesignerChange[];
    look: FigureLook;
  }
}

window.changes = [];

function App() {
  // The person the golden test's thresholds were measured on.
  const [look, setLook] = useState<FigureLook>(() =>
    randomFigureLook('golden', { steer: 'unspecified' }),
  );
  window.look = look;
  return (
    <FigureDesigner
      look={look}
      onChange={(next, change) => {
        window.changes.push(change);
        setLook(next);
      }}
      motion="reduced"
    />
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
