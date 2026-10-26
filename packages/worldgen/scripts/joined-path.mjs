/** Continuous polygonal trim. Shared rings replace the end caps of touching rods. */
import './install-deterministic-math.mjs';

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, s) => a.map((v) => v * s);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a) => Math.hypot(...a);
const unit = (a) => mul(a, 1 / length(a));
const same = (a, b) => length(sub(a, b)) < 1e-9;
const rotate = (v, axis, angle) =>
  add(
    add(mul(v, Math.cos(angle)), mul(cross(axis, v), Math.sin(angle))),
    mul(axis, dot(axis, v) * (1 - Math.cos(angle))),
  );
function transport(v, a, b) {
  const axis = cross(a, b),
    sine = length(axis);
  return sine < 1e-10 ? v : rotate(v, mul(axis, 1 / sine), Math.atan2(sine, dot(a, b)));
}

/** Open or closed 3D polyline, circular cross section, exact miter planes at ordinary bends.
 * Duplicate stations are removed. Tight bends use a bounded miter rather than an unbounded spike.
 * The first bend fixes the facet orientation; transport keeps it coherent on non-planar paths.
 */
export function joinedPath(input, radius, sides = 6, closed = false, section) {
  if (!(radius > 0 && Number.isFinite(radius)) || !Number.isInteger(sides) || sides < 3)
    throw Error('joinedPath requires a positive radius and at least three sides');
  const points = [];
  for (const p of input) {
    if (p.length !== 3 || !p.every(Number.isFinite))
      throw Error('joinedPath requires finite 3D points');
    if (!points.length || !same(p, points.at(-1))) points.push([...p]);
  }
  if (points.length > 2 && same(points[0], points.at(-1))) {
    points.pop();
    closed = true;
  }
  if (points.length < (closed ? 3 : 2)) throw Error('joinedPath has too few distinct points');
  const count = points.length,
    segments = count - (closed ? 0 : 1);
  const directions = Array.from({ length: segments }, (_, i) =>
    unit(sub(points[(i + 1) % count], points[i])),
  );
  let normal = section
    ? unit(cross(directions[0], Math.abs(directions[0][1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]))
    : undefined;
  for (let i = 1; i < segments; i++) {
    if (normal) break;
    const n = cross(directions[i - 1], directions[i]);
    if (length(n) > 1e-8) {
      normal = unit(n);
      break;
    }
  }
  normal ??= unit(cross(directions[0], Math.abs(directions[0][1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]));
  const frames = [normal];
  for (let i = 1; i < segments; i++)
    frames.push(transport(frames[i - 1], directions[i - 1], directions[i]));
  if (closed) {
    const end = transport(frames.at(-1), directions.at(-1), directions[0]);
    const twist = Math.atan2(dot(directions[0], cross(end, normal)), dot(end, normal));
    for (let i = 1; i < segments; i++)
      frames[i] = rotate(frames[i], directions[i], (twist * i) / segments);
  }
  const rings = points.map((p, i) => {
    const before = directions[(i + segments - 1) % segments];
    const after = directions[i % segments];
    const endpoint = !closed && (i === 0 || i === count - 1);
    const incoming = endpoint ? (i === 0 ? after : before) : before;
    const outgoing = endpoint ? incoming : after;
    const sum = add(incoming, outgoing);
    if (length(sum) < 1e-8) throw Error('joinedPath cannot reverse direction at a station');
    const tangent = unit(sum),
      bend = sub(outgoing, incoming);
    const n =
      i === 0 ? transport(frames[0], after, tangent) : transport(frames[i - 1], incoming, tangent);
    const b = cross(tangent, n);
    const scale = Math.min(4, 1 / Math.max(1e-8, dot(tangent, incoming)));
    const axis = length(bend) < 1e-8 ? [0, 0, 0] : unit(bend);
    return Array.from({ length: sides }, (_, j) => {
      const angle = (j * 2 * Math.PI) / sides;
      const [u, v] = section?.[j] ?? [radius * Math.cos(angle), radius * Math.sin(angle)];
      const r = add(mul(n, u), mul(b, v));
      return add(p, add(r, mul(axis, dot(r, axis) * (scale - 1))));
    });
  });
  const positions = rings.flat(2),
    indices = [];
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j,
        b = i * sides + ((j + 1) % sides);
      const c = ((i + 1) % count) * sides + ((j + 1) % sides),
        d = ((i + 1) % count) * sides + j;
      indices.push(a, b, c, a, c, d);
    }
  if (!closed) {
    for (const [i, reverse] of [
      [0, true],
      [count - 1, false],
    ]) {
      const center = positions.length / 3;
      positions.push(...points[i]);
      for (let j = 0; j < sides; j++) {
        const a = i * sides + j,
          b = i * sides + ((j + 1) % sides);
        indices.push(center, reverse ? b : a, reverse ? a : b);
      }
    }
  }
  return { positions, indices, rings, points, closed };
}

export function joinedBeamPath(input, width, depth, closed = false) {
  if (!(width > 0 && depth > 0 && Number.isFinite(width) && Number.isFinite(depth)))
    throw Error('joinedBeamPath requires positive finite dimensions');
  return joinedPath(input, 1, 4, closed, [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ]);
}
