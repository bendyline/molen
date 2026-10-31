import type { AircraftSpec, ModelSignalSpec } from '@bendyline/molen-schema';
import * as THREE from 'three';

export interface AircraftInstrumentSource {
  model: THREE.Object3D;
  spec: AircraftSpec;
}

export interface AircraftInstrumentView {
  kind: 'speed' | 'altitude';
  node: string;
  unit?: string;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  sync(): void;
}

/** Trace authored unit conversions and numeric-display expressions back to their measurement. */
function measurement(
  name: string,
  spec: ModelSignalSpec,
  visiting = new Set<string>(),
): Set<string> {
  if (visiting.has(name)) return new Set();
  const expression = spec.derived?.[name];
  if (expression) {
    const next = new Set(visiting).add(name);
    return new Set(
      expression.args.flatMap((arg) =>
        typeof arg === 'string' ? [...measurement(arg, spec, next)] : [],
      ),
    );
  }
  const source = spec.sources?.[name];
  if (source) {
    if (source.component === 'aircraftState' && source.path.length === 1)
      return new Set([String(source.path[0])]);
    if (source.component === 'transform' && source.path.join('.') === 'pos.1')
      return new Set(['altitude']);
    return new Set([`${source.component}:${source.path.join('.')}`]);
  }
  return new Set([name]);
}

/** Recover a digital readout's units from its authored conversion, without changing its value. */
function displayUnit(
  source: string,
  spec: ModelSignalSpec,
  kind: 'speed' | 'altitude',
): string | undefined {
  const pending = [source];
  const visited = new Set<string>();
  while (pending.length) {
    const name = pending.shift();
    if (!name || visited.has(name)) continue;
    visited.add(name);
    const expression = spec.derived?.[name];
    if (!expression) continue;
    const [input, factor] = expression.args;
    if (
      typeof input === 'string' &&
      typeof factor === 'number' &&
      expression.args.length === 2 &&
      ['multiply', 'divide'].includes(expression.op)
    ) {
      const roots = measurement(input, spec);
      // Only a conversion directly from the physical measurement, not digit extraction.
      if (!spec.derived?.[input] && roots.size === 1) {
        const scale = expression.op === 'multiply' ? factor : 1 / factor;
        const units: [number, string][] =
          kind === 'speed'
            ? [
                [1.9438444924406046, 'kt'],
                [2.2369362920544025, 'mph'],
                [3.6, 'km/h'],
                [1, 'm/s'],
              ]
            : [
                [1 / 0.3048, 'ft'],
                [1, 'm'],
              ];
        const unit = units.find(([expected]) => Math.abs(scale - expected) < 0.00001)?.[1];
        if (unit) return unit;
      }
    }
    pending.push(...expression.args.filter((arg): arg is string => typeof arg === 'string'));
  }
  return undefined;
}

function boundsIn(node: THREE.Object3D, inverse: THREE.Matrix4): THREE.Box3 {
  const result = new THREE.Box3();
  node.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.computeBoundingBox();
    if (child.geometry.boundingBox)
      result.union(
        child.geometry.boundingBox
          .clone()
          .applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, child.matrixWorld)),
      );
  });
  return result;
}

/**
 * Small crops of the aircraft's actual cockpit geometry. The live meshes supply needle poses,
 * digit visibility, units, face markings and calibration; there is no second instrument model.
 * Meshes share resources with the aircraft and must never be disposed by this preview.
 */
