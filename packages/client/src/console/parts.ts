// A part of the vehicle console: one control or dial, drawn as a small scene of its own into a
// rectangle of the console strip.

import * as THREE from 'three';
import type { AircraftInstrumentView } from '../aircraft-instruments';
import type { ModelSignals } from '../model-signals';
import { type ConsoleView, fitCamera, sweptBounds } from './camera';

export interface ConsolePart {
  readonly id: string;
  readonly scene: THREE.Scene;
  readonly camera: THREE.Camera;
  /** `circle` keeps only the disc inscribed in the part's rectangle (a dial cropped square). */
  readonly mask?: 'circle';
  /**
   * Pose from the readings (`preview`, 0..1, is where a thumb is dragging the control). Returns
   * whether the picture changed since the last pose.
   */
  pose(signals: ModelSignals, preview?: number): boolean;
  /** Fit the camera to a rectangle of this aspect (width / height). */
  fit(aspect: number): void;
  /** Release what the part owns; geometry and materials shared with a vehicle are kept. */
  dispose(): void;
}

/** Values that change when any of `nodes` moves, shows or hides, or changes material. */
function readPose(nodes: readonly THREE.Object3D[], out: unknown[]): void {
  out.length = 0;
  for (const node of nodes) {
    const m = node.matrixAutoUpdate ? undefined : node.matrix.elements;
    if (m) out.push(...m);
    else
      out.push(
        node.position.x,
        node.position.y,
        node.position.z,
        node.rotation.x,
        node.rotation.y,
        node.rotation.z,
      );
    out.push(node.visible, (node as THREE.Mesh).material);
  }
}

/** Tells whether a pose differs from the last one it saw. */
function changeWatch(nodes: readonly THREE.Object3D[]): () => boolean {
  let last: unknown[] | undefined;
  const now: unknown[] = [];
  return () => {
    readPose(nodes, now);
    const changed =
      last === undefined || last.length !== now.length || now.some((v, i) => v !== last?.[i]);
    if (changed) last = [...now];
    return changed;
  };
}

/**
 * A control part: `root` posed by `pose`, seen along `view`. `samples` are readings that move
 * it to the ends of its travel, so the camera frames every position.
 */
export function createControlPart(options: {
  id: string;
  root: THREE.Object3D;
  pose: (signals: ModelSignals, preview?: number) => void;
  moving: readonly THREE.Object3D[];
  view: ConsoleView;
  samples: readonly ModelSignals[];
  /** Back to rest after sweeping the samples (bindings hold their last reading otherwise). */
  reset?: () => void;
  dispose?: () => void;
}): ConsolePart {
  const scene = new THREE.Scene();
  scene.add(options.root);
  const bounds = sweptBounds(options.root, (signals) => options.pose(signals), options.samples);
  if (options.reset) options.reset();
  else options.pose({});
  scene.add(new THREE.HemisphereLight('#f4f7ff', '#3a3f48', 1.7));
  const key = new THREE.DirectionalLight('#fff6ea', 2.6);
  scene.add(key, key.target);
  const from = options.view.key ?? [-1.2, 1.6, 0.6];
  let camera = fitCamera(bounds, options.view, 1);
  const light = (): void => {
    // Unless the view says, above and to the left of the camera, a little in front of the part.
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const back = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2);
    const center = bounds.getCenter(new THREE.Vector3());
    key.target.position.copy(center);
    key.position
      .copy(center)
      .addScaledVector(right, from[0])
      .addScaledVector(up, from[1])
      .addScaledVector(back, from[2]);
  };
  light();
  const changed = changeWatch(options.moving);
  return {
    id: options.id,
    scene,
    get camera() {
      return camera;
    },
    pose(signals, preview) {
      options.pose(signals, preview);
      return changed();
    },
    fit(aspect) {
      camera = fitCamera(bounds, options.view, aspect);
      light();
    },
    dispose() {
      key.dispose();
      options.dispose?.();
    },
  };
}

/**
 * A dial: one cropped from the cockpit (`createAircraftInstrumentViews`), whose copies follow the
 * live needles, so it needs the model's world matrices current before `pose`, or one of the kit
 * (`createSpeedometerView`), which reads its own source. Disposing the part disposes a view that
 * owns its resources.
 */
export function createGaugePart(id: string, view: AircraftInstrumentView): ConsolePart {
  view.scene.background = null;
  const copies: THREE.Object3D[] = [];
  view.scene.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) copies.push(node);
  });
  const changed = changeWatch(copies);
  return {
    id,
    scene: view.scene,
    camera: view.camera,
    mask: 'circle',
    pose() {
      view.sync();
      return changed();
    },
    fit() {},
    dispose() {
      view.dispose?.();
    },
  };
}
