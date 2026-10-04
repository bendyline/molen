import { MeshoptSimplifier } from 'meshoptimizer';
import { Vector3 } from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const subtract = (a, b) => a.map((v, i) => v - b[i]);
function clip(polygon, axis, boundary, keepAbove) {
  const output = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    const insideA = keepAbove ? a.position[axis] >= boundary : a.position[axis] <= boundary;
    const insideB = keepAbove ? b.position[axis] >= boundary : b.position[axis] <= boundary;
    if (insideA) output.push(a);
    if (insideA !== insideB) {
      const t = (boundary - a.position[axis]) / (b.position[axis] - a.position[axis]);
      const lerp = (key) => a[key].map((v, j) => v + (b[key][j] - v) * t);
      output.push({ position: lerp('position'), uv: lerp('uv'), color: lerp('color') });
    }
  }
  return output;
}

function faces(vertices) {
  if (vertices.length < 3) return [];
  const points = vertices.map((v) => new Vector3(...v.position));
  const indices = new Map(points.map((p, i) => [p, i]));
  // Handle planar architectural sheets separately; a 3D hull needs four noncoplanar points.
  let normal;
  for (let i = 2; i < vertices.length; i++) {
    const candidate = cross(
      subtract(vertices[i - 1].position, vertices[0].position),
      subtract(vertices[i].position, vertices[0].position),
    );
    if (Math.hypot(...candidate) > 1e-8) {
      normal = candidate;
      break;
    }
  }
  if (!normal) return [];
  const length = Math.hypot(...normal);
  normal = normal.map((v) => v / length);
  const planar = vertices.every(
    (v) =>
      Math.abs(
        subtract(v.position, vertices[0].position).reduce((sum, x, i) => sum + x * normal[i], 0),
      ) < 1e-5,
  );
  if (planar) {
    const drop = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),
      axes = [0, 1, 2].filter((a) => a !== drop);
    const sorted = vertices
      .map((_, i) => i)
      .sort(
        (a, b) =>
          vertices[a].position[axes[0]] - vertices[b].position[axes[0]] ||
          vertices[a].position[axes[1]] - vertices[b].position[axes[1]],
      );
    const turn = (a, b, c) => {
      const x = vertices[a].position,
        y = vertices[b].position,
        z = vertices[c].position;
      return (
        (y[axes[0]] - x[axes[0]]) * (z[axes[1]] - x[axes[1]]) -
        (y[axes[1]] - x[axes[1]]) * (z[axes[0]] - x[axes[0]])
      );
    };
    const lower = [],
      upper = [];
    for (const i of sorted) {
      while (lower.length >= 2 && turn(lower.at(-2), lower.at(-1), i) <= 0) lower.pop();
      lower.push(i);
    }
    for (const i of [...sorted].reverse()) {
      while (upper.length >= 2 && turn(upper.at(-2), upper.at(-1), i) <= 0) upper.pop();
      upper.push(i);
    }
    const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)],
      result = [];
    for (let i = 1; i < hull.length - 1; i++) {
      const a = hull[0],
        b = hull[i],
        c = hull[i + 1];
      const n = cross(
        subtract(vertices[b].position, vertices[a].position),
        subtract(vertices[c].position, vertices[a].position),
      );
      if (n.reduce((sum, v, a) => sum + v * normal[a], 0) < 0) result.push(a, c, b);
      else result.push(a, b, c);
    }
    return result;
  }
  const hull = new ConvexHull().setFromPoints(points),
    result = [];
  for (const face of hull.faces) {
    let edge = face.edge;
    const polygon = [];
    do {
      polygon.push(indices.get(edge.head().point));
      edge = edge.next;
    } while (edge !== face.edge);
    for (let i = 1; i < polygon.length - 1; i++)
      result.push(polygon[0], polygon[i], polygon[i + 1]);
  }
  return result;
}

/** Partition source triangles into local convex pieces. Each cell keeps its source material,
 * rather than tearing thin facade sheets by merging opposite sides into one vertex. */
