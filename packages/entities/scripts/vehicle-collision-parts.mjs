/** Authored node hierarchy supplies independent wheel and exterior-panel collision ownership. */
import { Box3, Matrix4, Vector3 } from 'three';

const rounded = (v) => Number(v.toFixed(6));
const array = (v) => v.toArray().map(rounded);
const name = (node) => node.userData.name ?? node.name;

export function completeVehicleCollisionParts(model, vehicle) {
  const { spec, visual } = vehicle;
  model.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(model.matrixWorld).invert();
  const selected = [];
  model.traverse((node) => {
    const n = name(node);
    if (
      visual.wheelNodes.includes(n) ||
      /^(door(?:Front|Rear)|hood$|trunk$|bumper|mirror)/i.test(n)
    )
      selected.push(node);
  });
  const roots = selected.filter((node) => {
    for (let parent = node.parent; parent && parent !== model; parent = parent.parent)
      if (selected.includes(parent)) return false;
    return true;
  });
  const parts = [];
  for (const node of roots) {
    const n = name(node);
    if (parts.some((p) => p.nodes.includes(n))) continue;
    const bounds = new Box3();
    node.traverse((child) => {
      const positions = child.geometry?.getAttribute('position');
      if (!positions) return;
      const matrix = new Matrix4().multiplyMatrices(inverse, child.matrixWorld);
      for (let i = 0; i < positions.count; i++)
        bounds.expandByPoint(new Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix));
    });
    if (bounds.isEmpty()) continue;
    const wheel = visual.wheelNodes.includes(n);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const radius = wheel
      ? spec.wheelRadius * 0.9
      : Math.max(0.08, Math.min(0.22, Math.max(size.x, size.y, size.z) / 4));
    const part = {
      id: n.replace(/[^a-zA-Z0-9_-]/g, '-'),
      role: wheel ? (visual.frontWheelNodes.includes(n) ? 'frontWheel' : 'rearWheel') : 'panel',
      center: array(center),
      radius: rounded(radius),
      massFraction: wheel ? 0.02 : 0.01,
      breakSpeed: wheel ? 12 : /mirror/i.test(n) ? 3 : /bumper/i.test(n) ? 6 : 9,
      nodes: [n],
      probes: [],
    };
    if (wheel) part.probes.push(array(center));
    else {
      // Bound sampling per part; sphere centers stay inside the bounds, including the ends.
      const count = [size.x, size.y, size.z].map((v) =>
        Math.min(4, Math.max(1, Math.ceil(v / (radius * 1.5)))),
      );
      for (let x = 0; x < count[0]; x++)
        for (let y = 0; y < count[1]; y++)
          for (let z = 0; z < count[2]; z++) {
            const indices = [x, y, z];
            part.probes.push(
              ['x', 'y', 'z'].map((axis, i) =>
                rounded(
                  count[i] === 1
                    ? center[axis]
                    : bounds.min[axis] +
                        Math.min(radius / 2, size[axis] / 2) +
                        ((size[axis] - Math.min(radius, size[axis])) * indices[i]) / (count[i] - 1),
                ),
              ),
            );
          }
      const binding = visual.animation?.bindings.find(
        (b) => b.node === n && b.property === 'rotation' && b.scale !== undefined && !b.keys,
      );
      const source = binding && visual.animation.sources?.[binding.source];
      if (
        source?.component === 'vehicleState' &&
        source.path?.[0] === 'actuators' &&
        source.path.length === 2 &&
        !(binding.offset ?? 0)
      ) {
        const matrix = new Matrix4().multiplyMatrices(inverse, node.matrixWorld);
        const axis = new Vector3();
        axis[binding.axis] = 1;
        const pivot = new Vector3().setFromMatrixPosition(matrix);
        part.hinge = {
          pivot: array(pivot),
          axis: array(axis.transformDirection(matrix)),
          angle: binding.scale,
          actuator: source.path[1],
        };
        part.center = array(pivot);
      }
    }
    parts.push(part);
  }
  if (parts.length) spec.collisionParts = parts;
}
