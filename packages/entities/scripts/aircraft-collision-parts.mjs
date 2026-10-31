/** Derive swept discs from the same named geometry the rotor animator drives. No GLB edits. */
import { Matrix4, Vector3 } from 'three';

const rounded = (v) => Number(v.toFixed(6));
const array = (v) => v.toArray().map(rounded);
const name = (node) => node.userData.name ?? node.name;

export function completeAircraftCollisionParts(model, spec) {
  if (!spec.visual.rotors.length) return;
  const parts = spec.collisionParts ?? [
    {
      id: 'body',
      role: 'body',
      center: spec.centerOfMass,
      massFraction: 1,
      nodes: [],
      probes: spec.model === 'helicopter' ? spec.collisionProbes.slice(0, 2) : spec.collisionProbes,
      radius: 0.3,
    },
  ];
  for (const binding of spec.visual.rotors) {
    let rotor,
      vertexCount = -1;
    model.traverse((node) => {
      if (name(node) !== binding.node) return;
      let count = 0;
      node.traverse((child) => {
        count += child.geometry?.getAttribute('position')?.count ?? 0;
      });
      if (count > vertexCount) {
        rotor = node;
        vertexCount = count;
      }
    });
    if (!rotor) throw Error(`${spec.label}: missing rotor ${binding.node}`);
    const axis = new Vector3();
    axis[binding.axis] = 1;
    let hinge, animation;
    for (let ancestor = rotor.parent; ancestor && ancestor !== model; ancestor = ancestor.parent) {
      const candidate = spec.visual.animation?.bindings.find(
        (b) =>
          b.node === name(ancestor) && b.source === 'thrustVector' && b.property === 'rotation',
      );
      if (candidate) {
        hinge = ancestor;
        animation = candidate;
        break;
      }
    }
    const original = hinge?.rotation.clone();
    if (hinge) hinge.rotation[animation.axis] += animation.offset ?? 0;
    model.updateWorldMatrix(true, true);
    const inverse = new Matrix4().copy(model.matrixWorld).invert();
    const rotorMatrix = new Matrix4().multiplyMatrices(inverse, rotor.matrixWorld);
    const normal = axis.clone().transformDirection(rotorMatrix);
    const hub = new Vector3().setFromMatrixPosition(rotorMatrix);
    const vertices = [];
    rotor.traverse((node) => {
      const positions = node.geometry?.getAttribute('position');
      if (!positions) return;
      const matrix = new Matrix4().multiplyMatrices(inverse, node.matrixWorld);
      for (let i = 0; i < positions.count; i++) {
        const offset = new Vector3()
          .fromBufferAttribute(positions, i)
          .applyMatrix4(matrix)
          .sub(hub);
        const axial = offset.dot(normal);
        vertices.push({ axial, radial: offset.addScaledVector(normal, -axial).length() });
      }
    });
    const radius = vertices.reduce((r, p) => Math.max(r, p.radial), 0);
    if (radius <= 0) throw Error(`${spec.label}: empty rotor ${binding.node}`);
    const blade = vertices.filter((p) => p.radial >= radius * 0.45);
    const min = Math.min(...blade.map((p) => p.axial)),
      max = Math.max(...blade.map((p) => p.axial));
    const center = hub.clone().addScaledVector(normal, (min + max) / 2);
    const disc = {
      center: array(center),
      normal: array(normal),
      radius: rounded(radius),
      halfThickness: rounded(Math.max(0.06, (max - min) / 2)),
      rotor: binding.node,
    };
    let partCenter = center;
    if (hinge) {
      const matrix = new Matrix4().multiplyMatrices(inverse, hinge.matrixWorld);
      const tiltAxis = new Vector3();
      tiltAxis[animation.axis] = 1;
      partCenter = new Vector3().setFromMatrixPosition(matrix);
      disc.tilt = {
        pivot: array(partCenter),
        axis: array(tiltAxis.transformDirection(matrix)),
        angle: animation.scale ?? 1,
      };
      hinge.rotation.copy(original);
      model.updateWorldMatrix(true, true);
    }
    const owner = parts.find((part) => part.nodes.includes(binding.node));
    const existing =
      parts.find((part) => part.disc?.rotor === binding.node) ??
      (owner?.nodes.length === 1 ? owner : undefined);
    const tailRotor = spec.model === 'helicopter' && Math.abs(normal.y) < 0.5;
    const engine = binding.engine ?? spec.engines?.[0]?.id ?? 'main';
    const part = existing ?? {
      id: `rotor-${binding.node.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
      massFraction: tailRotor ? 0.005 : 0.02,
      breakSpeed: tailRotor ? 5 : 9,
    };
    if (!existing) {
      const support =
        owner ??
        parts.find((candidate) => {
          for (let node = rotor.parent; node && node !== model; node = node.parent)
            if (candidate.nodes.includes(name(node))) return true;
          return false;
        });
      if (support) {
        part.parent = support.id;
        support.nodes = support.nodes.filter((node) => node !== binding.node);
        support.massFraction = rounded(Math.max(0.001, support.massFraction - part.massFraction));
      } else {
        const body = parts.find((p) => p.role === 'body');
        body.massFraction = rounded(body.massFraction - part.massFraction);
      }
      parts.push(part);
    }
    Object.assign(part, {
      role: spec.model === 'helicopter' ? (tailRotor ? 'tailRotor' : 'rotor') : 'engine',
      center: array(partCenter),
      probes: [],
      radius: Math.min(0.3, disc.radius),
      nodes: [binding.node],
      disc,
      engines: tailRotor ? [] : [engine],
    });
  }
  spec.collisionParts = parts;
}
