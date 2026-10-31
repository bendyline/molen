import * as THREE from 'three';
import {
  type AircraftInstrumentSource,
  type AircraftInstrumentView,
  createAircraftInstrumentViews,
} from './aircraft-instrument-views';
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
  let renderer: THREE.WebGLRenderer | undefined;
  let model: THREE.Object3D | undefined;
  let views: AircraftInstrumentView[] = [];
  let lastFrame = -Infinity;
  let unavailable = false;
  return {
    update(source, external, nowMs) {
      const shown = enabled && external && source !== undefined && !unavailable;
      panel.hidden = !shown;
      if (!shown) {
        lastFrame = -Infinity;
        if (!source && model) {
          model = undefined;
          views = [];
          renderer?.renderLists.dispose();
        }
        return;
      }
      if (model !== source.model) {
        model = source.model;
        views = createAircraftInstrumentViews(source);
        panel.style.setProperty('--instrument-count', String(views.length));
        renderer?.renderLists.dispose();
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
        lastFrame = -Infinity;
      }
      panel.hidden = views.length === 0;
      if (panel.hidden || nowMs - lastFrame < 50) return;
      lastFrame = nowMs;
      if (!renderer) {
        try {
          renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        } catch (error) {
          console.warn('Aircraft instrument preview unavailable:', error);
          unavailable = true;
          panel.hidden = true;
          return;
        }
      }
      const size = 124;
      if (canvas.width !== Math.round(size * views.length * renderer.getPixelRatio()))
        renderer.setSize(size * views.length, size, false);
      source.model.updateWorldMatrix(true, true);
      renderer.setScissorTest(true);
      for (const [index, view] of views.entries()) {
        view.sync();
        renderer.setViewport(index * size, 0, size, size);
        renderer.setScissor(index * size, 0, size, size);
        renderer.render(view.scene, view.camera);
      }
    },
    dispose() {
      views = [];
      model = undefined;
      renderer?.dispose();
      renderer?.forceContextLoss();
      panel.remove();
    },
  };
}