export function convexDerivative(parts, bounds, target, flat = false) {
  const extent = bounds.max.map((v, i) => v - bounds.min[i]),
    largest = Math.max(...extent);
  let grid = largest / Math.sqrt(target / 8);
  let best;
  for (let attempt = 0; attempt < 8; attempt++) {
    const steps = extent.map((v) => Math.min(grid, Math.max(v, 0.001)));
    const group = { cells: new Map(), surfaces: new Map() };
    for (const { primitive, matrix } of parts) {
      const original = primitive.getMaterial();
      const position = primitive.getAttribute('POSITION'),
        uv = primitive.getAttribute('TEXCOORD_0'),
        color = primitive.getAttribute('COLOR_0'),
        indices = primitive.getIndices();
      const factor = [1, 1, 1, 1];
      const get = (i) => {
        const p = position.getElement(i, []);
        return {
          position: [
            matrix[0] * p[0] + matrix[4] * p[1] + matrix[8] * p[2] + matrix[12],
            matrix[1] * p[0] + matrix[5] * p[1] + matrix[9] * p[2] + matrix[13],
            matrix[2] * p[0] + matrix[6] * p[1] + matrix[10] * p[2] + matrix[14],
          ],
          uv: uv?.getElement(i, []) ?? [0, 0],
          color: (color?.getElement(i, []) ?? [1, 1, 1]).slice(0, 3).map((v, a) => v * factor[a]),
        };
      };
      const count = indices?.getCount() ?? position.getCount();
      for (let i = 0; i < count; i += 3) {
        const triangle = [0, 1, 2].map((j) => get(indices ? indices.getScalar(i + j) : i + j));
        const determinant =
          matrix[0] * (matrix[5] * matrix[10] - matrix[9] * matrix[6]) -
          matrix[4] * (matrix[1] * matrix[10] - matrix[9] * matrix[2]) +
          matrix[8] * (matrix[1] * matrix[6] - matrix[5] * matrix[2]);
        if (determinant < 0) [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
        const n = cross(
            subtract(triangle[1].position, triangle[0].position),
            subtract(triangle[2].position, triangle[0].position),
          ),
          area = Math.hypot(...n);
        if (area < 1e-10) continue;
        const normal = n.map((v) => v / area);
        const min = [0, 1, 2].map((a) =>
          Math.floor((Math.min(...triangle.map((v) => v.position[a])) - bounds.min[a]) / steps[a]),
        );
        const max = [0, 1, 2].map((a) =>
          Math.floor((Math.max(...triangle.map((v) => v.position[a])) - bounds.min[a]) / steps[a]),
        );
        for (let x = min[0]; x <= max[0]; x++)
          for (let y = min[1]; y <= max[1]; y++)
            for (let z = min[2]; z <= max[2]; z++) {
              const cell = [x, y, z];
              let polygon = triangle;
              for (let axis = 0; axis < 3 && polygon.length; axis++) {
                polygon = clip(polygon, axis, bounds.min[axis] + cell[axis] * steps[axis], true);
                if (polygon.length)
                  polygon = clip(
                    polygon,
                    axis,
                    bounds.min[axis] + (cell[axis] + 1) * steps[axis],
                    false,
                  );
              }
              if (polygon.length < 3) continue;
              const key = cell.join(',');
              let points = group.cells.get(key);
              if (!points) {
                points = new Map();
                group.cells.set(key, points);
              }
              for (const vertex of polygon)
                points.set(vertex.position.map((v) => Math.round(v * 100000)).join(','), vertex);
              let surfaces = group.surfaces.get(key);
              if (!surfaces) {
                surfaces = [];
                group.surfaces.set(key, surfaces);
              }
              let surface = surfaces.find(
                (s) =>
                  s.material === original &&
                  s.normal.reduce((sum, v, a) => sum + v * normal[a], 0) > 0.99,
              );
              let clippedArea = 0;
              for (let p = 1; p < polygon.length - 1; p++)
                clippedArea += Math.hypot(
                  ...cross(
                    subtract(polygon[p].position, polygon[0].position),
                    subtract(polygon[p + 1].position, polygon[0].position),
                  ),
                );
              if (!surface) {
                surface = { material: original, normal, area: 0, center: [0, 0, 0], triangle };
                surfaces.push(surface);
              }
              const center = [0, 1, 2].map(
                (a) => polygon.reduce((sum, v) => sum + v.position[a], 0) / polygon.length,
              );
              for (let a = 0; a < 3; a++)
                surface.center[a] =
                  (surface.center[a] * surface.area + center[a] * clippedArea) /
                  (surface.area + clippedArea || 1);
              surface.area += clippedArea;
            }
      }
    }
    const groupsByMaterial = new Map();
    let triangles = 0;
    {
      const signatures = new Map();
      const signature = (key, axis, boundary) => {
        const cacheKey = `${key}/${axis}/${boundary}`;
        if (signatures.has(cacheKey)) return signatures.get(cacheKey);
        const points = group.cells.get(key);
        if (!points) return '';
        const keys = [...points]
          .filter(([, v]) => Math.abs(v.position[axis] - boundary) < 1e-5)
          .map(([key]) => key)
          .sort();
        const value = keys.length >= 3 ? keys.join(';') : '';
        signatures.set(cacheKey, value);
        return value;
      };
      for (const [key, points] of group.cells) {
        const local = [...points.values()],
          list = faces(local);
        const cell = key.split(',').map(Number);
        for (let i = 0; i < list.length; i += 3) {
          const triangle = list.slice(i, i + 3);
          let interior = false;
          for (let axis = 0; axis < 3 && !interior; axis++)
            for (const side of [0, 1]) {
              const boundary = bounds.min[axis] + (cell[axis] + side) * steps[axis];
              if (!triangle.every((id) => Math.abs(local[id].position[axis] - boundary) < 1e-5))
                continue;
              const neighbor = [...cell];
              neighbor[axis] += side ? 1 : -1;
              const cap = signature(key, axis, boundary);
              if (cap && cap === signature(neighbor.join(','), axis, boundary)) interior = true;
            }
          if (interior) continue;
          const ps = triangle.map((id) => local[id].position),
            n = cross(subtract(ps[1], ps[0]), subtract(ps[2], ps[0])),
            length = Math.hypot(...n);
          if (length < 1e-9) continue;
          const normal = n.map((v) => v / length),
            center = [0, 1, 2].map((a) => ps.reduce((sum, v) => sum + v[a], 0) / 3);
          const candidates = group.surfaces.get(key) ?? [];
          let chosen,
            score = -Infinity;
          for (const candidate of candidates) {
            const alignment = candidate.normal.reduce((sum, v, a) => sum + v * normal[a], 0);
            const depth = Math.abs(
              subtract(candidate.center, center).reduce((sum, v, a) => sum + v * normal[a], 0),
            );
            const rank =
              (candidate.area * Math.max(0.001, alignment) * Math.max(0.001, alignment)) /
              (1 + depth / Math.max(0.01, grid * 0.02));
            if (rank > score) {
              score = rank;
              chosen = candidate;
            }
          }
          if (!chosen) continue;
          const material = flat ? null : chosen.material;
          let out = groupsByMaterial.get(material);
          if (!out) {
            out = { material, vertices: [], indices: [] };
            groupsByMaterial.set(material, out);
          }
          const [a, b, c] = chosen.triangle,
            u = subtract(b.position, a.position),
            v = subtract(c.position, a.position);
          const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0),
            uu = dot(u, u),
            uv = dot(u, v),
            vv = dot(v, v),
            denominator = uu * vv - uv * uv;
          const color = [0, 1, 2].map(
            (axis) =>
              (chosen.triangle.reduce((sum, v) => sum + v.color[axis], 0) / 3) *
              (flat
                ? (material?.getBaseColorFactor()?.[axis] ??
                  chosen.material?.getBaseColorFactor()?.[axis] ??
                  1)
                : 1),
          );
          for (const position of ps) {
            const w = subtract(position, a.position),
              wu = dot(w, u),
              wv = dot(w, v);
            const s = denominator ? (wu * vv - wv * uv) / denominator : 0,
              t = denominator ? (wv * uu - wu * uv) / denominator : 0;
            const tex = [0, 1].map(
              (axis) => a.uv[axis] + s * (b.uv[axis] - a.uv[axis]) + t * (c.uv[axis] - a.uv[axis]),
            );
            out.indices.push(out.vertices.length);
            out.vertices.push({ position, uv: tex, color });
          }
        }
      }
    }
    const output = [...groupsByMaterial.values()];
    triangles = output.reduce((sum, g) => sum + g.indices.length / 3, 0);
    for (const out of output) {
      const vertices = [],
        keys = new Map();
      out.indices = new Uint32Array(
        out.indices.map((id) => {
          const v = out.vertices[id],
            key = v.position.map((p) => Math.round(p * 100000)).join(',');
          let index = keys.get(key);
          if (index === undefined) {
            index = vertices.length;
            keys.set(key, index);
            vertices.push(v);
          }
          return index;
        }),
      );
      out.vertices = vertices;
    }
    if (triangles > target) {
      const ratio = target / triangles;
      for (const group of output) {
        const [reduced] = MeshoptSimplifier.simplify(
          group.indices,
          new Float32Array(group.vertices.flatMap((v) => v.position)),
          3,
          Math.max(3, Math.floor((group.indices.length * ratio) / 3) * 3),
          grid,
          ['ErrorAbsolute'],
        );
        group.indices = reduced;
      }
      triangles = output.reduce((sum, group) => sum + group.indices.length / 3, 0);
    }
    if (triangles > 0 && (!best || triangles < best.triangles))
      best = { groups: output, triangles, grid: Math.hypot(...steps) };
    if (triangles > 0 && triangles <= target * 1.1) return best;
    grid *= Math.max(1.35, Math.sqrt(triangles / target) * 1.1);
  }
  if (best && best.triangles <= target * 4) return best;
  throw new Error(`Convex derivative cannot meet ${target} triangles (best ${best?.triangles})`);
}
