/** Deterministic authoring utilities: cut real skin into movable panels, preserving UVs/materials. */
import * as T from 'three';

export function pivot(parent, name, at = [0, 0, 0]) {
  const node = new T.Group();
  node.name = name;
  node.position.fromArray(at);
  parent.add(node);
  return node;
}

// A vertex carries every original attribute. Clip in the selected root's coordinate system.
function split(poly, plane) {
  const inside = [],
    outside = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const da = plane(a.position),
      db = plane(b.position);
    (da >= 0 ? inside : outside).push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db),
        v = {};
      for (const key of Object.keys(a)) v[key] = a[key].map((n, j) => n + (b[key][j] - n) * t);
      inside.push(v);
      outside.push(v);
    }
  }
  return [inside, outside];
}
function geometry(polygons, attributes) {
  const data = Object.fromEntries(Object.keys(attributes).map((key) => [key, []]));
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3();
  for (const poly of polygons)
    for (let i = 1; i + 1 < poly.length; i++) {
      a.fromArray(poly[0].position);
      b.fromArray(poly[i].position);
      c.fromArray(poly[i + 1].position);
      if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-18) continue;
      for (const v of [poly[0], poly[i], poly[i + 1]])
        for (const key of Object.keys(data)) data[key].push(...v[key]);
    }
  const result = new T.BufferGeometry();
  for (const [key, values] of Object.entries(data))
    result.setAttribute(key, new T.Float32BufferAttribute(values, attributes[key].itemSize));
  result.normalizeNormals();
  return result;
}

/** Extract the intersection of halfspaces, leaving the complementary skin in place. */
export function extractPanel(root, target, planes, include = () => true) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(),
    meshes = [];
  root.traverse((node) => {
    if (!node.isMesh || !include(node)) return;
    for (let p = node; p && p !== root; p = p.parent)
      if (p === target || p.userData.articulated) return;
    meshes.push(node);
  });
  let count = 0;
  for (const mesh of meshes) {
    if (Array.isArray(mesh.material))
      throw Error(`Panel extraction requires one material: ${mesh.name}`);
    const toRoot = inverse.clone().multiply(mesh.matrixWorld);
    const source = mesh.geometry.clone().applyMatrix4(toRoot);
    const attrs = source.attributes,
      pos = attrs.position,
      index = source.index;
    const kept = [],
      moved = [];
    for (let i = 0; i < (index?.count ?? pos.count); i += 3) {
      let polygon = [0, 1, 2].map((j) => {
        const k = index ? index.getX(i + j) : i + j;
        return Object.fromEntries(
          Object.entries(attrs).map(([name, attr]) => [
            name,
            Array.from({ length: attr.itemSize }, (_, n) => attr.getComponent(k, n)),
          ]),
        );
      });
      const original = polygon;
      const keptStart = kept.length;
      for (const plane of planes) {
        const [inside, outside] = split(polygon, plane);
        if (outside.length >= 3) kept.push(outside);
        polygon = inside;
        if (polygon.length < 3) break;
      }
      if (polygon.length >= 3) moved.push(polygon);
      else {
        // A triangle outside the complete cut volume must stay intact. Keeping intermediate
        // plane splits would tessellate unrelated bodywork again for every door and hatch.
        kept.length = keptStart;
        kept.push(original);
      }
    }
    if (moved.length) {
      mesh.geometry = geometry(kept, attrs).applyMatrix4(toRoot.clone().invert());
      const part = new T.Mesh(geometry(moved, attrs), mesh.material);
      part.name = `${target.name}-${count++}`;
      const sourceNodes = new Set(mesh.userData.liverySourceNodes ?? []);
      for (let ancestor = mesh; ancestor; ancestor = ancestor.parent)
        if (ancestor.name) sourceNodes.add(ancestor.name);
      part.userData.liverySourceNodes = [...sourceNodes];
      target.add(part);
      target.updateWorldMatrix(true, false);
      part.geometry.applyMatrix4(target.matrixWorld.clone().invert().multiply(root.matrixWorld));
    }
    source.dispose();
  }
  target.userData.articulated = true;
  return count;
}

export function boxPlanes(min, max) {
  return [0, 1, 2].flatMap((axis) => [(p) => p[axis] - min[axis], (p) => max[axis] - p[axis]]);
}

export function actuatorBinding(node, source, property, axis, scale, extra = {}) {
  return { node: node.name ?? node, source, property, ...(axis ? { axis } : {}), scale, ...extra };
}

export function actuatorSources(specs, component) {
  return Object.fromEntries(
    Object.keys(specs).map((name) => [name, { component, path: ['actuators', name] }]),
  );
}