export function createAircraftInstrumentViews({
  model,
  spec,
}: AircraftInstrumentSource): AircraftInstrumentView[] {
  const interior = spec.visual.interior;
  if (!interior) return [];
  model.updateWorldMatrix(true, true);
  const cabins = interior.nodes.flatMap((name) => {
    const node = model.getObjectByName(name);
    return node ? [node] : [];
  });
  const nodes = new Map<string, THREE.Object3D>();
  for (const cabin of cabins) cabin.traverse((node) => nodes.set(node.name, node));
  const result: AircraftInstrumentView[] = [];
  for (const kind of ['speed', 'altitude'] as const) {
    const matches = (source: string): boolean => {
      const roots = measurement(source, interior);
      const allowed =
        kind === 'speed' ? ['airspeed', 'trueAirspeed', 'equivalentAirspeed'] : ['altitude'];
      return roots.size > 0 && [...roots].every((root) => allowed.includes(root));
    };
    // Author order selects the primary station before duplicated or standby instruments.
    const binding = interior.bindings.find(
      (b) =>
        nodes.has(b.node) &&
        matches(b.source) &&
        ((b.property === 'rotation' && b.axis === 'z') ||
          (b.property === 'visible' && b.keys?.length === 11 && b.keys[0]?.[0] === -1)),
    );
    if (!binding) continue;
    const target = nodes.get(binding.node);
    const frame = target?.parent;
    if (!target || !frame) continue;
    const inverse = new THREE.Matrix4().copy(frame.matrixWorld).invert();
    let center: THREE.Vector3;
    let half: number;
    if (binding.property === 'rotation') {
      center = target.position.clone();
      const box = boundsIn(target, new THREE.Matrix4().copy(target.matrixWorld).invert());
      if (box.isEmpty()) continue;
      // A needle occupies about three quarters of its face radius. Enclose the complete bezel,
      // including the other pointers of a multi-needle altimeter, at any needle angle.
      half =
        Math.max(
          Math.abs(box.min.x),
          Math.abs(box.max.x),
          Math.abs(box.min.y),
          Math.abs(box.max.y),
        ) * 1.48;
    } else {
      // numericInstrument's segments share the authored readout frame. Keep all digits together.
      const box = boundsIn(frame, inverse);
      if (box.isEmpty()) continue;
      center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      half = Math.max(size.x * 0.65, size.y * 1.4);
    }
    if (!Number.isFinite(half) || half <= 0) continue;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101719');
    scene.add(new THREE.AmbientLight(0xffffff, 3));
    const camera = new THREE.OrthographicCamera(
      -half,
      half,
      half,
      -half,
      Math.max(0.001, half * 2 - 0.012),
      half * 2 + 0.04,
    );
    camera.position.copy(center).add(new THREE.Vector3(0, 0, -half * 2));
    camera.lookAt(center);
    camera.updateMatrixWorld();
    // Only retain meshes intersecting the crop, including hidden digits that may light later.
    const crop = new THREE.Box3(
      center.clone().add(new THREE.Vector3(-half, -half, -0.025)),
      center.clone().add(new THREE.Vector3(half, half, 0.035)),
    );
    const copies: { source: THREE.Mesh; copy: THREE.Mesh }[] = [];
    const seen = new Set<THREE.Object3D>();
    for (const cabin of binding.property === 'visible' ? [frame] : cabins)
      cabin.traverse((source) => {
        if (!(source instanceof THREE.Mesh) || seen.has(source)) return;
        seen.add(source);
        if (!boundsIn(source, inverse).intersectsBox(crop)) return;
        const copy = new THREE.Mesh(source.geometry, source.material);
        copy.name = source.name;
        copy.matrixAutoUpdate = false;
        copies.push({ source, copy });
        scene.add(copy);
      });
    const sync = (): void => {
      inverse.copy(frame.matrixWorld).invert();
      for (const { source, copy } of copies) {
        copy.matrix.multiplyMatrices(inverse, source.matrixWorld);
        copy.matrixWorldNeedsUpdate = true;
        copy.visible = true;
        // Camera-distance culling of the cockpit must not blank a fly-by's mini instruments.
        for (let node: THREE.Object3D | null = source; node && node !== model; node = node.parent)
          if (!node.visible && !cabins.includes(node)) copy.visible = false;
      }
    };
    sync();
    result.push({
      kind,
      node: binding.node,
      ...(binding.property === 'visible'
        ? { unit: displayUnit(binding.source, interior, kind) }
        : {}),
      scene,
      camera,
      sync,
    });
  }
  return result;
}
