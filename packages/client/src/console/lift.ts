// Copies of a vehicle's own moving controls, lifted out of its model for the vehicle console:
// the stick, a throttle quadrant's levers, a steering wheel. A copy shares the model's geometry
// and materials (it never disposes them), starts from the authored pose its bindings move it
// from, and is posed by the same bindings and readings as the live part.

import type { ModelSignalBinding, ModelSignalSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';
import {
  createModelSignalVisual,
  type ModelSignalVisual,
  modelSignalRestPose,
} from '../model-signals';

export interface LiftedControls {
  /** The copies, in the frame they were lifted from (cockpit axes for a cockpit's parts). */
  root: THREE.Group;
  /** Poses the copies; `update(signals)` with the model's readings. */
  visual: ModelSignalVisual;
  /** The copies' bound nodes, which move. */
  moving: THREE.Object3D[];
}

export interface LiftOptions {
  /** The live model the nodes are in. */
  model: THREE.Object3D;
  /** Controls to copy, each with its subtree. */
  nodes: readonly THREE.Object3D[];
  /** The bindings that move them (and the expressions they read). */
  spec: Pick<ModelSignalSpec, 'derived' | 'bindings'>;
  /** The frame the copies keep their placement in; its axes are the views' axes. */
  frame: THREE.Object3D;
  /** Multiplies the bound travel (negative reverses it); on/off bindings are kept as they are. */
  gain?: number;
  /** Further multipliers by binding source (`pitchInput: -1` reverses just the pitch). */
  gains?: Readonly<Record<string, number>>;
  /** Trims the copy before it is bound (a linkage that would stand in front of a pedal). */
  prune?: (root: THREE.Object3D) => void;
}

/** The node's transform relative to `frame`, from current world matrices. */
function relative(node: THREE.Object3D, frame: THREE.Object3D): THREE.Matrix4 {
  return new THREE.Matrix4().copy(frame.matrixWorld).invert().multiply(node.matrixWorld);
}

/** Whether a node is moved by some model-signal visual. */
export function isBound(node: THREE.Object3D): boolean {
  return modelSignalRestPose(node) !== undefined;
}

/**
 * The node to copy for a control: the control itself, or the highest ancestor below `frame`
 * that a binding also moves (a yoke inside a column that pitches), so the copy moves as a whole.
 */
export function liftTarget(node: THREE.Object3D, frame: THREE.Object3D): THREE.Object3D {
  let target = node;
  for (let parent = node.parent; parent && parent !== frame; parent = parent.parent)
    if (isBound(parent)) target = parent;
  return target;
}

/**
 * The frame a control is drawn in: its nearest ancestor named in `frames` (a cockpit group,
 * which carries the cockpit's own axes), or else the model.
 */
export function controlFrame(
  node: THREE.Object3D,
  model: THREE.Object3D,
  frames: ReadonlySet<string>,
): THREE.Object3D {
  for (let parent = node.parent; parent && parent !== model; parent = parent.parent)
    if (frames.has(parent.name)) return parent;
  return model;
}

export function liftControls(options: LiftOptions): LiftedControls {
  const { model, frame } = options;
  const base = options.gain ?? 1;
  model.updateMatrixWorld(true);
  const root = new THREE.Group();
  root.name = 'console-lift';
  const parents = new Map<THREE.Object3D, THREE.Group>();
  for (const node of options.nodes) {
    const parent = node.parent;
    if (!parent) continue;
    let proxy = parents.get(parent);
    if (proxy === undefined) {
      proxy = new THREE.Group();
      relative(parent, frame).decompose(proxy.position, proxy.quaternion, proxy.scale);
      parents.set(parent, proxy);
      root.add(proxy);
    }
    const copy = node.clone(true);
    // The live parts may stand anywhere their readings put them: start the copy from rest.
    const sources: THREE.Object3D[] = [];
    node.traverse((source) => sources.push(source));
    let index = 0;
    copy.traverse((target) => {
      const source = sources[index++];
      const rest = source === undefined ? undefined : modelSignalRestPose(source);
      if (rest !== undefined) {
        target.position.copy(rest.position);
        target.rotation.copy(rest.rotation);
      }
      // The cockpit's distance cutoff hides small parts through their layers and visibility.
      target.layers.mask = 1;
      target.visible = rest?.visible ?? true;
    });
    proxy.add(copy);
  }
  options.prune?.(root);
  const names = new Set<string>();
  root.traverse((node) => names.add(node.name));
  const bindings = options.spec.bindings
    .filter((binding) => names.has(binding.node))
    .map((binding): ModelSignalBinding => {
      const gain = base * (options.gains?.[binding.source] ?? 1);
      if (gain === 1 || binding.property === 'visible') return binding;
      // Scaled limits; a reversed travel swaps them.
      const ends = [binding.min, binding.max].map((end) =>
        end === undefined ? undefined : end * gain,
      );
      const [min, max] = gain < 0 ? [ends[1], ends[0]] : ends;
      const { min: _min, max: _max, ...rest } = binding;
      return {
        ...rest,
        scale: (binding.scale ?? 1) * gain,
        ...(binding.offset !== undefined ? { offset: binding.offset * gain } : {}),
        ...(binding.keys !== undefined
          ? { keys: binding.keys.map(([at, value]): [number, number] => [at, value * gain]) }
          : {}),
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
      };
    });
  const visual = createModelSignalVisual(root, {
    ...(options.spec.derived !== undefined ? { derived: options.spec.derived } : {}),
    bindings,
  });
  const bound = new Set(bindings.map((binding) => binding.node));
  const moving: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (bound.has(node.name)) moving.push(node);
  });
  return { root, visual, moving };
}
