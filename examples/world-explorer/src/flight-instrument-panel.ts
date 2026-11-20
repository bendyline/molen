import {
  type AircraftInstrumentSource,
  type AircraftInstrumentView,
  createAircraftInstrumentDisplay,
  createAircraftInstrumentViews,
} from '@bendyline/molen-client/aircraft';
import type * as THREE from 'three';
import './flight-instrument-panel.css';

/** A single small canvas, rendered at 20 Hz only while piloting in an external view. */
export function createFlightInstrumentPanel(enabled = true): {
  update(source: AircraftInstrumentSource | undefined, external: boolean, nowMs: number): void;
  dispose(): void;
} {
  const panel = document.createElement('aside');
  panel.id = 'flight-instruments';
  panel.setAttribute('aria-label', 'Aircraft instruments');
  panel.hidden = true;
  const title = document.createElement('div');
  title.className = 'flight-instruments-title';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  panel.append(title, canvas);
  document.body.append(panel);
  // Its own small WebGL context, made on the first draw and built before it is shown.
  const display = createAircraftInstrumentDisplay(canvas);
  let model: THREE.Object3D | undefined;
  let views: AircraftInstrumentView[] = [];
  return {
    update(source, external, nowMs) {
      if (!enabled || !external || source === undefined) {
        panel.hidden = true;
        if (!source && model) {
          model = undefined;
          views = [];
        }
        return;
      }
      if (model !== source.model) {
        model = source.model;
        views = createAircraftInstrumentViews(source);
        panel.style.setProperty('--instrument-count', String(views.length));
        title.textContent = source.spec.label;
        const instrumentNames = views
          .map(
            (view) =>
              `${view.kind === 'speed' ? 'Airspeed' : 'Altitude'}${view.unit ? ` · ${view.unit}` : ''}`,
          )
          .join(', ');
        canvas.setAttribute(
          'aria-label',
          `${source.spec.label}: ${instrumentNames}. Live cockpit instruments.`,
        );
      }
      // The frame has not rendered yet: pose the cockpit from this frame's transforms.
      panel.hidden = !display.update(views, nowMs, () =>
        source.model.updateWorldMatrix(true, true),
      );
    },
    dispose() {
      views = [];
      model = undefined;
      display.dispose();
      panel.remove();
    },
  };
}
